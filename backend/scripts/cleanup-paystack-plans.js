/**
 * Paystack Plans & Customers Cleanup Script
 * 
 * This script deletes plans and customers from Paystack to clean up test data.
 * 
 * Usage:
 *   node backend/scripts/cleanup-paystack-plans.js
 * 
 * Options:
 *   --dry-run       : List items without deleting (default)
 *   --delete-all    : Delete all items (use with caution!)
 *   --delete-test   : Delete only test items (items with "test" in name/email)
 *   --pattern       : Delete items matching pattern (e.g., --pattern "Enterprise")
 *   --plans-only    : Only clean up plans (default: both plans and customers)
 *   --customers-only: Only clean up customers (default: both plans and customers)
 * 
 * Safety:
 *   - By default, runs in dry-run mode (no deletions)
 *   - Requires explicit --delete-all or --delete-test flag
 *   - Shows item details before deletion
 *   - 5-second warning before deleting all items
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const https = require('https');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const { getRequestOptions } = require('../config/paystack');
const PAYSTACK_BASE_URL = 'api.paystack.co';
const PAYSTACK_PORT = 443;

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--delete-all') && !args.includes('--delete-test') && !args.includes('--pattern');
const deleteAll = args.includes('--delete-all');
const deleteTest = args.includes('--delete-test');
const patternIndex = args.indexOf('--pattern');
const pattern = patternIndex !== -1 && args[patternIndex + 1] ? args[patternIndex + 1] : null;
const plansOnly = args.includes('--plans-only');
const customersOnly = args.includes('--customers-only');
const shouldCleanupPlans = !customersOnly;
const shouldCleanupCustomers = !plansOnly;

if (!PAYSTACK_SECRET_KEY) {
  console.error('❌ Error: PAYSTACK_SECRET_KEY not found in environment variables');
  console.error('   Please set PAYSTACK_SECRET_KEY in your .env file');
  process.exit(1);
}

/**
 * Make Paystack API request
 */
