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
      backgroundColor: "#FFFFFF"
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
      REACT_NATIVE_REANIMATED_DISABLE_AUTOLINK: "1",
      // Firebase configuration for xscard-dev project
      // These values are read from environment variables at build time
      // Set them in a .env file or as system environment variables
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "xscard-dev.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "xscard-dev",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "xscard-dev.appspot.com",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
    }
  }
};


