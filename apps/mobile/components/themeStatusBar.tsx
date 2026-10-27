import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { useThemeStore } from '../store/themeStore';
import { useEffect } from 'react';

export default function ThemeStatusBar() {
    // Get colors directly from store
    const colors = useThemeStore((state) => state.colors);
    const safeColors = colors || {
        primary: '#e17055',
        background: '#f5f5f5',
        cardBackground: '#fff',
        border: '#ccc',
        statusBar: '#e17055',
        textPrimary: '#333',
        textSecondary: '#666',
        textDark: '#000',
        black: '#000',
        white: '#fff',
        inputBackground: '#f0f0f0',
        placeholderText: '#666',
        warning: '#d63031',
        secondary: '#f0a500',
        success: '#00b894',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#f0f0f0',
    };

    const insets = useSafeAreaInsets();

    useEffect(() => {
        console.log('ThemeStatusBar: primary color:', safeColors.primary);
        if (Platform.OS === 'android') {
            // Android is always edge-to-edge now, so the bar has no background colour of its own:
            // the coloured View below paints behind it. We only pick light or dark buttons.
            const isLightColor = () => {
                const hex = safeColors.primary.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                return brightness > 125;
            };

            NavigationBar.setStyle(isLightColor() ? 'dark' : 'light');

            NavigationBar.setVisibilityAsync('visible')
                .catch((error) => console.error('Failed to set navigation bar visibility:', error));
        }
    }, [safeColors.primary]);

    // Determine status bar style based on background color brightness
    const isLightColor = () => {
        if (!safeColors.primary) return false;
        const hex = safeColors.primary.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness > 125;
    };

    return (
        <>
            <StatusBar style={isLightColor() ? "dark" : "light"} />
            <View
                style={{
                    height: insets.top,
                    backgroundColor: safeColors.primary,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1,
                }}
            />
            {Platform.OS === 'android' && insets.bottom > 0 && (
                <View
                    style={{
                        height: insets.bottom,
                        backgroundColor: safeColors.primary,
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1,
                    }}
                />
            )}
        </>
    );
}