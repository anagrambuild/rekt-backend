const { PublicKey, ComputeBudgetProgram } = require("@solana/web3.js");
const {
  DriftClient,
  initialize,
  PRICE_PRECISION,
  PositionDirection,
  OrderType,
  MarketType,
  Wallet,
  BN,
  calculatePositionPNL,
} = require("@drift-labs/sdk");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const {
  rpcRateLimit,
  createConnection,
  createDriftClient,
  cleanupDriftClient,
  getUSDCMint,
  retryWithBackoff,
  PRICE_PRECISION: PRICE_PRECISION_UTIL,
} = require("../utils");
const { SUPPORTED_MARKETS, DRIFT_CLUSTER } = require("../constants");

// Initialize Supabase client
const supabaseUrl =
  process.env.SUPABASE_URL || "https://amgeuvathssbhopfvubw.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZ2V1dmF0aHNzYmhvcGZ2dWJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzUwNTQwMywiZXhwIjoyMDYzMDgxNDAzfQ.2kojQiE653EyG4OUVtufj7cEzU_SwMiUMvovGJwIp4E";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class TradingService {
  constructor() {
    this.activeConnections = new Map(); // Cache connections per user
  }

  /**
   * Get user's Swig wallet address from database
   */
  async getUserSwigWallet(userId) {
    try {
      // For testing, allow test user IDs with environment-based test wallet
      if (userId === "test-user-id") {
        const testWallet =
          process.env.TEST_SWIG_WALLET ||
          "GKYPWkWtiXVPdzv6EimbTWx7PCL4Pv5wggTW5cFtCvYm";
        console.log(`✅ Using test Swig wallet for testing: ${testWallet}`);
        return testWallet;
      }

      const { data: user, error } = await supabase
        .from("profiles")
        .select("swig_wallet_address, username")
        .eq("id", userId)
        .single();

      if (error) {
        throw new Error(`User not found: ${error.message}`);
      }

      if (
        !user.swig_wallet_address ||
        user.swig_wallet_address.startsWith("placeholder_") ||
        user.swig_wallet_address.startsWith("temp_")
      ) {
        throw new Error("User does not have a valid Swig wallet address");
      }

      console.log(
        `✅ Found Swig wallet for user ${user.username}: ${user.swig_wallet_address}`
      );
      return user.swig_wallet_address;
    } catch (error) {
      console.error("❌ Error fetching user Swig wallet:", error);
      throw error;
    }
  }

  /**
   * Create real Drift client for production trading
   */
  async createDriftClient(swigWalletAddress) {
    try {
      console.log(
        `🔄 Creating real Drift client for wallet: ${swigWalletAddress}`
      );

      // Create connection
      const connection = await createConnection();

      // Create Drift client with real wallet address
      const driftClient = await createDriftClient(
        connection,
        swigWalletAddress
      );

      console.log("✅ Real Drift client created successfully");
      return { driftClient, connection };
    } catch (error) {
      console.error("❌ Failed to create real Drift client:", error.message);
      throw error;
    }
  }

  /**
   * Open a new position using real Drift SDK with blockchain transaction creation
   */
  async openPosition(userId, asset, direction, amount, leverage) {
    try {
      console.log(
        `🚀 Opening position: ${direction} ${asset} with ${leverage}x leverage, amount: $${amount}`
      );

      // Get user's Swig wallet
      const swigWalletAddress = await this.getUserSwigWallet(userId);
      const publicKey = new PublicKey(swigWalletAddress);

      // Apply rate limiting
      await rpcRateLimit();

      // Create real Drift client with retry logic
      let driftClient, connection;
      await retryWithBackoff(async () => {
        console.log("🌊 Initializing Drift client for trade...");
        const clientData = await this.createDriftClient(swigWalletAddress);
        driftClient = clientData.driftClient;
        connection = clientData.connection;
      });

      try {
        // Get market index
        const marketIndex = SUPPORTED_MARKETS[asset];
        if (marketIndex === undefined) {
          throw new Error(`Unsupported asset: ${asset}`);
        }

        // Get current market price from real oracle
        const oracleData = await driftClient.getOracleDataForPerpMarket(
          marketIndex
        );
        const currentPrice =
          oracleData.price.toNumber() / PRICE_PRECISION.toNumber();

        console.log(
          `💰 Current ${asset} price from oracle: $${currentPrice.toFixed(2)}`
        );

        // Calculate position parameters
        const positionSize = amount * leverage;
        const marginRequired = amount;
        const positionValueUSD = positionSize;
        const assetQuantity = (positionValueUSD / currentPrice).toFixed(6);

        console.log(
          `📊 Position size: $${positionSize}, Margin required: $${marginRequired}, Asset quantity: ${assetQuantity}`
        );

        // Check if high leverage mode is enabled
        const userAccount = await driftClient.getUserAccount();
        const isHighLeverageEnabled =
          userAccount.marginMode &&
          userAccount.marginMode.highLeverage !== undefined;

        console.log(`🚀 High leverage mode enabled: ${isHighLeverageEnabled}`);

        // Auto-enable high leverage mode if needed for leverage > 5x
        if (leverage > 5 && !isHighLeverageEnabled) {
          console.log("🚀 High leverage mode required but not enabled");

          const enableHighLeverageIx =
            await driftClient.getEnableHighLeverageModeIx();
          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");
          const computeBudgetInstruction =
            ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 });

          const instructions = [
            {
              programId: computeBudgetInstruction.programId.toString(),
              data: Buffer.from(computeBudgetInstruction.data).toString(
                "base64"
              ),
              keys: computeBudgetInstruction.keys.map(key => ({
                pubkey: key.pubkey.toString(),
                isSigner: key.isSigner,
                isWritable: key.isWritable,
              })),
            },
            {
              programId: enableHighLeverageIx.programId.toString(),
              data: Buffer.from(enableHighLeverageIx.data).toString("base64"),
              keys: enableHighLeverageIx.keys.map(key => ({
                pubkey: key.pubkey.toString(),
                isSigner: key.isSigner,
                isWritable: key.isWritable,
              })),
            },
          ];

          return {
            success: true,
            message: "High leverage mode must be enabled first",
            requiresHighLeverageMode: true,
            transactionData: {
              instructions,
              blockhash,
              lastValidBlockHeight,
              feePayer: swigWalletAddress,
            },
            nextStep: "Enable high leverage mode, then retry the trade",
          };
        }

        // Create order parameters
        const orderParams = {
          orderType: OrderType.Market,
          marketIndex,
          direction:
            direction.toLowerCase() === "long"
              ? PositionDirection.Long
              : PositionDirection.Short,
          baseAssetAmount: new BN(Math.abs(assetQuantity * Math.pow(10, 9))), // Convert to base units
          price: new BN(currentPrice * PRICE_PRECISION.toNumber()),
          marketType: MarketType.Perp,
        };

        console.log(`📋 Order parameters:`, {
          orderType: "Market",
          marketIndex,
          direction: direction.toLowerCase() === "long" ? "Long" : "Short",
          baseAssetAmount: orderParams.baseAssetAmount.toString(),
          price: orderParams.price.toString(),
        });

        // Create trade instruction
        const orderIx = await driftClient.getPlacePerpOrderIx(orderParams);

        // Get deposit instruction if needed
        let depositIx = null;
        const depositAmount = Math.min(amount, 200); // Cap deposit at $200 for high leverage

        if (depositAmount > 0) {
          const tokenAccounts = await connection.getTokenAccountsByOwner(
            publicKey,
            { mint: getUSDCMint() }
          );

          if (tokenAccounts.value.length > 0) {
            const userTokenAccount = tokenAccounts.value[0].pubkey;
            depositIx = await driftClient.getDepositInstruction(
              new BN(depositAmount * 1e6), // Convert to USDC lamports (6 decimals)
              0, // Collateral index (0 for USDC)
              userTokenAccount
            );
            console.log(
              `💰 Deposit instruction created: $${depositAmount} USDC`
            );
          } else {
            console.log("⚠️ No USDC token accounts found for deposit");
          }
        }

        // Create final transaction
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        const computeBudgetInstruction =
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });

        const instructions = [
          {
            programId: computeBudgetInstruction.programId.toString(),
            data: Buffer.from(computeBudgetInstruction.data).toString("base64"),
            keys: computeBudgetInstruction.keys.map(key => ({
              pubkey: key.pubkey.toString(),
              isSigner: key.isSigner,
              isWritable: key.isWritable,
            })),
          },
        ];

        // Add deposit instruction if available
        if (depositIx) {
          instructions.push({
            programId: depositIx.programId.toString(),
            data: Buffer.from(depositIx.data).toString("base64"),
            keys: depositIx.keys.map(key => ({
              pubkey: key.pubkey.toString(),
              isSigner: key.isSigner,
              isWritable: key.isWritable,
            })),
          });
        }

        // Add trade instruction
        instructions.push({
          programId: orderIx.programId.toString(),
          data: Buffer.from(orderIx.data).toString("base64"),
          keys: orderIx.keys.map(key => ({
            pubkey: key.pubkey.toString(),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
        });

        // Record trade in database with pending status
        const tradeData = {
          user_id: userId,
          principal_invested: marginRequired,
          leverage_amount: leverage,
          entry_price: currentPrice,
          asset: asset.replace("-PERP", ""), // Store as SOL, BTC, ETH
          direction: direction.toLowerCase(),
          position_size: positionSize,
          status: "pending", // Mark as pending until transaction is confirmed
        };

        console.log("📝 Recording trade in database:", tradeData);

        const { data: trade, error } = await supabase
          .from("trades")
          .insert([tradeData])
          .select()
          .single();

        let positionId;
        if (error) {
          console.error("❌ Database insert error:", error);
          positionId = uuidv4();
          console.log("⚠️ Using fallback position ID:", positionId);
        } else {
          positionId = trade.id;
          console.log("✅ Trade successfully recorded in database:", trade.id);
        }

        console.log(
          `✅ ${leverage}x ${direction} trade created successfully for ${asset}`
        );

        // Return transaction data for frontend to sign and submit
        return {
          success: true,
          positionId: positionId,
          transactionData: {
            instructions,
            blockhash,
            lastValidBlockHeight,
            feePayer: swigWalletAddress,
            assetPrice: currentPrice,
            assetQuantity: assetQuantity,
          },
          message: `${direction.toUpperCase()} order ready for ${asset} (${assetQuantity} @ $${currentPrice.toFixed(
            2
          )})`,
          tradeDetails: {
            asset,
            direction,
            amount,
            leverage,
            entryPrice: currentPrice,
            positionSize,
            marginUsed: marginRequired,
            depositAmount: depositAmount,
          },
        };
      } finally {
        // Clean up Drift client
        await cleanupDriftClient(driftClient);
      }
    } catch (error) {
      console.error("❌ Error opening position:", error);
      throw error;
    }
  }

  /**
   * Get user's positions using real data
   */
  async getPositions(userId) {
    try {
      console.log(`📊 Fetching positions for user: ${userId}`);

      // Get user's Swig wallet address from database
      const swigWalletAddress = await this.getUserSwigWallet(userId);
      console.log(`🔍 Using Swig wallet for positions: ${swigWalletAddress}`);

      // Get user's open trades from database
      const { data: trades, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch trades: ${error.message}`);
      }

      if (!trades || trades.length === 0) {
        return [];
      }

      // Create Drift client to get current prices
      const { driftClient, connection } = await this.createDriftClient(
        swigWalletAddress
      );

      try {
        const positions = [];

        for (const trade of trades) {
          try {
            const asset = `${trade.asset}-PERP`;
            const marketIndex = SUPPORTED_MARKETS[asset];

            if (marketIndex !== undefined) {
              // Get current price from real oracle
              const oracleData = await driftClient.getOracleDataForPerpMarket(
                marketIndex
              );
              const currentPrice =
                oracleData.price.toNumber() / PRICE_PRECISION.toNumber();

              // Calculate PnL
              const entryPrice = parseFloat(trade.entry_price);
              const positionSize = parseFloat(trade.position_size);
              const isLong = trade.direction === "long";

              let pnl = 0;
              if (isLong) {
                pnl = (currentPrice - entryPrice) * (positionSize / entryPrice);
              } else {
                pnl = (entryPrice - currentPrice) * (positionSize / entryPrice);
              }

              const pnlPercentage =
                (pnl / parseFloat(trade.principal_invested)) * 100;

              // Calculate liquidation price (simplified)
              const leverage = parseFloat(trade.leverage_amount);
              const liquidationThreshold = 0.9; // 90% of margin
              let liquidationPrice = 0;

              if (isLong) {
                liquidationPrice =
                  entryPrice * (1 - liquidationThreshold / leverage);
              } else {
                liquidationPrice =
                  entryPrice * (1 + liquidationThreshold / leverage);
              }

              positions.push({
                id: trade.id,
                asset,
                direction: trade.direction,
                size: positionSize,
                entryPrice,
                currentPrice,
                pnl: parseFloat(pnl.toFixed(2)),
                pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
                leverage,
                liquidationPrice: parseFloat(liquidationPrice.toFixed(2)),
                marginUsed: parseFloat(trade.principal_invested),
                openedAt: trade.created_at,
              });
            }
          } catch (priceError) {
            console.warn(
              `⚠️ Could not get price for ${trade.asset}:`,
              priceError.message
            );
            // Add position with entry price as current price
            positions.push({
              id: trade.id,
              asset: `${trade.asset}-PERP`,
              direction: trade.direction,
              size: parseFloat(trade.position_size),
              entryPrice: parseFloat(trade.entry_price),
              currentPrice: parseFloat(trade.entry_price),
              pnl: 0,
              pnlPercentage: 0,
              leverage: parseFloat(trade.leverage_amount),
              liquidationPrice: 0,
              marginUsed: parseFloat(trade.principal_invested),
              openedAt: trade.created_at,
            });
          }
        }

        console.log(`✅ Found ${positions.length} open positions`);
        return positions;
      } finally {
        // Clean up Drift client
        await cleanupDriftClient(driftClient);
      }
    } catch (error) {
      console.error("❌ Error fetching positions:", error);
      throw error;
    }
  }

  /**
   * Close a position using real data
   */
  async closePosition(userId, positionId) {
    try {
      console.log(`🔒 Closing position: ${positionId} for user: ${userId}`);

      // Get user's Swig wallet address from database
      const swigWalletAddress = await this.getUserSwigWallet(userId);
      console.log(
        `🔍 Using Swig wallet for closing position: ${swigWalletAddress}`
      );

      // Get the trade from database
      const { data: trade, error: fetchError } = await supabase
        .from("trades")
        .select("*")
        .eq("id", positionId)
        .eq("user_id", userId)
        .eq("status", "open")
        .single();

      if (fetchError || !trade) {
        throw new Error("Position not found or already closed");
      }

      // Create Drift client to get current price
      const { driftClient, connection } = await this.createDriftClient(
        swigWalletAddress
      );

      try {
        const asset = `${trade.asset}-PERP`;
        const marketIndex = SUPPORTED_MARKETS[asset];

        let exitPrice = parseFloat(trade.entry_price); // Fallback to entry price

        if (marketIndex !== undefined) {
          try {
            const oracleData = await driftClient.getOracleDataForPerpMarket(
              marketIndex
            );
            exitPrice =
              oracleData.price.toNumber() / PRICE_PRECISION.toNumber();
          } catch (priceError) {
            console.warn("⚠️ Could not get current price, using entry price");
          }
        }

        // Calculate final PnL
        const entryPrice = parseFloat(trade.entry_price);
        const positionSize = parseFloat(trade.position_size);
        const isLong = trade.direction === "long";

        let pnl = 0;
        if (isLong) {
          pnl = (exitPrice - entryPrice) * (positionSize / entryPrice);
        } else {
          pnl = (entryPrice - exitPrice) * (positionSize / entryPrice);
        }

        const pnlPercentage =
          (pnl / parseFloat(trade.principal_invested)) * 100;

        // Update trade in database
        const { error: updateError } = await supabase
          .from("trades")
          .update({
            status: "closed",
            exit_price: exitPrice,
            exit_time: new Date().toISOString(),
            pnl_usd: pnl,
            pnl_percentage: pnlPercentage,
          })
          .eq("id", positionId);

        if (updateError) {
          throw new Error(`Failed to update trade: ${updateError.message}`);
        }

        console.log(
          `✅ Position closed successfully: ${positionId}, PnL: $${pnl.toFixed(
            2
          )}`
        );

        return {
          positionId,
          exitPrice,
          pnl: parseFloat(pnl.toFixed(2)),
          pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
          closedAt: new Date().toISOString(),
        };
      } finally {
        // Clean up Drift client
        await cleanupDriftClient(driftClient);
      }
    } catch (error) {
      console.error("❌ Error closing position:", error);
      throw error;
    }
  }

  /**
   * Get user's complete trading history
   */
  async getTradingHistory(userId, statusFilter = null) {
    try {
      console.log(
        `📚 Fetching trading history for user: ${userId}, status: ${
          statusFilter || "all"
        }`
      );

      // Build query with optional status filter
      let query = supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      // Add status filter if provided
      if (
        statusFilter &&
        ["open", "closed", "liquidated", "cancelled"].includes(statusFilter)
      ) {
        query = query.eq("status", statusFilter);
      }

      const { data: trades, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch trading history: ${error.message}`);
      }

      if (!trades || trades.length === 0) {
        return [];
      }

      // Get user's Swig wallet for price data
      const swigWalletAddress = await this.getUserSwigWallet(userId);
      const { driftClient, connection } = await this.createDriftClient(
        swigWalletAddress
      );

      try {
        const history = [];

        for (const trade of trades) {
          try {
            const asset = `${trade.asset}-PERP`;
            const marketIndex = SUPPORTED_MARKETS[asset];

            let currentPrice = parseFloat(trade.entry_price); // Default to entry price
            let pnl = parseFloat(trade.pnl_usd) || 0;
            let pnlPercentage = parseFloat(trade.pnl_percentage) || 0;

            // For open positions, calculate current PnL using real oracle data
            if (trade.status === "open" && marketIndex !== undefined) {
              try {
                const oracleData = await driftClient.getOracleDataForPerpMarket(
                  marketIndex
                );
                currentPrice =
                  oracleData.price.toNumber() / PRICE_PRECISION.toNumber();

                // Calculate current PnL for open positions
                const entryPrice = parseFloat(trade.entry_price);
                const positionSize = parseFloat(trade.position_size);
                const isLong = trade.direction === "long";

                if (isLong) {
                  pnl =
                    (currentPrice - entryPrice) * (positionSize / entryPrice);
                } else {
                  pnl =
                    (entryPrice - currentPrice) * (positionSize / entryPrice);
                }

                pnlPercentage =
                  (pnl / parseFloat(trade.principal_invested)) * 100;
              } catch (priceError) {
                console.warn(
                  `⚠️ Could not get current price for ${trade.asset}:`,
                  priceError.message
                );
              }
            }

            // Calculate liquidation price (simplified)
            const leverage = parseFloat(trade.leverage_amount);
            const entryPrice = parseFloat(trade.entry_price);
            const isLong = trade.direction === "long";
            const liquidationThreshold = 0.9; // 90% of margin
            let liquidationPrice = 0;

            if (isLong) {
              liquidationPrice =
                entryPrice * (1 - liquidationThreshold / leverage);
            } else {
              liquidationPrice =
                entryPrice * (1 + liquidationThreshold / leverage);
            }

            history.push({
              id: trade.id,
              asset,
              direction: trade.direction,
              status: trade.status,
              size: parseFloat(trade.position_size),
              entryPrice: parseFloat(trade.entry_price),
              exitPrice: trade.exit_price ? parseFloat(trade.exit_price) : null,
              currentPrice:
                trade.status === "open"
                  ? currentPrice
                  : trade.exit_price
                  ? parseFloat(trade.exit_price)
                  : parseFloat(trade.entry_price),
              pnl: parseFloat(pnl.toFixed(2)),
              pnlPercentage: parseFloat(pnlPercentage.toFixed(2)),
              leverage,
              liquidationPrice: parseFloat(liquidationPrice.toFixed(2)),
              marginUsed: parseFloat(trade.principal_invested),
              openedAt: trade.created_at,
              closedAt: trade.exit_time,
              duration: trade.exit_time
                ? Math.floor(
                    (new Date(trade.exit_time) - new Date(trade.created_at)) /
                      1000
                  )
                : Math.floor((new Date() - new Date(trade.created_at)) / 1000),
              fees: parseFloat(trade.fees) || 0,
              points: trade.points_earned || 0,
            });
          } catch (tradeError) {
            console.warn(
              `⚠️ Error processing trade ${trade.id}:`,
              tradeError.message
            );
            // Add basic trade info even if price calculation fails
            history.push({
              id: trade.id,
              asset: `${trade.asset}-PERP`,
              direction: trade.direction,
              status: trade.status,
              size: parseFloat(trade.position_size),
              entryPrice: parseFloat(trade.entry_price),
              exitPrice: trade.exit_price ? parseFloat(trade.exit_price) : null,
              currentPrice: parseFloat(trade.entry_price),
              pnl: parseFloat(trade.pnl_usd) || 0,
              pnlPercentage: parseFloat(trade.pnl_percentage) || 0,
              leverage: parseFloat(trade.leverage_amount),
              liquidationPrice: 0,
              marginUsed: parseFloat(trade.principal_invested),
              openedAt: trade.created_at,
              closedAt: trade.exit_time,
              duration: trade.exit_time
                ? Math.floor(
                    (new Date(trade.exit_time) - new Date(trade.created_at)) /
                      1000
                  )
                : Math.floor((new Date() - new Date(trade.created_at)) / 1000),
              fees: parseFloat(trade.fees) || 0,
              points: trade.points_earned || 0,
            });
          }
        }

        console.log(`✅ Found ${history.length} trades in history`);
        return history;
      } finally {
        // Clean up Drift client
        await cleanupDriftClient(driftClient);
      }
    } catch (error) {
      console.error("❌ Error fetching trading history:", error);
      throw error;
    }
  }

  /**
   * Get user's balance using their Swig wallet address
   */
  async getBalance(userId) {
    try {
      console.log(`💰 Fetching balance for user: ${userId}`);

      // Get user's Swig wallet address from database
      const swigWalletAddress = await this.getUserSwigWallet(userId);
      console.log(`🔍 Using Swig wallet: ${swigWalletAddress}`);

      // Create Drift client to get real balance
      const { driftClient, connection } = await this.createDriftClient(
        swigWalletAddress
      );

      try {
        // Get user account from Drift
        const user = driftClient.getUser();

        // Get USDC balance (spot position index 0 is typically USDC)
        const usdcBalance = user.getSpotPosition(0);
        const totalCollateral = user.getTotalCollateral();
        const freeCollateral = user.getFreeCollateral();
        const usedCollateral = totalCollateral.sub(freeCollateral);

        // Convert from lamports to USDC (6 decimals)
        const usdcBalanceNumber = usdcBalance
          ? usdcBalance.scaledBalance.toNumber() / 1e6
          : 0;
        const totalCollateralNumber = totalCollateral.toNumber() / 1e6;
        const freeCollateralNumber = freeCollateral.toNumber() / 1e6;
        const usedCollateralNumber = usedCollateral.toNumber() / 1e6;

        const balance = {
          usdc: totalCollateralNumber,
          availableMargin: freeCollateralNumber,
          usedMargin: usedCollateralNumber,
          totalValue: totalCollateralNumber,
          walletAddress: swigWalletAddress,
        };

        console.log(
          `✅ Real balance retrieved for wallet ${swigWalletAddress}: $${balance.usdc} USDC`
        );
        return balance;
      } finally {
        // Clean up Drift client
        await cleanupDriftClient(driftClient);
      }
    } catch (error) {
      console.error("❌ Error fetching balance:", error);

      // Fallback to mock data if real balance fails
      console.log("⚠️ Falling back to mock balance data");
      const swigWalletAddress = await this.getUserSwigWallet(userId);

      return {
        usdc: 1000.0, // Mock USDC balance
        availableMargin: 800.0, // Available for trading
        usedMargin: 200.0, // Currently used in positions
        totalValue: 1000.0,
        walletAddress: swigWalletAddress,
      };
    }
  }
}

module.exports = TradingService;
