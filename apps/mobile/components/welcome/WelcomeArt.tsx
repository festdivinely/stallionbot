// Illustrations for the welcome slides. Everything is drawn (no photos) in the user's theme
// colours, so it re-colours itself whenever the theme changes.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import RobotIllustration from '../robotFace';
import { PRICE_UP, type WelcomePalette } from './welcomePalette';
import { BROKERS } from '../../constants/brokers';

type IconName = keyof typeof Ionicons.glyphMap;

/** Soft circles and faint candlestick bars behind a slide. */
export function BackgroundDecor({ palette, variant }: { palette: WelcomePalette; variant: 'market' | 'rules' | 'demo' }) {
    const c = palette.accent;
    return (
        <View pointerEvents="none" style={styles.fill}>
            <Svg width="100%" height="100%" viewBox="0 0 200 400" preserveAspectRatio="xMidYMid slice">
                {variant === 'market' && (
                    <>
                        <Circle cx={195} cy={30} r={70} fill={c} fillOpacity={0.1} />
                        <Circle cx={0} cy={220} r={55} fill={c} fillOpacity={0.07} />
                        {/* candlesticks: [x, top, height] */}
                        {[[14, 60, 18], [22, 54, 26], [30, 66, 12], [166, 150, 22], [174, 140, 30], [182, 154, 14]].map(([x, y, h]) => (
                            <Rect key={`${x}-${y}`} x={x} y={y} width={4} height={h} rx={1} fill={c} fillOpacity={0.18} />
                        ))}
                    </>
                )}
                {variant === 'rules' && (
                    <>
                        <Circle cx={10} cy={50} r={60} fill={c} fillOpacity={0.08} />
                        <Circle cx={190} cy={260} r={50} fill={c} fillOpacity={0.08} />
                    </>
                )}
                {variant === 'demo' && (
                    <>
                        <Circle cx={100} cy={150} r={85} fill={c} fillOpacity={0.06} />
                        <Circle cx={100} cy={150} r={58} fill={c} fillOpacity={0.07} />
                    </>
                )}
            </Svg>
        </View>
    );
}

/** A small rounded label with an icon, used around the robot and on the demo slide. */
export function Chip({ icon, label, iconColor, palette }: { icon: IconName; label: string; iconColor: string; palette: WelcomePalette }) {
    return (
        <View style={[styles.chip, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Ionicons name={icon} size={13} color={iconColor} />
            <Text style={[styles.chipText, { color: palette.text }]}>{label}</Text>
        </View>
    );
}

/** Gentle up-and-down float; `delay` staggers neighbours so they don't move in sync. */
function Floating({ children, delay, style }: { children: React.ReactNode; delay: number; style: object }) {
    const y = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(y, { toValue: -5, duration: 1400, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
                Animated.timing(y, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [y, delay]);
    return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

const RING = 170;

/** The robot in a ring, with a slowly turning dashed orbit and floating chips around it. */
export function HeroRobot({ palette }: { palette: WelcomePalette }) {
    const spin = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }));
        loop.start();
        return () => loop.stop();
    }, [spin]);
    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={styles.heroBox}>
            <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
                <Svg width={RING + 28} height={RING + 28}>
                    <Circle
                        cx={(RING + 28) / 2}
                        cy={(RING + 28) / 2}
                        r={RING / 2 + 12}
                        stroke={palette.accent}
                        strokeOpacity={0.55}
                        strokeWidth={1.5}
                        strokeDasharray="5 7"
                        fill="none"
                    />
                </Svg>
            </Animated.View>
            <View style={[styles.robotRing, { borderColor: palette.accent, backgroundColor: palette.card }]}>
                <RobotIllustration width={RING - 24} height={RING - 24} />
            </View>
            <Floating delay={0} style={{ position: 'absolute', top: 0, left: -70 }}>
                <Chip icon="trending-up" label="Live prices" iconColor={PRICE_UP} palette={palette} />
            </Floating>
            <Floating delay={500} style={{ position: 'absolute', top: RING / 2 - 4, right: -62 }}>
                <Chip icon="time-outline" label="24/7" iconColor={palette.accent} palette={palette} />
            </Floating>
            <Floating delay={1000} style={{ position: 'absolute', bottom: -6, left: -54 }}>
                <Chip icon="shield-checkmark-outline" label="Demo first" iconColor={palette.accent} palette={palette} />
            </Floating>
        </View>
    );
}

/** Slide 2: the brokers the app works with, plus a "more coming" row. Reads constants/brokers.ts. */
export function BrokersIllustration({ palette }: { palette: WelcomePalette }) {
    const rows = [
        ...BROKERS.map((b) => ({ key: b.id, initials: b.initials, name: b.name, live: b.status === 'available' })),
        { key: 'more', initials: '+', name: 'More brokers', live: false },
    ];
    return (
        <View style={[styles.botCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            {rows.map((r) => (
                <View key={r.key} style={styles.botHeader}>
                    <View style={[styles.botAvatar, { backgroundColor: r.live ? palette.accent : palette.accentSoft }]}>
                        <Text style={[styles.initials, { color: r.live ? palette.onAccent : palette.accent }]}>{r.initials}</Text>
                    </View>
                    <Text style={[styles.botName, { color: palette.text, flex: 1 }]}>{r.name}</Text>
                    <View style={styles.runningRow}>
                        <View style={[styles.runningDot, { backgroundColor: r.live ? PRICE_UP : palette.dot }]} />
                        <Text style={[styles.running, { color: r.live ? PRICE_UP : palette.textMuted }]}>
                            {r.live ? 'Available' : 'Coming soon'}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
}

/** Slide 3: a bold shield tile with a soft halo. */
export function ShieldIllustration({ palette }: { palette: WelcomePalette }) {
    return (
        <View style={[styles.shieldHalo, { borderColor: palette.cardBorder }]}>
            <View style={[styles.shieldTile, { backgroundColor: palette.accent }]}>
                <Ionicons name="shield-checkmark" size={44} color={palette.onAccent} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    chipText: { fontSize: 12, fontWeight: '600' },
    heroBox: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
    orbit: { position: 'absolute', top: -14, left: -14 },
    robotRing: {
        width: RING,
        height: RING,
        borderRadius: RING / 2,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    botCard: {
        alignSelf: 'stretch',
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 4,
    },
    botHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    botAvatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    botName: { fontSize: 15, fontWeight: '700' },
    initials: { fontSize: 14, fontWeight: '700' },
    runningRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    runningDot: { width: 7, height: 7, borderRadius: 4 },
    running: { fontSize: 12, fontWeight: '600' },
    shieldHalo: { width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
    shieldTile: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
