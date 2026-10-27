import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StyleSheet,
} from 'react-native';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import createStyles from '../../assets/styles/signup.styles';
import { useAuthStore } from '../../store/authStore';
import { validateUsernameFrontend, validatePasswordFrontend, validateEmailFrontend } from '../../utils/validation';
import RobotIllustration from '../../components/robotFace';
import { BackgroundDecor, Chip } from '../../components/welcome/WelcomeArt';
import { getWelcomePalette, PRICE_UP } from '../../components/welcome/welcomePalette';
import KeyboardSafeScroll from '../../components/KeyboardSafeScroll';

export default function Signup() {
    // Get colors and theme from store (theme can be 'custom')
    const { colors, theme } = useThemeStore();
    const palette = getWelcomePalette(colors);

    // Use safe theme for styles (convert 'custom' to 'retro')
    const themeForStyles = theme === 'custom' ? 'retro' : theme;
    const styles = createStyles(themeForStyles);

    const [username, setUsername] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [enableTOTP, setEnableTOTP] = useState<boolean>(false);
    const [errors, setErrors] = useState<{
        username: string[];
        email: string[];
        password: string[];
    }>({ username: [], email: [], password: [] });
    const { register, isLoading } = useAuthStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleUsernameChange = (value: string) => {
        setUsername(value);
        const { errors } = validateUsernameFrontend(value);
        setErrors((prev) => ({ ...prev, username: errors }));
    };

    const handleEmailChange = (value: string) => {
        setEmail(value);
        const { errors } = validateEmailFrontend(value);
        setErrors((prev) => ({ ...prev, email: errors }));
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        const { errors } = validatePasswordFrontend(value);
        setErrors((prev) => ({ ...prev, password: errors }));
    };

    const handleSignup = async () => {
        const usernameValidation = validateUsernameFrontend(username);
        const emailValidation = validateEmailFrontend(email);
        const passwordValidation = validatePasswordFrontend(password);

        setErrors({
            username: usernameValidation.errors,
            email: emailValidation.errors,
            password: passwordValidation.errors,
        });

        if (!usernameValidation.isValid || !emailValidation.isValid || !passwordValidation.isValid) {
            Alert.alert('Validation Error', 'Please fix the errors in the form.');
            return;
        }

        try {
            // Get fingerprint and device info
            const { fingerprint, deviceInfo, networkInfo } = await useAuthStore.getState().generateFingerprint();

            if (!fingerprint) {
                Alert.alert('Error', 'Failed to generate device fingerprint. Please try again.');
                return;
            }

            console.log('🎯 REGISTRATION WITH FULL DATA:', {
                username,
                email,
                enableTOTP,
                fingerprint,
                deviceInfo,
                networkInfo,
                ipAddress: networkInfo.ipAddress,
                country: networkInfo.country
            });

            const result = await register({
                username,
                email,
                password,
                enableTOTP,
                fingerprint,
                deviceInfo,
                ipAddress: networkInfo.ipAddress,
                country: networkInfo.country
            });

            if (result.success) {
                if (result.requiresEmailVerification) {
                    router.push({
                        pathname: '/(auth)/verifyEmail',
                        params: { email: result.email }
                    });
                } else {
                    router.push('/(tabs)');
                }
            } else {
                if (result.action === 'login') {
                    Alert.alert('Account Exists', result.message, [
                        { text: 'Login', onPress: () => router.push('/(auth)') }
                    ]);
                } else {
                    Alert.alert('Signup Failed', result.message);
                }
            }
        } catch (error) {
            console.error('Signup error:', error);
            Alert.alert('Signup Failed', 'An unexpected error occurred');
        }
    };

    return (
        <KeyboardSafeScroll style={{ backgroundColor: colors.background }}>
            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
                {/* Soft background shapes, like the welcome screen */}
                <BackgroundDecor palette={palette} variant="rules" />
                <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                    <View style={styles.header}>
                        {/* Small robot badge, same artwork as the welcome screen */}
                        <View style={[localStyles.robotBadge, { borderColor: colors.primary, backgroundColor: colors.inputBackground }]}>
                            <RobotIllustration width={60} height={60} />
                        </View>
                        <Text style={[styles.title, { color: colors.primary }]}>Stallion Trader</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>One app for all your brokers</Text>
                        <View style={localStyles.chipRow}>
                            <Chip icon="wallet-outline" label="Free demo account" iconColor={colors.primary} palette={palette} />
                            <Chip icon="lock-closed-outline" label="2FA security" iconColor={PRICE_UP} palette={palette} />
                        </View>
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Username</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={colors.primary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={[styles.input, { color: colors.textDark }]}
                                    placeholder="JohnDoe"
                                    placeholderTextColor={colors.placeholderText}
                                    value={username}
                                    onChangeText={handleUsernameChange}
                                    autoCapitalize="none"
                                    keyboardType="default"
                                />
                            </View>
                            {errors.username.map((error, index) => (
                                <Text key={index} style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                                    {error}
                                </Text>
                            ))}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Email</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <Ionicons
                                    name="mail-outline"
                                    size={20}
                                    color={colors.primary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={[styles.input, { color: colors.textDark }]}
                                    placeholder="johndoe@gmail.com"
                                    placeholderTextColor={colors.placeholderText}
                                    keyboardType="email-address"
                                    value={email}
                                    onChangeText={handleEmailChange}
                                    autoCapitalize="none"
                                />
                            </View>
                            {errors.email.map((error, index) => (
                                <Text key={index} style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                                    {error}
                                </Text>
                            ))}
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
                            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={20}
                                    color={colors.primary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={[styles.input, { color: colors.textDark }]}
                                    placeholder="12Ab$%#@!*_-"
                                    placeholderTextColor={colors.placeholderText}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeIconContainer}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color={colors.primary}
                                        style={styles.eyeIcon}
                                    />
                                </TouchableOpacity>
                            </View>
                            {errors.password.map((error, index) => (
                                <Text key={index} style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                                    {error}
                                </Text>
                            ))}
                        </View>

                        {/* TOTP Checkbox */}
                        <View style={styles.totpOption}>
                            <TouchableOpacity
                                style={[styles.checkbox, {
                                    borderColor: colors.primary,
                                    backgroundColor: enableTOTP ? colors.primary : 'transparent'
                                }]}
                                onPress={() => setEnableTOTP(!enableTOTP)}
                            >
                                {enableTOTP && (
                                    <Ionicons
                                        name="checkmark"
                                        size={16}
                                        color={colors.white}
                                    />
                                )}
                            </TouchableOpacity>
                            <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>
                                Enable Two-Factor Authentication (Recommended)
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={handleSignup}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={[styles.buttonText, { color: colors.white }]}>Sign Up</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.footerContainer}>
                            <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account?</Text>
                            <Link href="/(auth)" asChild>
                                <TouchableOpacity>
                                    <Text style={[styles.link, { color: colors.primary }]}>Login</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    </View>
                </View>
            </View>
        </KeyboardSafeScroll>
    );
}

const localStyles = StyleSheet.create({
    robotBadge: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 10,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
});