/**
 * Phase 1: Pricing & Validation Test Suite
 * 
 * Tests:
 * - Price calculation for ZAR and USD
 * - Input validation for all fields
 * - Error handling and error messages
 * 
 * Dependencies: Phase 0 (Foundation Setup)
 */

const { calculateEnterprisePrice, formatPrice, SUPPORTED_CURRENCIES } = require('./config/enterprisePricing');
const {
  validateCompanyName,
  validateContactName,
  validateEmail,
  validateNumberOfEmployees,
  validateCurrency,
  validateEnterpriseQuote
} = require('./utils/enterpriseValidation');

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

/**
 * Test helper function
 */
function test(name, testFn) {
  try {
    const result = testFn();
    if (result === true || (result && result.success === true)) {
      testsPassed++;
      testResults.push({ name, status: 'PASSED' });
      console.log(`✅ ${name}`);
      return true;
    } else {
      testsFailed++;
      testResults.push({ name, status: 'FAILED', error: result.error || result });
      console.log(`❌ ${name}`);
      if (result.error) console.log(`   Error: ${result.error}`);
      return false;
    }
  } catch (error) {
    testsFailed++;
    testResults.push({ name, status: 'FAILED', error: error.message });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Price Calculation Tests
 */
function testPriceCalculation() {
  console.log('\n📊 Testing Price Calculation...');
  console.log('='.repeat(50));

  // Test ZAR pricing - various employee counts
  test('ZAR: 1 employee = R110.00', () => {
    const price = calculateEnterprisePrice(1, 'ZAR');
    return price === 11000; // R100 base + R10 per employee
  });

  test('ZAR: 50 employees = R600.00', () => {
    const price = calculateEnterprisePrice(50, 'ZAR');
    return price === 60000; // R100 base + (50 * R10)
  });

  test('ZAR: 100 employees = R1,100.00', () => {
    const price = calculateEnterprisePrice(100, 'ZAR');
    return price === 110000; // R100 base + (100 * R10)
  });

  test('ZAR: 1000 employees = R10,100.00', () => {
    const price = calculateEnterprisePrice(1000, 'ZAR');
    return price === 1010000; // R100 base + (1000 * R10)
  });

  test('ZAR: 10000 employees = R100,100.00', () => {
    const price = calculateEnterprisePrice(10000, 'ZAR');
    return price === 10010000; // R100 base + (10000 * R10)
  });

  // Test USD pricing - various employee counts
  test('USD: 1 employee = $5.50', () => {
    const price = calculateEnterprisePrice(1, 'USD');
    return price === 550; // $5 base + $0.50 per employee
  });

  test('USD: 50 employees = $30.00', () => {
    const price = calculateEnterprisePrice(50, 'USD');
    return price === 3000; // $5 base + (50 * $0.50)
  });

  test('USD: 100 employees = $55.00', () => {
    const price = calculateEnterprisePrice(100, 'USD');
    return price === 5500; // $5 base + (100 * $0.50)
  });

  // Test default currency (ZAR)
  test('Default currency (ZAR): 50 employees = R600.00', () => {
    const price = calculateEnterprisePrice(50);
    return price === 60000;
  });

  // Test error cases - invalid employee count
  test('Error: Employee count < 1 throws error', () => {
    try {
      calculateEnterprisePrice(0, 'ZAR');
      return { success: false, error: 'Should have thrown error for 0 employees' };
    } catch (error) {
      return error.message.includes('Minimum');
    }
  });

  test('Error: Employee count > 10000 throws error', () => {
    try {
      calculateEnterprisePrice(10001, 'ZAR');
      return { success: false, error: 'Should have thrown error for 10001 employees' };
    } catch (error) {
      return error.message.includes('Maximum');
    }
  });

  test('Error: Negative employee count throws error', () => {
    try {
      calculateEnterprisePrice(-5, 'ZAR');
      return { success: false, error: 'Should have thrown error for negative employees' };
    } catch (error) {
      return error.message.includes('Minimum');
    }
  });

  test('Error: Non-integer employee count throws error', () => {
    try {
      calculateEnterprisePrice(50.5, 'ZAR');
      return { success: false, error: 'Should have thrown error for non-integer' };
    } catch (error) {
      return error.message.includes('integer');
    }
  });

  test('Error: Non-number employee count throws error', () => {
    try {
      calculateEnterprisePrice('50', 'ZAR');
      return { success: false, error: 'Should have thrown error for string' };
    } catch (error) {
      return error.message.includes('number');
    }
  });

  // Test error cases - unsupported currency
  test('Error: Unsupported currency throws error', () => {
    try {
      calculateEnterprisePrice(50, 'EUR');
      return { success: false, error: 'Should have thrown error for EUR' };
    } catch (error) {
      return error.message.includes('not supported');
    }
  });

  test('Error: Invalid currency type throws error', () => {
    try {
      calculateEnterprisePrice(50, 123);
      return { success: false, error: 'Should have thrown error for invalid currency type' };
    } catch (error) {
      return error.message.includes('not supported');
    }
  });

  // Test price formatting
  test('Format price: ZAR 60000 cents = "R 600.00"', () => {
    const formatted = formatPrice(60000, 'ZAR');
    return formatted === 'R 600.00';
  });

  test('Format price: USD 3000 cents = "$ 30.00"', () => {
    const formatted = formatPrice(3000, 'USD');
    return formatted === '$ 30.00';
  });
}

/**
 * Company Name Validation Tests
 */
function testCompanyNameValidation() {
  console.log('\n🏢 Testing Company Name Validation...');
  console.log('='.repeat(50));

  test('Valid: Normal company name', () => {
    const result = validateCompanyName('Acme Corporation');
    return result.isValid === true;
  });

  test('Valid: Company name with numbers', () => {
    const result = validateCompanyName('Company 123 Inc');
    return result.isValid === true;
  });

  test('Valid: Company name with hyphens and spaces', () => {
    const result = validateCompanyName('Acme-Corp Ltd');
    return result.isValid === true;
  });

  test('Valid: Company name with ampersand', () => {
    const result = validateCompanyName('Smith & Co');
    return result.isValid === true;
  });

  test('Valid: Company name with period', () => {
    const result = validateCompanyName('Acme Corp.');
    return result.isValid === true;
  });

  test('Valid: Minimum length (1 character)', () => {
    const result = validateCompanyName('A');
    return result.isValid === true;
  });

  test('Valid: Maximum length (200 characters)', () => {
    const longName = 'A'.repeat(200);
    const result = validateCompanyName(longName);
    return result.isValid === true;
  });

  test('Error: Empty string', () => {
    const result = validateCompanyName('');
    return result.isValid === false && result.error.includes('required');
  });

  test('Error: Whitespace only', () => {
    const result = validateCompanyName('   ');
    return result.isValid === false && result.error.includes('empty');
  });

  test('Error: Too long (> 200 characters)', () => {
    const longName = 'A'.repeat(201);
    const result = validateCompanyName(longName);
    return result.isValid === false && result.error.includes('200');
  });

  test('Error: Invalid characters (special chars)', () => {
    const result = validateCompanyName('Company@123');
    return result.isValid === false && result.error.includes('invalid');
  });

  test('Error: Null value', () => {
    const result = validateCompanyName(null);
    return result.isValid === false && result.error.includes('required');
  });

  test('Error: Non-string type', () => {
    const result = validateCompanyName(123);
    return result.isValid === false && result.error.includes('required');
  });
}

/**
 * Contact Name Validation Tests
 */
function testContactNameValidation() {
  console.log('\n👤 Testing Contact Name Validation...');
  console.log('='.repeat(50));

  test('Valid: Normal contact name', () => {
    const result = validateContactName('John Doe');
    return result.isValid === true;
  });

  test('Valid: Contact name with hyphen', () => {
    const result = validateContactName('Mary-Jane Smith');
    return result.isValid === true;
  });

  test('Valid: Contact name with apostrophe', () => {
    const result = validateContactName("O'Brien");
    return result.isValid === true;
  });

  test('Valid: Minimum length (1 character)', () => {
    const result = validateContactName('A');
    return result.isValid === true;
  });

  test('Valid: Maximum length (100 characters)', () => {
    const longName = 'A'.repeat(100);
    const result = validateContactName(longName);
    return result.isValid === true;
  });

  test('Error: Empty string', () => {
    const result = validateContactName('');
    return result.isValid === false && result.error.includes('required');
  });

  test('Error: Too long (> 100 characters)', () => {
    const longName = 'A'.repeat(101);
    const result = validateContactName(longName);
    return result.isValid === false && result.error.includes('100');
  });

  test('Error: Invalid characters (numbers)', () => {
    const result = validateContactName('John123');
    return result.isValid === false && result.error.includes('invalid');
  });

  test('Error: Invalid characters (special chars)', () => {
    const result = validateContactName('John@Doe');
    return result.isValid === false && result.error.includes('invalid');
  });

  test('Error: Null value', () => {
    const result = validateContactName(null);
    return result.isValid === false && result.error.includes('required');
  });
}

/**
 * Email Validation Tests
 */
function testEmailValidation() {
  console.log('\n📧 Testing Email Validation...');
  console.log('='.repeat(50));

  test('Valid: Normal email', () => {
    const result = validateEmail('john.doe@example.com');
    return result.isValid === true;
  });

  test('Valid: Email with numbers', () => {
    const result = validateEmail('user123@example.com');
    return result.isValid === true;
  });

  test('Valid: Email with plus sign', () => {
    const result = validateEmail('user+tag@example.com');
    return result.isValid === true;
  });

  test('Valid: Email with subdomain', () => {
    const result = validateEmail('user@mail.example.com');
    return result.isValid === true;
  });

  test('Error: Empty string', () => {
    const result = validateEmail('');
    return result.isValid === false && result.error.includes('required');
  });

  test('Error: Missing @ symbol', () => {
    const result = validateEmail('johndoeexample.com');
    return result.isValid === false && result.error.includes('format');
  });

  test('Error: Missing domain', () => {
    const result = validateEmail('john@');
    return result.isValid === false && result.error.includes('format');
  });

  test('Error: Missing TLD', () => {
    const result = validateEmail('john@example');
    return result.isValid === false && result.error.includes('format');
  });

  test('Error: Too long (> 255 characters)', () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const result = validateEmail(longEmail);
    return result.isValid === false && result.error.includes('255');
  });

  test('Error: Null value', () => {
    const result = validateEmail(null);
    return result.isValid === false && result.error.includes('required');
  });
}

/**
 * Number of Employees Validation Tests
 */
function testNumberOfEmployeesValidation() {
  console.log('\n👥 Testing Number of Employees Validation...');
  console.log('='.repeat(50));

  test('Valid: Minimum (1 employee)', () => {
    const result = validateNumberOfEmployees(1);
    return result.isValid === true;
  });

  test('Valid: Maximum (10000 employees)', () => {
    const result = validateNumberOfEmployees(10000);
    return result.isValid === true;
  });

  test('Valid: Middle value (50 employees)', () => {
    const result = validateNumberOfEmployees(50);
    return result.isValid === true;
  });

  test('Error: Zero employees', () => {
    const result = validateNumberOfEmployees(0);
    return result.isValid === false && result.error.includes('at least 1');
  });

  test('Error: Negative number', () => {
    const result = validateNumberOfEmployees(-5);
    return result.isValid === false && result.error.includes('at least 1');
  });

  test('Error: Too large (> 10000)', () => {
    const result = validateNumberOfEmployees(10001);
    return result.isValid === false && result.error.includes('exceed 10,000');
  });

  test('Error: Non-integer (decimal)', () => {
    const result = validateNumberOfEmployees(50.5);
    return result.isValid === false && result.error.includes('integer');
  });

  test('Error: Non-number (string)', () => {
    const result = validateNumberOfEmployees('50');
    return result.isValid === false && result.error.includes('number');
  });

  test('Error: Null value', () => {
    const result = validateNumberOfEmployees(null);
    return result.isValid === false && result.error.includes('required');
  });

  test('Error: Undefined value', () => {
    const result = validateNumberOfEmployees(undefined);
    return result.isValid === false && result.error.includes('required');
  });
}

/**
 * Currency Validation Tests
 */
function testCurrencyValidation() {
  console.log('\n💰 Testing Currency Validation...');
  console.log('='.repeat(50));

  test('Valid: ZAR currency', () => {
    const result = validateCurrency('ZAR');
    return result.isValid === true;
  });

  test('Valid: USD currency', () => {
    const result = validateCurrency('USD');
    return result.isValid === true;
  });

  test('Valid: Lowercase currency (converted)', () => {
    const result = validateCurrency('zar');
    return result.isValid === true;
  });

  test('Valid: Empty/null currency (optional)', () => {
    const result = validateCurrency(null);
    return result.isValid === true; // Optional, defaults to ZAR
  });

  test('Error: Unsupported currency (EUR)', () => {
    const result = validateCurrency('EUR');
    return result.isValid === false && result.error.includes('not supported');
  });

  test('Error: Invalid currency type', () => {
    const result = validateCurrency(123);
    return result.isValid === false && result.error.includes('string');
  });
}

/**
 * Complete Quote Validation Tests
 */
function testEnterpriseQuoteValidation() {
  console.log('\n📋 Testing Complete Quote Validation...');
  console.log('='.repeat(50));

  test('Valid: Complete valid quote data', () => {
    const data = {
      companyName: 'Acme Corporation',
      contactName: 'John Doe',
      contactEmail: 'john.doe@acme.com',
      numberOfEmployees: 50,
      currency: 'ZAR'
    };
    const result = validateEnterpriseQuote(data);
    return result.isValid === true && result.errors.length === 0;
  });

  test('Valid: Quote data without currency (defaults to ZAR)', () => {
    const data = {
      companyName: 'Acme Corporation',
      contactName: 'John Doe',
      contactEmail: 'john.doe@acme.com',
      numberOfEmployees: 50
    };
    const result = validateEnterpriseQuote(data);
    return result.isValid === true && result.errors.length === 0;
  });

  test('Error: Missing company name', () => {
    const data = {
      contactName: 'John Doe',
      contactEmail: 'john.doe@acme.com',
      numberOfEmployees: 50
    };
    const result = validateEnterpriseQuote(data);
    return result.isValid === false && result.errors.length > 0;
  });

  test('Error: Invalid email', () => {
    const data = {
      companyName: 'Acme Corporation',
      contactName: 'John Doe',
      contactEmail: 'invalid-email',
      numberOfEmployees: 50
    };
    const result = validateEnterpriseQuote(data);
    return result.isValid === false && result.errors.some(e => e.includes('email'));
  });

  test('Error: Invalid employee count', () => {
    const data = {
      companyName: 'Acme Corporation',
      contactName: 'John Doe',
      contactEmail: 'john.doe@acme.com',
      numberOfEmployees: 0
    };
    const result = validateEnterpriseQuote(data);
    return result.isValid === false && result.errors.some(e => e.includes('employee'));
  });

  test('Error: Multiple validation errors', () => {
    const data = {
      companyName: '',
      contactName: '',
      contactEmail: 'invalid',
      numberOfEmployees: -5
    };
    const result = validateEnterpriseQuote(data);
    return result.isValid === false && result.errors.length >= 3;
  });
}

/**
 * Run all Phase 1 tests
 */
async function runPhase1Tests() {
  console.log('🧪 Phase 1: Pricing & Validation Test Suite');
  console.log('='.repeat(50));
  console.log('Testing price calculation and input validation...\n');

  // Run all test suites
  testPriceCalculation();
  testCompanyNameValidation();
  testContactNameValidation();
  testEmailValidation();
  testNumberOfEmployeesValidation();
  testCurrencyValidation();
  testEnterpriseQuoteValidation();

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total: ${testsPassed + testsFailed}`);

  // Print failed tests
  if (testsFailed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults
      .filter(r => r.status === 'FAILED')
      .forEach(r => {
        console.log(`   - ${r.name}`);
        if (r.error) console.log(`     Error: ${r.error}`);
      });
  }

  // Exit with appropriate code
  if (testsFailed === 0) {
    console.log('\n🎉 All Phase 1 tests passed!');
    console.log('✅ Ready to proceed to Phase 2');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some Phase 1 tests failed.');
    console.log('❌ Fix issues before proceeding to Phase 2');
    process.exit(1);
  }
}

// Run tests
runPhase1Tests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});

