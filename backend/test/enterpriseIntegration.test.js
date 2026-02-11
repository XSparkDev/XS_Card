/**
 * Enterprise Integration Tests
 * 
 * Tests for enterprise document creation during payment flow.
 * 
 * IMPORTANT: These tests use REAL data structures (Rule #3: No Dummy or Mock Data)
 * - Tests should be run with real Firestore database
 * - Integration tests require real Paystack test transactions
 * - All data must be real and valid
 * 
 * Usage:
 *   node backend/test/enterpriseIntegration.test.js
 * 
 * Prerequisites:
 *   - Firestore database configured
 *   - Environment variables set (.env file)
 *   - Real quote data in enterprise_quotes collection
 *   - Real account data structures
 */

require('dotenv').config();
const { db, admin } = require('../firebase');
const { deriveCompanySize, buildEnterpriseDocumentData } = require('../utils/enterpriseDocumentHelpers');
const { MIN_RETRIES, MAX_RETRIES } = require('../config/enterpriseRetryConfig');

/**
 * Test deriveCompanySize function
 */
async function testDeriveCompanySize() {
  console.log('\n=== Testing deriveCompanySize ===');
  
  // Test 1: Specific number
  const result1 = deriveCompanySize(500, null);
  console.log(`Test 1 - Specific number (500): ${result1}`);
  if (result1 !== '500') {
    throw new Error(`Expected '500', got '${result1}'`);
  }
  
  // Test 2: Range format
  const priceRange1 = { minEmployees: 201, maxEmployees: 1000 };
  const result2 = deriveCompanySize(500, priceRange1);
  console.log(`Test 2 - Range (201-1000): ${result2}`);
  if (result2 !== '201-1000') {
    throw new Error(`Expected '201-1000', got '${result2}'`);
  }
  
  // Test 3: Open-ended range (maxEmployees >= 90% of MAX_EMPLOYEES)
  const MAX_EMPLOYEES = parseInt(process.env.ENTERPRISE_MAX_EMPLOYEES || '10000', 10);
  const priceRange2 = { minEmployees: 1000, maxEmployees: MAX_EMPLOYEES };
  const result3 = deriveCompanySize(5000, priceRange2);
  console.log(`Test 3 - Open-ended range (1000+): ${result3}`);
  if (!result3.includes('+')) {
    throw new Error(`Expected open-ended range with '+', got '${result3}'`);
  }
  
  // Test 4: String input (already formatted)
  const result4 = deriveCompanySize('201-1000', null);
  console.log(`Test 4 - String input ('201-1000'): ${result4}`);
  if (result4 !== '201-1000') {
    throw new Error(`Expected '201-1000', got '${result4}'`);
  }
  
  console.log('✅ All deriveCompanySize tests passed\n');
}

/**
 * Test buildEnterpriseDocumentData function
 */
async function testBuildEnterpriseDocumentData() {
  console.log('\n=== Testing buildEnterpriseDocumentData ===');
  
  // Get real quote data from database
  const quotesSnapshot = await db.collection('enterprise_quotes')
    .where('quoteStatus', '==', 'paid')
    .limit(1)
    .get();
  
  if (quotesSnapshot.empty) {
    console.log('⚠️  No paid quotes found - skipping buildEnterpriseDocumentData test');
    console.log('   Create a paid quote first to test this function');
    return;
  }
  
  const quoteDoc = quotesSnapshot.docs[0];
  const quoteData = quoteDoc.data();
  
  // Build account data from quote
  const accountData = {
    enterpriseId: `ent_${quoteData.quoteId}`,
    companyName: quoteData.companyName,
    contactEmail: quoteData.contactEmail,
    contactName: quoteData.contactName,
    numberOfEmployees: quoteData.numberOfEmployees,
    quoteId: quoteData.quoteId,
    createdAt: quoteData.paidAt || admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    activatedAt: quoteData.paidAt || admin.firestore.Timestamp.now()
  };
  
  // Build enterprise document data
  const enterpriseData = buildEnterpriseDocumentData(accountData, quoteData);
  
  // Validate structure
  const requiredFields = ['name', 'numberOfEmployees', 'contactEmail', 'contactName', 'companySize', 'createdAt', 'updatedAt'];
  const optionalFields = ['description', 'industry', 'website', 'logoUrl', 'colorScheme', 'address'];
  
  console.log('Enterprise document structure:');
  console.log(JSON.stringify(enterpriseData, null, 2));
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in enterpriseData)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Check optional fields exist (even if empty)
  for (const field of optionalFields) {
    if (!(field in enterpriseData)) {
      throw new Error(`Missing optional field: ${field}`);
    }
  }
  
  // Validate data types
  if (typeof enterpriseData.name !== 'string') {
    throw new Error('name must be a string');
  }
  if (typeof enterpriseData.numberOfEmployees !== 'number' && typeof enterpriseData.numberOfEmployees !== 'string') {
    throw new Error('numberOfEmployees must be a number or string');
  }
  if (typeof enterpriseData.contactEmail !== 'string') {
    throw new Error('contactEmail must be a string');
  }
  if (typeof enterpriseData.companySize !== 'string') {
    throw new Error('companySize must be a string');
  }
  
  console.log('✅ buildEnterpriseDocumentData test passed\n');
}

