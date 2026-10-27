// One manual Deriv strategy. The layout follows the strategy (constants/derivStrategies.ts):
//   trend  -> big live chart with ups/downs over the last minute
//   digits -> how often each last digit (0-9) appeared in the last minute, plus the split that
//             matters for the strategy (even vs odd, over vs under a barrier, one exact digit)
// The trade panel at the bottom is a preview: placing trades comes once the server's risk module
// is in place, because every trade must pass server/src/risk before it executes.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '../../../store/themeStore';
import { FONTS } from '../../../constants/fonts';
import { findStrategy, type DerivStrategy } from '../../../constants/derivStrategies';
import { lastDigit, useLiveTicks, type TickerSeries } from '../../../hooks/useLiveTicks';
import BackHeader from '../../../components/BackHeader';
import PriceChart from '../../../components/PriceChart';
import KeyboardSafeScroll from '../../../components/KeyboardSafeScroll';
import { PRICE_DOWN, PRICE_UP, withAlpha } from '../../../components/welcome/welcomePalette';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const MIN_TICKS = 1;
const MAX_TICKS = 10;

const formatPrice = (q: number, pip?: number | null) => {
    const [whole, frac] = q.toFixed(pip ?? 2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
};

export default function StrategyScreen() {
    const { colors } = useThemeStore();
    const { id } = useLocalSearchParams<{ id: string }>();
    const strategy = findStrategy(String(id));
    const { series, status } = useLiveTicks();

    const [symbol, setSymbol] = useState<string | null>(null);
    const [digit, setDigit] = useState(5);
    const [stake, setStake] = useState('1.00');
    const [ticks, setTicks] = useState(5);

    const market = series.find((s) => s.symbol === symbol) ?? series[0];
    // SafeScreen (app/_layout.tsx) already keeps the screen below the status bar
    const top = {};

    if (!strategy) {
        return (
            <View style={[styles.container, top, { backgroundColor: colors.background }]}>
                <BackHeader title="Strategy not found" />
            </View>
        );
    }

    const onTrade = (side: string) =>
        Alert.alert(
            `${side}: preview only`,
            'Placing trades is the next part we build. Every trade will go to your Deriv demo account through the server, after its risk checks.'
        );

    return (
        <View style={[styles.container, top, { backgroundColor: colors.background }]}>
            <BackHeader title={strategy.name} subtitle="Deriv · Manual trading" />
            <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
                {/* How it works */}
                <View style={[styles.card, styles.row, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <Text style={[styles.body, { color: colors.textSecondary, flex: 1 }]}>{strategy.howItWorks}</Text>
                </View>

                {/* Market picker */}
                <View style={styles.chips}>
                    {series.map((s) => {
                        const active = s.symbol === market?.symbol;
                        return (
                            <TouchableOpacity
                                key={s.symbol}
                                onPress={() => setSymbol(s.symbol)}
                                style={[
                                    styles.chip,
                                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.cardBackground },
                                ]}
                            >
                                <Text style={[styles.chipText, { color: active ? colors.white : colors.textPrimary }]}>
                                    {s.name.replace(/\s+Index$/, '')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {!market || market.quotes.length < 2 ? (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, alignItems: 'center' }]}>
                        <Text style={[styles.body, { color: colors.textSecondary }]}>
                            {status === 'offline' ? 'Live prices are unavailable right now.' : 'Loading live prices…'}
                        </Text>
                    </View>
                ) : strategy.layout === 'trend' ? (
                    <TrendPanel market={market} />
                ) : (
                    <DigitsPanel market={market} strategy={strategy} digit={digit} onDigit={setDigit} />
                )}

                {/* Trade panel (preview) */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Trade</Text>
                    <View style={styles.inputsRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Stake (USD)</Text>
                            <TextInput
                                value={stake}
                                onChangeText={(t) => setStake(t.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                                placeholderTextColor={colors.placeholderText}
                                placeholder="1.00"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Duration (ticks)</Text>
                            <View style={[styles.stepper, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <TouchableOpacity onPress={() => setTicks((t) => Math.max(MIN_TICKS, t - 1))} hitSlop={8} accessibilityLabel="Fewer ticks">
                                    <Ionicons name="remove" size={20} color={colors.textPrimary} />
                                </TouchableOpacity>
                                <Text style={[styles.stepperValue, { color: colors.textPrimary }]}>{ticks}</Text>
                                <TouchableOpacity onPress={() => setTicks((t) => Math.min(MAX_TICKS, t + 1))} hitSlop={8} accessibilityLabel="More ticks">
                                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                    <View style={styles.sides}>
                        {strategy.sides.map((side, i) => (
                            <TouchableOpacity
                                key={side}
                                style={[styles.sideButton, { backgroundColor: i === 0 ? PRICE_UP : PRICE_DOWN }]}
                                onPress={() => onTrade(strategy.needsDigit ? `${side} ${digit}` : side)}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.sideText}>{strategy.needsDigit ? `${side} ${digit}` : side}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={[styles.preview, { color: colors.textSecondary }]}>
                        Preview: placing trades switches on once the server's risk checks are built. Demo account only.
                    </Text>
                </View>
            </KeyboardSafeScroll>
        </View>
    );
}

/** Rise/Fall: big chart plus how many ticks went up vs down in the window. */
function TrendPanel({ market }: { market: TickerSeries }) {
    const { colors } = useThemeStore();
    const q = market.quotes;
    let ups = 0;
    let downs = 0;
    for (let i = 1; i < q.length; i++) {
        if (q[i] > q[i - 1]) ups++;
        else if (q[i] < q[i - 1]) downs++;
    }
    // Current streak: how many ticks in a row moved the same way as the latest one
    let streak = 0;
    const dir = Math.sign(q[q.length - 1] - q[q.length - 2]);
    for (let i = q.length - 1; i > 0 && dir !== 0 && Math.sign(q[i] - q[i - 1]) === dir; i--) streak++;
    const last = q[q.length - 1];
    const change = q[0] ? ((last - q[0]) / q[0]) * 100 : 0;

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.textPrimary }]}>{formatPrice(last, market.pipSize)}</Text>
                <Text style={[styles.change, { color: change >= 0 ? PRICE_UP : PRICE_DOWN }]}>
                    {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(2)}%
                </Text>
            </View>
            <PriceChart quotes={q} height={160} />
            <View style={styles.statsRow}>
                <Stat label="Up ticks" value={String(ups)} color={PRICE_UP} />
                <Stat label="Down ticks" value={String(downs)} color={PRICE_DOWN} />
                <Stat label="Streak" value={dir === 0 ? '—' : `${streak} ${dir > 0 ? '▲' : '▼'}`} color={dir > 0 ? PRICE_UP : PRICE_DOWN} />
            </View>
            <Text style={[styles.window, { color: colors.textSecondary, marginTop: 10 }]}>Last {q.length} ticks</Text>
        </View>
    );
}

/** Digit strategies: frequency of each last digit, and the split for this strategy. */
function DigitsPanel({ market, strategy, digit, onDigit }: {
    market: TickerSeries; strategy: DerivStrategy; digit: number; onDigit: (d: number) => void;
}) {
    const { colors } = useThemeStore();
    const digits = useMemo(() => market.quotes.map((q) => lastDigit(q, market.pipSize)), [market.quotes, market.pipSize]);
    const counts = DIGITS.map((d) => digits.filter((x) => x === d).length);
    const total = digits.length || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    const current = digits[digits.length - 1];
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const last = market.quotes[market.quotes.length - 1];

    // The two numbers this strategy cares about, as [first side %, second side %]
    const split: [number, number] = (() => {
        if (strategy.id === 'even-odd') {
            const even = digits.filter((d) => d % 2 === 0).length;
            return [pct(even), 100 - pct(even)];
        }
        if (strategy.id === 'over-under') {
            return [pct(digits.filter((d) => d > digit).length), pct(digits.filter((d) => d < digit).length)];
        }
        const hit = pct(counts[digit]);
        return [hit, 100 - hit];
    })();

    // The price with its last digit picked out
    const priceText = formatPrice(last, market.pipSize);

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.textPrimary }]}>
                    {priceText.slice(0, -1)}
                    <Text style={{ color: colors.primary }}>{priceText.slice(-1)}</Text>
                </Text>
                <Text style={[styles.window, { color: colors.textSecondary }]}>Last digit</Text>
            </View>
            <PriceChart quotes={market.quotes} height={70} />

            {/* Digit grid: tap a digit to choose it when the strategy needs one */}
            <View style={styles.grid}>
                {DIGITS.map((d) => {
                    const isCurrent = d === current;
                    const isPicked = strategy.needsDigit && d === digit;
                    // The digit the latest tick ended on is a solid theme-coloured box
                    const tone = isCurrent
                        ? colors.white
                        : counts[d] === maxCount ? PRICE_UP : counts[d] === minCount ? PRICE_DOWN : colors.textSecondary;
                    return (
                        <TouchableOpacity
                            key={d}
                            disabled={!strategy.needsDigit}
                            onPress={() => onDigit(d)}
                            style={[
                                styles.cell,
                                {
                                    // Picked digit: thick outline (in the text colour, so it shows on the solid box too)
                                    borderColor: isPicked ? colors.textPrimary : colors.border,
                                    borderWidth: isPicked ? 2 : 1,
                                    backgroundColor: isCurrent ? colors.primary : colors.inputBackground,
                                },
                            ]}
                            accessibilityLabel={`Digit ${d}, ${pct(counts[d])} percent${isCurrent ? ', latest' : ''}${isPicked ? ', picked' : ''}`}
                        >
                            <Text style={[styles.cellDigit, { color: isCurrent ? colors.white : colors.textPrimary }]}>{d}</Text>
                            <Text style={[styles.cellPct, { color: tone }]}>{pct(counts[d])}%</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {strategy.needsDigit && (
                <Text style={[styles.window, { color: colors.textSecondary, marginBottom: 10 }]}>
                    Tap a digit to pick it (outlined: {digit}) · filled = latest tick
                </Text>
            )}

            {/* Split bar for this strategy's two sides */}
            <View style={styles.splitLabels}>
                <Text style={[styles.splitText, { color: PRICE_UP }]}>
                    {strategy.sides[0]}{strategy.needsDigit ? ` ${digit}` : ''} {split[0]}%
                </Text>
                <Text style={[styles.splitText, { color: PRICE_DOWN }]}>
                    {split[1]}% {strategy.sides[1]}{strategy.needsDigit ? ` ${digit}` : ''}
                </Text>
            </View>
            <View style={[styles.splitTrack, { backgroundColor: withAlpha(PRICE_DOWN, 0.25) }]}>
                <View style={[styles.splitFill, { width: `${split[0]}%`, backgroundColor: PRICE_UP }]} />
            </View>
            <Text style={[styles.window, { color: colors.textSecondary, marginTop: 8 }]}>
                Last {digits.length} ticks · past results don't predict the next tick
            </Text>
        </View>
    );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
    const { colors } = useThemeStore();
    return (
        <View style={[styles.stat, { backgroundColor: colors.inputBackground }]}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingHorizontal: 16 },
    card: {
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
    },
    row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    body: { fontSize: 14, fontFamily: FONTS.regular, lineHeight: 20 },
    cardTitle: { fontSize: 17, fontFamily: FONTS.semibold, marginBottom: 10 },
    chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { fontSize: 13, fontFamily: FONTS.semibold },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
    price: { fontSize: 26, fontFamily: FONTS.bold },
    change: { fontSize: 14, fontFamily: FONTS.semibold },
    statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    stat: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
    statValue: { fontSize: 17, fontFamily: FONTS.bold },
    statLabel: { fontSize: 12, fontFamily: FONTS.regular },
    window: { fontSize: 12, fontFamily: FONTS.regular },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 8 },
    cell: { width: '18%', flexGrow: 1, borderRadius: 12, paddingVertical: 8, alignItems: 'center' },
    cellDigit: { fontSize: 18, fontFamily: FONTS.bold },
    cellPct: { fontSize: 12, fontFamily: FONTS.semibold },
    splitLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    splitText: { fontSize: 13, fontFamily: FONTS.semibold },
    splitTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
    splitFill: { height: 10 },
    inputsRow: { flexDirection: 'row', gap: 10 },
    label: { fontSize: 12, fontFamily: FONTS.medium, marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: FONTS.semibold },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    stepperValue: { fontSize: 16, fontFamily: FONTS.semibold },
    sides: { flexDirection: 'row', gap: 10, marginTop: 14 },
    sideButton: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    sideText: { color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.semibold },
    preview: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 10, lineHeight: 17, textAlign: 'center' },
});
