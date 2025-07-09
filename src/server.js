const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { DriftClient, Wallet, initialize, BN, PRICE_PRECISION, OrderType, PositionDirection } = require('@drift-labs/sdk');
const fetch = require('node-fetch');

// Solana RPC configuration - Using user's RPC endpoint
const CUSTOM_RPC_URL = 'https://austbot-austbot-234b.mainnet.rpcpool.com/a30e04d0-d9d6-4ac1-8503-38217fdb2821';

// Backup Syndica RPC for balance fetching
const SYNDICA_API_KEY = '2reYYXMi3PzC2KoDi2Vf4xSzSB57tWDki9orZosWeR4zdj7rc5Ht9FgbVT5YYJUWNugzjD6faFRnVxkppRXbPKz9YHn3wgkoRx';
const SYNDICA_RPC_URL = `https://solana-mainnet.api.syndica.io/api-key/${SYNDICA_API_KEY}`;

// RPC Rate limiting
let lastRpcCall = 0;
const RPC_MIN_INTERVAL = 250;

const rpcRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastRpcCall;
  if (timeSinceLastCall < RPC_MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, RPC_MIN_INTERVAL - timeSinceLastCall));
  }
  lastRpcCall = Date.now();
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

// Wallet endpoints
app.get('/api/wallet/:address/usdc-balance', async (req, res) => {
  try {
    const { address } = req.params;
    console.log(`💰 Fetching real USDC balance for wallet: ${address}`);
    
    // Apply rate limiting before RPC call
    await rpcRateLimit();
    
    // USDC mint address on Solana mainnet
    const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    
    // Use Syndica RPC for reliable balance fetching
    const connection = new Connection(SYNDICA_RPC_URL, 'confirmed');
    const walletPublicKey = new PublicKey(address);
    
    console.log('🔍 Searching for USDC token accounts...');
    
    // Get all token accounts for this wallet
    const tokenAccounts = await connection.getTokenAccountsByOwner(walletPublicKey, {
      mint: USDC_MINT
    });
    
    let usdcBalance = 0;
    
    if (tokenAccounts.value.length > 0) {
      // Get the balance from the first (and usually only) USDC account
      const accountInfo = await connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
      const rawBalance = accountInfo.value.amount;
      const decimals = accountInfo.value.decimals;
      
      // Convert from raw amount to human readable (USDC has 6 decimals)
      usdcBalance = parseFloat(rawBalance) / Math.pow(10, decimals);
      
      console.log(`✅ Found USDC balance: $${usdcBalance.toFixed(2)}`);
    } else {
      console.log('⚠️ No USDC token accounts found for this wallet');
      usdcBalance = 0;
    }
    
    res.json({
      success: true,
      balance: usdcBalance,
      walletAddress: address,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch USDC balance',
      message: error.message
    });
  }
});

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
        
        // Create transaction with compute budget
        const { ComputeBudgetProgram } = require('@solana/web3.js');
        const transaction = new Transaction();

        // Add compute budget instruction for higher CU limit
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 500000 }),
          orderIx
        );
        
        // Get recent blockhash and set fee payer
        console.log('🔗 Getting latest blockhash...');
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new PublicKey(walletAddress);
        
        // Simulate transaction to catch errors early
        console.log('🔬 Simulating transaction...');
        const simResult = await connection.simulateTransaction(transaction, { sigVerify: false });
        if (simResult.value.err) {
          console.error('❌ Simulation error:', simResult.value.err);
          if (simResult.value.logs) {
            console.error('📝 Simulation logs:\n', simResult.value.logs.join('\n'));
          }
          const simError = new Error(`Simulation error: ${JSON.stringify(simResult.value.err)}`);
          simError.simulationLogs = simResult.value.logs || [];
          throw simError;
        }
        console.log('✅ Simulation succeeded');
        
        // Serialize transaction for frontend signing
        console.log('📦 Serializing transaction for frontend...');
        const serializedTransaction = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false
        });
        
        const base64Transaction = serializedTransaction.toString('base64');
        console.log(`📤 Transaction serialized: ${base64Transaction.length} bytes`);
        
        res.json({
          success: true,
          transaction: base64Transaction,
          orderParams: {
            marketIndex: orderParams.marketIndex,
            direction: direction,
            baseAssetAmount: finalBaseAssetAmount.toString(),
            leverage: leverage,
            solPrice: solPrice,
            solQuantity: solQuantity
          },
          message: `${direction.toUpperCase()} order ready for ${marketSymbol} (${solQuantity.toFixed(4)} SOL @ $${solPrice.toFixed(2)})`
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

// Start server
server.listen(PORT, () => {
  console.log(`✅ Working server running on http://localhost:${PORT}`);
  console.log(`⚡ WebSocket ready on ws://localhost:${PORT}`);
  
  // Start price updates after server is ready
  startPriceUpdates();
});
