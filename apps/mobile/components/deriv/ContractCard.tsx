// Live progress of one contract, like Deriv SmartTrader's contract box, for barrier trades:
// Rise/Fall, Higher/Lower, Touch/No Touch.
//  - Top: Potential payout / Total cost / Potential profit while it runs; Buy price / Final price /
//    Profit (or Loss) once it ends. Title says In progress / Won / Lost.
//  - Chart: every tick as a dot joined to the last; solid orange line = entry spot, line across =
//    barrier, dashed orange line = exit spot. The background turns green (won) or red (lost).
// Better than Deriv's: the barrier always stays in view (Deriv's can scroll off the chart), the
// winning side of the barrier is shaded, a live "Winning now / Losing now" label, and tick trades
// show every tick slot from the start so you can watch the trade fill up.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import { PRICE_DOWN, PRICE_UP, withAlpha } from '../welcome/welcomePalette';
import type { Trade } from '../../hooks/useDerivMarket';

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

const UP_TYPES = ['CALL', 'CALLE', 'HIGHER'];
const DOWN_TYPES = ['PUT', 'PUTE', 'LOWER'];

/** Is this contract winning right now? null when we can't tell from the price alone. */
export function winningNow(t: Trade): boolean | null {
    const spot = t.path[t.path.length - 1]?.q ?? t.currentSpot;
    const b = t.barrier;
    if (spot === undefined || b === undefined) return null;
    if (t.contractType === 'CALLE') return spot >= b;
    if (t.contractType === 'PUTE') return spot <= b;
    if (UP_TYPES.includes(t.contractType)) return spot > b;
    if (DOWN_TYPES.includes(t.contractType)) return spot < b;
    if (t.contractType === 'ONETOUCH' || t.contractType === 'NOTOUCH') {
        const start = t.entrySpot ?? t.path[0]?.q;
        if (start === undefined) return null;
        const prices = t.path.map((p) => p.q);
        const touched = b >= start ? Math.max(...prices) >= b : Math.min(...prices) <= b;
        return t.contractType === 'ONETOUCH' ? touched : !touched;
    }
    return null;
}

const fmt = (n: number | undefined, decimals = 2) =>
    n === undefined ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

interface Props {
    trade: Trade;
    currency?: string;
    onSell?: (t: Trade) => void;
}

