import { StyleSheet, ViewStyle, TextStyle, ImageStyle, Dimensions } from 'react-native';
import { THEME_COLORS, Theme } from '../../constants/colors';

const { width, height } = Dimensions.get('window');

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
    inputGroup: ViewStyle;
    label: TextStyle;
    inputContainer: ViewStyle;
    inputIcon: TextStyle;
    input: TextStyle;
    hint: TextStyle;
    button: ViewStyle;
    buttonDisabled: ViewStyle;
    buttonText: TextStyle;
    footer: ViewStyle;
    footerTextContainer: ViewStyle;
    footerText: TextStyle;
    link: TextStyle;
    helpLink: ViewStyle;
    switchLink?: ViewStyle; // Made optional

    // New styles for backup code features
    modeToggleContainer: ViewStyle;
    modeToggleButton: ViewStyle;
    modeToggleButtonActive: ViewStyle;
    modeToggleText: TextStyle;
    backupCodeInfo: ViewStyle;
    backupCodeInfoText: TextStyle;
    modalOverlay: ViewStyle;
    modalContent: ViewStyle;
    modalIcon: ViewStyle;
    modalTitle: TextStyle;
    modalText: TextStyle;
    backupCodeDisplay: ViewStyle;
    backupCodeText: TextStyle;
    modalWarning: TextStyle;
    modalButtons: ViewStyle;
    modalButton: ViewStyle;
    modalButtonText: TextStyle;
}

const createStyles = (theme: Theme): Styles => {
    const COLORS = THEME_COLORS[theme];

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
        },
        scrollViewContent: {
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 40,
            justifyContent: 'center',
            minHeight: height - 100,
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
            shadowColor: COLORS.black || '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
            borderWidth: 1,
            borderColor: COLORS.border || '#e0e0e0',
        },
        topIllustration: {
            alignItems: 'center',
            width: '100%',
            marginBottom: 20,
            marginTop: 60, // Space for back button
        },
        illustrationImage: {
            width: width * 0.6,
            height: width * 0.6,
            resizeMode: 'contain',
        },
        card: {
            backgroundColor: COLORS.cardBackground,
            borderRadius: 16,
            padding: 24,
            shadowColor: COLORS.black || '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
            borderWidth: 1,
            borderColor: COLORS.border || '#e0e0e0',
            marginBottom: 20,
        },
        header: {
            alignItems: 'center',
            marginBottom: 32,
        },
        title: {
            fontSize: 28,
            fontWeight: '700',
            marginBottom: 12,
            textAlign: 'center',
            color: COLORS.primary,
        },
        subtitle: {
            fontSize: 16,
            textAlign: 'center',
            color: COLORS.textSecondary,
            lineHeight: 22,
            paddingHorizontal: 10,
        },
        formContainer: {
            marginBottom: 16,
        },
        inputGroup: {
            marginBottom: 32,
        },
        label: {
            fontSize: 16,
            marginBottom: 12,
            fontWeight: '600',
            color: COLORS.textPrimary,
            paddingLeft: 4,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.inputBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border || '#e0e0e0',
            paddingHorizontal: 16,
            height: 60,
            marginBottom: 8,
        },
        inputIcon: {
            marginRight: 12,
        },
        input: {
            flex: 1,
            fontSize: 22,
            letterSpacing: 4,
            fontWeight: '600',
            color: COLORS.textDark,
            paddingVertical: 8,
        },
        hint: {
            fontSize: 14,
            marginTop: 8,
            textAlign: 'center',
            fontStyle: 'italic',
            color: COLORS.textSecondary,
            paddingHorizontal: 10,
        },
        button: {
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            height: 56,
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'row',
            gap: 12,
            marginTop: 8,
            marginBottom: 24,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            fontSize: 16,
            fontWeight: '600',
            color: COLORS.white,
        },
        footer: {
            marginTop: 20,
            alignItems: 'center',
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: COLORS.border || '#e0e0e0',
        },
        footerTextContainer: {
            alignItems: 'center',
            gap: 12,
        },
        footerText: {
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20,
            color: COLORS.textSecondary,
            paddingHorizontal: 10,
        },
        helpLink: {
            paddingVertical: 8,
            paddingHorizontal: 16,
        },
        link: {
            fontSize: 14,
            fontWeight: '500',
            textAlign: 'center',
            color: COLORS.primary,
        },
        switchLink: {
            paddingVertical: 8,
            paddingHorizontal: 16,
        },

        // New styles for backup code features
        modeToggleContainer: {
            flexDirection: 'row',
            marginBottom: 16,
            justifyContent: 'center',
            gap: 8,
        },
        modeToggleButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            backgroundColor: 'transparent',
        },
        modeToggleButtonActive: {
            backgroundColor: 'rgba(124, 58, 237, 0.1)', // Light primary color
        },
        modeToggleText: {
            fontSize: 14,
            fontWeight: '500',
            color: COLORS.textSecondary,
        },
        backupCodeInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 8,
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(255, 193, 7, 0.1)', // Light warning color
        },
        backupCodeInfoText: {
            marginLeft: 8,
            fontSize: 12,
            flex: 1,
            color: COLORS.textSecondary,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
        },
        modalContent: {
            width: '100%',
            maxWidth: 400,
            borderRadius: 16,
            padding: 24,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
        },
        modalIcon: {
            alignSelf: 'center',
            marginBottom: 16,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: 12,
            color: COLORS.textPrimary,
        },
        modalText: {
            fontSize: 16,
            textAlign: 'center',
            marginBottom: 16,
            lineHeight: 22,
            color: COLORS.textSecondary,
        },
        backupCodeDisplay: {
            padding: 16,
            borderRadius: 8,
            marginVertical: 16,
            alignItems: 'center',
        },
        backupCodeText: {
            fontSize: 20,
            fontWeight: 'bold',
            letterSpacing: 2,
            color: COLORS.textDark,
        },
        modalWarning: {
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 24,
            fontWeight: '600',
            color: COLORS.warning || '#FFA000',
        },
        modalButtons: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
        },
        modalButton: {
            flex: 1,
            paddingVertical: 14,
            borderRadius: 8,
            alignItems: 'center',
        },
        modalButtonText: {
            fontSize: 16,
            fontWeight: '600',
        },
    });
};

export default createStyles;