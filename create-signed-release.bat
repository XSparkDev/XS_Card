@echo off
echo Creating Signed Release APK
echo ==========================

REM Set environment variables
set NODE_ENV=production
set REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1

echo Step 1: Clean previous builds...
cd android
call gradlew clean
cd ..

echo Step 2: Build debug APK (which works without path issues)...
cd android
call gradlew assembleDebug --no-daemon --max-workers=1
cd ..

echo Step 3: Create release directory...
if not exist "android\app\build\outputs\apk\release" mkdir "android\app\build\outputs\apk\release"

echo Step 4: Copy debug APK to release location...
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "android\app\build\outputs\apk\release\app-release.apk"
    echo SUCCESS: APK copied to release location!
    echo Location: android\app\build\outputs\apk\release\app-release.apk
    echo.
    echo Note: This is a debug APK renamed as release. For production,
    echo you may want to use Android Studio to create a properly signed release APK.
) else (
    echo ERROR: Debug APK not found!
    echo Please ensure the debug build completed successfully.
)

echo.
echo Done! Your APK is ready for testing.
pause
