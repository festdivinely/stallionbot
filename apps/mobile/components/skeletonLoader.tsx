// components/SkeletonLoader.tsx - FIXED
import React, { useEffect, useRef, memo, useMemo } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    Easing,
    ScrollView,
    Dimensions,
} from 'react-native';
import SkeletonElement from './skeletonElement';
import { SkeletonLoaderProps, SkeletonType } from '../types/skeleton.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SkeletonLoader: React.FC<SkeletonLoaderProps> = memo(({
    type = 'feed',
    count = 1,
    customLayout,
    animationType = 'shimmer',
    speed = 1000,
    backgroundColor = '#E1E9EE',
    highlightColor = '#F2F8FC',
    width = '100%',
    height = 'auto',
    borderRadius = 8,
    spacing = 12,
    animated = true,
    direction = 'column',
    enableGradient = false,
    gradientColors = ['#E1E9EE', '#F2F8FC', '#E1E9EE'] as [string, string, string],
    theme = 'light',
    style,
}) => {
    const animationValue = useRef(new Animated.Value(0)).current;

    // Apply theme-based colors
    const themeColors = useMemo(() => {
        if (theme === 'dark') {
            return {
                backgroundColor: '#2D3748',
                highlightColor: '#4A5568',
            };
        } else if (theme === 'light') {
            return {
                backgroundColor,
                highlightColor,
            };
        }
        // Auto theme - you can implement system theme detection here
        return { backgroundColor, highlightColor };
    }, [theme, backgroundColor, highlightColor]);

    useEffect(() => {
        if (animated && animationType !== 'none') {
            const startAnimation = () => {
                animationValue.setValue(0);
                Animated.timing(animationValue, {
                    toValue: 1,
                    duration: speed,
                    easing: Easing.linear,
                    useNativeDriver: animationType === 'shimmer' || animationType === 'wave',
                }).start(() => {
                    if (animated) {
                        startAnimation();
                    }
                });
            };

            startAnimation();

            return () => {
                animationValue.stopAnimation();
            };
        }
    }, [animated, animationType, speed]);

    const renderSkeletonElement = (props = {}) => (
        <SkeletonElement
            animationValue={animationValue}
            animationType={animationType}
            speed={speed}
            backgroundColor={themeColors.backgroundColor}
            highlightColor={themeColors.highlightColor}
            enableGradient={enableGradient}
            gradientColors={gradientColors}
            borderRadius={borderRadius}
            {...props}
        />
    );

    // Profile Skeleton Layout
    const renderProfileSkeleton = () => (
        <View style={[styles.container, style, { width, height }]}>
            <View style={[styles.profileContainer, { marginBottom: spacing }]}>
                {renderSkeletonElement({ width: 100, height: 100, circle: true })}
                <View style={[styles.profileInfo, { marginLeft: spacing }]}>
                    {renderSkeletonElement({ width: '70%', height: 24 })}
                    {renderSkeletonElement({
                        width: '50%',
                        height: 16,
                        marginTop: spacing / 2
                    })}
                    {renderSkeletonElement({
                        width: '60%',
                        height: 14,
                        marginTop: spacing / 2
                    })}
                </View>
            </View>
            <View style={[styles.statsContainer, { marginBottom: spacing }]}>
                {[1, 2, 3].map((item) => (
                    <View key={item} style={styles.statItem}>
                        {renderSkeletonElement({ width: 40, height: 40, circle: true })}
                        {renderSkeletonElement({
                            width: 60,
                            height: 12,
                            marginTop: spacing / 2
                        })}
                    </View>
                ))}
            </View>
            {renderSkeletonElement({ height: 100 })}
        </View>
    );

    // Feed Skeleton Layout
    const renderFeedSkeleton = () => (
        <View style={[styles.container, style, { width, height }]}>
            <View style={[styles.feedHeader, { marginBottom: spacing }]}>
                {renderSkeletonElement({ width: 40, height: 40, circle: true })}
                <View style={[styles.headerText, { marginLeft: spacing }]}>
                    {renderSkeletonElement({ width: '60%', height: 16 })}
                    {renderSkeletonElement({
                        width: '40%',
                        height: 12,
                        marginTop: spacing / 2
                    })}
                </View>
            </View>
            {renderSkeletonElement({
                height: 200,
                marginBottom: spacing
            })}
            <View style={styles.feedFooter}>
                <View style={styles.footerActions}>
                    {renderSkeletonElement({ width: 24, height: 24, circle: true })}
                    {renderSkeletonElement({
                        width: 24,
                        height: 24,
                        circle: true,
                        marginLeft: spacing
                    })}
                    {renderSkeletonElement({
                        width: 24,
                        height: 24,
                        circle: true,
                        marginLeft: spacing
                    })}
                </View>
                {renderSkeletonElement({ width: '30%', height: 14 })}
            </View>
        </View>
    );

    // List Skeleton Layout
    const renderListSkeleton = () => (
        <View style={[styles.container, style, { width, height }]}>
            {Array.from({ length: count }).map((_, index) => (
                <View
                    key={`list-item-${index}`}
                    style={[
                        styles.listItem,
                        {
                            marginBottom: spacing,
                            flexDirection: direction
                        }
                    ]}
                >
                    {renderSkeletonElement({
                        width: 60,
                        height: 60,
                        marginRight: direction === 'row' ? spacing : 0
                    })}
                    <View style={[
                        styles.listContent,
                        {
                            marginLeft: direction === 'row' ? spacing : 0,
                            marginTop: direction === 'column' ? spacing / 2 : 0
                        }
                    ]}>
                        {renderSkeletonElement({ width: '80%', height: 18 })}
                        {renderSkeletonElement({
                            width: '60%',
                            height: 14,
                            marginTop: spacing / 2
                        })}
                        {renderSkeletonElement({
                            width: '40%',
                            height: 12,
                            marginTop: spacing / 2
                        })}
                    </View>
                </View>
            ))}
        </View>
    );

    // Card Skeleton Layout
    const renderCardSkeleton = () => (
        <View style={[styles.container, style, { width, height }]}>
            {renderSkeletonElement({
                height: 150,
                marginBottom: spacing
            })}
            {renderSkeletonElement({
                width: '80%',
                height: 20,
                marginBottom: spacing / 2
            })}
            {renderSkeletonElement({
                width: '100%',
                height: 14,
                marginBottom: spacing / 2
            })}
            {renderSkeletonElement({
                width: '100%',
                height: 14,
                marginBottom: spacing
            })}
            <View style={styles.cardFooter}>
                {renderSkeletonElement({ width: 80, height: 32 })}
                <View style={styles.cardStats}>
                    {renderSkeletonElement({ width: 60, height: 16 })}
                    {renderSkeletonElement({
                        width: 60,
                        height: 16,
                        marginLeft: spacing
                    })}
                </View>
            </View>
        </View>
    );

    // Chat Skeleton Layout
    const renderChatSkeleton = () => (
        <View style={[styles.container, style, { width, height }]}>
            <View style={[styles.chatHeader, { marginBottom: spacing }]}>
                {renderSkeletonElement({ width: 50, height: 50, circle: true })}
                <View style={[styles.chatHeaderInfo, { marginLeft: spacing }]}>
                    {renderSkeletonElement({ width: 120, height: 20 })}
                    {renderSkeletonElement({
                        width: 80,
                        height: 14,
                        marginTop: spacing / 2
                    })}
                </View>
            </View>

            {/* Chat messages */}
            <View style={styles.chatMessages}>
                {/* Received messages */}
                <View style={[styles.messageRow, styles.messageReceived]}>
                    {renderSkeletonElement({ width: 40, height: 40, circle: true })}
                    <View style={styles.messageBubble}>
                        {renderSkeletonElement({ width: 200, height: 60 })}
                    </View>
                </View>

                {/* Sent messages */}
                <View style={[styles.messageRow, styles.messageSent]}>
                    <View style={styles.messageBubble}>
                        {renderSkeletonElement({ width: 180, height: 50 })}
                    </View>
                </View>

                {/* Typing indicator */}
                <View style={[styles.messageRow, styles.messageReceived]}>
                    {renderSkeletonElement({ width: 40, height: 40, circle: true })}
                    <View style={styles.typingIndicator}>
                        {renderSkeletonElement({ width: 60, height: 30 })}
                    </View>
                </View>
            </View>

            {/* Input area */}
            <View style={styles.chatInput}>
                {renderSkeletonElement({ height: 50 })}
            </View>
        </View>
    );

    // Dashboard Skeleton Layout
    const renderDashboardSkeleton = () => (
        <View style={[styles.container, style, { width, height }]}>
            {/* Stats cards */}
            <View style={[styles.dashboardStats, { marginBottom: spacing }]}>
                {[1, 2, 3, 4].map((item) => (
                    <View key={`stat-${item}`} style={styles.statCard}>
                        {renderSkeletonElement({ height: 80 })}
                    </View>
                ))}
            </View>

            {/* Charts */}
            <View style={[styles.dashboardCharts, { marginBottom: spacing }]}>
                {renderSkeletonElement({ height: 200 })}
                {renderSkeletonElement({
                    height: 150,
                    marginTop: spacing
                })}
            </View>

            {/* Recent activity */}
            <View style={styles.dashboardActivity}>
                {renderSkeletonElement({
                    width: '40%',
                    height: 24,
                    marginBottom: spacing
                })}
                {Array.from({ length: 5 }).map((_, index) => (
                    <View
                        key={`activity-${index}`}
                        style={[styles.activityItem, { marginBottom: spacing / 2 }]}
                    >
                        {renderSkeletonElement({ width: 40, height: 40, circle: true })}
                        <View style={[styles.activityInfo, { marginLeft: spacing }]}>
                            {renderSkeletonElement({ width: '70%', height: 16 })}
                            {renderSkeletonElement({
                                width: '50%',
                                height: 12,
                                marginTop: spacing / 3
                            })}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderSkeleton = () => {
        switch (type) {
            case 'profile':
                return renderProfileSkeleton();
            case 'feed':
                return renderFeedSkeleton();
            case 'list':
                return renderListSkeleton();
            case 'card':
                return renderCardSkeleton();
            case 'chat':
                return renderChatSkeleton();
            case 'dashboard':
                return renderDashboardSkeleton();
            case 'custom':
                return customLayout || renderSkeletonElement();
            default:
                return renderFeedSkeleton();
        }
    };

    return renderSkeleton();
});

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    profileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileInfo: {
        flex: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginVertical: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    feedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    feedFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    footerActions: {
        flexDirection: 'row',
    },
    listItem: {
        alignItems: 'center',
    },
    listContent: {
        flex: 1,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardStats: {
        flexDirection: 'row',
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chatHeaderInfo: {
        flex: 1,
    },
    chatMessages: {
        flex: 1,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    messageReceived: {
        justifyContent: 'flex-start',
    },
    messageSent: {
        justifyContent: 'flex-end',
    },
    messageBubble: {
        marginHorizontal: 8,
    },
    typingIndicator: {
        marginLeft: 8,
    },
    chatInput: {
        marginTop: 16,
    },
    dashboardStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statCard: {
        width: '48%',
        marginBottom: 12,
    },
    dashboardCharts: {
        marginTop: 8,
    },
    dashboardActivity: {
        marginTop: 8,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activityInfo: {
        flex: 1,
    },
});

export default SkeletonLoader;