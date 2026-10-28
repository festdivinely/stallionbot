// Demo / Real account switch with each account's balance. Everything that trades (the Options
// screen) follows the account picked here (store/accountStore.ts). Real is shown in red so it
// can't be mistaken for demo, and switching to it asks for confirmation.
//  - full:    two halves, Demo | Real, for the Deriv screen
//  - compact: one tappable pill (current account + balance), for screen headers
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useAccountStore, type AccountMode } from '../../store/accountStore';
import { useAccounts, type AccountsSummary } from '../../hooks/useDerivMarket';
import { FONTS } from '../../constants/fonts';
import { PRICE_DOWN, withAlpha } from '../welcome/welcomePalette';

export const REAL_COLOR = PRICE_DOWN;

const formatBalance = (b: { balance: number; currency: string } | null | undefined) =>
    b ? `${b.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${b.currency}` : '—';

/** Switches account, confirming before real money and explaining when there is no real account. */
export function chooseAccount(next: AccountMode, accounts: AccountsSummary | null, setMode: (m: AccountMode) => void) {
    if (next === 'demo') {
        setMode('demo');
        return;
    }
    if (accounts && !accounts.real.available) {
        Alert.alert(
            'No real account yet',
            'Your Deriv connection only has a demo account. Open a real (options) account on Deriv, and it will show up here automatically.'
        );
        return;
    }
    Alert.alert('Switch to your REAL account?', 'Trades placed in Real mode use real money. You can switch back to Demo any time.', [
        { text: 'Stay on Demo', style: 'cancel' },
        { text: 'Switch to Real', style: 'destructive', onPress: () => setMode('real') },
    ]);
}

export default function AccountSwitch({ compact = false }: { compact?: boolean }) {
    const { colors } = useThemeStore();
    const { mode, setMode } = useAccountStore();
    const accounts = useAccounts(useIsFocused());

    if (compact) {
        const isReal = mode === 'real';
        const tone = isReal ? REAL_COLOR : colors.primary;
        return (
            <TouchableOpacity
                onPress={() => chooseAccount(isReal ? 'demo' : 'real', accounts, setMode)}
                style={[styles.pill, { borderColor: tone, backgroundColor: withAlpha(tone, 0.12) }]}
                accessibilityRole="button"
                accessibilityLabel={`${isReal ? 'Real' : 'Demo'} account. Tap to switch to ${isReal ? 'demo' : 'real'}.`}
            >
                <Text style={[styles.pillMode, { color: tone }]}>{isReal ? 'REAL' : 'DEMO'}</Text>
                <Text style={[styles.pillBalance, { color: colors.textPrimary }]}>{formatBalance(accounts?.[mode].balance)}</Text>
            </TouchableOpacity>
        );
    }

    return (
        <View style={[styles.row, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            {(['demo', 'real'] as const).map((m) => {
                const active = mode === m;
                const tone = m === 'real' ? REAL_COLOR : colors.primary;
                const info = accounts?.[m];
                return (
                    <TouchableOpacity
                        key={m}
                        onPress={() => !active && chooseAccount(m, accounts, setMode)}
                        style={[styles.half, active && { backgroundColor: tone }]}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${m === 'real' ? 'Real' : 'Demo'} account, balance ${formatBalance(info?.balance)}`}
                    >
                        <Text style={[styles.mode, { color: active ? colors.white : tone }]}>{m === 'real' ? 'Real' : 'Demo'}</Text>
                        <Text style={[styles.balance, { color: active ? colors.white : colors.textPrimary }]} numberOfLines={1}>
                            {info && !info.available ? 'Not connected' : formatBalance(info?.balance)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 14 },
    half: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center' },
    mode: { fontSize: 13, fontFamily: FONTS.bold, letterSpacing: 0.5 },
    balance: { fontSize: 15, fontFamily: FONTS.semibold, marginTop: 1 },
    pill: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'flex-end' },
    pillMode: { fontSize: 11, fontFamily: FONTS.bold, letterSpacing: 0.6 },
    pillBalance: { fontSize: 13, fontFamily: FONTS.semibold },
});
