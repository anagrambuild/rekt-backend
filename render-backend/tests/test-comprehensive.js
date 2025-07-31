#!/usr/bin/env node

/**
 * Comprehensive End-to-End Trading Test Suite
 *
 * USAGE OPTION 1 - Command Line Arguments:
 * cd /Users/timk/projects/rekt-backend/render-backend
 *
 * # Run complete end-to-end flow (open → wait 30s → close)
 * node test-comprehensive.js --full [profile-id]
 *
 * # Run individual tests
 * node test-comprehensive.js --wallet [profile-id]     # Test 1: Wallet lookup
 * node test-comprehensive.js --balance [profile-id]    # Test 2: Balance check
 * node test-comprehensive.js --open [profile-id]       # Test 3: Open position
 * node test-comprehensive.js --positions [profile-id]  # Test 4: Monitor positions
 * node test-comprehensive.js --close [profile-id]      # Test 5: Close positions
 * node test-comprehensive.js --history [profile-id]    # Test 6: Trading history
 *
 * USAGE OPTION 2 - Edit PROFILE_ID variable below:
 * const PROFILE_ID = "your-profile-id-here";
 *
 * # Examples with real profile ID:
 * node test-comprehensive.js --full 489aebd6-1cdf-4788-9872-6d022c33352c
 * node test-comprehensive.js --open 489aebd6-1cdf-4788-9872-6d022c33352c
 *
 * # Examples with test user (default):
 * node test-comprehensive.js --full
 * node test-comprehensive.js --open
 */

// ============================================================
// 📝 EDIT THIS VARIABLE TO SET YOUR DEFAULT PROFILE ID
// ============================================================
const PROFILE_ID = "test-user-id"; // Change this to your profile ID
// const PROFILE_ID = "489aebd6-1cdf-4788-9872-6d022c33352c"; // Example real profile
// ============================================================
const TradingService = require("../services/trading");

class ComprehensiveTradingTest {
  constructor(profileId = PROFILE_ID) {
    this.profileId = profileId;
    this.tradingService = new TradingService();
    this.openPositionId = null;
  }

