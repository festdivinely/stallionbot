// components/AdvancedColorPicker.tsx
import React, { useState, useRef } from 'react';
import {
    View,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableColorPicker from './draggableColorPicker2';

interface AdvancedColorPickerProps {
    initialColor?: string;
    onColorChange: (color: string) => void;
    onClose?: () => void;
}

const AdvancedColorPicker: React.FC<AdvancedColorPickerProps> = ({
    initialColor = '#4285f4',
    onColorChange,
    onClose,
}) => {
    const [hue, setHue] = useState(210); // 0-360
    const [saturation, setSaturation] = useState(75); // 0-100
    const [value, setValue] = useState(96); // 0-100
    const [opacity, setOpacity] = useState(100); // 0-100

    // Convert HSV to hex
    const hsvToHex = (h: number, s: number, v: number): string => {
        s /= 100;
        v /= 100;

        let r = 0, g = 0, b = 0;

        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }

        const toHex = (x: number) => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const handleColorChange = (h: number, s: number, v: number) => {
        setHue(h);
        setSaturation(s);
        setValue(v);
        const hexColor = hsvToHex(h, s, v);
        onColorChange(hexColor);
    };

    const handleHueChange = (newHue: number) => {
        setHue(newHue);
        const hexColor = hsvToHex(newHue, saturation, value);
        onColorChange(hexColor);
    };

    const handleOpacityChange = (newOpacity: number) => {
        setOpacity(newOpacity);
        // For hex colors with opacity, we'd need RGBA
        // For simplicity, we'll keep it as hex for now
    };

    // Hue slider component
    const HueSlider: React.FC<{ hue: number; onChange: (hue: number) => void }> = ({ hue, onChange }) => {
        const sliderRef = useRef<React.ComponentRef<typeof View>>(null);
        const sliderWidth = Dimensions.get('window').width * 0.8;

        const handleHueSliderMove = (x: number) => {
            const clampedX = Math.max(0, Math.min(x, sliderWidth));
            const newHue = (clampedX / sliderWidth) * 360;
            onChange(newHue);
        };

        const panResponder = useRef(
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt) => {
                    const { locationX } = evt.nativeEvent;
                    handleHueSliderMove(locationX);
                },
                onPanResponderMove: (evt) => {
                    const { locationX } = evt.nativeEvent;
                    handleHueSliderMove(locationX);
                },
            })
        ).current;

        return (
            <View style={styles.sliderContainer}>
                <View
                    ref={sliderRef}
                    style={[styles.hueSlider, { width: sliderWidth }]}
                    {...panResponder.panHandlers}
                >
                    {/* Hue gradient */}
                    <View style={styles.hueGradient} />

                    {/* Slider thumb */}
                    <View
                        style={[
                            styles.sliderThumb,
                            {
                                left: (hue / 360) * sliderWidth - 10,
                                backgroundColor: `hsl(${hue}, 100%, 50%)`,
                            },
                        ]}
                    />
                </View>
            </View>
        );
    };

    // Opacity slider component
    const OpacitySlider: React.FC<{ opacity: number; onChange: (opacity: number) => void }> = ({ opacity, onChange }) => {
        const sliderRef = useRef<React.ComponentRef<typeof View>>(null);
        const sliderWidth = Dimensions.get('window').width * 0.8;

        const handleOpacitySliderMove = (x: number) => {
            const clampedX = Math.max(0, Math.min(x, sliderWidth));
            const newOpacity = (clampedX / sliderWidth) * 100;
            onChange(newOpacity);
        };

        const panResponder = useRef(
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt) => {
                    const { locationX } = evt.nativeEvent;
                    handleOpacitySliderMove(locationX);
                },
                onPanResponderMove: (evt) => {
                    const { locationX } = evt.nativeEvent;
                    handleOpacitySliderMove(locationX);
                },
            })
        ).current;

        return (
            <View style={styles.sliderContainer}>
                <View
                    ref={sliderRef}
                    style={[styles.opacitySlider, { width: sliderWidth }]}
                    {...panResponder.panHandlers}
                >
                    {/* Opacity gradient */}
                    <View style={styles.opacityGradient} />

                    {/* Slider thumb */}
                    <View
                        style={[
                            styles.sliderThumb,
                            {
                                left: (opacity / 100) * sliderWidth - 10,
                                backgroundColor: '#fff',
                                borderColor: '#000',
                            },
                        ]}
                    />
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Color Picker</Text>
                {onClose && (
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Color palette */}
            <View style={styles.paletteContainer}>
                <DraggableColorPicker
                    hue={hue}
                    saturation={saturation}
                    value={value}
                    onChange={handleColorChange}
                    size={250}
                />
            </View>

            {/* Current color preview */}
            <View style={styles.previewContainer}>
                <View
                    style={[
                        styles.colorPreview,
                        { backgroundColor: hsvToHex(hue, saturation, value) },
                    ]}
                />
                <Text style={styles.colorText}>
                    {hsvToHex(hue, saturation, value)}
                </Text>
            </View>

            {/* Hue slider */}
            <View style={styles.sliderSection}>
                <Text style={styles.sliderLabel}>Hue</Text>
                <HueSlider hue={hue} onChange={handleHueChange} />
                <Text style={styles.sliderValue}>{Math.round(hue)}°</Text>
            </View>

            {/* Saturation & Value sliders */}
            <View style={styles.row}>
                <View style={styles.sliderSection}>
                    <Text style={styles.sliderLabel}>Saturation</Text>
                    <View style={styles.valueContainer}>
                        <Text style={styles.sliderValue}>{Math.round(saturation)}%</Text>
                    </View>
                </View>
                <View style={styles.sliderSection}>
                    <Text style={styles.sliderLabel}>Brightness</Text>
                    <View style={styles.valueContainer}>
                        <Text style={styles.sliderValue}>{Math.round(value)}%</Text>
                    </View>
                </View>
            </View>

            {/* Opacity slider */}
            <View style={styles.sliderSection}>
                <Text style={styles.sliderLabel}>Opacity</Text>
                <OpacitySlider opacity={opacity} onChange={handleOpacityChange} />
                <Text style={styles.sliderValue}>{Math.round(opacity)}%</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000',
    },
    paletteContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    previewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
    },
    colorPreview: {
        width: 40,
        height: 40,
        borderRadius: 6,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#ccc',
    },
    colorText: {
        fontSize: 16,
        fontFamily: 'monospace',
        color: '#333',
    },
    sliderSection: {
        marginBottom: 15,
    },
    sliderLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    sliderContainer: {
        height: 30,
        justifyContent: 'center',
    },
    hueSlider: {
        height: 20,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    hueGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'red',
        backgroundImage: 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)',
    },
    opacitySlider: {
        height: 20,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f0f0f0',
    },
    opacityGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        backgroundImage: 'linear-gradient(to right, transparent, #000)',
    },
    sliderThumb: {
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
    },
    sliderValue: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    valueContainer: {
        padding: 8,
        backgroundColor: '#f0f0f0',
        borderRadius: 6,
        alignItems: 'center',
    },
});

export default AdvancedColorPicker;