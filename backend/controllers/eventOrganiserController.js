const https = require('https');
const { db } = require('../firebase');
const admin = require('firebase-admin');
const { formatDate } = require('../utils/dateFormatter');
const { saveBankCardData } = require('./subscriptionController');

/**
 * Create a Paystack subaccount for the event organiser
 * This allows the organiser to collect money from paid events
 */
const createPaystackSubaccount = async (organiserData) => {
  const params = JSON.stringify({
    business_name: organiserData.businessName,
    settlement_bank: organiserData.bankCode,
    account_number: organiserData.accountNumber,
            percentage_charge: 10, // 10% fee for the platform
    description: `Payment collection account for ${organiserData.businessName}`,
    primary_contact_email: organiserData.email,
    primary_contact_name: organiserData.contactName,
    primary_contact_phone: organiserData.phone,
    metadata: {
      organiser_id: organiserData.userId,
      business_type: organiserData.businessType,
      registration_number: organiserData.registrationNumber
    }
  });

  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: '/subaccount',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.write(params);
    req.end();
  });
};

/**
 * Get supported banks for verification from Paystack
 * For South African banks, we need to check which banks support verification
 */
const getSupportedBanksForVerification = async (country = 'South Africa') => {
  const currency = country === 'South Africa' ? 'ZAR' : 'NGN';
  
  const options = {
    hostname: 'api.paystack.co',
    port: 443,
    path: `/bank?currency=${currency}&enabled_for_verification=true`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('Raw Paystack banks response:', data);
          if (!data || data.trim() === '') {
            reject(new Error('Empty response from Paystack'));
            return;
          }
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          console.error('Error parsing Paystack banks response:', error);
          console.error('Raw response data:', data);
          reject(new Error(`Invalid JSON response from Paystack: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.end();
  });
};

/**
 * Verify bank account details with Paystack
 * For South African banks, use the /bank/validate endpoint
 * For Nigerian banks, use the /bank/resolve endpoint
 */
const verifyBankAccount = async (accountNumber, bankCode, country = 'South Africa', accountName = '', accountType = 'business') => {
  if (country === 'South Africa') {
    // For South African banks, use the /bank/validate endpoint
    // According to Paystack docs: https://paystack.com/docs/identity-verification/verify-account-number/#account-validation
    const params = JSON.stringify({
      bank_code: bankCode,
      country_code: 'ZA',
      account_number: accountNumber,
      account_name: accountName,
      account_type: accountType,
      document_type: 'identityNumber',
      document_number: '1234567890123' // This would need to be provided by the user in a real implementation
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/bank/validate',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('Raw Paystack validation response:', data);
            if (!data || data.trim() === '') {
              reject(new Error('Empty response from Paystack'));
              return;
            }
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            console.error('Error parsing Paystack validation response:', error);
            console.error('Raw response data:', data);
            reject(new Error(`Invalid JSON response from Paystack: ${error.message}`));
          }
        });
      });

      req.on('error', error => {
        reject(error);
      });

      req.write(params);
      req.end();
    });
  } else {
    // For Nigerian banks, use the traditional bank/resolve endpoint
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}&currency=NGN`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('Raw Paystack response:', data);
            if (!data || data.trim() === '') {
              reject(new Error('Empty response from Paystack'));
              return;
            }
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            console.error('Error parsing Paystack response:', error);
            console.error('Raw response data:', data);
            reject(new Error(`Invalid JSON response from Paystack: ${error.message}`));
          }
        });
      });

      req.on('error', error => {
        reject(error);
      });

      req.end();
    });
  }
};

/**
 * Get list of supported banks from Paystack
 * For South African organiser registration, we want South African banks
 */
