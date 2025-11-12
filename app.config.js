const { getDefaultConfig } = require('expo/metro-config');

export default {
  expo: {
    name: "XSCard",
    slug: "xscard-app",
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/icons/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/icons/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.p.zzles.xscard"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon.png",
        backgroundColor: "#FFFFFF"
      },
      package: "com.p.zzles.xscard"
    },
    web: {
      favicon: "./assets/icons/favicon.png"
    },
    // Disable react-native-reanimated on Windows
    plugins: [
      [
        "expo-dev-client",
        {
          addGeneratedScheme: false
        }
      ]
    ],
    extra: {
      // Disable reanimated completely for Windows builds
      REACT_NATIVE_REANIMATED_DISABLE_AUTOLINK: "1"
    }
  }
};


