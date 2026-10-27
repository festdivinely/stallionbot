// Header for screens opened on top of the tabs: back button, title, optional right-hand item.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../store/themeStore';
import { FONTS } from '../constants/fonts';

export default function BackHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
    const { colors } = useThemeStore();
    const router = useRouter();
    return (
        <View style={styles.header}>
            <TouchableOpacity
                style={[styles.back, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
                accessibilityRole="button"
                accessibilityLabel="Go back"
            >
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.titles}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                {!!subtitle && (
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
                )}
            </View>
            <View style={styles.right}>{right}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 12 },
    back: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    titles: { flex: 1 },
    title: { fontSize: 20, fontFamily: FONTS.bold },
    subtitle: { fontSize: 13, fontFamily: FONTS.regular, marginTop: -2 },
    right: { minWidth: 42, alignItems: 'flex-end' },
});
