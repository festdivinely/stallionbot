// Deriv options trading, in the style of Deriv SmartTrader:
//   Market      -> any options asset Deriv offers (AssetPicker sheet)
//   Trade types -> only the ones Deriv allows for that asset; the list changes with the asset
//   Settings    -> only the ones that trade type uses (duration units and limits, barriers, digit,
//                  multiplier, growth rate...), with Deriv's own limits and defaults
//   Buttons     -> Deriv's live quote for each side (payout), or Deriv's reason the settings are
//                  not allowed. Buying is not switched on yet: it will go through the server's
//                  risk checks (server/src/risk) first.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView, AppState } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import BackHeader from '../../components/BackHeader';
import PriceChart from '../../components/PriceChart';
import KeyboardSafeScroll from '../../components/KeyboardSafeScroll';
import AssetPicker from '../../components/deriv/AssetPicker';
import Sheet from '../../components/deriv/Sheet';
import { PRICE_DOWN, PRICE_UP, withAlpha } from '../../components/welcome/welcomePalette';
import { useLiveTicks } from '../../hooks/useLiveTicks';
import {
    expiryKind,
    fetchQuote,
    UNIT_LABELS,
    useAssets,
    useTradeTypes,
    type Asset,
    type DurationUnit,
    type Quote,
    type TradeType,
} from '../../hooks/useDerivMarket';

const DEFAULT_SYMBOL = 'R_100';
const QUOTE_DELAY_MS = 600; // wait for the user to stop typing before asking Deriv
const QUOTE_REFRESH_MS = 5000; // payouts follow the market price
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
// Trade types whose contract is settled on a digit the trader picks
const DIGIT_PICK_TYPES = ['matches_differs', 'over_under'];

const formatPrice = (q: number, pip?: number | null) => {
    const decimals = pip ? Math.max(0, Math.round(-Math.log10(pip))) : 2;
    const [whole, frac] = q.toFixed(decimals).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
};

/** The trader's choices for the current trade type. Strings are what the text boxes hold. */
interface Settings {
    unit?: DurationUnit;
    duration: string;
    barrier: string;
    barrier2: string;
    digit: number;
    multiplier?: number;
    growthRate?: number;
    cancellation?: string; // undefined = no deal cancellation
    barrierChoice?: string;
    allowEquals: boolean;
    selectedTick: number;
    stake: string;
}

function defaultSettings(t: TradeType, stake: string): Settings {
    const first = t.durations[0];
    const unit = first?.unit;
    // 5 ticks like SmartTrader when allowed; otherwise the shortest allowed duration
    const duration = first ? String(unit === 't' ? Math.min(Math.max(5, first.min), first.max) : first.min) : '';
    const b = t.defaultBarriers[expiryKind(unit)];
    const choices = t.barrierChoices;
    return {
        unit,
        duration,
        barrier: b?.barrier ?? b?.high ?? '',
        barrier2: b?.low ?? '',
        digit: 5,
        multiplier: t.multipliers?.[0],
        growthRate: t.growthRates?.includes(0.03) ? 0.03 : t.growthRates?.[0],
        cancellation: undefined,
        barrierChoice: choices ? choices[Math.floor(choices.length / 2)] : undefined,
        allowEquals: false,
        selectedTick: 1,
        stake,
    };
}

