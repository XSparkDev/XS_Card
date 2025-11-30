# Calendar Booking Page - Complete Connection Documentation

## 📄 File Location
**Main File:** `backend/public/bookCalendar.html`  
**Backup File:** `backend/public/bookCalendar.html.backup` (created on restyle)

---

## 🌐 Public Routes (Server Configuration)

### Route Definition
**File:** `backend/server.js` (Lines 249-256)

```javascript
// Public calendar booking routes (NO AUTH REQUIRED)
// IMPORTANT: .html route MUST come before the API route to avoid route conflicts
app.get('/public/calendar/:userId.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bookCalendar.html'));
});
app.get('/public/calendar/:userId/cancel/:token', meetingController.cancelPublicBooking);
app.get('/public/calendar/:userId', meetingController.getPublicCalendarAvailability);
app.post('/public/calendar/:userId/book', meetingController.createPublicBooking);
```

**Route Order:** Critical! The `.html` route must come BEFORE the API route to avoid conflicts.

**Accessibility:** All routes are PUBLIC (NO authentication required)

---

## 🔌 API Endpoints Used by the Page

### 1. GET Availability
**Endpoint:** `GET /public/calendar/:userId`  
**Used in:** `bookCalendar.html` (Line 1164)  
**Controller:** `meetingController.getPublicCalendarAvailability`  
**Purpose:** Fetches available time slots for a user

**Request:**
```javascript
const apiUrl = `/public/calendar/${userId}?startDate=${startDate}&days=365`;
const response = await fetch(apiUrl);
```

**Response Structure:**
```javascript
{
  success: true,
  data: {
    user: {
      name: string,
      company: string,
      profileImage: string | null
    },
    availability: {
      "YYYY-MM-DD": [
        {
          time: "HH:MM",
          availableDurations: [15, 30, 60]
        }
      ]
    },
    allowedDurations: [30, 60],
    timezone: "UTC",
    advanceBookingDays: 90
  }
}
```

**Backend Implementation:** `backend/controllers/meetingController.js` (Lines 745-832)

---

### 2. POST Create Booking
**Endpoint:** `POST /public/calendar/:userId/book`  
**Used in:** `bookCalendar.html` (Line 1765)  
**Controller:** `meetingController.createPublicBooking`  
**Purpose:** Creates a new meeting booking

**Request:**
```javascript
fetch(`/public/calendar/${userId}/book`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: string,        // Required
    email: string,       // Required
    phone: string,       // Required
    location: string,    // Optional
    message: string,     // Optional
    date: "YYYY-MM-DD",  // Required
    time: "HH:MM",       // Required
    duration: number     // Required
  })
})
```

**Response Structure:**
```javascript
{
  success: true,
  message: "Booking created successfully",
  data: {
    meetingDateTime: ISOString,
    duration: number,
    bookerName: string
  }
}
```

**Backend Implementation:** `backend/controllers/meetingController.js` (Lines 837-1093)

---

## 🔗 Dependencies & Services

### Backend Dependencies

#### 1. Availability Service
**File:** `backend/services/availabilityService.js`  
**Used by:** `meetingController.js`  
**Functions:**
- `calculateAvailableSlots()` - Calculates available time slots
- `isSlotAvailable()` - Checks if a specific slot is available
- `getDefaultPreferences()` - Returns default calendar preferences

#### 2. Calendar Service
**File:** `backend/public/Utils/calendarService.js`  
**Used by:** `meetingController.js`  
**Function:**
- `createCalendarEvent()` - Generates ICS calendar file

#### 3. Email Service
**File:** `backend/public/Utils/emailService.js`  
**Used by:** `meetingController.js`  
**Function:**
- `sendMailWithStatus()` - Sends email notifications

#### 4. User Utils
**File:** `backend/utils/userUtils.js`  
**Used by:** `meetingController.js`  
**Function:**
- `getUserInfo()` - Fetches user information from Firestore

---

## 🗄️ Database Collections

### 1. Users Collection
**Path:** `users/{userId}`  
**Fields Used:**
- `calendarPreferences` - Calendar booking settings
  - `enabled` - Boolean flag to enable/disable booking
  - `workingHours` - Per-day working hours configuration
  - `allowedDurations` - Array of allowed meeting durations
  - `bufferTime` - Buffer time between meetings (minutes)
  - `allowWeekends` - Boolean flag for weekend availability
  - `timezone` - User's timezone
  - `advanceBookingDays` - How many days in advance users can book
  - `notificationEmail` - Email for booking notifications
- `name` - User's display name
- `company` - User's company name
- `profileImage` - User's profile image URL
- `email` - User's email address

