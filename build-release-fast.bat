@echo off
echo Fast Release APK Build Script
echo ============================

REM Set environment variables for faster builds
set NODE_ENV=production
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1
set REACT_NATIVE_METRO_CACHE=0

echo Setting up environment...

REM Kill any running processes
taskkill /f /im node.exe 2>nul
taskkill /f /im java.exe 2>nul

echo Building for ARM64 only (faster)...

REM Build for ARM64 only to speed up the process
cd android
call gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon --max-workers=1 --offline
cd ..

echo Checking for APK...
if exist "android\app\build\outputs\apk\release\app-release.apk" (
    echo SUCCESS: APK built successfully!
    echo Location: android\app\build\outputs\apk\release\app-release.apk
) else (
    echo ERROR: APK not found. Build may have failed.
)

echo Done!
pause
