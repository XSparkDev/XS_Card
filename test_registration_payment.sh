#!/bin/bash

# Test script for event registration payment flow
# This script simulates the entire flow of registering for a paid event

# Configuration
BASE_URL="https://xscard-app.onrender.com/api"
AUTH_TOKEN=""
EVENT_ID=""
REGISTRATION_ID=""
PAYMENT_REFERENCE=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}XSCard Event Registration Payment Test Script${NC}"
echo "----------------------------------------"

# Step 1: Login to get auth token
echo -e "${YELLOW}Step 1: Login to get auth token${NC}"
read -p "Enter email: " EMAIL
read -s -p "Enter password: " PASSWORD
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

AUTH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${RED}Login failed. Could not get auth token.${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
else
  echo -e "${GREEN}Login successful!${NC}"
  echo "Auth token obtained."
fi

# Step 2: Get list of published events to find a paid event
echo -e "\n${YELLOW}Step 2: Finding a paid event to register for...${NC}"

EVENTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/events/public" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

# Extract event IDs and titles for paid events
echo "Available paid events:"
echo $EVENTS_RESPONSE | grep -o '"id":"[^"]*","title":"[^"]*","eventType":"paid"' | while read -r line ; do
  ID=$(echo $line | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  TITLE=$(echo $line | grep -o '"title":"[^"]*' | cut -d'"' -f4)
  echo "ID: $ID - Title: $TITLE"
done

# Ask user to select an event
read -p "Enter the ID of the event you want to register for: " EVENT_ID

if [ -z "$EVENT_ID" ]; then
  echo -e "${RED}No event ID provided. Exiting.${NC}"
  exit 1
fi

# Step 3: Register for the event
echo -e "\n${YELLOW}Step 3: Registering for event ${EVENT_ID}...${NC}"

REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/events/${EVENT_ID}/register" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"specialRequests":"Test registration via API"}')

echo "Registration response: $REGISTER_RESPONSE"

# Check if payment is required
PAYMENT_REQUIRED=$(echo $REGISTER_RESPONSE | grep -o '"paymentRequired":true' | wc -l)

if [ "$PAYMENT_REQUIRED" -eq "1" ]; then
  echo -e "${GREEN}Payment is required for this event. Payment flow initiated.${NC}"
  
  # Extract payment details
  PAYMENT_URL=$(echo $REGISTER_RESPONSE | grep -o '"paymentUrl":"[^"]*' | cut -d'"' -f4)
  PAYMENT_REFERENCE=$(echo $REGISTER_RESPONSE | grep -o '"paymentReference":"[^"]*' | cut -d'"' -f4)
  REGISTRATION_ID=$(echo $REGISTER_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  
  echo "Payment URL: $PAYMENT_URL"
  echo "Payment Reference: $PAYMENT_REFERENCE"
  echo "Registration ID: $REGISTRATION_ID"
  
  # Step 4: Check payment status
  echo -e "\n${YELLOW}Step 4: Checking payment status...${NC}"
  
  # First status check (should be pending)
  PAYMENT_STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/events/${EVENT_ID}/registration/${REGISTRATION_ID}/payment/status" \
    -H "Authorization: Bearer ${AUTH_TOKEN}")
  
  echo "Initial payment status: $PAYMENT_STATUS_RESPONSE"
  
  # Step 5: Simulate payment completion
  echo -e "\n${YELLOW}Step 5: Would you like to simulate payment completion?${NC}"
  echo "1. Simulate successful payment"
  echo "2. Simulate failed payment"
  echo "3. Skip (manual payment via browser)"
  read -p "Select option (1-3): " PAYMENT_OPTION
  
  case $PAYMENT_OPTION in
    1)
      echo -e "\n${YELLOW}Simulating successful payment callback...${NC}"
      # This simulates the payment provider calling our callback URL
      CALLBACK_RESPONSE=$(curl -s -X GET "${BASE_URL}/events/registration/payment/callback?reference=${PAYMENT_REFERENCE}")
      echo "Callback response: $CALLBACK_RESPONSE"
      ;;
    2)
      echo -e "\n${YELLOW}Simulating failed payment...${NC}"
      # This would typically be handled by the payment provider
      echo "In a real scenario, the payment provider would notify about failure"
      ;;
    3)
      echo -e "\n${YELLOW}Please complete payment manually by visiting:${NC}"
      echo $PAYMENT_URL
      ;;
  esac
  
  # Step 6: Check final payment status
  echo -e "\n${YELLOW}Step 6: Checking final payment status...${NC}"
  
  FINAL_STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/events/${EVENT_ID}/registration/${REGISTRATION_ID}/payment/status" \
    -H "Authorization: Bearer ${AUTH_TOKEN}")
  
  echo "Final payment status: $FINAL_STATUS_RESPONSE"
  
  # Extract registration status
  REGISTRATION_STATUS=$(echo $FINAL_STATUS_RESPONSE | grep -o '"status":"[^"]*' | head -1 | cut -d'"' -f4)
  PAYMENT_STATUS=$(echo $FINAL_STATUS_RESPONSE | grep -o '"paymentStatus":"[^"]*' | head -1 | cut -d'"' -f4)
  
  if [ "$REGISTRATION_STATUS" == "registered" ] && [ "$PAYMENT_STATUS" == "completed" ]; then
    echo -e "${GREEN}Registration and payment completed successfully!${NC}"
  else
    echo -e "${YELLOW}Registration status: $REGISTRATION_STATUS${NC}"
    echo -e "${YELLOW}Payment status: $PAYMENT_STATUS${NC}"
  fi
  
else
  echo -e "${GREEN}Registration completed successfully! No payment required.${NC}"
fi

echo -e "\n${GREEN}Test completed!${NC}" 