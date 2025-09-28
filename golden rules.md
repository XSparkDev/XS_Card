account for best practices.
do not make any mock or simulated requests or responses.
ZERO tolarence for assumptions without first asking for clarification
don't apply code withut first checking whether or not you can reuse or extend already existing functions to complete your current task
1. Account for Best Practices
Follow Apple's IAP guidelines and documentation
Implement proper error handling and user feedback
Use secure receipt validation patterns
Maintain clean separation of concerns
Follow existing code patterns and architecture
2. No Mock/Simulated Requests or Responses
Use real Apple sandbox environment for testing
Implement actual StoreKit integration
Use real receipt validation endpoints
Test with actual Apple test accounts
No placeholder or fake data
3. Zero Tolerance for Assumptions
Verify all Apple IAP requirements before implementation
Ask for clarification on subscription product IDs
Confirm App Store Connect configuration details
Validate all API endpoints and parameters
Check existing code patterns before adding new functionality
4. Reuse/Extend Existing Functions
Leverage existing authentication middleware
Extend current subscription status logic
Reuse existing error handling patterns
Build upon current user management system
Extend existing API structure
5. Additive Changes Only
Add new IAP functionality without modifying existing Paystack code
Create new endpoints alongside existing ones
Add new UI components without changing existing ones
Implement feature flags for gradual rollout
Maintain backward compatibility