export default function OptionsTrading() {
    const { colors } = useThemeStore();
    const assets = useAssets();
    const allAssets = useMemo(() => assets.data?.flatMap((c) => c.groups.flatMap((g) => g.assets)) ?? [], [assets.data]);

    const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
    const asset: Asset | undefined = allAssets.find((a) => a.symbol === symbol);
    const tradeTypes = useTradeTypes(symbol);
    const [tradeTypeId, setTradeTypeId] = useState('rise_fall');
    const tradeType = tradeTypes.data?.find((t) => t.id === tradeTypeId) ?? tradeTypes.data?.[0];

    const [pickerOpen, setPickerOpen] = useState(false);
    const [typesOpen, setTypesOpen] = useState(false);

    const [settings, setSettings] = useState<Settings | null>(null);
    const set = (patch: Partial<Settings>) => setSettings((s) => (s ? { ...s, ...patch } : s));

    // New asset or trade type -> start from Deriv's defaults for it (keep the stake)
    useEffect(() => {
        if (tradeType) setSettings((s) => defaultSettings(tradeType, s?.stake ?? '10'));
    }, [tradeType]);

    const { series, status } = useLiveTicks([symbol]);
    const quotes = series[0]?.quotes ?? [];
    const last = quotes[quotes.length - 1];
    const change = quotes.length > 1 && quotes[0] ? ((last! - quotes[0]) / quotes[0]) * 100 : 0;

    // ---- Checks we can do before asking Deriv (Deriv has the final word via the quote) ----
    const durationLimits = tradeType?.durations.find((d) => d.unit === settings?.unit);
    const problem = useMemo(() => {
        if (!tradeType || !settings) return null;
        const stake = Number(settings.stake);
        if (!(stake > 0)) return 'Enter a stake above 0.';
        if (tradeType.minStake !== undefined && stake < tradeType.minStake) return `Minimum stake is ${tradeType.minStake}.`;
        if (tradeType.maxStake !== undefined && stake > tradeType.maxStake) return `Maximum stake is ${tradeType.maxStake}.`;
        if (durationLimits) {
            const d = Number(settings.duration);
            if (!Number.isInteger(d) || d < durationLimits.min || d > durationLimits.max) {
                return `Duration must be ${durationLimits.min} to ${durationLimits.max} ${UNIT_LABELS[durationLimits.unit].toLowerCase()}.`;
            }
        }
        if (tradeType.barriers >= 1 && !settings.barrier) return 'Enter a barrier.';
        if (tradeType.barriers === 2 && !settings.barrier2) return 'Enter the low barrier.';
        return null;
    }, [tradeType, settings, durationLimits]);

    // ---- Live quotes for each side ----
    const [sideQuotes, setSideQuotes] = useState<Record<string, Quote>>({});
    const [quoting, setQuoting] = useState(false);

    // Quotes count towards the server's rate limit, so only ask while the trader can see them:
    // not while a list sheet is open, another screen is on top, or the app is in the background
    const focused = useIsFocused();
    const quotesVisible = focused && !pickerOpen && !typesOpen;

    useEffect(() => {
        if (!quotesVisible) return;
        setSideQuotes({});
        if (!tradeType || !settings || problem) return;
        let cancelled = false;

        const run = async () => {
            if (AppState.currentState !== 'active') return;
            setQuoting(true);
            const results = await Promise.all(
                tradeType.sides.map(async (side) => {
                    if (DIGIT_PICK_TYPES.includes(tradeType.id) && side.lastDigits && !side.lastDigits.includes(settings.digit)) {
                        return [side.contractType, { ok: false, message: `${side.label} needs a digit from ${side.lastDigits[0]} to ${side.lastDigits.at(-1)}.` }] as const;
                    }
                    const contractType = settings.allowEquals && side.equalsContractType ? side.equalsContractType : side.contractType;
                    const q = await fetchQuote({
                        symbol,
                        contractType,
                        amount: Number(settings.stake),
                        ...(settings.unit ? { duration: Number(settings.duration), durationUnit: settings.unit } : {}),
                        ...(tradeType.barriers >= 1 ? { barrier: settings.barrier } : {}),
                        ...(tradeType.barriers === 2 ? { barrier2: settings.barrier2 } : {}),
                        ...(DIGIT_PICK_TYPES.includes(tradeType.id) ? { barrier: String(settings.digit) } : {}),
                        ...(tradeType.barrierChoices && settings.barrierChoice ? { barrier: settings.barrierChoice } : {}),
                        ...(tradeType.multipliers ? { multiplier: settings.multiplier } : {}),
                        ...(tradeType.multipliers && settings.cancellation ? { cancellation: settings.cancellation } : {}),
                        ...(tradeType.growthRates ? { growthRate: settings.growthRate } : {}),
                        ...(tradeType.id === 'high_low_ticks' ? { selectedTick: settings.selectedTick } : {}),
                    });
                    return [side.contractType, q] as const;
                })
            );
            if (cancelled) return;
            setSideQuotes(Object.fromEntries(results));
            setQuoting(false);
        };

        const first = setTimeout(run, QUOTE_DELAY_MS);
        const again = setInterval(run, QUOTE_REFRESH_MS);
        return () => {
            cancelled = true;
            clearTimeout(first);
            clearInterval(again);
            setQuoting(false);
        };
    }, [symbol, tradeType, settings, problem, quotesVisible]);

    const derivMessage = Object.values(sideQuotes).find((q) => !q.ok)?.message;
    const closed = asset ? !asset.open || asset.suspended : false;

    const onSide = (label: string, q?: Quote) => {
        if (!q?.ok) {
            Alert.alert(label, q?.message || 'Waiting for a price from Deriv.');
            return;
        }
        Alert.alert(
            `${label}: preview only`,
            `${q.longcode ?? ''}\n\nBuying switches on once the server's risk checks are built. Every trade will go to your Deriv demo account.`
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <BackHeader title="Options" subtitle="Deriv · Demo account" />
            <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
                {/* Price and chart */}
                <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={styles.priceRow}>
                        <Text style={[styles.price, { color: colors.textPrimary }]}>
                            {last !== undefined ? formatPrice(last, asset?.pipSize) : '—'}
                        </Text>
                        {quotes.length > 1 && (
                            <Text style={[styles.change, { color: change >= 0 ? PRICE_UP : PRICE_DOWN }]}>
                                {change >= 0 ? '+' : '−'}{Math.abs(change).toFixed(2)}%
                            </Text>
                        )}
                    </View>
                    {quotes.length > 1 ? (
                        <PriceChart quotes={quotes} height={130} />
                    ) : (
                        <View style={styles.chartEmpty}>
                            {status === 'offline' ? (
                                <Text style={[styles.muted, { color: colors.textSecondary }]}>Live prices are unavailable right now.</Text>
                            ) : (
                                <ActivityIndicator color={colors.primary} />
                            )}
                        </View>
                    )}
                    {closed && (
                        <Text style={[styles.closedNote, { color: PRICE_DOWN }]}>
                            This market is {asset?.suspended ? 'suspended' : 'closed'} right now; Deriv will refuse new trades until it opens.
                        </Text>
                    )}
                </View>

                {/* Market */}
                <Selector label="Market" value={asset?.name ?? (assets.loading ? 'Loading markets…' : symbol)} onPress={() => setPickerOpen(true)} />

                {/* Trade type */}
                <Selector
                    label="Trade types"
                    value={tradeType?.label ?? (tradeTypes.loading ? 'Loading…' : tradeTypes.error ?? 'None available')}
                    onPress={() => tradeTypes.data?.length && setTypesOpen(true)}
                />

                {/* Settings for this trade type */}
                {tradeType && settings ? (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <TradeSettings tradeType={tradeType} settings={settings} set={set} />

                        {/* Stake */}
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Stake (USD)</Text>
                        <TextInput
                            value={settings.stake}
                            onChangeText={(t) => set({ stake: t.replace(/[^0-9.]/g, '') })}
                            keyboardType="decimal-pad"
                            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                        />
                        {(tradeType.minStake !== undefined || tradeType.maxStake !== undefined) && (
                            <Text style={[styles.hint, { color: colors.textSecondary }]}>
                                Stake {tradeType.minStake ?? 0} – {tradeType.maxStake ?? '∞'}
                            </Text>
                        )}
                    </View>
                ) : tradeTypes.error ? (
                    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border, alignItems: 'center', gap: 10 }]}>
                        <Text style={[styles.muted, { color: colors.textSecondary }]}>{tradeTypes.error}</Text>
                        <TouchableOpacity onPress={tradeTypes.reload} style={[styles.retry, { backgroundColor: colors.primary }]}>
                            <Text style={{ color: colors.white, fontFamily: FONTS.semibold }}>Try again</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                )}

                {/* What Deriv says about these settings */}
                {(problem || derivMessage) && (
                    <View style={[styles.notice, { backgroundColor: withAlpha(PRICE_DOWN, 0.1) }]}>
                        <Ionicons name="alert-circle-outline" size={18} color={PRICE_DOWN} />
                        <Text style={[styles.noticeText, { color: PRICE_DOWN }]}>{problem ?? derivMessage}</Text>
                    </View>
                )}

                {/* Buy buttons with Deriv's payout */}
                {tradeType && (
                    <View style={styles.sides}>
                        {tradeType.sides.map((side, i) => {
                            const q = sideQuotes[side.contractType];
                            const label = DIGIT_PICK_TYPES.includes(tradeType.id) ? `${side.label} ${settings?.digit}` : side.label;
                            const tone = tradeType.sides.length === 1 ? colors.primary : i === 0 ? PRICE_UP : PRICE_DOWN;
                            return (
                                <TouchableOpacity
                                    key={side.contractType}
                                    style={[styles.sideButton, { backgroundColor: q && !q.ok ? withAlpha(tone, 0.45) : tone }]}
                                    onPress={() => onSide(label, q)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.sideText}>{label}</Text>
                                    <Text style={styles.sidePayout}>
                                        {!q
                                            ? problem ? '—' : 'Getting price…'
                                            : !q.ok
                                              ? 'Not available'
                                              : q.payout
                                                ? `Payout ${q.payout.toFixed(2)} USD`
                                                : `Stake ${q.askPrice?.toFixed(2)} USD`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
                <Text style={[styles.preview, { color: colors.textSecondary }]}>
                    Prices come live from Deriv. Buying switches on once the server's risk checks are built. Demo account only.
                </Text>
            </KeyboardSafeScroll>

            <AssetPicker
                visible={pickerOpen}
                categories={assets.data}
                loading={assets.loading}
                error={assets.error}
                onRetry={assets.reload}
                selected={symbol}
                onSelect={(a) => setSymbol(a.symbol)}
                onClose={() => setPickerOpen(false)}
            />

            <Sheet visible={typesOpen} title="Trade types" onClose={() => setTypesOpen(false)}>
                <Text style={[styles.sheetHint, { color: colors.textSecondary }]}>
                    {tradeTypes.data?.length} trade types are available on {asset?.name ?? symbol}
                </Text>
                <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {tradeTypes.data?.map((t) => {
                        const active = t.id === tradeType?.id;
                        return (
                            <TouchableOpacity
                                key={t.id}
                                onPress={() => {
                                    setTradeTypeId(t.id);
                                    setTypesOpen(false);
                                }}
                                style={[styles.typeRow, active && { backgroundColor: colors.primary }]}
                            >
                                <Text style={[styles.typeText, { color: active ? colors.white : colors.textPrimary }]}>{t.label}</Text>
                                <Text style={[styles.typeSides, { color: active ? colors.white : colors.textSecondary }]}>
                                    {t.sides.map((s) => s.label).join(' · ')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </Sheet>
        </View>
    );
}

/** Tappable "Label / value ▾" box, like SmartTrader's Market and Trade types fields. */
function Selector({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
    const { colors } = useThemeStore();
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.selector, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value}`}
        >
            <View style={{ flex: 1 }}>
                <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.selectorValue, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

/** Row of choice chips. */
function Chips<T extends string | number>({ items, value, onChange, format }: {
    items: T[];
    value: T | undefined;
    onChange: (v: T) => void;
    format?: (v: T) => string;
}) {
    const { colors } = useThemeStore();
    return (
        <View style={styles.chips}>
            {items.map((item) => {
                const active = item === value;
                return (
                    <TouchableOpacity
                        key={String(item)}
                        onPress={() => onChange(item)}
                        style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.inputBackground }]}
                    >
                        <Text style={[styles.chipText, { color: active ? colors.white : colors.textPrimary }]}>{format ? format(item) : String(item)}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

/** Only the settings this trade type uses, with Deriv's limits. */
function TradeSettings({ tradeType: t, settings: s, set }: { tradeType: TradeType; settings: Settings; set: (p: Partial<Settings>) => void }) {
    const { colors } = useThemeStore();
    const limits = t.durations.find((d) => d.unit === s.unit);
    const inputStyle = [styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }];

    const changeUnit = (unit: DurationUnit) => {
        const d = t.durations.find((x) => x.unit === unit)!;
        const b = t.defaultBarriers[expiryKind(unit)];
        set({
            unit,
            duration: String(unit === 't' ? Math.min(Math.max(5, d.min), d.max) : d.min),
            // Deriv's barrier format differs per expiry (relative for short, absolute for daily)
            ...(t.barriers ? { barrier: b?.barrier ?? b?.high ?? '', barrier2: b?.low ?? '' } : {}),
        });
    };

    return (
        <View>
            {t.durations.length > 0 && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Duration</Text>
                    <Chips items={t.durations.map((d) => d.unit)} value={s.unit} onChange={changeUnit} format={(u) => UNIT_LABELS[u]} />
                    <TextInput value={s.duration} onChangeText={(v) => set({ duration: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" style={inputStyle} />
                    {limits && (
                        <Text style={[styles.hint, { color: colors.textSecondary }]}>
                            Minimum: {limits.min} · Maximum: {limits.max}
                        </Text>
                    )}
                </>
            )}

            {t.barriers >= 1 && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t.barriers === 2 ? 'High barrier' : 'Barrier'}</Text>
                    <TextInput value={s.barrier} onChangeText={(v) => set({ barrier: v.replace(/[^0-9.+-]/g, '') })} keyboardType="numbers-and-punctuation" style={inputStyle} />
                    {t.barriers === 2 && (
                        <>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>Low barrier</Text>
                            <TextInput value={s.barrier2} onChangeText={(v) => set({ barrier2: v.replace(/[^0-9.+-]/g, '') })} keyboardType="numbers-and-punctuation" style={inputStyle} />
                        </>
                    )}
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        {/^[+-]/.test(s.barrier) ? 'Offset from the entry price, e.g. +0.35' : 'Exact price level'}
                    </Text>
                </>
            )}

            {DIGIT_PICK_TYPES.includes(t.id) && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>{t.id === 'over_under' ? 'Barrier digit' : 'Prediction'}</Text>
                    <Chips items={DIGITS} value={s.digit} onChange={(digit) => set({ digit })} />
                </>
            )}

            {t.barrierChoices && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Barrier</Text>
                    <Chips items={t.barrierChoices} value={s.barrierChoice} onChange={(barrierChoice) => set({ barrierChoice })} />
                </>
            )}

            {t.multipliers && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Multiplier</Text>
                    <Chips items={t.multipliers} value={s.multiplier} onChange={(multiplier) => set({ multiplier })} format={(m) => `x${m}`} />
                </>
            )}

            {t.cancellationOptions && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Deal cancellation</Text>
                    <Chips
                        items={['none', ...t.cancellationOptions]}
                        value={s.cancellation ?? 'none'}
                        onChange={(c) => set({ cancellation: c === 'none' ? undefined : c })}
                        format={(c) => (c === 'none' ? 'Off' : c)}
                    />
                </>
            )}

            {t.growthRates && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Growth rate</Text>
                    <Chips items={t.growthRates} value={s.growthRate} onChange={(growthRate) => set({ growthRate })} format={(g) => `${Math.round(g * 100)}%`} />
                </>
            )}

            {t.id === 'high_low_ticks' && (
                <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Which tick is highest/lowest</Text>
                    <Chips items={[1, 2, 3, 4, 5]} value={s.selectedTick} onChange={(selectedTick) => set({ selectedTick })} format={(n) => `Tick ${n}`} />
                </>
            )}

            {t.sides.some((x) => x.equalsContractType) && (
                <TouchableOpacity style={styles.toggleRow} onPress={() => set({ allowEquals: !s.allowEquals })} accessibilityRole="checkbox" accessibilityState={{ checked: s.allowEquals }}>
                    <Ionicons name={s.allowEquals ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                    <Text style={[styles.toggleText, { color: colors.textPrimary }]}>Allow equals (win if the exit price equals the entry)</Text>
                </TouchableOpacity>
            )}
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
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 1,
    },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
    price: { fontSize: 26, fontFamily: FONTS.bold },
    change: { fontSize: 14, fontFamily: FONTS.semibold },
    chartEmpty: { height: 130, alignItems: 'center', justifyContent: 'center' },
    closedNote: { fontSize: 13, fontFamily: FONTS.medium, marginTop: 8 },
    muted: { fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center' },
    retry: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
    selector: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10 },
    selectorLabel: { fontSize: 12, fontFamily: FONTS.regular },
    selectorValue: { fontSize: 16, fontFamily: FONTS.semibold },
    label: { fontSize: 13, fontFamily: FONTS.medium, marginTop: 10, marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontFamily: FONTS.semibold },
    hint: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
    chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, minWidth: 40, alignItems: 'center' },
    chipText: { fontSize: 13, fontFamily: FONTS.semibold },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    toggleText: { fontSize: 13, fontFamily: FONTS.regular, flex: 1 },
    notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 12, marginBottom: 10 },
    noticeText: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, lineHeight: 18 },
    sides: { flexDirection: 'row', gap: 10 },
    sideButton: { flex: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
    sideText: { color: '#FFFFFF', fontSize: 16, fontFamily: FONTS.bold },
    sidePayout: { color: '#FFFFFF', fontSize: 12, fontFamily: FONTS.medium, marginTop: 2 },
    preview: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 10, lineHeight: 17, textAlign: 'center' },
    sheetHint: { fontSize: 13, fontFamily: FONTS.regular, textAlign: 'center', marginBottom: 8 },
    typeRow: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
    typeText: { fontSize: 15, fontFamily: FONTS.semibold },
    typeSides: { fontSize: 12, fontFamily: FONTS.regular },
});
