const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [];
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

config.resolver = {
  ...config.resolver,
  platforms: ['native', 'android', 'ios', 'web'],
};

module.exports = config;
