// Bottom sheet: slides up over the screen with a grabber and a title. Closes on a tap outside it,
// the ✕ button or the Back button, without changing anything.
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';

export default function Sheet({ visible, title, onClose, children, tall = false }: {
    visible: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    /** Take most of the screen (long lists) instead of fitting the content. */
    tall?: boolean;
}) {
    const { colors } = useThemeStore();
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            {/* Covers the whole screen behind the sheet: a tap anywhere outside it closes the sheet
                and leaves the current choice as it was */}
            <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
            <View
                style={[
                    styles.sheet,
                    tall && styles.tall,
                    { backgroundColor: colors.cardBackground, paddingBottom: insets.bottom + 12 },
                ]}
            >
                <View style={[styles.grabber, { backgroundColor: colors.border }]} />
                <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                <TouchableOpacity
                    onPress={onClose}
                    style={[styles.close, { backgroundColor: colors.inputBackground }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                >
                    <Ionicons name="close" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                {children}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    close: { position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 10,
        // Short sheets fit their content but never cover the whole screen
        maxHeight: '80%',
    },
    // Leaves a clear strip of dimmed screen above the sheet to tap to close it
    tall: { height: '75%' },
    grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 10 },
    title: { fontSize: 17, fontFamily: FONTS.semibold, textAlign: 'center', marginBottom: 10 },
});
