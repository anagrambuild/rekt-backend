// Production-Ready Shared Utilities - Phase B
// This file contains reusable utility functions to eliminate code duplication

const {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const { DriftClient, initialize, Wallet, BN } = require("@drift-labs/sdk");
const {
  SOLANA_MAINNET_RPC,
  DRIFT_CLUSTER,
  USDC_MINT_ADDRESS,
  DRIFT_PROGRAM_ID_ADDRESS,
  RPC_CONFIG,
  COMPUTE_UNITS,
} = require("./constants");

// RPC Rate limiting state
let lastRpcCall = 0;

/**
 * RPC Rate Limiting Utility
 * Prevents hitting rate limits on Solana RPC endpoints
 */
async function rpcRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastRpcCall;

  if (timeSinceLastCall < RPC_CONFIG.MIN_INTERVAL) {
    const waitTime = RPC_CONFIG.MIN_INTERVAL - timeSinceLastCall;
    console.log(`⏱️ Rate limiting: waiting ${waitTime}ms before next RPC call`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRpcCall = Date.now();
}

/**
 * Retry with Exponential Backoff Utility
 * Retries async operations with exponential backoff on failure
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Re-throw on final attempt
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(
        `⚠️ Attempt ${attempt} failed, retrying in ${delay}ms:`,
        error.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Connection Management Utility
 * Creates and manages Solana RPC connections with retry logic
 */
async function createConnection(retryCount = 0) {
  try {
    await rpcRateLimit();

    const connection = new Connection(SOLANA_MAINNET_RPC, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });

    // Test connection with timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout")), 30000)
    );

    await Promise.race([
      connection.getLatestBlockhash("confirmed"),
      timeoutPromise,
    ]);

    console.log("✅ Connection established successfully");
    return connection;
  } catch (error) {
    console.error(
      `❌ Connection failed (attempt ${retryCount + 1}):`,
      error.message
    );

    // Only retry up to 2 times, then fail
    if (retryCount < 2) {
      const delay = 2000; // Fixed 2 second delay
      console.log(`🔄 Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return createConnection(retryCount + 1);
    }

    throw new Error(`RPC connection failed: ${error.message}`);
  }
}

/**
 * DriftClient Factory
 * Creates configured DriftClient instances with proper cleanup and account loading
 */
async function createDriftClient(connection, walletAddress) {
  try {
    console.log("🔄 Initializing Drift client...");

    // Create read-only wallet for backend operations (matches server.js createReadOnlyWallet)
    const walletPubkey = new PublicKey(walletAddress);
    const wallet = {
      publicKey: walletPubkey,
      signTransaction: () => Promise.reject(new Error("Read-only client")),
      signAllTransactions: () => Promise.reject(new Error("Read-only client")),
    };

    // Import BulkAccountLoader from the SDK
    const { BulkAccountLoader } = require("@drift-labs/sdk");

    // Create BulkAccountLoader with optimized settings for margin calculations
    const bulkAccountLoader = new BulkAccountLoader(
      connection,
      "confirmed", // Use 'confirmed' commitment for balance between speed and reliability
      1000 // Poll every 1000ms for fresh data
    );

    console.log("📦 Setting up account subscription with BulkAccountLoader...");

    // Initialize Drift client with proper account subscription
    const driftClient = new DriftClient({
      connection,
      wallet,
      env: DRIFT_CLUSTER,
      accountSubscription: {
        type: "polling",
        accountLoader: bulkAccountLoader,
      },
    });

    console.log("🔔 Subscribing to Drift client...");
    await driftClient.subscribe();

    // Wait for initial account data to be loaded
    console.log("⏳ Waiting for account data to load...");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that market accounts are accessible
    try {
      const market = driftClient.getPerpMarketAccount(0);
      if (!market) {
        throw new Error("SOL-PERP market account not loaded");
      }
      console.log("✅ Market account verified and loaded");
    } catch (marketError) {
      console.warn(
        "⚠️ Market account verification failed:",
        marketError.message
      );
      // Continue anyway - the client might still work for some operations
    }

    console.log("✅ Drift client initialized successfully with account loader");

    return driftClient;
  } catch (error) {
    console.error("❌ Failed to initialize Drift client:", error.message);
    throw error;
  }
}

/**
 * DriftClient Cleanup Utility
 * Properly unsubscribes and cleans up DriftClient instances and account loaders
 */
async function cleanupDriftClient(driftClient) {
  try {
    if (driftClient) {
      // Clean up the Drift client first
      await driftClient.unsubscribe();

      // Clean up the account loader if it exists
      const accountSubscription = driftClient.accountSubscriber;
      if (accountSubscription && accountSubscription.accountLoader) {
        try {
          // Stop polling and clean up the BulkAccountLoader
          if (
            typeof accountSubscription.accountLoader.stopPolling === "function"
          ) {
            accountSubscription.accountLoader.stopPolling();
          }
          console.log("✅ Account loader cleaned up");
        } catch (loaderError) {
          console.warn(
            "⚠️ Account loader cleanup warning:",
            loaderError.message
          );
        }
      }

      console.log("✅ Drift client cleaned up successfully");
    }
  } catch (error) {
    console.error("⚠️ Error during Drift client cleanup:", error.message);
  }
}

/**
 * USDC Mint Utility
 * Returns the USDC mint PublicKey
 */
function getUSDCMint() {
  return new PublicKey(USDC_MINT_ADDRESS);
}

/**
 * Wallet Validation Utility
 * Validates Solana wallet addresses
 */
function validateWalletAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Error Response Utility
 * Standardized error response format
 */
function createErrorResponse(
  error,
  message = "An error occurred",
  statusCode = 500
) {
  console.error(`❌ ${message}:`, error.message);

  return {
    success: false,
    error: error.message,
    message,
    timestamp: new Date().toISOString(),
    statusCode,
  };
}

/**
 * Success Response Utility
 * Standardized success response format
 */
function createSuccessResponse(data, message = "Operation successful") {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Transaction Serialization Utility
 * Serializes instructions for frontend consumption
 */
function serializeInstructions(instructions, blockhash, feePayer) {
  return instructions.map((instruction) => {
    const message = new Transaction().add(instruction);
    message.recentBlockhash = blockhash;
    message.feePayer = feePayer;

    return {
      instruction: instruction.data
        ? instruction.data.toString("base64")
        : null,
      programId: instruction.programId.toString(),
      keys: instruction.keys.map((key) => ({
        pubkey: key.pubkey.toString(),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
    };
  });
}

/**
 * Compute Budget Utility
 * Creates compute budget instructions for different operation types
 */
function createComputeBudgetInstruction(operationType = "default") {
  const computeUnits =
    COMPUTE_UNITS[operationType.toUpperCase()] || COMPUTE_UNITS.DEFAULT;
  return ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits });
}

/**
 * Token Account Utility
 * Gets or finds user's USDC token account
 */
async function getUserUSDCTokenAccount(connection, walletAddress) {
  try {
    const usdcMint = getUSDCMint();
    const walletPubkey = new PublicKey(walletAddress);

    const tokenAccounts = await connection.getTokenAccountsByOwner(
      walletPubkey,
      { mint: usdcMint }
    );

    if (tokenAccounts.value.length === 0) {
      throw new Error("No USDC token account found");
    }

    return tokenAccounts.value[0].pubkey;
  } catch (error) {
    console.error("❌ Failed to get USDC token account:", error.message);
    throw error;
  }
}

/**
 * Async Error Handler Utility
 * Wraps async route handlers with standardized error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  // Connection Management
  rpcRateLimit,
  retryWithBackoff,
  createConnection,
  createDriftClient,
  cleanupDriftClient,

  // Utilities
  getUSDCMint,
  validateWalletAddress,
  getUserUSDCTokenAccount,

  // Response Utilities
  createErrorResponse,
  createSuccessResponse,

  // Transaction Utilities
  serializeInstructions,
  createComputeBudgetInstruction,

  // Middleware
  asyncHandler,
};
