// Home: the user's bots, grouped by the broker they trade on, plus the list of brokers.
// Picking a broker (here or in the sidebar) opens that broker's own screens, e.g. app/deriv.
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Alert,
    Animated,
    Modal,
    RefreshControl,
    Pressable,
} from 'react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTS } from '../../constants/fonts';
import { BROKERS, brokerName, type Broker } from '../../constants/brokers';
import UserAvatar from '../../components/UserAvatar';
import BrokerBadge from '../../components/BrokerBadge';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../apis/authApi';

// One of the user's own bots, as GET /api/bots/user returns it (only the fields shown here)
interface UserBot {
    id: string;
    status: string;
    template: { name: string; market: string; platform: string };
}

const SIDEBAR_WIDTH = 290;
// Floating tab bar: 52 high, 36 above the navigation bar (see app/(tabs)/_layout.tsx)
const TAB_BAR_SPACE = 36 + 52 + 24;

export default function MainPage() {
    const { colors } = useThemeStore();
    const { isAuthenticated, user } = useAuthStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [bots, setBots] = useState<UserBot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // The sidebar's layer stays on screen until its closing animation has finished
    const [sidebarMounted, setSidebarMounted] = useState(false);
    const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

    const fetchBots = useCallback(async () => {
        setError('');
        try {
            const response = await api.get('/api/bots/user', { params: { page: 1, limit: 50 } });
            setBots(response.data.bots || []);
        } catch (err: any) {
            // 404 = no bots yet, which is a normal empty state
            if (err.response?.status === 404) setBots([]);
            else setError('Could not load your bots. Check your connection and try again.');
        }
    }, []);

    useEffect(() => {
        // app/_layout.tsx handles the redirect; just don't fetch while logged out
        if (!isAuthenticated) return;
        setIsLoading(true);
        fetchBots().finally(() => setIsLoading(false));
    }, [isAuthenticated, fetchBots]);

    const onRefresh = async () => {
        setIsRefreshing(true);
        await fetchBots();
        setIsRefreshing(false);
    };

    useEffect(() => {
        if (isSidebarOpen) {
            setSidebarMounted(true);
            Animated.timing(sidebarAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
        } else {
            Animated.timing(sidebarAnim, { toValue: -SIDEBAR_WIDTH, duration: 240, useNativeDriver: true }).start(() =>
                setSidebarMounted(false)
            );
        }
    }, [isSidebarOpen]);

    // Dim the screen behind the sidebar as it slides in
    const overlayOpacity = sidebarAnim.interpolate({ inputRange: [-SIDEBAR_WIDTH, 0], outputRange: [0, 1] });
    const closeSidebar = () => setIsSidebarOpen(false);

    const openBroker = (broker: Broker) => {
        setIsSidebarOpen(false);
        if (broker.status === 'available' && broker.route) {
            router.push(broker.route);
        } else {
            Alert.alert(broker.name, `${broker.name} is coming soon. We'll add it once its trading API is ready.`);
        }
    };

    // Bots grouped by broker, in the order brokers are listed (unknown brokers last)
    const groups = Object.entries(
        bots.reduce<Record<string, UserBot[]>>((acc, bot) => {
            const id = bot.template?.platform || 'other';
            (acc[id] ||= []).push(bot);
            return acc;
        }, {})
    ).sort(([a], [b]) => {
        const rank = (id: string) => {
            const i = BROKERS.findIndex((x) => x.id === id);
            return i === -1 ? BROKERS.length : i;
        };
        return rank(a) - rank(b);
    });

    const firstName = user?.username || 'trader';

    return (
        // No top padding here: SafeScreen (app/_layout.tsx) already keeps everything below the status bar
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Sidebar, in its own top-level layer (Modal) so it covers everything: the tab bar,
                the palette button and the system bars. */}
            <Modal visible={sidebarMounted} transparent animationType="none" statusBarTranslucent onRequestClose={closeSidebar}>
                <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
                    <Pressable style={{ flex: 1 }} onPress={closeSidebar} accessibilityLabel="Close menu" />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sidebar,
                        {
                            backgroundColor: colors.cardBackground,
                            transform: [{ translateX: sidebarAnim }],
                            // The sidebar itself sits between the status bar and the navigation bar
                            top: insets.top,
                            bottom: insets.bottom,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.closeSidebarButton, { backgroundColor: colors.inputBackground }]}
                        onPress={closeSidebar}
                        accessibilityLabel="Close menu"
                    >
                        <Ionicons name="close" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>

                    {/* Profile */}
                    <View style={styles.sidebarProfile}>
                        <UserAvatar size={72} borderColor={colors.primary} backgroundColor={colors.inputBackground} />
                        <Text style={[styles.sidebarUsername, { color: colors.textPrimary }]}>{user?.username || 'User'}</Text>
                        {!!user?.email && (
                            <Text style={[styles.sidebarEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                                {user.email}
                            </Text>
                        )}
                    </View>

                    {/* Brokers: each opens its own screens */}
                    <Text style={[styles.sidebarSection, { color: colors.textSecondary }]}>Brokers</Text>
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                        {BROKERS.map((b) => (
                            <TouchableOpacity
                                key={b.id}
                                style={[styles.sidebarRow, { borderColor: colors.border }]}
                                onPress={() => openBroker(b)}
                                activeOpacity={0.8}
                            >
                                <BrokerBadge broker={b} size={36} />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.sidebarRowTitle, { color: colors.textPrimary }]}>{b.name}</Text>
                                    <Text style={[styles.sidebarRowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {b.tagline}
                                    </Text>
                                </View>
                                {b.status === 'available' ? (
                                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                ) : (
                                    <Text style={[styles.soonPill, { color: colors.textSecondary, backgroundColor: colors.inputBackground }]}>
                                        Soon
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.sidebarSettingsButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        onPress={() => {
                            setIsSidebarOpen(false);
                            router.push('/settings');
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="settings-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
                        <Text style={[styles.sidebarSettingsText, { color: colors.textPrimary }]}>Settings</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>
            </Modal>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={[styles.menuButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                    onPress={() => setIsSidebarOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Open menu"
                >
                    <Ionicons name="menu" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Stallion Trader</Text>
                <View style={{ width: 42 }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + TAB_BAR_SPACE }]}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back, {firstName}</Text>

                {/* My bots */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>My bots</Text>
                {isLoading ? (
                    <View style={[styles.card, styles.centerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : error ? (
                    <View style={[styles.card, styles.centerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Ionicons name="cloud-offline-outline" size={36} color={colors.textSecondary} />
                        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{error}</Text>
                        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={onRefresh}>
                            <Text style={[styles.primaryButtonText, { color: colors.white }]}>Try again</Text>
                        </TouchableOpacity>
                    </View>
                ) : groups.length === 0 ? (
                    <View style={[styles.card, styles.centerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <View style={[styles.emptyIcon, { backgroundColor: colors.inputBackground }]}>
                            <Ionicons name="hardware-chip-outline" size={30} color={colors.primary} />
                        </View>
                        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No bots found</Text>
                        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                            You haven't built a bot yet. Pick a broker below to build your first one or to trade manually.
                        </Text>
                    </View>
                ) : (
                    groups.map(([brokerId, list]) => (
                        <View key={brokerId} style={{ marginBottom: 14 }}>
                            <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
                                {brokerName(brokerId)} · {list.length} {list.length === 1 ? 'bot' : 'bots'}
                            </Text>
                            {list.map((bot) => (
                                <BotRow key={bot.id} bot={bot} />
                            ))}
                        </View>
                    ))
                )}

                {/* Brokers */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 10 }]}>Brokers</Text>
                {BROKERS.map((b) => (
                    <TouchableOpacity
                        key={b.id}
                        style={[styles.card, styles.brokerCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                        onPress={() => openBroker(b)}
                        activeOpacity={0.85}
                    >
                        <BrokerBadge broker={b} size={46} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.brokerName, { color: colors.textPrimary }]}>{b.name}</Text>
                            <Text style={[styles.brokerSub, { color: colors.textSecondary }]}>
                                {b.status === 'available' ? 'Build bots · Trade manually' : b.tagline}
                            </Text>
                        </View>
                        {b.status === 'available' ? (
                            <View style={[styles.openPill, { backgroundColor: colors.primary }]}>
                                <Text style={[styles.openPillText, { color: colors.white }]}>Open</Text>
                            </View>
                        ) : (
                            <Text style={[styles.soonPill, { color: colors.textSecondary, backgroundColor: colors.inputBackground }]}>Soon</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

function BotRow({ bot }: { bot: UserBot }) {
    const { colors } = useThemeStore();
    const running = bot.status === 'running';
    return (
        <View style={[styles.card, styles.botRow, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={[styles.botIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="hardware-chip-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.botName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {bot.template?.name || 'Bot'}
                </Text>
                <Text style={[styles.brokerSub, { color: colors.textSecondary }]}>{bot.template?.market}</Text>
            </View>
            <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: running ? '#16A34A' : colors.border }]} />
                <Text style={[styles.statusText, { color: running ? '#16A34A' : colors.textSecondary }]}>
                    {running ? 'Running' : 'Stopped'}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
    title: { fontSize: 20, fontFamily: FONTS.bold },
    menuButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingHorizontal: 16, paddingTop: 4 },
    greeting: { fontSize: 14, fontFamily: FONTS.regular, marginBottom: 14 },
    sectionTitle: { fontSize: 17, fontFamily: FONTS.semibold, marginBottom: 10 },
    groupTitle: { fontSize: 12, fontFamily: FONTS.semibold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 },
    card: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
    },
    centerCard: { alignItems: 'center', paddingVertical: 28, gap: 8 },
    emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 17, fontFamily: FONTS.semibold },
    emptyBody: { fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 20, paddingHorizontal: 8 },
    primaryButton: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 22, marginTop: 6 },
    primaryButtonText: { fontSize: 15, fontFamily: FONTS.semibold },
    brokerCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    brokerName: { fontSize: 16, fontFamily: FONTS.semibold },
    brokerSub: { fontSize: 13, fontFamily: FONTS.regular },
    openPill: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
    openPillText: { fontSize: 13, fontFamily: FONTS.semibold },
    soonPill: { fontSize: 12, fontFamily: FONTS.medium, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
    botRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    botIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    botName: { fontSize: 15, fontFamily: FONTS.semibold },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontFamily: FONTS.medium },

    // Sidebar
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    sidebar: {
        // top/bottom are set from the safe-area insets, so it never goes under the system bars
        position: 'absolute',
        left: 0,
        width: SIDEBAR_WIDTH,
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 20,
        borderTopRightRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 6, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 16,
    },
    closeSidebarButton: { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    sidebarProfile: { alignItems: 'center', marginBottom: 18 },
    sidebarUsername: { fontSize: 17, fontFamily: FONTS.semibold, marginTop: 10 },
    sidebarEmail: { fontSize: 13, fontFamily: FONTS.regular, marginTop: 1 },
    sidebarSection: { fontSize: 12, fontFamily: FONTS.semibold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginLeft: 2 },
    sidebarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
    sidebarRowTitle: { fontSize: 15, fontFamily: FONTS.semibold },
    sidebarRowSub: { fontSize: 12, fontFamily: FONTS.regular },
    sidebarSettingsButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, marginTop: 12 },
    sidebarSettingsText: { flex: 1, fontSize: 16, fontFamily: FONTS.medium },
});
