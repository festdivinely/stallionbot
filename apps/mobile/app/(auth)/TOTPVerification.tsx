import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME_COLORS, Theme } from '../../constants/colors';
import createStyles from '../../assets/styles/totpVerification.styles';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

interface Illustrations {
  retro: any;
  blossom: any;
  ocean: any;
  forest: any;
  dark: any;
  purple: any;
}

interface TOTPVerificationParams {
  secret?: string;
  source?: 'login' | 'settings';
  setupMode?: string;
  usernameOrEmail?: string;
  password?: string;
  fingerprint?: string;
}

// Extended styles interface with new properties
interface ExtendedStyles {
  container: any;
  scrollViewContent: any;
  backButton: any;
  topIllustration: any;
  illustrationImage: any;
  card: any;
  header: any;
  title: any;
  subtitle: any;
  formContainer: any;
  inputGroup: any;
  label: any;
  inputContainer: any;
  inputIcon: any;
  input: any;
  hint: any;
  button: any;
  buttonDisabled: any;
  buttonText: any;
  footer: any;
  footerTextContainer: any;
  footerText: any;
  link: any;
  helpLink: any;
  switchLink: any;
  // New styles for backup code features
  modeToggleContainer: any;
  modeToggleButton: any;
  modeToggleButtonActive: any;
  modeToggleText: any;
  backupCodeInfo: any;
  backupCodeInfoText: any;
  modalOverlay: any;
  modalContent: any;
  modalIcon: any;
  modalTitle: any;
  modalText: any;
  backupCodeDisplay: any;
  backupCodeText: any;
  modalWarning: any;
  modalButtons: any;
  modalButton: any;
  modalButtonText: any;
}

