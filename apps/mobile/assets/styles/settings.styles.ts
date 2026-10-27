import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { THEME_COLORS } from '../../constants/colors';

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
    warning: string;
}

// Define type for the styles object
interface Styles {
    container: ViewStyle;
    header: ViewStyle;
    backButton: ViewStyle;
    headerTitle: TextStyle;
    headerRight: ViewStyle;
    scrollContent: ViewStyle;
    profileSection: ViewStyle;
    profileImage: ImageStyle;
    profileInfo: ViewStyle;
    profileName: TextStyle;
    profileEmail: TextStyle;
    section: ViewStyle;
    sectionTitle: TextStyle;
    sectionContent: ViewStyle;
    item: ViewStyle;
    itemIconContainer: ViewStyle;
    itemContent: ViewStyle;
    itemTitle: TextStyle;
    itemSubtitle: TextStyle;
    logoutButton: ViewStyle;
    logoutIconContainer: ViewStyle;
    logoutText: TextStyle;
    footer: ViewStyle;
    footerText: TextStyle;
}

// Helper function to handle 'custom' theme fallback
const getSafeTheme = (theme: string): string => {
    return theme === 'custom' ? 'retro' : theme;
};

const createSettingsStyles = (theme: string): Styles => {
    // Convert 'custom' theme to 'retro' for color lookup
    const safeTheme = getSafeTheme(theme);
    const COLORS: Colors = THEME_COLORS[safeTheme as keyof typeof THEME_COLORS];

    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            backgroundColor: COLORS.cardBackground,
            borderBottomColor: COLORS.border,
        },
        backButton: {
            padding: 8,
            marginRight: 8,
        },
        headerTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: COLORS.textPrimary,
            flex: 1,
            textAlign: 'center',
            fontFamily: 'JetBrainsMono-Medium',
        },
        headerRight: {
            width: 40,
        },
        scrollContent: {
            paddingBottom: 24,
        },
        profileSection: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            backgroundColor: COLORS.cardBackground,
            borderColor: COLORS.border,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
        },
        profileImage: {
            width: 60,
            height: 60,
            borderRadius: 30,
            borderWidth: 2,
        },
        profileInfo: {
            marginLeft: 16,
            flex: 1,
        },
        profileName: {
            fontSize: 18,
            fontWeight: '600',
            color: COLORS.textPrimary,
            marginBottom: 4,
            fontFamily: 'JetBrainsMono-Medium',
        },
        profileEmail: {
            fontSize: 14,
            color: COLORS.textSecondary,
            opacity: 0.8,
        },
        section: {
            marginTop: 24,
        },
        sectionTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: COLORS.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginLeft: 16,
            marginBottom: 8,
            fontFamily: 'JetBrainsMono-Medium',
        },
        sectionContent: {
            marginHorizontal: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.cardBackground,
            overflow: 'hidden',
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
        },
        item: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
        },
        itemIconContainer: {
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        itemContent: {
            flex: 1,
        },
        itemTitle: {
            fontSize: 16,
            fontWeight: '500',
            marginBottom: 2,
            color: COLORS.textPrimary,
            fontFamily: 'JetBrainsMono-Medium',
        },
        itemSubtitle: {
            fontSize: 14,
            color: COLORS.textSecondary,
            opacity: 0.7,
        },
        logoutButton: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            marginTop: 32,
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            shadowColor: COLORS.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
        },
        logoutIconContainer: {
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 12,
        },
        logoutText: {
            fontSize: 16,
            fontWeight: '600',
            flex: 1,
            fontFamily: 'JetBrainsMono-Medium',
        },
        footer: {
            alignItems: 'center',
            marginTop: 32,
            paddingHorizontal: 16,
        },
        footerText: {
            fontSize: 12,
            marginBottom: 4,
            color: COLORS.textSecondary,
        },
    });
};

export default createSettingsStyles;