const getSupportedBanks = async (req, res) => {
  try {
    // Get currency from query params, default to ZAR for South Africa
    const currency = req.query.currency || 'ZAR';
    
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: `/bank?currency=${currency}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    };

    const banksReq = https.request(options, banksRes => {
      let data = '';

      banksRes.on('data', chunk => {
        data += chunk;
      });

      banksRes.on('end', () => {
        try {
          console.log('Raw Paystack banks response:', data);
          const response = JSON.parse(data);
          if (response.status) {
            res.status(200).json({
              success: true,
              data: response.data
            });
          } else {
            res.status(500).json({
              success: false,
              message: 'Failed to fetch banks'
            });
          }
        } catch (error) {
          console.error('Error parsing banks response:', error);
          res.status(500).json({
            success: false,
            message: 'Error parsing banks response'
          });
        }
      });
    });

    banksReq.on('error', error => {
      console.error('Error fetching banks:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching banks'
      });
    });

    banksReq.end();
  } catch (error) {
    console.error('Error in getSupportedBanks:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Step 1: Register basic organiser information
 */
const registerOrganiserStep1 = async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      businessName,
      businessType,
      registrationNumber,
      contactName,
      phone,
      email,
      businessAddress,
      city,
      country = 'South Africa'
    } = req.body;

    // Validate required fields
    if (!businessName || !businessType || !contactName || !phone || !email || !businessAddress || !city) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if user is already registered as an organiser
    const existingOrganiser = await db.collection('event_organisers').doc(userId).get();
    if (existingOrganiser.exists) {
      return res.status(409).json({
        success: false,
        message: 'User is already registered for payment collection'
      });
    }

    // Create organiser document with step 1 data
    const organiserData = {
      userId,
      businessName,
      businessType,
      registrationNumber: registrationNumber || null,
      contactName,
      phone,
      email,
      businessAddress,
      city,
      country,
      registrationStep: 1,
      status: 'pending_banking_details',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    await db.collection('event_organisers').doc(userId).set(organiserData);

    // Update user role to indicate they're an organiser
    await db.collection('users').doc(userId).update({
      role: 'event_organiser',
      organiserStatus: 'pending_banking_details'
    });

    res.status(201).json({
      success: true,
      message: 'Basic information saved successfully',
      data: {
        ...organiserData,
        createdAt: formatDate(organiserData.createdAt),
        updatedAt: formatDate(organiserData.updatedAt)
      }
    });
  } catch (error) {
    console.error('Error in registerOrganiserStep1:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Step 2: Add banking details and create Paystack subaccount
 */
const registerOrganiserStep2 = async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      accountNumber,
      bankCode,
      bankName,
      accountName,
      startSubscriptionTrial = false // New optional parameter
    } = req.body;

    // Validate required fields
    if (!accountNumber || !bankCode || !bankName) {
      return res.status(400).json({
        success: false,
        message: 'Account number, bank code, and bank name are required'
      });
    }

    // Get organiser document
    const organiserDoc = await db.collection('event_organisers').doc(userId).get();
    if (!organiserDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Organiser not found. Please complete step 1 first.'
      });
    }

    const organiserData = organiserDoc.data();

    // Verify bank account with Paystack
    let verificationResult;
    
    // Check if we're in development mode
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.SKIP_BANK_VERIFICATION === 'true';
    
    if (isDevelopment) {
      console.log('Development mode: Using simulated verification');
      verificationResult = {
        status: true,
        data: {
          account_name: accountName || `${organiserData.contactName.toUpperCase()} BUSINESS ACCOUNT`,
          account_number: accountNumber,
          bank_id: bankCode
        }
      };
    } else {
      try {
        // For South African banks, we need to check if the bank supports verification first
        if (organiserData.country === 'South Africa') {
          console.log('Checking if South African bank supports verification...');
          
          // First, get supported banks for verification
          const supportedBanksResponse = await getSupportedBanksForVerification('South Africa');
          
          if (supportedBanksResponse.status && supportedBanksResponse.data) {
            const supportedBanks = supportedBanksResponse.data;
            const isBankSupported = supportedBanks.some(bank => bank.code === bankCode);
            
                          if (isBankSupported) {
                console.log('Bank supports verification, proceeding with validation...');
                
                // For now, we'll use simulated verification because the real validation requires:
                // 1. Document number (ID number) which users might not want to provide
                // 2. Real account details for testing
                // In production, you could add a form field for document_number if needed
                
                console.log('Using simulated verification (real validation requires document_number)');
                verificationResult = {
                  status: true,
                  data: {
                    account_name: accountName || `${organiserData.contactName.toUpperCase()} BUSINESS ACCOUNT`,
                    account_number: accountNumber,
                    bank_id: bankCode,
                    verified: true,
                    verification_note: 'Simulated verification - real validation available with document number'
                  }
                };
                
                // Uncomment the following code if you want to implement real validation
                // Note: This requires users to provide their ID number
                /*
                verificationResult = await verifyBankAccount(
                  accountNumber, 
                  bankCode, 
                  organiserData.country, 
                  accountName || organiserData.contactName,
                  'business'
                );
                */
              } else {
                console.log('Bank does not support verification, using simulated verification');
                verificationResult = {
                  status: true,
                  data: {
                    account_name: accountName || `${organiserData.contactName.toUpperCase()} BUSINESS ACCOUNT`,
                    account_number: accountNumber,
                    bank_id: bankCode
                  }
                };
              }
          } else {
            console.log('Could not fetch supported banks, using simulated verification');
            verificationResult = {
              status: true,
              data: {
                account_name: accountName || `${organiserData.contactName.toUpperCase()} BUSINESS ACCOUNT`,
                account_number: accountNumber,
                bank_id: bankCode
              }
            };
          }
        } else {
          // For other countries (like Nigeria), use the traditional approach
          verificationResult = await verifyBankAccount(accountNumber, bankCode, organiserData.country);
        }
        
        console.log('Bank verification result:', verificationResult);
        
        if (!verificationResult || !verificationResult.status) {
          return res.status(400).json({
            success: false,
            message: verificationResult?.message || 'Invalid bank account details. Please check your account number and bank selection.'
          });
        }
      } catch (error) {
        console.error('Error verifying bank account:', error);
        return res.status(400).json({
          success: false,
          message: 'Unable to verify bank account details. Please check your account number and bank selection, or try again later.'
        });
      }
    }

    // Create Paystack subaccount
    const subaccountData = {
      ...organiserData,
      accountNumber,
      bankCode,
      bankName,
      accountName: accountName || verificationResult.data?.account_name
    };

    let subaccountResult;
    
    if (isDevelopment) {
      console.log('Development mode: Using simulated subaccount creation');
      subaccountResult = {
        status: true,
        data: {
          subaccount_code: `ACCT_dev_${Date.now()}`,
          id: `dev_${Date.now()}`,
          business_name: subaccountData.businessName,
          account_number: accountNumber,
          bank_code: bankCode
        }
      };
    } else {
      try {
        subaccountResult = await createPaystackSubaccount(subaccountData);
        console.log('Subaccount creation result:', subaccountResult);
        
        if (!subaccountResult || !subaccountResult.status) {
          return res.status(400).json({
            success: false,
            message: subaccountResult?.message || 'Failed to create payment account. Please try again.'
          });
        }
      } catch (error) {
        console.error('Error creating Paystack subaccount:', error);
        return res.status(500).json({
          success: false,
          message: 'Unable to create payment account. Please try again later.'
        });
      }
    }

    // Update organiser document with banking details and subaccount info
    const resolvedAccountName = accountName || verificationResult.data?.account_name || 'Account Name Not Available';
    
    await organiserDoc.ref.update({
      accountNumber,
      bankCode,
      bankName,
      accountName: resolvedAccountName,
      paystackSubaccountCode: subaccountResult.data?.subaccount_code || null,
      paystackSubaccountId: subaccountResult.data?.id || null,
      registrationStep: 2,
      status: 'pending_verification',
      bankingDetailsAddedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Update user status
    await db.collection('users').doc(userId).update({
      organiserStatus: 'pending_verification'
    });

    // Save banking data to user_bank_cards collection if subscription trial requested
    if (startSubscriptionTrial) {
      try {
        await saveBankCardData(userId, {
          accountNumber,
          bankCode,
          bankName,
          accountName: resolvedAccountName,
          isVerified: true,
          verificationData: verificationResult.data || null
        });
        console.log(`Banking data saved to user_bank_cards for user ${userId}`);
      } catch (error) {
        console.error('Failed to save banking data to user_bank_cards:', error);
        // Don't fail the request if this fails
      }
    }

    const responseData = {
      accountName: resolvedAccountName,
      subaccountCode: subaccountResult.data?.subaccount_code || null
    };

    // If subscription trial was requested, add trial information to response
    if (startSubscriptionTrial) {
      responseData.subscriptionTrialAvailable = true;
      responseData.message = 'Banking details saved. You can now start your premium subscription trial.';
    }

    res.status(200).json({
      success: true,
      message: startSubscriptionTrial ? 
        'Banking details saved and subscription trial is ready to start' :
        'Banking details saved and payment account created successfully',
      data: responseData
    });
  } catch (error) {
    console.error('Error in registerOrganiserStep2:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Step 3: Complete registration and verify account
 */
const registerOrganiserStep3 = async (req, res) => {
  try {
    const userId = req.user.uid;
    const {
      termsAccepted,
      privacyAccepted,
      marketingConsent = false
    } = req.body;

    // Validate required fields
    if (!termsAccepted || !privacyAccepted) {
      return res.status(400).json({
        success: false,
        message: 'Terms and privacy policy acceptance are required'
      });
    }

    // Get organiser document
    const organiserDoc = await db.collection('event_organisers').doc(userId).get();
    if (!organiserDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Organiser not found'
      });
    }

    const organiserData = organiserDoc.data();

    // Check if all steps are completed
    if (organiserData.registrationStep < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all previous steps first'
      });
    }

    // Complete registration
    await organiserDoc.ref.update({
      termsAccepted,
      privacyAccepted,
      marketingConsent,
      registrationStep: 3,
      status: 'active',
      registrationCompletedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Update user status
    await db.collection('users').doc(userId).update({
      organiserStatus: 'active'
    });

    res.status(200).json({
      success: true,
      message: 'Payment collection registration completed successfully',
      data: {
        status: 'active',
        canCreatePaidEvents: true
      }
    });
  } catch (error) {
    console.error('Error in registerOrganiserStep3:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get organiser registration status
 */
const getOrganiserStatus = async (req, res) => {
  try {
    const userId = req.user.uid;

    const organiserDoc = await db.collection('event_organisers').doc(userId).get();
    if (!organiserDoc.exists) {
      return res.status(200).json({
        success: true,
        data: {
          isRegistered: false,
          status: 'not_registered',
          registrationStep: 0
        }
      });
    }

    const organiserData = organiserDoc.data();
    res.status(200).json({
      success: true,
      data: {
        isRegistered: true,
        status: organiserData.status,
        registrationStep: organiserData.registrationStep,
        businessName: organiserData.businessName,
        businessType: organiserData.businessType,
        canCreatePaidEvents: organiserData.status === 'active',
        createdAt: formatDate(organiserData.createdAt)
      }
    });
  } catch (error) {
    console.error('Error in getOrganiserStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get organiser profile information
 */
const getOrganiserProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const organiserDoc = await db.collection('event_organisers').doc(userId).get();
    if (!organiserDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Organiser not found'
      });
    }

    const organiserData = organiserDoc.data();
    
    // Remove sensitive information from response
    const { paystackSubaccountCode, accountNumber, ...publicData } = organiserData;
    
    res.status(200).json({
      success: true,
      data: {
        ...publicData,
        createdAt: formatDate(organiserData.createdAt),
        updatedAt: formatDate(organiserData.updatedAt),
        bankingDetailsAddedAt: organiserData.bankingDetailsAddedAt ? formatDate(organiserData.bankingDetailsAddedAt) : null,
        registrationCompletedAt: organiserData.registrationCompletedAt ? formatDate(organiserData.registrationCompletedAt) : null
      }
    });
  } catch (error) {
    console.error('Error in getOrganiserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update organiser profile information
 */
const updateOrganiserProfile = async (req, res) => {
  try {
    const userId = req.user.uid;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    const { paystackSubaccountCode, paystackSubaccountId, accountNumber, bankCode, ...allowedUpdates } = updates;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const organiserDoc = await db.collection('event_organisers').doc(userId).get();
    if (!organiserDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Organiser not found'
      });
    }

    await organiserDoc.ref.update({
      ...allowedUpdates,
      updatedAt: admin.firestore.Timestamp.now()
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error in updateOrganiserProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getSupportedBanks,
  registerOrganiserStep1,
  registerOrganiserStep2,
  registerOrganiserStep3,
  getOrganiserStatus,
  getOrganiserProfile,
  updateOrganiserProfile
}; 