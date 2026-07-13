# PRD — XS Card

*15 April 2026*

## Table of Contents

1. Project Overview — 5
2. Tech Stack Assumptions — 8
3. Key Objectives — 22
4. Scope — 34
5. File Structure — 41
6. Non-Functional Requirements — 51
7. Additional Requirements — 56

---

# XS Card Application - Product Requirements Document (PRD)

## 1. Project Overview

**Project Name:** XS Card

**Purpose:** XS Card is a comprehensive digital business card management platform designed to provide seamless creation, customisation, and sharing digital business cards per user. The application aims to revolutionise professional networking by offering a systematic approach to digital identity management and instant contact exchange through advanced QR code technology. Through XS Card, users can maintain complete control over their professional presence while providing immediate accessibility through encrypted QR code sharing systems. This platform serves as a foundational tool for professional networking, contact management, card analytics tracking, and automated information distribution.

### User Personas & Access Levels

#### Primary User (Card Creator)

**Description:** Individual who creates and manages their digital business cards, professional information, and sharing preferences through the XS Card application.

**Responsibilities:**
- Complete comprehensive onboarding process including personal data, professional details, and company information
- Create and manage up to five distinct digital business cards with unique designs and information sets
- Customise card fields including name, title, company, contact information, social media links, and branding elements
- Generate secure QR codes for each card with dynamic updating capabilities
- Set sharing preferences and privacy controls for each card
- Manage professional profile information (email, phone, company, job title, industry) and profile pictures
- Add, edit, and update card designs, color schemes, and layout preferences post-onboarding
- Respond to QR code scan notifications and view sharing analytics
- Maintain current contact information and professional details

**Access:**
- Full access to personal dashboard with all card-related information
- Can view and manage all personal cards, QR codes, and sharing history
- Can create, edit, and delete personal business cards
- Can update profile and sharing preferences
- Cannot access other users' card information or system administration features
- Cannot bypass sharing restrictions or access recipient viewing logs beyond own cards

#### Card Recipient (Viewer/Scanner)

**Description:** Individual who receives/scans and views digital business cards through QR code scanning or direct sharing links.

**Responsibilities:**
- Scan QR codes using native camera or in-app scanner to receive card details
- View received card information in structured format
- Save received cards to local device contacts
- Share received cards with third parties (if permitted by creator)
- Maintain viewing privacy and data handling standards

**Access:**
- Can scan/receive cards via QR code scanning or direct links
- Can view card details shared by primary users
- Can download contact information to device
- Cannot modify primary user's card information or designs
- Cannot access primary user's account settings or preferences
- Cannot access system administration or other users' information

#### System Administrator

**Description:** Technical administrator responsible for system maintenance, QR code generation management, and operational oversight.

**Responsibilities:**
- Monitor and maintain QR code generation workflows
- Manage card template systems and design options
- Oversee contact import API integrations
- Monitor system performance and security protocols
- Manage user account issues and technical support
- Ensure compliance with data protection regulations
- Monitor sharing analytics and system usage metrics

**Access:**
- Can access system logs and operational metrics
- Can monitor card creation and sharing processes
- Cannot access encrypted personal card content without authorization
- Can view system metadata (timestamps, scan counts, generation logs)
- Can manage technical integrations and system configurations
- Cannot bypass security protocols or access user personal information

#### Analytics Administrator

**Description:** Data analyst responsible for overseeing sharing analytics, usage patterns, and platform optimization insights.

**Responsibilities:**
- Review card sharing metrics and engagement statistics
- Oversee QR code scan tracking and location analytics (if enabled)
- Coordinate with marketing teams for feature optimization
- Ensure compliance with privacy regulations in data collection
- Manage analytics dashboards and reporting workflows
- Provide insights for user experience improvements

**Access:**
- Can access aggregated analytics data and reporting systems
- Can review sharing trends and user engagement metrics
- Cannot access personal card content or individual user details without authorization
- Can view anonymized usage patterns and scan statistics
- Can manage analytics data export workflows
- Cannot modify user accounts or card content

---

## 2. Tech Stack Assumptions

### Framework & Core Technologies

- **Framework:** React Native +0.76.9 with Expo SDK +52.0.47
- **Language:** TypeScript +5.3.3
- **Platform:** Cross-platform (iOS & Android)
- **Architecture:** Legacy React Native architecture (New Architecture disabled)
- **State Management:** React Context API for local state
- **Form Handling:** Custom form validation with React Hook Form and Zod integration
- **Navigation:** React Navigation v7 (Stack, Tab, Native Stack)

### Styling & UI Components

- **Design System:** Custom theme system with accent colours matching XS Card brand
- **Icons:** @expo/vector-icons (^14.0.4)
- **Fonts:** @expo-google-fonts/montserrat (^0.2.3)
- **Styling:** React Native StyleSheet with custom components
- **Color Management:** Custom color picker (react-native-wheel-color-picker) for card customisation
- **Gradients:** expo-linear-gradient (^14.0.2) for card backgrounds
- **Blur Effects:** expo-blur (^14.0.3) for modern UI effects
- **UI Components:** Custom components with minimalist design
- **Theming:** Light mode with accent colours and customisable card themes

### Backend & Database - Firebase

**Authentication (Firebase Auth):**
- Email/password authentication
- Social authentication (Google, LinkedIn, Microsoft) for quick signup
- Custom token management
- User session management with JWT
- Token blacklisting and validation

**Database (Firestore):**
- User profiles and professional information
- Card templates and design data
- QR code metadata and generation logs
- Sharing history and scan tracking
- Contact import logs
- Card analytics and engagement metrics
- Push notification tokens (FCM)

**Storage (Firebase Storage):**
- Card designs and layout images
- User profile pictures and company logos
- QR code image files (high resolution)
- Custom background images for cards
- Exported contact files (vCard format)

**Real-time Features:**
- Exported contact files (vCard format)
- Live card sharing status updates
- Real-time QR code scan notifications
- Instant card updates to recipients
- Live analytics tracking
- Real-time template updates

**Cloud Functions:**
- Real-time template updates
- QR code generation and regeneration workflows
- Contact import processing (vCard, CSV)
- Email and SMS sharing delivery
- Analytics processing and aggregation
- Background tasks (cleanup, expiration)

**APIs:**
- RESTful APIs via Firebase client
- Real-time subscriptions for live updates
- File upload/download APIs
- Third-party integration APIs (LinkedIn, Google Wallet, Apple Wallet, Microsoft, Google OAuth)

### Mobile Applications - React Native/Expo

- **Framework:** React Native +0.76.9 with Expo SDK +52.0.47
- **Platforms:**
  - iOS (13.0+) via EAS Build
  - Android (API 24+) via EAS Build

**Bundle Identifiers:**
- iOS: com.xscard.app
- Android: com.xscard.app

**Build System:**
- iOS: EAS Build + Xcode
- Android: EAS Build + Gradle
- Current Version: 2.0.0 (Build 1)

### Third-Party Integrations

**Onboarding & Data Collection:**
- Custom Forms: Professional information, company details, and card customisation
- Document Upload: Logo and profile picture handling

