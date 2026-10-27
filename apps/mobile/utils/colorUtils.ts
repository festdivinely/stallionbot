// utils/colorUtils.ts

/**
 * Convert hex color to HSL (Hue, Saturation, Lightness)
 * This is essential for color manipulation
 */
export const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    // Remove # if present
    const sanitizedHex = hex.replace('#', '');

    // Parse hex values
    const r = parseInt(sanitizedHex.substring(0, 2), 16) / 255;
    const g = parseInt(sanitizedHex.substring(2, 4), 16) / 255;
    const b = parseInt(sanitizedHex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

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
        l: Math.round(l * 100)
    };
};

/**
 * Convert HSL back to hex
 */
export const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
        r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
        r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
        r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
        r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
        r = c; g = 0; b = x;
    }

    // Convert to hex
    const toHex = (color: number) => {
        const hex = Math.round((color + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Lighten or darken a color by percentage
 */
export const adjustLightness = (hex: string, percent: number): string => {
    const hsl = hexToHSL(hex);
    const newLightness = Math.max(0, Math.min(100, hsl.l + percent));
    return hslToHex(hsl.h, hsl.s, newLightness);
};

/**
 * Adjust saturation of a color
 */
export const adjustSaturation = (hex: string, percent: number): string => {
    const hsl = hexToHSL(hex);
    const newSaturation = Math.max(0, Math.min(100, hsl.s + percent));
    return hslToHex(hsl.h, newSaturation, hsl.l);
};

/**
 * Calculate relative luminance for contrast checking
 * WCAG 2.0 standard for accessibility
 */
export const getLuminance = (hex: string): number => {
    const sanitizedHex = hex.replace('#', '');
    const r = parseInt(sanitizedHex.substring(0, 2), 16) / 255;
    const g = parseInt(sanitizedHex.substring(2, 4), 16) / 255;
    const b = parseInt(sanitizedHex.substring(4, 6), 16) / 255;

    const sRGB = [r, g, b].map(channel =>
        channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
};

/**
 * Calculate contrast ratio between two colors
 * Returns a value from 1 to 21 (21 being maximum contrast)
 */
export const getContrastRatio = (color1: string, color2: string): number => {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Generate an accessible text color based on background
 * Returns either black or white depending on contrast
 */
export const getAccessibleTextColor = (backgroundColor: string): string => {
    const contrastWithBlack = getContrastRatio(backgroundColor, '#000000');
    const contrastWithWhite = getContrastRatio(backgroundColor, '#FFFFFF');

    // WCAG AA requires at least 4.5:1 for normal text
    if (contrastWithWhite >= 4.5) {
        return '#FFFFFF';
    }
    if (contrastWithBlack >= 4.5) {
        return '#000000';
    }

    // Fallback: whichever has better contrast
    return contrastWithWhite > contrastWithBlack ? '#FFFFFF' : '#000000';
};