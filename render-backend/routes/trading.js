const express = require("express");
const { PublicKey } = require("@solana/web3.js");
const { createClient } = require("@supabase/supabase-js");
const {
  asyncHandler,
  createErrorResponse,
  createSuccessResponse,
  createConnection,
  getUSDCMint,
} = require("../utils");
const TradingService = require("../services/trading");

// Initialize Supabase client
const supabaseUrl =
  process.env.SUPABASE_URL || "https://amgeuvathssbhopfvubw.supabase.co";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZ2V1dmF0aHNzYmhvcGZ2dWJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzUwNTQwMywiZXhwIjoyMDYzMDgxNDAzfQ.2kojQiE653EyG4OUVtufj7cEzU_SwMiUMvovGJwIp4E";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = express.Router();

// Initialize trading service
const tradingService = new TradingService();

// POST /api/trading/open - Open a new position
router.post(
  "/open",
  asyncHandler(async (req, res) => {
    try {
      const { userId, asset, direction, amount, leverage } = req.body;

      // Basic validation
      if (!userId || !asset || !direction || !amount || !leverage) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing required fields"),
              "userId, asset, direction, amount, and leverage are required",
              400
            )
          );
      }

      // Validate leverage range
      if (leverage < 1 || leverage > 100) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid leverage"),
              "Leverage must be between 1 and 100",
              400
            )
          );
      }

      // Validate direction
      if (!["long", "short"].includes(direction.toLowerCase())) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid direction"),
              "Direction must be 'long' or 'short'",
              400
            )
          );
      }

      // Validate asset
      const validAssets = ["SOL-PERP", "BTC-PERP", "ETH-PERP"];
      if (!validAssets.includes(asset)) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid asset"),
              `Asset must be one of: ${validAssets.join(", ")}`,
              400
            )
          );
      }

      // Validate amount
      if (amount < 10) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid amount"),
              "Minimum trade amount is $10",
              400
            )
          );
      }

      console.log(
        `🚀 Opening position: ${direction} ${asset} with ${leverage}x leverage, amount: $${amount}`
      );

      // Open position using trading service
      const result = await tradingService.openPosition(
        userId,
        asset,
        direction,
        amount,
        leverage
      );

      res.json(createSuccessResponse(result, "Position opened successfully"));
    } catch (error) {
      console.error("❌ Error opening position:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to open position", 500));
    }
  })
);

// GET /api/trading/positions/:userId - Get user's positions
router.get(
  "/positions/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing userId"),
              "User ID is required",
              400
            )
          );
      }

      console.log(`📊 Fetching positions for user: ${userId}`);

      // Get positions using trading service
      const positions = await tradingService.getPositions(userId);

      res.json(
        createSuccessResponse(positions, "Positions retrieved successfully")
      );
    } catch (error) {
      console.error("❌ Error fetching positions:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to fetch positions", 500));
    }
  })
);

// GET /api/trading/history/:userId - Get user's complete trading history
router.get(
  "/history/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.query; // Optional filter: ?status=open or ?status=closed

      if (!userId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing userId"),
              "User ID is required",
              400
            )
          );
      }

      console.log(
        `📚 Fetching trading history for user: ${userId}, status filter: ${
          status || "all"
        }`
      );

      // Get trading history using trading service
      const history = await tradingService.getTradingHistory(userId, status);

      res.json(
        createSuccessResponse(history, "Trading history retrieved successfully")
      );
    } catch (error) {
      console.error("❌ Error fetching trading history:", error);
      res
        .status(500)
        .json(
          createErrorResponse(error, "Failed to fetch trading history", 500)
        );
    }
  })
);

// POST /api/trading/close - Close a position
router.post(
  "/close",
  asyncHandler(async (req, res) => {
    try {
      const { userId, positionId } = req.body;

      if (!userId || !positionId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing required fields"),
              "userId and positionId are required",
              400
            )
          );
      }

      console.log(`🔒 Closing position: ${positionId} for user: ${userId}`);

      // Close position using trading service
      const result = await tradingService.closePosition(userId, positionId);

      res.json(createSuccessResponse(result, "Position closed successfully"));
    } catch (error) {
      console.error("❌ Error closing position:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to close position", 500));
    }
  })
);

// GET /api/trading/balance/:userId - Get user's balance
router.get(
  "/balance/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Missing userId"),
              "User ID is required",
              400
            )
          );
      }

      console.log(`💰 Fetching balance for user: ${userId}`);

      // Get balance using trading service
      const balance = await tradingService.getBalance(userId);

      res.json(
        createSuccessResponse(balance, "Balance retrieved successfully")
      );
    } catch (error) {
      console.error("❌ Error fetching balance:", error);
      res
        .status(500)
        .json(createErrorResponse(error, "Failed to fetch balance", 500));
    }
  })
);

// GET /api/trading/wallet-balance/:userId - Get user's wallet USDC balance from Solana blockchain
router.get(
  "/wallet-balance/:userId",
  asyncHandler(async (req, res) => {
    try {
      const { userId } = req.params;
      console.log(`🔍 Fetching wallet balance for user: ${userId}`);

      // Get user's Swig wallet address from database
      const { data: user, error } = await supabase
        .from("profiles")
        .select("swig_wallet_address, username")
        .eq("id", userId)
        .single();

      if (error) {
        return res
          .status(404)
          .json(
            createErrorResponse(
              new Error("User not found"),
              "User not found in database",
              404
            )
          );
      }

      if (!user.swig_wallet_address) {
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("No Swig wallet address"),
              "User does not have a Swig wallet address",
              400
            )
          );
      }

      const swigWalletAddress = user.swig_wallet_address;
      console.log(
        `🔍 Using Swig wallet address for ${user.username}: ${swigWalletAddress}`
      );

      // Parse Swig wallet address to PublicKey
      let publicKey;
      try {
        publicKey = new PublicKey(swigWalletAddress);
      } catch (e) {
        console.error(
          `❌ Invalid Swig wallet address: ${swigWalletAddress}`,
          e
        );
        return res
          .status(400)
          .json(
            createErrorResponse(
              new Error("Invalid Swig wallet address format"),
              "Invalid Solana wallet address format",
              400
            )
          );
      }

      // Create connection
      const connection = await createConnection();
      console.log(`✅ Connected to Solana RPC`);

      // Fetch USDC token accounts for Swig wallet
      console.log(
        `🔍 Fetching token accounts for Swig wallet: ${swigWalletAddress}`
      );
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: getUSDCMint() }
      );

      console.log(`📊 Found ${tokenAccounts.value.length} USDC token accounts`);

      // Calculate total USDC balance
      let usdcBalance = 0;
      tokenAccounts.value.forEach((account, index) => {
        try {
          const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
          console.log(`  - Account ${index + 1}: ${amount} USDC`);
          usdcBalance += amount;
        } catch (e) {
          console.error(`Error processing token account ${index}:`, e);
        }
      });

      console.log(
        `💰 Total Swig wallet USDC balance for ${
          user.username
        } (${swigWalletAddress}): $${usdcBalance.toFixed(2)}`
      );

      res.json(
        createSuccessResponse(
          {
            balance: usdcBalance,
            wallet: swigWalletAddress,
            username: user.username,
            tokenAccounts: tokenAccounts.value.length,
            walletType: "swig",
          },
          "Swig wallet USDC balance retrieved successfully"
        )
      );
    } catch (error) {
      console.error("❌ Error fetching user wallet balance:", error);
      res
        .status(500)
        .json(
          createErrorResponse(error, "Failed to fetch user wallet balance", 500)
        );
    }
  })
);

module.exports = router;
