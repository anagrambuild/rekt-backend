// Utility Functions Test Suite
const path = require('path');
const {
  validateWalletAddress,
  createErrorResponse,
  createSuccessResponse,
  serializeInstructions,
  handleError
} = require('../src/utils');

const { PublicKey } = require('@solana/web3.js');

function runUtilsTests() {
  const results = [];
  
  function test(name, fn) {
    try {
      fn();
      results.push({ name, status: '✅ PASS' });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.push({ name, status: '❌ FAIL', error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  console.log('🔧 Testing Utility Functions\n');

  // Wallet validation tests
  test('Valid wallet address validation', () => {
    const valid = validateWalletAddress('GKYPWkWtiXVPdzv6EimbTWx7PCL4Pv5wggTW5cFtCvYm');
    assert(valid === true, 'Should validate correct wallet address');
  });

  test('Invalid wallet address rejection', () => {
    const invalid = validateWalletAddress('invalid-address');
    assert(invalid === false, 'Should reject invalid wallet address');
  });

  test('Empty wallet address rejection', () => {
    const empty = validateWalletAddress('');
    assert(empty === false, 'Should reject empty wallet address');
  });

  // Error response tests
  test('Error response creation', () => {
    const error = new Error('Test error');
    const response = createErrorResponse(error, 'Test message', 400);
    
    assert(response.success === false, 'Error response should have success: false');
    assert(response.error === 'Test error', 'Should include error message');
    assert(response.message === 'Test message', 'Should include custom message');
    assert(response.statusCode === 400, 'Should include status code');
    assert(response.timestamp, 'Should include timestamp');
  });

  // Success response tests
  test('Success response creation', () => {
    const data = { balance: 100 };
    const response = createSuccessResponse(data, 'Success message');
    
    assert(response.success === true, 'Success response should have success: true');
    assert(response.data === data, 'Should include provided data');
    assert(response.message === 'Success message', 'Should include custom message');
    assert(response.timestamp, 'Should include timestamp');
  });

  // Instruction serialization tests
  test('Instruction serialization with buffer data', () => {
    const mockInstruction = {
      programId: new PublicKey('11111111111111111111111111111111'),
      data: Buffer.from('test data'),
      keys: [{
        pubkey: new PublicKey('11111111111111111111111111111111'),
        isSigner: true,
        isWritable: false
      }]
    };

    const serialized = serializeInstructions([mockInstruction]);
    
    assert(Array.isArray(serialized), 'Should return array');
    assert(serialized.length === 1, 'Should serialize one instruction');
    assert(serialized[0].programId === '11111111111111111111111111111111', 'Should serialize program ID');
    assert(typeof serialized[0].data === 'string', 'Should serialize data as base64 string');
    assert(Array.isArray(serialized[0].keys), 'Should serialize keys array');
  });

  // Handle error tests  
  test('Error handler response format', () => {
    const mockRes = {
      status: (code) => ({ json: (data) => ({ status: code, data }) })
    };
    
    const error = new Error('Test error');
    const result = handleError(mockRes, error, 'Test context');
    
    assert(result.status === 500, 'Should return 500 status');
    assert(result.data.success === false, 'Should have success: false');
    assert(result.data.error === 'Test error', 'Should include error message');
  });

  const passed = results.filter(r => r.status.includes('PASS')).length;
  const failed = results.filter(r => r.status.includes('FAIL')).length;
  
  console.log(`\n🔧 Utils Tests: ${passed} passed, ${failed} failed`);
  return { passed, failed, results };
}

if (require.main === module) {
  runUtilsTests();
}

module.exports = { runUtilsTests };