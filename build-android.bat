@echo off
echo Building Android APK...

REM Set environment variables
set NODE_ENV=production
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1

REM Kill any running Metro processes
taskkill /f /im node.exe 2>nul

REM Clean previous builds
echo Cleaning previous builds...
cd android
call gradlew clean
cd ..

REM Clear Metro cache
echo Clearing Metro cache...
npx react-native start --reset-cache --port=8081 &
timeout /t 5 /nobreak > nul
taskkill /f /im node.exe 2>nul

REM Build the release APK
echo Building release APK...
cd android
call gradlew assembleRelease --no-daemon --offline
cd ..

echo Build completed!
pause
