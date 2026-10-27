// "Use code 123456 from your clipboard?" banner for code screens. Phones don't let apps read your
// email, but when you copy the code (e.g. from the Gmail notification) and come back to the app,
// this offers it: one tap fills the box and submits.
// Checks when the screen opens and every time the app comes back to the foreground.
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';
import { FONTS } from '../constants/fonts';

interface Props {
    /** Digits in a valid code. */
    length?: number;
    /** Fill the box and submit with this code. */
    onUse: (code: string) => void;
}

export default function ClipboardCodeBanner({ length = 6, onUse }: Props) {
    const { colors } = useThemeStore();
    const [code, setCode] = useState<string | null>(null);
    // Codes already used or dismissed, so the same one isn't offered again
    const handled = useRef(new Set<string>());

    useEffect(() => {
        // A run of exactly `length` digits, not part of a longer number
        const pattern = new RegExp(`(?:^|\\D)(\\d{${length}})(?!\\d)`);
        const check = async () => {
            try {
                // hasStringAsync doesn't read the text, so no "pasted from clipboard" notice for nothing
                if (!(await Clipboard.hasStringAsync())) return;
                const found = (await Clipboard.getStringAsync()).match(pattern)?.[1];
                if (found && !handled.current.has(found)) setCode(found);
            } catch {
                // Clipboard not available: the user can still type the code
            }
        };
        check();
        const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
        return () => sub.remove();
    }, [length]);

    if (!code) return null;

    const dismiss = () => {
        handled.current.add(code);
        setCode(null);
    };

    return (
        <View style={[styles.banner, { backgroundColor: colors.inputBackground, borderColor: colors.primary }]}>
            <Ionicons name="clipboard-outline" size={20} color={colors.primary} />
            <Text style={[styles.text, { color: colors.textPrimary }]}>
                Use code <Text style={{ fontFamily: FONTS.bold }}>{code}</Text> from your clipboard?
            </Text>
            <TouchableOpacity
                onPress={() => {
                    dismiss();
                    onUse(code);
                }}
                style={[styles.use, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel={`Use code ${code}`}
            >
                <Text style={[styles.useText, { color: colors.white }]}>Use</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismiss} hitSlop={10} accessibilityLabel="Dismiss">
                <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
    text: { flex: 1, fontSize: 14, fontFamily: FONTS.regular },
    use: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
    useText: { fontSize: 14, fontFamily: FONTS.semibold },
});
