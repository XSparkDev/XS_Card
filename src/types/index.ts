import { registerRootComponent } from 'expo';

import App from '../../App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

export type Contact = {
  id: number;
  name: string;
  surname: string;
  number: string;
  email?: string; 
  position: string;
  company: string;
  dateAdded: string;
  image: any; // Consider using a more specific type for images
};

export interface PaymentPendingParams {
  eventId: string;
  paymentUrl?: string;
  paymentReference?: string;
  eventTitle?: string;
}

export type AdminTabParamList = {
  Analytics: undefined;
  Contacts: undefined;
  Calendar: undefined;
  Settings: undefined;
  Cards: undefined;
  SignIn: undefined;
  MainApp: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  MainTabs: undefined;
  CreateCard: undefined;
  CardPreview: { cardData: any };
  QRScanner: { event: any };
  SaveContact: { cardId: string; cardIndex?: number };
  AddCards: undefined;
  EditCard: { cardIndex: number; cardData?: any };
  UnlockPremium: undefined;
  SubscriptionManagement: undefined;
  PrivacySecurity: undefined; // NEW
  Events: undefined;
  EventDetails: { eventId: string; event?: any };
  EventPreferences: undefined;
  CreateEvent: undefined;
  EditEvent: { eventId: string; event?: any };
  MyEvents: undefined;
  MyEventsScreen: undefined; // Alternative name used in navigation
  PaymentPending: PaymentPendingParams;
  EventTicket: { event: any; ticket?: any };
  CheckInDashboard: { event: any };
  EventAnalytics: { event: any };
  OrganiserRegistration: undefined;
  Settings: undefined;
  AdminDashboard: { screen?: 'Analytics' | 'Calendar' } | undefined;
  CalendarPreferences: undefined;
};

export type RootTabParamList = {
  Cards: undefined;
  Contacts: undefined;
};

// Calendar Preferences Types
export interface WorkingHours {
  start: string;
  end: string;
  enabled: boolean;
  specificSlots?: string[]; // Optional: Array of specific time slots in HH:MM format (e.g., ["11:30", "13:00", "16:15"])
}

export interface BlockedDateRange {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  repeatMonthly?: boolean; // If true, repeats this range for all months
}

export interface CalendarPreferences {
  enabled: boolean;
  workingHours: {
    monday: WorkingHours;
    tuesday: WorkingHours;
    wednesday: WorkingHours;
    thursday: WorkingHours;
    friday: WorkingHours;
    saturday: WorkingHours;
    sunday: WorkingHours;
  };
  bufferTime: number;
  allowWeekends: boolean;
  allowedDurations: number[];
  timezone: string;
  advanceBookingDays: number;
  notificationEmail?: string; // Selected email for booking notifications
  blockedDateRanges?: BlockedDateRange[]; // Array of blocked date ranges
  defaultTimeRange?: { start: string; end: string }; // Default time range for all days
  customTimes?: boolean; // Enable custom times per day
}

export interface PublicBooking {
  name: string;
  email: string;
  phone: string;
  message?: string;
  date: string;
  time: string;
  duration: number;
}

export interface BookerInfo {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export interface Meeting {
  meetingWith: string;
  meetingWhen: Date | string;
  description: string;
  duration: number;
  location?: string;
  source?: 'public' | 'manual';
  bookerInfo?: BookerInfo;
  createdAt?: Date | string;
}

export type AuthStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  SignUp: { prefillEmail?: string } | undefined;
  ForgotPassword: undefined;
  CompleteProfile: { userId: string };
  MainApp: undefined;
  AdminDashboard: undefined;
};