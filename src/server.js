const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { DriftClient, Wallet, initialize, BN, PRICE_PRECISION, OrderType, PositionDirection } = require('@drift-labs/sdk');
const fetch = require('node-fetch');

// Solana RPC configuration - Using RPC Pool
const RPC_POOL_URL = 'https://austbot-austbot-234b.mainnet.rpcpool.com/a30e04d0-d9d6-4ac1-8503-38217fdb2821';

// Use RPC Pool as the primary RPC
const CUSTOM_RPC_URL = RPC_POOL_URL;

// RPC Rate limiting
let lastRpcCall = 0;
const RPC_MIN_INTERVAL = 1000; // Increased from 250ms to 1000ms (1 second)
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const rpcRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastRpcCall;
  if (timeSinceLastCall < RPC_MIN_INTERVAL) {
    const delay = RPC_MIN_INTERVAL - timeSinceLastCall;
    console.log(`⏳ Rate limiting: Waiting ${delay}ms before next RPC call...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRpcCall = Date.now();
};

const withRetry = async (fn, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) => {
  try {
    await rpcRateLimit();
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    
    // If rate limited, use the Retry-After header if available
    let retryAfter = delay;
    if (error.response && error.response.headers && error.response.headers['retry-after']) {
      retryAfter = parseInt(error.response.headers['retry-after']) * 1000 || delay;
    }
    
    console.log(`⚠️ RPC call failed, retrying in ${retryAfter}ms... (${retries} attempts left)`);
    await new Promise(resolve => setTimeout(resolve, retryAfter));
    return withRetry(fn, retries - 1, Math.min(delay * 2, 10000)); // Max 10s delay
  }
};

const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      console.log(`⏳ Retry ${i + 1}/${maxRetries} after ${delay}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3004;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Mock API endpoints to get frontend working
app.get('/api/markets', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        symbol: 'SOL-PERP',
        price: 151.80,
        volume24h: 1000000,
        change24h: 2.5,
        high24h: 155.0,
        low24h: 148.0,
        funding: 0.01,
        openInterest: 5000000
      },
      {
        symbol: 'BTC-PERP', 
        price: 108900,
        volume24h: 50000000,
        change24h: -1.2,
        high24h: 110000,
        low24h: 107000,
        funding: -0.005,
        openInterest: 100000000
      },
      {
        symbol: 'ETH-PERP',
        price: 2615,
        volume24h: 20000000,
        change24h: 1.8,
        high24h: 2650,
        low24h: 2580,
        funding: 0.008,
        openInterest: 30000000
      }
    ],
    timestamp: new Date().toISOString()
  });
});

// Wallet endpoints are now handled by the improved USDC balance endpoint below