### 2. Meetings Collection
**Path:** `meetings/{userId}`  
**Structure:**
```javascript
{
  bookings: [
    {
      meetingWith: string,
      meetingWhen: Date,
      description: string,
      duration: number,
      location: string,
      source: "public" | "manual",
      bookerInfo: {
        name: string,
        email: string,
        phone: string,
        message: string
      },
      cancellationToken: string,
      createdAt: Date
    }
  ]
}
```

---

## 📧 Email Notifications

### 1. Booker Confirmation Email
**Triggered:** After successful booking creation  
**Sent to:** Booker's email address  
**Includes:**
- Meeting details (date, time, duration, location)
- ICS calendar attachment
- Cancellation link: `/public/calendar/:userId/cancel/:token`
- Calendar owner contact information

**Template Location:** `backend/controllers/meetingController.js` (Lines 995-1029)

### 2. Owner Notification Email
**Triggered:** After successful booking creation  
**Sent to:** Calendar owner's email (or `notificationEmail` if set)  
**Includes:**
- Booker's contact information (name, email, phone)
- Meeting details (date, time, duration, location)
- Booker's optional message

**Template Location:** `backend/controllers/meetingController.js` (Lines 1038-1066)

---

## 🔄 Page Flow & State Management

### JavaScript State Variables
**Location:** `bookCalendar.html` (Lines 1040-1051)

```javascript
let availabilityData = {};        // Availability slots by date
let userData = {};                // User profile information
let allowedDurations = [];        // Allowed meeting durations
let advanceBookingDays = 90;      // Maximum days in advance
let timezone = 'UTC';             // User's timezone
let currentMonth = new Date();    // Currently displayed month
let currentDaysStart = new Date(); // Start date for days row
let selectedDate = null;          // Selected booking date
let selectedTime = null;          // Selected booking time
let selectedDuration = null;      // Selected meeting duration
let availableDatesArray = [];     // Array of available dates
```

### Key Functions

1. **`init()`** - Initializes the page and fetches availability
2. **`fetchAvailability()`** - Fetches availability from API
3. **`renderUserInfo()`** - Displays user profile information
4. **`renderMiniCalendar()`** - Renders month calendar view
5. **`renderDaysRow()`** - Renders horizontal day selector
6. **`renderTimeSlots()`** - Renders available time slots
7. **`selectDate()`** - Handles date selection
8. **`selectTime()`** - Handles time selection
9. **`selectDuration()`** - Handles duration selection
10. **`openModal()`** - Opens booking form modal
11. **`showSuccess()`** - Displays success confirmation page

---

## 🎨 HTML Structure & IDs

### Main Containers
- `#loadingState` - Loading spinner
- `#errorState` - Error message display
- `#mainContent` - Main booking interface
- `#successState` - Success confirmation page

### User Profile Section
- `#userAvatar` - User avatar or initials
- `#userName` - User's display name
- `#meetingTitle` - Meeting title (e.g., "60 Minute Meeting")
- `#meetingDuration` - Duration text (e.g., "60 min appointments")
- `#timezone` - Timezone display

### Calendar Section
- `#miniMonthName` - Current month name
- `#miniCalendarGrid` - Mini calendar grid
- `#prevMonth` - Previous month button
- `#nextMonth` - Next month button
- `#daysRow` - Horizontal days row container
- `#prevDays` - Previous days button
- `#nextDays` - Next days button

### Time Selection
- `#timeSlotsContainer` - Time slots container
- `#freeAllDayBtn` - "Free All Day" button
- `#timeDropdownContainer` - Time dropdown container
- `#timeDropdownToggle` - Time dropdown toggle
- `#timeDropdownMenu` - Time dropdown menu
- `#timeSlotsGrid` - Time slots grid
- `#durationPills` - Duration selection pills
- `#noAvailability` - No availability message

### Booking Form Modal
- `#bookingModal` - Modal overlay
- `#bookingForm` - Booking form
- `#name` - Name input field
- `#email` - Email input field
- `#phone` - Phone input field
- `#location` - Location textarea
- `#message` - Message textarea
- `#submitBtn` - Submit button

### Success Page
- `#successUserName` - User name display
- `#successDate` - Date display
- `#successTime` - Time display
- `#successDuration` - Duration display

---

## 🔐 Security & Validation

### Frontend Validation
- Name required (non-empty)
- Email format validation (regex)
- Phone number required (non-empty)
- Date, time, and duration selection required

**Location:** `bookCalendar.html` (Lines 1742-1757)

