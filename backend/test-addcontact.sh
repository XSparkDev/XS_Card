#!/bin/bash
echo "Testing POST /AddContact endpoint..."
curl -X POST http://192.168.68.113:8383/AddContact \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "1",
    "contactInfo": {
      "name": "Test",
      "surname": "User",
      "phone": "+1234567890",
      "email": "test@example.com",
      "company": "Test Co",
      "howWeMet": "Testing"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
