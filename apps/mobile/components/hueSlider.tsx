// components/HueSlider.tsx (Fixed - No infinite loop)
import React, { useRef, useCallback } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface HueSliderProps {
    hue: number;
    onChange: (hue: number) => void;
    width?: number;
}

const HueSlider: React.FC<HueSliderProps> = ({ hue, onChange, width = 300 }) => {
    const thumbSize = 20;
    const lastHueRef = useRef(hue);

    const handleTouch = useCallback((locationX: number) => {
        // Calculate relative position (0 to 1)
        let relativeX = locationX / width;

        // Clamp between 0 and 1
        relativeX = Math.max(0, Math.min(1, relativeX));

        // Calculate new hue (0 to 360)
        const newHue = relativeX * 360;

        // Update - ensure we only call if hue actually changed significantly
        if (Math.abs(newHue - lastHueRef.current) > 1) {
            lastHueRef.current = newHue;
            onChange(newHue);
        }
    }, [width, onChange]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,

            onPanResponderGrant: (evt) => {
                const { locationX } = evt.nativeEvent;
                handleTouch(locationX);
            },

            onPanResponderMove: (evt) => {
                const { locationX } = evt.nativeEvent;
                handleTouch(locationX);
            },

            onPanResponderRelease: () => {
                // Optional: Do something on release if needed
            },
        })
    ).current;

    // Calculate thumb position
    const thumbPosition = (hue / 360) * width - thumbSize / 2;
    const clampedThumbPosition = Math.max(0, Math.min(thumbPosition, width - thumbSize));

    return (
        <View style={[styles.container, { width }]}>
            <View style={[styles.sliderTrack, { width }]}>
                <LinearGradient
                    colors={[
                        'hsl(0, 100%, 50%)',
                        'hsl(60, 100%, 50%)',
                        'hsl(120, 100%, 50%)',
                        'hsl(180, 100%, 50%)',
                        'hsl(240, 100%, 50%)',
                        'hsl(300, 100%, 50%)',
                        'hsl(360, 100%, 50%)',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.gradient, { width }]}
                />
            </View>

            {/* Touch area for the entire slider */}
            <View
                style={[styles.touchArea, { width }]}
                {...panResponder.panHandlers}
            />

            {/* Thumb */}
            <View
                style={[
                    styles.thumb,
                    {
                        left: clampedThumbPosition,
                        backgroundColor: `hsl(${hue}, 100%, 50%)`,
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 40,
        justifyContent: 'center',
        position: 'relative',
        paddingVertical: 10,
    },
    sliderTrack: {
        height: 20,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    gradient: {
        height: 20,
        borderRadius: 10,
    },
    thumb: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        zIndex: 20,
    },
    touchArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: 40,
        backgroundColor: 'transparent',
        zIndex: 10,
    },
});

export default HueSlider;