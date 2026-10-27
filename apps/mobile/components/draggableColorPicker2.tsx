// components/DraggableColorPicker.tsx (Fixed - No bottom edge snapping)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    PanResponder,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface DraggableColorPickerProps {
    hue: number;
    saturation: number;
    value: number;
    onChange: (hue: number, saturation: number, value: number) => void;
    onDragEnd?: () => void;
    size?: number;
}

const DraggableColorPicker: React.FC<DraggableColorPickerProps> = ({
    hue,
    saturation,
    value,
    onChange,
    onDragEnd,
    size = 250,
}) => {
    const containerRef = useRef<React.ComponentRef<typeof View>>(null);
    const pickerSize = 20;
    const [isDragging, setIsDragging] = useState(false);
    const [dragPos, setDragPos] = useState<{ x: number, y: number } | null>(null);

    // Calculate initial picker position
    const getPickerPosition = useCallback(() => {
        const x = (saturation / 100) * size - pickerSize / 2;
        const y = ((100 - value) / 100) * size - pickerSize / 2;
        return { x, y };
    }, [saturation, value, size]);

    // Start with calculated position
    const [pickerPos, setPickerPos] = useState(getPickerPosition());

    // Only update picker position from props when not dragging
    useEffect(() => {
        if (!isDragging && dragPos === null) {
            const newPos = getPickerPosition();
            setPickerPos(newPos);
        }
    }, [saturation, value, size, isDragging, dragPos, getPickerPosition]);

    const handleMove = useCallback((gestureX: number, gestureY: number) => {
        const containerWidth = size;
        const containerHeight = size;

        // Clamp values within bounds with a small margin
        let clampedX = Math.max(1, Math.min(gestureX, containerWidth - 1));
        let clampedY = Math.max(1, Math.min(gestureY, containerHeight - 1));

        // Calculate saturation (0-100%) from x position
        const newSaturation = (clampedX / containerWidth) * 100;

        // Calculate value (0-100%) from y position
        // IMPORTANT: Top should be brightest (value = 100), bottom should be darkest (value = 0)
        const newValue = 100 - (clampedY / containerHeight) * 100;

        // Ensure values stay within valid range
        const clampedSaturation = Math.max(0, Math.min(newSaturation, 100));
        const clampedValue = Math.max(0, Math.min(newValue, 100));

        // Update picker position immediately
        const newPickerPos = {
            x: clampedX - pickerSize / 2,
            y: clampedY - pickerSize / 2,
        };

        setPickerPos(newPickerPos);
        setDragPos(newPickerPos);

        // Only update saturation and value - keep the current hue!
        onChange(hue, clampedSaturation, clampedValue);
    }, [size, hue, onChange]);

    // Alternative simpler fix - Use pageX/pageY instead
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,

            onPanResponderGrant: (evt) => {
                setIsDragging(true);
                // Get absolute position on screen
                const { pageX, pageY } = evt.nativeEvent;
                // Get container position
                containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
                    const containerX = pageX;
                    const containerY = pageY;
                    // Calculate relative position
                    const relativeX = evt.nativeEvent.pageX - containerX;
                    const relativeY = evt.nativeEvent.pageY - containerY;
                    handleMove(relativeX, relativeY);
                });
            },

            onPanResponderMove: (evt) => {
                // Continue using pageX/pageY for consistency
                containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
                    const containerX = pageX;
                    const containerY = pageY;
                    const relativeX = evt.nativeEvent.pageX - containerX;
                    const relativeY = evt.nativeEvent.pageY - containerY;
                    handleMove(relativeX, relativeY);
                });
            },

            onPanResponderRelease: () => {
                setIsDragging(false);
                setDragPos(null);
                onDragEnd && onDragEnd();
            },

            onPanResponderTerminate: () => {
                setIsDragging(false);
                setDragPos(null);
                onDragEnd && onDragEnd();
            },
        })
    ).current;

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Base hue color */}
            <LinearGradient
                colors={[`hsl(${hue}, 100%, 50%)`, `hsl(${hue}, 100%, 50%)`]}
                style={[styles.baseColor, { width: size, height: size, borderWidth: 3 }]}
            >
                {/* Diagonal black gradient from top-left to bottom-right */}
                <LinearGradient
                    colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.diagonalGradient}
                />

                {/* White gradient from top to bottom */}
                <LinearGradient
                    colors={['rgba(255, 255, 255, 1)', 'rgba(255, 255, 255, 0)']}
                    style={styles.whiteGradient}
                />
            </LinearGradient>

            {/* Touchable area for dragging - slightly larger than container for edge dragging */}
            <View
                ref={containerRef}
                style={[styles.touchArea, { width: size, height: size }]}
                {...panResponder.panHandlers}
            />

            {/* Picker circle */}
            <View
                style={[
                    styles.picker,
                    {
                        width: pickerSize,
                        height: pickerSize,
                        left: pickerPos.x,
                        top: pickerPos.y,
                        borderColor: value > 50 ? '#000' : '#fff',
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
    },
    baseColor: {
        borderRadius: 8,
        position: 'absolute',
        top: 0,
        left: 0,
    },
    diagonalGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    whiteGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    touchArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10,
        backgroundColor: 'transparent',
    },
    picker: {
        position: 'absolute',
        borderRadius: 10,
        borderWidth: 2,
        backgroundColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        zIndex: 20,
    },
});

export default DraggableColorPicker;