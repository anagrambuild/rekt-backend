#!/usr/bin/env node

/**
 * Test script to verify real profile Swig wallet integration
 * Tests actual database lookup and trading operations with real user data
 *
 * USAGE:
 * cd /Users/timk/projects/rekt-backend/render-backend
 * node test-real-profile.js <profile-id>
 *
 * EXAMPLE:
 * node test-real-profile.js 489aebd6-1cdf-4788-9872-6d022c33352c
 */

const TradingService = require("../services/trading");

async function testRealProfile(profileId) {
  console.log(`🧪 Testing Real Profile Integration with ID: ${profileId}\n`);

  const tradingService = new TradingService();

  try {
    // Test 1: Fetch real Swig wallet address from database
    console.log("📋 Test 1: Fetching Swig wallet address from database");
    const swigWallet = await tradingService.getUserSwigWallet(profileId);
    console.log(`✅ Real Swig wallet address: ${swigWallet}\n`);

    // Test 2: Get balance with real wallet address
    console.log("📋 Test 2: Getting balance with real Swig wallet");
    const balance = await tradingService.getBalance(profileId);
    console.log(`✅ Balance for wallet ${balance.walletAddress}:`);
    console.log(`   💰 USDC: $${balance.usdc}`);
    console.log(`   📊 Available Margin: $${balance.availableMargin}`);
    console.log(`   🔒 Used Margin: $${balance.usedMargin}\n`);

    // Test 3: Attempt to open a position (this will use the real Swig wallet)
    console.log("📋 Test 3: Opening position with real Swig wallet");
    console.log("   📝 Trade Details: Long SOL-PERP, $50, 10x leverage");

    const tradeResult = await tradingService.openPosition(
      profileId,
      "SOL-PERP",
      "long",
      50, // $50 position
      10 // 10x leverage
    );

    console.log(`✅ Position opened successfully:`);
    console.log(`   🆔 Position ID: ${tradeResult.positionId}`);
    console.log(`   📈 Asset: ${tradeResult.asset}`);
    console.log(`   📊 Direction: ${tradeResult.direction}`);
    console.log(`   💵 Amount: $${tradeResult.amount}`);
    console.log(`   ⚡ Leverage: ${tradeResult.leverage}x`);
    console.log(`   💰 Entry Price: $${tradeResult.entryPrice}`);
    console.log(`   📏 Position Size: $${tradeResult.positionSize}`);
    console.log(`   🔒 Margin Used: $${tradeResult.marginUsed}\n`);

    // Test 4: Get positions (should show the position we just opened)
    console.log("📋 Test 4: Fetching positions with real Swig wallet");
    const positions = await tradingService.getPositions(profileId);
    console.log(`✅ Found ${positions.length} positions for this user\n`);

    if (positions.length > 0) {
      console.log("📊 Position Details:");
      positions.forEach((pos, index) => {
        console.log(`   Position ${index + 1}:`);
        console.log(`     🆔 ID: ${pos.id}`);
        console.log(`     📈 Asset: ${pos.asset}`);
        console.log(`     📊 Direction: ${pos.direction}`);
        console.log(`     💵 Size: $${pos.size}`);
        console.log(`     💰 Entry: $${pos.entryPrice}`);
        console.log(`     📈 Current: $${pos.currentPrice}`);
        console.log(`     💹 PnL: $${pos.pnl} (${pos.pnlPercentage}%)`);
        console.log(`     ⚡ Leverage: ${pos.leverage}x`);
        console.log(`     🔒 Margin: $${pos.marginUsed}`);
      });
    }

    console.log("\n🎉 All real profile tests completed successfully!");
    console.log("✅ Verified:");
    console.log("   - Real Swig wallet address fetched from database");
    console.log("   - Balance API uses real wallet address");
    console.log("   - Trade placement uses real Swig wallet");
    console.log("   - Position tracking works with real user data");
    console.log("   - Database integration is working correctly");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("📋 Error details:", error);

    // Provide helpful debugging info
    if (error.message.includes("User not found")) {
      console.log("\n💡 Debugging tips:");
      console.log("   - Check if the profile ID exists in the database");
      console.log("   - Verify the profiles table has the correct user");
    } else if (error.message.includes("does not have a valid Swig wallet")) {
      console.log("\n💡 Debugging tips:");
      console.log("   - Check if swig_wallet_address field is populated");
      console.log("   - Ensure it's not a placeholder or temp value");
    } else if (error.message.includes("fetch failed")) {
      console.log("\n💡 Debugging tips:");
      console.log("   - Check Supabase connection and credentials");
      console.log("   - Verify network connectivity");
    }

    process.exit(1);
  }
}

// Get profile ID from command line argument
const profileId = process.argv[2];

if (!profileId) {
  console.log("❌ Please provide a profile ID as an argument");
  console.log("Usage: node test-real-profile.js <profile-id>");
  console.log(
    "Example: node test-real-profile.js 123e4567-e89b-12d3-a456-426614174000"
  );
  process.exit(1);
}

// Run the test
testRealProfile(profileId);