export default function ContractCard({ trade: t, currency = 'USD', onSell }: Props) {
    const { colors } = useThemeStore();
    const open = t.status === 'open';
    const won = !open && t.profit > 0;
    const resultColor = won ? PRICE_UP : PRICE_DOWN;
    const winning = open ? winningNow(t) : null;
    const decimals = t.decimals ?? 2;
    const label = CONTRACT_LABELS[t.contractType] ?? t.contractType;

    const title = open ? 'Contract in progress' : t.status === 'sold' ? 'Contract sold' : won ? 'This contract won' : t.status === 'cancelled' ? 'Contract cancelled' : 'This contract lost';
    const finalPrice = t.sellPrice ?? t.buyPrice + t.profit;

    // Progress: ticks for tick contracts, time for the rest
    const progressText = (() => {
        if (!open) return null;
        if (t.tickCount) return `Tick ${Math.min(t.ticksPassed ?? 0, t.tickCount)} of ${t.tickCount}`;
        if (t.dateExpiry) {
            const s = Math.max(0, Math.round(t.dateExpiry - Date.now() / 1000));
            return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
        }
        return null;
    })();

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: open ? colors.border : resultColor }]}>
            {/* Title */}
            <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: open ? colors.textPrimary : resultColor }]}>{title}</Text>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        {label} · {t.symbol}
                    </Text>
                </View>
                {open && winning !== null && (
                    <View style={[styles.chip, { backgroundColor: withAlpha(winning ? PRICE_UP : PRICE_DOWN, 0.15) }]}>
                        <View style={[styles.chipDot, { backgroundColor: winning ? PRICE_UP : PRICE_DOWN }]} />
                        <Text style={[styles.chipText, { color: winning ? PRICE_UP : PRICE_DOWN }]}>{winning ? 'Winning now' : 'Losing now'}</Text>
                    </View>
                )}
            </View>

            {/* Figures */}
            <View style={styles.figures}>
                {open ? (
                    <>
                        <Figure label="Potential payout" value={`${fmt(t.payout)} ${currency}`} />
                        <Figure label="Total cost" value={`${fmt(t.buyPrice)} ${currency}`} />
                        <Figure label="Potential profit" value={`${fmt(t.payout - t.buyPrice)} ${currency}`} />
                    </>
                ) : (
                    <>
                        <Figure label="Buy price" value={`${fmt(t.buyPrice)} ${currency}`} />
                        <Figure label="Final price" value={`${fmt(finalPrice)} ${currency}`} />
                        <Figure label={t.profit >= 0 ? 'Profit' : 'Loss'} value={`${fmt(t.profit)} ${currency}`} color={resultColor} />
                    </>
                )}
            </View>

            {(t.barrier !== undefined || progressText) && (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {t.barrier !== undefined ? `Barrier: ${fmt(t.barrier, decimals)}` : ''}
                    {t.barrier !== undefined && progressText ? '   ·   ' : ''}
                    {progressText ?? ''}
                </Text>
            )}

            <ContractChart trade={t} winning={winning} />

            <View style={styles.legend}>
                <LegendItem color={ENTRY_COLOR} label="Entry spot" />
                <LegendItem color={colors.primary} label="Barrier" />
                <LegendItem color={ENTRY_COLOR} label="Exit spot" dashed />
            </View>

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

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
    const { colors } = useThemeStore();
    return (
        <View style={styles.legendItem}>
            <Svg width={14} height={14}>
                {label === 'Barrier' ? (
                    <Line x1={0} y1={7} x2={14} y2={7} stroke={color} strokeWidth={2} />
                ) : (
                    <Line x1={7} y1={0} x2={7} y2={14} stroke={color} strokeWidth={2} strokeDasharray={dashed ? '3 2' : undefined} />
                )}
            </Svg>
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>{label}</Text>
        </View>
    );
}