### Backend Validation
- User ID validation
- Email format validation
- Required fields check (name, email, phone, date, time, duration)
- Duration must be in allowedDurations array
- Slot availability double-check before booking
- Calendar booking must be enabled for user

**Location:** `backend/controllers/meetingController.js` (Lines 854-926)

---

## 🌍 URL Format

### Booking Page URL
```
/public/calendar/{userId}.html
```

**Example:**
```
https://xscard.com/public/calendar/user123.html
```

### Cancellation URL (in emails)
```
/public/calendar/{userId}/cancel/{token}
```

**Example:**
```
https://xscard.com/public/calendar/user123/cancel/abc123def456
```

---

## 📱 Frontend References

### React Native App Files
The following files reference the booking page URL:

1. **CalendarPreferencesScreen.tsx** (Line 285)
   - Generates calendar link for sharing
   - `const calendarLink = `${API_BASE_URL}/public/calendar/${userId}.html`;`

2. **Calendar.tsx** (Line 1348)
   - May reference calendar link generation

---

## 🔄 Data Flow

### Initialization Flow
1. User visits `/public/calendar/:userId.html`
2. Page extracts `userId` from URL
3. `init()` function is called
4. `fetchAvailability()` requests availability from API
5. `renderUserInfo()` displays user profile
6. `renderMiniCalendar()` renders month calendar
7. `renderDaysRow()` renders day selector

### Booking Flow
1. User selects a date → `selectDate()`
2. User selects a time → `selectTime()`
3. User selects duration → `selectDuration()`
4. Booking modal opens → `openModal()`
5. User fills form and submits
6. Form submits to `/public/calendar/:userId/book`
7. On success → `showSuccess()` displays confirmation
8. Emails are sent to both booker and owner

---

## 🎯 Key Features

1. **No Authentication Required** - Public booking page
2. **Dynamic Availability** - Real-time availability calculation
3. **Timezone Support** - Displays timezone information
4. **Multiple Durations** - Supports different meeting durations
5. **Email Notifications** - Automatic emails to both parties
6. **ICS Attachments** - Calendar event attachments in emails
7. **Cancellation Tokens** - Secure cancellation links
8. **Responsive Design** - Works on mobile and desktop
9. **Loading States** - Loading and error states
10. **Success Confirmation** - Visual confirmation after booking

---

## 📝 Notes for Restyling

### Critical Elements to Maintain
1. **All HTML IDs** - Used by JavaScript, do not change
2. **Form field names** - Must match API expectations
3. **API endpoints** - `/public/calendar/:userId` and `/public/calendar/:userId/book`
4. **State variables** - Core JavaScript logic depends on them
5. **Function names** - Core functions are called by event handlers

### Safe to Modify
1. **CSS styles** - All styling can be changed
2. **Layout structure** - Can be reorganized as long as IDs remain
3. **Visual elements** - Icons, colors, spacing, fonts
4. **Animations** - Can add/modify CSS animations
5. **Responsive breakpoints** - Can adjust media queries

### JavaScript Functions That Should Remain
- `init()`
- `fetchAvailability()`
- `renderUserInfo()`
- `renderMiniCalendar()`
- `renderDaysRow()`
- `renderTimeSlots()`
- `selectDate()`
- `selectTime()`
- `selectDuration()`
- `openModal()`
- `closeModal()`
- `showSuccess()`
- `formatTime12Hour()`
- `formatTimezone()`

---

## 🚨 Important Considerations

1. **Route Order** - `.html` route must come before API route in `server.js`
2. **Public Access** - Routes are public (no auth middleware)
3. **Error Handling** - Page handles API errors gracefully
4. **CORS** - If frontend and backend are on different domains, CORS must be configured
5. **Static Files** - Ensure `bookCalendar.html` is accessible via static middleware
6. **URL Parsing** - Handles both `.html` and non-`.html` URLs

---

## 📚 Related Files

### Backend Files
- `backend/server.js` - Route configuration
- `backend/controllers/meetingController.js` - API controllers
- `backend/services/availabilityService.js` - Availability calculation
- `backend/public/Utils/calendarService.js` - ICS generation
- `backend/public/Utils/emailService.js` - Email sending
- `backend/utils/userUtils.js` - User information helper

### Frontend Files
- `src/screens/settings/CalendarPreferencesScreen.tsx` - Settings screen
- `src/screens/admin/Calendar.tsx` - Calendar screen
- `src/utils/api.ts` - API utilities
- `src/types/index.ts` - TypeScript interfaces

### Documentation Files
- `CALENDAR_BOOKING_IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `CALENDAR_BOOKING_PAGE_CONNECTIONS.md` - This file (connections documentation)

---

**Last Updated:** After creating backup for restyling


