// components/DraggableColorPicker.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    PanResponder,
    StyleSheet,
    Dimensions,
    Text,
    TouchableOpacity,
} from 'react-native';

interface DraggableColorPickerProps {
    hue: number; // 0-360
    saturation: number; // 0-100
    value: number; // 0-100
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

    // Convert HSV to position
    const getPickerPosition = () => {
        const x = (saturation / 100) * size - pickerSize / 2;
        const y = ((100 - value) / 100) * size - pickerSize / 2;
        return { x, y };
    };

    const [pickerPos, setPickerPos] = useState(getPickerPosition());

    // Update picker position when hue/saturation/value changes
    useEffect(() => {
        setPickerPos(getPickerPosition());
    }, [saturation, value, size]);

    const handleMove = (x: number, y: number) => {
        const containerWidth = size;
        const containerHeight = size;

        // Clamp values within bounds
        const clampedX = Math.max(0, Math.min(x, containerWidth));
        const clampedY = Math.max(0, Math.min(y, containerHeight));

        // Calculate saturation (0-100%) from x position
        const newSaturation = (clampedX / containerWidth) * 100;

        // Calculate value (0-100%) from y position (inverted)
        const newValue = 100 - (clampedY / containerHeight) * 100;

        setPickerPos({
            x: clampedX - pickerSize / 2,
            y: clampedY - pickerSize / 2,
        });

        onChange(hue, newSaturation, newValue);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt, gestureState) => {
                const { locationX, locationY } = evt.nativeEvent;
                handleMove(locationX, locationY);
            },
            onPanResponderMove: (evt, gestureState) => {
                const { locationX, locationY } = evt.nativeEvent;
                handleMove(locationX, locationY);
            },
            onPanResponderRelease: () => {
                onDragEnd && onDragEnd();
            },
        })
    ).current;

    // Create the color palette background
    const getPaletteBackground = () => {
        // For React Native, we need to create a gradient-like effect
        // We'll use multiple layers or find a library for gradients
        // For now, using a solid color based on hue
        return `hsl(${hue}, 100%, 50%)`;
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Color palette background */}
            <View
                ref={containerRef}
                style={[
                    styles.palette,
                    {
                        width: size,
                        height: size,
                        backgroundColor: getPaletteBackground(),
                    },
                ]}
                {...panResponder.panHandlers}
            >
                {/* White to transparent gradient (top to bottom) */}
                <View style={styles.gradientWhite} />

                {/* Black to transparent gradient (left to right) */}
                <View style={styles.gradientBlack} />
            </View>

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
    },
    palette: {
        borderRadius: 8,
        position: 'relative',
    },
    gradientWhite: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0)',
        backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))',
    },
    gradientBlack: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0)',
        backgroundImage: 'linear-gradient(to left, rgba(0,0,0,1), rgba(0,0,0,0))',
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
    },
});

export default DraggableColorPicker;