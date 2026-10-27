import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { THEME_COLORS, Theme } from '../../constants/colors';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface Styles {
    container: ViewStyle;
    header: ViewStyle;
    title: TextStyle;
    hamburger: ViewStyle;
    dropdown: ViewStyle;
    dropdownItem: ViewStyle;
    dropdownText: TextStyle;
    botList: ViewStyle;
    listContainer: ViewStyle;
    botCard: ViewStyle;
    botImage: ImageStyle;
    botName: TextStyle;
    botMarket: TextStyle;
    botPrice: TextStyle;
    loadingContainer: ViewStyle;
    errorContainer: ViewStyle;
    errorText: TextStyle;
    retryButton: ViewStyle;
    buttonText: TextStyle;
    emptyText: TextStyle;
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
            padding: 16,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: COLORS.textPrimary,
        },
        hamburger: {
            padding: 8,
        },
        dropdown: {
            position: 'absolute',
            top: 60,
            right: 16,
            backgroundColor: COLORS.cardBackground,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: COLORS.border,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
            zIndex: 1000,
        },
        dropdownItem: {
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
        },
        dropdownText: {
            fontSize: 16,
            color: COLORS.textPrimary,
        },
        botList: {
            justifyContent: 'space-between',
        },
        listContainer: {
            paddingBottom: 16,
        },
        botCard: {
            width: (width - 48) / 2,
            backgroundColor: COLORS.cardBackground,
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        botImage: {
            width: '100%',
            height: 100,
            borderRadius: 8,
            marginBottom: 8,
        },
        botName: {
            fontSize: 16,
            fontWeight: '600',
            color: COLORS.textPrimary,
            marginBottom: 4,
        },
        botMarket: {
            fontSize: 14,
            color: COLORS.textSecondary,
            marginBottom: 4,
        },
        botPrice: {
            fontSize: 14,
            fontWeight: '500',
            color: COLORS.primary,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        errorText: {
            fontSize: 16,
            color: COLORS.textPrimary,
            marginBottom: 16,
            textAlign: 'center',
        },
        retryButton: {
            backgroundColor: COLORS.primary,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        buttonText: {
            color: COLORS.white,
            fontSize: 16,
            fontWeight: '600',
        },
        emptyText: {
            fontSize: 16,
            color: COLORS.textSecondary,
            textAlign: 'center',
            marginTop: 20,
        },
    });
};

export default createStyles;