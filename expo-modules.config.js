module.exports = {
  // Completely disable react-native-reanimated
  exclude: [
    'react-native-reanimated'
  ],
  // Only include the modules we actually need
  include: [
    '@react-native-async-storage/async-storage',
    '@react-native-community/datetimepicker',
    '@react-native-community/slider',
    'react-native-gesture-handler',
    'react-native-image-picker',
    'react-native-safe-area-context',
    'react-native-screens',
    'react-native-svg',
    'react-native-webview'
  ]
};