// Real Drift SDK Trade Submission Endpoint
app.post('/api/trade/submit', async (req, res) => {
  try {
    const { walletAddress, tradeAmount, leverage, direction, marketSymbol } = req.body;
    
    console.log(`🎯 Trade submission request:`, {
      walletAddress,
      tradeAmount,
      leverage,
      direction,
      marketSymbol
    });
    
    // Validate required parameters
    if (!walletAddress || !tradeAmount || !leverage || !direction || !marketSymbol) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'walletAddress, tradeAmount, leverage, direction, and marketSymbol are required'
      });
    }
    
    if (marketSymbol !== 'SOL-PERP') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported market',
        message: 'Only SOL-PERP market is currently supported'
      });
    }
    
    // Apply rate limiting
    await rpcRateLimit();
    
    await retryWithBackoff(async () => {
      console.log('🔗 Connecting to Solana mainnet via custom RPC with rate limiting...');
      
      // Initialize Solana connection using user's custom RPC
      const connection = new Connection(CUSTOM_RPC_URL, 'confirmed');
      
      // Create a read-only wallet for the Drift client (actual signing happens in frontend)
      const publicKey = new PublicKey(walletAddress);
      const readOnlyWallet = {
        publicKey: publicKey,
        signTransaction: async (tx) => { throw new Error('Signing not supported in read-only mode'); },
        signAllTransactions: async (txs) => { throw new Error('Signing not supported in read-only mode'); }
      };
      
      // Initialize Drift client
      console.log('🌊 Initializing Drift client with mainnet environment...');
      await initialize({ env: 'mainnet-beta' });
      const driftClient = new DriftClient({
        connection: connection,
        wallet: readOnlyWallet,
        programID: new PublicKey('dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'),
        env: 'mainnet-beta'
      });
      
      // Subscribe to get market data
      console.log('📦 Subscribing to Drift client...');
      await driftClient.subscribe();
      
      try {
        // Get SOL-PERP market (index 0) - load accounts if needed
        console.log('📊 Fetching SOL-PERP market data...');
        let marketAcct = driftClient.getPerpMarketAccount(0);
        if (!marketAcct) {
          // Fetch accounts if not cached yet
          console.log('📥 Loading accounts...');
          await driftClient.fetchAccounts();
          marketAcct = driftClient.getPerpMarketAccount(0);
          if (!marketAcct) {
            throw new Error('SOL-PERP market not found after fetching accounts');
          }
          console.log('✅ SOL-PERP market found after loading accounts');
        }
        
        // Fetch live oracle price
        console.log('💰 Fetching live SOL oracle price...');
        let solPrice;
        try {
          const oraclePriceData = await driftClient.getOracleDataForPerpMarket(0);
          solPrice = oraclePriceData.price.toNumber() / PRICE_PRECISION.toNumber();
          console.log(`💰 Oracle price: ${solPrice}`);
        } catch (oracleError) {
          console.warn('⚠️ Failed to fetch oracle price, using market price as fallback:', oracleError.message);
          solPrice = marketAcct.amm.oraclePrice.toNumber() / PRICE_PRECISION.toNumber();
        }
        
        // Calculate base asset amount using Drift SDK precision methods
        console.log('📏 Trade calculations:');
        const solAmount = tradeAmount / solPrice; // Quantity of SOL to buy/sell
        console.log(`  - USD amount: $${tradeAmount}`);
        console.log(`  - SOL price: $${solPrice.toFixed(2)}`);
        console.log(`  - SOL quantity: ${solAmount.toFixed(4)}`);
        
        // Use Drift SDK's convertToPerpPrecision method for proper baseAssetAmount
        const baseAssetAmount = driftClient.convertToPerpPrecision(solAmount);
        
        console.log(`  - Base asset amount (SDK precision): ${baseAssetAmount.toString()}`);
        
        // Debug enum values
        console.log('🔍 Enum debugging:');
        console.log('  - OrderType.MARKET:', OrderType.MARKET);
        console.log('  - PositionDirection.LONG:', PositionDirection.LONG);
        console.log('  - PositionDirection.SHORT:', PositionDirection.SHORT);
        
        // Create order parameters using correct Drift SDK format (per official docs)
        const orderParams = {
          orderType: OrderType.MARKET,  // Use enum directly as per docs
          marketIndex: 0,
          direction: direction === 'long' ? PositionDirection.LONG : PositionDirection.SHORT,  // Use enum directly
          baseAssetAmount: baseAssetAmount,
          reduceOnly: false,
        };
        
        console.log('🔨 Creating Drift order instruction...');
        let orderIx;
        try {
          orderIx = await driftClient.getPlacePerpOrderIx(orderParams);
        } catch (driftError) {
          console.error('❌ getPlacePerpOrderIx error:', driftError);
          const detailedErr = new Error(`getPlacePerpOrderIx failed: ${driftError.message || driftError}`);
          detailedErr.stack = driftError.stack;
          throw detailedErr;
        }
        
        // Instead of creating and simulating the transaction on the server,
        // we'll return the instruction and required accounts to the frontend
        // where the wallet can sign and send the transaction directly
        console.log('📦 Preparing transaction data for frontend signing...');
        
        // Get a fresh blockhash with a longer commitment
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        
        // Create a versioned transaction (V0) for better compatibility
        const { VersionedTransaction, ComputeBudgetProgram } = require('@solana/web3.js');
        
        // Add a small delay to ensure the blockhash is fresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if user has a Drift account and sufficient collateral
        console.log('🔍 Checking user account status...');
        const userAccount = await driftClient.getUserAccount();
        
        // Prepare instructions array
        let instructions = [];
        
        // Add compute budget instruction
        instructions.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 500000 }));
        
        // If no user account exists, create one
        if (!userAccount) {
            console.log('🆕 Creating new user account...');
            const createAccountIx = await driftClient.getInitializeUserInstructions();
            instructions = instructions.concat(createAccountIx);
        }
        
        // Add deposit instruction
        console.log('💰 Depositing collateral...');
        
        // Get the user's USDC token account
        const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // USDC mint address
        
        // Get or create the associated token account
        const tokenAccounts = await connection.getTokenAccountsByOwner(
            new PublicKey(walletAddress),
            { mint: usdcMint }
        );
        
        if (tokenAccounts.value.length === 0) {
            throw new Error('No USDC token account found. Please deposit USDC to your wallet first.');
        }
        
        const userTokenAccount = tokenAccounts.value[0].pubkey;
        
        // Create deposit instruction
        const depositIx = await driftClient.getDepositInstruction(
            new BN(tradeAmount * 1e6), // Convert USDC to lamports (6 decimals)
            0, // Collateral index (0 for USDC)
            userTokenAccount // User's USDC token account
        );
        instructions.push(depositIx);
        
        // Add the trade instruction
        instructions.push(orderIx);
        
        // Get the required signers
        const signers = [];
        
        // Serialize instructions for the frontend
        const serializedInstructions = instructions.map(ix => {
            // Convert binary data to base64
            const data = typeof ix.data === 'string' 
                ? ix.data 
                : Buffer.from(ix.data).toString('base64');
                
            return {
                programId: ix.programId.toString(),
                data: data,
                keys: ix.keys.map(key => ({
                    pubkey: key.pubkey.toString(),
                    isSigner: key.isSigner,
                    isWritable: key.isWritable
                }))
            };
        });
        
        // Return the transaction data to the frontend for signing
        res.json({
          success: true,
          transactionData: {
            instructions: serializedInstructions,
            blockhash,
            lastValidBlockHeight,
            feePayer: walletAddress,
            solPrice: solPrice,
            solQuantity: solAmount.toString()
          },
          message: `${direction.toUpperCase()} order ready for ${marketSymbol} (${solAmount.toFixed(4)} SOL @ $${solPrice.toFixed(2)})`
        });
        
      } finally {
        try {
          await driftClient.unsubscribe();
          console.log('✅ Drift client unsubscribed');
        } catch (error) {
          console.warn('⚠️ Error unsubscribing Drift client:', error.message);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Trade submission error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Trade submission failed',
      message: error.message,
      simulationLogs: error.simulationLogs || [],
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      requestBody: req.body
    });
  }
});

