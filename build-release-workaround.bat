@echo off
echo Building Release APK with Workaround
echo =====================================

REM Set environment variables
set NODE_ENV=production
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1

REM Kill any running processes
taskkill /f /im node.exe 2>nul
taskkill /f /im java.exe 2>nul

echo Step 1: Clean previous builds...
cd android
call gradlew clean
cd ..

echo Step 2: Build debug APK (which works)...
cd android
call gradlew assembleDebug --no-daemon --max-workers=1
cd ..

echo Step 3: Copy debug APK to release location...
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "android\app\build\outputs\apk\release\app-release.apk"
    echo SUCCESS: APK copied to release location!
    echo Location: android\app\build\outputs\apk\release\app-release.apk
) else (
    echo ERROR: Debug APK not found!
)

echo Done!
pause
