// Live progress of one contract, for every options trade type, like Deriv SmartTrader's contract
// box but clearer:
//  - Top: Potential payout / Total cost / Potential profit while it runs; Buy price / Final price /
//    Profit (or Loss) once it ends. Title says In progress / Won / Lost, plus a live status line
//    in plain words ("Inside the range", "2 ups in a row, 3 to go"...).
//  - Middle, depending on the trade type (see kindOf):
//      barrier  Rise/Fall, Higher/Lower, Touch/No Touch: tick chart + barrier, winning side shaded
//      range    Ends Between/Outside, Stays Between/Goes Outside: both barriers, winning zone shaded
//      asian    Asians: the running average drawn as its own line (it moves every tick)
//      reset    Reset Call/Put: reset-time line; old barrier dotted, new one solid after a reset
//      highlow  High/Low Ticks: your tick ringed, a line at its price, all 5 tick slots
//      runs     Only Ups/Downs: each step green (right way) or red (wrong way), streak counter
//      digits   Matches/Differs, Even/Odd, Over/Under: digit row, winning digits green, frame on
//               the latest digit with a tick counter
//  - The background turns green (won) or red (lost) at the end.
// Barriers always stay in view (Deriv's can scroll off the chart).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import { PRICE_DOWN, PRICE_UP, withAlpha } from '../welcome/welcomePalette';
import type { Trade } from '../../hooks/useDerivMarket';
import { potName } from '../../hooks/useSplitMoney';

const CHART_H = 180;
const ENTRY_COLOR = '#F59E0B'; // orange, like Deriv's entry/exit lines

export const CONTRACT_LABELS: Record<string, string> = {
    CALL: 'Rise', PUT: 'Fall', CALLE: 'Rise (equals)', PUTE: 'Fall (equals)', HIGHER: 'Higher', LOWER: 'Lower',
    ONETOUCH: 'Touch', NOTOUCH: 'No Touch', EXPIRYRANGE: 'Ends Between', EXPIRYMISS: 'Ends Outside',
    EXPIRYRANGEE: 'Ends Between (equals)', EXPIRYMISSE: 'Ends Outside (equals)', RANGE: 'Stays Between', UPORDOWN: 'Goes Outside',
    DIGITMATCH: 'Matches', DIGITDIFF: 'Differs', DIGITEVEN: 'Even', DIGITODD: 'Odd', DIGITOVER: 'Over', DIGITUNDER: 'Under',
    ACCU: 'Accumulator', MULTUP: 'Multiplier Up', MULTDOWN: 'Multiplier Down', TURBOSLONG: 'Turbo Up', TURBOSSHORT: 'Turbo Down',
    VANILLALONGCALL: 'Vanilla Call', VANILLALONGPUT: 'Vanilla Put', ASIANU: 'Asian Rise', ASIAND: 'Asian Fall',
    RESETCALL: 'Reset Call', RESETPUT: 'Reset Put', TICKHIGH: 'High Tick', TICKLOW: 'Low Tick', RUNHIGH: 'Only Ups', RUNLOW: 'Only Downs',
};

type Kind = 'barrier' | 'range' | 'asian' | 'reset' | 'highlow' | 'runs' | 'digits' | 'generic';

const UP_TYPES = ['CALL', 'CALLE', 'HIGHER'];
const DOWN_TYPES = ['PUT', 'PUTE', 'LOWER'];

function kindOf(type: string): Kind {
    if (type.startsWith('DIGIT')) return 'digits';
    if ([...UP_TYPES, ...DOWN_TYPES, 'ONETOUCH', 'NOTOUCH'].includes(type)) return 'barrier';
    if (['EXPIRYRANGE', 'EXPIRYMISS', 'EXPIRYRANGEE', 'EXPIRYMISSE', 'RANGE', 'UPORDOWN'].includes(type)) return 'range';
    if (type === 'ASIANU' || type === 'ASIAND') return 'asian';
    if (type === 'RESETCALL' || type === 'RESETPUT') return 'reset';
    if (type === 'TICKHIGH' || type === 'TICKLOW') return 'highlow';
    if (type === 'RUNHIGH' || type === 'RUNLOW') return 'runs';
    return 'generic';
}

const fmt = (n: number | undefined, decimals = 2) =>
    n === undefined ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ---------- Digits ----------

/** Last digit of a tick, from Deriv's own price text when we have it (keeps trailing zeros). */
function lastDigitOf(p: { q: number; s?: string }, decimals: number): number {
    const text = p.s ?? p.q.toFixed(decimals);
    return Number(text.replace(/\D/g, '').slice(-1));
}

