import { StyleSheet } from 'react-native';

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
    placeholderText: string;
}

const createStyles = (COLORS: ThemeColors) =>
    StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: COLORS.background,
            padding: 20,
            justifyContent: 'center',
        },
        card: {
            backgroundColor: COLORS.cardBackground,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        header: {
            alignItems: 'center',
            marginBottom: 24,
        },
        backButton: {
            position: 'absolute',
            left: 0,
            top: 0,
            padding: 8,
        },
        title: {
            fontSize: 26,
            fontWeight: '700',
            color: COLORS.textPrimary,
        },
        subtitle: {
            fontSize: 14,
            color: COLORS.textSecondary,
            marginTop: 6,
            textAlign: 'center',
        },
        infoBox: {
            backgroundColor: COLORS.inputBackground,
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
        },
        securityBox: {
            backgroundColor: COLORS.primary + '20',
        },
        securityTitle: {
            color: COLORS.primary,
            fontWeight: '600',
            marginBottom: 4,
        },
        infoLabel: {
            fontSize: 12,
            color: COLORS.textSecondary,
        },
        infoText: {
            fontSize: 14,
            color: COLORS.textDark,
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
            backgroundColor: COLORS.inputBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
            height: 48,
        },
        inputError: {
            borderColor: '#ff3333',
        },
        input: {
            flex: 1,
            marginHorizontal: 8,
            fontSize: 16,
            color: COLORS.textDark,
        },
        error: {
            marginTop: 6,
            color: '#ff3333',
            fontSize: 12,
            textAlign: 'center',
        },
        button: {
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            height: 48,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 8,
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
            flexWrap: 'wrap',
        },
        footerText: {
            color: COLORS.textSecondary,
            marginRight: 6,
        },
        link: {
            color: COLORS.primary,
            fontWeight: '600',
        },
    });

export default createStyles;
