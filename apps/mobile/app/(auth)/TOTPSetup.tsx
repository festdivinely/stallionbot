import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StyleSheet,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import createStyles from '../../assets/styles/totpSetup.styles';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

// Update Illustrations interface to include 'custom'
interface Illustrations {
  retro: any;
  blossom: any;
  ocean: any;
  forest: any;
  dark: any;
  purple: any;
  custom: any;
}

interface TOTPSetupParams {
  secret?: string;
  source?: 'login' | 'settings';
  usernameOrEmail?: string;
  password?: string;
  fingerprint?: string;
}

export default function TOTPSetup() {
  // Get colors and theme from store
  const { colors, theme } = useThemeStore();

  // Use safe theme for styles (convert 'custom' to 'retro')
  const themeForStyles = theme === 'custom' ? 'retro' : theme;
  const styles = createStyles(themeForStyles);

  // For image lookup, use fallback for 'custom'
  const imageTheme = theme === 'custom' ? 'retro' : theme;

  const [secret, setSecret] = useState('');
  const [hasEnteredSecret, setHasEnteredSecret] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const copiedOpacity = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const params = useLocalSearchParams() as Partial<TOTPSetupParams>;
  const insets = useSafeAreaInsets();

  const illustrations: Illustrations = {
    retro: require('../../assets/images/retro/i.png'),
    blossom: require('../../assets/images/blossom/i.png'),
    ocean: require('../../assets/images/ocean/i.png'),
    forest: require('../../assets/images/forest/i.png'),
    dark: require('../../assets/images/dark/i.png'),
    purple: require('../../assets/images/purple/i.png'),
    custom: require('../../assets/images/retro/i.png'), // Fallback for custom
  };

  // Use whatever secret is passed in params
  useEffect(() => {
    if (params.secret) {
      setSecret(params.secret);
    }
  }, [params]);

  const handleContinueToVerification = () => {
    if (!hasEnteredSecret) {
      alert('Please enter the secret code in Google Authenticator first before continuing.');
      return;
    }

    router.push({
      pathname: '/(auth)/TOTPVerification',
      params: {
        secret: secret,
        source: params.source || 'settings',
        setupMode: 'true',
        usernameOrEmail: params.usernameOrEmail,
        password: params.password,
        fingerprint: params.fingerprint,
      },
    });
  };

  const handleIHaveEnteredSecret = () => {
    setHasEnteredSecret(true);
    // keep original alert flowinvalid verication context
    alert('Great! Now continue to enter the verification code from your authenticator app.');
    handleContinueToVerification();
  };

  const handleSafeBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)');
    }
  };

  const handleSkipForNow = () => {
    // keep original alert flow (no change)
    const result = confirm('Skip TOTP Setup? Two-factor authentication provides extra security for your account.');
    if (!result) return;
    if (params.source === 'login') {
      router.replace('/(tabs)');
    } else {
      handleSafeBack();
    }
  };

  // Copy secret to clipboard and show ephemeral UI message
  const copyToClipboard = async () => {
    if (!secret) return;
    try {
      await Clipboard.setStringAsync(secret);
      // show ephemeral "Secret copied"
      setShowCopied(true);
      Animated.timing(copiedOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        // hold briefly then fade out
        setTimeout(() => {
          Animated.timing(copiedOpacity, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            setShowCopied(false);
          });
        }, 1200);
      });
    } catch (err) {
      // fallback: you can still alert on failure
      alert('Failed to copy secret. Please try again.');
    }
  };

  const toggleSecretVisibility = () => {
    setIsSecretVisible(prev => !prev);
  };

  // Create masked secret (same length as real secret) so layout is stable
  const maskedSecret = secret ? '•'.repeat(secret.length) : '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 16 }]}
          onPress={handleSafeBack}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.topIllustration}>
            <Image source={illustrations[imageTheme]} style={styles.illustrationImage} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.primary }]}>Setup Two-Factor Authentication</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {params.source === 'login'
                  ? 'Secure your account with 2FA'
                  : 'Add an extra layer of security to your account'
                }
              </Text>
            </View>

            <View style={styles.formContainer}>
              <Text style={[styles.instruction, { color: colors.textPrimary, marginBottom: 20 }]}>
                1. Open Google Authenticator app on your phone
              </Text>

              <Text style={[styles.instruction, { color: colors.textPrimary, marginBottom: 20 }]}>
                2. Tap the '+' button and choose "Enter a setup key"
              </Text>

              <Text style={[styles.instruction, { color: colors.textPrimary, marginBottom: 16 }]}>
                3. Enter this secret code manually:
              </Text>

              {/* Secret Code Display */}
              <View style={[styles.secretContainer, { marginBottom: 8 }]}>
                {secret ? (
                  <>
                    <View style={[styles.secretBox, { paddingVertical: 12, paddingHorizontal: 12 }]}>
                      {/* Horizontal scrollable single-line secret */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ alignItems: 'center' }}
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="clip"
                          style={[
                            styles.secretText,
                            {
                              // Ensure single-line, no wrapping
                              flexShrink: 0,
                              color: colors.textPrimary,
                            },
                          ]}
                        >
                          {isSecretVisible ? secret : maskedSecret}
                        </Text>
                      </ScrollView>
                    </View>

                    {/* Icons row below the secret */}
                    <View style={localStyles.iconRow}>
                      <TouchableOpacity
                        onPress={copyToClipboard}
                        style={[localStyles.iconButton, { borderColor: colors.border }]}
                        accessibilityLabel="Copy secret"
                      >
                        <Ionicons name="copy-outline" size={20} color={colors.primary} />
                        <Text style={[localStyles.iconLabel, { color: colors.textSecondary }]}>Copy</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={toggleSecretVisibility}
                        style={[localStyles.iconButton, { borderColor: colors.border }]}
                        accessibilityLabel={isSecretVisible ? "Hide secret" : "Show secret"}
                      >
                        <Ionicons name={isSecretVisible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.primary} />
                        <Text style={[localStyles.iconLabel, { color: colors.textSecondary }]}>
                          {isSecretVisible ? 'Hide' : 'Show'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Ephemeral "Secret copied" message - NOW ABSOLUTE POSITION */}
                    {showCopied && (
                      <Animated.View
                        style={[
                          localStyles.copiedContainer,
                          {
                            opacity: copiedOpacity,
                            backgroundColor: '#e6f9ed',
                            position: 'absolute',
                            top: -40,
                            left: 0,
                            right: 0,
                          }
                        ]}
                      >
                        <Text style={[localStyles.copiedText, { color: '#0a8b3a' }]}>Secret copied</Text>
                      </Animated.View>
                    )}

                    <Text style={[styles.secretNote, { marginTop: 10 }]}>
                      Type this exact code into Google Authenticator
                    </Text>
                  </>
                ) : (
                  <View style={[styles.secretBox, {
                    backgroundColor: colors.inputBackground,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: colors.border,
                    borderStyle: 'dashed'
                  }]}>
                    <Ionicons name="key-outline" size={40} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                      No Secret Code Available{'\n'}Please request one from login
                    </Text>
                  </View>
                )}
              </View>

              {/* Entry Confirmation - Only show if secret exists */}
              {secret && (
                <View style={styles.entryConfirmation}>
                  <TouchableOpacity
                    style={[
                      styles.entryButton,
                      {
                        backgroundColor: hasEnteredSecret ? colors.primary : 'transparent',
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={handleIHaveEnteredSecret}
                  >
                    <Ionicons
                      name={hasEnteredSecret ? "checkmark-circle" : "key-outline"}
                      size={20}
                      color={hasEnteredSecret ? colors.white : colors.primary}
                    />
                    <Text style={[
                      styles.entryButtonText,
                      { color: hasEnteredSecret ? colors.white : colors.primary }
                    ]}>
                      {hasEnteredSecret ? 'Secret Code Entered' : 'I Have Entered the Secret Code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                {secret ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { backgroundColor: colors.primary },
                      !hasEnteredSecret && styles.buttonDisabled
                    ]}
                    onPress={handleContinueToVerification}
                    disabled={!hasEnteredSecret}
                  >
                    <Text style={[styles.buttonText, { color: colors.white }]}>
                      Continue to Verification
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.white} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={handleSafeBack}
                  >
                    <Text style={[styles.buttonText, { color: colors.white }]}>
                      Back to Login
                    </Text>
                  </TouchableOpacity>
                )}

                {params.source !== 'login' && secret && (
                  <TouchableOpacity
                    style={[styles.skipButton, { borderColor: colors.textSecondary }]}
                    onPress={handleSkipForNow}
                  >
                    <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>
                      Skip for Now
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.noteContainer}>
                <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                  {secret
                    ? 'After entering the secret, Google Authenticator will generate 6-digit codes that change every 30 seconds.'
                    : 'Please complete the login process to generate a secret code for two-factor authentication setup.'
                  }
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const localStyles = StyleSheet.create({
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  iconLabel: {
    marginLeft: 8,
    fontSize: 12,
  },
  copiedContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    zIndex: 100,
  },
  copiedText: {
    fontSize: 12,
    fontWeight: '600',
  },
});