export default function TOTPVerification() {
  const rawTheme = useThemeStore(state => state.theme);
  const theme: Theme = rawTheme === 'custom' ? 'retro' : rawTheme;
  const COLORS = THEME_COLORS[theme];
  const styles = createStyles(theme) as ExtendedStyles;

  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'totp' | 'backup'>('totp');
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [pendingBackupCode, setPendingBackupCode] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams() as Partial<TOTPVerificationParams>;
  const insets = useSafeAreaInsets();

  const { verifyTOTPSetup, verifyTOTPSetupLogin, verifyTOTPLogin } = useAuthStore();

  const isSetupMode = params.setupMode === 'true';
  const isLoginFlow = params.source === 'login';
  const isExistingTOTPVerification = isLoginFlow && !isSetupMode && params.usernameOrEmail;

  const illustrations: Illustrations = {
    retro: require('../../assets/images/retro/i.png'),
    blossom: require('../../assets/images/blossom/i.png'),
    ocean: require('../../assets/images/ocean/i.png'),
    forest: require('../../assets/images/forest/i.png'),
    dark: require('../../assets/images/dark/i.png'),
    purple: require('../../assets/images/purple/i.png'),
  };

  // Auto-submit for TOTP codes only
  useEffect(() => {
    if (inputMode === 'totp' && code.length === 6) {
      handleVerify();
    }
  }, [code, inputMode]);

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter a code');
      return;
    }

    // Validate code based on input mode
    if (inputMode === 'totp' && code.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit code');
      return;
    }

    if (inputMode === 'backup' && code.length !== 8) {
      Alert.alert('Error', 'Please enter a valid 8-character backup code');
      return;
    }

    // Backup code confirmation flow
    if (inputMode === 'backup' && !showBackupConfirm) {
      setPendingBackupCode(code);
      setShowBackupConfirm(true);
      return;
    }

    setIsLoading(true);
    const codeToVerify = inputMode === 'backup' ? pendingBackupCode : code;

    try {
      let result;

      if (isSetupMode && isLoginFlow) {
        // LOGIN SETUP FLOW
        const fingerprintResult = await useAuthStore.getState().generateFingerprint();
        const usernameOrEmail = params.usernameOrEmail;

        if (!usernameOrEmail) {
          Alert.alert('Error', 'Username/email is required for verification');
          setIsLoading(false);
          return;
        }

        if (inputMode === 'backup') {
          Alert.alert('Error', 'Backup codes cannot be used during TOTP setup. Please use your 6-digit TOTP code.');
          setIsLoading(false);
          setCode('');
          setShowBackupConfirm(false);
          return;
        }

        result = await verifyTOTPSetupLogin(
          codeToVerify,
          usernameOrEmail,
          fingerprintResult.fingerprint
        );
      }
      else if (isExistingTOTPVerification) {
        // EXISTING TOTP VERIFICATION FLOW
        const fingerprintResult = await useAuthStore.getState().generateFingerprint();

        result = await verifyTOTPLogin(
          codeToVerify,
          params.usernameOrEmail!,
          fingerprintResult.fingerprint
        );
      }
      else if (isSetupMode) {
        // IN-APP SETUP FLOW
        if (inputMode === 'backup') {
          Alert.alert('Error', 'Backup codes cannot be used during TOTP setup. Please use your 6-digit TOTP code.');
          setIsLoading(false);
          setCode('');
          setShowBackupConfirm(false);
          return;
        }

        result = await verifyTOTPSetup(codeToVerify);
      } else {
        Alert.alert('Error', 'Invalid verification context');
        return;
      }

      if (result.success) {
        // Show success message
        let successMessage = result.message || 'Verification successful!';

        if (result.usedBackupCode && result.backupCodesRemaining !== undefined) {
          successMessage = `✅ ${successMessage}\n\nBackup codes remaining: ${result.backupCodesRemaining}`;

          if (result.warningMessage) {
            Alert.alert(
              'Important Notice',
              result.warningMessage,
              [
                {
                  text: 'OK', onPress: () => {
                    setShowBackupConfirm(false);
                    router.replace('/(tabs)');
                  }
                }
              ]
            );
            return;
          }
        }

        Alert.alert('Success', successMessage);
        setShowBackupConfirm(false);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', result.message || 'Invalid code. Please try again.');
        setCode('');
        setShowBackupConfirm(false);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to verify code. Please check your connection and try again.'
      );
      setCode('');
      setShowBackupConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBackupCode = () => {
    setShowBackupConfirm(false);
    handleVerify();
  };

  const handleCancelBackupCode = () => {
    setShowBackupConfirm(false);
    setCode('');
    setPendingBackupCode('');
  };

  const handleGoBack = () => {
    Alert.alert(
      'Cancel Verification',
      'Are you sure you want to cancel? You will need to complete verification to access your account.',
      [
        { text: 'Continue', style: 'cancel' },
        {
          text: 'Cancel',
          onPress: () => {
            // Safe back navigation
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(auth)');
            }
          }
        }
      ]
    );
  };

  const getTitle = () => {
    if (isExistingTOTPVerification) return 'Two-Factor Authentication';
    if (isSetupMode) return 'Verify Setup';
    return 'Verification Required';
  };

  const getSubtitle = () => {
    if (isExistingTOTPVerification) {
      if (inputMode === 'totp') {
        return 'Enter the 6-digit code from your Google Authenticator app';
      } else {
        return 'Enter an 8-character backup code (each works only once)';
      }
    }
    if (isSetupMode) {
      return 'Enter the 6-digit code from Google Authenticator to complete setup';
    }
    return 'Enter the 6-digit code from your Google Authenticator app';
  };

  const getInputLabel = () => {
    if (inputMode === 'totp') {
      return '6-Digit Verification Code';
    } else {
      return '8-Character Backup Code';
    }
  };

  const getInputPlaceholder = () => {
    if (inputMode === 'totp') {
      return '000000';
    } else {
      return 'A1B2C3D4';
    }
  };

  const getButtonText = () => {
    if (isExistingTOTPVerification) return 'Verify & Login';
    if (isSetupMode) return 'Complete Setup';
    return 'Verify Code';
  };

  const handleInputModeToggle = () => {
    const newMode = inputMode === 'totp' ? 'backup' : 'totp';
    setInputMode(newMode);
    setCode('');

    Alert.alert(
      `Switch to ${newMode === 'totp' ? 'TOTP Code' : 'Backup Code'}`,
      newMode === 'totp'
        ? 'Enter the 6-digit code from Google Authenticator'
        : 'Enter an 8-character backup code. Each backup code works only once.',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 16 }]}
            onPress={handleGoBack}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={styles.topIllustration}>
            <Image source={illustrations[theme]} style={styles.illustrationImage} />
          </View>

          <View style={[styles.card, { backgroundColor: COLORS.cardBackground }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: COLORS.primary }]}>
                {getTitle()}
              </Text>
              <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
                {getSubtitle()}
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                {/* Input Mode Toggle */}
                {isExistingTOTPVerification && (
                  <View style={styles.modeToggleContainer}>
                    <TouchableOpacity
                      style={[
                        styles.modeToggleButton,
                        inputMode === 'totp' && styles.modeToggleButtonActive,
                        { borderColor: COLORS.primary }
                      ]}
                      onPress={() => {
                        setInputMode('totp');
                        setCode('');
                      }}
                    >
                      <Text style={[
                        styles.modeToggleText,
                        inputMode === 'totp' && { color: COLORS.primary, fontWeight: 'bold' }
                      ]}>
                        TOTP Code
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modeToggleButton,
                        inputMode === 'backup' && styles.modeToggleButtonActive,
                        { borderColor: COLORS.primary }
                      ]}
                      onPress={() => {
                        setInputMode('backup');
                        setCode('');
                      }}
                    >
                      <Text style={[
                        styles.modeToggleText,
                        inputMode === 'backup' && { color: COLORS.primary, fontWeight: 'bold' }
                      ]}>
                        Backup Code
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.label, { color: COLORS.textPrimary }]}>
                  {getInputLabel()}
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: COLORS.inputBackground }]}>
                  <Ionicons
                    name={inputMode === 'totp' ? "key-outline" : "lock-closed-outline"}
                    size={20}
                    color={COLORS.primary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: COLORS.textDark }]}
                    placeholder={getInputPlaceholder()}
                    placeholderTextColor={COLORS.textSecondary}
                    value={code}
                    onChangeText={(text) => {
                      let formattedText = text;

                      if (inputMode === 'totp') {
                        formattedText = text.replace(/[^0-9]/g, '');
                        formattedText = formattedText.slice(0, 6);
                      } else {
                        formattedText = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                        formattedText = formattedText.slice(0, 8);
                      }

                      setCode(formattedText);
                    }}
                    keyboardType={inputMode === 'totp' ? "number-pad" : "default"}
                    autoCapitalize="characters"
                    maxLength={inputMode === 'totp' ? 6 : 8}
                    autoFocus
                    editable={!isLoading}
                    // Submit on enter for backup codes
                    onSubmitEditing={() => {
                      if (inputMode === 'backup' && code.length === 8) {
                        handleVerify();
                      }
                    }}
                    returnKeyType={inputMode === 'backup' && code.length === 8 ? "send" : "done"}
                  />
                </View>
                <Text style={[styles.hint, { color: COLORS.textSecondary }]}>
                  {inputMode === 'totp'
                    ? 'The code will be automatically submitted when you enter all 6 digits'
                    : 'Press "Verify & Login" or Enter key when ready'}
                </Text>
              </View>

              {/* Backup Code Warning */}
              {inputMode === 'backup' && (
                <View style={styles.backupCodeInfo}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={[styles.backupCodeInfoText, { color: COLORS.textSecondary }]}>
                    Each backup code works only once. Double-check before submitting.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: COLORS.primary },
                  (!code.trim() ||
                    (inputMode === 'totp' && code.length !== 6) ||
                    (inputMode === 'backup' && code.length !== 8)) && styles.buttonDisabled
                ]}
                onPress={handleVerify}
                disabled={
                  !code.trim() ||
                  (inputMode === 'totp' && code.length !== 6) ||
                  (inputMode === 'backup' && code.length !== 8) ||
                  isLoading
                }
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={[styles.buttonText, { color: COLORS.white }]}>
                    {getButtonText()}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Backup Code Confirmation Modal */}
              <Modal
                visible={showBackupConfirm}
                transparent
                animationType="fade"
                onRequestClose={handleCancelBackupCode}
              >
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { backgroundColor: COLORS.cardBackground }]}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={48}
                      color={COLORS.warning || '#FFA000'}
                      style={styles.modalIcon}
                    />

                    <Text style={[styles.modalTitle, { color: COLORS.textPrimary }]}>
                      Confirm Backup Code Usage
                    </Text>

                    <Text style={[styles.modalText, { color: COLORS.textSecondary }]}>
                      Are you sure you want to use backup code:
                    </Text>

                    <View style={[styles.backupCodeDisplay, { backgroundColor: COLORS.inputBackground }]}>
                      <Text style={[styles.backupCodeText, { color: COLORS.textDark }]}>
                        {pendingBackupCode}
                      </Text>
                    </View>

                    <Text style={[styles.modalWarning, { color: COLORS.warning || '#FFA000' }]}>
                      ⚠️ This backup code will be permanently used and cannot be reused!
                    </Text>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, { backgroundColor: COLORS.secondary || '#6c757d' }]}
                        onPress={handleCancelBackupCode}
                      >
                        <Text style={[styles.modalButtonText, { color: COLORS.textPrimary }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.modalButton, { backgroundColor: COLORS.primary }]}
                        onPress={handleConfirmBackupCode}
                      >
                        <Text style={[styles.modalButtonText, { color: COLORS.white }]}>
                          Yes, Use This Code
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>

              <View style={styles.footer}>
                <View style={styles.footerTextContainer}>
                  {inputMode === 'totp' ? (
                    <>
                      <Text style={[styles.footerText, { color: COLORS.textSecondary }]}>
                        Open Google Authenticator to get your code
                      </Text>
                      {/* Switch to backup code option */}
                      {isExistingTOTPVerification && (
                        <TouchableOpacity
                          style={styles.helpLink}
                          onPress={handleInputModeToggle}
                        >
                          <Text style={[styles.link, { color: COLORS.primary }]}>
                            Don't have Google Authenticator? Use backup code
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={[styles.footerText, { color: COLORS.textSecondary }]}>
                        Enter one of your 8-character backup codes
                      </Text>
                      <TouchableOpacity
                        style={styles.helpLink}
                        onPress={handleInputModeToggle}
                      >
                        <Text style={[styles.link, { color: COLORS.primary }]}>
                          Have Google Authenticator? Use TOTP code
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.helpLink}
                    onPress={() => Alert.alert(
                      'Need Help?',
                      inputMode === 'totp'
                        ? 'Make sure your device time is synchronized and you are using the correct authenticator account.'
                        : 'Backup codes were provided when you set up TOTP. Each code works only once.'
                    )}
                  >
                    <Text style={[styles.link, { color: COLORS.primary }]}>
                      Having trouble?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}