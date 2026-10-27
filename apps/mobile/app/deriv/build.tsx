// Deriv bot builder. For now this screen shows what the builder will ask for; the working builder
// comes once the server can run bots (every bot trade must pass server/src/risk first).
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import BackHeader from '../../components/BackHeader';

const FIELDS = [
    { icon: 'analytics-outline', label: 'Market', value: 'Volatility 75 / 100 Index' },
    { icon: 'git-branch-outline', label: 'Strategy', value: 'Rise/Fall, Even/Odd, Over/Under, Matches/Differs' },
    { icon: 'cash-outline', label: 'Stake per trade', value: 'You choose, e.g. $1.00' },
    { icon: 'trending-down-outline', label: 'Daily loss limit', value: 'Bot stops when it is reached' },
    { icon: 'repeat-outline', label: 'Max trades per day', value: 'A hard cap the bot cannot pass' },
] as const;

export default function DerivBotBuilder() {
    const { colors } = useThemeStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <BackHeader title="Build a bot" subtitle="Deriv" />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}>
                <View style={[styles.hero, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
                        <Ionicons name="construct" size={30} color={colors.white} />
                    </View>
                    <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>The bot builder is coming next</Text>
                    <Text style={[styles.heroBody, { color: colors.textSecondary }]}>
                        Here is what you'll set for each bot. Meanwhile, try the strategies by hand to see how they behave.
                    </Text>
                </View>

                {FIELDS.map((f) => (
                    <View key={f.label} style={[styles.field, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Ionicons name={f.icon} size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{f.label}</Text>
                            <Text style={[styles.fieldValue, { color: colors.textSecondary }]}>{f.value}</Text>
                        </View>
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => router.replace({ pathname: '/deriv', params: { mode: 'manual' } })}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.buttonText, { color: colors.white }]}>Try a strategy manually</Text>
                    <Ionicons name="arrow-forward" size={18} color={colors.white} />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingHorizontal: 16 },
    hero: { borderWidth: 1, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 14 },
    heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    heroTitle: { fontSize: 18, fontFamily: FONTS.semibold, textAlign: 'center' },
    heroBody: { fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center', marginTop: 6, lineHeight: 20 },
    field: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8 },
    fieldLabel: { fontSize: 15, fontFamily: FONTS.semibold },
    fieldValue: { fontSize: 13, fontFamily: FONTS.regular },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 10 },
    buttonText: { fontSize: 16, fontFamily: FONTS.semibold },
});
