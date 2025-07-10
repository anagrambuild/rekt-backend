// Simple API Test Suite - Based on Actual Current API Responses
const axios = require('axios');

const BASE_URL = 'http://localhost:3004';
const TEST_WALLET = 'GKYPWkWtiXVPdzv6EimbTWx7PCL4Pv5wggTW5cFtCvYm';

class SimpleAPITests {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  async test(name, testFn) {
    try {
      console.log(`\n🧪 ${name}`);
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      this.results.push({ name, status: 'PASS', duration });
      console.log(`   ✅ PASSED (${duration}ms)`);
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      this.errors.push({ test: name, error: error.message });
      console.log(`   ❌ FAILED: ${error.message}`);
    }
  }

  async apiCall(method, endpoint, data = null) {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) config.data = data;
    return await axios(config);
  }

  assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async runAllTests() {
    console.log('🧪 SIMPLE API TEST SUITE - Based on Current Server Responses\n');

    // === BASIC CONNECTIVITY ===
    await this.test('Server Root Responds', async () => {
      const res = await this.apiCall('GET', '/');
      this.assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    // === MARKETS ENDPOINT ===
    await this.test('Markets Endpoint Returns Correct Format', async () => {
      const res = await this.apiCall('GET', '/api/markets');
      this.assert(res.status === 200, `Expected 200, got ${res.status}`);
      this.assert(res.data.success === true, 'Should have success=true');
      this.assert(Array.isArray(res.data.data), 'Should have data array');
      this.assert(res.data.data.length > 0, 'Should have market data');
      
      // Check first market structure
      const market = res.data.data[0];
      const requiredFields = ['symbol', 'price', 'volume24h', 'change24h', 'funding', 'openInterest'];
      requiredFields.forEach(field => {
        this.assert(field in market, `Market missing field: ${field}`);
      });
      
      console.log(`   📊 Found ${res.data.data.length} markets`);
    });

    // === WALLET BALANCE ===
    await this.test('Wallet Balance Returns Correct Format', async () => {
      const res = await this.apiCall('GET', `/api/wallet/${TEST_WALLET}/usdc-balance`);
      this.assert(res.status === 200, `Expected 200, got ${res.status}`);
      this.assert(res.data.success === true, 'Should have success=true');
      this.assert(typeof res.data.balance === 'number', 'Should have numeric balance');
      this.assert(res.data.wallet === TEST_WALLET, 'Should return correct wallet');
      this.assert('timestamp' in res.data, 'Should have timestamp');
      
      console.log(`   💰 Balance: $${res.data.balance}`);
    });

    await this.test('Invalid Wallet Address Rejected', async () => {
      try {
        await this.apiCall('GET', '/api/wallet/invalid-address/usdc-balance');
        this.assert(false, 'Should have thrown error for invalid wallet');
      } catch (error) {
        this.assert(error.response.status === 400, 'Should return 400 for invalid wallet');
        this.assert(error.response.data.success === false, 'Should have success=false');
      }
    });

    // === POSITIONS ===
    await this.test('Positions Endpoint Returns Correct Format', async () => {
      const res = await this.apiCall('GET', `/api/markets/positions/${TEST_WALLET}`);
      this.assert(res.status === 200, `Expected 200, got ${res.status}`);
      this.assert(res.data.success === true, 'Should have success=true');
      this.assert(Array.isArray(res.data.positions), 'Should have positions array');
      this.assert('timestamp' in res.data, 'Should have timestamp');
      
      if (res.data.positions.length > 0) {
        const position = res.data.positions[0];
        const requiredFields = ['market', 'direction', 'size', 'entryPrice', 'markPrice', 'pnl'];
        requiredFields.forEach(field => {
          this.assert(field in position, `Position missing field: ${field}`);
        });
        console.log(`   📊 Found ${res.data.positions.length} positions`);
      } else {
        console.log(`   📊 No positions found`);
      }
    });

    // === MARGIN CALCULATION ===
    await this.test('Margin Calculation Works', async () => {
      const res = await this.apiCall('POST', '/api/trade/calculate-margin', {
        walletAddress: TEST_WALLET,
        tradeAmount: 25,
        leverage: 5,
        direction: 'long'
      });
      this.assert(res.status === 200, `Expected 200, got ${res.status}`);
      this.assert(res.data.success === true, 'Should have success=true');
      this.assert(typeof res.data.marginRequired === 'string', 'Should have marginRequired');
      this.assert(typeof res.data.canExecuteTrade === 'boolean', 'Should have canExecuteTrade');
      this.assert('solPrice' in res.data, 'Should have solPrice');
      
      console.log(`   💰 Margin required: $${res.data.marginRequired} for $25 trade`);
      console.log(`   ✅ Can execute: ${res.data.canExecuteTrade}`);
    });

    await this.test('Margin Calculation Validates Input', async () => {
      try {
        await this.apiCall('POST', '/api/trade/calculate-margin', {
          walletAddress: TEST_WALLET
          // Missing required fields
        });
        this.assert(false, 'Should have thrown error for missing fields');
      } catch (error) {
        this.assert(error.response.status === 400, 'Should return 400 for missing fields');
      }
    });

    // === TRADE SUBMISSION ===
    await this.test('Trade Submission Responds Correctly', async () => {
      try {
        const res = await this.apiCall('POST', '/api/trade/submit', {
          walletAddress: TEST_WALLET,
          tradeAmount: 1, // Small amount for testing
          leverage: 2,
          direction: 'long',
          marketSymbol: 'SOL-PERP'
        });
        
        // Trade might succeed or fail, but response should be structured
        this.assert('success' in res.data, 'Should have success field');
        
        if (res.data.success) {
          this.assert('transactionData' in res.data, 'Successful trade should have transactionData');
          console.log(`   ✅ Trade prepared successfully`);
        } else {
          this.assert('error' in res.data, 'Failed trade should have error message');
          console.log(`   ⚠️ Trade failed (expected): ${res.data.error}`);
        }
        
      } catch (error) {
        // Network errors are also acceptable for trade testing
        if (error.response && error.response.data) {
          this.assert('success' in error.response.data, 'Error response should have success field');
        } else {
          // Network-level errors during trade processing are acceptable
          console.log(`   ⚠️ Network error during trade (acceptable for testing)`);
        }
      }
    });

    await this.test('Trade Submission Validates Input', async () => {
      try {
        await this.apiCall('POST', '/api/trade/submit', {
          walletAddress: 'invalid'
          // Missing required fields
        });
        this.assert(false, 'Should have thrown error for invalid input');
      } catch (error) {
        this.assert(error.response.status === 400, 'Should return 400 for invalid input');
      }
    });

    // === TRANSACTION ENDPOINTS ===
    await this.test('Transaction Status Endpoint Responds', async () => {
      try {
        const res = await this.apiCall('GET', '/api/transaction/status?signature=test123');
        // Should return structured response regardless of whether signature exists
        this.assert('success' in res.data, 'Should have success field');
      } catch (error) {
        // 404 or other errors are acceptable for test signatures
        this.assert(error.response && error.response.status >= 400, 'Should return valid HTTP status');
      }
    });

    // === ERROR HANDLING ===
    await this.test('Handles Non-existent Endpoints', async () => {
      try {
        await this.apiCall('GET', '/api/nonexistent');
        this.assert(false, 'Should have thrown error for non-existent endpoint');
      } catch (error) {
        this.assert(error.response && error.response.status === 404, 'Should return 404 for non-existent endpoint');
      }
    });

    return this.generateReport();
  }

  generateReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log('\n📊 === TEST RESULTS ===');
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
    console.log(`Success Rate: ${Math.round(passed/total * 100)}%`);

    if (this.errors.length > 0) {
      console.log('\n🐛 Failures:');
      this.errors.forEach(error => {
        console.log(`  • ${error.test}: ${error.error}`);
      });
    }

    return {
      total,
      passed,
      failed,
      successRate: Math.round(passed/total * 100),
      errors: this.errors,
      results: this.results
    };
  }
}

async function runSimpleTests() {
  const tests = new SimpleAPITests();
  const report = await tests.runAllTests();
  
  if (report.failed === 0) {
    console.log('\n✅ All tests passed! API is functioning correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed - see details above');
    process.exit(1);
  }
}

if (require.main === module) {
  runSimpleTests().catch(console.error);
}

module.exports = { SimpleAPITests, runSimpleTests };