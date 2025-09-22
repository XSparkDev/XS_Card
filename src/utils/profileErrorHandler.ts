/**
 * Utility functions to detect and handle profile incomplete errors
 */

/**
 * Detects if an error indicates that the user's profile is incomplete
 * @param error - Error object or message
 * @returns boolean - true if error indicates incomplete profile
 */
export const isProfileIncompleteError = (error: any): boolean => {
  const errorMessage = error?.message || error?.toString() || '';
  
  // Common patterns that indicate incomplete profile
  const profileIncompletePatterns = [
    'No cards found for this user',
    'Failed to fetch QR code',
    'QR code generation failed',
    'User profile incomplete',
    'No profile data found',
    'Missing profile information',
    'Card generation failed',
    'Profile not found',
    'Unexpected API response structure'
  ];
  
  return profileIncompletePatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
};

/**
 * Checks if the error response indicates profile incomplete
 * @param response - API response object
 * @returns boolean - true if response indicates incomplete profile
 */
export const isProfileIncompleteResponse = (response: any): boolean => {
  if (!response) return false;
  
  // Check response status
  if (response.status === 404) return true;
  
  // Check response message
  if (response.message) {
    return isProfileIncompleteError({ message: response.message });
  }
  
  return false;
};
