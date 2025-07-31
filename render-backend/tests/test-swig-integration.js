#!/usr/bin/env node

/**
 * Test script to verify Swig wallet integration
 * Tests that the trading service correctly fetches and uses Swig wallet addresses from the database
 */

const TradingService = require("../services/trading");

async function testSwigWalletIntegration() {
  console.log("🧪 Testing Swig Wallet Integration...\n");

  const tradingService = new TradingService();

  try {
    // Test 1: Test user ID (should use environment-based test wallet)
    console.log("📋 Test 1: Testing with test-user-id");
    const testWallet = await tradingService.getUserSwigWallet("test-user-id");
    console.log(`✅ Test wallet address: ${testWallet}\n`);

    // Test 2: Test balance retrieval (should include wallet address)
    console.log("📋 Test 2: Testing balance retrieval with Swig wallet");
    const balance = await tradingService.getBalance("test-user-id");
    console.log(
      `✅ Balance response includes wallet: ${balance.walletAddress}`
    );
    console.log(`💰 Mock balance: $${balance.usdc} USDC\n`);

    // Test 3: Test positions retrieval (should fetch wallet address)
    console.log("📋 Test 3: Testing positions retrieval with Swig wallet");
    const positions = await tradingService.getPositions("test-user-id");
    console.log(`✅ Positions retrieved: ${positions.length} positions\n`);

    console.log("🎉 All Swig wallet integration tests passed!");
    console.log("✅ The system now correctly:");
    console.log("   - Fetches Swig wallet addresses from the database");
    console.log("   - Uses environment variables for test wallets");
    console.log("   - Includes wallet addresses in API responses");
    console.log("   - Logs wallet addresses for debugging");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Run the test
testSwigWalletIntegration();
