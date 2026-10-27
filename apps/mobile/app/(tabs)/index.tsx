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
    useWindowDimensions,
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
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
    const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
    const sidebarAnim = useRef(new Animated.Value(-300)).current;

    // Get safe area insets to account for bottom navigation bar
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();

    useEffect(() => {
        // app/_layout.tsx handles the redirect; just don't fetch while logged out
        if (!isAuthenticated) return;
        fetchBots();
    }, [isAuthenticated]);

    useEffect(() => {
        if (isSidebarOpen) {
            Animated.timing(sidebarAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(sidebarAnim, {
                toValue: -300,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [isSidebarOpen]);

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
            {/* Sidebar - Updated to account for bottom navigation bar */}
            <Animated.View
                style={[
                    localStyles.sidebar,
                    {
                        backgroundColor: colors.cardBackground,
                        transform: [{ translateX: sidebarAnim }],
                        height: windowHeight, // Full window height
                    }
                ]}
            >
                <TouchableOpacity
                    style={localStyles.closeSidebarButton}
                    onPress={closeSidebar}
                >
                    <Ionicons
                        name="close"
                        size={28}
                        color={colors.primary}
                    />
                </TouchableOpacity>

                {/* Profile Picture - ALWAYS SHOW CIRCULAR FRAME */}
                <View style={localStyles.sidebarProfileContainer}>
                    <Image
                        source={{ uri: getProfileImageUrl() }}
                        style={localStyles.sidebarProfileImage}
                    />
                </View>

                {/* User Name */}
                <Text style={[localStyles.sidebarUsername, { color: colors.textPrimary }]}>
                    {user?.username || 'User'}
                </Text>

                {/* Settings Button at Bottom - Positioned above bottom navigation */}
                <TouchableOpacity
                    style={[
                        localStyles.sidebarSettingsButton,
                        {
                            bottom: insets.bottom, // Position above the bottom navigation bar
                        }
                    ]}
                    onPress={handleSettingsPress}
                >
                    <Ionicons
                        name="settings-outline"
                        size={20}
                        color={colors.textPrimary}
                        style={localStyles.settingsIcon}
                    />
                    <Text style={[localStyles.sidebarSettingsText, { color: colors.textPrimary }]}>
                        Settings
                    </Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Overlay when sidebar is open - Updated with higher z-index */}
            {isSidebarOpen && (
                <Pressable
                    style={[
                        localStyles.overlay,
                        {
                            height: windowHeight, // Full window height
                        }
                    ]}
                    onPress={closeSidebar}
                />
            )}

            {/* Header */}
            <View style={styles.header}>
                {/* Profile Picture Button - ALWAYS SHOW CIRCULAR FRAME */}
                <TouchableOpacity
                    style={localStyles.profileButton}
                    onPress={toggleSidebar}
                >
                    <Image
                        source={{ uri: getProfileImageUrl() }}
                        style={localStyles.profileImage}
                    />
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
        position: 'absolute',
        top: 0, // Removed the StatusBar.currentHeight padding to start immediately below status bar
        left: 0,
        width: 280,
        zIndex: 2000, // Increased z-index to be on top of other elements
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    closeSidebarButton: {
        position: 'absolute',
        top: 20,
        right: 20,
    },
    sidebarProfileContainer: {
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 20, // Added margin top to account for status bar area
    },
    sidebarProfileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#666',
        backgroundColor: '#f0f0f0',
    },
    sidebarUsername: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    sidebarSettingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'absolute',
        left: 20,
        right: 20,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.1)',
        backgroundColor: 'rgba(255,255,255,0.95)', // Semi-transparent background for better visibility
    },
    settingsIcon: {
        marginRight: 12,
    },
    sidebarSettingsText: {
        fontSize: 18,
        fontWeight: '500',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1999, // Just below sidebar but above everything else
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
        marginLeft: 8,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#ddd',
        marginTop: 8,
    },
    profileImage: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
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