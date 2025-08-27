import { Event } from './events';

export { Event };

export interface AttendeeDetail {
  name: string;
  email: string;
  phone?: string;
}

export interface BulkRegistrationRequest {
  quantity: number;
  attendeeDetails: AttendeeDetail[];
  paymentMethod?: string;
}

export interface BulkRegistrationResponse {
  success: boolean;
  message: string;
  data: {
    bulkRegistrationId: string;
    paymentUrl?: string;
    reference?: string;
    totalAmount: number;
    quantity: number;
  };
}

export interface BulkRegistrationDetails {
  id: string;
  eventId: string;
  userId: string;
  quantity: number;
  totalAmount: number;
  status: 'pending' | 'completed' | 'cancelled';
  paymentMethod?: string;
  attendeeDetails: AttendeeDetail[];
  createdAt: any;
  updatedAt: any;
  paymentReference?: string;
  paymentUrl?: string;
  paymentStatus?: string;
  completedAt?: any;
  ticketIds?: string[];
  tickets?: any[];
  event?: Event;
}

export interface BulkRegistrationState {
  quantity: number;
  attendeeDetails: AttendeeDetail[];
  currentStep: 'quantity' | 'details' | 'review' | 'payment';
  validation: ValidationState;
  cost: number;
  loading: boolean;
  error: string | null;
  event?: Event;
}

export interface ValidationState {
  quantity: boolean;
  attendees: boolean[];
  overall: boolean;
  errors: string[];
}

export interface BulkRegistrationStep {
  id: 'quantity' | 'details' | 'review' | 'payment';
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
}

export interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  maxQuantity?: number;
  ticketPrice: number;
  eventCapacity?: number;
  currentRegistrations?: number;
}

export interface AttendeeFormProps {
  quantity: number;
  attendeeDetails: AttendeeDetail[];
  onAttendeeDetailsChange: (details: AttendeeDetail[]) => void;
  onValidationChange: (validation: ValidationState) => void;
}

export interface BulkRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  event: Event;
  onSuccess?: (bulkRegistrationId: string) => void;
}

export interface BulkRegistrationSummaryProps {
  event: Event;
  quantity: number;
  attendeeDetails: AttendeeDetail[];
  totalCost: number;
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
} 