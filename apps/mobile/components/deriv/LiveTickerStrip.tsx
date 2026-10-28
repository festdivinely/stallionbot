// Small live ticker pinned at the top of the trading screen, like Deriv SmartTrader's: a sparkline of
// the latest ticks (blue dot = highest of them, end dot = the newest tick) and the newest price in a
// badge that is green when the last tick went up and red when it went down. It stays in view while
// scrolling, so it can be compared with the buy buttons and the live progress card tick by tick.
import React, { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import { PRICE_DOWN, PRICE_UP } from '../welcome/welcomePalette';

const POINTS = 20; // ticks shown in the sparkline
const LINE_W = 96;
const LINE_H = 30;
const HIGH_COLOR = '#2F6BFF'; // Deriv marks the highest tick in blue

interface Props {
    /** Latest prices, oldest first */
    quotes: number[];
    /** Price decimals for this market */
    decimals: number;
    /** Market name, shown small next to the price */
    name?: string;
}

const formatPrice = (q: number, decimals: number) => {
    const [whole, frac] = q.toFixed(decimals).split('.');
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${frac ? `.${frac}` : ''}`;
};

export default function LiveTickerStrip({ quotes, decimals, name }: Props) {
    const { colors } = useThemeStore();
    const [width, setWidth] = useState(LINE_W);
    const recent = quotes.slice(-POINTS);
    const last = recent[recent.length - 1];
    const prev = recent[recent.length - 2];
    const direction = last === undefined || prev === undefined || last === prev ? 0 : last > prev ? 1 : -1;
    const tone = direction > 0 ? PRICE_UP : direction < 0 ? PRICE_DOWN : colors.textSecondary;

    // Sparkline points, with a little padding so the dots aren't cut off
    const lo = Math.min(...recent);
    const hi = Math.max(...recent);
    const span = hi - lo || 1;
    const pad = 4;
    const x = (i: number) => pad + (i / Math.max(1, recent.length - 1)) * (width - pad * 2);
    const y = (q: number) => pad + (1 - (q - lo) / span) * (LINE_H - pad * 2);
    const highIndex = recent.lastIndexOf(hi);

    return (
        <View style={[styles.strip, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <View style={{ width: LINE_W }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
                {recent.length > 1 && (
                    <Svg width={width} height={LINE_H}>
                        <Polyline
                            points={recent.map((q, i) => `${x(i).toFixed(1)},${y(q).toFixed(1)}`).join(' ')}
                            fill="none"
                            stroke={colors.textSecondary}
                            strokeWidth={1.5}
                            strokeLinejoin="round"
                        />
                        <Circle cx={x(highIndex)} cy={y(hi)} r={3} fill={HIGH_COLOR} />
                        <Circle cx={x(recent.length - 1)} cy={y(last!)} r={3.5} fill={tone} />
                    </Svg>
                )}
            </View>
            <View style={[styles.badge, { backgroundColor: last === undefined ? colors.inputBackground : tone }]}>
                <Text style={styles.badgeText}>{last === undefined ? '—' : formatPrice(last, decimals)}</Text>
            </View>
            {name ? (
                <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
                    {name}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    strip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
    badgeText: { color: '#FFFFFF', fontSize: 17, fontFamily: FONTS.bold, letterSpacing: 0.3 },
    name: { flex: 1, fontSize: 12, fontFamily: FONTS.medium },
});