// Positions endpoint (mock)
app.get('/api/markets/positions/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    // Mock empty positions
    res.json({
      success: true,
      data: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch positions',
      message: error.message
    });
  }
});

// WebSocket setup
const connectedClients = new Set();

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket client connected');
  connectedClients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Drift API'
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log('🔌 WebSocket client disconnected');
  });
});

// USDC Token Mint Address (USDC on Solana mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// USDC Balance Endpoint
app.get('/api/wallet/:walletAddress/usdc-balance', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        console.log(`🔍 Fetching USDC balance for wallet: ${walletAddress}`);
        
        if (!walletAddress) {
            console.error('❌ Wallet address is required');
            return res.status(400).json({ 
                success: false,
                error: 'Wallet address is required' 
            });
        }

        // Validate wallet address
        let publicKey;
        try {
            publicKey = new PublicKey(walletAddress);
        } catch (e) {
            console.error(`❌ Invalid wallet address: ${walletAddress}`, e);
            return res.status(400).json({ 
                success: false,
                error: 'Invalid wallet address format' 
            });
        }

        console.log(`🔗 Connecting to Solana RPC: ${CUSTOM_RPC_URL}`);
        const connection = new Connection(CUSTOM_RPC_URL, 'confirmed');
        
        // Test RPC connection
        try {
            const slot = await connection.getSlot();
            console.log(`✅ Connected to Solana RPC. Current slot: ${slot}`);
        } catch (e) {
            console.error('❌ Failed to connect to Solana RPC:', e);
            throw new Error(`Failed to connect to Solana RPC: ${e.message}`);
        }
        
        console.log(`🔍 Fetching token accounts for wallet: ${walletAddress}`);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            publicKey,
            { mint: USDC_MINT }
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

        console.log(`💰 Total USDC balance for ${walletAddress}: $${usdcBalance.toFixed(2)}`);
        
        res.json({
            success: true,
            balance: usdcBalance,
            wallet: walletAddress,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in USDC balance endpoint:', {
            error: error.message,
            stack: error.stack,
            wallet: req.params.walletAddress,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch USDC balance',
            wallet: req.params.walletAddress,
            timestamp: new Date().toISOString()
        });
    }
});

