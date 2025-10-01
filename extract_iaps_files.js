const { execSync } = require('child_process');
const fs = require('fs');

// Files to extract from iaps branch
const filesToExtract = [
  'src/services/revenueCatService.ts',
  'src/utils/paymentPlatform.ts',
  'backend/controllers/subscriptionController.js',
  'backend/routes/subscriptionRoutes.js'
];

console.log('Extracting files from iaps branch...');

filesToExtract.forEach(file => {
  try {
    // Get the file content from iaps branch
    const content = execSync(`git show origin/iaps:${file}`, { encoding: 'utf8' });
    
    // Create a copy with -original suffix
    const originalFile = file.replace('.', '-original.');
    fs.writeFileSync(originalFile, content);
    
    console.log(`✅ Extracted: ${file} -> ${originalFile}`);
  } catch (error) {
    console.log(`❌ Failed to extract: ${file} - ${error.message}`);
  }
});

console.log('Done!');
