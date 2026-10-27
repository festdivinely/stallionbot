import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import React, { useState, useMemo, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME_COLORS } from '../../constants/colors';
import createStyles from '../../assets/styles/verifyDevice.styles';
import { useAuthStore } from '../../store/authStore';
import KeyboardSafeScroll from '../../components/KeyboardSafeScroll';

export default function VerifyDevice() {
    const theme = useThemeStore((state) => state.theme);
    const COLORS = useMemo(() => {
        return theme === 'custom' ? THEME_COLORS.retro : THEME_COLORS[theme];
    }, [theme]);

    const styles = useMemo(() => createStyles(COLORS, theme), [COLORS, theme]);

    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const { verifyDevice, resendVerifyDevice, isLoading, pendingUsernameOrEmail } =
        useAuthStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Only when the screen opens: catches arriving here without a login in progress.
    // (It used to re-run whenever pendingUsernameOrEmail changed, and a successful verification
    // clears that value, so this error popped up right after every successful verification.)
    useEffect(() => {
        if (!pendingUsernameOrEmail) {
            Alert.alert(
                'Error',
                'No pending device verification session found. Please try logging in again.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)') }]
            );
        }
    }, []);

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (text) {
                setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
                setError('');
            } else {
                setError('Clipboard is empty.');
            }
        } catch {
            setError('Failed to paste from clipboard.');
        }
    };

    const handleVerify = async () => {
        if (!/^\d{6}$/.test(code)) {
            setError('Please enter a valid 6-digit verification code.');
            return;
        }

        setError('');
        const result = await verifyDevice(code, pendingUsernameOrEmail || '');
        if (result.success) {
            Alert.alert('Success', result.message || 'Device verified!', [
                { text: 'Continue', onPress: () => router.replace('/(tabs)') },
            ]);
        } else {
            setError(result.message);
        }
    };

    const handleResendCode = async () => {
        if (!pendingUsernameOrEmail) {
            setError('No pending verification session.');
            Alert.alert(
                'Error',
                'No pending verification session. Please try logging in again.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)') }]
            );
            return;
        }

        setError('');
        const result = await resendVerifyDevice(pendingUsernameOrEmail);
        if (result.success) {
            Alert.alert('Success', result.message || 'Code resent.');
        } else {
            setError(result.message);
        }
    };

    return (
        <KeyboardSafeScroll style={{ backgroundColor: COLORS.background }}>
            <View
                style={[
                    styles.container,
                    { backgroundColor: COLORS.background, paddingTop: insets.top },
                ]}
            >
                <View style={[styles.card, { backgroundColor: COLORS.cardBackground }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: COLORS.primary }]}>
                            Quantum Robots
                        </Text>
                        <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
                            Device Verification
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: COLORS.textPrimary }]}>
                                Verification Code
                            </Text>
                            <View
                                style={[
                                    styles.inputContainer,
                                    { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border },
                                ]}
                            >
                                <Ionicons
                                    name="key-outline"
                                    size={20}
                                    color={COLORS.primary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={[styles.input, { color: COLORS.textDark }]}
                                    placeholder="Enter 6-digit code"
                                    placeholderTextColor={COLORS.textSecondary}
                                    value={code}
                                    onChangeText={(v) => {
                                        setCode(v.replace(/[^0-9]/g, '').slice(0, 6));
                                        setError('');
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                                <TouchableOpacity onPress={handlePaste} style={styles.eyeIconContainer}>
                                    <Ionicons
                                        name="clipboard-outline"
                                        size={20}
                                        color={COLORS.primary}
                                        style={styles.eyeIcon}
                                    />
                                </TouchableOpacity>
                            </View>
                            {!!error && <Text style={styles.error}>{error}</Text>}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: COLORS.primary }]}
                            onPress={handleVerify}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={[styles.buttonText, { color: COLORS.white }]}>
                                    Verify Device
                                </Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={[styles.footerText, { color: COLORS.textSecondary }]}>
                                Didn't receive the code?
                            </Text>
                            <TouchableOpacity onPress={handleResendCode} disabled={isLoading}>
                                <Text style={[styles.link, { color: COLORS.primary }]}>
                                    Resend Code
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.securityNote}>
                            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textSecondary} />
                            <Text style={[styles.securityText, { color: COLORS.textSecondary }]}>
                                This helps keep your account secure by verifying new devices.
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </KeyboardSafeScroll>
    );
}