// Price update broadcasting
function startPriceUpdates() {
  setInterval(() => {
    if (connectedClients.size === 0) return;
    
    // Generate slightly random price changes
    const markets = [
      {
        symbol: 'SOL-PERP',
        price: 151.80 + (Math.random() - 0.5) * 2, // ±$1 variation
        volume24h: 1000000,
        change24h: 2.5 + (Math.random() - 0.5) * 0.5,
        high24h: 155.0,
        low24h: 148.0,
        funding: 0.01,
        openInterest: 5000000
      },
      {
        symbol: 'BTC-PERP', 
        price: 108900 + (Math.random() - 0.5) * 200, // ±$100 variation
        volume24h: 50000000,
        change24h: -1.2 + (Math.random() - 0.5) * 0.3,
        high24h: 110000,
        low24h: 107000,
        funding: -0.005,
        openInterest: 100000000
      },
      {
        symbol: 'ETH-PERP',
        price: 2615 + (Math.random() - 0.5) * 20, // ±$10 variation
        volume24h: 20000000,
        change24h: 1.8 + (Math.random() - 0.5) * 0.4,
        high24h: 2650,
        low24h: 2580,
        funding: 0.008,
        openInterest: 30000000
      }
    ];
    
    const message = JSON.stringify({
      type: 'price_update',
      data: markets,
      timestamp: new Date().toISOString()
    });
    
    connectedClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
    
    console.log(`📊 Price update sent to ${connectedClients.size} clients`);
  }, 5000); // Update every 5 seconds
}

// Handle transaction submission from frontend
app.post('/api/transaction/submit', async (req, res) => {
    try {
        const { signedTransaction } = req.body;
        
        if (!signedTransaction) {
            return res.status(400).json({
                success: false,
                error: 'Missing signed transaction data'
            });
        }
        
        try {
            // Convert base64 back to buffer
            const txBuffer = Buffer.from(signedTransaction, 'base64');
            
            // Initialize connection with retry
            console.log('🔗 Connecting to Solana mainnet via custom RPC...');
            
            const connection = await withRetry(async () => {
                console.log('🌐 Creating new Solana connection...');
                const conn = new Connection(CUSTOM_RPC_URL, 'confirmed');
                // Test the connection
                await conn.getBlockHeight();
                return conn;
            });
            
            // Send the raw transaction directly - no need for Drift client here
            console.log('📤 Sending raw transaction to Solana network...');
            const signature = await connection.sendRawTransaction(txBuffer, {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
                maxRetries: 3
            });
            
            console.log('✅ Transaction submitted, signature:', signature);
            
            // Wait for confirmation
            console.log('⏳ Waiting for transaction confirmation...');
            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash: null, // Let the RPC node determine the blockhash
                commitment: 'confirmed',
                maxRetries: 3
            });
            
            console.log('🎉 Transaction confirmed:', confirmation);
            
            return res.json({
                success: true,
                signature,
                confirmation: {
                    slot: confirmation.context.slot,
                    confirmations: null,
                    confirmationStatus: 'confirmed',
                    err: null
                }
            });
            
        } catch (error) {
            console.error('❌ Transaction submission error:', error);
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to submit transaction',
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
        
    } catch (error) {
        console.error('❌ Error in transaction submission handler:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add transaction status endpoint
app.get('/api/transaction/status', async (req, res) => {
    try {
        const { signature } = req.query;
        
        if (!signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing transaction signature parameter'
            });
        }
        
        // Initialize connection with retry
        const connection = await withRetry(async () => {
            console.log('🌐 Creating new Solana connection for status check...');
            const conn = new Connection(CUSTOM_RPC_URL, 'confirmed');
            // Test the connection
            await conn.getSlot();
            return conn;
        });
        
        // First try to get the signature status
        const status = await connection.getSignatureStatus(signature, {
            searchTransactionHistory: true
        });
        
        console.log(`📝 Status for ${signature}:`, status ? 'Found' : 'Not found');
        
        // If we have a status, return it
        if (status && status.value) {
            return res.json({
                success: true,
                signature,
                status: status.value
            });
        }
        
        // If not found, check if it was dropped from the mempool
        try {
            // This will throw if the transaction is not found in the mempool
            await connection.getSignatureStatus(signature);
        } catch (error) {
            if (error.message.includes('not found') || error.message.includes('unknown')) {
                return res.status(404).json({
                    success: false,
                    error: 'Transaction not found in mempool or confirmed blocks',
                    dropped: true
                });
            }
            throw error; // Re-throw other errors
        }
        
        // If we get here, the transaction is still in the mempool
        return res.json({
            success: true,
            signature,
            status: {
                confirmationStatus: 'pending',
                confirmations: null,
                slot: null,
                err: null
            }
        });
        
    } catch (error) {
        console.error('❌ Error checking transaction status:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to check transaction status',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ Working server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket ready on ws://localhost:${PORT}`);
  
  // Start price updates after server is ready
  startPriceUpdates();
});
