// Phase 4C: Enhanced Error Handling
// Professional error handling with graceful degradation

import { Alert } from 'react-native';

export interface AppError {
  code: string;
  message: string;
  userMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  timestamp: number;
}

export interface ErrorHandlerOptions {
  showUserMessage?: boolean;
  logError?: boolean;
  fallbackAction?: () => void;
  retryAction?: () => Promise<void>;
  maxRetries?: number;
}

// Error codes for different scenarios
export const ERROR_CODES = {
  // Authentication Errors
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  
  // Network Errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_LOST: 'CONNECTION_LOST',
  
  // API Errors
  API_ERROR: 'API_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // App Errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// User-friendly error messages
const ERROR_MESSAGES = {
  [ERROR_CODES.TOKEN_EXPIRED]: {
    user: 'Your session has expired. Please log in again.',
    technical: 'Authentication token has expired',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.TOKEN_INVALID]: {
    user: 'Your session is invalid. Please log in again.',
    technical: 'Authentication token is invalid',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.TOKEN_REFRESH_FAILED]: {
    user: 'Unable to refresh your session. Please log in again.',
    technical: 'Token refresh operation failed',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.AUTHENTICATION_FAILED]: {
    user: 'Authentication failed. Please log in again.',
    technical: 'User authentication failed',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.NETWORK_ERROR]: {
    user: 'Please check your internet connection and try again.',
    technical: 'Network request failed',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.SERVER_ERROR]: {
    user: 'Something went wrong on our end. Please try again in a moment.',
    technical: 'Server returned an error response',
    severity: 'high' as const,
    recoverable: true,
  },
  [ERROR_CODES.TIMEOUT_ERROR]: {
    user: 'The request took too long. Please try again.',
    technical: 'Request timeout exceeded',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.CONNECTION_LOST]: {
    user: 'Connection lost. Please check your internet and try again.',
    technical: 'Network connection was lost',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.API_ERROR]: {
    user: 'Unable to complete the request. Please try again.',
    technical: 'API request failed',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.VALIDATION_ERROR]: {
    user: 'Please check your input and try again.',
    technical: 'Data validation failed',
    severity: 'low' as const,
    recoverable: true,
  },
  [ERROR_CODES.PERMISSION_DENIED]: {
    user: 'You don\'t have permission to perform this action.',
    technical: 'Insufficient permissions for requested operation',
    severity: 'medium' as const,
    recoverable: false,
  },
  [ERROR_CODES.RESOURCE_NOT_FOUND]: {
    user: 'The requested item could not be found.',
    technical: 'Requested resource does not exist',
    severity: 'medium' as const,
    recoverable: false,
  },
  [ERROR_CODES.STORAGE_ERROR]: {
    user: 'Unable to save data. Please try again.',
    technical: 'Local storage operation failed',
    severity: 'medium' as const,
    recoverable: true,
  },
  [ERROR_CODES.UNKNOWN_ERROR]: {
    user: 'An unexpected error occurred. Please try again.',
    technical: 'Unknown error occurred',
    severity: 'medium' as const,
    recoverable: true,
  },
} as const;

// Create standardized error object
export const createAppError = (
  code: keyof typeof ERROR_CODES,
  originalError?: Error | unknown,
  context?: Record<string, any>
): AppError => {
  const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
  
  return {
    code,
    message: originalError instanceof Error ? originalError.message : errorInfo.technical,
    userMessage: errorInfo.user,
    severity: errorInfo.severity,
    recoverable: errorInfo.recoverable,
    timestamp: Date.now(),
  };
};

// Enhanced error handler with retry logic
export class ErrorHandler {
  private static retryAttempts = new Map<string, number>();
  
  static async handleError(
    error: Error | AppError | unknown,
    options: ErrorHandlerOptions = {}
  ): Promise<boolean> {
    const {
      showUserMessage = true,
      logError = true,
      fallbackAction,
      retryAction,
      maxRetries = 3
    } = options;
    
    let appError: AppError;
    
    // Convert to AppError if needed
    if (error instanceof Error) {
      appError = this.categorizeError(error);
    } else if (this.isAppError(error)) {
      appError = error;
    } else {
      appError = createAppError(ERROR_CODES.UNKNOWN_ERROR, error as Error);
    }
    
    // Log error if requested
    if (logError) {
      this.logError(appError);
    }
    
    // Handle retry logic
    if (retryAction && appError.recoverable) {
      const retryKey = `${appError.code}_${Date.now()}`;
      const attempts = this.retryAttempts.get(retryKey) || 0;
      
      if (attempts < maxRetries) {
        this.retryAttempts.set(retryKey, attempts + 1);
        
        try {
          console.log(`[Error Handler] Retrying operation (attempt ${attempts + 1}/${maxRetries})`);
          await retryAction();
          this.retryAttempts.delete(retryKey);
          return true; // Success after retry
        } catch (retryError) {
          console.error(`[Error Handler] Retry attempt ${attempts + 1} failed:`, retryError);
          
          if (attempts + 1 >= maxRetries) {
            this.retryAttempts.delete(retryKey);
            // Show user message after all retries failed
            if (showUserMessage) {
              this.showUserMessage(appError);
            }
          }
          return false;
        }
      }
    }
    
    // Show user message if no retry or retry failed
    if (showUserMessage && !retryAction) {
      this.showUserMessage(appError);
    }
    
    // Execute fallback action
    if (fallbackAction) {
      try {
        fallbackAction();
      } catch (fallbackError) {
        console.error('[Error Handler] Fallback action failed:', fallbackError);
      }
    }
    
    return false;
  }
  
  // Categorize generic errors into specific error types
  private static categorizeError(error: Error): AppError {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return createAppError(ERROR_CODES.NETWORK_ERROR, error);
    }
    
    if (message.includes('token') && message.includes('expired')) {
      return createAppError(ERROR_CODES.TOKEN_EXPIRED, error);
    }
    
    if (message.includes('authentication') || message.includes('unauthorized')) {
      return createAppError(ERROR_CODES.AUTHENTICATION_FAILED, error);
    }
    
    if (message.includes('permission') || message.includes('forbidden')) {
      return createAppError(ERROR_CODES.PERMISSION_DENIED, error);
    }
    
    if (message.includes('storage') || message.includes('asyncstorage')) {
      return createAppError(ERROR_CODES.STORAGE_ERROR, error);
    }
    
    return createAppError(ERROR_CODES.UNKNOWN_ERROR, error);
  }
  
  // Type guard for AppError
  private static isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'userMessage' in error
    );
  }
  
  // Log error with appropriate level
  private static logError(error: AppError): void {
    const logData = {
      code: error.code,
      message: error.message,
      severity: error.severity,
      timestamp: new Date(error.timestamp).toISOString(),
      recoverable: error.recoverable,
    };
    
    switch (error.severity) {
      case 'critical':
        console.error('[CRITICAL ERROR]', logData);
        break;
      case 'high':
        console.error('[HIGH ERROR]', logData);
        break;
      case 'medium':
        console.warn('[MEDIUM ERROR]', logData);
        break;
      case 'low':
        console.log('[LOW ERROR]', logData);
        break;
    }
  }
  
  // Show user-friendly message (to be implemented with your preferred UI method)
  private static showUserMessage(error: AppError): void {
    // Use React Native's Alert for user notifications
    Alert.alert(
      'Error',
      error.userMessage,
      [
        {
          text: 'OK',
          style: 'default',
        },
      ],
      { cancelable: true }
    );
    
    // Also log for debugging
    console.log(`[User Message] ${error.userMessage}`);
  }
}

// Convenience functions for common error scenarios
export const handleAuthError = (error: unknown, fallbackAction?: () => void) => {
  return ErrorHandler.handleError(error, {
    showUserMessage: false, // No popups for auth errors
    logError: true,
    fallbackAction,
  });
};

export const handleNetworkError = (error: unknown, retryAction?: () => Promise<void>) => {
  return ErrorHandler.handleError(error, {
    showUserMessage: true,
    logError: true,
    retryAction,
    maxRetries: 3,
  });
};

export const handleStorageError = (error: unknown) => {
  return ErrorHandler.handleError(error, {
    showUserMessage: true,
    logError: true,
  });
};

// Error boundary helper for React components
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorOptions?: ErrorHandlerOptions
) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      await ErrorHandler.handleError(error, errorOptions);
      return null;
    }
  };
}; 