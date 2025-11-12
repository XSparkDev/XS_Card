/**
 * Debug webhook to see what headers RevenueCat is sending
 */

const express = require('express');
const app = express();

// Middleware to log all headers
app.use((req, res, next) => {
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    console.log('===================');
    next();
});

// Parse JSON bodies
app.use(express.json());

// Webhook endpoint
app.post('/api/revenuecat/webhook', (req, res) => {
    console.log('Webhook received!');
    res.json({ success: true, message: 'Webhook received successfully' });
});

// Start debug server
const port = 8384;
app.listen(port, () => {
    console.log(`🔍 Debug webhook server running on port ${port}`);
    console.log(`📡 Test URL: http://localhost:${port}/api/revenuecat/webhook`);
    console.log('📋 This will show you exactly what headers RevenueCat sends');
});
