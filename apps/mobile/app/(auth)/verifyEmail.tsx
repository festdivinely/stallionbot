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
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import createStyles from '../../assets/styles/verifyEmail.styles';
import { useAuthStore } from '../../store/authStore';

export default function VerifyEmail() {
    // Get colors and theme from store
    const { colors, theme } = useThemeStore();

    // Use safe theme for styles (convert 'custom' to 'retro')
    const themeForStyles = theme === 'custom' ? 'retro' : theme;
    const styles = createStyles(themeForStyles);

    const [code, setCode] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [isVerificationSuccess, setIsVerificationSuccess] = useState(false);
    const [hasCheckedPending, setHasCheckedPending] = useState(false);
    const { verifyEmail, resendVerifyEmail, isLoading, pendingUsernameOrEmail, setEmailVerificationSuccess } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!hasCheckedPending) {
            if (!pendingUsernameOrEmail) {
                Alert.alert('Error', 'No pending email verification session found. Please try registering again.', [
                    {
                        text: 'OK',
                        onPress: () => {
                            router.replace('/(auth)/signup');
                        }
                    },
                ]);
            }
            setHasCheckedPending(true);
        }
    }, [pendingUsernameOrEmail, hasCheckedPending]);

    const handlePaste = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            if (text) {
                setCode(text.trim());
                setError('');
            } else {
                setError('Clipboard is empty.');
            }
        } catch (err) {
            setError('Failed to paste from clipboard.');
        }
    };

    const handleVerify = async () => {
        if (!code.trim()) {
            setError('Please enter or paste the verification code.');
            return;
        }

        if (!/^\d{6}$/.test(code)) {
            setError('Please enter a valid 6-digit verification code.');
            return;
        }

        setError('');
        const result = await verifyEmail(code);

        if (result.success) {
            setCode('');
            setIsVerificationSuccess(true);

            useAuthStore.getState().pendingUsernameOrEmail = null;
            useAuthStore.getState().requiresEmailVerification = false;

            setEmailVerificationSuccess('Email verified successfully! You can now log in.');

            router.push('/(auth)');
        } else {
            setError(result.message);
        }
    };

    const handleResendEmail = async () => {
        if (!pendingUsernameOrEmail) {
            setError('No pending verification session found.');
            Alert.alert('Error', 'No pending verification session found. Please try registering again.', [
                {
                    text: 'OK',
                    onPress: () => router.replace('/(auth)/signup')
                },
            ]);
            return;
        }

        setError('');
        const result = await resendVerifyEmail(pendingUsernameOrEmail);
        if (result.success) {
            Alert.alert('Success', result.message);
        } else {
            setError(result.message);
        }
    };

    if (!pendingUsernameOrEmail && !hasCheckedPending) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textPrimary, marginTop: 16 }}>Checking verification status...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Verify Email</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Enter the 6-digit verification code from your email
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Verification Code</Text>
                            <View style={[
                                styles.inputContainer,
                                {
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: colors.inputBackground,
                                    borderColor: error ? '#ff3333' : colors.border,
                                }
                            ]}>
                                <Ionicons
                                    name="key-outline"
                                    size={20}
                                    color={colors.primary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={[styles.input, { color: colors.textDark, flex: 1 }]}
                                    placeholder="Enter 6-digit code"
                                    placeholderTextColor={colors.placeholderText}
                                    value={code}
                                    onChangeText={(value) => {
                                        setCode(value.replace(/[^0-9]/g, ''));
                                        setError('');
                                    }}
                                    autoCapitalize="none"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                                <TouchableOpacity onPress={handlePaste} style={styles.eyeIconContainer}>
                                    <Ionicons
                                        name="clipboard-outline"
                                        size={20}
                                        color={colors.primary}
                                        style={styles.eyeIcon}
                                    />
                                </TouchableOpacity>
                            </View>
                            {error ? (
                                <Text style={{ color: '#ff3333', fontSize: 12, marginTop: 4 }}>{error}</Text>
                            ) : null}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={handleVerify}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={[styles.buttonText, { color: colors.white }]}>Verify Email</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footer}>
                            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                                Didn't receive the code?
                            </Text>
                            <TouchableOpacity
                                onPress={handleResendEmail}
                                disabled={isLoading}
                            >
                                <Text style={[styles.link, { color: colors.primary }]}>Resend Code</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}