#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Version Adjuster - Automatically updates version numbers across all files
 * Usage: node version-adjuster.js <version> <versionCode>
 * Example: node version-adjuster.js 2.0.3 11
 */

const updateVersion = (newVersion, newVersionCode) => {
  console.log(`🚀 Updating version to ${newVersion} (code: ${newVersionCode})...`);
  
  try {
    // 1. Update package.json
    console.log('📦 Updating package.json...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    
    // 2. Update Android build.gradle
    console.log('🤖 Updating Android build.gradle...');
    const buildGradlePath = 'android/app/build.gradle';
    const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    const updatedGradle = buildGradle
      .replace(/versionCode \d+/, `versionCode ${newVersionCode}`)
      .replace(/versionName "[^"]*"/, `versionName "${newVersion}"`);
    fs.writeFileSync(buildGradlePath, updatedGradle);
    
    // 3. Update app.json (Expo/iOS)
    console.log('🍎 Updating app.json...');
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    appJson.expo.version = newVersion;
    appJson.expo.ios.buildNumber = newVersion;
    fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2));
    
    console.log('✅ All files updated successfully!');
    console.log(`📱 Version: ${newVersion}`);
    console.log(`🔢 Version Code: ${newVersionCode}`);
    
  } catch (error) {
    console.error('❌ Error updating versions:', error.message);
    process.exit(1);
  }
};

// 4. Check current versions
const checkCurrentVersions = () => {
  console.log('📋 Current versions:');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`📦 package.json: ${packageJson.version}`);
    
    const buildGradle = fs.readFileSync('android/app/build.gradle', 'utf8');
    const versionMatch = buildGradle.match(/versionName "([^"]*)"/);
    const codeMatch = buildGradle.match(/versionCode (\d+)/);
    if (versionMatch && codeMatch) {
      console.log(`🤖 build.gradle: ${versionMatch[1]} (code: ${codeMatch[1]})`);
    }
    
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    console.log(`🍎 app.json: ${appJson.expo.version}`);
    
  } catch (error) {
    console.error('❌ Error reading current versions:', error.message);
  }
};

// Main execution
const [,, version, versionCode] = process.argv;

if (version && versionCode) {
  updateVersion(version, versionCode);
} else if (version === 'check') {
  checkCurrentVersions();
} else {
  console.log('📖 Usage:');
  console.log('  node version-adjuster.js <version> <versionCode>');
  console.log('  node version-adjuster.js check');
  console.log('');
  console.log('📝 Examples:');
  console.log('  node version-adjuster.js 2.0.3 11');
  console.log('  node version-adjuster.js check');
}
