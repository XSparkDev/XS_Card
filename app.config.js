const { getDefaultConfig } = require('expo/metro-config');

export default {
  expo: {
    name: "XSCard",
    slug: "xscard-app",
    version: "2.0.3",
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
    plugins: [],
    extra: {
      // Disable reanimated completely for Windows builds
      REACT_NATIVE_REANIMATED_DISABLE_AUTOLINK: "1",
      // Firebase configuration is read from environment variables at build time.
      // Keep production-safe defaults aligned with backend (xscard-addd4) so
      // debug builds do not silently point at an incompatible Firebase project.
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "xscard-addd4.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "xscard-addd4",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "xscard-addd4.firebasestorage.app",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || "https://baseurl.xscard.co.za",
      eas: {
        projectId: "4235e235-536e-42af-8c32-5fb9508a7ab1"
      }
    }
  }
};


