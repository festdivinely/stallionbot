import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../constants/colors';
import { StyleSheet, View, Text, Image } from 'react-native';

/**
 * IMPORTANT:
 * - We derive Theme type from the store itself
 * - This keeps UI aligned with ExtendedTheme ("custom" included)
 */
type ThemeFromStore = ReturnType<typeof useThemeStore.getState>['theme'];

interface TabIconProps {
    focused: boolean;
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    themeColors: any;
}

const TabIcon = ({ focused, iconName, title, themeColors }: TabIconProps) => {
    if (focused) {
        return (
            <View style={[
                styles.focusedTab,
                {
                    backgroundColor: themeColors.primary,
                    minWidth: 112,
                }
            ]}>
                <Ionicons
                    name={iconName}
                    size={20}
                    color={themeColors.white}
                    style={styles.icon}
                />
                <Text style={[styles.focusedText, { color: themeColors.white }]}>
                    {title}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.unfocusedTab}>
            <Ionicons
                name={iconName}
                size={20}
                color={themeColors.textSecondary}
            />
        </View>
    );
};

export default function TabsLayout() {
    const insets = useSafeAreaInsets();

    const theme = useThemeStore((state) => state.theme as ThemeFromStore);

    /**
     * If theme === "custom", fall back to generated colors already
     * stored inside themeStore instead of THEME_COLORS
     */
    const COLORS =
        theme === 'custom'
            ? useThemeStore.getState().colors
            : THEME_COLORS[theme];

    // No login check here: app/_layout.tsx guards the tabs. Returning null here would remove
    // the Tabs navigator and cause "route names changed ... not handled by any navigator".
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
                tabBarItemStyle: styles.tabBarItem,
                tabBarStyle: [
                    styles.tabBar,
                    {
                        backgroundColor: COLORS.background,
                        borderColor: COLORS.border,
                        marginBottom: 36 + insets.bottom,
                        height: 52,
                    }
                ],
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            focused={focused}
                            iconName="home-outline"
                            title="Home"
                            themeColors={COLORS}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            focused={focused}
                            iconName="compass-outline"
                            title="Explore"
                            themeColors={COLORS}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            focused={focused}
                            iconName="settings-outline"
                            title="Settings"
                            themeColors={COLORS}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    tabBarIcon: ({ focused }) => (
                        <TabIcon
                            focused={focused}
                            iconName="search-outline"
                            title="Search"
                            themeColors={COLORS}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        borderRadius: 50,
        marginHorizontal: 20,
        position: "absolute",
        overflow: "hidden",
        borderWidth: 1,
    },
    tabBarItem: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    focusedTab: {
        flex: 1,
        flexGrow: 1,
        width: '100%',
        minHeight: 48,
        marginTop: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 50,
        flexDirection: 'row',
        paddingHorizontal: 16,
    },
    unfocusedTab: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        borderRadius: 50,
    },
    icon: {
        marginRight: 8,
    },
    focusedText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
