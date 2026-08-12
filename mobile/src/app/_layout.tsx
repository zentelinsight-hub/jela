import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { FeatureProvider } from '@/contexts/feature-context';
import { ThemeProvider, useAppTheme } from '@/contexts/theme-context';
import { UpdateGate } from '@/components/update-gate';
import { LaunchSplash } from '@/components/launch-splash';

void SplashScreen.preventAutoHideAsync();

function NavigationRoot() {
  const { loading } = useAuth();
  const { colors, resolved } = useAppTheme();
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const finishSplash = useCallback(() => setShowLaunchSplash(false), []);

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  return (
    <>
      <StatusBar style={colors.statusBar} />
      <UpdateGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: resolved === 'dark' ? 'fade' : 'slide_from_right',
          }}
        />
      </UpdateGate>
      {!loading && showLaunchSplash ? <LaunchSplash onFinished={finishSplash} /> : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <AuthProvider>
        <ThemeProvider>
          <FeatureProvider>
            <NavigationRoot />
          </FeatureProvider>
        </ThemeProvider>
      </AuthProvider>
    </KeyboardProvider>
  );
}
