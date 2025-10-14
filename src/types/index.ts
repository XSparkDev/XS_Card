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
  AdminDashboard: undefined;
};

export type RootTabParamList = {
  Cards: undefined;
  Contacts: undefined;
};

export type AuthStackParamList = {
  Splash: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CompleteProfile: { userId: string };
  MainApp: undefined;
  AdminDashboard: undefined;
};