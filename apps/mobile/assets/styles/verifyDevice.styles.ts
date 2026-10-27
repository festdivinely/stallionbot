import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

export interface ThemeColors {
    background: string;
    cardBackground: string;
    border: string;
    primary: string;
    textPrimary: string;
    textSecondary: string;
    textDark: string;
    white: string;
    inputBackground: string;
}

type Styles = {
    container: ViewStyle;
    card: ViewStyle;
    header: ViewStyle;
    title: TextStyle;
    subtitle: TextStyle;
    formContainer: ViewStyle;
    inputGroup: ViewStyle;
    label: TextStyle;
    inputContainer: ViewStyle;
    inputIcon: TextStyle;
    input: TextStyle;
    eyeIcon: TextStyle;
    eyeIconContainer: ViewStyle;
    button: ViewStyle;
    buttonText: TextStyle;
    footer: ViewStyle;
    footerText: TextStyle;
    link: TextStyle;
    securityNote: ViewStyle;
    securityText: TextStyle;
    error: TextStyle;
}

const createStyles = (COLORS: ThemeColors, theme: string) =>
    StyleSheet.create<Styles>({
        container: {
            flexGrow: 1,
            padding: 20,
            justifyContent: 'center',
            backgroundColor: COLORS.background,
        },
        card: {
            backgroundColor: COLORS.cardBackground,
            borderRadius: 16,
            padding: 24,
            borderWidth: 2,
            borderColor: COLORS.border,
            shadowColor: COLORS.textDark,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
        },
        header: {
            alignItems: 'center',
            marginBottom: 32,
        },
        title: {
            fontSize: 32,
            fontWeight: '700',
            color: COLORS.primary,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 16,
            color: COLORS.textSecondary,
            textAlign: 'center',
        },
        formContainer: {
            marginBottom: 16,
        },
        inputGroup: {
            marginBottom: 20,
        },
        label: {
            fontSize: 14,
            marginBottom: 8,
            color: COLORS.textPrimary,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.inputBackground,
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
        eyeIcon: {
            padding: 8,
        },
        eyeIconContainer: {
            padding: 8,
        },
        button: {
            borderRadius: 12,
            height: 50,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 16,
            backgroundColor: COLORS.primary,
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
        securityNote: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            borderRadius: 8,
            marginTop: 16,
            backgroundColor: theme === 'dark' ? '#1A1A1A' : '#F0F0F0',
        },
        securityText: {
            fontSize: 12,
            marginLeft: 8,
            flex: 1,
            textAlign: 'center',
        },
        error: {
            marginTop: 6,
            fontSize: 12,
            color: 'red',
            textAlign: 'center',
        },
    });

export default createStyles;
