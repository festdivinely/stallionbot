// Deriv hub: live Deriv prices on top, then two paths: build a Deriv bot, or trade manually with
// one of the ready-made strategies (constants/derivStrategies.ts).
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import { DERIV_STRATEGIES } from '../../constants/derivStrategies';
import { useLiveTicks } from '../../hooks/useLiveTicks';
import BackHeader from '../../components/BackHeader';
import LiveTickerCard from '../../components/welcome/LiveTickerCard';
import AccountSwitch from '../../components/deriv/AccountSwitch';
import { getWelcomePalette } from '../../components/welcome/welcomePalette';

type Mode = 'build' | 'manual';

// What can be traded manually. Only the options market is built so far (Deriv's options API);
// the others are listed so traders can see what is coming.
const TRADE_MARKETS: {
    id: string;
    name: string;
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
    status: 'available' | 'soon';
}[] = [
    {
        id: 'options',
        name: 'Options',
        body: 'Rise/Fall, Digits, Multipliers, Accumulators and more on forex, indices, commodities and synthetics',
        icon: 'options-outline',
        status: 'available',
    },
    { id: 'forex', name: 'Forex', body: 'Currency pairs', icon: 'cash-outline', status: 'soon' },
    { id: 'stocks', name: 'Stocks & indices', body: 'Shares and stock indices', icon: 'business-outline', status: 'soon' },
    { id: 'commodities', name: 'Gold & commodities', body: 'Gold, silver, oil and more', icon: 'diamond-outline', status: 'soon' },
    { id: 'crypto', name: 'Cryptocurrencies', body: 'Bitcoin, Ethereum and more', icon: 'logo-bitcoin', status: 'soon' },
];

const BUILD_STEPS = [
    { icon: 'analytics-outline', title: 'Pick a market', body: 'Volatility indices trade 24/7' },
    { icon: 'git-branch-outline', title: 'Choose its strategy', body: 'Start from one of the manual strategies' },
    { icon: 'shield-checkmark-outline', title: 'Set stake and limits', body: 'Daily loss limit, max trades, stop rules' },
    { icon: 'play-circle-outline', title: 'Run it on demo', body: 'Watch every trade before going further' },
] as const;

