// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SafeScreen from '../components/SafeScreen';
import { useAuthStore } from '../store/authStore';
import ThemeStatusBar from '../components/themeStatusBar';
import ThemeSelector from '../components/themeSelector';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { installThemedAlert, ThemedAlertHost } from '../components/ThemedAlert';

// Every Alert.alert(...) in the app now shows the themed dialog instead of the plain system box
installThemedAlert();

export default function RootLayout() {
  const { isAuthenticated, initializeAuth } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  // True once the saved login has been checked. It lives in the auth store (not in this
  // component), so the two always start over together: when the login code is reloaded during
  // development, the store resets to "logged out" and a flag kept here would have said "already
  // checked", sending a logged-in user to the login screen.
  const isReady = useAuthStore((s) => s.authChecked);
  const setIsReady = (ready: boolean) => useAuthStore.setState({ authChecked: ready });

  // App font (see constants/fonts.ts). If loading fails we carry on with the system font.
  const [fontsLoaded, fontError] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });
  const fontsReady = fontsLoaded || !!fontError;

  // Initialize auth once on mount
  useEffect(() => {
    const init = async () => {
      console.log('RootLayout: Starting auth initialization');
      try {
        await initializeAuth();
        console.log('RootLayout: Auth initialization complete');
      } catch (error) {
        // Continue as logged out rather than leaving the loading spinner up forever
        console.error('RootLayout: Auth initialization failed', error);
      } finally {
        setIsReady(true);
      }
    };

    // Also re-runs if the store was reset by a code reload (authChecked back to false)
    if (!useAuthStore.getState().authChecked) init();
  }, [isReady]);

  // This is the ONLY place that guards routes, so screens don't fight over navigation.
  // It only steps in when you are somewhere you shouldn't be; the login screens still
  // navigate on their own after a successful login.
  useEffect(() => {
    if (!isReady) return;

    // FOR TESTING: uncomment to always open a specific auth screen
    // router.replace('/(auth)/TOTPVerification'); return;

    // Screens that need a login: the tabs and every broker's screens
    const inPrivate = segments[0] === '(tabs)' || segments[0] === 'deriv';
    // The landing page (app/index.tsx) has no segments; the typed routes don't model that case
    const onLanding = (segments as string[]).length === 0;

    if (!isAuthenticated && inPrivate) {
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
            <Stack.Screen name="deriv" />
          </Stack>

          {/* Covers the screens until the saved login is checked and the font has loaded */}
          {(!isReady || !fontsReady) && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#0000ff" />
            </View>
          )}
        </SafeScreen>

        {/* One palette button (theme colours) for every screen, draggable anywhere on screen */}
        {isReady && fontsReady && <ThemeSelector draggable />}

        {/* Shows Alert.alert messages (login, verification, errors...) in the app's theme */}
        <ThemedAlertHost />

        {/* Last, so the coloured strips behind the status and navigation bars are drawn on top */}
        <ThemeStatusBar />
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
