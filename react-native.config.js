module.exports = {
  dependencies: {
    'react-native-reanimated': {
      platforms: {
        android: {
          sourceDir: null, // disable Android platform
          projectDir: null, // disable Android platform
        },
        ios: null, // disable iOS platform, delete this line to enable iOS platform
      },
    },
  },
  // Completely disable autolinking for react-native-reanimated
  reactNativePath: require('path').resolve(__dirname, 'node_modules/react-native'),
  project: {
    android: {
      sourceDir: './android',
      appName: 'app',
      packageName: 'com.p.zzles.xscard',
    },
  },
};