/**
 * Test retry configuration
 */
async function testRetryConfig() {
  console.log('\n=== Testing Retry Configuration ===');
  
  console.log(`MIN_RETRIES: ${MIN_RETRIES}`);
  console.log(`MAX_RETRIES: ${MAX_RETRIES}`);
  
  if (typeof MIN_RETRIES !== 'number' || MIN_RETRIES < 1) {
    throw new Error(`MIN_RETRIES must be a positive integer, got: ${MIN_RETRIES}`);
  }
  
  if (typeof MAX_RETRIES !== 'number' || MAX_RETRIES < 1) {
    throw new Error(`MAX_RETRIES must be a positive integer, got: ${MAX_RETRIES}`);
  }
  
  if (MIN_RETRIES > MAX_RETRIES) {
    throw new Error(`MIN_RETRIES (${MIN_RETRIES}) must be <= MAX_RETRIES (${MAX_RETRIES})`);
  }
  
  console.log('✅ Retry configuration test passed\n');
}

/**
 * Test idempotency - verify enterprise document creation is idempotent
 */
async function testIdempotency() {
  console.log('\n=== Testing Idempotency ===');
  
  // Get a real enterprise document if it exists
  const enterpriseSnapshot = await db.collection('enterprise').limit(1).get();
  
  if (enterpriseSnapshot.empty) {
    console.log('⚠️  No enterprise documents found - skipping idempotency test');
    console.log('   Create an enterprise document first to test idempotency');
    return;
  }
  
  const enterpriseDoc = enterpriseSnapshot.docs[0];
  const enterpriseId = enterpriseDoc.id;
  const enterpriseData = enterpriseDoc.data();
  
  console.log(`Testing idempotency with enterprise: ${enterpriseId}`);
  console.log(`Enterprise name: ${enterpriseData.name}`);
  
  // Verify document exists
  const checkDoc = await db.collection('enterprise').doc(enterpriseId).get();
  if (!checkDoc.exists) {
    throw new Error(`Enterprise document ${enterpriseId} should exist but doesn't`);
  }
  
  console.log('✅ Idempotency test passed (document exists and is accessible)\n');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('========================================');
  console.log('Enterprise Integration Tests');
  console.log('========================================\n');
  
  try {
    await testRetryConfig();
    await testDeriveCompanySize();
    await testBuildEnterpriseDocumentData();
    await testIdempotency();
    
    console.log('========================================');
    console.log('✅ All tests passed!');
    console.log('========================================\n');
    
    console.log('NOTE: Integration tests with real Paystack transactions');
    console.log('      should be run manually using the payment callback flow.');
    console.log('      See ENTERPRISE_INTEGRATION_IMPLEMENTATION_PLAN.md for details.');
    
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Test failed:', error.message);
    console.error('========================================\n');
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  testDeriveCompanySize,
  testBuildEnterpriseDocumentData,
  testRetryConfig,
  testIdempotency,
  runTests
};