/** The digits that win for this digit contract (barrier = the trader's digit). */
function winningDigits(type: string, digit: number | undefined): number[] {
    const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const d = digit ?? -1;
    switch (type) {
        case 'DIGITMATCH': return [d];
        case 'DIGITDIFF': return all.filter((x) => x !== d);
        case 'DIGITEVEN': return all.filter((x) => x % 2 === 0);
        case 'DIGITODD': return all.filter((x) => x % 2 === 1);
        case 'DIGITOVER': return all.filter((x) => x > d);
        case 'DIGITUNDER': return all.filter((x) => x < d);
        default: return [];
    }
}

// ---------- Plain-words status for each kind ----------

interface Progress {
    winning: boolean | null; // null = can't tell yet
    text: string | null;
}

/** Running average of the prices so far, one value per tick (Asians are settled on it). */
const runningAverage = (qs: number[]) => {
    let sum = 0;
    return qs.map((q, i) => (sum += q) / (i + 1));
};

function progressOf(t: Trade): Progress {
    const kind = kindOf(t.contractType);
    const qs = t.path.map((p) => p.q);
    const last = qs[qs.length - 1];
    const d = t.decimals ?? 2;
    if (last === undefined) return { winning: null, text: null };

    switch (kind) {
        case 'barrier': {
            const b = t.barrier;
            if (b === undefined) return { winning: null, text: null };
            if (t.contractType === 'ONETOUCH' || t.contractType === 'NOTOUCH') {
                const start = t.entrySpot ?? qs[0]!;
                const touched = b >= start ? Math.max(...qs) >= b : Math.min(...qs) <= b;
                const win = t.contractType === 'ONETOUCH' ? touched : !touched;
                return { winning: win, text: touched ? 'The price touched the barrier' : 'Not touched the barrier yet' };
            }
            const up = UP_TYPES.includes(t.contractType);
            const equals = t.contractType === 'CALLE' || t.contractType === 'PUTE';
            const win = up ? (equals ? last >= b : last > b) : (equals ? last <= b : last < b);
            const gap = Math.abs(last - b);
            return { winning: win, text: `${gap.toFixed(d)} ${last >= b ? 'above' : 'below'} the barrier` };
        }
        case 'range': {
            const hi = t.highBarrier;
            const lo = t.lowBarrier;
            if (hi === undefined || lo === undefined) return { winning: null, text: null };
            const inside = last > lo && last < hi;
            const touched = qs.some((q) => q >= hi || q <= lo);
            switch (t.contractType) {
                case 'EXPIRYRANGE':
                case 'EXPIRYRANGEE':
                    return { winning: inside, text: inside ? 'Inside the range right now' : 'Outside the range right now' };
                case 'EXPIRYMISS':
                case 'EXPIRYMISSE':
                    return { winning: !inside, text: inside ? 'Inside the range right now' : 'Outside the range right now' };
                case 'RANGE':
                    return { winning: !touched, text: touched ? 'A barrier was touched' : 'Stayed inside the range so far' };
                default: // UPORDOWN
                    return { winning: touched, text: touched ? 'Went outside the range' : 'Still inside the range' };
            }
        }
        case 'asian': {
            const avg = runningAverage(qs).at(-1)!;
            const win = t.contractType === 'ASIANU' ? last > avg : last < avg;
            return { winning: win, text: `Last tick ${Math.abs(last - avg).toFixed(d)} ${last >= avg ? 'above' : 'below'} the average` };
        }
        case 'reset': {
            const b = t.resetBarrier ?? t.barrier;
            if (b === undefined) return { winning: null, text: null };
            const win = t.contractType === 'RESETCALL' ? last > b : last < b;
            const lastTime = t.path.at(-1)!.t;
            let text: string;
            if (t.resetTime && lastTime < t.resetTime) text = 'Reset check still to come';
            else if (t.resetBarrier !== undefined && t.barrier !== undefined && t.resetBarrier !== t.entrySpot) text = `Barrier was reset to ${fmt(t.resetBarrier, d)}`;
            else if (t.resetTime) text = 'No reset needed: you were winning at the check';
            else text = `${Math.abs(last - b).toFixed(d)} ${last >= b ? 'above' : 'below'} the barrier`;
            return { winning: win, text };
        }
        case 'highlow': {
            const n = t.selectedTick;
            if (!n) return { winning: null, text: null };
            if (qs.length < n) return { winning: null, text: `Waiting for tick ${n} (your tick)` };
            const mine = qs[n - 1]!;
            const others = qs.filter((_, i) => i !== n - 1);
            const high = t.contractType === 'TICKHIGH';
            const beatenAt = others.length ? qs.findIndex((q, i) => i !== n - 1 && (high ? q >= mine : q <= mine)) : -1;
            if (beatenAt >= 0) return { winning: false, text: `Your tick was beaten at tick ${beatenAt + 1}` };
            return { winning: true, text: `Your tick is the ${high ? 'highest' : 'lowest'} so far` };
        }
        case 'runs': {
            const up = t.contractType === 'RUNHIGH';
            let streak = 0;
            for (let i = 1; i < qs.length; i++) {
                const ok = up ? qs[i]! > qs[i - 1]! : qs[i]! < qs[i - 1]!;
                if (!ok) return { winning: false, text: `Ended at tick ${i}: the price went ${up ? 'down' : 'up'}` };
                streak++;
            }
            const total = t.tickCount ?? 5;
            const word = up ? 'up' : 'down';
            return {
                winning: streak > 0 ? true : null,
                text: streak >= total ? `${total} ${word}s in a row` : `${streak} ${word}${streak === 1 ? '' : 's'} in a row, ${total - streak} to go`,
            };
        }
        case 'digits': {
            const digit = lastDigitOf(t.path.at(-1)!, d);
            const win = winningDigits(t.contractType, t.barrier).includes(digit);
            return { winning: win, text: `Last digit is ${digit}` };
        }
        default:
            return { winning: t.profit > 0 ? true : t.profit < 0 ? false : null, text: null };
    }
}

