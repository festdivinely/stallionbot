import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Switch,
    StatusBar,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Modal,
    Pressable,
} from 'react-native';
import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import UserAvatar from '../../components/UserAvatar';
import { FONTS } from '../../constants/fonts';
import { allowQuickLoginOffer, canUseBiometrics, disableQuickLogin, getQuickLoginAccount } from '../../utils/quickLogin';

interface SettingsSection {
    id: string;
    title: string;
    items: SettingsItem[];
}

interface SettingsItem {
    id: string;
    title: string;
    subtitle?: string;
    icon: keyof typeof Ionicons.glyphMap;
    type: 'navigation' | 'toggle' | 'info';
    value?: boolean;
    action?: () => void;
}

const AVATAR_SIZE = 96;
const PREVIEW_SIZE = 190;
// Pick -> the system crop screen (square, choose the part you want) -> Done -> our preview with
// Save photo. Full quality here; the photo is resized and compressed only when it is saved.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
};
// Photos are shrunk to this width before upload: sharp on any screen, and only a few hundred KB
const UPLOAD_MAX_WIDTH = 1024;

interface PickedPhoto {
    uri: string;
    width: number;
}

export default function SettingsPage() {
    const { theme, colors } = useThemeStore();
    const { user, logout, uploadProfileImage } = useAuthStore();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    // Fingerprint login (utils/quickLogin.ts): on when an account is saved behind the fingerprint
    const [biometricLogin, setBiometricLogin] = useState(false);
    useEffect(() => {
        getQuickLoginAccount().then((account) => setBiometricLogin(!!account));
    }, []);

    const toggleBiometricLogin = async () => {
        if (biometricLogin) {
            Alert.alert('Turn off fingerprint login?', 'Your saved login will be removed from this phone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Turn off',
                    style: 'destructive',
                    onPress: async () => {
                        await disableQuickLogin();
                        setBiometricLogin(false);
                    },
                },
            ]);
            return;
        }
        if (!(await canUseBiometrics())) {
            Alert.alert('No fingerprint set up', 'Add a fingerprint in your phone settings first, then come back here.');
            return;
        }
        // Saving the login needs the password once, so it is set up at the next password login
        await allowQuickLoginOffer();
        Alert.alert('Fingerprint login', 'Next time you log in with your password, tap "Turn on" when asked. After that, one touch logs you in.');
    };
    const [isUploading, setIsUploading] = useState(false);
    // The photo the user picked, waiting for them to press Save in the preview
    const [picked, setPicked] = useState<PickedPhoto | null>(null);

    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
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

    // ---------- Profile picture ----------
    // Step 1: picking only shows the preview; nothing is uploaded until the user presses Save
    const showPreview = (result: ImagePicker.ImagePickerResult) => {
        if (result.canceled || !result.assets?.[0]) return;
        const { uri, width } = result.assets[0];
        setPicked({ uri, width });
    };

    const takePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Camera access needed', 'Allow camera access in your phone settings to take a profile picture.');
            return;
        }
        showPreview(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
    };

    // The system photo picker needs no permission on current Android and iOS versions
    const chooseFromGallery = async () => {
        showPreview(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
    };

    // Step 2 (Save): shrink to UPLOAD_MAX_WIDTH, convert to JPEG text (base64) and upload
    const savePickedPhoto = async () => {
        if (!picked || isUploading) return;
        setIsUploading(true);
        try {
            let context = ImageManipulator.manipulate(picked.uri);
            if (picked.width > UPLOAD_MAX_WIDTH) context = context.resize({ width: UPLOAD_MAX_WIDTH });
            const rendered = await context.renderAsync();
            const { base64 } = await rendered.saveAsync({ compress: 0.75, format: SaveFormat.JPEG, base64: true });
            if (!base64) throw new Error('Could not prepare the photo');

            const res = await uploadProfileImage(`data:image/jpeg;base64,${base64}`);
            if (res.success) {
                setPicked(null);
                Alert.alert('Profile picture updated', 'Your new picture is saved to your account.');
            } else {
                Alert.alert('Upload failed', res.message);
            }
        } catch (error) {
            console.error('savePickedPhoto: Error', error);
            Alert.alert('Upload failed', 'Could not prepare that photo. Please try another one.');
        } finally {
            setIsUploading(false);
        }
    };

    const changePhoto = () => {
        if (isUploading) return;
        Alert.alert('Profile picture', 'Choose a new picture for your account.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Take photo', onPress: takePhoto },
            { text: 'Choose from gallery', onPress: chooseFromGallery },
        ]);
    };

    // ---------- Sections ----------
    const sections: SettingsSection[] = [
        {
            id: 'account',
            title: 'Account',
            items: [
                { id: 'profile', title: 'Profile', subtitle: 'Edit your personal information', icon: 'person-outline', type: 'navigation', action: () => console.log('Navigate to profile') },
                { id: 'security', title: 'Sign In & Security', subtitle: 'Password, 2FA, and security settings', icon: 'shield-checkmark-outline', type: 'navigation', action: () => console.log('Navigate to security') },
                { id: 'payment', title: 'Payment Methods', subtitle: 'Manage your payment options', icon: 'card-outline', type: 'navigation', action: () => console.log('Navigate to payment') },
            ],
        },
        {
            id: 'preferences',
            title: 'Preferences',
            items: [
                { id: 'notifications', title: 'Push Notifications', subtitle: 'Receive alerts and updates', icon: 'notifications-outline', type: 'toggle', value: notifications, action: () => setNotifications(!notifications) },
                { id: 'darkMode', title: 'Dark Mode', subtitle: 'Use dark theme across the app', icon: 'moon-outline', type: 'toggle', value: darkMode, action: () => setDarkMode(!darkMode) },
                { id: 'biometric', title: 'Fingerprint Login', subtitle: biometricLogin ? 'On: log in with one touch' : 'Log in with your fingerprint', icon: 'finger-print-outline', type: 'toggle', value: biometricLogin, action: toggleBiometricLogin },
                { id: 'language', title: 'Language', subtitle: 'English (US)', icon: 'language-outline', type: 'navigation', action: () => console.log('Navigate to language') },
            ],
        },
        {
            id: 'support',
            title: 'Support',
            items: [
                { id: 'help', title: 'Help Center', subtitle: 'Get help with the app', icon: 'help-circle-outline', type: 'navigation', action: () => console.log('Navigate to help') },
                { id: 'contact', title: 'Contact Us', subtitle: 'Get in touch with our team', icon: 'mail-outline', type: 'navigation', action: () => console.log('Navigate to contact') },
                { id: 'privacy', title: 'Privacy Policy', subtitle: 'How we handle your data', icon: 'lock-closed-outline', type: 'navigation', action: () => console.log('Navigate to privacy') },
                { id: 'terms', title: 'Terms of Service', subtitle: 'App usage terms and conditions', icon: 'document-text-outline', type: 'navigation', action: () => console.log('Navigate to terms') },
            ],
        },
        {
            id: 'about',
            title: 'About',
            items: [
                { id: 'version', title: 'App Version', subtitle: '1.0.0', icon: 'information-circle-outline', type: 'info' },
                { id: 'rate', title: 'Rate Our App', subtitle: 'Share your feedback', icon: 'star-outline', type: 'navigation', action: () => console.log('Rate app') },
            ],
        },
    ];

    const renderItem = (item: SettingsItem, index: number, count: number) => (
        <TouchableOpacity
            key={item.id}
            style={[
                styles.item,
                index < count - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
            ]}
            onPress={item.type === 'toggle' ? item.action : item.action}
            disabled={!item.action}
            activeOpacity={0.7}
        >
            <View style={[styles.itemIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                {!!item.subtitle && <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>}
            </View>
            {item.type === 'toggle' && (
                <Switch
                    value={item.value}
                    onValueChange={item.action}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                />
            )}
            {item.type === 'navigation' && <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={theme === 'dark' || theme === 'purple' ? 'light-content' : 'dark-content'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.headerButton, { backgroundColor: colors.inputBackground }]}
                    onPress={() => router.back()}
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
                <View style={styles.headerButton} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                // Room for the floating tab bar (52 high, 36 above the navigation bar) plus a gap
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 36 + 52 + 32 }]}
            >
                {/* Profile card: colour banner, picture with camera badge, name, email, status */}
                <View style={[styles.profileCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={[styles.banner, { backgroundColor: colors.primary }]}>
                        <View style={[styles.bannerCircle, styles.bannerCircleA]} />
                        <View style={[styles.bannerCircle, styles.bannerCircleB]} />
                    </View>

                    <TouchableOpacity
                        style={styles.avatarWrap}
                        onPress={changePhoto}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Change profile picture"
                    >
                        <UserAvatar
                            size={AVATAR_SIZE}
                            borderColor={colors.cardBackground}
                            borderWidth={4}
                            backgroundColor={colors.inputBackground}
                        />
                        {isUploading && (
                            <View style={styles.avatarOverlay}>
                                <ActivityIndicator color="#FFFFFF" />
                            </View>
                        )}
                        <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.cardBackground }]}>
                            <Ionicons name="camera" size={16} color={colors.white} />
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.profileName, { color: colors.textPrimary }]}>{user?.username || 'User'}</Text>
                    <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                        {user?.email || ''}
                    </Text>

                    <View style={styles.chipRow}>
                        <View style={[styles.chip, { backgroundColor: colors.inputBackground }]}>
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={[styles.chipText, { color: colors.textPrimary }]}>Verified</Text>
                        </View>
                        <View style={[styles.chip, { backgroundColor: colors.inputBackground }]}>
                            <Ionicons
                                name={user?.twoFactorEnabled ? 'lock-closed' : 'lock-open-outline'}
                                size={14}
                                color={user?.twoFactorEnabled ? '#16A34A' : colors.textSecondary}
                            />
                            <Text style={[styles.chipText, { color: colors.textPrimary }]}>
                                {user?.twoFactorEnabled ? '2FA on' : '2FA off'}
                            </Text>
                        </View>
                        <TouchableOpacity style={[styles.chip, { backgroundColor: colors.inputBackground }]} onPress={changePhoto}>
                            <Ionicons name="image-outline" size={14} color={colors.primary} />
                            <Text style={[styles.chipText, { color: colors.primary }]}>Change photo</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Settings sections */}
                {sections.map((section) => (
                    <View key={section.id} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
                        <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                            {section.items.map((item, i) => renderItem(item, i, section.items.length))}
                        </View>
                    </View>
                ))}

                {/* Sign out */}
                <TouchableOpacity
                    style={[styles.logoutButton, { backgroundColor: colors.cardBackground, borderColor: '#DC262633' }]}
                    onPress={handleLogout}
                    activeOpacity={0.8}
                >
                    <View style={[styles.itemIcon, { backgroundColor: '#DC26261A' }]}>
                        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                    </View>
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>Stallion Trader v1.0.0</Text>
                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>© 2026 All rights reserved</Text>
                </View>
            </ScrollView>

            {/* Preview of the picked photo: nothing is saved until the user presses Save photo */}
            <Modal
                visible={!!picked}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => { if (!isUploading) setPicked(null); }}
            >
                <View style={[styles.previewBackdrop, { backgroundColor: colors.modalOverlay }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => { if (!isUploading) setPicked(null); }} />
                    <View style={[styles.previewCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                        <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>New profile picture</Text>
                        <Text style={[styles.previewSubtitle, { color: colors.textSecondary }]}>
                            This is how it will look across the app.
                        </Text>

                        <View style={[styles.previewRing, { borderColor: colors.primary }]}>
                            {!!picked && (
                                <Image source={{ uri: picked.uri }} style={styles.previewImage} contentFit="cover" />
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.previewSave, { backgroundColor: colors.primary, opacity: isUploading ? 0.85 : 1 }]}
                            onPress={savePickedPhoto}
                            disabled={isUploading}
                            activeOpacity={0.85}
                        >
                            {isUploading ? (
                                <>
                                    <ActivityIndicator color={colors.white} />
                                    <Text style={[styles.previewSaveText, { color: colors.white }]}>Saving…</Text>
                                </>
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                                    <Text style={[styles.previewSaveText, { color: colors.white }]}>Save photo</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.previewRow}>
                            <TouchableOpacity
                                style={[styles.previewSecondary, { borderColor: colors.border }]}
                                onPress={chooseFromGallery}
                                disabled={isUploading}
                            >
                                <Text style={[styles.previewSecondaryText, { color: colors.textPrimary }]}>Choose another</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.previewSecondary, { borderColor: colors.border }]}
                                onPress={() => setPicked(null)}
                                disabled={isUploading}
                            >
                                <Text style={[styles.previewSecondaryText, { color: colors.textPrimary }]}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: FONTS.semibold, fontSize: 18 },
    scrollContent: { padding: 16 },

    profileCard: {
        borderRadius: 22,
        borderWidth: 1,
        alignItems: 'center',
        paddingBottom: 18,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.07,
        shadowRadius: 14,
        elevation: 3,
    },
    banner: { alignSelf: 'stretch', height: 78, overflow: 'hidden' },
    bannerCircle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
    bannerCircleA: { width: 140, height: 140, top: -60, right: -30 },
    bannerCircleB: { width: 90, height: 90, bottom: -50, left: 20 },
    // Overlaps the banner: half the avatar sits on the colour
    avatarWrap: { marginTop: -AVATAR_SIZE / 2, marginBottom: 10 },
    avatarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBadge: {
        position: 'absolute',
        right: 0,
        bottom: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileName: { fontFamily: FONTS.semibold, fontSize: 20 },
    profileEmail: { fontFamily: FONTS.regular, fontSize: 13, marginTop: 2, paddingHorizontal: 20 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14, paddingHorizontal: 12 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
    chipText: { fontFamily: FONTS.medium, fontSize: 12 },

    section: { marginTop: 22 },
    sectionTitle: { fontFamily: FONTS.semibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
    sectionCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
    item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, gap: 12 },
    itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    itemContent: { flex: 1 },
    itemTitle: { fontFamily: FONTS.medium, fontSize: 15 },
    itemSubtitle: { fontFamily: FONTS.regular, fontSize: 12, marginTop: 1 },

    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 18,
        borderWidth: 1,
        paddingVertical: 13,
        paddingHorizontal: 14,
        marginTop: 22,
    },
    logoutText: { fontFamily: FONTS.semibold, fontSize: 15, color: '#DC2626' },
    footer: { alignItems: 'center', marginTop: 22, gap: 2 },
    footerText: { fontFamily: FONTS.regular, fontSize: 12 },

    previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    previewCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 26,
        borderWidth: 1,
        padding: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
    },
    previewTitle: { fontFamily: FONTS.semibold, fontSize: 19 },
    previewSubtitle: { fontFamily: FONTS.regular, fontSize: 13, marginTop: 4, textAlign: 'center' },
    previewRing: {
        width: PREVIEW_SIZE + 12,
        height: PREVIEW_SIZE + 12,
        borderRadius: (PREVIEW_SIZE + 12) / 2,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
    },
    previewImage: { width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: PREVIEW_SIZE / 2 },
    previewSave: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        paddingVertical: 14,
    },
    previewSaveText: { fontFamily: FONTS.semibold, fontSize: 16 },
    previewRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 10 },
    previewSecondary: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
    previewSecondaryText: { fontFamily: FONTS.medium, fontSize: 14 },
});