/** The tick-by-tick chart. Drawn in real pixels (measured width) so lines and dots stay crisp. */
function ContractChart({ trade: t, winning }: { trade: Trade; winning: boolean | null }) {
    const { colors } = useThemeStore();
    const [width, setWidth] = useState(0);
    const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

    const open = t.status === 'open';
    const won = !open && t.profit > 0;
    const pad = { left: 8, right: 8, top: 12, bottom: 12 };
    const w = Math.max(0, width - pad.left - pad.right);
    const h = CHART_H - pad.top - pad.bottom;
    const points = t.path;

    // Y range: the prices AND the barrier, so the barrier never scrolls out of view
    const values = [...points.map((p) => p.q), ...(t.barrier !== undefined ? [t.barrier] : []), ...(t.entrySpot !== undefined ? [t.entrySpot] : [])];
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const span = hi - lo || Math.abs(hi) * 0.0001 || 1;
    const yMin = lo - span * 0.15;
    const yMax = hi + span * 0.15;
    const y = (q: number) => pad.top + h - ((q - yMin) / (yMax - yMin)) * h;

    // X: tick contracts get one slot per tick from the start (entry + tickCount ticks); timed
    // contracts run from start to expiry; contracts without an end just spread their points.
    const startT = t.entrySpotTime ?? t.dateStart ?? points[0]?.t ?? 0;
    const x = (i: number, time: number) => {
        if (t.tickCount) return pad.left + (i / Math.max(1, t.tickCount)) * w;
        if (t.dateExpiry && t.dateExpiry > startT) return pad.left + Math.min(1, Math.max(0, (time - startT) / (t.dateExpiry - startT))) * w;
        return pad.left + (i / Math.max(1, points.length - 1, 20)) * w;
    };
    const xy = points.map((p, i) => ({ x: x(i, p.t), y: y(p.q) }));
    const last = xy[xy.length - 1];

    // Shade the side of the barrier where the contract wins
    let zone: { from: number; to: number } | null = null;
    if (t.barrier !== undefined && width) {
        const by = y(t.barrier);
        const start = t.entrySpot ?? points[0]?.q;
        const above = UP_TYPES.includes(t.contractType) || (t.contractType === 'ONETOUCH' && start !== undefined && t.barrier >= start) || (t.contractType === 'NOTOUCH' && start !== undefined && t.barrier < start);
        const below = DOWN_TYPES.includes(t.contractType) || (t.contractType === 'ONETOUCH' && start !== undefined && t.barrier < start) || (t.contractType === 'NOTOUCH' && start !== undefined && t.barrier >= start);
        if (above) zone = { from: pad.top, to: by };
        else if (below) zone = { from: by, to: pad.top + h };
    }

    const lineColor = open ? colors.textSecondary : won ? PRICE_UP : PRICE_DOWN;
    const dotColor = open ? (winning === null ? colors.primary : winning ? PRICE_UP : PRICE_DOWN) : lineColor;
    const background = open ? withAlpha(colors.inputBackground, 0.6) : withAlpha(won ? PRICE_UP : PRICE_DOWN, 0.12);
    const decimals = t.decimals ?? 2;

    return (
        <View onLayout={onLayout} style={[styles.chart, { backgroundColor: background }]}>
            {width > 0 && (
                <Svg width={width} height={CHART_H}>
                    {zone && <Rect x={pad.left} y={Math.min(zone.from, zone.to)} width={w} height={Math.abs(zone.to - zone.from)} fill={PRICE_UP} fillOpacity={0.07} />}

                    {/* Tick slots: light marks for each tick still to come */}
                    {!!t.tickCount &&
                        Array.from({ length: t.tickCount + 1 }, (_, i) => (
                            <Line key={i} x1={x(i, 0)} y1={pad.top + h} x2={x(i, 0)} y2={pad.top + h - 5} stroke={colors.border} strokeWidth={1} />
                        ))}

                    {t.barrier !== undefined && (
                        <Line x1={pad.left} y1={y(t.barrier)} x2={pad.left + w} y2={y(t.barrier)} stroke={colors.primary} strokeWidth={2} />
                    )}

                    {xy.length > 0 && (
                        <Line x1={xy[0]!.x} y1={pad.top - 6} x2={xy[0]!.x} y2={pad.top + h + 6} stroke={ENTRY_COLOR} strokeWidth={2} />
                    )}
                    {!open && last && (
                        <Line x1={last.x} y1={pad.top - 6} x2={last.x} y2={pad.top + h + 6} stroke={ENTRY_COLOR} strokeWidth={2} strokeDasharray="5 4" />
                    )}

                    {xy.length > 1 && (
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
                    {/* A soft halo on the latest tick while the contract runs */}
                    {open && last && <Circle cx={last.x} cy={last.y} r={10} fill={dotColor} fillOpacity={0.2} />}
                </Svg>
            )}
            {width > 0 && points.length > 0 && (
                <>
                    <Text style={[styles.axis, { top: 2, color: colors.textSecondary }]}>{(yMax - span * 0.15).toFixed(decimals)}</Text>
                    <Text style={[styles.axis, { bottom: 2, color: colors.textSecondary }]}>{(yMin + span * 0.15).toFixed(decimals)}</Text>
                </>
            )}
            {points.length === 0 && <Text style={[styles.waiting, { color: colors.textSecondary }]}>Waiting for the entry tick…</Text>}
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
    figures: { flexDirection: 'row', marginBottom: 8 },
    figure: { flex: 1, alignItems: 'center' },
    figureLabel: { fontSize: 12, fontFamily: FONTS.semibold, textAlign: 'center' },
    figureValue: { fontSize: 13, fontFamily: FONTS.medium, marginTop: 2 },
    meta: { fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', marginBottom: 8 },
    chart: { height: CHART_H, borderRadius: 12, overflow: 'hidden' },
    axis: { position: 'absolute', left: 8, fontSize: 10, fontFamily: FONTS.regular },
    waiting: { position: 'absolute', top: CHART_H / 2 - 8, alignSelf: 'center', fontSize: 13, fontFamily: FONTS.regular },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendText: { fontSize: 11, fontFamily: FONTS.regular },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    ref: { fontSize: 11, fontFamily: FONTS.regular },
    sell: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
    sellText: { fontSize: 13, fontFamily: FONTS.semibold },
});
