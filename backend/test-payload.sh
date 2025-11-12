#!/bin/bash
USER_ID="yR9TvgtUsqND6RwZuRQ0ArJF9653"
echo "Testing POST /AddContact with actual userId: $USER_ID"
curl -X POST http://192.168.68.113:8383/AddContact \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"contactInfo\": {
      \"name\": \"Test\",
      \"surname\": \"User\",
      \"phone\": \"+27791234567\",
      \"email\": \"test@example.com\",
      \"company\": \"Test Co\",
      \"howWeMet\": \"Testing\"
    }
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s
