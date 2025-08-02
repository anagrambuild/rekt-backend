// Production-Ready Shared Utilities - Phase B
// This file contains reusable utility functions to eliminate code duplication

const {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const {
  DriftClient,
  initialize,
  Wallet,
  BN,
  PRICE_PRECISION,
} = require("@drift-labs/sdk");
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
    await new Promise(resolve => setTimeout(resolve, waitTime));
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
      await new Promise(resolve => setTimeout(resolve, delay));
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
      await new Promise(resolve => setTimeout(resolve, delay));
      return createConnection(retryCount + 1);
    }

    throw error;
  }
}

/**
 * Drift Client Creation Utility
 * Creates and initializes Drift client with proper error handling
 */
async function createDriftClient(connection, walletAddress) {
  try {
    await rpcRateLimit();

    console.log("🔄 Initializing Drift client...");

    // Initialize Drift SDK
    await initialize({ env: DRIFT_CLUSTER });

    // Create wallet instance - for swig wallets, we'll use the address as signer
    const wallet = new Wallet({
      publicKey: new PublicKey(walletAddress),
      signTransaction: async transaction => {
        // In production, this would delegate to the swig wallet for signing
        console.log(
          `🔐 Transaction signing requested for swig wallet: ${walletAddress}`
        );
        console.log(`📋 Transaction would be sent to swig wallet for signing`);
        // For now, return the transaction unsigned (swig wallet will handle signing)
        return transaction;
      },
      signAllTransactions: async transactions => {
        console.log(
          `🔐 Batch transaction signing requested for swig wallet: ${walletAddress}`
        );
        console.log(
          `📋 ${transactions.length} transactions would be sent to swig wallet for signing`
        );
        return transactions;
      },
    });

    // Create Drift client
    const driftClient = new DriftClient({
      connection,
      wallet,
      programID: new PublicKey(DRIFT_PROGRAM_ID_ADDRESS),
      opts: {
        commitment: "confirmed",
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    });

    // Subscribe to account updates
    console.log("📦 Setting up account subscription with BulkAccountLoader...");
    await driftClient.subscribe();

    console.log("🔔 Subscribing to Drift client...");
    await driftClient.subscribe();

    // Wait for accounts to load
    console.log("⏳ Waiting for account data to load...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify market account is loaded
    const marketAccount = driftClient.getPerpMarketAccount(0);
    if (!marketAccount) {
      throw new Error("Market account not loaded");
    }

    console.log("✅ Market account verified and loaded");
    console.log("✅ Drift client initialized successfully with account loader");

    return driftClient;
  } catch (error) {
    console.error("❌ Drift client creation failed:", error.message);
    throw error;
  }
}

/**
 * Drift Client Cleanup Utility
 * Properly cleans up Drift client resources
 */
async function cleanupDriftClient(driftClient) {
  if (!driftClient) return;

  try {
    console.log("🧹 Cleaning up Drift client...");
    await driftClient.unsubscribe();
    console.log("✅ Drift client cleanup complete");
  } catch (error) {
    console.warn("⚠️ Error during Drift client cleanup:", error.message);
  }
}

/**
 * USDC Mint Utility
 * Returns the USDC mint address
 */
function getUSDCMint() {
  return new PublicKey(USDC_MINT_ADDRESS);
}

/**
 * Wallet Address Validation Utility
 * Validates Solana wallet addresses
 */
function validateWalletAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Error Response Creator Utility
 * Creates standardized error responses
 */
function createErrorResponse(
  error,
  message = "An error occurred",
  statusCode = 500
) {
  return {
    success: false,
    error: error.message || "Unknown error",
    message: message,
    statusCode: statusCode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Success Response Creator Utility
 * Creates standardized success responses
 */
function createSuccessResponse(data, message = "Operation successful") {
  return {
    success: true,
    data: data,
    message: message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Async Handler Utility
 * Wraps async route handlers with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  rpcRateLimit,
  retryWithBackoff,
  createConnection,
  createDriftClient,
  cleanupDriftClient,
  getUSDCMint,
  validateWalletAddress,
  createErrorResponse,
  createSuccessResponse,
  asyncHandler,
  PRICE_PRECISION,
};
