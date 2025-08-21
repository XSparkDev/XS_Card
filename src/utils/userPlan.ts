import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserPlan = 'free' | 'premium' | 'enterprise';

export interface PlanLimits {
  maxImages: number;
  maxCards: number;
  hasAdvancedFeatures: boolean;
  hasPrioritySupport: boolean;
}

// Get user plan from storage
export const getUserPlan = async (): Promise<UserPlan> => {
  try {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const { plan } = JSON.parse(userData);
      return plan || 'free';
    }
    return 'free';
  } catch (error) {
    console.error('Error fetching user plan:', error);
    return 'free';
  }
};

// Check if user has premium features
export const isPremiumUser = async (): Promise<boolean> => {
  const plan = await getUserPlan();
  return plan === 'premium' || plan === 'enterprise';
};

// Get plan limits
export const getPlanLimits = (plan: UserPlan): PlanLimits => {
  switch (plan) {
    case 'enterprise':
      return {
        maxImages: 10, // Enterprise can have even more
        maxCards: -1, // Unlimited
        hasAdvancedFeatures: true,
        hasPrioritySupport: true,
      };
    case 'premium':
      return {
        maxImages: 5,
        maxCards: 10,
        hasAdvancedFeatures: true,
        hasPrioritySupport: false,
      };
    case 'free':
    default:
      return {
        maxImages: 1,
        maxCards: 1,
        hasAdvancedFeatures: false,
        hasPrioritySupport: false,
      };
  }
};

// Check if user can perform an action based on plan
export const canPerformAction = async (action: 'addImages' | 'addCards' | 'advancedFeatures'): Promise<{
  allowed: boolean;
  message?: string;
  upgradeRequired?: boolean;
}> => {
  const plan = await getUserPlan();
  const limits = getPlanLimits(plan);
  const isPremium = plan !== 'free';

  switch (action) {
    case 'addImages':
      if (limits.maxImages === 1) {
        return {
          allowed: false,
          message: 'Free users can add 1 image. Upgrade to Premium for up to 5 images.',
          upgradeRequired: true,
        };
      }
      return { allowed: true };

    case 'addCards':
      if (limits.maxCards === 1) {
        return {
          allowed: false,
          message: 'Free users can create 1 card. Upgrade to Premium for up to 10 cards.',
          upgradeRequired: true,
        };
      }
      return { allowed: true };

    case 'advancedFeatures':
      if (!limits.hasAdvancedFeatures) {
        return {
          allowed: false,
          message: 'This feature is available for Premium users only.',
          upgradeRequired: true,
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}; 