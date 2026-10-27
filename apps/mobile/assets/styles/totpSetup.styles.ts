import { StyleSheet, ViewStyle, TextStyle, ImageStyle, Dimensions } from 'react-native';
import { THEME_COLORS, Theme } from '../../constants/colors';

const { width } = Dimensions.get('window');

interface Styles {
    container: ViewStyle;
    scrollViewContent: ViewStyle;
    backButton: ViewStyle;
    topIllustration: ViewStyle;
    illustrationImage: ImageStyle;
    card: ViewStyle;
    header: ViewStyle;
    title: TextStyle;
    subtitle: TextStyle;
    formContainer: ViewStyle;
    instruction: TextStyle;
    secretContainer: ViewStyle;
    secretBox: ViewStyle;
    secretText: TextStyle;
    secretNote: TextStyle;
    entryConfirmation: ViewStyle;
    entryButton: ViewStyle;
    entryButtonText: TextStyle;
    actionButtons: ViewStyle;
    button: ViewStyle;
    buttonDisabled: ViewStyle;
    buttonText: TextStyle;
    skipButton: ViewStyle;
    skipButtonText: TextStyle;
    noteContainer: ViewStyle;
    noteText: TextStyle;
}

// Helper function to handle 'custom' theme fallback
const getSafeTheme = (theme: Theme | 'custom'): Theme => {
    return theme === 'custom' ? 'retro' : theme;
};

const createStyles = (theme: Theme | 'custom'): Styles => {
    // Convert 'custom' theme to 'retro' for color lookup
    const safeTheme = getSafeTheme(theme);
    const COLORS = THEME_COLORS[safeTheme];

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
        },
        scrollViewContent: {
            flexGrow: 1,
            padding: 20,
            justifyContent: 'center',
        },
        backButton: {
            position: 'absolute',
            left: 20,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.cardBackground,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        topIllustration: {
            alignItems: 'center',
            width: '100%',
            marginBottom: 20,
        },
        illustrationImage: {
            width: width * 0.75,
            height: width * 0.75,
        },
        card: {
            backgroundColor: COLORS.cardBackground,
            borderRadius: 16,
            padding: 24,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        header: {
            alignItems: 'center',
            marginBottom: 32,
        },
        title: {
            fontSize: 28,
            fontWeight: '700',
            marginBottom: 8,
            textAlign: 'center',
            color: COLORS.primary,
        },
        subtitle: {
            fontSize: 16,
            textAlign: 'center',
            color: COLORS.textSecondary,
        },
        formContainer: {
            marginBottom: 16,
        },
        instruction: {
            fontSize: 16,
            fontWeight: '500',
            textAlign: 'center',
            color: COLORS.textPrimary,
        },
        secretContainer: {
            marginBottom: 16,
        },
        secretBox: {
            backgroundColor: COLORS.inputBackground,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: COLORS.primary,
            minHeight: 60,
            justifyContent: 'center',
        },
        secretText: {
            fontSize: 18,
            fontFamily: 'monospace',
            letterSpacing: 1,
        },
        secretNote: {
            fontSize: 14,
            textAlign: 'center',
            color: COLORS.textSecondary,
        },
        entryConfirmation: {
            marginVertical: 24,
        },
        entryButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 12,
            borderWidth: 2,
            gap: 10,
        },
        entryButtonText: {
            fontSize: 16,
            fontWeight: '600',
        },
        actionButtons: {
            gap: 12,
        },
        button: {
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            fontSize: 16,
            fontWeight: '600',
            color: COLORS.white,
        },
        skipButton: {
            borderRadius: 12,
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
        },
        skipButtonText: {
            fontSize: 16,
            fontWeight: '500',
        },
        noteContainer: {
            marginTop: 24,
            padding: 16,
            backgroundColor: COLORS.inputBackground,
            borderRadius: 12,
        },
        noteText: {
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
        },
    });
};

export default createStyles;