**Communication Services:**
- Email: SendGrid (^8.1.4) with Nodemailer fallback for sharing cards via email
- Deep Linking: Custom URL schemes for card sharing (xscard://card/{id})
- SMTP Server: Configured for transactional emails

**QR Code Technology:**
- Generation: react-qr-code with custom styling
- Scanning: expo-camera with barcode scanning capabilities
- Encryption: AES encryption for sensitive QR data payloads
- Dynamic URLs: Firebase Dynamic Links for persistent QR codes

**Push Notifications:**
- Service: Firebase Cloud Messaging (FCM)
- Integration: Firebase Cloud Functions + FCM API
- Storage: FCM tokens stored in Firestore profiles table
- Triggers: Database triggers on card shares and updates
- Features: Share confirmations, scan alerts, card update notifications

**Document & Media Handling:**
- Card Designs: Secure image generation and storage
- Image Processing: Client-side compression before upload
- Supported Types: JPEG/PNG (profile pictures), SVG (QR codes), vCard (contacts)
- Security: Encrypted storage and transmission
- Verification: Image integrity and format validation

**Development & Build Tools:**
- Package Manager: npm
- Build Tool: EAS Build (Expo Application Services)
- Bundling:
  - Mobile: React Native bundle format
  - Cross-platform: Single codebase deployment
- Development Server: Expo development server
- Project ID: xscard-app-production

### Deployment

**Mobile Applications:**
- iOS: App Store via EAS Build
- Android: Google Play Store via EAS Build
- Build Scripts: Automated EAS Build configurations
- OTA Updates: Expo Updates for non-native changes

**Backend Services:**
- iOS: App Store via EAS Build
- Server: Node.js production server (if needed for complex operations)
- Database: Firebase Firestore (production)
- Storage: Firebase Storage (production)
- Functions: Firebase Cloud Functions (production)

**CI/CD:**
- Version Control: GitHub
- Automated Builds: EAS Build with GitHub integration
- Environment: Production, Staging, Development
- Version Management: Automated with semantic versioning

**Environment Management:**
- Environment Variables: Stored in .env files
- Firebase Configuration: Project-specific config files
- API Keys: SendGrid, Twilio, LinkedIn API
- Security: .env files in .gitignore to prevent exposure
- Configuration: Firebase project configuration files

### Security

- Data Encryption: End-to-end encryption for sensitive card data
- HTTPS Only: All network requests encrypted
- Firebase Security Rules: Row Level Security on all collections
- JWT Authentication: Secure token-based authentication
- QR Code Security: Encrypted payloads to prevent tampering
- API Security: Rate limiting and input validation
- Access Control: Role-based permissions for different user types
- Document Security: Encrypted storage and secure transmission

### Testing (Recommended)

- Unit Tests: Jest (via Expo)
- E2E Tests: Detox or Appium
- API Tests: Firebase API testing
- Mobile Tests: Expo development build testing
- Real Device Tests: Physical iOS/Android devices
- Integration Tests: Third-party API testing (LinkedIn, Google OAuth, Microsoft OAuth)

### Performance Optimization

- Code Splitting: React Native lazy loading
- Image Optimization: Lazy loading, responsive images
- Caching: Firebase cache, local storage optimization
- Bundle Size: Tree shaking, minification via EAS Build
- Offline Support: Local data caching for critical card information
- Memory Management: Optimized for large QR code generation

### Developer Experience

- Linting: ESLint with TypeScript rules
- Code Formatting: Prettier configuration
- Git Hook: Husky for pre-commit checks (optional)
- Documentation: Markdown guides in repository
- TypeScript: Strict mode enabled for type safety
- Metro Bundler: Custom configuration for optimization

### Monitoring & Analytics

- Error Tracking: Firebase Crashlytics, Render
- Analytics: Firebase Analytics, Render
- Performance: React Native performance monitoring
- Usage Metrics: Firebase, and render dashboard and custom analytics
- Card Tracking: QR code scan monitoring
- Document Analytics: Card view and share tracking

### Project Structure

```
XSCard-App/
├── src/                           # React Native source code
│   ├── components/                # Reusable UI components
│   │   ├── ui/                    # Generic UI components
│   │   │   ├── Button.tsx         # Custom button component
│   │   │   ├── Input.tsx          # Text input component
│   │   │   ├── Modal.tsx          # Modal component
│   │   │   ├── Card.tsx           # Card container component
│   │   │   └── Avatar.tsx         # Profile picture component
│   │   ├── cards/                 # Card-specific components
│   │   │   ├── CardPreview.tsx    # Live card preview
│   │   │   ├── CardTemplate.tsx   # Card template selector
│   │   │   ├── QRCodeDisplay.tsx  # QR code generator display
│   │   │   ├── CardField.tsx      # Editable card field
│   │   │   └── CardColorPicker.tsx # Color customization
│   │   ├── forms/                 # Form components
│   │   │   ├── OnboardingForm.tsx # User data collection
│   │   │   ├── CardCreationForm.tsx # Card builder form
│   │   │   ├── ProfileForm.tsx    # Profile update form
│   │   │   └── ContactImportForm.tsx # Import contacts form
│   │   ├── qr/                    # QR code components
│   │   │   ├── QRScanner.tsx      # Camera scanner component
│   │   │   ├── QRGenerator.tsx    # QR generation logic
│   │   │   └── QRShareModal.tsx   # Sharing options modal
│   │   └── sharing/               # Sharing-related components
│   │       ├── ShareOptions.tsx   # Share via email/SMS
│   │       ├── ReceivedCard.tsx   # Display received card
│   │       └── ShareHistory.tsx   # History of shares
│   ├── screens/                   # Application screens
│   │   ├── Onboarding.tsx         # User onboarding screen
│   │   ├── Dashboard.tsx          # Main dashboard with cards
│   │   ├── CardCreation.tsx       # Create/edit card screen
│   │   ├── CardDetail.tsx         # Individual card view
│   │   ├── QRScanner.tsx          # Scan QR code screen
│   │   ├── ReceivedCards.tsx      # Saved received cards
│   │   ├── Profile.tsx            # User profile screen
│   │   ├── Analytics.tsx          # Card analytics screen
│   │   ├── Settings.tsx           # App settings screen
│   │   └── NotFound.tsx           # 404/error screen
│   ├── navigation/                # Navigation configuration
│   │   ├── AppNavigator.tsx       # Main navigation setup
│   │   ├── TabNavigator.tsx       # Bottom tab navigation
│   │   └── types.ts               # Navigation type definitions
│   ├── services/                  # Business logic and API integrations
│   │   ├── firebase.ts            # Firebase client configuration
│   │   ├── authService.ts         # Authentication service
│   │   ├── cardService.ts         # Card CRUD operations
│   │   ├── qrService.ts           # QR code generation/service
│   │   ├── sharingService.ts      # Sharing logic
│   │   ├── contactService.ts      # Contact import/export
│   │   ├── analyticsService.ts    # Analytics tracking
│   │   ├── notificationService.ts # Notification delivery
│   │   └── storageService.ts      # File upload/download
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.ts             # Authentication hook
│   │   ├── useCards.ts            # Card management hook
│   │   ├── useQRCode.ts           # QR code generation hook
│   │   ├── useSharing.ts          # Sharing functionality hook
│   │   └── useAnalytics.ts        # Analytics data hook
│   ├── contexts/                  # React contexts
│   │   ├── AuthContext.tsx        # Authentication context
│   │   ├── CardContext.tsx        # Card data context
│   │   └── ThemeContext.tsx       # Theme context
│   ├── lib/                       # Shared utilities
│   │   ├── types.ts               # TypeScript definitions
│   │   ├── utils.ts               # Utility functions
│   │   ├── constants.ts           # App constants
│   │   ├── validators.ts          # Form validation
│   │   └── helpers.ts             # Helper functions
│   ├── types/                     # TypeScript interfaces
│   │   ├── user.ts                # User types
│   │   ├── card.ts                # Card types
│   │   ├── qr.ts                  # QR code types
│   │   ├── sharing.ts             # Sharing types
│   │   └── analytics.ts           # Analytics types
│   ├── config/                    # Configuration files
│   │   ├── firebase.config.ts     # Firebase configuration
│   │   ├── api.config.ts          # API endpoints
│   │   ├── env.config.ts          # Environment variables
│   │   └── theme.config.ts        # Theme configuration
│   └── App.tsx                    # Main application component
├── assets/                        # Static assets
│   ├── images/                    # Image assets
│   │   ├── logo.png               # XS Card logo
│   │   ├── card-templates/        # Default card templates
│   │   └── icons/                 # App icons
│   ├── fonts/                     # Custom fonts
│   │   └── montserrat/            # Montserrat font family
│   └── colors/                    # Color definitions
├── firebase/                      # Firebase backend configuration
│   ├── functions/                 # Cloud Functions
│   │   ├── qrGeneration/          # QR code generation
│   │   ├── sharingWorkflow/       # Sharing automation
│   │   ├── contactImport/         # Contact processing
│   │   ├── analyticsAggregation/  # Analytics processing
│   │   ├── notificationDelivery/  # Notification system
│   │   └── auditLogging/          # Audit log creation
│   ├── rules/                     # Firestore security rules
│   │   ├── users.rules.ts         # User collection rules
│   │   ├── cards.rules.ts         # Card data rules
│   │   ├── qr.rules.ts            # QR code access rules
│   │   └── sharing.rules.ts       # Sharing history rules
│   └── config/                    # Firebase configuration
│       ├── firestore.config.ts    # Database configuration
│       ├── storage.config.ts      # Storage configuration
│       └── auth.config.ts         # Auth configuration
├── docs/                          # Documentation
│   ├── XSCard-Flow-Documentation.md
│   ├── TECH_STACK_DOCUMENTATION.md
│   ├── XSCard-PRD.md
│   └── API_DOCUMENTATION.md
├── .expo/                         # Expo configuration
├── .eas/                          # EAS Build configuration
├── eas.json                       # EAS Build settings
├── app.json                       # Expo app configuration
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript configuration
```

### Key Dependencies

```json
{
  "react": "*",
  "react-native": "0.76.9",
  "@expo/vector-icons": "~14.0.4",
  "@react-navigation/native": "^7.0.14",
  "@react-navigation/native-stack": "^7.2.0",
  "@react-navigation/bottom-tabs": "*",
  "@react-native-async-storage/async-storage": "1.23.1",
  "expo": "~52.0.47",
  "expo-camera": "~16.0.18",
  "expo-image-picker": "~16.0.6",
  "expo-linear-gradient": "~14.0.2",
  "expo-blur": "~14.0.3",
  "react-native-wheel-color-picker": "latest",
  "react-native-modal": "^14.0.0-rc.1",
  "react-native-keyboard-aware-scroll-view": "^0.9.5",
  "react-native-gesture-handler": "~2.20.2",
  "react-native-safe-area-context": "4.12.0",
  "react-native-screens": "~4.4.0",
  "react-qr-code": "^6.0.0",
  "expo-sharing": "~12.0.0",
  "expo-contacts": "~14.0.0",
  "zod": "^3.22.0",
  "react-hook-form": "^7.49.0"
}
```

### Backend Dependencies

```json
{
  "express": "^4.21.2",
  "firebase-admin": "^13.0.2",
  "axios": "^1.7.9",
  "nodemailer": "^7.0.9",
  "@sendgrid/mail": "^8.1.4",
  "twilio": "^5.8.0",
  "qrcode": "^1.5.3",
  "vcard-parser": "^1.0.0",
  "express-rate-limit": "^8.1.0",
  "dotenv": "^16.4.7"
}
```

---

## 3. Key Objectives

### Core Functionality

**References:**
- String: text of any length
- Object: reference to another Datatype (represented by `[]`)
- Object value: reference to another value access through another datatype or a field (represented by `{}`)
- Option: list of selectable values
- User input: data typed in by the user

### Definitions

Registration generates the following record:

#### User Profile (UP)
- user_id: string (UUID, auto-generated by Firebase Auth)
- email: string (PRIVATE, from Firebase Auth)
- phone: string {user input}
- full_name: string {user input}
- job_title: string {user input}
- company: string {user input}
- industry: string {user input, optional}
- profile_picture: url to Firebase Storage {user input, optional}
- account_type: option {free, premium} default "free"
- cards_limit: int default 5 (max cards allowed)
- account_created: timestamp
- last_active: timestamp
- email_verified: boolean default false
- phone_verified: boolean default false
- is_active: boolean default true
- onboarding_completed: boolean default false
- created_at: timestamp
- updated_at: timestamp
- notification_preferences: object {email_shares, push_notifications, scan_alerts}

#### Card Information
- card_id: string (UUID, auto-generated)
- user_id: [UP] {user_id}
- card_name: string {user input} (e.g., "Work Card", "Personal Card")
- card_title: string {user input} (display name on card)
- full_name: string {user input, defaults to UP.full_name}
- job_title: string {user input, defaults to UP.job_title}
- company: string {user input, defaults to UP.company}
- email: string {user input, defaults to UP.email}
- phone: string {user input, defaults to UP.phone}
- website: string {user input, optional}
- linkedin_url: string {user input, optional}
- twitter_handle: string {user input, optional}
- address: string {user input, optional}
- bio: string {user input, optional}
- profile_picture_url: url to Firebase Storage {user input}
- logo_url: url to Firebase Storage {user input, optional}
- theme_color: string {user input} (hex color code)
- template_id: string {user input} (card layout template)
- is_active: boolean default true
- is_primary: boolean default false (primary card flag)
- privacy_level: option {public, private, password_protected}
- share_password: string {user input, optional} (if password_protected)
- view_count: int default 0
- created_at: timestamp
- updated_at: timestamp

#### QR Code Data
- qr_id: string (UUID, auto-generated)
- card_id: [Card Information] {card_id}
- user_id: [UP] {user_id}
- qr_code_url: url to Firebase Storage (PNG image)
- qr_code_data: string (encrypted payload or deep link URL)
- qr_style: option {classic, rounded, dots, custom}
- qr_color: string {user input} (hex color, default #000000)
- qr_bg_color: string {user input} (hex color, default #FFFFFF)
- include_logo: boolean default true
- logo_overlay_url: url to Firebase Storage {optional}
- is_dynamic: boolean default true (allows updating without regenerating)
- short_url: string (shortened URL for sharing)
- generated_at: timestamp
- last_scanned: timestamp
- scan_count: int default 0
- is_active: boolean default true
- expires_at: timestamp {optional}
- created_at: timestamp
- updated_at: timestamp

#### Sharing History
- share_id: string (UUID, auto-generated)
- card_id: [Card Information] {card_id}
- sender_user_id: [UP] {user_id}
- recipient_email: string {user input, optional}
- recipient_phone: string {user input, optional}
- share_method: option {qr_scan, email, sms, link, nearby_share}
- share_status: option {sent, delivered, opened, saved}
- ip_address: string (captured for security)
- device_info: string (platform, OS)
- location_data: object {lat, long, city, country} {optional, if permitted}
- opened_at: timestamp
- saved_to_contacts: boolean default false
- created_at: timestamp

#### Received Card
- received_id: string (UUID, auto-generated)
- user_id: [UP] {user_id} (recipient)
- card_id: [Card Information] {card_id} (original card)
- sender_user_id: [UP] {user_id} (sender, if registered)
- card_data_snapshot: object (cached card data at time of receipt)
- received_method: option {scanned, shared_link, email, sms}
- is_saved: boolean default false
- is_favorite: boolean default false
- notes: string {user input, optional}
- tags: array of strings {user input}
- received_at: timestamp
- saved_at: timestamp
- created_at: timestamp
- updated_at: timestamp

#### Card Template
- template_id: string (UUID, auto-generated)
- template_name: string (e.g., "Modern Clean", "Executive", "Creative")
- template_category: option {professional, creative, minimal, bold}
- layout_type: option {vertical, horizontal, square}
- thumbnail_url: url to Firebase Storage
- default_colors: array of strings (hex codes)
- font_family: string
- is_premium: boolean default false
- is_active: boolean default true
- created_at: timestamp

#### Contact Import Log
- import_id: string (UUID, auto-generated)
- user_id: [UP] {user_id}
- import_type: option {vcard, csv, manual, linkedin}
- source_file_url: url to Firebase Storage {optional}
- contacts_imported: int
- contacts_failed: int
- import_status: option {processing, completed, failed}
- error_log: string {optional}
- created_at: timestamp
- completed_at: timestamp

#### Analytics Event
- event_id: string (UUID, auto-generated)
- card_id: [Card Information] {card_id}
- user_id: [UP] {user_id}
- event_type: option {card_viewed, qr_scanned, link_clicked, contact_saved, card_shared}
- event_data: object (contextual data)
- session_id: string
- device_type: string
- platform: string (iOS, Android, Web)
- country: string
- city: string
- created_at: timestamp

#### Notification Log
- notification_id: string (UUID, auto-generated)
- user_id: [UP] {user_id}
- notification_type: option {card_shared, qr_scanned, card_updated, limit_warning, system_update}
- notification_method: option {push, email, in_app}
- title: string
- body: string
- data_payload: object (JSON: card_id, share_id, etc.)
- delivery_status: option {pending, sent, delivered, failed}
- read_status: boolean default false
- sent_at: timestamp
- delivered_at: timestamp
- read_at: timestamp
- created_at: timestamp

#### Audit Log
- audit_log_id: string (UUID, auto-generated)
- user_id: [UP] {user_id} / null (for system events)
- event_type: option {user_registration, card_created, card_updated, card_deleted, card_shared, qr_generated, contact_imported, settings_changed}
- action: option {created, updated, deleted, accessed, shared, exported}
- severity: option {low, medium, high}
- description: string (auto-generated description)
- metadata: string (JSON: IP address, device info, etc.)
- ip_address: string
- device_info: string (platform, OS, app version)
- created_at: timestamp

#### System Settings
- setting_id: string (UUID, auto-generated)
- setting_key: string (e.g., max_cards_free, max_file_size, qr_expiry_days)
- setting_value: string
- description: string
- is_system: boolean default true (cannot be modified by users)
- created_at: timestamp
- updated_at: timestamp

### Real-time Features
- Live Card Updates: Real-time card data updates using Firebase Realtime when card is edited
- QR Code Scanning: Instant scan detection and card retrieval
- Sharing Notifications: Instant alerts when cards are shared or scanned
- Analytics Updates: Live view count and engagement metrics
- Template Updates: Real-time availability of new card templates

### Security & Privacy
- Data Encryption: Card data encrypted in transit and at rest
- Row Level Security: Firebase Security Rules protect user data
- QR Code Security: Encrypted payloads prevent unauthorized access to private cards
- Access Control: Role-based permissions for different user types
- Secure Storage: Encrypted Firebase Storage for card images and QR codes
- Audit Trail: Comprehensive logging of all user actions
- Data Protection: Compliance with GDPR and data protection regulations

### Cross-Platform Support
- Mobile Application: React Native/Expo app for iOS and Android
- Web Dashboard: Future web interface for card management
- Consistent UX: Unified experience across all platforms
- Offline Support: Local data caching for cards and QR codes

### AI Integration (Future Considerations)

**Smart Card Suggestions:**
- Description: AI-powered suggestions for card optimization based on industry standards
- Integration: Machine learning model for content recommendations
- Features: Auto-suggest improvements, optimal field recommendations

### Functions

#### User Dashboard
**Description:** Primary users have access to this page for managing their digital business cards

**Acceptance Criteria:**
- View own profile: [UP] {full_name, job_title, company, email, phone}
- View own cards: [Card Information] with QR code generation status
- View card analytics: [Analytics Event] with view counts and share statistics
- Create new cards: [Card Information] with template selection
- Edit existing cards: [Card Information] with real-time preview
- Delete cards: [Card Information] with confirmation dialog
- Manage sharing preferences: Privacy settings and password protection
- Update profile information: [UP] with validation
- View received cards: [Received Card] list with search and filter
- Access QR codes: [QR Code Data] with download and share options

#### Card Creation & Management
**Description:** The system must allow users to create and manage up to five digital business cards with extensive customization

**Acceptance Criteria:**
- Users can create cards: [Card Information] with all required fields
- Users can select templates: [Card Template] with preview
- Users can customize colors: [Card Information] {theme_color} with color picker
- Users can upload images: Profile pictures and logos to Firebase Storage
- Users can set privacy levels: [Card Information] {privacy_level}
- Users can duplicate cards: Copy existing card with new card_id
- Users cannot exceed 5-card limit: Validation with upgrade prompt (verify if it is 5)
- Users can preview cards: Real-time preview before saving
- Users can reorder cards: Set primary card and sort order

#### QR Code Generation & Management
**Description:** The system must generate secure, customizable QR codes for each card with dynamic updating capabilities

**Acceptance Criteria:**
- QR codes auto-generate: [QR Code Data] created upon card creation
- Users can customize QR appearance: [QR Code Data] {qr_style, qr_color}
- QR codes support dynamic updates: [QR Code Data] {is_dynamic} allows content changes without reprinting
- Users can download QR codes: High-resolution PNG export
- QR codes contain encrypted data: [QR Code Data] {qr_code_data} with encryption
- Users can regenerate QR codes: New codes generated on demand
- QR codes track scans: [QR Code Data] {scan_count, last_scanned}
- QR codes support expiration: [QR Code Data] {expires_at} for temporary cards

#### Sharing System
**Description:** The system must enable seamless sharing of cards via multiple channels with tracking capabilities

**Acceptance Criteria:**
- QR code scanning: Native camera integration to scan and retrieve cards
- Email sharing: [Sharing History] {share_method = email} via SendGrid
- SMS sharing: [Sharing History] {share_method = sms} via Twilio
- Direct link sharing: Short URL generation for social media
- Offline QR saving: Save QR code image to device gallery
- Recipients can save contacts: vCard generation and download
- Sharing history tracked: [Sharing History] with timestamps and status
- Recipients can view without app: Web viewer for non-registered users

#### Contact Import & Export
**Description:** The system must support importing existing contacts and exporting card data to device contacts

**Acceptance Criteria:**
- Import from device contacts: [Contact Import Log] {import_type = manual}
- Import vCard files: [Contact Import Log] {import_type = vcard}
- Import CSV files: [Contact Import Log] {import_type = csv}
- Export to device contacts: Save received cards to phone book
- Export as vCard: Generate .vcf files from card data
- LinkedIn import: [Contact Import Log] {import_type = linkedin} (future)
- Import validation: Duplicate detection and data validation
- Batch import support: Multiple contacts at once

#### Notification System
**Description:** The system must deliver real-time notifications for sharing activities and system updates

**Acceptance Criteria:**
- Card share notifications: [Notification Log] {notification_type = card_shared}
- QR scan alerts: [Notification Log] {notification_type = qr_scanned}
- Card update notifications: [Notification Log] {notification_type = card_updated}
- Limit warnings: [Notification Log] {notification_type = limit_warning} when approaching 5-card limit
- Multi-channel delivery: Push, email, and in-app notifications
- Notification preferences respected: [UP] {notification_preferences}
- Deep linking support: Navigate to relevant card or screen
- Read status tracking: [Notification Log] {read_status}

#### Advanced Search & Filter
**Description:** The system must allow users to quickly find cards, received contacts, and sharing history

**Acceptance Criteria:**
- Search by name: [Card Information] {full_name} or [Received Card] {card_data_snapshot.full_name}
- Search by company: [Card Information] {company}
- Search by job title: [Card Information] {job_title}
- Filter by tags: [Received Card] {tags}
- Filter by date received: [Received Card] {received_at} date range
- Filter by favorites: [Received Card] {is_favorite}
- Search within received cards: Full-text search of cached card data
- Recent searches saved: Quick access to previous queries

### Scalability, Maintainability & Reliability

#### Scalability
The XS Card system must be able to grow with user adoption and handle increasing card creation and sharing activities

**Acceptance Criteria:**
- System must support thousands of concurrent users without slowdowns
- Must handle millions of QR code scans without performance degradation
- Adding new features must not affect existing functionality
- The architecture must allow horizontal scaling
- Real-time card updates must scale with user growth
- QR code generation must scale automatically with usage
- Database queries must remain fast with large datasets

#### Maintainability
The system must be easy to maintain, update, and enhance for card management features

**Acceptance Criteria:**
- Codebase must follow standardized coding practices
- Code must be modular with clear separation between card creation, sharing, and user management
- System must include clear documentation for developers
- Maintenance tasks must be possible without disrupting active users
- Logging and error handling must provide enough detail for troubleshooting
- Automated testing must cover critical card functionality
- CI/CD pipeline must enable rapid deployment of updates

#### Reliability
The system must run consistently and accurately for critical card sharing activities

**Acceptance Criteria:**
- Target uptime of 99.9% during peak usage hours
- Automatic retries for failed QR code generations
- Database backups must run daily with recovery options
- Failures must be logged and visible to administrators
- System must handle sudden spikes in sharing requests (e.g., networking events)
- Card data delivery must be guaranteed
- QR code images must be redundantly stored
- Real-time features must have fallback mechanisms

#### Security
The system must protect sensitive contact and professional information

**Acceptance Criteria:**
- Card data must be encrypted in transit and at rest (especially private cards)
- All access must be role-based and permission-controlled
- Multi-factor authentication available for sensitive operations
- All actions must be stored in Audit Logs
- The system must comply with GDPR and data protection regulations
- QR code payloads must be access-controlled
- API endpoints must be rate-limited
- User sessions must be securely managed

#### Performance
The system must remain fast and responsive for critical card sharing activities

**Acceptance Criteria:**
- QR code generation must complete within 5 seconds
- Card creation must save within 3 seconds
- QR code scanning must resolve within 2 seconds
- Card sharing must deliver within 10 seconds
- Search results must return within 5 seconds for large datasets
- App startup must complete within 10 seconds
- Card images must load within 3 seconds

#### User Interface (UI)
The system must provide a clean and intuitive interface for card management and sharing

**Acceptance Criteria:**
- The system must include:
  - User dashboard with cards overview and quick actions
  - Card creation interface with template selection
  - Card editing with live preview
  - QR code display with sharing options
  - Scanner interface for receiving cards
  - Received cards management with contact integration
  - Profile settings and notification preferences
- Buttons and labels must use clear, simple wording (e.g., "Create Card", "Share QR", "Scan Code")
- Success and error messages must be shown in plain language
- QR code sharing must be easy to understand and execute
- Card management must be intuitive with preview capabilities
- UI must be consistent across iOS and Android platforms
- Teal accent colors must be used consistently
- Accessibility features must be supported
- Responsive design must work on all screen sizes
- Visual feedback must be provided for all actions

---

## 4. Scope

### In-Scope Features

#### User Onboarding & Registration
XS Card provides a comprehensive onboarding process for collecting user data, professional information, and initial card preferences.

**Acceptance Criteria:**
- Users must complete registration with email/password or social auth (Google, LinkedIn, Apple)
- Users must complete profile setup with name, job title, company, and contact information
- Users must verify email address before accessing full features
- Users must accept terms of service and privacy policy
- Users must create their first card during onboarding (can skip uploading company logo and profile picture)
- All onboarding data must be securely stored in Firebase
- Onboarding must include tutorial on QR code sharing

#### User Dashboard Management
The user dashboard serves as the central hub for managing cards, viewing analytics, and accessing received contacts.

**Acceptance Criteria:**
- Users must be able to view all created cards with thumbnail previews
- Users must see card statistics (scans, cards) on dashboard
- Users must be able to quickly share cards via dashboard buttons
- Users must see 5-card limit indicator with usage (e.g., "3 of 5 cards used") — we need to implement this
- Users must be able to access QR codes for each card from dashboard
- Users must see recent sharing activity and notifications
- Users must be able to access received cards library
- Dashboard must display in clean, XS Card-themed interface
- All data must be synchronized across platforms in real-time

#### Card Creation & Customization System
The system allows creation of up to five distinct digital business cards with extensive customization options.

**Acceptance Criteria:**
- Users can create up to 5 cards maximum: System enforces limit with warning
- Users can choose from multiple templates: [Card Template] selection with preview
- Users can customize all fields: Name, title, company, contact info, social links, bio
- Users can upload profile pictures: Image upload with cropping capability
- Users can upload company logos: Logo upload with transparency support
- Users can customize colors: Color picker for primary, secondary, and text colors
- Users can set privacy levels: Public (anyone with QR), Private (contacts only), or Password-protected
- Users can preview cards in real-time: Live preview during editing
- Users can duplicate existing cards: Copy all data to new card for editing
- Users can delete cards: With confirmation dialog and data retention warning
- Users can set primary card: Default card shown first in dashboard

#### QR Code Generation & Management
The system automatically generates secure, customizable QR codes for each card with advanced features.

**Acceptance Criteria:**
- QR codes auto-generate for each card: [QR Code Data] created upon card save
- Users can customize QR code appearance: Style (classic, rounded, dots), colors, logo inclusion
- QR codes support high-resolution download: PNG export suitable for printing (300dpi)
- QR codes are dynamic: Content can be updated without changing QR code image
- QR codes contain encrypted data: Private cards use encrypted payloads
- QR codes track scanning analytics: [QR Code Data] {scan_count} increments on each scan
- Users can regenerate QR codes: Option to generate new code if compromised
- QR codes support expiration: Temporary cards can expire after set date
- QR codes can be saved offline: Download to device photo gallery
- QR codes support vCard format: Direct contact download on scan

#### Sharing & Distribution System
The system enables seamless sharing of cards through multiple channels with comprehensive tracking.

**Acceptance Criteria:**
- QR Code sharing: Display QR code for in-person scanning
- Email sharing: Send card via email with custom message using SendGrid
- SMS sharing: Send card link via text message using Twilio
- Direct link sharing: Generate short URL for social media or messaging apps
- Nearby sharing: Device-to-device sharing using Bluetooth/NFC (if supported)
- Recipients can view without app: Web-based viewer for non-registered users
- Recipients can save to contacts: One-click vCard download
- Sharing history tracked: [Sharing History] logs all shares with timestamps
- Users receive notifications when cards are viewed: [Notification Log] alerts on opens
- Users can revoke shared links: Disable access to previously shared cards

#### QR Code Scanning & Receiving
The system provides robust QR code scanning capabilities for receiving cards.

**Acceptance Criteria:**
- Native camera integration: Scan QR codes without leaving app
- In-app scanner: Dedicated scanning interface with frame guidance
- Flashlight support: Toggle flash for low-light scanning
- Gallery import: Scan QR codes from saved images
- Auto-detection: Automatic recognition and parsing of QR data
- Instant card display: Show card within 2 seconds of successful scan
- Save to received cards: Option to save scanned card to library
- Add to device contacts: Export to phone's native contact book
- Add notes and tags: Personal organization of received cards
- Offline scanning capability: Queue scans for processing when online

#### Contact Import & Export
The system supports importing existing contacts and exporting card data.

**Acceptance Criteria:**
- Import from device contacts: Select and import native contacts
- Import vCard files: Upload .vcf files to create cards
- Import CSV files: Bulk import from spreadsheet data
- LinkedIn import: Connect LinkedIn to import profile data (OAuth)
- Export as vCard: Generate .vcf from any card
- Export as image: Save card as image for social media
- Export contact list: Backup received cards as CSV
- Duplicate detection: Prevent importing existing contacts
- Data validation: Ensure required fields present on import

#### Analytics & Insights
The system provides analytics on card performance and sharing activities.

**Acceptance Criteria:**
- View counts: [Analytics Event] tracking of card views
- Scan statistics: QR code scan counts and timestamps
- Share tracking: Number of shares per channel (email, SMS, QR)
- Geographic data: Location of scans (if user consents)
- Device analytics: Platform breakdown (iOS vs Android) of viewers
- Peak activity times: When cards are most frequently accessed
- Popular cards: Which of user's cards perform best
- Export analytics: Download reports as CSV/PDF
- Real-time updates: Live dashboard updates as events occur

#### Notification System
The system delivers real-time notifications for sharing activities and system events.

**Acceptance Criteria:**
- Push notifications: Firebase Cloud Messaging for instant alerts
- Email notifications: Optional email summaries of activity
- In-app notifications: Notification center within app
- Card share alerts: When someone views your shared card
- QR scan alerts: When someone scans your QR code
- Limit warnings: When approaching 5-card maximum
- Update confirmations: When card updates are successfully synced
- Customizable preferences: Toggle notification types in settings
- Deep linking: Tap notification to open relevant card or screen

#### User Profiles & Settings
The system allows users to manage their profiles, notification preferences, and app settings.

**Acceptance Criteria:**
- Edit profile information: Update name, title, company, contact details
- Change profile picture: Upload new photo or remove existing
- Update notification preferences: Toggle email, push, and scan alerts
- Manage privacy settings: Default privacy level for new cards
- Change password: Security settings with email confirmation
- Delete account: GDPR-compliant account deletion with data removal
- Connected accounts: Manage social login connections

#### Cross-Platform Support
The system provides consistent functionality across iOS and Android mobile platforms with React Native/Expo.

**Acceptance Criteria:**
- iOS native app available through App Store
- Android native app available through Google Play Store
- All platforms support the same core features
- UI consistent across iOS and Android platforms
- Data synchronized across platforms in real-time
- Signature accent colors used consistently
- Mobile-responsive design works on all screen sizes
- Offline support caches critical information locally
- Platform-specific features utilized (Share sheets, Contacts integration)

#### Security & Compliance
The system implements comprehensive security measures to protect contact information and card data.

**Acceptance Criteria:**
- Card data encrypted in transit and at rest (AES-256)
- All access role-based and permission-controlled
- Multi-factor authentication available for account security
- All actions stored in audit logs
- System complies with GDPR and data protection regulations
- QR code payloads encrypted for private cards
- API endpoints rate-limited
- User sessions securely managed
- Row Level Security protects all Firebase data
- Password-protected cards require authentication to view

### Out-of-Scope Features

The following features are not included in this version of XS Card:

**Advanced Networking Features:**
- Real-time chat or messaging between users
- Video calling or conferencing integration
- Social media feed or timeline
- Connection requests or friend systems
- Group creation or team management

**Advanced Analytics:**
- Heat maps of QR code scans
- Conversion rate tracking beyond views
- A/B testing for card designs
- Predictive analytics for networking success
- Integration with CRM systems (Salesforce, HubSpot)

**Advanced Integrations:**
- Calendar integration for meeting scheduling
- Email client integration (Gmail, Outlook plugins)
- Third-party CRM synchronization
- Social media auto-posting
- Payment integration (receive payments via card)

**Enterprise Features:**
- Team or company-wide card management
- Admin dashboard for organizations
- Bulk card creation for employees
- Corporate branding enforcement
- Organization analytics and reporting

**Monetization Features:**
- Premium subscription tiers (beyond basic free/premium distinction)
- In-app purchases for additional cards beyond 5
- Advertising or promoted cards
- Affiliate links or commission systems
- Paid templates or design elements

**Advanced Customization:**
- Custom fonts upload (beyond provided selection)
- Video backgrounds on cards
- Animated card elements
- Custom domain hosting for card links
- White-label solutions

**Multi-Language & Globalization:**
- Full internationalization beyond English
- Right-to-left (RTL) language support
- Multi-currency support for payment features (if added)
- Localized legal compliance per country
- Regional phone number formatting for all countries

**Offline-First Architecture:**
- Full offline card creation and editing
- Peer-to-peer card sharing without internet
- Local-only card storage option
- Offline analytics queuing
- Background sync for all operations

**Advanced AI Features:**
- Business card scanning (OCR) from physical cards
- AI-generated card designs based on industry
- Automatic contact enrichment from web sources
- Smart suggestions for card improvements
- Chatbot for networking advice

---

## 5. File Structure

```
XSCard-App/
├── src/                           # React Native source code
│   ├── components/                # Reusable React Native components
│   │   ├── ui/                    # Generic UI components
│   │   │   ├── Button.tsx         # Custom button component with variants
│   │   │   ├── Input.tsx          # Text input component with validation
│   │   │   ├── Modal.tsx          # Modal component for dialogs
│   │   │   ├── Card.tsx           # Card container with shadow/elevation
│   │   │   ├── Avatar.tsx         # Profile picture component
│   │   │   ├── Badge.tsx          # Notification badges and status indicators
│   │   │   └── LoadingSpinner.tsx # Loading states
│   │   ├── cards/                 # Card-specific components
│   │   │   ├── CardPreview.tsx    # Live card preview component
│   │   │   ├── CardTemplate.tsx   # Template selection grid
│   │   │   ├── CardEditor.tsx     # Card editing interface
│   │   │   ├── QRCodeDisplay.tsx  # QR code generator and display
│   │   │   ├── CardField.tsx      # Individual editable field
│   │   │   ├── ColorPicker.tsx    # Theme color selector
│   │   │   ├── TemplateCarousel.tsx # Horizontal template scroller
│   │   │   └── PrivacySelector.tsx # Privacy level dropdown
│   │   ├── forms/                 # Form components
│   │   │   ├── OnboardingForm.tsx # Multi-step onboarding flow
│   │   │   ├── CardCreationForm.tsx # Card builder with validation
│   │   │   ├── ProfileForm.tsx    # User profile editing
│   │   │   ├── ContactImportForm.tsx # Import interface
│   │   │   └── LoginForm.tsx      # Authentication forms
│   │   ├── qr/                    # QR code components
│   │   │   ├── QRScanner.tsx      # Camera scanner with overlay
│   │   │   ├── QRGenerator.tsx    # Generation logic and display
│   │   │   ├── QRShareModal.tsx   # Sharing options modal
│   │   │   ├── QRHistory.tsx      # Scan history list
│   │   │   └── QRStyles.tsx       # Style customization options
│   │   ├── sharing/               # Sharing-related components
│   │   │   ├── ShareOptions.tsx   # Email/SMS/Link options
│   │   │   ├── ShareHistory.tsx   # List of past shares
│   │   │   ├── ReceivedCard.tsx   # Display received card
│   │   │   ├── ReceivedCardList.tsx # Grid of received cards
│   │   │   └── ShareSuccess.tsx   # Confirmation after sharing
│   │   └── analytics/             # Analytics components
│   │       ├── AnalyticsCard.tsx  # Stat display cards
│   │       ├── ChartViews.tsx     # View count charts
│   │       ├── RecentActivity.tsx # Activity feed
│   │       └── GeographyMap.tsx   # Map of scan locations
│   ├── screens/                   # Application screens
│   │   ├── Onboarding.tsx         # User onboarding flow
│   │   ├── Login.tsx              # Authentication screen
│   │   ├── Register.tsx           # Registration screen
│   │   ├── Dashboard.tsx          # Main dashboard with cards grid
│   │   ├── CardCreation.tsx       # Create new card wizard
│   │   ├── CardEdit.tsx           # Edit existing card
│   │   ├── CardDetail.tsx         # View single card details
│   │   ├── QRDisplay.tsx          # Full-screen QR code
│   │   ├── QRScanner.tsx          # Scanning interface
│   │   ├── ReceivedCards.tsx      # Library of received cards
│   │   ├── ReceivedCardDetail.tsx # View received card
│   │   ├── Analytics.tsx          # Statistics and insights
│   │   ├── Profile.tsx            # User profile management
│   │   ├── Settings.tsx           # App settings
│   │   ├── Notifications.tsx      # Notification center
│   │   ├── ContactImport.tsx      # Import contacts screen
│   │   └── NotFound.tsx           # 404/error screen
│   ├── navigation/                # Navigation configuration
│   │   ├── AppNavigator.tsx       # Main stack navigator
│   │   ├── TabNavigator.tsx       # Bottom tab bar setup
│   │   ├── AuthNavigator.tsx      # Authentication flow
│   │   ├── OnboardingNavigator.tsx # Onboarding steps
│   │   └── types.ts               # TypeScript navigation types
│   ├── services/                  # Business logic and API integrations
│   │   ├── firebase.ts            # Firebase initialization
│   │   ├── authService.ts         # Authentication operations
│   │   ├── cardService.ts         # Card CRUD operations
│   │   ├── qrService.ts           # QR code generation/management
│   │   ├── sharingService.ts      # Sharing logic and tracking
│   │   ├── contactService.ts      # Contact import/export
│   │   ├── analyticsService.ts    # Analytics collection
│   │   ├── notificationService.ts # Push/local notifications
│   │   ├── storageService.ts      # Firebase Storage operations
│   │   └── templateService.ts     # Card template fetching
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.ts             # Authentication state
│   │   ├── useCards.ts            # Card management
│   │   ├── useQRCode.ts           # QR operations
│   │   ├── useSharing.ts          # Sharing functionality
│   │   ├── useAnalytics.ts        # Analytics data
│   │   ├── useContacts.ts         # Contact operations
│   │   └── useNotifications.ts    # Notification handling
│   ├── contexts/                  # React contexts
│   │   ├── AuthContext.tsx        # Auth state provider
│   │   ├── CardContext.tsx        # Card data provider
│   │   ├── ThemeContext.tsx       # Theme/dark mode provider
│   │   └── NotificationContext.tsx # Notification state
│   ├── lib/                       # Shared utilities
│   │   ├── types.ts               # Global TypeScript types
│   │   ├── utils.ts               # Helper functions
│   │   ├── constants.ts           # App constants (limits, colors)
│   │   ├── validators.ts          # Zod validation schemas
│   │   └── helpers.ts             # Formatting utilities
│   ├── types/                     # TypeScript interfaces (detailed)
│   │   ├── user.ts                # User type definitions
│   │   ├── card.ts                # Card type definitions
│   │   ├── qr.ts                  # QR code types
│   │   ├── sharing.ts             # Sharing and received types
│   │   ├── analytics.ts           # Analytics event types
│   │   └── notification.ts        # Notification types
│   ├── config/                    # Configuration files
│   │   ├── firebase.config.ts     # Firebase config
│   │   ├── api.config.ts          # API endpoints and keys
│   │   ├── env.config.ts          # Environment variables
│   │   ├── theme.config.ts        # Color schemes and fonts
│   │   └── constants.config.ts    # App-wide constants
│   └── App.tsx                    # Root application component
├── assets/                        # Static assets
│   ├── images/                    # Image assets
│   │   ├── logo.png               # XS Card logo
│   │   ├── logo-white.png         # Logo for dark backgrounds
│   │   ├── splash.png             # App splash screen
│   │   ├── card-templates/        # Default template thumbnails
│   │   │   ├── modern-clean.png
│   │   │   ├── executive.png
│   │   │   ├── creative.png
│   │   │   └── minimal.png
│   │   ├── icons/                 # Tab bar and UI icons
│   │   └── placeholders/          # Empty state illustrations
│   ├── fonts/                     # Custom fonts
│   │   └── montserrat/            # Montserrat font family
│   └── colors/                    # Color definitions JSON
├── firebase/                      # Firebase backend
│   ├── functions/                 # Cloud Functions
│   │   ├── qrGeneration/          # QR code generation logic
│   │   │   ├── index.ts           # Main generation function
│   │   │   ├── encryption.ts      # Payload encryption
│   │   │   └── styles.ts          # QR styling options
│   │   ├── sharingWorkflow/       # Sharing automation
│   │   │   ├── emailSharing.ts    # SendGrid integration
│   │   │   ├── smsSharing.ts      # Twilio integration
│   │   │   └── tracking.ts        # Share tracking logic
│   │   ├── contactImport/         # Contact processing
│   │   │   ├── vcardParser.ts     # vCard parsing
│   │   │   ├── csvParser.ts       # CSV processing
│   │   │   └── validation.ts      # Data validation
│   │   ├── analyticsAggregation/  # Analytics processing
│   │   │   ├── dailyAggregation.ts
│   │   │   ├── realtimeStats.ts
│   │   │   └── reports.ts         # Report generation
│   │   ├── notificationDelivery/  # Push notifications
│   │   │   ├── pushSender.ts      # FCM integration
│   │   │   ├── emailComposer.ts   # Email templates
│   │   │   └── scheduler.ts       # Scheduled notifications
│   │   ├── security/              # Security functions
│   │   │   ├── rateLimiter.ts     # API rate limiting
│   │   │   └── auditLogger.ts     # Audit trail creation
│   │   └── index.ts               # Function exports
│   ├── rules/                     # Firestore security rules
│   │   ├── users.rules.ts         # User collection security
│   │   ├── cards.rules.ts         # Card data access rules
│   │   ├── qr.rules.ts            # QR code access control
│   │   ├── sharing.rules.ts       # Sharing history rules
│   │   └── storage.rules.ts       # Storage bucket rules
│   └── config/                    # Firebase configuration
│       ├── firestore.config.ts    # Database indexes
│       ├── storage.config.ts      # Storage buckets setup
│       └── auth.config.ts         # Auth providers setup
├── backend/                       # Node.js backend (if needed)
│   ├── server.js                  # Express server entry
│   ├── routes/                    # API routes
│   │   ├── auth.routes.js         # Authentication endpoints
│   │   ├── card.routes.js         # Card API
│   │   ├── qr.routes.js           # QR code endpoints
│   │   ├── sharing.routes.js      # Sharing API
│   │   ├── analytics.routes.js    # Analytics endpoints
│   │   └── webhook.routes.js      # Third-party webhooks
│   ├── middleware/                # Express middleware
│   │   ├── auth.middleware.js     # JWT verification
│   │   ├── validation.middleware.js # Request validation
│   │   ├── rateLimit.middleware.js # Rate limiting
│   │   └── error.middleware.js    # Error handling
│   ├── services/                  # Backend services
│   │   ├── email.service.js       # SendGrid/Nodemailer
│   │   ├── sms.service.js         # Twilio SMS
│   │   ├── qrGenerator.service.js # QR generation
│   │   └── linkedIn.service.js    # LinkedIn API
│   └── package.json               # Backend dependencies
├── docs/                          # Documentation
│   ├── XSCard-Flow-Documentation.md
│   ├── TECH_STACK_DOCUMENTATION.md
│   ├── XSCard-PRD.md
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── SECURITY_POLICY.md
├── .expo/                         # Expo configuration
├── .eas/                          # EAS Build configuration
├── eas.json                       # EAS Build settings
├── app.json                       # Expo app configuration
├── package.json                   # Frontend dependencies
├── tsconfig.json                  # TypeScript configuration
├── babel.config.js                # Babel configuration
├── metro.config.js                # Metro bundler config
└── .env                           # Environment variables (gitignored)
```

### Key Directory Descriptions

**src/components/:**
- ui/: Reusable UI primitives (buttons, inputs, modals)
- cards/: Card-specific components for creation and display
- forms/: Form components for data entry and validation
- qr/: QR code generation and scanning components
- sharing/: Components for sharing functionality and received cards
- analytics/: Data visualization and statistics components

**src/screens/:**
- Onboarding.tsx: Multi-step onboarding with profile setup
- Dashboard.tsx: Main screen with cards grid and quick actions
- CardCreation.tsx: Wizard for creating new cards
- QRScanner.tsx: Camera interface for scanning codes
- ReceivedCards.tsx: Library of saved contacts/cards
- Analytics.tsx: Statistics dashboard for card performance

**src/services/:**
- firebase.ts: Firebase app initialization
- authService.ts: Login, register, password reset
- cardService.ts: CRUD operations for cards
- qrService.ts: QR generation and encryption
- sharingService.ts: Share tracking and history
- contactService.ts: Import/export functionality

**firebase/functions/:**
- qrGeneration/: Server-side QR code generation with encryption
- sharingWorkflow/: Automated email/SMS sending via SendGrid/Twilio
- contactImport/: Processing vCard and CSV imports
- analyticsAggregation/: Processing scan events and generating reports
- notificationDelivery/: Push notification triggering via FCM

**firebase/rules/:**
- users.rules.ts: User profile read/write permissions
- cards.rules.ts: Card data security (users can only edit own cards)
- qr.rules.ts: QR code access (public vs private card rules)
- sharing.rules.ts: Sharing history access controls

---

## 6. Non-Functional Requirements

### Speed
The XS Card system must respond quickly to user interactions and perform efficiently during card sharing activities.

**Performance Targets:**
- QR code generation (all styles) complete within 5 seconds
- Card creation and updates save within 3 seconds
- QR code scanning resolves within 2 seconds
- Asset and card data loads within 3 seconds
- Search results return within 5 seconds for large datasets
- App startup completes within 10 seconds on mobile devices
- Card sharing requests deliver within 10 seconds
- Dashboard data loads within 5 seconds
- Analytics API calls complete within 5 seconds
- Notification delivery (push, email) within 60 seconds of trigger events
- Image uploads complete within 30 seconds for 5MB files

### Reliability
The system must operate consistently and accurately for critical card sharing activities.

**Reliability Requirements:**
- Availability: 99.9% uptime during peak usage hours (excluding scheduled maintenance)
- Automatic monitoring for critical card generation workflows
- QR code generation guarantee (retry on failure up to 3 times)
- Real-time card updates must have fallback mechanisms (queue for retry)
- Sharing delivery automatic retries for failed email/SMS sends
- Database integrity verification after card updates
- Multi-level sharing workflow redundancy
- System health monitoring and alerting for card generation failures
- Graceful degradation when third-party services (SendGrid, Twilio) are unavailable

### Backups & Recovery
The system must maintain comprehensive backup and recovery capabilities for card data and user information.

**Backup & Recovery Requirements:**
- Daily Firebase database snapshots (Firestore)
- Database backup retention: 30 days minimum
- Card image backup retention: 90 days
- QR code image retention: Until card deletion + 30 days
- Recovery time objective (RTO): within 1 hour for critical data
- Recovery point objective (RPO): maximum 4 hours of data loss
- User data export capability for GDPR compliance
- Document files redundantly stored in Firebase Storage with multi-region replication
- Audit logs retained for 2 years
- Disaster recovery procedures tested quarterly
- Automated backup verification and integrity checks

### Security
The system must implement comprehensive security measures to protect contact information and professional data.

**Security Requirements:**
- Card data encrypted in transit (TLS/SSL) and at rest (AES-256)
- Private card data encrypted with user-specific keys
- Row Level Security (RLS) enforced on all Firestore collections
- Role-based access control (RBAC) for different user types
- QR code payloads encrypted for private cards (prevent unauthorized scanning)
- HTTPS enforced for all network requests
- API keys stored securely in environment variables (never in code)
- User sessions securely managed with Firebase Auth
- Multi-factor authentication available for account security
- Rate limiting on QR code generation (prevent abuse)
- Rate limiting on sharing endpoints (prevent spam)
- Document files private; access via expiring signed URLs (Firebase Storage)
- Comprehensive audit logging for all card sharing operations
- GDPR compliance with data anonymization options
- Zero-trust architecture for private card access

### Usability
The system must be intuitive and accessible for users managing professional networking tools.

**Usability Requirements:**
- Users can complete onboarding in less than 10 minutes
- Card creation requires no training (intuitive form flow)
- All core features accessible within 2 taps from dashboard
- QR code sharing achievable in 3 simple steps
- Card scanning process clear with camera guidance overlays
- Consistent UI across iOS and Android platforms
- Accessible UI with screen reader support (iOS VoiceOver, Android TalkBack)
- High contrast mode support for visual accessibility
- Clear error messages in plain language (no technical jargon)
- Loading states and progress indicators for all async operations (card saving, image upload)
- Helpful tooltips for first-time users
- Contextual help available on complex features (privacy settings)
- Empty states with clear calls-to-action (no cards yet, scan your first card)

### Scalability
The system must grow with user adoption and handle increasing card creation and sharing volumes.

**Scalability Requirements:**
- Supports 50,000 concurrent users on mobile platforms
- Handles millions of QR code scans without performance degradation
- Card creation workflows scale with user growth
- QR code generation scales automatically with Cloud Functions
- Image storage scales automatically with Firebase Storage
- Database queries remain fast with indexes on user_id, card_id, and timestamps
- Sharing workflows handle peak demand (networking events)
- Real-time analytics aggregation scales horizontally
- Cloud Functions auto-scale with QR generation workload
- Mobile app performance remains consistent with increasing card library size (up to 1000 received cards per user)

### Performance Metrics

**Acceptance Criteria:**
- App launch time: < 10 seconds on average mobile device
- QR code generation: < 5 seconds for standard vCard QR
- Dashboard load time: < 5 seconds for first load (with 5 cards)
- Card creation save: < 3 seconds end-to-end
- QR scan resolution: < 2 seconds from scan to display
- Sharing API response: < 5 seconds for email/SMS send
- Image upload: < 30 seconds for 5MB profile picture
- Search results: < 3 seconds for received cards search
- Data synchronization: < 2 seconds for real-time card updates

### Monitoring & Analytics

**Requirements:**
- Real-time error tracking with Firebase Crashlytics
- Performance monitoring for all critical workflows (card creation, sharing)
- QR code generation success rate tracking
- Card sharing delivery rates by channel (email, SMS, QR)
- User engagement analytics (cards created, shares per user)
- Analytics processing performance metrics
- Notification delivery rates and open rates
- System resource utilization monitoring (Cloud Functions execution times)
- Geographic distribution of users and scans
- Daily active users (DAU) and monthly active users (MAU) tracking

### Compliance & Legal

**Requirements:**
- Compliance with GDPR (EU users) - right to erasure, data portability
- Compliance with CCPA (California users) - disclosure of data collection
- Compliance with CAN-SPAM Act for email sharing
- Compliance with TCPA for SMS sharing (opt-in requirements)
- Secure handling of contact information (encryption standards)
- Audit trail maintenance for data protection compliance (2-year retention)
- User consent tracking for data processing
- Privacy policy and terms of service compliance
- Data retention policies (auto-delete inactive accounts after 2 years)
- Secure document storage meeting SOC 2 standards
- Age verification (13+ or 16+ depending on jurisdiction)

### Accessibility

**Requirements:**
- iOS VoiceOver support for all interactive elements
- Android TalkBack support for navigation and card reading
- High contrast mode support for visual accessibility
- Scalable text sizes (minimum 16px, support up to 200%)
- Touch target sizes minimum 44x44 pixels (Apple HIG compliance)
- Color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for text)
- Keyboard navigation support for all features (external keyboards)
- Focus indicators for all interactive elements (borders/highlighting)
- Alternative text for all images (profile pictures, logos, QR codes described as "QR code for [Name]'s business card")
- Screen reader announcements for sharing confirmations ("Card shared successfully")
- Reduced motion support for animations
- Dynamic type support on iOS (respect system font sizes)

### Maintainability

**Requirements:**
- Modular codebase with clear separation of concerns (UI, logic, data)
- Comprehensive code documentation and JSDoc comments
- Automated testing for critical card workflows (creation, sharing, scanning)
- CI/CD pipeline for automated deployments via EAS Build
- Version control using Git with conventional commit messages
- Error logging with detailed context (user ID, card ID, error stack)
- Performance profiling and optimization procedures documented
- Database query optimization with compound indexes documented
- Regular security audits and dependency updates
- Update rollback procedures for production issues (Expo Updates)
- Feature flags for gradual rollout of new features
- Environment-specific configurations (dev, staging, prod)

---

## 7. Additional Requirements

### Environment Variables

**Firebase Authentication:**
```
FIREBASE_API_KEY="your-firebase-api-key"
FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
FIREBASE_APP_ID="your-app-id"
FIREBASE_MEASUREMENT_ID="your-measurement-id"
```

**Firebase Admin (Backend):**
```
FIREBASE_ADMIN_PRIVATE_KEY="your-private-key"
FIREBASE_ADMIN_CLIENT_EMAIL="your-client-email"
FIREBASE_ADMIN_PROJECT_ID="your-project-id"
```

### Communication Services

**SendGrid Email Service:**
```
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@xscard.app"
SENDGRID_FROM_NAME="XS Card"
```

**Twilio SMS Service:**
```
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_PHONE_NUMBER="+1234567890"
TWILIO_MESSAGING_SERVICE_SID="your-messaging-service-sid"
```

**Deep Linking:**
```
DEEP_LINK_DOMAIN="xscard.app"
DEEP_LINK_SCHEME="xscard"
FIREBASE_DYNAMIC_LINKS_DOMAIN="xscard.page.link"
```

**QR Code Configuration:**
```
QR_ENCRYPTION_KEY="your-qr-encryption-key"
QR_DEFAULT_STYLE="rounded"
QR_ERROR_CORRECTION_LEVEL="H"
QR_CODE_EXPIRY_DAYS="365"
MAX_QR_GENERATION_PER_MINUTE="10"
```

**App Configuration:**
```
APP_NAME="XS Card"
APP_VERSION="1.0.0"
APP_ENVIRONMENT="production"
APP_BUNDLE_ID_IOS="com.xscard.app"
APP_BUNDLE_ID_ANDROID="com.xscard.app"
MAX_CARDS_FREE="5"
MAX_CARDS_PREMIUM="20"
```

**Notification Preferences:**
```
NOTIFICATION_PUSH_ENABLED="true"
NOTIFICATION_EMAIL_ENABLED="true"
NOTIFICATION_SMS_ENABLED="false"
SHARE_CONFIRMATION_DELAY_MINUTES="5"
DAILY_DIGEST_HOUR="9"
```

**File Upload Configuration:**
```
MAX_FILE_SIZE_MB="10"
MAX_IMAGE_DIMENSION="2048"
ALLOWED_IMAGE_TYPES="jpg,jpeg,png,heic"
ALLOWED_DOCUMENT_TYPES="vcf,csv"
ENABLE_IMAGE_COMPRESSION="true"
IMAGE_COMPRESSION_QUALITY="0.8"
```

**Security & Compliance:**
```
ENCRYPTION_KEY="your-aes-encryption-key"
JWT_SECRET="your-jwt-secret"
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
AUDIT_LOG_RETENTION_DAYS="730"
GDPR_DATA_RETENTION_DAYS="730"
```

**Development:**
```
NODE_ENV="development"
EXPO_DEV_SERVER_PORT="8081"
ENABLE_DEBUG_LOGGING="true"
MOCK_QR_GENERATION="false"
MOCK_SHARING="false"
ENABLE_ANALYTICS_DEBUG="true"
```

### API Configuration

**Firebase Functions Endpoints:**
```
FUNCTIONS_BASE_URL="https://your-region-your-project-id.cloudfunctions.net"
FUNCTIONS_QR_GENERATION="/qrGeneration"
FUNCTIONS_SHARING="/sharingWorkflow"
FUNCTIONS_CONTACT_IMPORT="/contactImport"
FUNCTIONS_ANALYTICS="/analyticsAggregation"
FUNCTIONS_NOTIFICATION="/notificationDelivery"
```

**Third-Party API Endpoints:**
```
SENDGRID_API_URL="https://api.sendgrid.com/v3"
TWILIO_API_URL="https://api.twilio.com/2010-04-01"
LINKEDIN_API_URL="https://api.linkedin.com/v2"
```

### Database Configuration

**Firestore Collections:**
```
COLLECTION_USERS="users"
COLLECTION_CARDS="cards"
COLLECTION_QR_CODES="qr_codes"
COLLECTION_SHARING_HISTORY="sharing_history"
COLLECTION_RECEIVED_CARDS="received_cards"
COLLECTION_TEMPLATES="templates"
COLLECTION_ANALYTICS="analytics"
COLLECTION_NOTIFICATIONS="notifications"
COLLECTION_AUDIT_LOGS="audit_logs"
COLLECTION_CONTACT_IMPORTS="contact_imports"
```

**Firestore Indexes (composite indexes required):**
```
users: email (Ascending), created_at (Descending)
cards: user_id (Ascending), is_active (Ascending), updated_at (Descending)
qr_codes: card_id (Ascending), is_active (Ascending)
sharing_history: sender_user_id (Ascending), created_at (Descending)
sharing_history: card_id (Ascending), share_status (Ascending)
received_cards: user_id (Ascending), is_favorite (Descending), received_at (Descending)
analytics: card_id (Ascending), created_at (Descending)
notifications: user_id (Ascending), read_status (Ascending), created_at (Descending)
```

**Firebase Storage Buckets:**
```
STORAGE_BUCKET_PROFILES="profile-pictures"
STORAGE_BUCKET_LOGOS="company-logos"
STORAGE_BUCKET_QR_CODES="qr-codes"
STORAGE_BUCKET_CARD_BACKGROUNDS="card-backgrounds"
STORAGE_BUCKET_IMPORTS="contact-imports"
STORAGE_BUCKET_EXPORTS="contact-exports"
```

### Build Configuration

**EAS Build Settings:**
```
EAS_PROJECT_ID="xscard-app-production"
EAS_IOS_BUILD_NUMBER="1"
EAS_ANDROID_BUILD_NUMBER="1"
EAS_BUILD_IOS_PROFILE="production"
EAS_BUILD_ANDROID_PROFILE="production"
EAS_SUBMIT_APP_STORE="true"
EAS_SUBMIT_PLAY_STORE="true"
```

**App Icons and Assets:**
```
APP_ICON_IOS_PATH="./assets/ios/icon.png"
APP_ICON_ANDROID_PATH="./assets/android/icon.png"
APP_SPLASH_IOS_PATH="./assets/ios/splash.png"
APP_SPLASH_ANDROID_PATH="./assets/android/splash.png"
APP_ADAPTIVE_ICON_ANDROID="./assets/android/adaptive-icon.png"
```

### Feature Flags

**Development Features:**
```
FEATURE_TEMPLATE_CUSTOMIZATION="true"
FEATURE_QR_STYLES="true"
FEATURE_CONTACT_IMPORT="true"
FEATURE_ANALYTICS="true"
FEATURE_LINKEDIN_IMPORT="true"
FEATURE_PASSWORD_PROTECTED_CARDS="true"
FEATURE_CARD_EXPIRATION="true"
FEATURE_PUSH_NOTIFICATIONS="true"
FEATURE_EMAIL_SHARING="true"
FEATURE_SMS_SHARING="true"
```

**Beta Features:**
```
BETA_NFC_SHARING="false"
BETA_AR_CARD_PREVIEW="false"
BETA_AI_SUGGESTIONS="false"
BETA_TEAM_FEATURES="false"
BETA_CUSTOM_DOMAINS="false"
```

### Monitoring & Analytics

**Firebase Analytics:**
```
ANALYTICS_ENABLED="true"
ANALYTICS_COLLECTION_ENABLED="true"
CRASHLYTICS_ENABLED="true"
PERFORMANCE_MONITORING="true"
ANALYTICS_DEBUG_MODE="false"
```

**Error Tracking:**
```
SENTRY_DSN="your-sentry-dsn"
SENTRY_ENABLED="true"
SENTRY_ENVIRONMENT="production"
ERROR_REPORTING_ENABLED="true"
```

### Legal & Compliance

**Data Retention:**
```
AUDIT_LOG_RETENTION_DAYS="730"
CARD_DATA_RETENTION_DAYS="2555" # 7 years
INACTIVE_ACCOUNT_DAYS="730" # Delete after 2 years inactive
QR_CODE_RETENTION_AFTER_DELETE="30"
SHARING_HISTORY_RETENTION="365"
```

**Privacy & Consent:**
```
GDPR_COMPLIANCE_ENABLED="true"
CCPA_COMPLIANCE_ENABLED="true"
DATA_EXPORT_ENABLED="true"
ACCOUNT_DELETION_ENABLED="true"
CONSENT_TRACKING="true"
COOKIE_CONSENT_REQUIRED="false" # Mobile app
```

### Development Tools

**TypeScript Configuration:**
```
TYPESCRIPT_STRICT_MODE="true"
TYPESCRIPT_NO_UNUSED_LOCALS="true"
TYPESCRIPT_NO_UNUSED_PARAMETERS="true"
TYPESCRIPT_EXACT_OPTIONAL_PROPERTY_TYPES="true"
```

**Code Quality:**
```
ESLINT_ENABLED="true"
PRETTIER_ENABLED="true"
HUSKY_ENABLED="true"
COMMITLINT_ENABLED="true"
LINT_STAGED_ENABLED="true"
```

### Secrets Management

**Important Security Notes:**
- All environment variables must be stored securely in Expo Secrets for production
- Never commit .env files to version control
- Use secrets management services (GitHub Secrets, Expo Secrets)
- Rotate API keys every 90 days
- Different values for development, staging, and production environments
- Document all required environment variables in deployment guides
- Encrypt sensitive values in CI/CD pipelines
- Restrict Firebase service account keys to necessary permissions only
- Use Firebase App Check to prevent abuse of backend resources

---

**Document Version:** 1.0.0
**Last Updated:** April 14, 2026
**Author:** Product Team
**Status:** Approved for Development