// ---------- The card ----------

interface Props {
    trade: Trade;
    currency?: string;
    onSell?: (t: Trade) => void;
    /** Shows an ✕ that hides this card (the trade itself carries on) */
    onClose?: () => void;
}

export default function ContractCard({ trade: t, currency = 'USD', onSell, onClose }: Props) {
    const { colors } = useThemeStore();
    const open = t.status === 'open';
    const won = !open && t.profit > 0;
    const resultColor = won ? PRICE_UP : PRICE_DOWN;
    const kind = kindOf(t.contractType);
    const progress = progressOf(t);
    const winning = open ? progress.winning : null;
    const decimals = t.decimals ?? 2;
    const label = CONTRACT_LABELS[t.contractType] ?? t.contractType;

    const title = open ? 'Contract in progress' : t.status === 'sold' ? 'Contract sold' : won ? 'This contract won' : t.status === 'cancelled' ? 'Contract cancelled' : 'This contract lost';
    const finalPrice = t.sellPrice ?? t.buyPrice + t.profit;

    // Tick contracts that end before their last tick: say why (High/Low Ticks, Only Ups/Downs)
    const endedEarly = !open && !!t.tickCount && t.path.length > 0 && t.path.length < t.tickCount;

    const timeLeft = (() => {
        if (!open) return null;
        if (t.tickCount) return `Tick ${Math.min(t.ticksPassed ?? 0, t.tickCount)} of ${t.tickCount}`;
        if (t.dateExpiry) {
            const s = Math.max(0, Math.round(t.dateExpiry - Date.now() / 1000));
            return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
        }
        return null;
    })();

    const barrierText = (() => {
        if (kind === 'range' && t.highBarrier !== undefined && t.lowBarrier !== undefined) return `Barriers: ${fmt(t.lowBarrier, decimals)} – ${fmt(t.highBarrier, decimals)}`;
        if (kind === 'digits') return t.barrier !== undefined && !['DIGITEVEN', 'DIGITODD'].includes(t.contractType) ? `Your digit: ${t.barrier}` : null;
        if (kind === 'highlow') return t.selectedTick ? `Your tick: ${t.selectedTick} of ${t.tickCount ?? 5}` : null;
        if (kind === 'asian') return 'Barrier: the average of all ticks';
        if (kind === 'runs') return null;
        const b = kind === 'reset' ? t.resetBarrier ?? t.barrier : t.barrier;
        return b !== undefined ? `Barrier: ${fmt(b, decimals)}` : null;
    })();

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: open ? colors.border : resultColor }]}>
            {/* Title */}
            <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: open ? colors.textPrimary : resultColor }]}>{title}</Text>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        {label} · {t.symbol}
                        {t.potId ? ` · from ${potName(t.potId)}` : ''}
                    </Text>
                </View>
                {open && winning !== null && (
                    <View style={[styles.chip, { backgroundColor: withAlpha(winning ? PRICE_UP : PRICE_DOWN, 0.15) }]}>
                        <View style={[styles.chipDot, { backgroundColor: winning ? PRICE_UP : PRICE_DOWN }]} />
                        <Text style={[styles.chipText, { color: winning ? PRICE_UP : PRICE_DOWN }]}>{winning ? 'Winning now' : 'Losing now'}</Text>
                    </View>
                )}
                {onClose && (
                    <TouchableOpacity
                        onPress={onClose}
                        style={[styles.close, { backgroundColor: withAlpha(colors.textSecondary, 0.15) }]}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Hide this trade's progress"
                    >
                        <Ionicons name="close" size={18} color={colors.textPrimary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Figures */}
            <View style={styles.figures}>
                {open ? (
                    <>
                        <Figure label="Potential payout" value={t.payout ? `${fmt(t.payout)} ${currency}` : '—'} />
                        <Figure label="Total cost" value={`${fmt(t.buyPrice)} ${currency}`} />
                        <Figure label={t.payout ? 'Potential profit' : 'Profit now'} value={`${fmt(t.payout ? t.payout - t.buyPrice : t.profit)} ${currency}`} />
                    </>
                ) : (
                    <>
                        <Figure label="Buy price" value={`${fmt(t.buyPrice)} ${currency}`} />
                        <Figure label="Final price" value={`${fmt(finalPrice)} ${currency}`} />
                        <Figure label={t.profit >= 0 ? 'Profit' : 'Loss'} value={`${fmt(t.profit)} ${currency}`} color={resultColor} />
                    </>
                )}
            </View>

            {(barrierText || timeLeft) && (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {[barrierText, timeLeft].filter(Boolean).join('   ·   ')}
                </Text>
            )}

            {/* Plain-words status: what is happening, or why it ended */}
            {(progress.text || endedEarly) && (
                <Text style={[styles.status, { color: open ? (winning === null ? colors.textPrimary : winning ? PRICE_UP : PRICE_DOWN) : resultColor }]}>
                    {endedEarly && !won ? `Ended early, after ${t.path.length} of ${t.tickCount} ticks: ${progress.text ?? 'it could no longer win'}` : progress.text}
                </Text>
            )}

            {kind === 'digits' ? <DigitPanel trade={t} /> : <ContractChart trade={t} winning={winning} />}

            {kind !== 'digits' && <Legend kind={kind} />}

            <View style={styles.footer}>
                <Text style={[styles.ref, { color: colors.textSecondary }]}>Ref {t.contractId}</Text>
                {open && t.canSell && onSell && (
                    <TouchableOpacity onPress={() => onSell(t)} style={[styles.sell, { borderColor: colors.primary }]}>
                        <Text style={[styles.sellText, { color: colors.primary }]}>
                            Sell{t.bidPrice !== undefined ? ` for ${fmt(t.bidPrice)}` : ''}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
    const { colors } = useThemeStore();
    return (
        <View style={styles.figure}>
            <Text style={[styles.figureLabel, { color: colors.textPrimary }]}>{label}</Text>
            <Text style={[styles.figureValue, { color: color ?? colors.textSecondary }]}>{value}</Text>
        </View>
    );
}

/** What the lines on the chart mean, for this kind of trade. */
function Legend({ kind }: { kind: Kind }) {
    const { colors } = useThemeStore();
    const items: { label: string; color: string; shape: 'v' | 'vdash' | 'h' | 'hdash' | 'ring' }[] = [{ label: 'Entry', color: ENTRY_COLOR, shape: 'v' }];
    if (kind === 'barrier' || kind === 'reset') items.push({ label: 'Barrier', color: colors.primary, shape: 'h' });
    if (kind === 'range') items.push({ label: 'Barriers', color: colors.primary, shape: 'h' });
    if (kind === 'asian') items.push({ label: 'Average', color: colors.primary, shape: 'hdash' });
    if (kind === 'reset') items.push({ label: 'Reset time', color: colors.textPrimary, shape: 'v' });
    if (kind === 'highlow') items.push({ label: 'Your tick', color: colors.primary, shape: 'ring' });
    items.push({ label: 'Exit', color: ENTRY_COLOR, shape: 'vdash' });
    return (
        <View style={styles.legend}>
            {items.map((it) => (
                <View key={it.label} style={styles.legendItem}>
                    <Svg width={14} height={14}>
                        {it.shape === 'h' || it.shape === 'hdash' ? (
                            <Line x1={0} y1={7} x2={14} y2={7} stroke={it.color} strokeWidth={2} strokeDasharray={it.shape === 'hdash' ? '3 2' : undefined} />
                        ) : it.shape === 'ring' ? (
                            <Circle cx={7} cy={7} r={5} stroke={it.color} strokeWidth={2} fill="none" />
                        ) : (
                            <Line x1={7} y1={0} x2={7} y2={14} stroke={it.color} strokeWidth={2} strokeDasharray={it.shape === 'vdash' ? '3 2' : undefined} />
                        )}
                    </Svg>
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>{it.label}</Text>
                </View>
            ))}
        </View>
    );
}

// ---------- Chart (every kind except digits) ----------

function ContractChart({ trade: t, winning }: { trade: Trade; winning: boolean | null }) {
    const { colors } = useThemeStore();
    const [width, setWidth] = useState(0);
    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    const kind = kindOf(t.contractType);
    const open = t.status === 'open';
    const won = !open && t.profit > 0;
    const pad = { left: 8, right: 8, top: 12, bottom: 12 };
    const w = Math.max(0, width - pad.left - pad.right);
    const h = CHART_H - pad.top - pad.bottom;
    const points = t.path;
    const qs = points.map((p) => p.q);
    const averages = kind === 'asian' ? runningAverage(qs) : [];

    // Lines across the chart for this kind of trade
    const barriers: number[] = [];
    if (kind === 'range') {
        if (t.highBarrier !== undefined) barriers.push(t.highBarrier);
        if (t.lowBarrier !== undefined) barriers.push(t.lowBarrier);
    } else if (kind === 'reset') {
        if (t.entrySpot !== undefined) barriers.push(t.entrySpot);
        if (t.resetBarrier !== undefined) barriers.push(t.resetBarrier);
        else if (t.barrier !== undefined) barriers.push(t.barrier);
    } else if (kind === 'barrier' || kind === 'generic') {
        if (t.barrier !== undefined) barriers.push(t.barrier);
    }
    const selected = kind === 'highlow' && t.selectedTick ? qs[t.selectedTick - 1] : undefined;

    // Y range: prices AND everything we draw across, so nothing scrolls out of view
    const values = [...qs, ...barriers, ...averages, ...(t.entrySpot !== undefined ? [t.entrySpot] : [])];
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const span = hi - lo || Math.abs(hi) * 0.0001 || 1;
    const yMin = lo - span * 0.15;
    const yMax = hi + span * 0.15;
    const y = (q: number) => pad.top + h - ((q - yMin) / (yMax - yMin)) * h;

    // X: one slot per tick from the start for tick contracts (entry + tickCount ticks); timed
    // contracts run from start to expiry; contracts without an end spread their points.
    const startT = t.entrySpotTime ?? t.dateStart ?? points[0]?.t ?? 0;
    const slots = t.tickCount ? (kind === 'highlow' ? t.tickCount - 1 : t.tickCount) : 0;
    const x = (i: number, time: number) => {
        if (slots) return pad.left + (i / Math.max(1, slots)) * w;
        if (t.dateExpiry && t.dateExpiry > startT) return pad.left + Math.min(1, Math.max(0, (time - startT) / (t.dateExpiry - startT))) * w;
        return pad.left + (i / Math.max(1, points.length - 1, 20)) * w;
    };
    const xy = points.map((p, i) => ({ x: x(i, p.t), y: y(p.q) }));
    const last = xy[xy.length - 1];

    // Shaded zone(s) where the contract wins
    const zones: { from: number; to: number }[] = [];
    if (width) {
        const start = t.entrySpot ?? qs[0];
        if (kind === 'barrier' && t.barrier !== undefined) {
            const by = y(t.barrier);
            const above = UP_TYPES.includes(t.contractType) || (t.contractType === 'ONETOUCH' && start !== undefined && t.barrier >= start) || (t.contractType === 'NOTOUCH' && start !== undefined && t.barrier < start);
            const below = DOWN_TYPES.includes(t.contractType) || (t.contractType === 'ONETOUCH' && start !== undefined && t.barrier < start) || (t.contractType === 'NOTOUCH' && start !== undefined && t.barrier >= start);
            if (above) zones.push({ from: pad.top, to: by });
            else if (below) zones.push({ from: by, to: pad.top + h });
        } else if (kind === 'range' && t.highBarrier !== undefined && t.lowBarrier !== undefined) {
            const hy = y(t.highBarrier);
            const ly = y(t.lowBarrier);
            if (['EXPIRYRANGE', 'EXPIRYRANGEE', 'RANGE'].includes(t.contractType)) zones.push({ from: hy, to: ly });
            else zones.push({ from: pad.top, to: hy }, { from: ly, to: pad.top + h });
        } else if (kind === 'reset') {
            const b = t.resetBarrier ?? t.barrier;
            if (b !== undefined) zones.push(t.contractType === 'RESETCALL' ? { from: pad.top, to: y(b) } : { from: y(b), to: pad.top + h });
        }
    }

    // Reset: where the reset check happens on the chart
    let resetX: number | undefined;
    if (kind === 'reset' && t.resetTime && points.length) {
        const i = points.findIndex((p) => p.t >= t.resetTime!);
        if (i >= 0) resetX = xy[i]!.x;
        else if (slots) resetX = x(Math.ceil(slots / 2), 0); // not reached yet: show where it will be
    }

    const lineColor = open ? colors.textSecondary : won ? PRICE_UP : PRICE_DOWN;
    const dotColor = open ? (winning === null ? colors.primary : winning ? PRICE_UP : PRICE_DOWN) : lineColor;
    const background = open ? withAlpha(colors.inputBackground, 0.6) : withAlpha(won ? PRICE_UP : PRICE_DOWN, 0.12);
    const decimals = t.decimals ?? 2;

    // Only Ups/Downs: colour each step by whether it went the right way
    const runUp = t.contractType === 'RUNHIGH';
    const stepOk = (i: number) => (runUp ? qs[i]! > qs[i - 1]! : qs[i]! < qs[i - 1]!);

    return (
        <View onLayout={onLayout} style={[styles.chart, { backgroundColor: background }]}>
            {width > 0 && (
                <Svg width={width} height={CHART_H}>
                    {zones.map((z, i) => (
                        <Rect key={i} x={pad.left} y={Math.min(z.from, z.to)} width={w} height={Math.abs(z.to - z.from)} fill={PRICE_UP} fillOpacity={0.08} />
                    ))}

                    {/* Tick slots: a small mark for every tick of the contract, filled or still to come */}
                    {!!slots &&
                        Array.from({ length: slots + 1 }, (_, i) => (
                            <Line key={i} x1={x(i, 0)} y1={pad.top + h} x2={x(i, 0)} y2={pad.top + h - 5} stroke={colors.border} strokeWidth={1} />
                        ))}

                    {/* Barriers. Reset: the original barrier dotted once it has been replaced. */}
                    {kind === 'reset' && t.entrySpot !== undefined && t.resetBarrier !== undefined && t.resetBarrier !== t.entrySpot ? (
                        <>
                            <Line x1={pad.left} y1={y(t.entrySpot)} x2={resetX ?? pad.left + w} y2={y(t.entrySpot)} stroke={colors.primary} strokeWidth={2} />
                            <Line x1={resetX ?? pad.left} y1={y(t.entrySpot)} x2={pad.left + w} y2={y(t.entrySpot)} stroke={colors.primary} strokeWidth={1.5} strokeDasharray="3 4" strokeOpacity={0.6} />
                            <Line x1={resetX ?? pad.left} y1={y(t.resetBarrier)} x2={pad.left + w} y2={y(t.resetBarrier)} stroke={colors.primary} strokeWidth={2} />
                        </>
                    ) : (
                        barriers.map((b, i) => <Line key={i} x1={pad.left} y1={y(b)} x2={pad.left + w} y2={y(b)} stroke={colors.primary} strokeWidth={2} />)
                    )}

                    {/* Asians: the running average, which moves with every tick */}
                    {kind === 'asian' && averages.length > 1 && (
                        <Polyline
                            points={averages.map((a, i) => `${xy[i]!.x.toFixed(1)},${y(a).toFixed(1)}`).join(' ')}
                            fill="none"
                            stroke={colors.primary}
                            strokeWidth={2}
                            strokeDasharray="5 4"
                        />
                    )}

                    {/* High/Low Ticks: a line at your tick's price; everything past it beats it */}
                    {selected !== undefined && (
                        <Line x1={pad.left} y1={y(selected)} x2={pad.left + w} y2={y(selected)} stroke={colors.primary} strokeWidth={1.5} strokeDasharray="3 4" />
                    )}

                    {resetX !== undefined && <Line x1={resetX} y1={pad.top - 6} x2={resetX} y2={pad.top + h + 6} stroke={colors.textPrimary} strokeWidth={2} />}

                    {xy.length > 0 && <Line x1={xy[0]!.x} y1={pad.top - 6} x2={xy[0]!.x} y2={pad.top + h + 6} stroke={ENTRY_COLOR} strokeWidth={2} />}
                    {!open && last && (
                        <Line x1={last.x} y1={pad.top - 6} x2={last.x} y2={pad.top + h + 6} stroke={ENTRY_COLOR} strokeWidth={2} strokeDasharray="5 4" />
                    )}

                    {/* The price path. Only Ups/Downs: each step coloured; others: one line. */}
                    {kind === 'runs'
                        ? xy.slice(1).map((p, i) => (
                              <Line key={i} x1={xy[i]!.x} y1={xy[i]!.y} x2={p.x} y2={p.y} stroke={stepOk(i + 1) ? PRICE_UP : PRICE_DOWN} strokeWidth={2.5} strokeLinecap="round" />
                          ))
                        : xy.length > 1 && (
                              <Polyline
                                  points={xy.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                                  fill="none"
                                  stroke={lineColor}
                                  strokeWidth={2}
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                              />
                          )}
                    {xy.map((p, i) => (
                        <Circle key={i} cx={p.x} cy={p.y} r={i === xy.length - 1 ? 5 : 3} fill={i === xy.length - 1 ? dotColor : lineColor} />
                    ))}
                    {/* High/Low Ticks: ring around your tick */}
                    {kind === 'highlow' && t.selectedTick && xy[t.selectedTick - 1] && (
                        <Circle cx={xy[t.selectedTick - 1]!.x} cy={xy[t.selectedTick - 1]!.y} r={9} stroke={colors.primary} strokeWidth={2.5} fill="none" />
                    )}
                    {/* A soft halo on the latest tick while the contract runs */}
                    {open && last && <Circle cx={last.x} cy={last.y} r={10} fill={dotColor} fillOpacity={0.2} />}
                </Svg>
            )}
            {width > 0 && points.length > 0 && (
                <>
                    <Text style={[styles.axis, { top: 2, color: colors.textSecondary }]}>{hi.toFixed(decimals)}</Text>
                    <Text style={[styles.axis, { bottom: 2, color: colors.textSecondary }]}>{lo.toFixed(decimals)}</Text>
                </>
            )}
            {points.length === 0 && <Text style={[styles.waiting, { color: colors.textSecondary }]}>Waiting for the entry tick…</Text>}
        </View>
    );
}

// ---------- Digit trades ----------

// The slider card: how long it takes to glide to the next digit, and its sizes
const SLIDE_MS = 320;
const STRIP_H = 52; // height of the digit strip
const CARD_ABOVE = 44; // how far the slider card reaches above the strip (room for "3/5")
const CARD_BELOW = 10; // ...and below it
const CARD_WIDTH = 1.45; // slider width, in digit cells

/**
 * Digit strip like Deriv's: ten joined cells, winning digits tinted green. A solid rounded card
 * lifted over the strip shows the tick counter ("3/5") and the latest digit in an inner box, and
 * glides smoothly from digit to digit (over the ones in between) on every tick. While the trade
 * runs the card is neutral; at the end it turns green (won) or red (lost). A small dot under the
 * strip marks digits already seen.
 */
function DigitPanel({ trade: t }: { trade: Trade }) {
    const { colors } = useThemeStore();
    const open = t.status === 'open';
    const won = !open && t.profit > 0;
    const decimals = t.decimals ?? 2;
    const latest = t.path[t.path.length - 1];
    const winners = winningDigits(t.contractType, t.barrier);
    const current = latest ? lastDigitOf(latest, decimals) : null;
    const seen = new Set(t.path.map((p) => lastDigitOf(p, decimals)));
    const total = t.tickCount ?? t.path.length;
    const count = Math.min(t.ticksPassed ?? t.path.length, total || t.path.length);
    const priceText = latest ? latest.s ?? latest.q.toFixed(decimals) : null;
    const [whole, frac] = (priceText ?? '').split('.');
    const shown = priceText ? `${Number(whole).toLocaleString('en-US')}${frac !== undefined ? `.${frac}` : ''}` : '';
    // Card colours: the theme's text colour as a solid card (dark on light themes like Deriv's,
    // light on dark themes so it stands out), inner box in the page colour; result colour at the end
    const cardColor = open ? colors.textPrimary : won ? PRICE_UP : PRICE_DOWN;
    const cardText = open ? colors.background : '#FFFFFF';

    // Width of one digit cell, measured, so the card lines up on any screen size
    const [rowWidth, setRowWidth] = useState(0);
    const pitch = rowWidth / 10;

    // Frame position and a small "arrival" pulse, animated on the native side (smooth even while
    // the screen updates)
    const x = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(1)).current;
    const placed = useRef(false);
    const tickKey = `${t.path.length}:${current}`;
    useEffect(() => {
        if (current === null || !pitch) return;
        const target = current * pitch;
        if (!placed.current) {
            // First digit: appear in place, no slide from 0
            x.setValue(target);
            placed.current = true;
        }
        Animated.parallel([
            Animated.timing(x, { toValue: target, duration: SLIDE_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.05, duration: SLIDE_MS * 0.6, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.spring(pulse, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
            ]),
        ]).start();
    }, [tickKey, pitch]);

    return (
        <View style={[styles.digitPanel, { backgroundColor: open ? withAlpha(colors.inputBackground, 0.6) : withAlpha(won ? PRICE_UP : PRICE_DOWN, 0.12) }]}>
            {latest ? (
                <>
                    <Text style={[styles.digitTime, { color: colors.textSecondary }]}>
                        {new Date(latest.t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                    <Text style={[styles.digitPrice, { color: colors.textSecondary }]}>
                        {shown.slice(0, -1)}
                        <Text style={{ color: colors.textPrimary }}>{shown.slice(-1)}</Text>
                    </Text>
                </>
            ) : (
                <Text style={[styles.digitTime, { color: colors.textSecondary, marginVertical: 24 }]}>Waiting for the first tick…</Text>
            )}

            <View style={styles.digitArea} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
                {/* The strip: ten joined cells */}
                <View style={[styles.strip, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                        const isWinner = winners.includes(d);
                        return (
                            <View
                                key={d}
                                style={[
                                    styles.cell,
                                    { borderLeftWidth: d === 0 ? 0 : 1, borderColor: colors.border, backgroundColor: isWinner ? withAlpha(PRICE_UP, 0.14) : 'transparent' },
                                ]}
                            >
                                <Text style={[styles.cellText, { color: isWinner ? PRICE_UP : withAlpha(colors.textSecondary, 0.7) }]}>{d}</Text>
                            </View>
                        );
                    })}
                </View>

                {/* Dots: digits that already came up during the trade */}
                <View style={styles.dotRow}>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                        <View key={d} style={styles.dotCell}>
                            <View style={[styles.seenDot, { backgroundColor: seen.has(d) && d !== current ? colors.textSecondary : 'transparent' }]} />
                        </View>
                    ))}
                </View>

                {/* The slider card, lifted over the strip */}
                {current !== null && pitch > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.slider,
                            {
                                width: pitch * CARD_WIDTH,
                                left: pitch / 2 - (pitch * CARD_WIDTH) / 2,
                                backgroundColor: cardColor,
                                shadowColor: cardColor,
                                transform: [{ translateX: x }, { scale: pulse }],
                            },
                        ]}
                    >
                        <Text style={[styles.sliderCount, { color: cardText }]}>{`${count} / ${total}`}</Text>
                        <View style={[styles.sliderBox, { backgroundColor: colors.background }]}>
                            <Text style={[styles.sliderDigit, { color: colors.textPrimary }]}>{current}</Text>
                        </View>
                        {/* Small corner marks, like Deriv's */}
                        <View style={[styles.corner, { left: 6, backgroundColor: withAlpha(cardText, 0.6) }]} />
                        <View style={[styles.corner, { right: 6, backgroundColor: withAlpha(cardText, 0.6) }]} />
                    </Animated.View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: { borderWidth: 1.5, borderRadius: 18, padding: 14, marginBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    title: { fontSize: 17, fontFamily: FONTS.semibold },
    sub: { fontSize: 12, fontFamily: FONTS.regular },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    chipDot: { width: 7, height: 7, borderRadius: 4 },
    chipText: { fontSize: 12, fontFamily: FONTS.semibold },
    close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    figures: { flexDirection: 'row', marginBottom: 8 },
    figure: { flex: 1, alignItems: 'center' },
    figureLabel: { fontSize: 12, fontFamily: FONTS.semibold, textAlign: 'center' },
    figureValue: { fontSize: 13, fontFamily: FONTS.medium, marginTop: 2 },
    meta: { fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', marginBottom: 4 },
    status: { fontSize: 13, fontFamily: FONTS.semibold, textAlign: 'center', marginBottom: 8 },
    chart: { height: CHART_H, borderRadius: 12, overflow: 'hidden' },
    axis: { position: 'absolute', left: 8, fontSize: 10, fontFamily: FONTS.regular },
    waiting: { position: 'absolute', top: CHART_H / 2 - 8, alignSelf: 'center', fontSize: 13, fontFamily: FONTS.regular },
    legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendText: { fontSize: 11, fontFamily: FONTS.regular },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    ref: { fontSize: 11, fontFamily: FONTS.regular },
    sell: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
    sellText: { fontSize: 13, fontFamily: FONTS.semibold },
    digitPanel: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
    digitTime: { fontSize: 12, fontFamily: FONTS.medium },
    digitPrice: { fontSize: 40, fontFamily: FONTS.bold, marginVertical: 2 },
    // Room above the strip for the part of the slider card that sticks out (with "3/5")
    digitArea: { alignSelf: 'stretch', marginTop: 6, paddingTop: CARD_ABOVE },
    strip: { flexDirection: 'row', height: STRIP_H, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cellText: { fontSize: 22, fontFamily: FONTS.bold },
    dotRow: { flexDirection: 'row', marginTop: CARD_BELOW + 6 },
    dotCell: { flex: 1, alignItems: 'center' },
    seenDot: { width: 5, height: 5, borderRadius: 3 },
    slider: {
        position: 'absolute',
        top: 0,
        height: CARD_ABOVE + STRIP_H + CARD_BELOW,
        borderRadius: 10,
        alignItems: 'center',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    sliderCount: { marginTop: 12, fontSize: 14, fontFamily: FONTS.bold, letterSpacing: 0.5 },
    // Inner box sits exactly over the strip, a little inset
    sliderBox: { position: 'absolute', top: CARD_ABOVE + 5, left: 7, right: 7, height: STRIP_H - 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    sliderDigit: { fontSize: 24, fontFamily: FONTS.bold },
    corner: { position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2 },
});
