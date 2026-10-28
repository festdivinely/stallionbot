// Over-the-air updates (expo-updates, EAS Update): new screens and fixes reach the installed app
// without a new APK. When the app opens, or comes back to the screen, it asks Expo whether a newer
// update exists for this app version; if so it downloads it and asks before restarting, so a
// running trade is never interrupted by surprise. (Does nothing in development / Expo Go.)
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';

// Don't ask Expo more often than this when the app keeps coming back to the screen
const CHECK_EVERY_MS = 15 * 60_000;

export function useAppUpdates() {
    const lastCheck = useRef(0);
    const asking = useRef(false);

    useEffect(() => {
        if (__DEV__ || !Updates.isEnabled) return;

        const check = async () => {
            if (asking.current || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
            lastCheck.current = Date.now();
            try {
                const { isAvailable } = await Updates.checkForUpdateAsync();
                if (!isAvailable) return;
                const { isNew } = await Updates.fetchUpdateAsync();
                if (!isNew) return;
                asking.current = true;
                Alert.alert('Update ready', 'A new version of Stallion Trader has been downloaded. Restart the app to use it?', [
                    { text: 'Later', style: 'cancel', onPress: () => (asking.current = false) },
                    { text: 'Restart now', onPress: () => Updates.reloadAsync() },
                ]);
            } catch (error) {
                // No connection or Expo unreachable: try again next time
                console.warn('Update check failed', (error as Error).message);
            }
        };

        check();
        const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
        return () => sub.remove();
    }, []);
}
