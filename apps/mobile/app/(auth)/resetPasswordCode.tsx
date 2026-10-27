import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { THEME_COLORS } from '../../constants/colors';
import createStyles from '../../assets/styles/passwordResetCode.styles';
import api from '../../apis/authApi';

export default function ResetPasswordCode() {
    const theme = useThemeStore((state) => state.theme);

    /**
     * ✅ Resolve colors ONCE
     * Styles never care about theme names — only colors
     */
    const COLORS = useMemo(() => {
        return theme === 'custom'
            ? THEME_COLORS.retro
            : THEME_COLORS[theme];
    }, [theme]);

    const styles = useMemo(() => createStyles(COLORS), [COLORS]);

    const { email, source } = useLocalSearchParams<{ email: string; source?: string }>();
    const router = useRouter();

    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (!text) {
                setError('Clipboard is empty.');
                return;
            }

            setCode(text.replace(/[^0-9]/g, '').slice(0, 6));
            setError('');
        } catch {
            setError('Failed to paste from clipboard.');
        }
    };

    const handleVerifyCode = async () => {
        if (!/^\d{6}$/.test(code)) {
            setError('Please enter a valid 6-digit verification code.');
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            const payload: Record<string, string> = { code };
            if (email) payload.email = email;

            const response = await api.post('/api/auth/verify-reset-code', payload);

            if (response.data?.success) {
                router.push({
                    pathname: '/resetPassword',
                    params: {
                        email: response.data.email || email,
                        source: source || 'forgot',
                    },
                });
            }
        } catch (err: any) {
            const message =
                err.response?.status === 429
                    ? 'Too many attempts. Try again later.'
                    : err.response?.data?.message ||
                    'Invalid or expired verification code.';
            setError(message);
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendResetEmail = async () => {
        setIsVerifying(true);
        setError('');

        try {
            const payload: Record<string, string> = {};
            if (email) payload.email = email;

            const response = await api.post('/api/auth/request-password-reset', payload);

            if (response.data?.success) {
                Alert.alert(
                    'Success',
                    response.data.message || 'Verification code sent.'
                );
            }
        } catch (err: any) {
            const message =
                err.response?.status === 429
                    ? 'Too many requests. Try again later.'
                    : err.response?.data?.message ||
                    'Failed to resend verification code.';
            setError(message);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.root}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.card}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.replace('/(auth)')}
                    >
                        <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Reset Password</Text>
                    <Text style={styles.subtitle}>
                        Step 1: Enter Verification Code
                    </Text>
                </View>

                {email && (
                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoText}>{email}</Text>
                    </View>
                )}

                {!email && source === 'app' && (
                    <View style={[styles.infoBox, styles.securityBox]}>
                        <Text style={styles.securityTitle}>Security Update</Text>
                        <Text style={styles.infoText}>
                            Code sent to your registered email
                        </Text>
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification Code</Text>
                    <View
                        style={[
                            styles.inputContainer,
                            error && styles.inputError,
                        ]}
                    >
                        <Ionicons
                            name="key-outline"
                            size={20}
                            color={COLORS.primary}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="6-digit code"
                            placeholderTextColor={COLORS.placeholderText}
                            value={code}
                            onChangeText={(v) => {
                                setCode(v.replace(/[^0-9]/g, '').slice(0, 6));
                                setError('');
                            }}
                            keyboardType="number-pad"
                            maxLength={6}
                        />
                        <TouchableOpacity onPress={handlePaste}>
                            <Ionicons
                                name="clipboard-outline"
                                size={20}
                                color={COLORS.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    {!!error && <Text style={styles.error}>{error}</Text>}
                </View>

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleVerifyCode}
                    disabled={isVerifying}
                >
                    {isVerifying ? (
                        <ActivityIndicator color={COLORS.white} />
                    ) : (
                        <Text style={styles.buttonText}>Verify Code</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Didn't receive the code?</Text>
                    <TouchableOpacity
                        onPress={handleResendResetEmail}
                        disabled={isVerifying}
                    >
                        <Text style={styles.link}>Resend Code</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
