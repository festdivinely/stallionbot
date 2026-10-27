// The welcome flow: slide 1 is the live market screen, slide 2 shows the supported brokers, and the
// last slide (demo and safety) is where the user signs up or logs in.
// Moving between slides: swipe, the round Next button (its ring fills with progress), tap a dot,
// or Skip (jumps to the last slide). Never auto-advances. A one-time nudge on first launch
// shows that the slides can be swiped.
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    FlatList,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import LiveTickerCard from './LiveTickerCard';
import { BackgroundDecor, BrokersIllustration, Chip, HeroRobot, ShieldIllustration } from './WelcomeArt';
import { PRICE_DOWN, PRICE_UP, withAlpha, type WelcomePalette } from './welcomePalette';
import { useLiveTicks, type FeedStatus } from '../../hooks/useLiveTicks';

const SLIDES = ['market', 'rules', 'demo'] as const;
type Slide = (typeof SLIDES)[number];
type IconName = keyof typeof Ionicons.glyphMap;

// Three highlight tiles under slides 1 and 2 (slide 3 shows the account buttons instead)
const HIGHLIGHTS: Record<'market' | 'rules', { icon: IconName; label: string }[]> = {
    market: [
        { icon: 'pulse-outline', label: 'Live data' },
        { icon: 'hardware-chip-outline', label: 'Smart bots' },
        { icon: 'git-network-outline', label: 'Many brokers' },
    ],
    rules: [
        { icon: 'construct-outline', label: 'Build bots' },
        { icon: 'hand-left-outline', label: 'Trade manually' },
        { icon: 'shield-outline', label: 'Loss limits' },
    ],
};

const NUDGE_KEY = 'welcomeSwipeNudgeShown';
// Shown until the first prices arrive, so the boxes have the right names straight away
const PLACEHOLDER_SERIES = [
    { symbol: 'R_75', name: 'Volatility 75 Index', quotes: [] as number[] },
    { symbol: 'R_100', name: 'Volatility 100 Index', quotes: [] as number[] },
];

interface Props {
    palette: WelcomePalette;
}

