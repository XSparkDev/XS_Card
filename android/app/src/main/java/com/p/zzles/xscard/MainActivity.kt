package com.p.zzles.xscard

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    
    // Enable edge-to-edge for Android 15+ (SDK 35+)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
      enableEdgeToEdge()
    } else {
      // Hide system navigation bar for older versions
      hideSystemNavigationBar()
    }
  }
  
  private fun enableEdgeToEdge() {
    // Enable edge-to-edge display for Android 15+
    WindowCompat.setDecorFitsSystemWindows(window, false)
    
    // Handle system bars appearance
    val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)
    windowInsetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    
    // Make status bar and navigation bar transparent
    window.statusBarColor = android.graphics.Color.TRANSPARENT
    window.navigationBarColor = android.graphics.Color.TRANSPARENT
  }
  
  private fun hideSystemNavigationBar() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      // Hide only the navigation bar, keep status bar visible
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      )
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
   * Align the back button behavior with Android S
   * where moving root activities to background instead of finishing activities.
   * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
   */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }

  /**
   * Handle Picture-in-Picture mode changes
   * This is implemented for Google Play Store compliance only
   */
  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    
    if (isInPictureInPictureMode) {
      // App entered PiP mode - hide system UI and adjust layout
      hideSystemUI()
    } else {
      // App exited PiP mode - restore normal UI
      showSystemUI()
    }
  }

  /**
   * Enter Picture-in-Picture mode
   * This is implemented for Google Play Store compliance only
   */
  override fun enterPictureInPictureMode() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val pipParams = PictureInPictureParams.Builder()
        .setAspectRatio(Rational(16, 9)) // 16:9 aspect ratio for video content
        .build()
      
      enterPictureInPictureMode(pipParams)
    }
  }

  /**
   * Check if Picture-in-Picture is supported
   * This is implemented for Google Play Store compliance only
   */
  fun isPictureInPictureSupported(): Boolean {
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && packageManager.hasSystemFeature("android.software.picture_in_picture")
  }

  /**
   * Hide system UI for PiP mode
   * This is implemented for Google Play Store compliance only
   */
  private fun hideSystemUI() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_FULLSCREEN
        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      )
    }
  }

  /**
   * Show system UI when exiting PiP mode
   * This is implemented for Google Play Store compliance only
   */
  private fun showSystemUI() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
      window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
    }
  }
}
