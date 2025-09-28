const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Windows-specific configuration to avoid EPERM errors
config.server = {
  ...config.server,
  port: 8081,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Add headers to prevent file locking issues on Windows
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return middleware(req, res, next);
    };
  },
};

// Optimize for Windows file system
config.watchFolders = [];
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    // Reduce memory usage to prevent EPERM errors
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

// Resolver configuration for Windows
config.resolver = {
  ...config.resolver,
  platforms: ['native', 'android', 'ios', 'web'],
  // Reduce file system load
  useWatchman: false,
  // Exclude react-native-reanimated to avoid Windows path length issues
  blockList: [
    /node_modules\/react-native-reanimated\/.*$/,
  ],
};

module.exports = config;
