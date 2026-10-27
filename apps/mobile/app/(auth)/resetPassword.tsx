import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ScrollView,
} from 'react-native';
import React, { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { THEME_COLORS } from '../../constants/colors';
import createStyles from '../../assets/styles/resetPassword.styles';
import { useAuthStore } from '../../store/authStore';

export default function ResetPassword() {
    const theme = useThemeStore((state) => state.theme);

    /**
     * ✅ Resolve colors ONCE
     * - If theme is "custom", you already have colors somewhere in your store
     * - For now, safely fall back to a real preset
     */
    const COLORS = useMemo(() => {
        return theme === 'custom'
            ? THEME_COLORS.retro
            : THEME_COLORS[theme];
    }, [theme]);

    const styles = useMemo(() => createStyles(COLORS), [COLORS]);

    const { email, source } = useLocalSearchParams<{ email: string; source?: string }>();
    const router = useRouter();
    const { resetPassword: resetPasswordApi, isLoading } = useAuthStore();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const validatePassword = (password: string): string[] => {
        const errors: string[] = [];

        if (password.length < 8) errors.push('At least 8 characters');
        if (!/[A-Za-z]/.test(password)) errors.push('One letter');
        if (!/\d/.test(password)) errors.push('One number');
        if (!/[@$!%*?&]/.test(password)) errors.push('One special character');

        return errors;
    };

    const handleResetPassword = async () => {
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('Please fill in both password fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        const passwordErrors = validatePassword(newPassword);
        if (passwordErrors.length) {
            setError(passwordErrors.join(', '));
            return;
        }

        if (!email) {
            setError('Email is required.');
            return;
        }

        const result = await resetPasswordApi(email, newPassword, confirmPassword);

        if (result.success) {
            setIsSuccess(true);
            Alert.alert('Success', result.message || 'Password reset successful.', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.replace(source === 'app' ? '/(tabs)' : '/(auth)');
                    },
                },
            ]);
        } else {
            setError(result.message || 'Failed to reset password.');
        }
    };

    if (isSuccess) return null;

    return (
        <View style={styles.root}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.card}>
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => router.back()}
                            >
                                <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                            </TouchableOpacity>

                            <Text style={styles.title}>Reset Password</Text>
                            <Text style={styles.subtitle}>Create a new password</Text>
                        </View>

                        {email && (
                            <View style={styles.infoBox}>
                                <Text style={styles.infoLabel}>Email</Text>
                                <Text style={styles.infoText}>{email}</Text>
                            </View>
                        )}

                        {(['New Password', 'Confirm Password'] as const).map((label, index) => {
                            const isConfirm = index === 1;
                            const value = isConfirm ? confirmPassword : newPassword;
                            const setValue = isConfirm ? setConfirmPassword : setNewPassword;
                            const visible = isConfirm ? showConfirmPassword : showNewPassword;
                            const setVisible = isConfirm ? setShowConfirmPassword : setShowNewPassword;

                            return (
                                <View key={label} style={styles.inputGroup}>
                                    <Text style={styles.label}>{label}</Text>
                                    <View style={styles.inputContainer}>
                                        <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
                                        <TextInput
                                            style={styles.input}
                                            secureTextEntry={!visible}
                                            value={value}
                                            onChangeText={setValue}
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity onPress={() => setVisible(!visible)}>
                                            <Ionicons
                                                name={visible ? 'eye-outline' : 'eye-off-outline'}
                                                size={20}
                                                color={COLORS.primary}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}

                        {!!error && <Text style={styles.error}>{error}</Text>}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleResetPassword}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.buttonText}>Reset Password</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
