# Event Registration Payment Integration Plan

## Overview
This document outlines the implementation plan for integrating payment processing into the event registration system. The implementation will leverage the existing Paystack integration used for event publishing payments, adapting it to handle user payments for paid events before completing registration.

## Current System Analysis
The existing event publishing payment flow:

- Event creation with eventType: 'paid' and ticketPrice
- Publishing triggers payment if required
- Paystack transaction initialization with callback/webhook
- Payment verification and event status update
- Credit system integration for free publishing

## Implementation Phases

### Phase 1: Backend Payment Infrastructure for Event Registration

#### 1.1 Database Schema Updates
Extend event_registrations collection with payment fields:

- paymentStatus: 'pending' | 'completed' | 'failed' | 'abandoned'
- paymentReference: Paystack reference
- paymentAmount: Amount paid in cents
- paymentInitiatedAt: Timestamp
- paymentCompletedAt: Timestamp
- paymentUrl: Paystack payment URL

#### 1.2 Registration Controller Enhancements
Modify registerForEvent endpoint to handle paid events:
- Check if event requires payment (eventType: 'paid' and ticketPrice > 0)
- Create registration with pending_payment status
- Initialize Paystack transaction with event ticket price
- Return payment URL and reference instead of immediate success
- Store payment metadata including eventId, userId, registrationId

#### 1.3 Payment Verification System
- Create registration payment callback endpoint: /events/registration/payment/callback
- Create registration payment webhook endpoint: /events/registration/payment/webhook
- Add payment verification function for registration payments
- Handle successful payment by:
  - Updating registration status to 'registered'
  - Updating ticket status to 'active'
  - Incrementing event attendee count
  - Sending organizer notification

#### 1.4 Payment Status Checking
- Add endpoint: /events/:eventId/registration/:registrationId/payment/status
- Support polling for payment completion
- Handle abandoned/failed payments by reverting registration

### Phase 2: Frontend Payment Integration

#### 2.1 Registration Flow Updates
- Modify registerForEvent service function to handle payment responses
- Update EventDetailsScreen to show different states:
  - Free events: Direct registration
  - Paid events: Payment required flow
  - Payment pending: Show payment status

#### 2.2 Payment UI Components
- Create EventPaymentScreen component for handling paid event registration
- Payment confirmation modal with event details and price
- Payment status polling component
- Success/failure screens for registration payments

#### 2.3 Registration Status Management
- Update registration state handling in events context
- Add payment status to user registration data
- Handle payment completion notifications

### Phase 3: Enhanced Payment Features

#### 3.1 Payment Receipt System
- Generate payment receipts for completed registrations
- Email confirmation with payment details
- Integration with existing QR code system for paid tickets

#### 3.2 Refund Handling
- Add refund capability for event cancellations
- Partial refund support for policy-based scenarios
- Refund notification system

#### 3.3 Analytics and Reporting
- Track conversion rates for payment initiation to completion
- Generate payment reports for event organizers
- Integrate with financial dashboard

## Implementation Timeline
- Phase 1: 2 weeks
- Phase 2: 2 weeks
- Phase 3: 3 weeks
- Testing and deployment: 1 week

## Technical Considerations
- Reuse existing Paystack integration code where possible
- Ensure proper error handling for payment failures
- Implement idempotent payment processing
- Add comprehensive logging for payment operations
- Consider security implications for payment data

## Testing Strategy
- Unit tests for payment processing functions
- Integration tests for payment flow
- End-to-end tests for complete registration with payment
- Manual testing with Paystack test cards
- Performance testing for payment status polling 