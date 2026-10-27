import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    StyleSheet,
    Dimensions,
    Alert,
    Animated,
    Modal,
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
// expo-image can show SVG avatars (DiceBear); React Native's Image can't
import { Image as ExpoImage } from 'expo-image';
import { FONTS } from '../../constants/fonts';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import createStyles from '../../assets/styles/home.styles';
import api from '../../apis/authApi';
import BotDetailsModal from '../../components/BotDetailsModal';
import { StatusBar, Platform } from 'react-native';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // Correct import

interface Bot {
    id: string;
    name: string;
    market: string;
    description: string;
    image: string;
    efficiency: number;
    risk: string;
    isFree: boolean;
    price: number;
    platform: string;
    creator: {
        id: string;
        username: string;
        display_name: string;
    };
    createdAt: string;
}

const SIDEBAR_WIDTH = 290;

export default function MainPage() {
    // Get colors and theme from store
    const { colors, theme } = useThemeStore();

    // Use safe theme for styles (convert 'custom' to 'retro')
    const themeForStyles = theme === 'custom' ? 'retro' : theme;
    const styles = createStyles(themeForStyles);

    const { logout, isAuthenticated, user } = useAuthStore();
    const router = useRouter();
    const [bots, setBots] = useState<Bot[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
    // The sidebar's layer stays on screen until its closing animation has finished
    const [sidebarMounted, setSidebarMounted] = useState<boolean>(false);
    const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
    const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

    // Get safe area insets to account for the status bar and bottom navigation bar
    const insets = useSafeAreaInsets();

    useEffect(() => {
        // app/_layout.tsx handles the redirect; just don't fetch while logged out
        if (!isAuthenticated) return;
        fetchBots();
    }, [isAuthenticated]);

    useEffect(() => {
        if (isSidebarOpen) {
            setSidebarMounted(true);
            Animated.timing(sidebarAnim, {
                toValue: 0,
                duration: 280,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(sidebarAnim, {
                toValue: -SIDEBAR_WIDTH,
                duration: 240,
                useNativeDriver: true,
            }).start(() => setSidebarMounted(false));
        }
    }, [isSidebarOpen]);

    // Dim the screen behind the sidebar as it slides in
    const overlayOpacity = sidebarAnim.interpolate({ inputRange: [-SIDEBAR_WIDTH, 0], outputRange: [0, 1] });

    const fetchBots = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await api.get('/api/bots', {
                params: { page: 1, limit: 20 },
            });
            const fetchedBots = response.data.bots || [];
            setBots(fetchedBots);
        } catch (err: any) {
            // Don't set error for 404 - just show empty state
            if (err.response?.status === 404) {
                setBots([]);
            } else {
                setError(err.message || 'Failed to fetch bots');
                setBots([]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    const handleSettingsPress = () => {
        setIsSidebarOpen(false);
        router.push('/settings'); // Navigate to settings page
    };

    const renderBotCard = ({ item }: { item: Bot }) => (
        <TouchableOpacity
            style={[styles.botCard, { backgroundColor: colors.cardBackground }]}
            onPress={() => setSelectedBot(item)}
        >
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/150' }}
                style={styles.botImage}
            />
            <Text style={[styles.botName, { color: colors.textPrimary }]}>
                {item.name}
            </Text>
            <Text style={[styles.botMarket, { color: colors.textSecondary }]}>
                {item.market}
            </Text>
            <Text style={[styles.botPrice, { color: colors.primary }]}>
                {item.isFree ? 'Free' : `$${item.price}`}
            </Text>
        </TouchableOpacity>
    );

    // Get profile image URL
    const getProfileImageUrl = () => {
        if (user?.profileImage) {
            return user.profileImage;
        }
        // Fallback to DiceBear avatar based on username or email
        const seed = user?.username || user?.email || 'user';
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
    };

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: colors.background,
                paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
            },
        ]}>
            {/* Sidebar, in its own top-level layer (Modal) so it covers everything: the tab bar,
                the palette button and the system bars. Inside this screen, the tab bar (drawn by
                the tabs layout) would always stay on top of it. */}
            <Modal
                visible={sidebarMounted}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={closeSidebar}
            >
                <Animated.View style={[localStyles.overlay, { opacity: overlayOpacity }]}>
                    <Pressable style={{ flex: 1 }} onPress={closeSidebar} accessibilityLabel="Close menu" />
                </Animated.View>

                <Animated.View
                    style={[
                        localStyles.sidebar,
                        {
                            backgroundColor: colors.cardBackground,
                            transform: [{ translateX: sidebarAnim }],
                            // The sidebar itself sits between the status bar and the navigation bar
                            top: insets.top,
                            bottom: insets.bottom,
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={[localStyles.closeSidebarButton, { backgroundColor: colors.inputBackground }]}
                        onPress={closeSidebar}
                        accessibilityLabel="Close menu"
                    >
                        <Ionicons name="close" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>

                    {/* Profile */}
                    <View style={localStyles.sidebarProfileContainer}>
                        <ExpoImage
                            source={{ uri: getProfileImageUrl() }}
                            style={[localStyles.sidebarProfileImage, { borderColor: colors.primary, backgroundColor: colors.inputBackground }]}
                            contentFit="cover"
                        />
                    </View>
                    <Text style={[localStyles.sidebarUsername, { color: colors.textPrimary }]}>
                        {user?.username || 'User'}
                    </Text>
                    {!!user?.email && (
                        <Text style={[localStyles.sidebarEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                            {user.email}
                        </Text>
                    )}

                    {/* Pushes Settings to the bottom of the sidebar (which ends above the navigation bar) */}
                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[localStyles.sidebarSettingsButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        onPress={handleSettingsPress}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="settings-outline"
                            size={20}
                            color={colors.primary}
                            style={localStyles.settingsIcon}
                        />
                        <Text style={[localStyles.sidebarSettingsText, { color: colors.textPrimary }]}>
                            Settings
                        </Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>
            </Modal>

            {/* Header */}
            <View style={styles.header}>
                {/* Hamburger menu: opens the sidebar */}
                <TouchableOpacity
                    style={[localStyles.menuButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={toggleSidebar}
                    accessibilityRole="button"
                    accessibilityLabel="Open menu"
                >
                    <Ionicons name="menu" size={24} color={colors.textPrimary} />
                </TouchableOpacity>

                <Text style={[styles.title, { color: colors.textPrimary }]}>
                    Quantum Robots
                </Text>

                {/* Empty view for balance */}
                <View style={localStyles.headerRight} />
            </View>

            <Pressable
                style={{ flex: 1 }}
                onPress={closeSidebar}
            >
                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : error ? (
                    <View style={styles.errorContainer}>
                        <Text style={[styles.errorText, { color: colors.textPrimary }]}>
                            {error}
                        </Text>
                        <TouchableOpacity
                            style={[styles.retryButton, { backgroundColor: colors.primary }]}
                            onPress={fetchBots}
                        >
                            <Text style={[styles.buttonText, { color: colors.white }]}>
                                Retry
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : bots.length === 0 ? (
                    // Show empty state when no bots
                    <View style={localStyles.emptyContainer}>
                        <Ionicons
                            name="construct-outline"
                            size={60}
                            color={colors.textSecondary}
                        />
                        <Text style={[localStyles.emptyText, { color: colors.textSecondary }]}>
                            No bots available
                        </Text>
                        <TouchableOpacity
                            style={[localStyles.retryButton, { backgroundColor: colors.primary }]}
                            onPress={fetchBots}
                        >
                            <Text style={[localStyles.retryButtonText, { color: colors.white }]}>
                                Refresh
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={bots}
                        renderItem={renderBotCard}
                        keyExtractor={(item) => item.id}
                        numColumns={2}
                        columnWrapperStyle={styles.botList}
                        contentContainerStyle={styles.listContainer}
                    />
                )}
            </Pressable>
            {selectedBot && (
                <BotDetailsModal
                    bot={selectedBot}
                    isVisible={!!selectedBot}
                    onClose={() => setSelectedBot(null)}
                    theme={themeForStyles} // Pass safe theme to modal
                />
            )}
        </View>
    );
}

const localStyles = StyleSheet.create({
    sidebar: {
        // top/bottom are set from the safe-area insets, so it never goes under the system bars
        position: 'absolute',
        left: 0,
        width: SIDEBAR_WIDTH,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 6, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 16,
    },
    closeSidebarButton: {
        alignSelf: 'flex-end',
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sidebarProfileContainer: {
        alignItems: 'center',
        marginBottom: 14,
        marginTop: 8,
    },
    sidebarProfileImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 2,
    },
    sidebarUsername: {
        fontSize: 18,
        fontFamily: FONTS.semibold,
        textAlign: 'center',
    },
    sidebarEmail: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        textAlign: 'center',
        marginTop: 2,
    },
    sidebarSettingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
    },
    settingsIcon: {
        marginRight: 12,
    },
    sidebarSettingsText: {
        flex: 1,
        fontSize: 16,
        fontFamily: FONTS.medium,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    menuButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
        marginTop: 8,
    },
    headerRight: {
        width: 40,
        marginRight: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyText: {
        fontSize: 18,
        marginTop: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
    },
    retryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});