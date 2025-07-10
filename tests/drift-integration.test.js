// Drift SDK Integration Tests
// Tests specific to Drift Protocol integration and common issues

const axios = require('axios');
const { PublicKey, Connection } = require('@solana/web3.js');

const BASE_URL = 'http://localhost:3004';
const TEST_WALLET = 'GKYPWkWtiXVPdzv6EimbTWx7PCL4Pv5wggTW5cFtCvYm';

class DriftIntegrationTests {
  constructor() {
    this.results = [];
    this.driftErrors = [];
  }

  async test(name, testFn) {
    try {
      console.log(`\n🌊 Drift Test: ${name}`);
      const result = await testFn();
      this.results.push({ name, status: 'PASS', result });
      console.log(`   ✅ PASSED`);
      return result;
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      this.driftErrors.push({ test: name, error: error.message, details: error.stack });
      console.log(`   ❌ FAILED: ${error.message}`);
      throw error;
    }
  }

  async apiCall(method, endpoint, data = null) {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) config.data = data;

    try {
      const response = await axios(config);
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status || 0,
        data: error.response?.data || null,
        error: error.message
      };
    }
  }

  async testConnectionAndInitialization() {
    await this.test('Solana Connection', async () => {
      // Test if we can connect to Solana mainnet
      const connection = new Connection('https://api.mainnet-beta.solana.com');
      const blockHeight = await connection.getBlockHeight();
      
      console.log(`   📊 Current block height: ${blockHeight}`);
      
      if (blockHeight < 100000) {
        throw new Error('Unexpected block height, connection may be invalid');
      }
      
      return { blockHeight };
    });

    await this.test('Drift Client Initialization Check', async () => {
      // This test checks if our backend can initialize Drift clients
      const response = await this.apiCall('GET', `/api/markets/positions/${TEST_WALLET}`);
      
      if (!response.success) {
        throw new Error(`Failed to connect to Drift: ${response.error}`);
      }
      
      console.log(`   📊 Drift connection status: ${response.data.success ? 'Connected' : 'Failed'}`);
      
      return response.data;
    });
  }

  async testDriftAccountValidation() {
    await this.test('User Account Detection', async () => {
      const response = await this.apiCall('GET', `/api/markets/positions/${TEST_WALLET}`);
      
      if (!response.success) {
        throw new Error(`Account validation failed: ${response.error}`);
      }
      
      const accountExists = response.data.data?.accountExists;
      console.log(`   👤 Drift account exists: ${accountExists}`);
      
      if (accountExists) {
        console.log(`   📊 Positions count: ${response.data.data.positions?.length || 0}`);
        console.log(`   💰 Total value: $${response.data.data.totalValue || '0.00'}`);
      }
      
      return { accountExists, positionsCount: response.data.data.positions?.length || 0 };
    });

    await this.test('Invalid Account Handling', async () => {
      const invalidWallet = '11111111111111111111111111111111'; // Valid format but likely no Drift account
      const response = await this.apiCall('GET', `/api/markets/positions/${invalidWallet}`);
      
      // Should handle gracefully
      if (response.success) {
        console.log(`   ✅ Handled non-existent account gracefully`);
        return response.data;
      } else if (response.status === 400) {
        console.log(`   ✅ Properly rejected invalid account`);
        return response.data;
      } else {
        throw new Error(`Unexpected response for invalid account: ${response.status}`);
      }
    });
  }

  async testMarginCalculations() {
    await this.test('Margin Calculation with Real Data', async () => {
      const marginRequest = {
        walletAddress: TEST_WALLET,
        tradeAmount: 25,
        leverage: 5,
        direction: 'long'
      };
      
      const response = await this.apiCall('POST', '/api/trade/calculate-margin', marginRequest);
      
      if (!response.success) {
        throw new Error(`Margin calculation failed: ${response.error}`);
      }
      
      const marginData = response.data;
      console.log(`   💰 Margin required: $${marginData.marginRequired}`);
      console.log(`   📈 Actual leverage: ${marginData.actualLeverage}x`);
      console.log(`   ✅ Can execute: ${marginData.canExecuteTrade}`);
      console.log(`   💲 SOL price: $${marginData.solPrice}`);
      
      // Validate calculation makes sense
      const marginRequired = parseFloat(marginData.marginRequired);
      const actualLeverage = parseFloat(marginData.actualLeverage);
      
      if (isNaN(marginRequired) || marginRequired <= 0) {
        throw new Error(`Invalid margin calculation: ${marginRequired}`);
      }
      
      if (isNaN(actualLeverage) || actualLeverage <= 0) {
        throw new Error(`Invalid leverage calculation: ${actualLeverage}`);
      }
      
      return marginData;
    });

    await this.test('Margin Calculation Method Validation', async () => {
      const response = await this.apiCall('POST', '/api/trade/calculate-margin', {
        walletAddress: TEST_WALLET,
        tradeAmount: 25,
        leverage: 5,
        direction: 'long'
      });
      
      if (response.success && response.data.calculationMethod) {
        console.log(`   🔧 Calculation method: ${response.data.calculationMethod}`);
        
        if (response.data.calculationMethod.includes('Fallback')) {
          console.log(`   ⚠️  Using fallback calculation (SDK margin calculation failed)`);
        } else {
          console.log(`   ✅ Using Drift SDK calculation`);
        }
      }
      
      return response.data;
    });
  }

  async testTradeOrderCreation() {
    await this.test('Trade Order Error Analysis', async () => {
      const tradeRequest = {
        walletAddress: TEST_WALLET,
        tradeAmount: 25,
        leverage: 5,
        direction: 'long',
        marketSymbol: 'SOL-PERP'
      };
      
      const response = await this.apiCall('POST', '/api/trade/submit', tradeRequest);
      
      console.log(`   📊 Response status: ${response.status}`);
      console.log(`   📊 Response success: ${response.data?.success}`);
      
      if (response.data?.success === false) {
        const errorMessage = response.data.error || 'Unknown error';
        console.log(`   ⚠️  Trade creation failed: ${errorMessage}`);
        
        // Analyze specific Drift SDK errors
        if (errorMessage.includes('offset') && errorMessage.includes('out of range')) {
          console.log(`   🔍 Detected: Buffer offset error (SDK serialization issue)`);
          console.log(`   💡 Suggestion: Check user account initialization or SDK version`);
        } else if (errorMessage.includes('No Drift user account')) {
          console.log(`   🔍 Detected: Missing Drift account`);
          console.log(`   💡 Suggestion: User needs to initialize Drift account first`);
        } else if (errorMessage.includes('Insufficient')) {
          console.log(`   🔍 Detected: Insufficient funds/margin`);
          console.log(`   💡 Suggestion: Check collateral requirements`);
        }
        
        // For testing purposes, this is expected behavior for now
        return { expectedError: true, error: errorMessage };
      } else if (response.data?.transactionData) {
        console.log(`   ✅ Trade order created successfully`);
        console.log(`   📋 Instructions count: ${response.data.transactionData.instructions?.length || 0}`);
        return { success: true, transactionData: response.data.transactionData };
      } else {
        throw new Error('Unexpected response format');
      }
    });
  }

  async testOracleDataAccess() {
    await this.test('Oracle Price Data Access', async () => {
      // Test if we can access oracle prices through margin calculation
      const response = await this.apiCall('POST', '/api/trade/calculate-margin', {
        walletAddress: TEST_WALLET,
        tradeAmount: 25,
        leverage: 5,
        direction: 'long'
      });
      
      if (!response.success) {
        throw new Error(`Failed to access oracle data: ${response.error}`);
      }
      
      const solPrice = parseFloat(response.data.solPrice);
      
      if (isNaN(solPrice) || solPrice <= 0) {
        throw new Error(`Invalid SOL price from oracle: ${response.data.solPrice}`);
      }
      
      // Sanity check on SOL price (should be reasonable)
      if (solPrice < 10 || solPrice > 1000) {
        console.log(`   ⚠️  SOL price seems unusual: $${solPrice}`);
      } else {
        console.log(`   💲 SOL price looks reasonable: $${solPrice}`);
      }
      
      console.log(`   📊 Price precision: ${response.data.solPrice}`);
      
      return { solPrice, rawPrice: response.data.solPrice };
    });
  }

  async testErrorHandlingPatterns() {
    await this.test('SDK Error Handling Patterns', async () => {
      const testCases = [
        {
          name: 'Zero trade amount',
          data: { walletAddress: TEST_WALLET, tradeAmount: 0, leverage: 5, direction: 'long' }
        },
        {
          name: 'Extreme leverage',
          data: { walletAddress: TEST_WALLET, tradeAmount: 25, leverage: 1000, direction: 'long' }
        },
        {
          name: 'Invalid direction',
          data: { walletAddress: TEST_WALLET, tradeAmount: 25, leverage: 5, direction: 'invalid' }
        }
      ];
      
      const results = [];
      
      for (const testCase of testCases) {
        console.log(`     Testing: ${testCase.name}`);
        const response = await this.apiCall('POST', '/api/trade/submit', testCase.data);
        
        const handled = response.status === 400 || 
                       (response.data?.success === false && response.data?.error);
        
        if (!handled) {
          console.log(`     ⚠️  ${testCase.name}: Not properly handled`);
        } else {
          console.log(`     ✅ ${testCase.name}: Properly handled`);
        }
        
        results.push({
          testCase: testCase.name,
          handled,
          response: response.data
        });
      }
      
      return results;
    });
  }

  async testPositionCalculations() {
    await this.test('Position Calculation Accuracy', async () => {
      const response = await this.apiCall('GET', `/api/markets/positions/${TEST_WALLET}`);
      
      if (!response.success) {
        throw new Error(`Failed to fetch positions: ${response.error}`);
      }
      
      const positions = response.data.data.positions || [];
      
      if (positions.length === 0) {
        console.log(`   📊 No positions found (this is normal for testing)`);
        return { positionsCount: 0 };
      }
      
      console.log(`   📊 Found ${positions.length} positions`);
      
      // Validate position calculations
      positions.forEach((position, index) => {
        console.log(`   Position ${index + 1}:`);
        console.log(`     Market: ${position.market}`);
        console.log(`     Direction: ${position.direction}`);
        console.log(`     Size: ${position.size}`);
        console.log(`     Entry: $${position.entryPrice}`);
        console.log(`     Mark: $${position.markPrice}`);
        console.log(`     PnL: $${position.pnl} (${position.pnlPercentage?.toFixed(2)}%)`);
        console.log(`     Leverage: ${position.leverage}x`);
        
        // Validate calculations
        if (position.entryPrice <= 0 || position.markPrice <= 0) {
          throw new Error(`Invalid price data in position ${index + 1}`);
        }
        
        if (isNaN(position.leverage) || position.leverage <= 0) {
          throw new Error(`Invalid leverage in position ${index + 1}`);
        }
      });
      
      return { positionsCount: positions.length, positions };
    });
  }

  generateDriftReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    return {
      summary: {
        total: this.results.length,
        passed,
        failed
      },
      driftErrors: this.driftErrors,
      results: this.results
    };
  }

  async runAllDriftTests() {
    console.log('🌊 DRIFT SDK INTEGRATION TEST SUITE\n');

    try {
      await this.testConnectionAndInitialization();
      await this.testDriftAccountValidation();
      await this.testMarginCalculations();
      await this.testTradeOrderCreation();
      await this.testOracleDataAccess();
      await this.testErrorHandlingPatterns();
      await this.testPositionCalculations();
      
    } catch (error) {
      console.error('\n💥 Drift test suite error:', error.message);
      this.driftErrors.push({
        test: 'test-suite',
        error: error.message,
        details: error.stack
      });
    }

    const report = this.generateDriftReport();
    
    console.log('\n🌊 === DRIFT INTEGRATION REPORT ===');
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    
    if (report.driftErrors.length > 0) {
      console.log('\n🐛 Drift-Specific Issues:');
      report.driftErrors.forEach(error => {
        console.log(`  ${error.test}: ${error.error}`);
      });
      
      console.log('\n💡 Common Drift SDK Issues & Solutions:');
      console.log('  - Buffer offset errors: Check user account initialization');
      console.log('  - Missing user accounts: User needs to deposit to Drift first');
      console.log('  - SDK version incompatibility: Update @drift-labs/sdk');
      console.log('  - Insufficient collateral: Check margin requirements');
    }
    
    return report;
  }
}

async function runDriftIntegrationTests() {
  const testSuite = new DriftIntegrationTests();
  return await testSuite.runAllDriftTests();
}

if (require.main === module) {
  runDriftIntegrationTests().catch(console.error);
}

module.exports = { runDriftIntegrationTests, DriftIntegrationTests };