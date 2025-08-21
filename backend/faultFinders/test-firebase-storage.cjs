#!/usr/bin/env node

/**
 * Firebase Storage Connectivity Test
 * 
 * This script tests Firebase Storage connectivity and functionality.
 * It verifies that the Firebase initialization works and file operations can be performed.
 * 
 * Usage: node test-firebase-storage.cjs [options]
 * Options:
 *   --upload-test     Run an actual file upload test
 *   --cleanup         Clean up test files after running
 */
require('dotenv').config();

console.log('===============================================');
console.log('Firebase Storage Connection & Functionality Test');
console.log('===============================================');

// Create a simple test file
const fs = require('fs');
const path = require('path');
const testContent = 'Test file content generated at ' + new Date().toISOString();
const testBuffer = Buffer.from(testContent);

// Track test results
const results = {
  firebase: {
    status: 'Not started',
    details: {}
  },
  storage: {
    status: 'Not started',
    details: {}
  },
  fileOps: {
    status: 'Not started',
    details: {}
  }
};

// Main function to execute everything
async function main() {
  try {
    console.log('\n1. Testing Firebase Module Import...');
    results.firebase.status = 'Running';
    
    // Import the firebase module
    const firebase = require('../firebase');
    
    // Check what's exported
    const exports = Object.keys(firebase);
    console.log('Firebase exports:', exports.join(', '));
    results.firebase.details.exports = exports;
    
    // Check if required objects exist
    const hasDb = !!firebase.db;
    const hasAdmin = !!firebase.admin;
    const hasStorage = !!firebase.storage;
    const hasBucket = !!firebase.bucket;
    
    console.log('- Firestore DB available:', hasDb);
    console.log('- Admin SDK available:', hasAdmin);
    console.log('- Storage SDK available:', hasStorage);
    console.log('- Bucket available:', hasBucket);
    
    results.firebase.details.hasDb = hasDb;
    results.firebase.details.hasAdmin = hasAdmin;
    results.firebase.details.hasStorage = hasStorage;
    results.firebase.details.hasBucket = hasBucket;
    
    // Check if Firebase is in fallback mode
    const isUsingMockBucket = firebase.bucket?.name === 'mock-bucket';
    results.firebase.details.usingMock = isUsingMockBucket;
    
    if (isUsingMockBucket) {
      console.log('⚠️ NOTE: Using mock bucket - Firebase Storage credentials not available');
      results.firebase.status = 'Warning';
    } else if (hasBucket && hasStorage) {
      console.log('Firebase module imported successfully!');
      results.firebase.status = 'Success';
    } else {
      throw new Error('Firebase module missing required exports');
    }
    
    // Test Storage Operations
    console.log('\n2. Testing Storage Operations...');
    results.storage.status = 'Running';
    
    if (hasBucket) {
      const bucketName = firebase.bucket.name;
      console.log('Bucket name:', bucketName);
      results.storage.details.bucketName = bucketName;
      
      // Test creating a file reference
      const testFilePath = 'test-files/test-file.txt';
      const testFile = firebase.bucket.file(testFilePath);
      console.log('Test file object created:', !!testFile);
      results.storage.details.fileCreated = !!testFile;
      
      if (testFile) {
        console.log('Test file methods:', Object.keys(testFile).slice(0, 5).join(', ') + '...');
        console.log('Storage test successful!');
        results.storage.status = 'Success';
      } else {
        throw new Error('Failed to create test file reference');
      }
    } else {
      console.log('⚠️ Skipping bucket operations due to missing bucket');
      results.storage.status = 'Skipped';
    }
    
    // Test file upload operations using the utility
    console.log('\n3. Testing File Upload Utility...');
    results.fileOps.status = 'Running';
    
    const { uploadFile } = require('../utils/firebaseStorage');
    console.log('Upload function imported:', !!uploadFile);
    results.fileOps.details.uploadFunctionLoaded = !!uploadFile;
    
    // Test actual upload if requested
    const shouldTestUpload = process.argv.includes('--upload-test');
    
    if (shouldTestUpload) {
      console.log('Running actual file upload test...');
      
      const testUpload = async () => {
        try {
          const result = await uploadFile(
            testBuffer, 
            'test-firebase-storage.txt', 
            'test-user', 
            'test'
          );
          
          console.log('✅ Upload test successful!');
          console.log('Test file URL:', result);
          results.fileOps.details.uploadResult = result;
          results.fileOps.status = 'Success';
          
          // Clean up if requested
          if (process.argv.includes('--cleanup')) {
            console.log('Cleaning up test file...');
            // If it's a Firebase URL, attempt deletion
            if (result.startsWith('https://')) {
              const { deleteFile } = require('../utils/firebaseStorage');
              await deleteFile(result);
              console.log('✅ Test file deleted successfully');
            } 
            // If it's a local path, delete the local file
            else if (result.startsWith('/')) {
              const localPath = path.join(__dirname, '..', 'public', result);
              if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
                console.log('✅ Local test file deleted successfully');
              }
            }
          }
        } catch (err) {
          console.error('❌ Upload test failed:', err.message);
          results.fileOps.status = 'Failed';
          results.fileOps.details.error = err.message;
        }
      };
      
      // Run the test - this was previously a top-level await
      await testUpload();
    } else {
      console.log('⚠️ Skipping actual file upload (use --upload-test to include)');
      results.fileOps.status = 'Skipped';
    }
  } catch (error) {
    console.error('❌ Firebase Storage test failed:', error.message);
    console.error('Error details:', error);
    
    // Update results based on where the failure occurred
    if (results.firebase.status === 'Running') {
      results.firebase.status = 'Failed';
      results.firebase.details.error = error.message;
    } else if (results.storage.status === 'Running') {
      results.storage.status = 'Failed';
      results.storage.details.error = error.message;
    } else if (results.fileOps.status === 'Running') {
      results.fileOps.status = 'Failed';
      results.fileOps.details.error = error.message;
    }
  }

  // Print summary
  console.log('\n===============================================');
  console.log('Test Summary:');
  console.log('===============================================');
  console.log('Firebase Module:', results.firebase.status);
  console.log('Storage Operations:', results.storage.status);
  console.log('File Operations:', results.fileOps.status);

  console.log('\nDetailed Results:');
  console.log(JSON.stringify(results, null, 2));
  console.log('===============================================');

  // Exit with appropriate code
  const hasFailure = Object.values(results).some(r => r.status === 'Failed');
  process.exit(hasFailure ? 1 : 0);
}

// Execute the main function
main().catch(error => {
  console.error('Fatal error in main execution:', error);
  process.exit(1);
}); 