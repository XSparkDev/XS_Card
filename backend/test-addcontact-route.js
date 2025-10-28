#!/usr/bin/env node
/**
 * CRITICAL: This test ensures AddContact endpoint NEVER breaks
 * Run this before any deployment: node test-addcontact-route.js
 */

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://192.168.68.113:8383';
const TEST_USER_ID = 'yR9TvgtUsqND6RwZuRQ0ArJF9653';

function parseUrl(url) {
  const urlObj = new URL(url);
  return {
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname
  };
}

async function testAddContact() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      userId: TEST_USER_ID,
      contactInfo: {
        name: 'Test',
        surname: 'Route',
        phone: '+1234567890',
        email: `test-${Date.now()}@example.com`,
        company: 'Test Co',
        howWeMet: 'Automated Test'
      }
    });

    const urlParts = parseUrl(API_BASE);
    
    const options = {
      hostname: urlParts.hostname,
      port: urlParts.port,
      method: 'POST',
      path: '/AddContact',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`Testing AddContact endpoint at ${options.hostname}:${options.port}${options.path}...`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const success = res.statusCode === 201 || res.statusCode === 200;
        if (success) {
          console.log('✅ AddContact endpoint is working!');
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response: Contact added successfully`);
          resolve({ success: true, status: res.statusCode, data });
        } else {
          console.log('❌ AddContact endpoint FAILED!');
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}`);
          reject({ success: false, status: res.statusCode, data });
        }
      });
    });

    req.on('error', (e) => {
      console.log(`❌ Connection failed: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

testAddContact()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