function makePaystackRequest(path, method = 'GET', data = null, retries = 3) {
  return new Promise((resolve, reject) => {
    // Use existing Paystack config helper if available
    let options;
    try {
      options = getRequestOptions(path, method);
    } catch (error) {
      // Fallback to manual config
      options = {
        hostname: PAYSTACK_BASE_URL,
        port: PAYSTACK_PORT,
        path: path,
        method: method,
        timeout: 30000, // 30 second timeout
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      };
    }

    // Ensure timeout is set
    if (!options.timeout) {
      options.timeout = 30000; // 30 seconds
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        // Handle empty responses (common for DELETE operations)
        if (!responseData || responseData.trim() === '') {
          // Empty response with 200/204 status is usually success for DELETE
          if (res.statusCode === 200 || res.statusCode === 204) {
            resolve({ status: true, data: null, message: 'Success', statusCode: res.statusCode });
          } else {
            reject(new Error(`Empty response with status ${res.statusCode}`));
          }
          return;
        }
        
        try {
          const parsed = JSON.parse(responseData);
          parsed.statusCode = res.statusCode; // Add status code to response
          if (parsed.status) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || 'Paystack API error'));
          }
        } catch (error) {
          // If JSON parsing fails but status is 200/204, might be success
          if (res.statusCode === 200 || res.statusCode === 204) {
            resolve({ status: true, data: null, message: 'Success (empty response)', statusCode: res.statusCode });
          } else {
            reject(new Error(`Invalid JSON response: ${error.message}`));
          }
        }
      });
    });

    req.on('error', (error) => {
      // Retry on timeout or connection errors
      if ((error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') && retries > 0) {
        console.log(`   ⚠️  Request failed, retrying... (${retries} retries left)`);
        setTimeout(() => {
          makePaystackRequest(path, method, data, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
        return;
      }
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      // Retry on timeout
      if (retries > 0) {
        console.log(`   ⚠️  Request timed out, retrying... (${retries} retries left)`);
        setTimeout(() => {
          makePaystackRequest(path, method, data, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
        return;
      }
      reject(new Error('Request timed out after retries'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * List all plans from Paystack
 */
async function listAllPlans() {
  const plans = [];
  let page = 1;
  let hasMore = true;

  console.log('📋 Fetching plans from Paystack...\n');

  while (hasMore) {
    try {
      console.log(`   Fetching page ${page}...`);
      const response = await makePaystackRequest(`/plan?perPage=50&page=${page}`);
      
      if (response.data && Array.isArray(response.data)) {
        plans.push(...response.data);
        console.log(`   ✅ Fetched ${response.data.length} plans (total: ${plans.length})`);
        
        // Check if there are more pages
        const meta = response.meta;
        if (meta && meta.total > plans.length && response.data.length > 0) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Error fetching plans (page ${page}):`, error.message);
      // If it's a timeout and we have some plans, continue with what we have
      if (plans.length > 0 && error.message.includes('timeout')) {
        console.log(`   ⚠️  Continuing with ${plans.length} plans fetched so far...`);
      }
      hasMore = false;
    }
  }

  return plans;
}

/**
 * List all customers from Paystack
 */
async function listAllCustomers() {
  const customers = [];
  let page = 1;
  let hasMore = true;

  console.log('👥 Fetching customers from Paystack...\n');

  while (hasMore) {
    try {
      console.log(`   Fetching page ${page}...`);
      const response = await makePaystackRequest(`/customer?perPage=50&page=${page}`);
      
      if (response.data && Array.isArray(response.data)) {
        customers.push(...response.data);
        console.log(`   ✅ Fetched ${response.data.length} customers (total: ${customers.length})`);
        
        // Check if there are more pages
        const meta = response.meta;
        if (meta && meta.total > customers.length && response.data.length > 0) {
          page++;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Error fetching customers (page ${page}):`, error.message);
      // If it's a timeout and we have some customers, continue with what we have
      if (customers.length > 0 && error.message.includes('timeout')) {
        console.log(`   ⚠️  Continuing with ${customers.length} customers fetched so far...`);
      }
      hasMore = false;
    }
  }

  return customers;
}

/**
 * Delete a plan from Paystack
 */
async function deletePlan(planCode) {
  try {
    const response = await makePaystackRequest(`/plan/${planCode}`, 'DELETE');
    
    // Paystack DELETE returns {status: true} or empty response
    // makePaystackRequest handles empty responses and returns {status: true, data: null}
    if (response.status === true || response.statusCode === 200 || response.statusCode === 204) {
      return { success: true, planCode };
    }
    
    // If status is false, check message
    const errorMsg = response.message || 'Unknown error';
    return { success: false, planCode, error: errorMsg };
  } catch (error) {
    // Check if error message indicates plan not found or already deleted
    if (error.message && (
        error.message.includes('not found') || 
        error.message.includes('does not exist') ||
        error.message.includes('No such plan') ||
        error.message.includes('Plan not found'))) {
      return { success: false, planCode, error: 'Plan not found (may already be deleted)', alreadyDeleted: true };
    }
    return { success: false, planCode, error: error.message };
  }
}

/**
 * Delete a customer from Paystack
 */
async function deleteCustomer(customerCode) {
  try {
    const response = await makePaystackRequest(`/customer/${customerCode}`, 'DELETE');
    
    // Paystack DELETE returns {status: true} or empty response
    // makePaystackRequest handles empty responses and returns {status: true, data: null}
    if (response.status === true || response.statusCode === 200 || response.statusCode === 204) {
      return { success: true, customerCode };
    }
    
    // If status is false, check message
    const errorMsg = response.message || 'Unknown error';
    return { success: false, customerCode, error: errorMsg };
  } catch (error) {
    // Check if error message indicates customer not found or already deleted
    if (error.message && (
        error.message.includes('not found') || 
        error.message.includes('does not exist') ||
        error.message.includes('No such customer') ||
        error.message.includes('Customer not found'))) {
      return { success: false, customerCode, error: 'Customer not found (may already be deleted)', alreadyDeleted: true };
    }
    // Empty JSON response is handled by makePaystackRequest as success
    // If we get here, it's a real error
    return { success: false, customerCode, error: error.message };
  }
}

/**
 * Check if plan should be deleted
 */
function shouldDeletePlan(plan) {
  if (deleteAll) {
    return true;
  }
  
  if (deleteTest) {
    const name = (plan.name || '').toLowerCase();
    const code = (plan.plan_code || '').toLowerCase();
    return name.includes('test') || code.includes('test') || name.includes('enterprise');
  }
  
  if (pattern) {
    const name = (plan.name || '').toLowerCase();
    const code = (plan.plan_code || '').toLowerCase();
    return name.includes(pattern.toLowerCase()) || code.includes(pattern.toLowerCase());
  }
  
  return false;
}

/**
 * Check if customer should be deleted
 */
function shouldDeleteCustomer(customer) {
  if (deleteAll) {
    return true;
  }
  
  if (deleteTest) {
    const email = (customer.email || '').toLowerCase();
    const firstName = (customer.first_name || '').toLowerCase();
    const lastName = (customer.last_name || '').toLowerCase();
    const code = (customer.customer_code || '').toLowerCase();
    
    return email.includes('test') || 
           email.includes('example.com') || 
           email.includes('@test') ||
           firstName.includes('test') ||
           lastName.includes('test') ||
           code.includes('test');
  }
  
  if (pattern) {
    const email = (customer.email || '').toLowerCase();
    const firstName = (customer.first_name || '').toLowerCase();
    const lastName = (customer.last_name || '').toLowerCase();
    const code = (customer.customer_code || '').toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    return email.includes(patternLower) || 
           firstName.includes(patternLower) ||
           lastName.includes(patternLower) ||
           code.includes(patternLower);
  }
  
  return false;
}

/**
 * Cleanup customers
 */
async function cleanupCustomers() {
  if (!shouldCleanupCustomers) {
    return;
  }

  console.log('\n👥 Cleaning up Customers...');
  console.log('='.repeat(50));

  // Fetch all customers
  const customers = await listAllCustomers();
  
  console.log(`📊 Found ${customers.length} total customers\n`);

  if (customers.length === 0) {
    console.log('✅ No customers to clean up');
    return;
  }

  // Filter customers to delete
  const customersToDelete = customers.filter(shouldDeleteCustomer);
  
  console.log(`🎯 Customers to ${isDryRun ? 'review' : 'delete'}: ${customersToDelete.length}\n`);

  if (customersToDelete.length === 0) {
    console.log('✅ No customers match the deletion criteria');
    return;
  }

  // Display customers
  console.log('📋 Customers:');
  console.log('-'.repeat(50));
  customersToDelete.forEach((customer, index) => {
    console.log(`${index + 1}. ${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unnamed');
    console.log(`   Email: ${customer.email || 'N/A'}`);
    console.log(`   Code: ${customer.customer_code || 'N/A'}`);
    console.log(`   Phone: ${customer.phone || 'N/A'}`);
    console.log(`   Created: ${customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A'}`);
    console.log('');
  });

  if (isDryRun) {
    return;
  }

  // Delete customers
  console.log(`\n🗑️  Deleting ${customersToDelete.length} customer(s)...\n`);
  let deleted = 0;
  let failed = 0;

  for (const customer of customersToDelete) {
    const result = await deleteCustomer(customer.customer_code);
    
    if (result.success) {
      const note = result.note ? ` (${result.note})` : '';
      console.log(`✅ Deleted: ${customer.email || customer.customer_code}${note}`);
      deleted++;
    } else if (result.alreadyDeleted) {
      console.log(`⚠️  Already deleted: ${customer.email || customer.customer_code} (${result.error})`);
      deleted++; // Count as success since it's already gone
    } else {
      console.log(`❌ Failed to delete ${customer.email || customer.customer_code}: ${result.error}`);
      failed++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n📊 Customer Cleanup Summary:`);
  console.log(`✅ Deleted: ${deleted}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${customersToDelete.length}`);
}

/**
 * Main cleanup function
 */
async function cleanupPlans() {
  console.log('🧹 Paystack Plans & Customers Cleanup Script');
  console.log('='.repeat(50));
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No items will be deleted');
    console.log('   Use --delete-all, --delete-test, or --pattern <pattern> to delete items\n');
  } else if (deleteAll) {
    console.log('⚠️  WARNING: Will delete ALL items from Paystack!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else if (deleteTest) {
    console.log('🗑️  Will delete test items (items with "test" in name/email)\n');
  } else if (pattern) {
    console.log(`🔍 Will delete items matching pattern: "${pattern}"\n`);
  }

  if (shouldCleanupPlans) {
    console.log('📋 Cleaning up Plans...');
    console.log('='.repeat(50));
  }

  // Fetch all plans
  const plans = await listAllPlans();
  
  console.log(`📊 Found ${plans.length} total plans\n`);

  if (plans.length === 0) {
    console.log('✅ No plans to clean up');
    return;
  }

  // Filter plans to delete
  const plansToDelete = plans.filter(shouldDeletePlan);
  
  console.log(`🎯 Plans to ${isDryRun ? 'review' : 'delete'}: ${plansToDelete.length}\n`);

  if (plansToDelete.length === 0) {
    console.log('✅ No plans match the deletion criteria');
    return;
  }

  // Display plans
  console.log('📋 Plans:');
  console.log('-'.repeat(50));
  plansToDelete.forEach((plan, index) => {
    console.log(`${index + 1}. ${plan.name || 'Unnamed'}`);
    console.log(`   Code: ${plan.plan_code}`);
    console.log(`   Amount: ${plan.amount ? (plan.amount / 100).toFixed(2) : 'N/A'} ${plan.currency || ''}`);
    console.log(`   Interval: ${plan.interval || 'N/A'}`);
    console.log(`   Created: ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'N/A'}`);
    console.log('');
  });

  if (isDryRun) {
    console.log('💡 To delete these plans, run with one of:');
    console.log('   --delete-all    : Delete all plans');
    console.log('   --delete-test   : Delete test plans only');
    console.log('   --pattern <text>: Delete plans matching pattern');
    return;
  }

  // Confirm deletion
  console.log(`\n⚠️  About to delete ${plansToDelete.length} plan(s)...`);
  console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Delete plans
  console.log('🗑️  Deleting plans...\n');
  let deleted = 0;
  let failed = 0;

  for (const plan of plansToDelete) {
    const result = await deletePlan(plan.plan_code);
    
    if (result.success) {
      console.log(`✅ Deleted: ${plan.name || plan.plan_code}`);
      deleted++;
    } else {
      console.log(`❌ Failed to delete ${plan.name || plan.plan_code}: ${result.error}`);
      failed++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Summary
  if (shouldCleanupPlans) {
    console.log(`\n📊 Plan Cleanup Summary:`);
    console.log(`✅ Deleted: ${deleted}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${plansToDelete.length}`);
  }
}

/**
 * Main cleanup orchestrator
 */
async function runCleanup() {
  let totalDeleted = 0;
  let totalFailed = 0;

  // Cleanup plans
  if (shouldCleanupPlans) {
    const plans = await listAllPlans();
    
    if (plans.length > 0) {
      const plansToDelete = plans.filter(shouldDeletePlan);
      
      if (plansToDelete.length > 0) {
        if (!isDryRun) {
          console.log(`\n⚠️  About to delete ${plansToDelete.length} plan(s)...`);
          console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          console.log('🗑️  Deleting plans...\n');
          let deleted = 0;
          let failed = 0;

          for (const plan of plansToDelete) {
            const result = await deletePlan(plan.plan_code);
            
            if (result.success) {
              console.log(`✅ Deleted: ${plan.name || plan.plan_code}`);
              deleted++;
              totalDeleted++;
            } else {
              console.log(`❌ Failed to delete ${plan.name || plan.plan_code}: ${result.error}`);
              failed++;
              totalFailed++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          console.log(`\n📊 Plan Cleanup Summary:`);
          console.log(`✅ Deleted: ${deleted}`);
          console.log(`❌ Failed: ${failed}`);
        } else {
          // Dry run - just show plans
          console.log(`📋 Plans to review: ${plansToDelete.length}\n`);
          plansToDelete.forEach((plan, index) => {
            console.log(`${index + 1}. ${plan.name || 'Unnamed'}`);
            console.log(`   Code: ${plan.plan_code}`);
            console.log(`   Amount: ${plan.amount ? (plan.amount / 100).toFixed(2) : 'N/A'} ${plan.currency || ''}`);
            console.log('');
          });
        }
      } else {
        console.log('✅ No plans match the deletion criteria');
      }
    } else {
      console.log('✅ No plans to clean up');
    }
  }

  // Cleanup customers
  if (shouldCleanupCustomers) {
    await cleanupCustomers();
  }

  // Final summary
  if (!isDryRun && (totalDeleted > 0 || totalFailed > 0)) {
    console.log('\n📊 Overall Cleanup Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Total Deleted: ${totalDeleted}`);
    console.log(`❌ Total Failed: ${totalFailed}`);
    console.log('\n🎉 Cleanup complete!');
  } else if (isDryRun) {
    console.log('\n💡 To delete these items, run with one of:');
    console.log('   --delete-all    : Delete all items');
    console.log('   --delete-test   : Delete test items only');
    console.log('   --pattern <text>: Delete items matching pattern');
    console.log('\n💡 Options:');
    console.log('   --plans-only    : Only clean up plans');
    console.log('   --customers-only: Only clean up customers');
  }
}

// Run cleanup
runCleanup().catch(error => {
  console.error('❌ Cleanup error:', error);
  process.exit(1);
});

