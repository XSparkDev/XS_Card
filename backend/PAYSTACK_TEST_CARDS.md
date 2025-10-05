# 🧪 PAYSTACK TEST CARD NUMBERS FOR FAILURE TESTING

## **💳 FAILURE TEST CARDS**

### **Insufficient Funds**
```
Card Number: 4084084084084081
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
```

### **Declined Card**
```
Card Number: 4084084084084085
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
```

### **Invalid Card**
```
Card Number: 4084084084084082
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
```

### **Expired Card**
```
Card Number: 4084084084084083
Expiry: Any past date (e.g., 01/20)
CVV: Any 3 digits (e.g., 123)
```

## **🎯 RECOMMENDED TEST FLOW**

1. **First Payment (SUCCESS)**: Use normal test card
   - Card: 4084084084084081 (normal test card)
   - This will succeed and activate subscription

2. **Second Payment (FAILURE)**: Use failure test card
   - Card: 4084084084084085 (declined card)
   - This will fail and trigger retry system

## **📱 TESTING STEPS**

1. **Sign in** with `dirax26227@bitmens.com`
2. **Start trial** (2 minutes)
3. **First payment** with success card → SUCCESS
4. **Wait for retry system** to trigger
5. **Second payment** with failure card → FAILURE
6. **Watch retry attempts** at 1, 2, 3 minute intervals
7. **Grace period** starts after all retries fail
8. **Cancel subscription** during grace period

## **🔍 VERIFICATION**

After using failure card, you should see:
- Payment failure webhook
- Retry scheduling logs
- Failure notifications
- Grace period activation
- Complete audit trail

**Total test time: ~10 minutes with real payment failures!**


