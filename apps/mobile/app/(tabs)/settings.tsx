import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Switch,
    StatusBar,
    Platform,
    Image,
    Alert,
} from 'react-native';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import createSettingsStyles from '../../assets/styles/settings.styles';

interface SettingsSection {
    id: string;
    title: string;
    items: SettingsItem[];
}

interface SettingsItem {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    type: 'navigation' | 'toggle' | 'button';
    value?: boolean;
    action?: () => void;
    danger?: boolean;
}

export default function SettingsPage() {
    const { theme, colors } = useThemeStore();

    // Use safe theme for styles (convert 'custom' to 'retro')
    const themeForStyles = theme === 'custom' ? 'retro' : theme;
    const styles = createSettingsStyles(themeForStyles);

    const { user, logout } = useAuthStore();
    const router = useRouter();
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [biometricLogin, setBiometricLogin] = useState(false);

    const handleLogout = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        await logout();
                        router.replace('/(auth)');
                    },
                },
            ],
            { cancelable: true }
        );
    };

    const handleBack = () => {
        router.back();
    };

    const getProfileImageUrl = () => {
        if (user?.profileImage) {
            return user.profileImage;
        }
        const seed = user?.username || user?.email || 'user';
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
    };

    const sections: SettingsSection[] = [
        {
            id: 'account',
            title: 'Account',
            items: [
                {
                    id: 'profile',
                    title: 'Profile',
                    subtitle: 'Edit your personal information',
                    icon: 'person-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to profile'),
                },
                {
                    id: 'security',
                    title: 'Sign In & Security',
                    subtitle: 'Password, 2FA, and security settings',
                    icon: 'shield-checkmark-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to security'),
                },
                {
                    id: 'payment',
                    title: 'Payment Methods',
                    subtitle: 'Manage your payment options',
                    icon: 'card-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to payment'),
                },
            ],
        },
        {
            id: 'preferences',
            title: 'Preferences',
            items: [
                {
                    id: 'notifications',
                    title: 'Push Notifications',
                    subtitle: 'Receive alerts and updates',
                    icon: 'notifications-outline',
                    type: 'toggle',
                    value: notifications,
                    action: () => setNotifications(!notifications),
                },
                {
                    id: 'darkMode',
                    title: 'Dark Mode',
                    subtitle: 'Use dark theme across the app',
                    icon: 'moon-outline',
                    type: 'toggle',
                    value: darkMode,
                    action: () => setDarkMode(!darkMode),
                },
                {
                    id: 'biometric',
                    title: 'Biometric Login',
                    subtitle: 'Use fingerprint or face ID',
                    icon: 'finger-print-outline',
                    type: 'toggle',
                    value: biometricLogin,
                    action: () => setBiometricLogin(!biometricLogin),
                },
                {
                    id: 'language',
                    title: 'Language',
                    subtitle: 'English (US)',
                    icon: 'language-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to language'),
                },
            ],
        },
        {
            id: 'support',
            title: 'Support',
            items: [
                {
                    id: 'help',
                    title: 'Help Center',
                    subtitle: 'Get help with the app',
                    icon: 'help-circle-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to help'),
                },
                {
                    id: 'contact',
                    title: 'Contact Us',
                    subtitle: 'Get in touch with our team',
                    icon: 'mail-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to contact'),
                },
                {
                    id: 'privacy',
                    title: 'Privacy Policy',
                    subtitle: 'How we handle your data',
                    icon: 'lock-closed-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to privacy'),
                },
                {
                    id: 'terms',
                    title: 'Terms of Service',
                    subtitle: 'App usage terms and conditions',
                    icon: 'document-text-outline',
                    type: 'navigation',
                    action: () => console.log('Navigate to terms'),
                },
            ],
        },
        {
            id: 'about',
            title: 'About',
            items: [
                {
                    id: 'version',
                    title: 'App Version',
                    subtitle: '1.0.0',
                    icon: 'information-circle-outline',
                    type: 'navigation',
                },
                {
                    id: 'rate',
                    title: 'Rate Our App',
                    subtitle: 'Share your feedback',
                    icon: 'star-outline',
                    type: 'navigation',
                    action: () => console.log('Rate app'),
                },
            ],
        },
    ];

    const renderSettingsItem = (item: SettingsItem) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={[
                    styles.item,
                    {
                        backgroundColor: colors.cardBackground,
                        borderBottomColor: colors.border,
                    }
                ]}
                onPress={item.action}
                disabled={item.type !== 'navigation' && !item.action}
            >
                <View style={[
                    styles.itemIconContainer,
                    { backgroundColor: 'rgba(0, 0, 0, 0.05)' }
                ]}>
                    <Ionicons
                        name={item.icon as any}
                        size={22}
                        color={item.danger ? colors.warning : colors.primary}
                    />
                </View>
                <View style={styles.itemContent}>
                    <Text style={[
                        styles.itemTitle,
                        {
                            color: item.danger ? colors.warning : colors.textPrimary,
                        }
                    ]}>
                        {item.title}
                    </Text>
                    {item.subtitle && (
                        <Text style={[
                            styles.itemSubtitle,
                            { color: colors.textSecondary }
                        ]}>
                            {item.subtitle}
                        </Text>
                    )}
                </View>
                {item.type === 'toggle' && (
                    <Switch
                        value={item.value}
                        onValueChange={item.action}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.white}
                    />
                )}
                {item.type === 'navigation' && (
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={colors.textSecondary}
                    />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar
                barStyle={theme === 'dark' || theme === 'purple' ? 'light-content' : 'dark-content'}
            />

            {/* Header */}
            <View style={[
                styles.header,
                {
                    backgroundColor: colors.cardBackground,
                    borderBottomColor: colors.border,
                }
            ]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color={colors.primary}
                    />
                </TouchableOpacity>
                <Text style={[
                    styles.headerTitle,
                    { color: colors.textPrimary }
                ]}>
                    Settings
                </Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Profile Section */}
                <View style={[
                    styles.profileSection,
                    {
                        backgroundColor: colors.cardBackground,
                        borderColor: colors.border,
                    }
                ]}>
                    <Image
                        source={{ uri: getProfileImageUrl() }}
                        style={[
                            styles.profileImage,
                            { borderColor: colors.primary }
                        ]}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={[
                            styles.profileName,
                            { color: colors.textPrimary }
                        ]}>
                            {user?.username || 'User'}
                        </Text>
                        <Text style={[
                            styles.profileEmail,
                            { color: colors.textSecondary }
                        ]}>
                            {user?.email || 'user@example.com'}
                        </Text>
                    </View>
                </View>

                {/* Settings Sections */}
                {sections.map((section) => (
                    <View key={section.id} style={styles.section}>
                        <Text style={[
                            styles.sectionTitle,
                            { color: colors.textSecondary }
                        ]}>
                            {section.title}
                        </Text>
                        <View style={[
                            styles.sectionContent,
                            {
                                backgroundColor: colors.cardBackground,
                                borderColor: colors.border,
                            }
                        ]}>
                            {section.items.map(renderSettingsItem)}
                        </View>
                    </View>
                ))}

                {/* Logout Button */}
                <TouchableOpacity
                    style={[
                        styles.logoutButton,
                        {
                            backgroundColor: colors.cardBackground,
                            borderColor: colors.border,
                        }
                    ]}
                    onPress={handleLogout}
                >
                    <View style={[
                        styles.logoutIconContainer,
                        { backgroundColor: 'rgba(214, 48, 49, 0.1)' }
                    ]}>
                        <Ionicons
                            name="log-out-outline"
                            size={22}
                            color={colors.warning}
                        />
                    </View>
                    <Text style={[
                        styles.logoutText,
                        { color: colors.warning }
                    ]}>
                        Sign Out
                    </Text>
                </TouchableOpacity>

                {/* App Info */}
                <View style={styles.footer}>
                    <Text style={[
                        styles.footerText,
                        { color: colors.textSecondary }
                    ]}>
                        Quantum Robots v1.0.0
                    </Text>
                    <Text style={[
                        styles.footerText,
                        { color: colors.textSecondary }
                    ]}>
                        © 2024 All rights reserved
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}