#!/usr/bin/env node

// Comprehensive MVP test script
const fetch = require("node-fetch");
const WebSocket = require("ws");

const BASE_URL = "http://localhost:3005";

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ ${name}: SUCCESS`);
    console.log(
      `📊 Response:`,
      JSON.stringify(data, null, 2).substring(0, 200) + "..."
    );
    return data;
  } catch (error) {
    console.log(`❌ ${name}: FAILED`);
    console.log(`🔍 Error:`, error.message);
    return null;
  }
}

async function testWebSocket() {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing WebSocket connection...`);

    const ws = new WebSocket(
      `ws://localhost:3005/ws?userId=8be41bcf-97b7-432c-964b-08cac2d6e599`
    );
    let connected = false;

    const timeout = setTimeout(() => {
      if (!connected) {
        console.log(`❌ WebSocket: TIMEOUT`);
        ws.close();
        resolve(false);
      }
    }, 5000);

    ws.on("open", () => {
      connected = true;
      clearTimeout(timeout);
      console.log(`✅ WebSocket: CONNECTED`);

      // Send test message
      ws.send(JSON.stringify({ type: "subscribe_prices" }));

      setTimeout(() => {
        ws.close();
        console.log(`🔌 WebSocket: CLOSED`);
        resolve(true);
      }, 2000);
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📨 WebSocket message: ${message.type}`);
    });

    ws.on("error", (error) => {
      console.log(`❌ WebSocket: ERROR - ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

async function runComprehensiveTests() {
  console.log("🚀 REKT Backend Comprehensive Test Suite\n");
  console.log("=".repeat(50));

  const results = {
    health: false,
    balance: false,
    openPosition: false,
    getPositions: false,
    closePosition: false,
    websocket: false,
  };

  // Use real UUID for testing
  const testUserId = "8be41bcf-97b7-432c-964b-08cac2d6e599"; // testuser999

  // Test 1: Health Check
  const healthData = await testEndpoint("Health Check", `${BASE_URL}/health`);
  results.health = !!healthData;

  // Test 2: Trading Balance
  const balanceData = await testEndpoint(
    "Trading Balance",
    `${BASE_URL}/api/trading/balance/${testUserId}`
  );
  results.balance = !!balanceData;

  // Test 3: Open Position
  const openData = await testEndpoint(
    "Open Position",
    `${BASE_URL}/api/trading/open`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: testUserId,
        asset: "SOL-PERP",
        direction: "long",
        amount: 100,
        leverage: 5,
      }),
    }
  );
  results.openPosition = !!openData;
  let positionId = openData?.data?.positionId;

  // Test 4: Get Positions
  const positionsData = await testEndpoint(
    "Get Positions",
    `${BASE_URL}/api/trading/positions/${testUserId}`
  );
  results.getPositions = !!positionsData;

  // If we didn't get a position ID from opening, try to get one from positions
  if (!positionId && positionsData?.data?.length > 0) {
    positionId = positionsData.data[0].id;
  }

  // Test 5: Close Position (if we have a position ID)
  if (positionId) {
    const closeData = await testEndpoint(
      "Close Position",
      `${BASE_URL}/api/trading/close`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: testUserId,
          positionId: positionId,
        }),
      }
    );
    results.closePosition = !!closeData;
  } else {
    console.log(`\n⚠️ Skipping Close Position test - no position ID available`);
  }

  // Test 6: WebSocket
  results.websocket = await testWebSocket();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=".repeat(50));

  const tests = [
    ["Health Check", results.health],
    ["Trading Balance", results.balance],
    ["Open Position", results.openPosition],
    ["Get Positions", results.getPositions],
    ["Close Position", results.closePosition],
    ["WebSocket", results.websocket],
  ];

  let passed = 0;
  let total = tests.length;

  tests.forEach(([name, success]) => {
    const status = success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${name}`);
    if (success) passed++;
  });

  console.log("\n" + "=".repeat(50));
  console.log(
    `🎯 OVERALL RESULT: ${passed}/${total} tests passed (${Math.round(
      (passed / total) * 100
    )}%)`
  );

  if (passed === total) {
    console.log("🎉 ALL TESTS PASSED! MVP is ready for production.");
  } else if (passed >= total * 0.8) {
    console.log("⚠️ Most tests passed. MVP is functional with minor issues.");
  } else {
    console.log("❌ Multiple test failures. MVP needs debugging.");
  }

  console.log("=".repeat(50));
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runComprehensiveTests().catch((error) => {
  console.error("💥 Test suite crashed:", error);
  process.exit(1);
});
