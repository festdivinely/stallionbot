// Deriv options trading, in the style of Deriv SmartTrader:
//   Market      -> any options asset Deriv offers (AssetPicker sheet)
//   Trade types -> only the ones Deriv allows for that asset; the list changes with the asset
//   Settings    -> only the ones that trade type uses (duration units and limits, barriers, digit,
//                  multiplier, growth rate...), with Deriv's own limits and defaults
//   Buttons     -> Deriv's live quote for each side (payout), or Deriv's reason the settings are
//                  not allowed. Buying is not switched on yet: it will go through the server's
//                  risk checks (server/src/risk) first.
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import AccountSwitch, { REAL_COLOR } from '../../components/deriv/AccountSwitch';
import ContractCard, { CONTRACT_LABELS } from '../../components/deriv/ContractCard';
import { useAccountStore } from '../../store/accountStore';
import { PRICE_DOWN, PRICE_UP, withAlpha } from '../../components/welcome/welcomePalette';
import { useLiveTicks } from '../../hooks/useLiveTicks';
import {
    expiryKind,
    fetchQuote,
    placeTrade,
    sellTrade,
    UNIT_LABELS,
    useAssets,
    useTrades,
    useTradeTypes,
    type Asset,
    type DurationUnit,
    type Quote,
    type QuoteRequest,
    type Trade,
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
    /** "Duration" (e.g. 5 minutes) or "End time" (a day, and a time if it is today) */
    endMode: 'duration' | 'endtime';
    endDay: number; // 0 = today, 1 = tomorrow...
    endTime: string; // HH:MM, phone's local time, used when endDay is 0
}

/** End time is offered when the trade type can run for seconds/minutes/hours/days (not ticks only). */
const canUseEndTime = (t: TradeType) => t.durations.some((d) => d.unit !== 't');
/** How many days ahead an End time may be (from the trade type's longest "days" duration). */
const maxEndDays = (t: TradeType) => Math.min(6, t.durations.find((d) => d.unit === 'd')?.max ?? 0);

const pad = (n: number) => String(n).padStart(2, '0');
function defaultEndTime(): string {
    const d = new Date(Date.now() + 15 * 60_000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The End time as epoch seconds: today at the chosen local time, or for a later day the close of
 * that trading day (23:59:59 GMT), like Deriv. null if the time box isn't a valid HH:MM.
 */
function endTimeEpoch(s: Settings): number | null {
    if (s.endDay === 0) {
        const m = /^(\d{1,2}):(\d{2})$/.exec(s.endTime.trim());
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
        const d = new Date();
        d.setHours(Number(m[1]), Number(m[2]), 0, 0);
        return Math.floor(d.getTime() / 1000);
    }
    const day = new Date(Date.now() + s.endDay * 86_400_000);
    return Math.floor(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 23, 59, 59) / 1000);
}

/** The barrier kind for the current choices: ticks, same-day ("intraday") or a later day ("daily"). */
function barrierKind(s: Pick<Settings, 'endMode' | 'endDay' | 'unit'>) {
    if (s.endMode === 'endtime') return s.endDay === 0 ? 'intraday' : 'daily';
    return expiryKind(s.unit);
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
        endMode: 'duration',
        endDay: 0,
        endTime: defaultEndTime(),
    };
}

