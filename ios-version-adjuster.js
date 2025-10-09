#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * iOS Version Adjuster - Automatically updates iOS version numbers
 * Usage: node ios-version-adjuster.js <version> <buildNumber>
 * Example: node ios-version-adjuster.js 2.0.3 11
 */

const updateIOSVersion = (newVersion, newBuildNumber) => {
  console.log(`🍎 Updating iOS version to ${newVersion} (build: ${newBuildNumber})...`);
  
  try {
    // 1. Update app.json (iOS specific)
    console.log('📱 Updating app.json for iOS...');
    const appJsonPath = 'app.json';
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    
    // Update expo version and iOS buildNumber
    appJson.expo.version = newVersion;
    appJson.expo.ios.buildNumber = String(newBuildNumber);
    
    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
    
    // 2. Optionally update package.json
    console.log('📦 Updating package.json...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log('✅ iOS version files updated successfully!');
    console.log(`📱 Version: ${newVersion}`);
    console.log(`🔢 Build Number: ${newBuildNumber}`);
    
    // Automatically stage and commit the changes
    console.log('');
    console.log('📝 Staging and committing changes...');
    
    const { execSync } = require('child_process');
    
    try {
      // Stage the version files
      execSync('git add package.json app.json', { stdio: 'inherit' });
      
      // Commit with version bump message
      execSync(`git commit -m "🍎 Bump iOS version to ${newVersion} (${newBuildNumber})"`, { stdio: 'inherit' });
      
      console.log('✅ iOS version changes committed successfully!');
      console.log('');
      console.log('🚀 Next steps:');
      console.log('   1. git push origin qa');
      console.log('   2. cd ios && pod install (if needed)');
      console.log('   3. Build iOS app with Xcode or EAS');
      
    } catch (gitError) {
      console.error('❌ Error committing changes:', gitError.message);
      console.log('📝 You may need to commit manually:');
      console.log('   git add package.json app.json');
      console.log(`   git commit -m "🍎 Bump iOS version to ${newVersion} (${newBuildNumber})"`);
    }
    
  } catch (error) {
    console.error('❌ Error updating iOS versions:', error.message);
    process.exit(1);
  }
};

// Check current iOS versions
const checkCurrentVersions = () => {
  console.log('📋 Current iOS versions:');
  console.log('');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`📦 package.json version: ${packageJson.version}`);
    
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    console.log(`🍎 app.json expo.version: ${appJson.expo.version}`);
    console.log(`🔢 app.json ios.buildNumber: ${appJson.expo.ios.buildNumber}`);
    
    console.log('');
    console.log('💡 Tip: iOS buildNumber must increment for each TestFlight/App Store upload');
    
  } catch (error) {
    console.error('❌ Error reading current versions:', error.message);
  }
};

// Increment build number helper
const incrementBuildNumber = () => {
  try {
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    const currentBuildNumber = parseInt(appJson.expo.ios.buildNumber) || 0;
    const newBuildNumber = currentBuildNumber + 1;
    const currentVersion = appJson.expo.version;
    
    console.log(`📈 Incrementing build number from ${currentBuildNumber} to ${newBuildNumber}`);
    console.log(`📱 Keeping version: ${currentVersion}`);
    console.log('');
    
    updateIOSVersion(currentVersion, newBuildNumber);
    
  } catch (error) {
    console.error('❌ Error incrementing build number:', error.message);
    process.exit(1);
  }
};

// Main execution
const [,, command, buildNumber] = process.argv;

if (command === 'check') {
  checkCurrentVersions();
} else if (command === 'increment') {
  incrementBuildNumber();
} else if (command && buildNumber) {
  updateIOSVersion(command, buildNumber);
} else {
  console.log('📖 iOS Version Adjuster');
  console.log('');
  console.log('Usage:');
  console.log('  node ios-version-adjuster.js <version> <buildNumber>');
  console.log('  node ios-version-adjuster.js increment');
  console.log('  node ios-version-adjuster.js check');
  console.log('');
  console.log('📝 Examples:');
  console.log('  node ios-version-adjuster.js 2.0.3 11    # Set specific version and build');
  console.log('  node ios-version-adjuster.js increment   # Auto-increment build number');
  console.log('  node ios-version-adjuster.js check       # View current versions');
  console.log('');
  console.log('💡 Tips:');
  console.log('  - Use "increment" for quick TestFlight builds');
  console.log('  - Build number must increase for each App Store upload');
  console.log('  - Version format: MAJOR.MINOR.PATCH (e.g., 2.0.3)');
}

