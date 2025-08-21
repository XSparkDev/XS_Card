import { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Dashboard: undefined;
  CompleteProfile: undefined;
  SplashScreen: undefined;
  CardsScreen: undefined;
  AddCards: undefined;
  ContactScreen: undefined;
  EditCard: { cardIndex: number };
  EventsScreen: undefined;
  EventDetailsScreen: { eventId: string };
  CreateEventScreen: undefined;
  EditEventScreen: { eventId: string };
  MyEventsScreen: undefined;
  EventAnalyticsScreen: { eventId: string };
  EventTicketScreen: { event: Event, ticket: any };
  EventPreferencesScreen: undefined;
  QRScannerScreen: { eventId?: string };
  CheckInDashboard: { eventId: string };
  NetworkTestScreen: undefined;
  UnlockPremium: undefined;
  PaymentPending: {
    eventId: string;
    paymentUrl?: string;
    paymentReference?: string;
    eventTitle?: string;
    paymentType?: 'event_publishing' | 'event_registration';
    registrationId?: string;
  };
  OrganiserRegistration: undefined;
  Settings: undefined;
};

export type EditCardScreenRouteProp = RouteProp<RootStackParamList, 'EditCard'>;
