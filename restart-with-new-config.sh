#!/bin/bash

# Script to restart Expo with cleared cache after Firebase config changes

echo "🔄 Restarting Expo with cleared cache..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Please create a .env file with your Firebase configuration."
    exit 1
fi

# Verify Firebase config
echo "🔍 Verifying Firebase configuration..."
node check-firebase-config.js

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Configuration check failed. Please fix your .env file first."
    exit 1
fi

echo ""
echo "🧹 Clearing Expo cache..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

echo "✅ Cache cleared"
echo ""
echo "🚀 Starting Expo with cleared cache..."
echo "   (Press Ctrl+C to stop)"
echo ""

# Start Expo with cleared cache
npx expo start --clear

