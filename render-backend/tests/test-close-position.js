#!/usr/bin/env node

/**
 * Test script to close positions for a real profile
 *
 * USAGE:
 * cd /Users/timk/projects/rekt-backend/render-backend
 * node test-close-position.js <profile-id> [position-id]
 *
 * EXAMPLES:
 * node test-close-position.js <profile_id>
 * node test-close-position.js <profile_id> b1068989-5351-47cc-bc3a-73beff92c185
 *
 * If no position-id is provided, it will close all open positions for the user
 */

const TradingService = require("../services/trading");

async function testClosePosition(profileId, specificPositionId = null) {
  console.log(`🔒 Testing Close Position for Profile: ${profileId}\n`);

  const tradingService = new TradingService();

  try {
    // Step 1: Get current open positions
    console.log("📋 Step 1: Fetching current open positions");
    const positions = await tradingService.getPositions(profileId);

    if (positions.length === 0) {
      console.log("✅ No open positions found - nothing to close");
      return;
    }

    console.log(`✅ Found ${positions.length} open position(s):`);
    positions.forEach((pos, index) => {
      console.log(
        `   ${index + 1}. ${pos.asset} ${pos.direction} - Size: $${pos.size}`
      );
      console.log(
        `      📊 Entry: $${pos.entryPrice} | Current: $${pos.currentPrice}`
      );
      console.log(`      💹 PnL: $${pos.pnl} (${pos.pnlPercentage}%)`);
      console.log(`      🆔 Position ID: ${pos.id}`);
    });

    // Step 2: Determine which positions to close
    let positionsToClose = [];

    if (specificPositionId) {
      // Close specific position
      const targetPosition = positions.find(p => p.id === specificPositionId);
      if (targetPosition) {
        positionsToClose = [targetPosition];
        console.log(
          `\n📋 Step 2: Closing specific position: ${specificPositionId}`
        );
      } else {
        console.log(
          `❌ Position ${specificPositionId} not found in open positions`
        );
        return;
      }
    } else {
      // Close all open positions
      positionsToClose = positions;
      console.log(
        `\n📋 Step 2: Closing all ${positions.length} open position(s)`
      );
    }

    // Step 3: Close each position
    console.log("\n📋 Step 3: Executing position closures");
    const closeResults = [];

    for (let i = 0; i < positionsToClose.length; i++) {
      const position = positionsToClose[i];
      console.log(`\n🔒 Closing position ${i + 1}/${positionsToClose.length}:`);
      console.log(`   🆔 Position ID: ${position.id}`);
      console.log(`   📈 Asset: ${position.asset}`);
      console.log(`   📊 Direction: ${position.direction}`);
      console.log(
        `   💰 Current PnL: $${position.pnl} (${position.pnlPercentage}%)`
      );

      try {
        const closeResult = await tradingService.closePosition(
          profileId,
          position.id
        );

        console.log(`   ✅ Position closed successfully:`);
        console.log(`      💵 Exit Price: $${closeResult.exitPrice}`);
        console.log(
          `      💹 Final PnL: $${closeResult.pnl} (${closeResult.pnlPercentage}%)`
        );
        console.log(`      ⏰ Closed At: ${closeResult.closedAt}`);

        closeResults.push({
          positionId: position.id,
          asset: position.asset,
          direction: position.direction,
          entryPrice: position.entryPrice,
          exitPrice: closeResult.exitPrice,
          pnl: closeResult.pnl,
          pnlPercentage: closeResult.pnlPercentage,
          success: true,
        });
      } catch (closeError) {
        console.error(`   ❌ Failed to close position: ${closeError.message}`);
        closeResults.push({
          positionId: position.id,
          asset: position.asset,
          success: false,
          error: closeError.message,
        });
      }
    }

    // Step 4: Summary
    console.log("\n📋 Step 4: Close Position Summary");
    const successful = closeResults.filter(r => r.success);
    const failed = closeResults.filter(r => !r.success);

    console.log(`✅ Successfully closed: ${successful.length} position(s)`);
    console.log(`❌ Failed to close: ${failed.length} position(s)`);

    if (successful.length > 0) {
      console.log("\n💹 Successful Closures:");
      successful.forEach((result, index) => {
        const profitLoss = result.pnl >= 0 ? "📈 PROFIT" : "📉 LOSS";
        console.log(
          `   ${index + 1}. ${result.asset} ${result.direction} - ${profitLoss}`
        );
        console.log(
          `      💰 Entry: $${result.entryPrice} → Exit: $${result.exitPrice}`
        );
        console.log(`      💹 PnL: $${result.pnl} (${result.pnlPercentage}%)`);
      });

      // Calculate total PnL
      const totalPnL = successful.reduce((sum, result) => sum + result.pnl, 0);
      const totalPnLPercentage =
        successful.length > 0
          ? successful.reduce((sum, result) => sum + result.pnlPercentage, 0) /
            successful.length
          : 0;

      console.log(
        `\n🎯 Total Session PnL: $${totalPnL.toFixed(
          2
        )} (${totalPnLPercentage.toFixed(2)}% avg)`
      );
    }

    if (failed.length > 0) {
      console.log("\n❌ Failed Closures:");
      failed.forEach((result, index) => {
        console.log(
          `   ${index + 1}. ${result.asset} - Error: ${result.error}`
        );
      });
    }

    // Step 5: Verify positions are closed
    console.log("\n📋 Step 5: Verifying positions are closed");
    const remainingPositions = await tradingService.getPositions(profileId);
    console.log(`✅ Remaining open positions: ${remainingPositions.length}`);

    if (remainingPositions.length === 0) {
      console.log("🎉 All positions successfully closed!");
    } else {
      console.log("⚠️  Some positions remain open:");
      remainingPositions.forEach((pos, index) => {
        console.log(
          `   ${index + 1}. ${pos.asset} ${pos.direction} - PnL: $${pos.pnl}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("📋 Error details:", error);
    process.exit(1);
  }
}

// Get arguments from command line
const profileId = process.argv[2];
const positionId = process.argv[3];

if (!profileId) {
  console.log("❌ Please provide a profile ID as an argument");
  console.log("Usage: node test-close-position.js <profile-id> [position-id]");
  console.log("Example: node test-close-position.js <profile_id>");
  process.exit(1);
}

// Run the test
testClosePosition(profileId, positionId);
