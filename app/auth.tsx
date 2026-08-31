import React from 'react';
import { useRouter } from 'expo-router';
import { AuthScreen } from '../src/screens/AuthScreen';

export default function AuthRoute() {
  const router = useRouter();

  const handleAuthSuccess = () => {
    router.replace('/home');
  };

  return <AuthScreen onSuccess={handleAuthSuccess} />;
}