const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3005"; // Local render-backend server
const TEST_WALLET = `${Date.now()
  .toString()
  .slice(
    -6
  )}${"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".slice(
  0,
  38
)}`; // Unique mock wallet
const TEST_USER = {
  username: `test${Date.now().toString().slice(-6)}`, // Unique username (max 10 chars)
  email: `test_${Date.now()}@example.com`, // Unique email
  wallet_address: TEST_WALLET,
  swig_wallet_address: `swig_${Date.now()}`, // Mock Swig wallet
};

async function testWalletAddressFunctionality() {
  console.log("🧪 Testing Wallet Address Functionality\n");

  try {
    // Step 1: Create account with wallet address
    console.log("📝 Step 1: Creating account with wallet address...");
    console.log(`   Username: ${TEST_USER.username}`);
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Wallet Address: ${TEST_USER.wallet_address}`);
    console.log(`   Swig Wallet: ${TEST_USER.swig_wallet_address}\n`);

    const createResponse = await axios.post(
      `${BASE_URL}/api/auth/create-account`,
      TEST_USER
    );

    if (createResponse.status === 201) {
      console.log("✅ Account created successfully!");
      console.log("   Response:", JSON.stringify(createResponse.data, null, 2));
      console.log();
    } else {
      throw new Error(`Unexpected status: ${createResponse.status}`);
    }

    // Step 2: Test fetching user by wallet address
    console.log("🔍 Step 2: Fetching user by wallet address...");
    console.log(`   Looking up wallet: ${TEST_WALLET}\n`);

    const lookupResponse = await axios.get(
      `${BASE_URL}/api/users/by-wallet/${TEST_WALLET}`
    );

    if (lookupResponse.status === 200) {
      console.log("✅ User lookup successful!");
      console.log("   Response:", JSON.stringify(lookupResponse.data, null, 2));
      console.log();

      // Verify the data matches
      const userData = lookupResponse.data.user;
      if (
        userData.username === TEST_USER.username &&
        userData.email === TEST_USER.email &&
        userData.wallet_address === TEST_USER.wallet_address
      ) {
        console.log("✅ Data verification passed - all fields match!");
      } else {
        console.log("❌ Data verification failed - fields do not match");
        console.log("   Expected username:", TEST_USER.username);
        console.log("   Got username:", userData.username);
        console.log("   Expected email:", TEST_USER.email);
        console.log("   Got email:", userData.email);
        console.log("   Expected wallet:", TEST_USER.wallet_address);
        console.log("   Got wallet:", userData.wallet_address);
      }
    } else {
      throw new Error(`Unexpected lookup status: ${lookupResponse.status}`);
    }

    // Step 3: Test duplicate wallet address rejection
    console.log("\n🚫 Step 3: Testing duplicate wallet address rejection...");

    const duplicateUser = {
      username: `dup${Date.now().toString().slice(-6)}`,
      email: `duplicate_${Date.now()}@example.com`,
      wallet_address: TEST_WALLET, // Same wallet address
      swig_wallet_address: "different_swig_wallet",
    };

    try {
      await axios.post(`${BASE_URL}/api/auth/create-account`, duplicateUser);
      console.log(
        "❌ Duplicate wallet test failed - should have been rejected"
      );
    } catch (error) {
      if (
        error.response &&
        (error.response.status === 400 || error.response.status === 409)
      ) {
        console.log("✅ Duplicate wallet correctly rejected!");
        console.log("   Error message:", error.response.data.error);
      } else {
        console.log(
          "❌ Unexpected error during duplicate test:",
          error.message
        );
      }
    }

    // Step 4: Test non-existent wallet lookup
    console.log("\n🔍 Step 4: Testing non-existent wallet lookup...");
    const fakeWallet = "FakeWalletAddressThatDoesNotExist123456789";

    try {
      await axios.get(`${BASE_URL}/api/users/by-wallet/${fakeWallet}`);
      console.log(
        "❌ Non-existent wallet test failed - should have returned 404"
      );
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("✅ Non-existent wallet correctly returned 404!");
        console.log("   Error message:", error.response.data.error);
      } else {
        console.log(
          "❌ Unexpected error during non-existent test:",
          error.message
        );
      }
    }

    console.log("\n🎉 All wallet address tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("   Status:", error.response.status);
      console.error("   Response:", error.response.data);
    }
  }
}

// Run the test
testWalletAddressFunctionality();
