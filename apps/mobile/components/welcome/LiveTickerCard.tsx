// One market box on the welcome screen: name, latest price, change over the last minute,
// and a small line chart of recent prices that moves as new ticks arrive.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { PRICE_DOWN, PRICE_UP, type WelcomePalette } from './welcomePalette';

interface Props {
    name: string;
    quotes: number[]; // oldest first
    palette: WelcomePalette;
    offline?: boolean; // no connection to the price feed
}

const CHART_W = 100;
const CHART_H = 36;

// "Volatility 75 Index" -> "Volatility 75" (the box is narrow)
const shortName = (name: string) => name.replace(/\s+Index$/, '');

// 33373.8612 -> "33,373.86"
const formatPrice = (n: number) => {
    const [whole, cents] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${cents}`;
};

function toPoints(quotes: number[]) {
    const min = Math.min(...quotes);
    const max = Math.max(...quotes);
    const range = max - min || 1;
    const step = CHART_W / Math.max(quotes.length - 1, 1);
    // SVG y grows downwards, so the highest price gets the smallest y
    return quotes
        .map((q, i) => `${(i * step).toFixed(1)},${(CHART_H - 2 - ((q - min) / range) * (CHART_H - 4)).toFixed(1)}`)
        .join(' ');
}

export default function LiveTickerCard({ name, quotes, palette, offline = false }: Props) {
    const hasData = quotes.length > 1;
    const first = quotes[0] ?? 0;
    const last = quotes[quotes.length - 1] ?? 0;
    const rawChange = hasData && first ? ((last - first) / first) * 100 : 0;
    // Round first, so a tiny drop shows as "0.00%" rather than "−0.00%"
    const change = Math.round(rawChange * 100) / 100 || 0;
    const color = change >= 0 ? PRICE_UP : PRICE_DOWN;

    return (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[styles.name, { color: palette.textMuted }]} numberOfLines={1}>
                {shortName(name)}
            </Text>
            <Text style={[styles.price, { color: palette.text }]}>
                {hasData ? formatPrice(last) : '—'}
            </Text>
            <Text style={[styles.change, { color: hasData ? color : palette.textMuted }]}>
                {hasData
                    ? `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(2)}%`
                    : offline ? 'Unavailable' : 'Loading…'}
            </Text>
            <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
                {hasData && (
                    // Soft filled area under the line, closed off along the bottom edge
                    <Polygon
                        points={`0,${CHART_H} ${toPoints(quotes)} ${CHART_W},${CHART_H}`}
                        fill={color}
                        fillOpacity={0.14}
                    />
                )}
                {hasData && (
                    <Polyline
                        points={toPoints(quotes)}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.8}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                    />
                )}
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    name: {
        fontSize: 12,
    },
    price: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
    },
    change: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
});
