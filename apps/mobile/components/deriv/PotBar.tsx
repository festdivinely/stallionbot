// The trading screen in Split Money mode (opened from the Split Money screen): one chip per pot
// (sections first, then the banks) with its money; tap one to trade from it. Locked pots show a
// lock and can't be picked. When the strategy is off, it says why.
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import { PRICE_DOWN, withAlpha } from '../welcome/welcomePalette';
import { usd, type StrategySummary } from '../../hooks/useSplitMoney';

interface Props {
    strategy: StrategySummary;
    selected: string | null;
    onSelect: (potId: string) => void;
}

export default function PotBar({ strategy, selected, onSelect }: Props) {
    const { colors } = useThemeStore();
    const router = useRouter();
    const pots = [...strategy.pots].sort((a, b) => a.layer - b.layer);
    return (
        <View style={[styles.box, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Ionicons name="grid-outline" size={16} color={colors.primary} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>Split Money: trade from</Text>
                {/* This screen is opened from the Split Money screen, so going back returns there */}
                <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/deriv/split-money'))} hitSlop={8}>
                    <Text style={[styles.link, { color: colors.primary }]}>Manage</Text>
                </TouchableOpacity>
            </View>
            {!strategy.active && (
                <View style={[styles.pause, { backgroundColor: withAlpha(PRICE_DOWN, 0.12) }]}>
                    <Ionicons name="warning" size={16} color={PRICE_DOWN} />
                    <Text style={[styles.pauseText, { color: PRICE_DOWN }]}>
                        Split Money is off{strategy.offReason ? `: ${strategy.offReason.text}` : '. Turn it on in Manage.'}
                    </Text>
                </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {pots.map((p) => {
                    const active = p.id === selected;
                    const tone = p.locked ? PRICE_DOWN : active ? '#FFFFFF' : colors.textPrimary;
                    return (
                        <TouchableOpacity
                            key={p.id}
                            disabled={p.locked}
                            onPress={() => onSelect(p.id)}
                            style={[
                                styles.chip,
                                {
                                    borderColor: p.locked ? withAlpha(PRICE_DOWN, 0.5) : active ? colors.primary : colors.border,
                                    backgroundColor: active ? colors.primary : 'transparent',
                                },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${p.label}, ${p.locked ? 'locked' : usd(p.balance)}`}
                        >
                            <View style={styles.chipTop}>
                                {p.locked && <Ionicons name="lock-closed" size={11} color={PRICE_DOWN} />}
                                <Text style={[styles.chipLabel, { color: tone }]}>{p.layer === 0 ? `S${p.id.slice(1)}` : p.label}</Text>
                            </View>
                            <Text style={[styles.chipValue, { color: active ? '#FFFFFF' : p.locked ? PRICE_DOWN : colors.textSecondary }]}>
                                {p.locked ? 'Locked' : usd(p.balance)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    box: { borderWidth: 1, borderRadius: 16, paddingVertical: 10, marginBottom: 12 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, marginBottom: 8 },
    title: { flex: 1, fontSize: 13, fontFamily: FONTS.semibold },
    link: { fontSize: 13, fontFamily: FONTS.semibold },
    pause: { flexDirection: 'row', gap: 6, marginHorizontal: 12, marginBottom: 8, borderRadius: 8, padding: 8 },
    pauseText: { flex: 1, fontSize: 12, fontFamily: FONTS.regular },
    row: { paddingHorizontal: 12, gap: 6 },
    chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, alignItems: 'center' },
    chipTop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    chipLabel: { fontSize: 12, fontFamily: FONTS.semibold },
    chipValue: { fontSize: 11, fontFamily: FONTS.medium, marginTop: 1 },
});
