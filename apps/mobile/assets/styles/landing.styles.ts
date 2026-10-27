import { StyleSheet, ViewStyle, TextStyle, ImageStyle, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface ThemeColors {
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
    warning: string;
    secondary: string;
    success: string;
    modalOverlay: string;
    secondaryButton: string;
    accent: string;
    lightGray: string;
    shadow: string;
}

interface Styles {
    container: ViewStyle;
    header: ViewStyle;
    logoContainer: ViewStyle;
    title: TextStyle;
    subtitle: TextStyle;
    buttonContainer: ViewStyle;
    button: ViewStyle;
    buttonIcon: TextStyle;
    buttonText: TextStyle;
}

const createStyles = (colors: ThemeColors): Styles => {
    return StyleSheet.create({
        container: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 20,
            backgroundColor: colors.background,
        },
        header: {
            alignItems: 'center',
            marginBottom: 40,
        },
        logoContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            width: width * 0.5,
            height: width * 0.5,
        },
        title: {
            fontSize: 34,
            fontWeight: '700',
            fontFamily: 'JetBrainsMono-Medium',
            color: colors.primary,
            textAlign: 'center',
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 18,
            fontWeight: '400',
            color: colors.textSecondary,
            textAlign: 'center',
        },
        buttonContainer: {
            width: '100%',
            alignItems: 'center',
            marginBottom: 30,
        },
        button: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80%',
            paddingVertical: 16,
            borderRadius: 12,
            borderWidth: 2,
            marginVertical: 12,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        buttonIcon: {
            marginRight: 12,
        },
        buttonText: {
            fontSize: 18,
            fontWeight: '600',
            fontFamily: 'JetBrainsMono-Medium',
        },
    });
};

export default createStyles;
export type { ThemeColors };