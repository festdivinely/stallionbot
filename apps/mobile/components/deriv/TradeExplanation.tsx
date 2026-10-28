// Under the buy buttons on the Options screen: how the chosen trade type works (our own words,
// constants/tradeExplanations.ts), what Deriv says you are buying with these settings (each
// side's "longcode" from the latest quote), and for digit trades how often each last digit
// came up in the recent ticks.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import { DIGIT_TRADE_IDS, TRADE_EXPLANATIONS } from '../../constants/tradeExplanations';
import { PRICE_UP, withAlpha } from '../welcome/welcomePalette';
import type { Quote, TradeType } from '../../hooks/useDerivMarket';

interface Props {
    tradeType: TradeType;
    /** Latest quote per contract type */
    quotes: Record<string, Quote>;
    /** Recent prices of the asset, oldest first */
    prices: number[];
    /** Price decimals of the asset */
    decimals: number;
}

export default function TradeExplanation({ tradeType, quotes, prices, decimals }: Props) {
    const { colors } = useThemeStore();
    const info = TRADE_EXPLANATIONS[tradeType.id];
    const buying = tradeType.sides
        .map((s) => ({ label: s.label, text: quotes[s.contractType]?.ok ? quotes[s.contractType]?.longcode : undefined }))
        .filter((b): b is { label: string; text: string } => !!b.text);

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.heading}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>How {tradeType.label} works</Text>
            </View>
            {info ? (
                <>
                    <Text style={[styles.body, { color: colors.textPrimary }]}>{info.summary}</Text>
                    {info.points.map((p) => (
                        <View key={p} style={styles.point}>
                            <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
                            <Text style={[styles.body, { color: colors.textSecondary, flex: 1 }]}>{p}</Text>
                        </View>
                    ))}
                    {info.note && <Text style={[styles.note, { color: colors.textSecondary, backgroundColor: withAlpha(colors.primary, 0.08) }]}>{info.note}</Text>}
                </>
            ) : (
                <Text style={[styles.body, { color: colors.textSecondary }]}>Deriv's description of this trade is shown below.</Text>
            )}

            {buying.length > 0 && (
                <>
                    <Text style={[styles.subtitle, { color: colors.textPrimary }]}>What you're buying</Text>
                    {buying.map((b) => (
                        <Text key={b.label} style={[styles.body, { color: colors.textSecondary, marginBottom: 6 }]}>
                            <Text style={{ fontFamily: FONTS.semibold, color: colors.textPrimary }}>{b.label}: </Text>
                            {b.text}
                        </Text>
                    ))}
                </>
            )}

            {DIGIT_TRADE_IDS.includes(tradeType.id) && <DigitStats prices={prices} decimals={decimals} />}
        </View>
    );
}

/** How often each last digit came up in the recent ticks; the most frequent one is highlighted. */
function DigitStats({ prices, decimals }: { prices: number[]; decimals: number }) {
    const { colors } = useThemeStore();
    if (prices.length < 10) return null;
    const counts = Array.from({ length: 10 }, () => 0);
    for (const p of prices) counts[Number(p.toFixed(decimals).slice(-1))]!++;
    const top = Math.max(...counts);
    return (
        <>
            <Text style={[styles.subtitle, { color: colors.textPrimary }]}>Last digits of the last {prices.length} ticks</Text>
            <View style={styles.statsRow}>
                {counts.map((c, d) => {
                    const pct = (c / prices.length) * 100;
                    const best = c === top;
                    return (
                        <View key={d} style={styles.statSlot}>
                            <View style={[styles.barTrack, { backgroundColor: withAlpha(colors.textSecondary, 0.12) }]}>
                                <View style={[styles.bar, { height: `${(c / top) * 100}%`, backgroundColor: best ? PRICE_UP : withAlpha(colors.primary, 0.6) }]} />
                            </View>
                            <Text style={[styles.statDigit, { color: colors.textPrimary }]}>{d}</Text>
                            <Text style={[styles.statPct, { color: best ? PRICE_UP : colors.textSecondary }]}>{pct.toFixed(0)}%</Text>
                        </View>
                    );
                })}
            </View>
            <Text style={[styles.note, { color: colors.textSecondary, backgroundColor: withAlpha(colors.primary, 0.08) }]}>
                Past digits don't predict the next one: every digit is equally likely on each tick.
            </Text>
        </>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 14 },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    title: { fontSize: 15, fontFamily: FONTS.semibold },
    subtitle: { fontSize: 14, fontFamily: FONTS.semibold, marginTop: 12, marginBottom: 6 },
    body: { fontSize: 13, fontFamily: FONTS.regular, lineHeight: 19 },
    point: { flexDirection: 'row', gap: 6, marginTop: 4 },
    bullet: { fontSize: 13, fontFamily: FONTS.bold, lineHeight: 19 },
    note: { fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17, borderRadius: 8, padding: 8, marginTop: 8 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statSlot: { alignItems: 'center', flex: 1 },
    barTrack: { width: 14, height: 60, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
    bar: { width: '100%', borderRadius: 4 },
    statDigit: { fontSize: 13, fontFamily: FONTS.bold, marginTop: 4 },
    statPct: { fontSize: 10, fontFamily: FONTS.regular },
});
