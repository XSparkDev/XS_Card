# NFC Phase 2 - End-to-End Test Plan

## ✅ Implementation Complete

All Phase 2 components have been implemented:
- ✅ NFC Service (Android)
- ✅ NFC Utilities (NDEF encoding/parsing)
- ✅ NFC Card Programmer Screen
- ✅ NFC Write Progress Component
- ✅ Integration with CardsScreen (Share modal)
- ✅ Navigation setup
- ✅ Android permissions
- ✅ API endpoint configuration

## 🧪 Test Scenarios

### Test 1: NFC Card Programming (Write)

**Prerequisites:**
- Android device with NFC enabled
- Blank NFC card/tag (NTAG213, NTAG215, or NTAG216)
- Backend server running on `http://localhost:8383` or production URL

**Steps:**
1. Open the app and navigate to Cards screen
2. Tap the "Share" button on any card
3. Select "NFC Card" option from the share modal
4. Verify the NFC Card Programmer screen opens
5. Select a card to program (if multiple cards exist)
6. Tap "Program Card" button
7. **Hold the blank NFC card against the back of your phone**
8. Wait for write completion (target: <1 second)

**Expected Results:**
- ✅ NFC Card Programmer screen displays correctly
- ✅ Card selection works (if multiple cards)
- ✅ "Program Card" button is enabled when NFC is available
- ✅ Progress indicator shows "Tap Card to Back of Phone"
- ✅ Write completes successfully with success message
- ✅ Duration displayed (should be <1000ms)
- ✅ Screen automatically navigates back after 2 seconds

**Error Cases to Test:**
- NFC disabled: Should show alert to enable NFC
- Card removed too early: Should show error message
- Write timeout: Should handle gracefully
- No NFC hardware: Should show appropriate message

---

### Test 2: NFC Card Reading (Background)

**Prerequisites:**
- Android device with NFC enabled
- NFC card already programmed (from Test 1)
- Backend server running

**Steps:**
1. Ensure app is running (can be in background)
2. **Tap the programmed NFC card to the back of the phone**
3. Verify the device opens the browser/WebView
4. Verify the contact page loads with correct user information
5. Fill out the contact form
6. Submit the form

**Expected Results:**
- ✅ Android Intent Filter triggers correctly
- ✅ Browser opens to `/nfc?userId=X&cardIndex=Y` URL
- ✅ Contact page displays card owner's information
- ✅ Form submission works
- ✅ Contact is saved successfully
- ✅ Email notification sent to card owner
- ✅ Scan count incremented

---

### Test 3: Integration with CardsScreen

**Steps:**
1. Navigate to Cards screen
2. Tap "Share" button
3. Verify "NFC Card" option appears in share modal
4. Verify NFC icon displays correctly (purple/indigo color)
5. Tap "NFC Card" option
6. Verify navigation to NFC Card Programmer screen

**Expected Results:**
- ✅ NFC option visible in share modal
- ✅ NFC icon renders correctly
- ✅ Navigation works smoothly
- ✅ Correct card data passed to programmer screen

---

### Test 4: Performance Testing

**Write Performance:**
- Measure write time for multiple cards
- Target: <1 second per write
- Test with different NFC tag types (NTAG213, NTAG215, NTAG216)

**Read Performance:**
- Measure time from tap to page load
- Target: <0.5 seconds for tag detection
- Test background reading (app in background)

---

### Test 5: Error Handling

**Test Cases:**
1. **NFC Disabled:**
   - Disable NFC in device settings
   - Try to program card
   - Should show alert to enable NFC

2. **No NFC Hardware:**
   - Test on device without NFC
   - Should show appropriate message

3. **Card Removed During Write:**
   - Start write operation
   - Remove card before completion
   - Should show error and allow retry

4. **Invalid Card:**
   - Try to write to incompatible tag
   - Should handle gracefully

5. **Network Issues:**
   - Disable network
   - Program card (should still work - URL is written)
   - Test reading (should fail gracefully when opening URL)

---

### Test 6: Multiple Cards

**Steps:**
1. User with multiple cards
2. Navigate to NFC Card Programmer
3. Verify all cards are listed
4. Select different cards
5. Program each card
6. Verify each card has correct URL

**Expected Results:**
- ✅ All cards displayed in selector
- ✅ Selected card highlighted
- ✅ Each card programmed with correct `cardIndex` in URL
- ✅ Can program multiple cards sequentially

---

## 📱 Device Requirements

- **Android:** API Level 21+ (Android 5.0+)
- **NFC:** Hardware NFC support required
- **Tags:** NTAG213, NTAG215, or NTAG216 recommended

## 🔍 Debugging Tips

1. **Check Logs:**
   - Look for `[NFC Service]`, `[NFC Write]`, `[NFC Read]` prefixes
   - Check backend logs for `/nfc` endpoint hits

2. **Verify Permissions:**
   - Check AndroidManifest.xml has NFC permission
   - Verify NFC is enabled in device settings

3. **Test URL Generation:**
   - Verify URL format: `https://xscard.co.za/nfc?userId=X&cardIndex=Y`
   - Test URL in browser manually

4. **Backend Verification:**
   - Ensure `/nfc` endpoint is accessible
   - Verify `saveContact.html` is served correctly

## ✅ Success Criteria

- [ ] Can program NFC card in <1 second
- [ ] Can read programmed card and open contact page
- [ ] Contact saving works from NFC URL
- [ ] Error handling works for all edge cases
- [ ] UI/UX is smooth and intuitive
- [ ] No crashes or memory leaks
- [ ] Works on Android 5.0+ devices

## 📝 Notes

- iOS implementation is placeholder (plug & play ready)
- Background reading uses Android Intent Filters
- Write operation is foreground-only (user must be on screen)
- All NFC operations require user interaction