export default function WelcomeSlides({ palette }: Props) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { series, status } = useLiveTicks();

    const listRef = useRef<FlatList<Slide>>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const entrance = useRef(new Animated.Value(0)).current;
    const [index, setIndex] = useState(0);
    // A horizontal list only gives each slide its content's height, so measure the list and
    // give every slide the full height (otherwise the content can't be vertically centred)
    const [slideHeight, setSlideHeight] = useState(0);

    // Content fades and rises in when the screen opens
    useEffect(() => {
        Animated.timing(entrance, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }, [entrance]);
    const enter = (offset: number) => ({
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
    });

    // One-time nudge: peek at slide 2 and bounce back, so new users see there is more to swipe
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        AsyncStorage.getItem(NUDGE_KEY)
            .then((seen) => {
                if (seen) return;
                timers.push(setTimeout(() => listRef.current?.scrollToOffset({ offset: width * 0.18, animated: true }), 1400));
                timers.push(setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), 1850));
                AsyncStorage.setItem(NUDGE_KEY, '1').catch(() => {});
            })
            .catch(() => {});
        return () => timers.forEach(clearTimeout);
    }, [width]);

    // Work out the current slide from the scroll position. (onMomentumScrollEnd only fires after a
    // finger swipe, not when a dot, Next or Skip moves the list, so it can't be relied on.)
    useEffect(() => {
        const id = scrollX.addListener(({ value }) => {
            const i = Math.min(SLIDES.length - 1, Math.max(0, Math.round(value / width)));
            setIndex((prev) => (prev === i ? prev : i));
        });
        return () => scrollX.removeListener(id);
    }, [scrollX, width]);

    const goTo = (i: number) => listRef.current?.scrollToIndex({ index: i, animated: true });
    const goSignUp = () => router.push('/(auth)/signup');
    const goLogin = () => router.push('/(auth)');

    const lastIndex = SLIDES.length - 1;
    const isLast = index === lastIndex;
    const tickers = series.length ? series : PLACEHOLDER_SERIES;

    const renderSlide = ({ item }: { item: Slide }) => (
        <View style={[styles.slide, { width, height: slideHeight || undefined }]}>
            <BackgroundDecor palette={palette} variant={item} />

            {item === 'market' && (
                <View style={styles.slideBody}>
                    <Animated.View style={[styles.hero, enter(24)]}>
                        <HeroRobot palette={palette} />
                        <Text style={[styles.title, { color: palette.text }]}>Trade smarter</Text>
                        <Text style={[styles.subtitle, { color: palette.textMuted }]}>Bots for every broker you use</Text>
                    </Animated.View>
                    <Animated.View style={[styles.tickerRow, enter(40)]}>
                        {tickers.slice(0, 2).map((s) => (
                            <LiveTickerCard key={s.symbol} name={s.name} quotes={s.quotes} palette={palette} offline={status === 'offline'} />
                        ))}
                    </Animated.View>
                </View>
            )}

            {item === 'rules' && (
                <View style={[styles.slideBody, styles.centered]}>
                    <BrokersIllustration palette={palette} />
                    <Text style={[styles.title, styles.titleGap, { color: palette.text }]}>All your brokers, one app</Text>
                    <Text style={[styles.body, { color: palette.textMuted }]}>
                        Pick a broker, then build a bot or trade by hand with ready-made strategies. Your limits apply everywhere.
                    </Text>
                </View>
            )}

            {item === 'demo' && (
                <View style={[styles.slideBody, styles.centered]}>
                    <ShieldIllustration palette={palette} />
                    <View style={styles.chipRow}>
                        <Chip icon="wallet-outline" label="Virtual money" iconColor={palette.accent} palette={palette} />
                        <Chip icon="checkmark-circle-outline" label="Risk-checked" iconColor={PRICE_UP} palette={palette} />
                    </View>
                    <Text style={[styles.title, styles.titleGap, { color: palette.text }]}>Start risk-free on demo</Text>
                    <Text style={[styles.body, { color: palette.textMuted }]}>
                        Practise with virtual money until you're confident. Every trade passes a risk check before it's placed.
                    </Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: palette.background, paddingBottom: insets.bottom + 16 }]}>
            {/* Top bar: live status on the market slide. (The palette button floats above every
                screen; see app/_layout.tsx.) */}
            <View style={styles.topBar}>
                {index === 0 && <StatusBadge status={status} palette={palette} />}
            </View>

            <Animated.FlatList
                ref={listRef}
                data={SLIDES}
                keyExtractor={(s) => s}
                renderItem={renderSlide}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                onLayout={(e) => setSlideHeight(e.nativeEvent.layout.height)}
                style={styles.list}
            />

            {/* Fixed-height bottom area, so the slides above never jump between layouts */}
            <View style={styles.bottom}>
                {isLast ? (
                    <>
                        <Dots scrollX={scrollX} width={width} palette={palette} onPress={goTo} />
                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: palette.accent, shadowColor: palette.accent }]}
                            onPress={goSignUp}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.primaryText, { color: palette.onAccent }]}>Create account</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.secondaryButton, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}
                            onPress={goLogin}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.secondaryText, { color: palette.text }]}>I already have an account</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Highlights items={HIGHLIGHTS[SLIDES[index] as 'market' | 'rules']} palette={palette} />
                        <View style={styles.navRow}>
                            <TouchableOpacity onPress={() => goTo(lastIndex)} hitSlop={12} style={styles.skipButton}>
                                <Text style={[styles.skip, { color: palette.textMuted }]}>Skip</Text>
                            </TouchableOpacity>
                            <Dots scrollX={scrollX} width={width} palette={palette} onPress={goTo} />
                            <NextButton progress={(index + 1) / SLIDES.length} onPress={() => goTo(index + 1)} palette={palette} />
                        </View>
                    </>
                )}
            </View>
        </View>
    );
}

function StatusBadge({ status, palette }: { status: FeedStatus; palette: WelcomePalette }) {
    const look = {
        live: { label: 'Live', color: PRICE_UP },
        connecting: { label: 'Connecting…', color: palette.textMuted },
        offline: { label: 'Offline', color: PRICE_DOWN },
    }[status];
    return (
        <View style={[styles.badge, { backgroundColor: withAlpha(look.color, 0.14) }]}>
            <View style={[styles.badgeDot, { backgroundColor: look.color }]} />
            <Text style={[styles.badgeText, { color: look.color }]}>{look.label}</Text>
        </View>
    );
}

