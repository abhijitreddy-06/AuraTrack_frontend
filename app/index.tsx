import React from 'react';
import { useRouter } from 'expo-router';
import { SplashScreen } from '../src/screens/SplashScreen';
import { restoreSession } from '../src/services/auth';

export default function SplashRoute() {
  const router = useRouter();

  const handleFinish = async () => {
    const hasSession = await restoreSession();
    router.replace(hasSession ? '/home' : '/auth');
  };

  return <SplashScreen onFinish={handleFinish} />;
}