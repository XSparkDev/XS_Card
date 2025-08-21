const { exec, spawn } = require("child_process");
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8383;

let serverProcess = null;
let expoProcess = null;

function cleanup() {
    if (serverProcess) {
        serverProcess.close(() => {
            console.log('Server process terminated');
        });
    }
    if (expoProcess) {
        expoProcess.kill();
        console.log('Expo process terminated');
    }
    process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Add security headers using Helmet
app.use(helmet({
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://*.render.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));

// Static file serving if you have a build folder
app.use(express.static(path.join(__dirname, 'build')));

// Catch-all handler for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start the server
console.log('Starting server...');
serverProcess = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

serverProcess.on("error", (error) => {
    console.error(`Failed to start server: ${error}`);
    cleanup();
});

// Start Expo after a short delay (2 seconds instead of 8383ms)
setTimeout(() => {
    console.log('Starting Expo...');
    expoProcess = spawn("npx", ["expo", "start", "--clear"], {
        stdio: 'inherit',
        shell: true
    });

    expoProcess.on("error", (error) => {
        console.error(`Failed to start Expo: ${error}`);
        cleanup();
    });
}, 2000);
