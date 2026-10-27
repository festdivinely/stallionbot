import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
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
import api from '../../apis/authApi';
import { BackgroundDecor, HeroRobot } from '../../components/welcome/WelcomeArt';
import { getWelcomePalette } from '../../components/welcome/welcomePalette';
import KeyboardSafeScroll from '../../components/KeyboardSafeScroll';
import { FONTS } from '../../constants/fonts';
import {
    canUseBiometrics,
    declineQuickLogin,
    disableQuickLogin,
    enableQuickLogin,
    getQuickLoginAccount,
    getRememberedAccount,
    readQuickLogin,
    setRememberedAccount,
    shouldOfferQuickLogin,
} from '../../utils/quickLogin';

export default function Login() {
    const { colors } = useThemeStore();
    const styles = createStyles(colors);
    const palette = getWelcomePalette(colors);
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

    // Fingerprint login (utils/quickLogin.ts): the saved account name, when it is switched on
    const [quickAccount, setQuickAccount] = useState<string | null>(null);
    // Remember me: pre-fill the email/username saved at the last login (never the password)
    const [rememberMe, setRememberMe] = useState(true);
    useEffect(() => {
        (async () => {
            const account = await getQuickLoginAccount();
            setQuickAccount(account && (await canUseBiometrics()) ? account : null);
            const remembered = await getRememberedAccount();
            if (remembered) setUsernameOrEmail((typed) => typed || remembered);
        })();
    }, []);

    const handleFingerprintLogin = async () => {
        setError('');
        const saved = await readQuickLogin();
        if (saved === null) return; // cancelled
        if (saved === 'reset') {
            setQuickAccount(null);
            setError('Fingerprint login was reset (your fingerprints may have changed). Log in with your password to turn it on again.');
            return;
        }
        setUsernameOrEmail(saved.usernameOrEmail);
        await handleLogin(saved, true);
    };

    const handleLogin = async (typed?: { usernameOrEmail: string; password: string }, fromFingerprint = false) => {
        setError('');
        const creds = typed ?? { usernameOrEmail: usernameOrEmail.trim(), password };
        if (!creds.usernameOrEmail.trim() || !creds.password.trim()) {
            setError('Please enter username/email and password.');
            return;
        }

        const result = await login({ usernameOrEmail: creds.usernameOrEmail.trim(), password: creds.password });

        // Remember (or forget) the account name once the server has accepted the password
        if (result.success || result.requiresDeviceVerification || result.requiresTOTPCode) {
            await setRememberedAccount(rememberMe ? creds.usernameOrEmail.trim() : null);
        }

        if (result.success) {
            // After a typed login, offer fingerprint login once (unless already on or declined)
            if (!fromFingerprint && (await shouldOfferQuickLogin())) {
                Alert.alert('Log in with your fingerprint?', 'Next time, log in with one touch instead of typing your email and password. They stay on this phone, locked to your fingerprint.', [
                    {
                        text: 'Not now',
                        style: 'cancel',
                        onPress: async () => {
                            await declineQuickLogin();
                            router.replace('/(tabs)');
                        },
                    },
                    {
                        text: 'Turn on',
                        onPress: async () => {
                            await enableQuickLogin({ usernameOrEmail: creds.usernameOrEmail.trim(), password: creds.password });
                            router.replace('/(tabs)');
                        },
                    },
                ]);
                return;
            }
            router.replace('/(tabs)');
            return;
        }

        // The saved password no longer works (e.g. it was changed): stop offering it
        if (fromFingerprint && /password|credential/i.test(result.message ?? '')) {
            await disableQuickLogin();
            setQuickAccount(null);
            setError('Your saved password no longer works. Log in with your password to update fingerprint login.');
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
                const setupResult = await setupTOTPLogin(creds.usernameOrEmail.trim());
                if (setupResult.success && setupResult.secret) {
                    router.push({
                        pathname: '/TOTPSetup',
                        params: {
                            secret: setupResult.secret,
                            usernameOrEmail: creds.usernameOrEmail.trim(),
                            source: 'login',
                            password: creds.password,
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
                    usernameOrEmail: creds.usernameOrEmail.trim(),
                    source: 'login',
                    password: creds.password,
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
            {/* Soft shapes and candlesticks behind everything, like the welcome screen */}
            <BackgroundDecor palette={palette} variant="market" />
            <KeyboardSafeScroll>
                {/* Transparent, so the background shapes behind it show through */}
                <View style={[styles.container, { paddingTop: insets.top, backgroundColor: 'transparent' }]}>

                    {/* Same animated robot as the welcome screen (orbit ring + floating chips) */}
                    <View style={[styles.topIllustration, { marginBottom: 40 }]}>
                        <HeroRobot palette={palette} />
                        <Text style={[styles.title, { marginTop: 22, marginBottom: 2 }]}>Welcome back</Text>
                        <Text style={styles.subtitle}>Log in to manage your bots</Text>
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
                                        keyboardType="email-address"
                                        value={usernameOrEmail}
                                        onChangeText={setUsernameOrEmail}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        // Lets Android's password manager offer to save, and later fill, the account
                                        autoComplete="username"
                                        textContentType="username"
                                        importantForAutofill="yes"
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
                                        autoCorrect={false}
                                        autoComplete="current-password"
                                        textContentType="password"
                                        importantForAutofill="yes"
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

                            <TouchableOpacity
                                onPress={() => setRememberMe(!rememberMe)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4, marginBottom: 16, alignSelf: 'flex-start' }}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: rememberMe }}
                                hitSlop={8}
                            >
                                <Ionicons name={rememberMe ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
                                <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: FONTS.regular }}>Remember me</Text>
                            </TouchableOpacity>

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
                                onPress={() => handleLogin()}
                                disabled={isLoading || isResetLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={colors.white} />
                                ) : (
                                    <Text style={styles.buttonText}>Login</Text>
                                )}
                            </TouchableOpacity>

                            {/* One-touch login with the account saved behind the fingerprint */}
                            {quickAccount && (
                                <TouchableOpacity
                                    onPress={handleFingerprintLogin}
                                    disabled={isLoading || isResetLoading}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        marginTop: 12,
                                        paddingVertical: 13,
                                        borderRadius: 12,
                                        borderWidth: 1.5,
                                        borderColor: colors.primary,
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Log in with fingerprint as ${quickAccount}`}
                                >
                                    <Ionicons name="finger-print" size={22} color={colors.primary} />
                                    <View>
                                        <Text style={{ color: colors.primary, fontSize: 16, fontFamily: FONTS.semibold }}>Log in with fingerprint</Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: FONTS.regular }} numberOfLines={1}>
                                            as {quickAccount}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}

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
            </KeyboardSafeScroll>
        </View>
    );
}