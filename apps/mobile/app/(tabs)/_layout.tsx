import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../constants/colors';
import { StyleSheet, View, Text, Pressable } from 'react-native';

/**
 * IMPORTANT:
 * - We derive Theme type from the store itself
 * - This keeps UI aligned with ExtendedTheme ("custom" included)
 */
type ThemeFromStore = ReturnType<typeof useThemeStore.getState>['theme'];

// Icon and label for each tab screen (file name in app/(tabs) -> what the bar shows)
const TAB_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; title: string }> = {
    index: { icon: 'home-outline', title: 'Home' },
    explore: { icon: 'compass-outline', title: 'Explore' },
    settings: { icon: 'settings-outline', title: 'Settings' },
    search: { icon: 'search-outline', title: 'Search' },
};

const BAR_HEIGHT = 52;
const BAR_BORDER = 1;

// Whatever the installed expo-router passes to a custom tab bar (state, emitter, navigateToTab...)
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Our own tab bar instead of React Navigation's default one. The default bar puts each icon in a
 * fixed-size box with its own padding, so the active pill could never exactly fill the bar
 * (it left a gap above the bottom border). Here the pill is exactly the bar's inner height.
 */
function FloatingTabBar({ state, emitter, navigateToTab, colors }: TabBarProps & { colors: any }) {
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.tabBar,
                {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    bottom: 36 + insets.bottom,
                },
            ]}
        >
            {state.routes.map((route, index) => {
                const meta = TAB_META[route.name];
                if (!meta) return null;
                const focused = state.index === index;

                const onPress = () => {
                    // Same events as the default bar, so screens can still listen for tab presses
                    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                };
                const onLongPress = () => emitter.emit({ type: 'tabLongPress', target: route.key });

                return (
                    <Pressable
                        key={route.key}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: focused }}
                        accessibilityLabel={meta.title}
                        // The active tab is wider so its name fits next to the icon
                        style={[styles.tabItem, { flex: focused ? 1.9 : 1 }]}
                    >
                        {focused ? (
                            <View style={[styles.focusedPill, { backgroundColor: colors.primary }]}>
                                <Ionicons name={meta.icon} size={20} color={colors.white} style={styles.icon} />
                                <Text style={[styles.focusedText, { color: colors.white }]} numberOfLines={1}>
                                    {meta.title}
                                </Text>
                            </View>
                        ) : (
                            <Ionicons name={meta.icon} size={20} color={colors.textSecondary} />
                        )}
                    </Pressable>
                );
            })}
        </View>
    );
}

export default function TabsLayout() {
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
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <FloatingTabBar {...props} colors={COLORS} />}
        >
            <Tabs.Screen name="index" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="settings" />
            <Tabs.Screen name="search" />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        left: 20,
        right: 20,
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        borderWidth: BAR_BORDER,
        flexDirection: 'row',
        overflow: 'hidden',
        // No padding: the active pill fills the whole inside of the bar, top border to bottom border
        padding: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
    },
    tabItem: {
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    focusedPill: {
        // Exactly the bar's inner height, so there is no gap above the bottom border
        height: '100%',
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BAR_HEIGHT / 2,
        paddingHorizontal: 14,
    },
    icon: {
        marginRight: 8,
    },
    focusedText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
