#!/usr/bin/env node
// Test Runner - Executes all test suites

const { runSimpleTests } = require('./simple-api.test');
const { runDriftIntegrationTests } = require('./drift-integration.test');
const { runUtilsTests } = require('./utils.test');

async function runAllTests() {
  console.log('🧪 REKT Backend Comprehensive Test Suite\n');
  
  const results = {
    utils: null,
    simple: null,
    drift: null,
    total: { passed: 0, failed: 0 }
  };

  try {
    // Run utility tests (no server dependency)
    console.log('🔧 Running utility function tests...\n');
    results.utils = runUtilsTests();
    console.log('');

    // Check server health first
    const serverHealthy = await healthCheck();
    if (!serverHealthy) {
      console.log('\n⚠️  Server not running - skipping API tests');
      console.log('Start server with: node src/server.js');
      process.exit(1);
    }

    // Run simple API tests
    console.log('\n🧪 Running simple API test suite...\n');
    results.simple = await runSimpleTests();
    
    // Run Drift integration tests
    console.log('\n🌊 Running Drift SDK integration tests...\n');
    results.drift = await runDriftIntegrationTests();
    
    // Calculate totals
    results.total.passed = results.utils.passed + results.simple.passed + results.drift.summary.passed;
    results.total.failed = results.utils.failed + results.simple.failed + results.drift.summary.failed;

    // Final comprehensive summary
    console.log('\n📊 === COMPREHENSIVE TEST RESULTS ===');
    console.log(`🔧 Utility Tests: ${results.utils.passed}/${results.utils.passed + results.utils.failed} passed`);
    console.log(`🧪 API Tests: ${results.simple.passed}/${results.simple.total} passed`);
    console.log(`🌊 Drift Tests: ${results.drift.summary.passed}/${results.drift.summary.total} passed`);
    console.log(`📊 TOTAL: ${results.total.passed}/${results.total.passed + results.total.failed} passed`);
    
    // Show errors if any
    const allErrors = [
      ...(results.simple.errors || []),
      ...(results.drift.driftErrors || [])
    ];
    
    if (allErrors.length > 0) {
      console.log('\n🐛 Issues Found:');
      allErrors.forEach(error => {
        console.log(`  ${error.test}: ${error.error}`);
      });
    }
    
    console.log('\n💡 Test Suite Benefits:');
    console.log('  - Comprehensive endpoint validation');
    console.log('  - Drift SDK error detection and analysis');
    console.log('  - Performance monitoring');
    console.log('  - Regression prevention for future refactors');
    
    if (results.total.failed > 0) {
      console.log('\n⚠️  Some tests failed - see details above');
      console.log('💡 This helps identify issues before they reach production');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed! Backend is functioning correctly.');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n💥 Test runner error:', error.message);
    process.exit(1);
  }
}

// Quick health check function
async function healthCheck() {
  const axios = require('axios');
  try {
    const response = await axios.get('http://localhost:3004/', { timeout: 5000 });
    console.log('✅ Server is running and responsive');
    return true;
  } catch (error) {
    console.log('❌ Server not accessible:', error.message);
    console.log('💡 Start server with: node src/server.js');
    return false;
  }
}

// Run based on command line args
const args = process.argv.slice(2);

if (args.includes('--health')) {
  healthCheck();
} else if (args.includes('--utils-only')) {
  runUtilsTests();
} else if (args.includes('--api-only')) {
  runSimpleTests().catch(console.error);
} else if (args.includes('--drift-only')) {
  runDriftIntegrationTests().catch(console.error);
} else {
  runAllTests();
}

module.exports = { runAllTests, healthCheck };