import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { THEME_COLORS, Theme } from '../../constants/colors';

// Define type for the colors object
interface Colors {
    background: string;
    cardBackground: string;
    border: string;
    primary: string;
    textPrimary: string;
    textSecondary: string;
    textDark: string;
    black: string;
    white: string;
    inputBackground: string;
    placeholderText: string;
}

// Define type for the styles object
interface Styles {
    container: ViewStyle;
    card: ViewStyle;
    header: ViewStyle;
    formContainer: ViewStyle;
    title: TextStyle;
    subtitle: TextStyle;
    inputGroup: ViewStyle;
    label: TextStyle;
    inputContainer: ViewStyle;
    inputIcon: TextStyle;
    input: TextStyle;
    eyeIconContainer: ViewStyle;
    eyeIcon: TextStyle;
    button: ViewStyle;
    buttonText: TextStyle;
    footer: ViewStyle;
    footerText: TextStyle;
    link: TextStyle;
    errorText: TextStyle;
}

// Helper function to handle 'custom' theme fallback
const getSafeTheme = (theme: Theme | 'custom'): Theme => {
    return theme === 'custom' ? 'retro' : theme;
};

const createStyles = (theme: Theme | 'custom'): Styles => {
    // Convert 'custom' theme to 'retro' for color lookup
    const safeTheme = getSafeTheme(theme);
    const COLORS: Colors = THEME_COLORS[safeTheme];

    return StyleSheet.create({
        container: {
            flexGrow: 1,
            backgroundColor: COLORS.background,
            padding: 20,
            justifyContent: 'center',
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
            borderWidth: 2,
            borderColor: COLORS.border,
        },
        header: {
            marginBottom: 16,
        },
        formContainer: {
            marginBottom: 16,
        },
        title: {
            fontSize: 32,
            fontWeight: '700',
            fontFamily: 'JetBrainsMono-Medium',
            color: COLORS.textPrimary,
            marginBottom: 8,
            textAlign: 'center',
        },
        subtitle: {
            fontSize: 16,
            color: COLORS.textSecondary,
            textAlign: 'center',
            marginBottom: 24,
        },
        inputGroup: {
            marginBottom: 20,
        },
        label: {
            fontSize: 14,
            marginBottom: 8,
            color: COLORS.textPrimary,
            fontWeight: '500',
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.inputBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
        },
        inputIcon: {
            marginRight: 10,
        },
        input: {
            flex: 1,
            height: 48,
            color: COLORS.textDark,
        },
        eyeIconContainer: {
            padding: 8,
        },
        eyeIcon: {
            padding: 8,
        },
        button: {
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 16,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        buttonText: {
            color: COLORS.white,
            fontSize: 16,
            fontWeight: '600',
        },
        footer: {
            flexDirection: 'row',
            justifyContent: 'center',
            marginTop: 24,
        },
        footerText: {
            color: COLORS.textSecondary,
            marginRight: 5,
        },
        link: {
            color: COLORS.primary,
            fontWeight: '600',
        },
        errorText: {
            color: '#ff3333',
            fontSize: 14,
            marginTop: 8,
            marginBottom: 16,
            textAlign: 'center',
        },
    });
};

export default createStyles;