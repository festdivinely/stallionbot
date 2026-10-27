// Round badge with a broker's initials, in the theme colours. Brokers that aren't available yet
// get the soft (outlined) look.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { FONTS } from '../constants/fonts';
import type { Broker } from '../constants/brokers';

export default function BrokerBadge({ broker, size = 40 }: { broker: Pick<Broker, 'initials' | 'status'>; size?: number }) {
    const { colors } = useThemeStore();
    const live = broker.status === 'available';
    return (
        <View
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: size * 0.3,
                    backgroundColor: live ? colors.primary : colors.inputBackground,
                    borderColor: live ? colors.primary : colors.border,
                },
            ]}
        >
            <Text style={[styles.text, { fontSize: size * 0.36, color: live ? colors.white : colors.primary }]}>
                {broker.initials}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    text: { fontFamily: FONTS.bold },
});
