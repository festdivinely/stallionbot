// components/SkeletonScreen.tsx
import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import SkeletonLoader from './skeletonLoader';
import { SkeletonType } from '../types/skeleton.types';

const { width } = Dimensions.get('window');

interface SkeletonScreenProps {
    /** Types of skeletons to show */
    types?: SkeletonType[];
    /** Whether to show in a scrollable container */
    scrollable?: boolean;
    /** Custom layout configuration */
    layout?: 'single' | 'multiple' | 'mixed';
    /** Animation type for all skeletons */
    globalAnimationType?: 'shimmer' | 'pulse' | 'wave';
}

const SkeletonScreen: React.FC<SkeletonScreenProps> = ({
    types = ['profile', 'feed', 'card', 'list'],
    scrollable = true,
    layout = 'mixed',
    globalAnimationType = 'shimmer',
}) => {
    const renderContent = () => {
        const skeletons = [];

        if (layout === 'single' && types.length > 0) {
            skeletons.push(
                <View key="single" style={styles.singleContainer}>
                    <SkeletonLoader
                        type={types[0]}
                        count={3}
                        animationType={globalAnimationType}
                        width={width - 32}
                    />
                </View>
            );
        } else if (layout === 'multiple') {
            types.forEach((type, index) => {
                skeletons.push(
                    <View key={index} style={styles.itemContainer}>
                        <SkeletonLoader
                            type={type}
                            animationType={globalAnimationType}
                            width={width - 32}
                        />
                    </View>
                );
            });
        } else {
            // Mixed layout
            skeletons.push(
                <View key="profile" style={styles.itemContainer}>
                    <SkeletonLoader
                        type="profile"
                        animationType={globalAnimationType}
                        width={width - 32}
                    />
                </View>
            );

            skeletons.push(
                <View key="feed" style={styles.itemContainer}>
                    <SkeletonLoader
                        type="feed"
                        count={2}
                        animationType={globalAnimationType}
                        width={width - 32}
                    />
                </View>
            );

            skeletons.push(
                <View key="dashboard" style={styles.itemContainer}>
                    <SkeletonLoader
                        type="dashboard"
                        animationType={globalAnimationType}
                        width={width - 32}
                    />
                </View>
            );
        }

        if (scrollable) {
            return (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {skeletons}
                </ScrollView>
            );
        }

        return <View style={styles.container}>{skeletons}</View>;
    };

    return <View style={styles.screen}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    container: {
        flex: 1,
        padding: 16,
    },
    singleContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContainer: {
        marginBottom: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
});

export default SkeletonScreen;