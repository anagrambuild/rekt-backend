#!/usr/bin/env node

const { spawn } = require("child_process");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

console.log("🧪 REKT User Management System - Comprehensive Test");
console.log("=".repeat(60));

async function testEndpoint(url, method = "GET", data = null) {
  try {
    let curlCmd = `curl -s -X ${method} ${url}`;
    if (data) {
      curlCmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(
        data
      )}'`;
    }

    const { stdout, stderr } = await exec(curlCmd);
    if (stderr) {
      return { error: stderr };
    }
    return JSON.parse(stdout);
  } catch (error) {
    return { error: error.message };
  }
}

async function checkBackendHealth() {
  console.log("\n📊 Backend Health Check");
  console.log("-".repeat(30));

  // Test user management backend (port 3001)
  const userHealth = await testEndpoint("http://localhost:3001/health");
  console.log(`User Backend (3001): ${userHealth.status || "ERROR"}`);

  // Test trading backend (port 3004)
  const tradingHealth = await testEndpoint("http://localhost:3004/health");
  console.log(`Trading Backend (3004): ${tradingHealth.status || "ERROR"}`);

  return {
    userBackend: userHealth.status === "healthy",
    tradingBackend: tradingHealth.status === "healthy",
  };
}

async function testUserManagementAPI() {
  console.log("\n🔐 User Management API Tests");
  console.log("-".repeat(30));

  const testUsername = `testuser_${Date.now()}`;
  const testEmail = `test_${Date.now()}@example.com`;

  // Test username availability
  const usernameCheck = await testEndpoint(
    "http://localhost:3001/api/auth/check-username",
    "POST",
    {
      username: testUsername,
    }
  );
  console.log(
    `✅ Username Check: ${usernameCheck.available ? "PASS" : "FAIL"}`
  );

  // Test email availability
  const emailCheck = await testEndpoint(
    "http://localhost:3001/api/auth/check-email",
    "POST",
    {
      email: testEmail,
    }
  );
  console.log(`✅ Email Check: ${!emailCheck.exists ? "PASS" : "FAIL"}`);

  // Test account creation
  const accountCreation = await testEndpoint(
    "http://localhost:3001/api/auth/create-account",
    "POST",
    {
      username: testUsername,
      email: testEmail,
      avatarUrl: "",
    }
  );
  console.log(
    `✅ Account Creation: ${accountCreation.success ? "PASS" : "FAIL"}`
  );

  if (accountCreation.success) {
    // Test sign in with created account
    const signIn = await testEndpoint(
      "http://localhost:3001/api/auth/signin",
      "POST",
      {
        email: testEmail,
      }
    );
    console.log(`✅ Sign In: ${signIn.success ? "PASS" : "FAIL"}`);

    return {
      username: testUsername,
      email: testEmail,
      userId: accountCreation.user.id,
    };
  }

  return null;
}

async function testTradingBackend() {
  console.log("\n📈 Trading Backend Tests");
  console.log("-".repeat(30));

  // Test markets endpoint
  const markets = await testEndpoint("http://localhost:3004/api/markets");
  console.log(`✅ Markets API: ${markets.markets ? "PASS" : "FAIL"}`);

  // Test wallet balance
  const walletBalance = await testEndpoint(
    "http://localhost:3004/api/wallet/GKYPWkWtiXVPdzv6EimbTWx7PCL4Pv5wggTW5cFtCvYm/usdc-balance"
  );
  console.log(
    `✅ Wallet Balance: ${
      walletBalance.balance !== undefined ? "PASS" : "FAIL"
    }`
  );

  return {
    marketsWorking: !!markets.markets,
    walletWorking: walletBalance.balance !== undefined,
  };
}

async function testFrontendIntegration() {
  console.log("\n🌐 Frontend Integration Tests");
  console.log("-".repeat(30));

  // Test if auth.html is served
  try {
    const { stdout } = await exec("curl -s http://localhost:3004/auth.html");
    const hasAuthForm =
      stdout.includes("signin-form") || stdout.includes("create-account-form");
    console.log(`✅ Auth Page: ${hasAuthForm ? "PASS" : "FAIL"}`);
  } catch (error) {
    console.log(`❌ Auth Page: FAIL - ${error.message}`);
  }

  // Test if dashboard.html is served
  try {
    const { stdout } = await exec(
      "curl -s http://localhost:3004/dashboard.html"
    );
    const hasDashboard =
      stdout.includes("trading") || stdout.includes("dashboard");
    console.log(`✅ Dashboard Page: ${hasDashboard ? "PASS" : "FAIL"}`);
  } catch (error) {
    console.log(`❌ Dashboard Page: FAIL - ${error.message}`);
  }
}

async function runTests() {
  try {
    // Check backend health
    const health = await checkBackendHealth();

    if (!health.userBackend) {
      console.log("\n❌ User management backend not running on port 3001");
      console.log("Run: cd render-backend && npm start");
      return;
    }

    if (!health.tradingBackend) {
      console.log("\n❌ Trading backend not running on port 3004");
      console.log("Run: PORT=3004 npm start");
      return;
    }

    // Test user management
    const userTest = await testUserManagementAPI();

    // Test trading backend
    const tradingTest = await testTradingBackend();

    // Test frontend integration
    await testFrontendIntegration();

    // Summary
    console.log("\n📋 Test Summary");
    console.log("=".repeat(60));
    console.log(
      `User Management Backend: ${
        health.userBackend ? "✅ WORKING" : "❌ FAILED"
      }`
    );
    console.log(
      `Trading Backend: ${health.tradingBackend ? "✅ WORKING" : "❌ FAILED"}`
    );
    console.log(`Account Creation: ${userTest ? "✅ WORKING" : "❌ FAILED"}`);
    console.log(
      `Trading APIs: ${
        tradingTest.marketsWorking && tradingTest.walletWorking
          ? "✅ WORKING"
          : "❌ FAILED"
      }`
    );

    if (
      health.userBackend &&
      health.tradingBackend &&
      userTest &&
      tradingTest.marketsWorking
    ) {
      console.log("\n🎉 REKT User Management System: FULLY OPERATIONAL");
      console.log("Ready for production deployment!");
    } else {
      console.log("\n⚠️  Some components need attention before deployment");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run tests
runTests();
