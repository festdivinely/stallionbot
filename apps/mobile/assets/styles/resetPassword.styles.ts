import { StyleSheet, Platform } from 'react-native';

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
        },
        scroll: {
            flexGrow: 1,
            padding: 20,
            paddingTop: Platform.OS === 'ios' ? 44 : 20,
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
        },
        infoBox: {
            padding: 12,
            borderRadius: 8,
            backgroundColor: COLORS.inputBackground,
            marginBottom: 20,
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
            marginBottom: 16,
        },
        label: {
            fontSize: 14,
            marginBottom: 6,
            color: COLORS.textPrimary,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.inputBackground,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            paddingHorizontal: 12,
            height: 48,
        },
        input: {
            flex: 1,
            marginLeft: 8,
            fontSize: 16,
            color: COLORS.textDark,
        },
        error: {
            color: '#ff3333',
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 12,
        },
        button: {
            marginTop: 16,
            backgroundColor: COLORS.primary,
            height: 48,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        buttonText: {
            color: COLORS.white,
            fontSize: 16,
            fontWeight: '600',
        },
    });

export default createStyles;
