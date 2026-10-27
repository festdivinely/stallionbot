// Themed replacement for the plain system alert box.
// installThemedAlert() reroutes every Alert.alert(...) in the app to <ThemedAlertHost />, so all
// existing calls get the app's look (theme colours, Poppins, icons) without changing any screen.
// Buttons keep their text, style ('cancel' / 'destructive') and onPress, exactly like Alert.alert.
import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, type AlertButton } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { create } from 'zustand';
import { useThemeStore } from '../store/themeStore';
import { FONTS } from '../constants/fonts';

interface AlertItem {
    id: number;
    title: string;
    message?: string;
    buttons: AlertButton[];
    cancelable: boolean;
    onDismiss?: () => void;
}

interface AlertQueue {
    queue: AlertItem[];
    push: (item: Omit<AlertItem, 'id'>) => void;
    shift: () => void;
}

let nextId = 1;
const useAlertQueue = create<AlertQueue>((set) => ({
    queue: [],
    // Alerts that arrive while one is open wait their turn instead of replacing it
    push: (item) => set((s) => ({ queue: [...s.queue, { ...item, id: nextId++ }] })),
    shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

let hostMounted = false;
let installed = false;

/** Call once at startup: from then on Alert.alert shows the themed dialog. */
export function installThemedAlert() {
    if (installed) return;
    installed = true;
    const nativeAlert = Alert.alert.bind(Alert);
    Alert.alert = (title, message, buttons, options) => {
        // Before the host is on screen (very early in startup), fall back to the system alert
        if (!hostMounted) return nativeAlert(title, message, buttons, options);
        useAlertQueue.getState().push({
            title: title ?? '',
            message: message ?? undefined,
            buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
            cancelable: options?.cancelable ?? false,
            onDismiss: options?.onDismiss,
        });
    };
}

type Tone = 'success' | 'error' | 'warning' | 'info';

// Semantic colours stay the same in every theme (green = good, red = problem, amber = needs attention);
// "info" uses the theme's own primary colour.
const TONE_COLORS: Record<Exclude<Tone, 'info'>, string> = {
    success: '#16A34A',
    error: '#DC2626',
    warning: '#D97706',
};

/** Picks the alert's look from its wording (the existing calls don't say what kind they are). */
function toneOf(title: string, message = ''): { tone: Tone; icon: keyof typeof Ionicons.glyphMap } {
    const t = `${title} ${message}`.toLowerCase();
    if (/(error|fail|invalid|incorrect|wrong|expired|denied|unable|could not|couldn't)/.test(title.toLowerCase()) ||
        /(failed|invalid|incorrect|expired)/.test(t)) {
        return { tone: 'error', icon: 'close-circle' };
    }
    if (/(success|successful|verified|welcome|complete|enabled|disabled|reset)/.test(title.toLowerCase()) ||
        /(successful|successfully|verified)/.test(t)) {
        return { tone: 'success', icon: 'checkmark-circle' };
    }
    if (/(code|email|sent|inbox)/.test(t)) return { tone: 'info', icon: 'mail-unread' };
    if (/(required|not found|exists|new device|warning|confirm|are you sure)/.test(t)) {
        return { tone: 'warning', icon: 'alert-circle' };
    }
    return { tone: 'info', icon: 'information-circle' };
}

const withAlpha = (hex: string, alpha: number) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return `#${h.slice(0, 6)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
};

/** Render once near the root of the app (app/_layout.tsx). */
export function ThemedAlertHost() {
    const colors = useThemeStore((s) => s.colors);
    const current = useAlertQueue((s) => s.queue[0]);
    const shift = useAlertQueue((s) => s.shift);
    const pop = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        hostMounted = true;
        return () => { hostMounted = false; };
    }, []);

    // Spring in each time a new alert appears
    useEffect(() => {
        if (!current) return;
        pop.setValue(0);
        Animated.spring(pop, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
    }, [current?.id]);

    if (!current) return null;

    const { tone, icon } = toneOf(current.title, current.message);
    const toneColor = tone === 'info' ? colors.primary : TONE_COLORS[tone];

    // Close first, then run the button's action (it may navigate or show another alert)
    const press = (button?: AlertButton) => {
        shift();
        if (button?.onPress) setTimeout(() => button.onPress?.(button.text), 0);
    };
    const cancelButton = current.buttons.find((b) => b.style === 'cancel');
    const dismiss = () => {
        if (cancelButton) return press(cancelButton);
        if (current.cancelable) {
            shift();
            current.onDismiss?.();
        }
    };

    // The last non-cancel button is the main action (system alerts put it last too)
    const mainIndex = (() => {
        for (let i = current.buttons.length - 1; i >= 0; i--) if (current.buttons[i].style !== 'cancel') return i;
        return current.buttons.length - 1;
    })();
    const stacked = current.buttons.length > 2;

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
            <View style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.border,
                            opacity: pop,
                            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
                        },
                    ]}
                >
                    {/* Icon with a soft halo in the tone colour */}
                    <View style={[styles.halo, { backgroundColor: withAlpha(toneColor, 0.1) }]}>
                        <View style={[styles.iconCircle, { backgroundColor: withAlpha(toneColor, 0.18) }]}>
                            <Ionicons name={icon} size={34} color={toneColor} />
                        </View>
                    </View>

                    {!!current.title && <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>}
                    {!!current.message && <Text style={[styles.message, { color: colors.textSecondary }]}>{current.message}</Text>}

                    <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
                        {current.buttons.map((b, i) => {
                            const isMain = i === mainIndex;
                            const destructive = b.style === 'destructive';
                            const filled = isMain || destructive;
                            const fill = destructive ? TONE_COLORS.error : colors.primary;
                            return (
                                <TouchableOpacity
                                    key={`${b.text}-${i}`}
                                    onPress={() => press(b)}
                                    activeOpacity={0.85}
                                    style={[
                                        styles.button,
                                        !stacked && { flex: 1 },
                                        filled
                                            ? { backgroundColor: fill, shadowColor: fill, ...styles.buttonShadow }
                                            : { backgroundColor: colors.cardBackground, borderColor: colors.border, borderWidth: 1 },
                                    ]}
                                >
                                    <Text
                                        style={[styles.buttonText, { color: filled ? colors.white : colors.textPrimary }]}
                                        numberOfLines={1}
                                    >
                                        {b.text ?? 'OK'}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    card: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 26,
        borderWidth: 1,
        paddingHorizontal: 22,
        paddingTop: 26,
        paddingBottom: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
    },
    halo: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    iconCircle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: FONTS.semibold, fontSize: 19, textAlign: 'center' },
    message: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
    buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 22 },
    buttonsStacked: { flexDirection: 'column-reverse' },
    button: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 12, alignItems: 'center' },
    buttonShadow: { shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 9, elevation: 4 },
    buttonText: { fontFamily: FONTS.semibold, fontSize: 15 },
});
