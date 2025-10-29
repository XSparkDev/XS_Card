# 🏆 SUBSCRIPTION SYSTEM GOLDEN RULES

## 🚨 **ABSOLUTE NON-NEGOTIABLES**

### **1. MONEY FIRST - ZERO TOLERANCE FOR ASSUMPTIONS**
- **NEVER assume** payment amounts, plan details, or user intentions
- **ALWAYS verify** with Paystack API before processing any payment
- **ALWAYS validate** all financial data server-side
- **NEVER trust** client-side data for financial decisions
- **ALWAYS log** every financial transaction for audit trail

### **2. SECURITY IS MANDATORY - NOT OPTIONAL**
- **ALL webhooks MUST have signature verification**
- **ALL payment endpoints MUST be authenticated**
- **ALL financial data MUST be encrypted in transit and at rest**
- **NO financial operations without proper authorization**
- **ALL subscription changes MUST be logged and auditable**

### **3. DATA INTEGRITY IS CRITICAL**
- **ALL subscription updates MUST be atomic transactions**
- **NO partial updates allowed** - either all succeed or all fail
- **ALWAYS maintain data consistency** between users and subscriptions collections
- **ALWAYS validate data before database operations**
- **ALWAYS have rollback mechanisms for failed operations**

### **4. ERROR HANDLING IS MANDATORY**
- **NEVER silently fail** on financial operations
- **ALWAYS provide clear error messages** to users
- **ALWAYS log errors** with full context
- **ALWAYS have fallback mechanisms** for critical operations
- **ALWAYS test error scenarios** before production

### **5. TESTING IS NON-NEGOTIABLE**
- **ALL payment flows MUST be tested** with real Paystack test keys
- **ALL edge cases MUST be tested** before production
- **ALL error scenarios MUST be tested** and handled
- **ALL webhook scenarios MUST be tested** with real webhook data
- **NO code goes to production** without comprehensive testing

## 🔒 **SECURITY REQUIREMENTS**

### **Webhook Security**
- ✅ Signature verification using Paystack secret key
- ✅ Rate limiting on webhook endpoints
- ✅ IP whitelisting for webhook sources
- ✅ Request validation and sanitization
- ✅ Error handling without information leakage

### **Payment Security**
- ✅ Server-side payment verification only
- ✅ No client-side payment amount validation
- ✅ Encrypted storage of payment references
- ✅ Secure API key management
- ✅ Audit logging for all payment operations

### **Data Security**
- ✅ Encrypted sensitive data storage
- ✅ Secure database connections
- ✅ Input validation and sanitization
- ✅ SQL injection prevention
- ✅ XSS protection on all endpoints

## 📊 **DATA INTEGRITY REQUIREMENTS**

### **Atomic Operations**
- ✅ All subscription updates in single transaction
- ✅ Rollback on any failure
- ✅ Consistent data across all collections
- ✅ Validation before database writes
- ✅ Conflict resolution mechanisms

### **Audit Trail**
- ✅ Log all subscription changes
- ✅ Log all payment operations
- ✅ Log all user actions
- ✅ Log all system errors
- ✅ Maintain audit logs for compliance

## 🧪 **TESTING REQUIREMENTS**

### **Payment Testing**
- ✅ Test successful payments
- ✅ Test failed payments
- ✅ Test abandoned payments
- ✅ Test webhook delivery
- ✅ Test payment verification

### **Subscription Testing**
- ✅ Test subscription creation
- ✅ Test subscription cancellation
- ✅ Test subscription renewal
- ✅ Test trial periods
- ✅ Test plan changes

### **Error Testing**
- ✅ Test network failures
- ✅ Test API timeouts
- ✅ Test invalid data
- ✅ Test concurrent operations
- ✅ Test edge cases

## 🚀 **DEPLOYMENT REQUIREMENTS**

### **Pre-Production Checklist**
- ✅ All tests passing
- ✅ Security audit completed
- ✅ Performance testing done
- ✅ Error handling verified
- ✅ Monitoring in place

### **Production Readiness**
- ✅ Live keys configured
- ✅ Webhooks enabled and tested
- ✅ Monitoring and alerting active
- ✅ Backup and recovery tested
- ✅ Rollback plan ready

## 📋 **CODE QUALITY STANDARDS**

### **Code Review Requirements**
- ✅ All financial code reviewed by senior developer
- ✅ Security review for all payment code
- ✅ Performance review for all database operations
- ✅ Error handling review for all critical paths
- ✅ Documentation review for all public APIs

### **Documentation Requirements**
- ✅ API documentation updated
- ✅ Database schema documented
- ✅ Error codes documented
- ✅ Webhook events documented
- ✅ Testing procedures documented

## 🎯 **SUCCESS CRITERIA**

### **Functional Requirements**
- ✅ Users can subscribe successfully
- ✅ Users can cancel subscriptions
- ✅ Payments are processed correctly
- ✅ Webhooks are received and processed
- ✅ Data is consistent across all systems

### **Non-Functional Requirements**
- ✅ System handles 1000+ concurrent users
- ✅ Response times under 2 seconds
- ✅ 99.9% uptime for payment operations
- ✅ Zero data loss for financial operations
- ✅ Complete audit trail for all operations

---

## ⚠️ **VIOLATION CONSEQUENCES**

**ANY violation of these rules results in:**
1. **IMMEDIATE code review halt**
2. **MANDATORY security audit**
3. **REQUIRED additional testing**
4. **NO deployment until compliance**

**These rules are NON-NEGOTIABLE and apply to ALL subscription-related code.**