/** The exact trade the trader set up, for one side (button). Used for both the quote and the buy. */
function buildRequest(symbol: string, t: TradeType, s: Settings, side: TradeType['sides'][number]): QuoteRequest {
    const contractType = s.allowEquals && side.equalsContractType ? side.equalsContractType : side.contractType;
    const end = s.endMode === 'endtime' && canUseEndTime(t) ? endTimeEpoch(s) : null;
    return {
        symbol,
        contractType,
        amount: Number(s.stake),
        ...(end !== null ? { dateExpiry: end } : s.unit ? { duration: Number(s.duration), durationUnit: s.unit } : {}),
        ...(t.barriers >= 1 ? { barrier: s.barrier } : {}),
        ...(t.barriers === 2 ? { barrier2: s.barrier2 } : {}),
        ...(DIGIT_PICK_TYPES.includes(t.id) ? { barrier: String(s.digit) } : {}),
        ...(t.barrierChoices && s.barrierChoice ? { barrier: s.barrierChoice } : {}),
        ...(t.multipliers ? { multiplier: s.multiplier } : {}),
        ...(t.multipliers && s.cancellation ? { cancellation: s.cancellation } : {}),
        ...(t.growthRates ? { growthRate: s.growthRate } : {}),
        ...(t.id === 'high_low_ticks' ? { selectedTick: s.selectedTick } : {}),
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
        if (settings.endMode === 'endtime' && canUseEndTime(tradeType)) {
            const end = endTimeEpoch(settings);
            if (end === null) return 'Enter the end time as HH:MM, e.g. 14:30.';
            if (end <= Date.now() / 1000 + 60) return 'The end time must be in the future.';
        } else if (durationLimits) {
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
                    const q = await fetchQuote(buildRequest(symbol, tradeType, settings, side));
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

    // ---- Buying (on the account picked with the Demo/Real switch; the server's risk checks run
    // before every buy) ----
    const mode = useAccountStore((s) => s.mode);
    const isReal = mode === 'real';
    const trades = useTrades(focused, mode);
    const [buying, setBuying] = useState<string | null>(null);
    const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
    useEffect(() => {
        if (!flash) return;
        const t = setTimeout(() => setFlash(null), 4000);
        return () => clearTimeout(t);
    }, [flash]);

    const onSide = async (side: TradeType['sides'][number], label: string, q?: Quote) => {
        if (buying || !tradeType || !settings) return;
        if (problem) {
            Alert.alert(label, problem);
            return;
        }
        if (!q?.ok) {
            Alert.alert(label, q?.message || 'Waiting for a price from Deriv.');
            return;
        }
        // Real money: one clear confirmation per trade
        if (isReal) {
            const confirmed = await new Promise<boolean>((resolve) =>
                Alert.alert(`REAL trade: ${label}`, `Stake ${Number(settings.stake).toFixed(2)} of real money.\n\n${q.longcode ?? ''}`, [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: 'Buy with real money', style: 'destructive', onPress: () => resolve(true) },
                ], { cancelable: true, onDismiss: () => resolve(false) })
            );
            if (!confirmed) return;
        }
        setBuying(side.contractType);
        const result = await placeTrade(buildRequest(symbol, tradeType, settings, side), mode);
        setBuying(null);
        if (result.ok && result.trade) {
            setFlash({
                ok: true,
                text: `${isReal ? 'REAL: b' : 'B'}ought ${label} for ${result.trade.buyPrice.toFixed(2)}${result.trade.payout ? ` · payout ${result.trade.payout.toFixed(2)}` : ''}`,
            });
            // Show the trade's card at once; the live ticks follow with the next refresh
            trades.addTrade({ ...result.trade, path: result.trade.path ?? [] });
            trades.refresh();
        } else {
            Alert.alert('Trade not placed', result.message || 'Nothing was bought.');
        }
    };

    const onSell = (trade: Trade) =>
        Alert.alert('Sell this trade now?', `You get the current price for it${trade.bidPrice !== undefined ? ` (about ${trade.bidPrice.toFixed(2)} USD)` : ''}.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sell',
                onPress: async () => {
                    const r = await sellTrade(trade.contractId, mode);
                    if (!r.ok) Alert.alert('Not sold', r.message || 'Please try again.');
                    trades.refresh();
                },
            },
        ]);

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <BackHeader title="Options" subtitle={`Deriv · ${isReal ? 'Real' : 'Demo'} account`} right={<AccountSwitch compact />} />
            <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
                {/* Impossible to miss when trading with real money */}
                {isReal && (
                    <View style={[styles.realBar, { backgroundColor: REAL_COLOR }]}>
                        <Ionicons name="warning" size={16} color="#FFFFFF" />
                        <Text style={styles.realBarText}>
                            {trades.data && !trades.data.available ? 'REAL mode: no real Deriv account connected' : 'REAL MONEY: trades use your real balance'}
                        </Text>
                    </View>
                )}
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
                                    onPress={() => onSide(side, label, q)}
                                    disabled={!!buying}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Buy ${label}`}
                                >
                                    {buying === side.contractType ? (
                                        <ActivityIndicator color="#FFFFFF" style={{ paddingVertical: 9 }} />
                                    ) : (
                                        <>
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
                                        </>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Result of the last buy */}
                {flash && (
                    <View style={[styles.notice, { backgroundColor: withAlpha(PRICE_UP, 0.12), marginTop: 10 }]}>
                        <Ionicons name="checkmark-circle" size={18} color={PRICE_UP} />
                        <Text style={[styles.noticeText, { color: PRICE_UP }]}>{flash.text}</Text>
                    </View>
                )}

                <Text style={[styles.preview, { color: colors.textSecondary }]}>
                    {isReal ? 'Real account' : 'Demo account'}. Every trade passes the server's risk checks first
                    {trades.data ? ` · you can still risk ${trades.data.risk.lossRoomLeft.toFixed(2)} today` : ''}.
                </Text>

                {/* Open and finished trades */}
                {trades.data && (trades.data.open.length > 0 || trades.data.recent.length > 0) && (
                    <TradesList open={trades.data.open} recent={trades.data.recent} currency={trades.data.balance?.currency} onSell={onSell} />
                )}
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

const money = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;

/**
 * Your trades: the selected one (by default the newest) as a big live card with its tick chart
 * (components/deriv/ContractCard.tsx), the others as small rows; tap a row to show its card.
 */
function TradesList({ open, recent, currency, onSell }: { open: Trade[]; recent: Trade[]; currency?: string; onSell: (t: Trade) => void }) {
    const { colors } = useThemeStore();
    const all = [...open, ...recent].sort((a, b) => b.purchaseTime - a.purchaseTime);
    const newestId = all[0]?.contractId;
    const [selectedId, setSelectedId] = useState<number | undefined>(newestId);
    // A new trade was bought: show it straight away
    const lastNewest = useRef(newestId);
    useEffect(() => {
        if (newestId !== lastNewest.current) {
            lastNewest.current = newestId;
            setSelectedId(newestId);
        }
    }, [newestId]);
    // Re-render every second so "time left" counts down between server updates
    const [, setNow] = useState(0);
    useEffect(() => {
        if (!open.length) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [open.length]);

    const selected = all.find((t) => t.contractId === selectedId) ?? all[0];
    const others = all.filter((t) => t !== selected);

    return (
        <View style={{ marginTop: 14 }}>
            {selected && <ContractCard trade={selected} currency={currency} onSell={onSell} />}

            {others.length > 0 && <Text style={[styles.listTitle, { color: colors.textPrimary, marginTop: 4 }]}>Other trades</Text>}
            {others.map((t) => {
                const isOpen = t.status === 'open';
                const won = t.profit > 0;
                const tone = isOpen ? colors.textSecondary : won ? PRICE_UP : PRICE_DOWN;
                return (
                    <TouchableOpacity
                        key={t.contractId}
                        onPress={() => setSelectedId(t.contractId)}
                        style={[styles.card, styles.tradeCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`Show ${CONTRACT_LABELS[t.contractType] ?? t.contractType} on ${t.symbol}`}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.tradeTitle, { color: colors.textPrimary }]}>
                                {CONTRACT_LABELS[t.contractType] ?? t.contractType} · {t.symbol}
                            </Text>
                            <Text style={[styles.tradeSub, { color: colors.textSecondary }]}>
                                Stake {t.buyPrice.toFixed(2)} · {new Date(t.purchaseTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.tradeProfit, { color: isOpen ? (t.profit >= 0 ? PRICE_UP : PRICE_DOWN) : tone }]}>{money(t.profit)}</Text>
                            <Text style={[styles.tradeSub, { color: tone }]}>
                                {isOpen ? 'In progress' : t.status === 'sold' ? 'Sold' : won ? 'Won' : t.status === 'cancelled' ? 'Cancelled' : 'Lost'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
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
    items: readonly T[];
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

    // Deriv's barrier format differs per expiry (relative for short, absolute for daily), so
    // switching unit, mode or end day resets the barrier to Deriv's default for that expiry
    const barriersFor = (next: Pick<Settings, 'endMode' | 'endDay' | 'unit'>) => {
        if (!t.barriers) return {};
        const b = t.defaultBarriers[barrierKind(next)];
        return { barrier: b?.barrier ?? b?.high ?? '', barrier2: b?.low ?? '' };
    };

    const changeUnit = (unit: DurationUnit) => {
        const d = t.durations.find((x) => x.unit === unit)!;
        set({
            unit,
            duration: String(unit === 't' ? Math.min(Math.max(5, d.min), d.max) : d.min),
            ...barriersFor({ ...s, unit }),
        });
    };

    const endTimeAllowed = canUseEndTime(t);
    const endMode = endTimeAllowed ? s.endMode : 'duration';
    const days = Array.from({ length: maxEndDays(t) + 1 }, (_, i) => i);
    const dayLabel = (i: number) =>
        i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(Date.now() + i * 86_400_000).toLocaleDateString([], { weekday: 'short', day: 'numeric' });

    return (
        <View>
            {t.durations.length > 0 && (
                <>
                    {/* Like Deriv's dropdown: a length of time, or a fixed end time */}
                    {endTimeAllowed && (
                        <Chips
                            items={['duration', 'endtime'] as const}
                            value={endMode}
                            onChange={(mode) => set({ endMode: mode, ...barriersFor({ ...s, endMode: mode }) })}
                            format={(m) => (m === 'duration' ? 'Duration' : 'End time')}
                        />
                    )}

                    {endMode === 'duration' ? (
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
                    ) : (
                        <>
                            <Text style={[styles.label, { color: colors.textSecondary }]}>End date</Text>
                            <Chips items={days} value={s.endDay} onChange={(endDay) => set({ endDay, ...barriersFor({ ...s, endDay }) })} format={dayLabel} />
                            {s.endDay === 0 ? (
                                <>
                                    <Text style={[styles.label, { color: colors.textSecondary }]}>End time</Text>
                                    <TextInput
                                        value={s.endTime}
                                        onChangeText={(v) => set({ endTime: v.replace(/[^0-9:]/g, '').slice(0, 5) })}
                                        keyboardType="numbers-and-punctuation"
                                        placeholder="HH:MM"
                                        placeholderTextColor={colors.placeholderText}
                                        style={inputStyle}
                                    />
                                    <Text style={[styles.hint, { color: colors.textSecondary }]}>Your phone's time, 24-hour (e.g. 14:30)</Text>
                                </>
                            ) : (
                                <Text style={[styles.hint, { color: colors.textSecondary }]}>Ends at the close of that trading day (23:59:59 GMT)</Text>
                            )}
                        </>
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
    realBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
    realBarText: { color: '#FFFFFF', fontSize: 13, fontFamily: FONTS.bold, flex: 1 },
    listTitle: { fontSize: 16, fontFamily: FONTS.semibold, marginBottom: 8 },
    tradeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    tradeTitle: { fontSize: 14, fontFamily: FONTS.semibold },
    tradeSub: { fontSize: 12, fontFamily: FONTS.regular },
    tradeProfit: { fontSize: 16, fontFamily: FONTS.bold },
    sellButton: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4 },
    sellText: { fontSize: 13, fontFamily: FONTS.semibold },
    typeRow: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10 },
    typeText: { fontSize: 15, fontFamily: FONTS.semibold },
    typeSides: { fontSize: 12, fontFamily: FONTS.regular },
});
