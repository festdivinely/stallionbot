// components/SkeletonElement.tsx - FIXED
import React, { memo } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    Dimensions,
    ViewStyle,
    DimensionValue
} from 'react-native';
import { SkeletonElementProps } from '../types/skeleton.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface InternalSkeletonElementProps extends SkeletonElementProps {
    animationValue?: Animated.Value;
    animationType?: 'shimmer' | 'pulse' | 'wave' | 'none';
    speed?: number;
    backgroundColor?: string;
    highlightColor?: string;
    enableGradient?: boolean;
    gradientColors?: [string, string, string];
}

const SkeletonElement: React.FC<InternalSkeletonElementProps> = memo(({
    width = '100%',
    height = 20,
    borderRadius = 8,
    circle = false,
    marginTop = 0,
    marginBottom = 0,
    marginLeft = 0,
    marginRight = 0,
    style,
    animationValue,
    animationType = 'shimmer',
    speed = 1000,
    backgroundColor = '#E1E9EE',
    highlightColor = '#F2F8FC',
    enableGradient = false,
    gradientColors = ['#E1E9EE', '#F2F8FC', '#E1E9EE'] as [string, string, string],
}) => {
    // Convert width to DimensionValue
    const widthDimension: DimensionValue = typeof width === 'number' || width === '100%' || width === 'auto'
        ? width as DimensionValue
        : Number(width) || width as DimensionValue;

    const elementStyle: ViewStyle = {
        width: widthDimension,
        height,
        borderRadius: circle ? height / 2 : borderRadius,
        backgroundColor,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        overflow: 'hidden',
    };

    const renderAnimation = () => {
        if (!animationValue) return null;

        switch (animationType) {
            case 'shimmer':
                const translateX = animationValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
                });

                return (
                    <Animated.View
                        style={[
                            styles.shimmer,
                            {
                                backgroundColor: highlightColor,
                                transform: [{ translateX }],
                            } as any,
                        ]}
                    />
                );

            case 'pulse':
                const opacity = animationValue.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 0.5, 1],
                });

                return (
                    <Animated.View
                        style={[
                            styles.pulse,
                            {
                                backgroundColor: highlightColor,
                                opacity,
                            },
                        ]}
                    />
                );

            case 'wave':
                const waveTranslateX = animationValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 100],
                });

                return (
                    <Animated.View
                        style={[
                            styles.wave,
                            {
                                backgroundColor: highlightColor,
                                transform: [{ translateX: waveTranslateX }] as any,
                            },
                        ]}
                    />
                );

            default:
                return null;
        }
    };

    return (
        <View style={[styles.container, elementStyle, style]}>
            {animationType !== 'none' && renderAnimation()}
            {enableGradient && gradientColors && (
                <View style={[styles.gradient, {
                    backgroundColor: gradientColors[0],
                }]} />
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    shimmer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.6,
    },
    pulse: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.8,
    },
    wave: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.4,
        transform: [{ skewX: '-20deg' }],
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.3,
    },
});

export default SkeletonElement;