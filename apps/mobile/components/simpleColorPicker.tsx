// components/SimpleColorPicker.tsx (Fixed - Optimized)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    StyleSheet,
    Text,
    Dimensions,
} from 'react-native';
import DraggableColorPicker from './draggableColorPicker2';
import HueSlider from './hueSlider';

interface SimpleColorPickerProps {
    initialColor?: string;
    onColorChange: (hexColor: string) => void;
}

const SimpleColorPicker: React.FC<SimpleColorPickerProps> = ({
    initialColor = '#4285f4',
    onColorChange,
}) => {
    // Parse initial color to HSV
    const hexToHsv = useCallback((hex: string) => {
        if (!hex || hex.length < 7) {
            return { h: 210, s: 75, v: 96 }; // Default blue
        }

        try {
            const r = parseInt(hex.slice(1, 3), 16) / 255;
            const g = parseInt(hex.slice(3, 5), 16) / 255;
            const b = parseInt(hex.slice(5, 7), 16) / 255;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h = 0, s = 0, v = max;

            const d = max - min;
            s = max === 0 ? 0 : d / max;

            if (max === min) {
                h = 0;
            } else {
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }

            return {
                h: Math.round(h * 360),
                s: Math.round(s * 100),
                v: Math.round(v * 100),
            };
        } catch (error) {
            return { h: 210, s: 75, v: 96 }; // Default on error
        }
    }, []);

    const [hue, setHue] = useState(210);
    const [saturation, setSaturation] = useState(75);
    const [value, setValue] = useState(96);

    // Use ref to always have current hue value
    const hueRef = useRef(hue);
    const lastHexRef = useRef('');

    // Update ref when hue changes
    useEffect(() => {
        hueRef.current = hue;
    }, [hue]);

    // Initialize from initialColor
    useEffect(() => {
        if (initialColor) {
            const hsv = hexToHsv(initialColor);
            setHue(hsv.h);
            setSaturation(hsv.s);
            setValue(hsv.v);
            hueRef.current = hsv.h;
        }
    }, [initialColor, hexToHsv]);

    // Convert HSV to hex
    const hsvToHex = useCallback((h: number, s: number, v: number): string => {
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
    }, []);

    // Handle color change from color picker (only saturation and value should change)
    // In SimpleColorPicker.tsx, update the handleColorChange function:
    const handleColorChange = useCallback((h: number, s: number, v: number) => {
        // IMPORTANT: Use hueRef.current to always get the latest hue value
        // Ensure saturation and value are within valid range
        const safeSaturation = Math.max(0, Math.min(s, 100));
        const safeValue = Math.max(0, Math.min(v, 100));

        setSaturation(safeSaturation);
        setValue(safeValue);

        // Convert to hex using the current hue from ref
        const hexColor = hsvToHex(hueRef.current, safeSaturation, safeValue);

        // Only call onColorChange if hex actually changed
        if (hexColor !== lastHexRef.current) {
            lastHexRef.current = hexColor;
            onColorChange(hexColor);
        }
    }, [hsvToHex, onColorChange]);

    // Handle hue change from hue slider
    const handleHueChange = useCallback((newHue: number) => {
        setHue(newHue);
        // Keep the same saturation and value, just change hue
        const hexColor = hsvToHex(newHue, saturation, value);

        // Only call onColorChange if hex actually changed
        if (hexColor !== lastHexRef.current) {
            lastHexRef.current = hexColor;
            onColorChange(hexColor);
        }
    }, [hsvToHex, saturation, value, onColorChange]);

    const screenWidth = Dimensions.get('window').width;
    const paletteSize = Math.min(screenWidth * 0.8, 300);

    const currentHexColor = useMemo(() =>
        hsvToHex(hue, saturation, value),
        [hsvToHex, hue, saturation, value]
    );

    // Update last hex ref
    useEffect(() => {
        lastHexRef.current = currentHexColor;
    }, [currentHexColor]);

    return (
        <View style={styles.container}>
            {/* Color palette */}
            <View style={styles.paletteContainer}>
                <DraggableColorPicker
                    hue={hue}
                    saturation={saturation}
                    value={value}
                    onChange={handleColorChange}
                    size={paletteSize}
                />
            </View>

            {/* Current color preview */}
            <View style={styles.previewContainer}>
                <View
                    style={[
                        styles.colorPreview,
                        { backgroundColor: currentHexColor },
                    ]}
                />
                <Text style={styles.colorText}>
                    {currentHexColor}
                </Text>
            </View>

            {/* Hue slider */}
            <View style={styles.hueSliderContainer}>
                <Text style={styles.label}>Hue</Text>
                <HueSlider
                    hue={hue}
                    onChange={handleHueChange}
                    width={paletteSize}
                />
            </View>

            {/* Saturation and Brightness values */}
            <View style={styles.valuesContainer}>
                <View style={styles.valueItem}>
                    <Text style={styles.label}>Saturation</Text>
                    <Text style={styles.valueText}>{Math.round(saturation)}%</Text>
                </View>
                <View style={styles.valueItem}>
                    <Text style={styles.label}>Brightness</Text>
                    <Text style={styles.valueText}>{Math.round(value)}%</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
    },
    paletteContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    previewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        width: '100%',
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
        flex: 1,
    },
    hueSliderContainer: {
        width: '100%',
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
    },
    valuesContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    valueItem: {
        flex: 1,
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginHorizontal: 5,
    },
    valueText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
});

export default SimpleColorPicker;