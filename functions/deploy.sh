#!/bin/bash

# Firebase Functions Deployment Script
# This script helps deploy the cron job function

echo "🚀 Deploying Firebase Cloud Functions..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Run: firebase login"
    exit 1
fi

echo "📦 Installing dependencies..."
cd functions
npm install
cd ..

echo ""
echo "🔧 Setting up environment variables..."
echo "Make sure you've set Firebase Functions config:"
echo "  firebase functions:config:set email.host=\"your-host\""
echo "  firebase functions:config:set email.user=\"your-user\""
echo "  firebase functions:config:set email.password=\"your-password\""
echo "  firebase functions:config:set email.test_to=\"test@example.com\""
echo ""
read -p "Press Enter to continue with deployment..."

echo ""
echo "🚀 Deploying function..."
firebase deploy --only functions:sampleCronJob

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 View logs with: firebase functions:log --only sampleCronJob"
echo "🗑️  Delete function with: firebase functions:delete sampleCronJob"
