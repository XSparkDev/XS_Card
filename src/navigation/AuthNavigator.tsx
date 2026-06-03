import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import CompleteProfile from '../screens/auth/CompleteProfile';
import SplashScreen from '../screens/auth/SplashScreen';
import DashboardNavigator from './DashboardNavigator';
import { AuthStackParamList } from '../types';

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'white' }
      }}
      initialRouteName="Splash"
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      {/* SignUp uses an explicit horizontal slide so the transition feels like a
          natural forward step in the flow on both iOS and Android. */}
      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          transitionSpec: {
            open:  { animation: 'spring', config: { stiffness: 1000, damping: 500, mass: 3, overshootClamping: true, restDisplacementThreshold: 10, restSpeedThreshold: 10 } },
            close: { animation: 'spring', config: { stiffness: 1000, damping: 500, mass: 3, overshootClamping: true, restDisplacementThreshold: 10, restSpeedThreshold: 10 } },
          },
        }}
      />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfile} />
      <Stack.Screen 
        name="AdminDashboard" 
        component={DashboardNavigator}
        options={{
          gestureEnabled: true,
          animation: 'default'
        }}
      />
    </Stack.Navigator>
  );
} 