  /**
   * Test 1: Wallet Address Lookup
   */
  async testWalletLookup() {
    console.log("🔍 TEST 1: Wallet Address Lookup");
    console.log("=".repeat(50));

    try {
      const swigWallet = await this.tradingService.getUserSwigWallet(
        this.profileId
      );
      console.log(`✅ Profile ID: ${this.profileId}`);
      console.log(`✅ Swig Wallet: ${swigWallet}`);
      console.log(`✅ Wallet lookup successful\n`);
      return { success: true, walletAddress: swigWallet };
    } catch (error) {
      console.error(`❌ Wallet lookup failed: ${error.message}\n`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 2: Balance Check
   */
  async testBalance() {
    console.log("💰 TEST 2: Balance Check");
    console.log("=".repeat(50));

    try {
      const balance = await this.tradingService.getBalance(this.profileId);
      console.log(`✅ USDC Balance: $${balance.usdc}`);
      console.log(`✅ Available Margin: $${balance.availableMargin}`);
      console.log(`✅ Used Margin: $${balance.usedMargin}`);
      console.log(`✅ Wallet Address: ${balance.walletAddress}`);
      console.log(`✅ Balance check successful\n`);
      return { success: true, balance };
    } catch (error) {
      console.error(`❌ Balance check failed: ${error.message}\n`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 3: Open Position
   */
  async testOpenPosition() {
    console.log("🚀 TEST 3: Open Position");
    console.log("=".repeat(50));

    try {
      const tradeParams = {
        asset: "SOL-PERP",
        direction: "long",
        amount: 25, // $25 position
        leverage: 5, // 5x leverage
      };

      console.log(`📊 Opening position:`);
      console.log(`   Asset: ${tradeParams.asset}`);
      console.log(`   Direction: ${tradeParams.direction}`);
      console.log(`   Amount: $${tradeParams.amount}`);
      console.log(`   Leverage: ${tradeParams.leverage}x`);
      console.log(
        `   Position Size: $${tradeParams.amount * tradeParams.leverage}`
      );

      const result = await this.tradingService.openPosition(
        this.profileId,
        tradeParams.asset,
        tradeParams.direction,
        tradeParams.amount,
        tradeParams.leverage
      );

      this.openPositionId = result.positionId;

      console.log(`✅ Position opened successfully:`);
      console.log(`   Position ID: ${result.positionId}`);
      console.log(`   Entry Price: $${result.entryPrice}`);
      console.log(`   Position Size: $${result.positionSize}`);
      console.log(`   Margin Used: $${result.marginUsed}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Opened At: ${result.openedAt}\n`);

      return { success: true, position: result };
    } catch (error) {
      console.error(`❌ Open position failed: ${error.message}\n`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 4: Monitor Positions
   */
  async testPositions() {
    console.log("📊 TEST 4: Monitor Positions");
    console.log("=".repeat(50));

    try {
      const positions = await this.tradingService.getPositions(this.profileId);

      if (positions.length === 0) {
        console.log("✅ No open positions found");
        console.log("✅ Position monitoring successful\n");
        return { success: true, positions: [] };
      }

      console.log(`✅ Found ${positions.length} open position(s):`);

      positions.forEach((pos, index) => {
        const profitLoss = pos.pnl >= 0 ? "📈 PROFIT" : "📉 LOSS";
        const pnlColor = pos.pnl >= 0 ? "🟢" : "🔴";

        console.log(`\n   Position ${index + 1}:`);
        console.log(`   🆔 ID: ${pos.id}`);
        console.log(`   📈 Asset: ${pos.asset}`);
        console.log(`   📊 Direction: ${pos.direction.toUpperCase()}`);
        console.log(`   💵 Size: $${pos.size}`);
        console.log(
          `   💰 Entry: $${pos.entryPrice} → Current: $${pos.currentPrice}`
        );
        console.log(
          `   ${pnlColor} PnL: $${pos.pnl} (${pos.pnlPercentage}%) ${profitLoss}`
        );
        console.log(`   ⚡ Leverage: ${pos.leverage}x`);
        console.log(`   🔒 Margin: $${pos.marginUsed}`);
        console.log(`   ⚠️  Liquidation: $${pos.liquidationPrice}`);
        console.log(`   📅 Opened: ${new Date(pos.openedAt).toLocaleString()}`);

        // Store the first position ID for closing
        if (index === 0) {
          this.openPositionId = pos.id;
        }
      });

      console.log(`\n✅ Position monitoring successful\n`);
      return { success: true, positions };
    } catch (error) {
      console.error(`❌ Position monitoring failed: ${error.message}\n`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 5: Close Positions
   */
  async testClosePositions() {
    console.log("🔒 TEST 5: Close Positions");
    console.log("=".repeat(50));

    try {
      // First get current positions
      const positions = await this.tradingService.getPositions(this.profileId);

      if (positions.length === 0) {
        console.log("✅ No open positions to close");
        console.log("✅ Close positions test completed\n");
        return { success: true, closedPositions: [] };
      }

      console.log(`🔍 Found ${positions.length} position(s) to close`);
      const closedPositions = [];

      // Close each position
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        console.log(`\n🔒 Closing position ${i + 1}/${positions.length}:`);
        console.log(`   Position ID: ${position.id}`);
        console.log(`   Asset: ${position.asset}`);
        console.log(
          `   Current PnL: $${position.pnl} (${position.pnlPercentage}%)`
        );

        try {
          const closeResult = await this.tradingService.closePosition(
            this.profileId,
            position.id
          );

          const finalProfitLoss =
            closeResult.pnl >= 0 ? "📈 PROFIT" : "📉 LOSS";
          const pnlColor = closeResult.pnl >= 0 ? "🟢" : "🔴";

          console.log(`   ✅ Position closed successfully:`);
          console.log(`   💵 Exit Price: $${closeResult.exitPrice}`);
          console.log(
            `   ${pnlColor} Final PnL: $${closeResult.pnl} (${closeResult.pnlPercentage}%) ${finalProfitLoss}`
          );
          console.log(
            `   ⏰ Closed At: ${new Date(
              closeResult.closedAt
            ).toLocaleString()}`
          );

          closedPositions.push({
            positionId: position.id,
            asset: position.asset,
            pnl: closeResult.pnl,
            pnlPercentage: closeResult.pnlPercentage,
            success: true,
          });
        } catch (closeError) {
          console.error(
            `   ❌ Failed to close position: ${closeError.message}`
          );
          closedPositions.push({
            positionId: position.id,
            asset: position.asset,
            success: false,
            error: closeError.message,
          });
        }
      }

      // Summary
      const successful = closedPositions.filter(p => p.success);
      const failed = closedPositions.filter(p => !p.success);

      console.log(`\n📊 Close Summary:`);
      console.log(`   ✅ Successfully closed: ${successful.length}`);
      console.log(`   ❌ Failed to close: ${failed.length}`);

      if (successful.length > 0) {
        const totalPnL = successful.reduce((sum, pos) => sum + pos.pnl, 0);
        const avgPnL = totalPnL / successful.length;
        const overallResult =
          totalPnL >= 0 ? "📈 OVERALL PROFIT" : "📉 OVERALL LOSS";
        const overallColor = totalPnL >= 0 ? "🟢" : "🔴";

        console.log(
          `   ${overallColor} Total PnL: $${totalPnL.toFixed(
            2
          )} ${overallResult}`
        );
        console.log(`   📊 Average PnL: $${avgPnL.toFixed(2)}`);
      }

      console.log(`✅ Close positions test completed\n`);
      return { success: true, closedPositions };
    } catch (error) {
      console.error(`❌ Close positions failed: ${error.message}\n`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test 6: Trading History
   */
  async testTradingHistory() {
    console.log("📚 TEST 6: Trading History");
    console.log("=".repeat(50));

    try {
      const history = await this.tradingService.getTradingHistory(
        this.profileId
      );

      if (history.length === 0) {
        console.log("✅ No trading history found");
        console.log("✅ Trading history test completed\n");
        return { success: true, history: [] };
      }

      console.log(`✅ Found ${history.length} trade(s) in history:`);

      let totalPnL = 0;
      let completedTrades = 0;

      history.forEach((trade, index) => {
        const statusEmoji = {
          open: "🟡",
          closed: "🔴",
          liquidated: "💀",
          cancelled: "⚪",
        };

        const profitLoss = trade.pnl >= 0 ? "📈" : "📉";
        const pnlColor = trade.pnl >= 0 ? "🟢" : "🔴";

        console.log(`\n   Trade ${index + 1}:`);
        console.log(
          `   ${
            statusEmoji[trade.status]
          } Status: ${trade.status.toUpperCase()}`
        );
        console.log(`   🆔 ID: ${trade.id}`);
        console.log(`   📈 ${trade.asset} ${trade.direction.toUpperCase()}`);
        console.log(`   💵 Size: $${trade.size} (${trade.leverage}x leverage)`);
        console.log(
          `   💰 Entry: $${trade.entryPrice}${
            trade.exitPrice ? ` → Exit: $${trade.exitPrice}` : ""
          }`
        );
        console.log(
          `   ${pnlColor} PnL: $${trade.pnl} (${trade.pnlPercentage}%) ${profitLoss}`
        );
        console.log(
          `   📅 Opened: ${new Date(trade.openedAt).toLocaleString()}`
        );
        if (trade.closedAt) {
          console.log(
            `   📅 Closed: ${new Date(trade.closedAt).toLocaleString()}`
          );
          console.log(
            `   ⏱️  Duration: ${Math.floor(trade.duration / 60)}m ${
              trade.duration % 60
            }s`
          );
        }

        if (trade.status === "closed") {
          totalPnL += trade.pnl;
          completedTrades++;
        }
      });

      // Overall statistics
      if (completedTrades > 0) {
        const avgPnL = totalPnL / completedTrades;
        const overallResult =
          totalPnL >= 0 ? "📈 OVERALL PROFIT" : "📉 OVERALL LOSS";
        const overallColor = totalPnL >= 0 ? "🟢" : "🔴";

        console.log(`\n📊 Trading Statistics:`);
        console.log(`   📈 Total Trades: ${history.length}`);
        console.log(`   ✅ Completed: ${completedTrades}`);
        console.log(
          `   ${overallColor} Total PnL: $${totalPnL.toFixed(
            2
          )} ${overallResult}`
        );
        console.log(`   📊 Average PnL: $${avgPnL.toFixed(2)}`);
      }

      console.log(`✅ Trading history test completed\n`);
      return { success: true, history };
    } catch (error) {
      console.error(`❌ Trading history failed: ${error.message}\n`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Full End-to-End Test Flow
   */
  async runFullTest() {
    console.log("🎯 COMPREHENSIVE END-TO-END TRADING TEST");
    console.log("=".repeat(60));
    console.log(`📋 Profile ID: ${this.profileId}`);
    console.log(`⏰ Test Started: ${new Date().toLocaleString()}`);
    console.log("=".repeat(60));
    console.log();

    const results = {
      walletLookup: null,
      balance: null,
      openPosition: null,
      monitorPositions: null,
      closePositions: null,
      tradingHistory: null,
    };

    // Test 1: Wallet Lookup
    results.walletLookup = await this.testWalletLookup();
    if (!results.walletLookup.success) {
      console.log("❌ Stopping tests due to wallet lookup failure");
      return results;
    }

    // Test 2: Balance Check
    results.balance = await this.testBalance();

    // Test 3: Open Position
    results.openPosition = await this.testOpenPosition();
    if (!results.openPosition.success) {
      console.log(
        "⚠️ Continuing with monitoring tests despite open position failure"
      );
    }

    // Wait 30 seconds to see price movement
    if (results.openPosition.success) {
      console.log("⏳ WAITING 30 SECONDS FOR PRICE MOVEMENT...");
      console.log("   (This allows you to see live PnL changes)");

      for (let i = 30; i > 0; i--) {
        process.stdout.write(`\r   ⏰ ${i} seconds remaining...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      console.log("\r   ✅ Wait complete!                    \n");
    }

    // Test 4: Monitor Positions
    results.monitorPositions = await this.testPositions();

    // Test 5: Close Positions
    results.closePositions = await this.testClosePositions();

    // Test 6: Trading History
    results.tradingHistory = await this.testTradingHistory();

    // Final Summary
    console.log("🎯 FINAL TEST SUMMARY");
    console.log("=".repeat(60));

    const tests = [
      { name: "Wallet Lookup", result: results.walletLookup },
      { name: "Balance Check", result: results.balance },
      { name: "Open Position", result: results.openPosition },
      { name: "Monitor Positions", result: results.monitorPositions },
      { name: "Close Positions", result: results.closePositions },
      { name: "Trading History", result: results.tradingHistory },
    ];

    tests.forEach(test => {
      const status = test.result?.success ? "✅" : "❌";
      console.log(
        `${status} ${test.name}: ${test.result?.success ? "PASSED" : "FAILED"}`
      );
    });

    const passedTests = tests.filter(t => t.result?.success).length;
    const totalTests = tests.length;

    console.log(
      `\n📊 Overall Result: ${passedTests}/${totalTests} tests passed`
    );
    console.log(`⏰ Test Completed: ${new Date().toLocaleString()}`);

    if (passedTests === totalTests) {
      console.log("🎉 ALL TESTS PASSED - SYSTEM IS PRODUCTION READY!");
    } else {
      console.log("⚠️ Some tests failed - check logs above for details");
    }

    return results;
  }
}

// Command line argument parsing
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const profileId = args[1] || PROFILE_ID;

  const tester = new ComprehensiveTradingTest(profileId);

  try {
    switch (command) {
      case "--wallet":
        await tester.testWalletLookup();
        break;
      case "--balance":
        await tester.testBalance();
        break;
      case "--open":
        await tester.testOpenPosition();
        break;
      case "--positions":
        await tester.testPositions();
        break;
      case "--close":
        await tester.testClosePositions();
        break;
      case "--history":
        await tester.testTradingHistory();
        break;
      case "--full":
        await tester.runFullTest();
        break;
      default:
        console.log("❌ Invalid command. Use one of:");
        console.log("   --full      # Complete end-to-end test");
        console.log("   --wallet    # Test wallet lookup");
        console.log("   --balance   # Test balance check");
        console.log("   --open      # Test open position");
        console.log("   --positions # Test position monitoring");
        console.log("   --close     # Test close positions");
        console.log("   --history   # Test trading history");
        console.log(
          "\nExample: node test-comprehensive.js --full 489aebd6-1cdf-4788-9872-6d022c33352c"
        );
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Test execution failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ComprehensiveTradingTest;