export default function DerivHub() {
    const { colors } = useThemeStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { series, status } = useLiveTicks();
    // /deriv?mode=manual opens straight on the strategies
    const params = useLocalSearchParams<{ mode?: string }>();
    const [mode, setMode] = useState<Mode>(params.mode === 'manual' ? 'manual' : 'build');
    const palette = getWelcomePalette(colors);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <BackHeader title="Deriv" subtitle="Your Deriv accounts" />

            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
                {/* Demo / Real, with balances: the Options screen trades on the account picked here */}
                <AccountSwitch />
                {/* Live markets */}
                <View style={styles.tickers}>
                    {series.slice(0, 2).map((s) => (
                        <LiveTickerCard key={s.symbol} name={s.name} quotes={s.quotes} palette={palette} offline={status === 'offline'} />
                    ))}
                    {series.length === 0 && (
                        <Text style={[styles.muted, { color: colors.textSecondary }]}>
                            {status === 'offline' ? 'Live prices are unavailable right now.' : 'Loading live prices…'}
                        </Text>
                    )}
                </View>

                {/* Build a bot | Trade manually */}
                <View style={[styles.segment, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    {([
                        ['build', 'Build a bot', 'construct-outline'],
                        ['manual', 'Trade manually', 'hand-left-outline'],
                    ] as const).map(([key, label, icon]) => {
                        const active = mode === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                style={[styles.segmentItem, active && { backgroundColor: colors.primary }]}
                                onPress={() => setMode(key)}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                            >
                                <Ionicons name={icon} size={17} color={active ? colors.white : colors.textSecondary} />
                                <Text style={[styles.segmentText, { color: active ? colors.white : colors.textSecondary }]}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {mode === 'build' ? (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Build a Deriv bot</Text>
                        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                            A bot trades a strategy for you, inside the limits you set. Four steps:
                        </Text>
                        {BUILD_STEPS.map((s, i) => (
                            <View key={s.title} style={styles.step}>
                                <View style={[styles.stepIcon, { backgroundColor: colors.inputBackground }]}>
                                    <Ionicons name={s.icon} size={18} color={colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{i + 1}. {s.title}</Text>
                                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>{s.body}</Text>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                            onPress={() => router.push('/deriv/build')}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.primaryButtonText, { color: colors.white }]}>Start building</Text>
                            <Ionicons name="arrow-forward" size={18} color={colors.white} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>What would you like to trade?</Text>
                        {TRADE_MARKETS.map((m) => {
                            const live = m.status === 'available';
                            return (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.card, styles.strategyCard, { backgroundColor: colors.cardBackground, borderColor: live ? colors.primary : colors.border }]}
                                    onPress={() =>
                                        live
                                            ? router.push('/deriv/options')
                                            : Alert.alert(m.name, `${m.name} trading is coming soon. We're starting with the options market.`)
                                    }
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.strategyIcon, { backgroundColor: live ? colors.primary : colors.inputBackground }]}>
                                        <Ionicons name={m.icon} size={22} color={live ? colors.white : colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.strategyName, { color: colors.textPrimary }]}>{m.name}</Text>
                                        <Text style={[styles.stepBody, { color: colors.textSecondary }]}>{m.body}</Text>
                                    </View>
                                    {live ? (
                                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                    ) : (
                                        <Text style={[styles.soonPill, { color: colors.textSecondary, backgroundColor: colors.inputBackground }]}>Soon</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Ready-made strategies</Text>
                        <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                            Options strategies with their own screens and the stats that matter for them.
                        </Text>
                        {DERIV_STRATEGIES.map((s) => (
                            <TouchableOpacity
                                key={s.id}
                                style={[styles.card, styles.strategyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                                onPress={() => router.push({ pathname: '/deriv/strategy/[id]', params: { id: s.id } })}
                                activeOpacity={0.85}
                            >
                                <View style={[styles.strategyIcon, { backgroundColor: colors.inputBackground }]}>
                                    <Ionicons name={s.icon} size={22} color={colors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.strategyName, { color: colors.textPrimary }]}>{s.name}</Text>
                                    <Text style={[styles.stepBody, { color: colors.textSecondary }]}>{s.summary}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                    <Text style={[styles.riskText, { color: colors.textSecondary }]}>{s.risk} risk</Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                )}

                <View style={styles.note}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                        Trades use the account picked above (Demo or Real). Every trade passes the server's risk checks before it is placed.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingHorizontal: 16 },
    tickers: { flexDirection: 'row', gap: 10, marginBottom: 16, minHeight: 40 },
    muted: { fontSize: 14, fontFamily: FONTS.regular },
    segment: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 16 },
    segmentItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
    segmentText: { fontSize: 14, fontFamily: FONTS.semibold },
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
    cardTitle: { fontSize: 18, fontFamily: FONTS.semibold },
    cardBody: { fontSize: 14, fontFamily: FONTS.regular, marginTop: 2, marginBottom: 12, lineHeight: 20 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    stepIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    stepTitle: { fontSize: 15, fontFamily: FONTS.semibold },
    stepBody: { fontSize: 13, fontFamily: FONTS.regular },
    primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 4 },
    primaryButtonText: { fontSize: 16, fontFamily: FONTS.semibold },
    sectionHint: { fontSize: 14, fontFamily: FONTS.regular, marginBottom: 12, lineHeight: 20 },
    sectionTitle: { fontSize: 17, fontFamily: FONTS.semibold, marginTop: 14, marginBottom: 4 },
    soonPill: { fontSize: 12, fontFamily: FONTS.medium, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
    strategyCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    strategyIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    strategyName: { fontSize: 16, fontFamily: FONTS.semibold },
    riskText: { fontSize: 11, fontFamily: FONTS.medium },
    note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 10, paddingHorizontal: 4 },
    noteText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular, lineHeight: 18 },
});
