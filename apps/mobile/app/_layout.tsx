// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SafeScreen from '../components/SafeScreen';
import { useAuthStore } from '../store/authStore';
import ThemeStatusBar from '../components/themeStatusBar';

export default function RootLayout() {
  const { isAuthenticated, initializeAuth } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // True once the saved login has been checked. We use our own flag instead of the store's
  // isLoading, because isLoading also turns on during login/sign-up requests.
  const [isReady, setIsReady] = useState(false);

  // Initialize auth once on mount
  useEffect(() => {
    const init = async () => {
      console.log('RootLayout: Starting auth initialization');
      await initializeAuth();
      setIsReady(true);
      console.log('RootLayout: Auth initialization complete');
    };

    init();
  }, []);

  // This is the ONLY place that guards routes, so screens don't fight over navigation.
  // It only steps in when you are somewhere you shouldn't be; the login screens still
  // navigate on their own after a successful login.
  useEffect(() => {
    if (!isReady) return;

    // FOR TESTING: uncomment to always open a specific auth screen
    // router.replace('/(auth)/TOTPVerification'); return;

    const inTabs = segments[0] === '(tabs)';
    // The landing page (app/index.tsx) has no segments; the typed routes don't model that case
    const onLanding = (segments as string[]).length === 0;

    if (!isAuthenticated && inTabs) {
      console.log('RootLayout: Not authenticated, redirecting to auth index');
      router.replace('/(auth)');
    } else if (isAuthenticated && onLanding) {
      console.log('RootLayout: Authenticated, redirecting to /(tabs)');
      router.replace('/(tabs)');
    }
  }, [isReady, isAuthenticated, segments]);

  // The Stack must always be rendered: Expo Router breaks ("route names changed ... not handled
  // by any navigator") if the navigator disappears and comes back. The spinner covers it instead.
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeStatusBar />
        <SafeScreen>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>

          {!isReady && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0000ff" />
            </View>
          )}
        </SafeScreen>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
