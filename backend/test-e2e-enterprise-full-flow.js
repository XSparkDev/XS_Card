/**
 * E2E: Enterprise full flow (Quote → Pay → Enterprise → Admin → Departments & Teams)
 *
 * Modes:
 * 1) Departments/teams only: Set E2E_ENTERPRISE_ID, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 *    → Signs in and runs Group 2 API tests (departments, teams, employees).
 * 2) Quote + init only: Set E2E_CREATE_QUOTE=1 (and optionally leave admin env unset)
 *    → Creates quote, inits payment, prints payment URL and next steps.
 *
 * Prerequisites: Server running (default http://localhost:8383).
 *
 * Usage:
 *   node test-e2e-enterprise-full-flow.js
 *   # Or with env:
 *   E2E_ENTERPRISE_ID=ent_xxx E2E_ADMIN_EMAIL=admin@example.com E2E_ADMIN_PASSWORD=secret node test-e2e-enterprise-full-flow.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const http = require('http');
const https = require('https');

const BASE_URL = process.env.API_BASE || 'http://localhost:8383';

const E2E_ENTERPRISE_ID = process.env.E2E_ENTERPRISE_ID;
const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const E2E_CREATE_QUOTE = process.env.E2E_CREATE_QUOTE === '1' || process.env.E2E_CREATE_QUOTE === 'true';

let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

function parseUrl(url) {
  const u = new URL(url);
  return {
    hostname: u.hostname,
    port: u.port || (u.protocol === 'https:' ? 443 : 80),
    path: u.pathname + u.search,
    protocol: u.protocol
  };
}

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = path.startsWith('http') ? path : BASE_URL + path;
    const { hostname, port, path: requestPath, protocol } = parseUrl(url);
    const isHttps = protocol === 'https:';
    const postData = data ? JSON.stringify(data) : null;
    const defaultHeaders = { 'Content-Type': 'application/json', ...headers };
    if (postData) defaultHeaders['Content-Length'] = Buffer.byteLength(postData);

    const options = { hostname, port: port || (isHttps ? 443 : 80), path: requestPath, method, headers: defaultHeaders };
    const lib = isHttps ? https : http;

    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = body ? JSON.parse(body) : null; } catch (_) { parsed = body; }
        resolve({ statusCode: res.statusCode, body: parsed, raw: body });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function test(name, fn) {
  try {
    const ok = await fn();
    if (ok === true || (ok && ok.success === true)) {
      testsPassed++;
      testResults.push({ name, status: 'PASSED' });
      console.log(`✅ ${name}`);
      return true;
    }
    testsFailed++;
    testResults.push({ name, status: 'FAILED', error: ok?.error || ok });
    console.log(`❌ ${name}`);
    if (ok?.error) console.log(`   ${ok.error}`);
    return false;
  } catch (e) {
    testsFailed++;
    testResults.push({ name, status: 'FAILED', error: e.message });
    console.log(`❌ ${name}`);
    console.log(`   ${e.message}`);
    return false;
  }
}

async function runQuoteAndInit() {
  console.log('\n📝 Creating quote and initializing payment...\n');
  const quotePayload = {
    companyName: `E2E Full Flow ${Date.now()}`,
    contactName: 'E2E Contact',
    contactEmail: process.env.TEST_EMAIL || `e2e.${Date.now()}@example.com`,
    numberOfEmployees: 50,
    currency: 'ZAR'
  };
  const quoteRes = await makeRequest('POST', '/api/enterprise/quote', quotePayload);
  if (quoteRes.statusCode !== 201 || !quoteRes.body?.quote?.quoteId) {
    console.error('Quote failed:', quoteRes.statusCode, quoteRes.body);
    return;
  }
  const quoteId = quoteRes.body.quote.quoteId;
  const enterpriseId = `ent_${quoteId}`;
  console.log('Quote created:', quoteId);

  const initRes = await makeRequest('POST', '/api/enterprise/payment/initialize', { quoteId });
  if (initRes.statusCode !== 200 || !initRes.body?.paymentUrl) {
    console.error('Init failed:', initRes.statusCode, initRes.body);
    return;
  }
  const paymentUrl = initRes.body.paymentUrl;
  const ref = initRes.body.paymentReference || '';

  console.log('\n--- Next steps (manual) ---');
  console.log('1. Complete payment:', paymentUrl);
  console.log('2. Callback will create enterprise. Enterprise ID:', enterpriseId);
  console.log('3. Create admin: open', `${BASE_URL.replace(/\/$/, '')}/enterprise-registration.html?enterpriseId=${encodeURIComponent(enterpriseId)}&enterpriseName=E2E`);
  console.log('   Or: POST /AddUser with body: { name, surname, email, password, enterpriseId: "' + enterpriseId + '" }');
  console.log('4. Set env and re-run this script to test departments/teams:');
  console.log(`   E2E_ENTERPRISE_ID=${enterpriseId} E2E_ADMIN_EMAIL=<your admin email> E2E_ADMIN_PASSWORD=<password> node test-e2e-enterprise-full-flow.js`);
  if (ref) console.log('   (Payment reference:', ref, ')');
  console.log('');
}

async function signIn() {
  const res = await makeRequest('POST', '/SignIn', { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD });
  if (res.statusCode !== 200 || !res.body?.token) {
    throw new Error(res.body?.message || res.body?.error || `SignIn ${res.statusCode}`);
  }
  return res.body.token;
}

async function runDepartmentTeamTests(token) {
  const authHeaders = { Authorization: `Bearer ${token}` };
  const base = `/api/enterprise/${E2E_ENTERPRISE_ID}`;
  let departmentId, teamId, employeeId;

  await test('GET /departments (list)', async () => {
    const r = await makeRequest('GET', `${base}/departments`, null, authHeaders);
    if (r.statusCode !== 200) return { success: false, error: r.statusCode + ' ' + JSON.stringify(r.body) };
    return Array.isArray(r.body) || (r.body && Array.isArray(r.body.departments));
  });

  await test('POST /departments (create)', async () => {
    const r = await makeRequest('POST', `${base}/departments`, { name: 'E2E Dept', description: 'E2E test' }, authHeaders);
    if (r.statusCode !== 201 && r.statusCode !== 200) return { success: false, error: r.statusCode + ' ' + JSON.stringify(r.body) };
    departmentId = r.body?.department?.id || r.body?.department?.departmentId || r.body?.id || r.body?.departmentId;
    return !!departmentId;
  });

  if (!departmentId) {
    console.log('⚠️  Skipping team/employee tests (no departmentId)');
    return;
  }

  await test('GET /departments/:id', async () => {
    const r = await makeRequest('GET', `${base}/departments/${departmentId}`, null, authHeaders);
    return r.statusCode === 200;
  });

  await test('GET /departments/:id/employees', async () => {
    const r = await makeRequest('GET', `${base}/departments/${departmentId}/employees`, null, authHeaders);
    return r.statusCode === 200;
  });

  await test('POST /departments/:id/teams (create team)', async () => {
    const r = await makeRequest('POST', `${base}/departments/${departmentId}/teams`, { name: 'E2E Team', description: 'E2E' }, authHeaders);
    if (r.statusCode !== 201 && r.statusCode !== 200) return { success: false, error: r.statusCode + ' ' + JSON.stringify(r.body) };
    teamId = r.body?.team?.id || r.body?.team?.teamId || r.body?.id || r.body?.teamId;
    return !!teamId;
  });

  if (teamId) {
    await test('GET /departments/:id/teams/:teamId/members', async () => {
      const r = await makeRequest('GET', `${base}/departments/${departmentId}/teams/${teamId}/members`, null, authHeaders);
      return r.statusCode === 200;
    });
  }

  await test('GET /employees (all enterprise)', async () => {
    const r = await makeRequest('GET', `${base}/employees`, null, authHeaders);
    return r.statusCode === 200;
  });

  await test('GET /cards (all enterprise)', async () => {
    const r = await makeRequest('GET', `${base}/cards`, null, authHeaders);
    return r.statusCode === 200;
  });
}

async function main() {
  console.log('E2E Enterprise Full Flow (Quote → Pay → Enterprise → Admin → Departments & Teams)');
  console.log('Base URL:', BASE_URL);

  if (E2E_CREATE_QUOTE || (!E2E_ENTERPRISE_ID && !E2E_ADMIN_EMAIL)) {
    await runQuoteAndInit();
    if (!E2E_ENTERPRISE_ID || !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD) {
      console.log('Set E2E_ENTERPRISE_ID, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD to run department/team tests.');
      process.exit(0);
      return;
    }
  }

  if (!E2E_ENTERPRISE_ID || !E2E_ADMIN_EMAIL || !E2E_ADMIN_PASSWORD) {
    console.log('Usage: Set E2E_ENTERPRISE_ID, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD to test departments/teams.');
    console.log('Or set E2E_CREATE_QUOTE=1 to only create quote and init payment.');
    process.exit(1);
    return;
  }

  console.log('\n🔐 Sign in and run Group 2 (departments/teams) tests...\n');
  let token;
  try {
    token = await signIn();
  } catch (e) {
    console.error('Sign in failed:', e.message);
    process.exit(1);
  }

  await runDepartmentTeamTests(token);

  console.log('\n📊 Summary: ' + testsPassed + ' passed, ' + testsFailed + ' failed');
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
