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
import { Link, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import createStyles from '../../assets/styles/login.styles';
import { useAuthStore } from '../../store/authStore';
import { validateEmailFrontend } from '../../utils/validation';
import ThemeSelector from '../../components/themeSelector';
import api from '../../apis/authApi';
import RobotIllustration from '../../components/robotFace';

export default function Login() {
    const { colors } = useThemeStore();
    const styles = createStyles(colors);
    const [usernameOrEmail, setUsernameOrEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const {
        login,
        isLoading,
        requiresOtp,
        requiresEmailVerification,
        requiresDeviceVerification,
        emailVerificationSuccess,
        clearEmailVerificationSuccess,
        setupTOTPLogin
    } = useAuthStore();
    const [error, setError] = useState<string>('');
    const [isResetLoading, setIsResetLoading] = useState<boolean>(false);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // ⚠️ COMMENT OUT DURING TESTING - This redirects to verification screens
    // useEffect(() => {
    //     if (requiresOtp) {
    //         router.push('/verifyDevice');
    //     } else if (requiresEmailVerification) {
    //         router.push('/(auth)/verifyEmail');
    //     } else if (requiresDeviceVerification) {
    //         router.push('/verifyDevice');
    //     }
    // }, [requiresOtp, requiresEmailVerification, requiresDeviceVerification, router]);

    useEffect(() => {
        if (emailVerificationSuccess) {
            Alert.alert('Success', emailVerificationSuccess, [
                {
                    text: 'OK',
                    onPress: () => {
                        clearEmailVerificationSuccess();
                    }
                }
            ]);
        }
    }, [emailVerificationSuccess]);

    const handleLogin = async () => {
        setError('');
        if (!usernameOrEmail.trim() || !password.trim()) {
            setError('Please enter username/email and password.');
            return;
        }

        const result = await login({ usernameOrEmail: usernameOrEmail.trim(), password });

        if (result.success) {
            router.replace('/(tabs)');
            return;
        }

        if (result.action === 'signup') {
            Alert.alert('Account Not Found', result.message, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Up', onPress: () => router.push('/(auth)/signup') }
            ]);
        } else if (result.requiresEmailVerification) {
            Alert.alert('Verification Required', 'A verification code has been sent to your email.', [
                { text: 'OK', onPress: () => router.push('/(auth)/verifyEmail') }
            ]);
        } else if (result.requiresDeviceVerification) {
            Alert.alert('New Device', 'A verification code has been sent to your email to confirm this device.', [
                { text: 'OK', onPress: () => router.push('/(auth)/verifyDevice') }
            ]);
        } else if (result.requiresTOTPSetup) {
            try {
                const setupResult = await setupTOTPLogin(usernameOrEmail.trim());
                if (setupResult.success && setupResult.secret) {
                    router.push({
                        pathname: '/TOTPSetup',
                        params: {
                            secret: setupResult.secret,
                            usernameOrEmail: usernameOrEmail.trim(),
                            source: 'login',
                            password: password,
                            fingerprint: result.fingerprint
                        }
                    });
                } else {
                    Alert.alert('Setup Error', setupResult.message || 'Failed to setup TOTP. Please try again.');
                }
            } catch (error) {
                console.error('TOTP setup error:', error);
                Alert.alert('Error', 'Failed to setup TOTP. Please try again.');
            }
        } else if (result.requiresTOTPCode) {
            router.push({
                pathname: '/TOTPVerification',
                params: {
                    usernameOrEmail: usernameOrEmail.trim(),
                    source: 'login',
                    password: password,
                    fingerprint: result.fingerprint
                }
            });
        } else {
            setError(result.message);
        }
    };

    const handleForgotPassword = async () => {
        if (!usernameOrEmail.trim()) {
            Alert.alert('Error', 'Please enter your email address first.', [{ text: 'OK' }]);
            return;
        }
        const emailValidation = validateEmailFrontend(usernameOrEmail);
        if (!emailValidation.isValid) {
            Alert.alert('Error', emailValidation.errors.join(' '));
            return;
        }
        setIsResetLoading(true);
        try {
            const response = await api.post('/api/auth/request-password-reset', { email: usernameOrEmail.trim() });
            Alert.alert('Success', response.data.message || 'Password reset code sent. Please check your email.', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.push({
                            pathname: '/resetPasswordCode',
                            params: {
                                email: usernameOrEmail.trim(),
                                source: 'forgot'
                            },
                        });
                    },
                },
            ]);
        } catch (error: any) {
            console.error('Request password reset error:', error);
            const message =
                error.response?.status === 429
                    ? 'Too many reset requests. Please try again later.'
                    : error.response?.data?.message || 'Failed to send reset code.';
            Alert.alert('Error', message);
        } finally {
            setIsResetLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    {/* Theme Selector - Fixed position */}
                    <View style={{ position: 'absolute', top: -10, left: -10, zIndex: 1000 }}>
                        <ThemeSelector />
                    </View>

                    {/* Replace Image with SVG Component */}
                    <View style={styles.topIllustration}>
                        <RobotIllustration
                            width={300}
                            height={300}
                        />
                    </View>

                    <View style={styles.card}>
                        <View style={styles.formContainer}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email or Username</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons
                                        name="mail-outline"
                                        size={20}
                                        color={colors.primary}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your email or username"
                                        placeholderTextColor={colors.placeholderText}
                                        keyboardType="default"
                                        value={usernameOrEmail}
                                        onChangeText={setUsernameOrEmail}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <View style={styles.inputContainer}>
                                    <Ionicons
                                        name="lock-closed-outline"
                                        size={20}
                                        color={colors.primary}
                                        style={styles.inputIcon}
                                    />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter your password"
                                        placeholderTextColor={colors.placeholderText}
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        autoCapitalize="none"
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={styles.eyeIconContainer}
                                    >
                                        <Ionicons
                                            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                            size={20}
                                            color={colors.primary}
                                            style={styles.eyeIcon}
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {error ? (
                                <Text style={{
                                    color: colors.warning || '#ff3333',
                                    fontSize: 14,
                                    marginBottom: 16,
                                    textAlign: 'center'
                                }}>
                                    {error}
                                </Text>
                            ) : null}

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleLogin}
                                disabled={isLoading || isResetLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <Text style={styles.buttonText}>Login</Text>
                                )}
                            </TouchableOpacity>

                            <View style={{ alignItems: 'center', marginTop: 16 }}>
                                <TouchableOpacity
                                    onPress={handleForgotPassword}
                                    disabled={isResetLoading}
                                >
                                    <Text
                                        style={{
                                            color: colors.primary,
                                            fontSize: 14,
                                            fontWeight: '500',
                                            textDecorationLine: 'underline',
                                        }}
                                    >
                                        Forgot Password?
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.footer}>
                                <Text style={styles.footerText}>
                                    Don't have an account?
                                </Text>
                                <Link href="/signup" asChild>
                                    <TouchableOpacity>
                                        <Text style={styles.link}>Sign Up</Text>
                                    </TouchableOpacity>
                                </Link>
                            </View>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}