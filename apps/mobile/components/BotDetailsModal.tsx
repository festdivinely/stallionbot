import {
    View,
    Text,
    Modal,
    ScrollView,
    TouchableOpacity,
    Image,
    StyleSheet,
} from 'react-native';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { THEME_COLORS, Theme } from '../constants/colors';

interface Bot {
    id: string;
    name: string;
    market: string;
    description: string;
    image: string;
    efficiency: number;
    risk: string;
    isFree: boolean;
    price: number;
    platform: string;
    creator: {
        id: string;
        username: string;
        display_name: string;
    };
    createdAt: string;
}

interface BotDetailsModalProps {
    bot: Bot;
    isVisible: boolean;
    onClose: () => void;
    theme: Theme;
}

const BotDetailsModal: React.FC<BotDetailsModalProps> = ({ bot, isVisible, onClose, theme }) => {
    const COLORS = THEME_COLORS[theme];

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={[styles.modalContainer, { backgroundColor: `${COLORS.black}80` }]}>
                <View style={[styles.modalContent, { backgroundColor: COLORS.cardBackground }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: COLORS.textPrimary }]}>
                            {bot.name}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.modalScroll}>
                        <Image
                            source={{ uri: bot.image || 'https://via.placeholder.com/150' }}
                            style={styles.modalImage}
                        />
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Market: <Text style={{ color: COLORS.textSecondary }}>{bot.market}</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Description: <Text style={{ color: COLORS.textSecondary }}>{bot.description}</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Efficiency: <Text style={{ color: COLORS.textSecondary }}>{bot.efficiency}%</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Risk: <Text style={{ color: COLORS.textSecondary }}>{bot.risk}</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Price: <Text style={{ color: COLORS.primary }}>{bot.isFree ? 'Free' : `$${bot.price}`}</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Platform: <Text style={{ color: COLORS.textSecondary }}>{bot.platform}</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Creator: <Text style={{ color: COLORS.textSecondary }}>{bot.creator.display_name}</Text>
                        </Text>
                        <Text style={[styles.modalLabel, { color: COLORS.textPrimary }]}>
                            Created At: <Text style={{ color: COLORS.textSecondary }}>
                                {new Date(bot.createdAt).toLocaleDateString()}
                            </Text>
                        </Text>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    modalScroll: {
        paddingBottom: 16,
    },
    modalImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
});

export default BotDetailsModal;