/** Three icon tiles summing up the current slide. */
function Highlights({ items, palette }: { items: { icon: IconName; label: string }[]; palette: WelcomePalette }) {
    return (
        <View style={styles.highlights}>
            {items.map((h) => (
                <View key={h.label} style={[styles.highlight, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                    <View style={[styles.highlightIcon, { backgroundColor: palette.accentSoft }]}>
                        <Ionicons name={h.icon} size={18} color={palette.accent} />
                    </View>
                    <Text style={[styles.highlightText, { color: palette.text }]} numberOfLines={1}>{h.label}</Text>
                </View>
            ))}
        </View>
    );
}

/** Page dots: the current one stretches; tap any dot to jump there. */
function Dots({ scrollX, width, palette, onPress }: {
    scrollX: Animated.Value; width: number; palette: WelcomePalette; onPress: (i: number) => void;
}) {
    return (
        <View style={styles.dots}>
            {SLIDES.map((s, i) => {
                const range = [(i - 1) * width, i * width, (i + 1) * width];
                const dotWidth = scrollX.interpolate({ inputRange: range, outputRange: [7, 22, 7], extrapolate: 'clamp' });
                const dotColor = scrollX.interpolate({
                    inputRange: range,
                    outputRange: [palette.dot, palette.accent, palette.dot],
                    extrapolate: 'clamp',
                });
                return (
                    <TouchableOpacity key={s} onPress={() => onPress(i)} hitSlop={8} accessibilityLabel={`Go to slide ${i + 1}`}>
                        <Animated.View style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]} />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const NEXT_SIZE = 60;
const RING_R = NEXT_SIZE / 2 - 2;
const RING_LEN = 2 * Math.PI * RING_R;

/** Round Next button; the ring around it fills up as the user moves through the slides. */
function NextButton({ progress, onPress, palette }: { progress: number; onPress: () => void; palette: WelcomePalette }) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Next slide">
            <View style={styles.nextWrap}>
                <Svg width={NEXT_SIZE} height={NEXT_SIZE} style={StyleSheet.absoluteFill}>
                    <Circle cx={NEXT_SIZE / 2} cy={NEXT_SIZE / 2} r={RING_R} stroke={palette.cardBorder} strokeWidth={2.5} fill="none" />
                    <Circle
                        cx={NEXT_SIZE / 2}
                        cy={NEXT_SIZE / 2}
                        r={RING_R}
                        stroke={palette.accent}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${RING_LEN * progress} ${RING_LEN}`}
                        // start at 12 o'clock
                        transform={`rotate(-90 ${NEXT_SIZE / 2} ${NEXT_SIZE / 2})`}
                    />
                </Svg>
                <View style={[styles.nextInner, { backgroundColor: palette.accent, shadowColor: palette.accent }]}>
                    <Ionicons name="arrow-forward" size={22} color={palette.onAccent} />
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        minHeight: 48,
        zIndex: 2,
    },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
    badgeText: { fontSize: 13, fontWeight: '600' },
    list: { flex: 1 },
    slide: { flex: 1 },
    slideBody: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
    centered: { alignItems: 'center' },
    hero: { alignItems: 'center', marginBottom: 28 },
    title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 26 },
    titleGap: { marginTop: 24 },
    subtitle: { fontSize: 15, marginTop: 6, textAlign: 'center' },
    tickerRow: { flexDirection: 'row', gap: 10 },
    chipRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
    body: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },
    // Same height for both bottom layouts (highlights + nav row, or dots + two buttons)
    bottom: { paddingHorizontal: 20, height: 168, justifyContent: 'flex-end', gap: 12 },
    highlights: { flexDirection: 'row', gap: 8 },
    highlight: {
        flex: 1,
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: 10,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 1,
    },
    highlightIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    highlightText: { fontSize: 12, fontWeight: '600' },
    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    skipButton: { width: NEXT_SIZE, paddingVertical: 8 },
    skip: { fontSize: 15, fontWeight: '500' },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 6 },
    dot: { height: 7, borderRadius: 4 },
    nextWrap: { width: NEXT_SIZE, height: NEXT_SIZE, alignItems: 'center', justifyContent: 'center' },
    nextInner: {
        width: NEXT_SIZE - 14,
        height: NEXT_SIZE - 14,
        borderRadius: (NEXT_SIZE - 14) / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryButton: {
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    primaryText: { fontSize: 16, fontWeight: '600' },
    secondaryButton: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1 },
    secondaryText: { fontSize: 16, fontWeight: '500' },
});
