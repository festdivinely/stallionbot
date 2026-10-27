// store/themeStore.ts — COMPLETE FILE (Production-ready, HSL + WCAG)
import { create } from "zustand";
import AsyncStorage from '@react-native-async-storage/async-storage';

// --------------------------------------------------
// Types
// --------------------------------------------------
type DeveloperTheme = "retro" | "blossom" | "ocean" | "forest" | "dark" | "purple";
type ExtendedTheme = DeveloperTheme | "custom";

interface Colors {
    background: string;
    cardBackground: string;
    border: string;
    primary: string;
    statusBar: string;
    textPrimary: string;
    textSecondary: string;
    textDark: string;
    black: string;
    white: string;
    inputBackground: string;
    placeholderText: string;
    warning: string;
    secondary: string;
    success: string;
    modalOverlay: string;
    secondaryButton: string;
    accent: string;
    lightGray: string;
    shadow: string;
}

interface ThemeState {
    theme: ExtendedTheme;
    primaryColor: string;
    colors: Colors;
    recentColors: string[];
    setTheme: (theme: DeveloperTheme) => void;
    setCustomColor: (hexColor: string) => void;
    addToRecentColors: (color: string) => void;
    getRecentColors: () => string[];
}

// --------------------------------------------------
// Color utilities (HSL + WCAG)
// --------------------------------------------------
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

const normalizeHex = (hex: string) =>
    hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;

const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.slice(0, 2), 16) / 255,
        g: parseInt(clean.slice(2, 4), 16) / 255,
        b: parseInt(clean.slice(4, 6), 16) / 255,
    };
};

const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (x: number) =>
        Math.round(clamp(x) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    return { h, s, l };
};

const hslToRgb = (h: number, s: number, l: number) => {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else[r, g, b] = [c, 0, x];

    return { r: r + m, g: g + m, b: b + m };
};

const adjustLightnessHSL = (hex: string, percent: number) => {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    const newL = clamp(l + percent / 100);
    const rgb = hslToRgb(h, s, newL);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
};

const relativeLuminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const f = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const contrastRatio = (bg: string, fg: string) => {
    const L1 = relativeLuminance(hexToRgb(bg));
    const L2 = relativeLuminance(hexToRgb(fg));
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

const getAccessibleTextColor = (background: string) => {
    const black = '#000000';
    const white = '#FFFFFF';
    return contrastRatio(background, black) >= contrastRatio(background, white)
        ? black
        : white;
};

// --------------------------------------------------
// Theme generation from custom color
// --------------------------------------------------
const generateThemeFromColor = (primary: string): Colors => {
    const base = normalizeHex(primary);
    const background = adjustLightnessHSL(base, 75);
    const textPrimary = getAccessibleTextColor(background);
    const textSecondary = adjustLightnessHSL(textPrimary, textPrimary === '#000000' ? 40 : -40);

    return {
        background: adjustLightnessHSL(base, 40),
        cardBackground: '#FFFFFF',
        border: adjustLightnessHSL(base, 20),
        primary: base,
        statusBar: adjustLightnessHSL(base, -10),
        textPrimary,
        textSecondary,
        textDark: textPrimary,
        black: '#000000',
        white: '#FFFFFF',
        inputBackground: adjustLightnessHSL(base, 35),
        placeholderText: textSecondary,
        warning: '#D32F2F',
        secondary: adjustLightnessHSL(base, -25),
        success: '#388E3C',
        modalOverlay: 'rgba(0,0,0,0.7)',
        secondaryButton: adjustLightnessHSL(background, -5),
        accent: adjustLightnessHSL(base, -35),
        lightGray: adjustLightnessHSL(background, -8),
        shadow: 'rgba(0,0,0,0.12)',
    };
};

// --------------------------------------------------
// Developer themes (unchanged values)
// --------------------------------------------------
// Your original theme colors
const DEVELOPER_THEMES: Record<DeveloperTheme, Colors> = {
    retro: {
        background: '#f5f5f5',
        cardBackground: '#fff',
        border: '#ccc',
        primary: '#e17055',
        secondary: '#f0a500',
        statusBar: '#e17055',
        textPrimary: '#333',
        textSecondary: '#666',
        textDark: '#000',
        black: '#000',
        white: '#fff',
        inputBackground: '#f0f0f0',
        placeholderText: '#666',
        warning: '#d63031',
        success: '#00b894',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#f0f0f0',
        // ADD THESE:
        accent: '#FF6B6B',      // Red accent for retro theme
        lightGray: '#F0F0F0',   // Light gray
        shadow: 'rgba(0,0,0,0.1)', // Shadow color
    },
    blossom: {
        background: '#fce4ec',
        cardBackground: '#fff',
        border: '#f8bbd0',
        primary: '#EC407A',
        secondary: '#F06292',
        statusBar: '#EC407A',
        textPrimary: '#4A2C40',
        textSecondary: '#7B5E74',
        textDark: '#2E1D2A',
        black: '#000',
        white: '#fff',
        inputBackground: '#f8bbd0',
        placeholderText: '#7B5E74',
        warning: '#e91e63',
        success: '#4CAF50',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#f8bbd0',
        // ADD THESE:
        accent: '#6C63FF',      // Purple accent
        lightGray: '#F5F5F5',
        shadow: 'rgba(0,0,0,0.1)',
    },
    ocean: {
        background: '#e3f2fd',
        cardBackground: '#fff',
        border: '#90caf9',
        primary: '#1976D2',
        secondary: '#2196F3',
        statusBar: '#1976D2',
        textPrimary: '#1A3C5A',
        textSecondary: '#4F7396',
        textDark: '#0D1F2D',
        black: '#000',
        white: '#fff',
        inputBackground: '#bbdefb',
        placeholderText: '#4F7396',
        warning: '#1565c0',
        success: '#4CAF50',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#bbdefb',
        // ADD THESE:
        accent: '#FF6584',      // Pink accent
        lightGray: '#E3F2FD',
        shadow: 'rgba(0,0,0,0.1)',
    },
    forest: {
        background: '#e8f5e9',
        cardBackground: '#fff',
        border: '#a5d6a7',
        primary: '#4CAF50',
        secondary: '#66BB6A',
        statusBar: '#4CAF50',
        textPrimary: '#2E4A2E',
        textSecondary: '#5A7D5A',
        textDark: '#1A2F1A',
        black: '#000',
        white: '#fff',
        inputBackground: '#c8e6c9',
        placeholderText: '#5A7D5A',
        warning: '#2e7d32',
        success: '#2e7d32',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#c8e6c9',
        // ADD THESE:
        accent: '#FF9800',      // Orange accent
        lightGray: '#E8F5E9',
        shadow: 'rgba(0,0,0,0.1)',
    },
    dark: {
        background: '#121212',
        cardBackground: '#1E1E1E',
        border: '#424242',
        primary: '#B8860B',
        secondary: '#424242',
        statusBar: '#B8860B',
        textPrimary: '#E0E0E0',
        textSecondary: '#B0B0B0',
        textDark: '#FFFFFF',
        black: '#000',
        white: '#fff',
        inputBackground: '#2C2C2C',
        placeholderText: '#B0B0B0',
        warning: '#ff6b6b',
        success: '#00b894',
        modalOverlay: 'rgba(0, 0, 0, 0.85)',
        secondaryButton: '#2C2C2C',
        // ADD THESE:
        accent: '#CF6679',      // Pink accent for dark theme
        lightGray: '#1E1E1E',
        shadow: 'rgba(255,255,255,0.05)',
    },
    purple: {
        background: '#1A0B2E',
        cardBackground: '#2A1B3D',
        border: '#663AB7',
        primary: '#AB47BC',
        secondary: '#8E24AA',
        statusBar: '#AB47BC',
        textPrimary: '#E1BEE7',
        textSecondary: '#CE93D8',
        textDark: '#F3E5F5',
        black: '#000',
        white: '#fff',
        inputBackground: '#3C2F5F',
        placeholderText: '#CE93D8',
        warning: '#e91e63',
        success: '#4CAF50',
        modalOverlay: 'rgba(26, 11, 46, 0.9)',
        secondaryButton: '#3C2F5F',
        // ADD THESE:
        accent: '#FF4081',      // Pink accent
        lightGray: '#3C2F5F',
        shadow: 'rgba(0,0,0,0.3)',
    },
};

// --------------------------------------------------
// Persistence
// --------------------------------------------------
const loadSavedData = async () => {
    try {
        const [theme, primaryColor, recentColors] = await Promise.all([
            AsyncStorage.getItem('selectedTheme'),
            AsyncStorage.getItem('primaryColor'),
            AsyncStorage.getItem('recentColors'),
        ]);

        return {
            theme: (theme as ExtendedTheme) || 'retro',
            primaryColor: primaryColor || DEVELOPER_THEMES.retro.primary,
            recentColors: recentColors ? JSON.parse(recentColors) : [],
        };
    } catch {
        return {
            theme: 'retro' as ExtendedTheme,
            primaryColor: DEVELOPER_THEMES.retro.primary,
            recentColors: [],
        };
    }
};

// --------------------------------------------------
// Zustand store
// --------------------------------------------------
export const useThemeStore = create<ThemeState>((set, get) => {
    const initialState: ThemeState = {
        theme: 'retro',
        primaryColor: DEVELOPER_THEMES.retro.primary,
        colors: DEVELOPER_THEMES.retro,
        recentColors: [],

        setTheme: (theme) => {
            const colors = DEVELOPER_THEMES[theme];
            set({ theme, primaryColor: colors.primary, colors });
            AsyncStorage.multiSet([
                ['selectedTheme', theme],
                ['primaryColor', colors.primary],
            ]);
        },

        setCustomColor: (hexColor) => {
            const normalized = normalizeHex(hexColor);
            const colors = generateThemeFromColor(normalized);

            set({ theme: 'custom', primaryColor: normalized, colors });
            get().addToRecentColors(normalized);

            AsyncStorage.multiSet([
                ['selectedTheme', 'custom'],
                ['primaryColor', normalized],
            ]);
        },

        addToRecentColors: (color) => {
            const normalized = normalizeHex(color);
            const updated = [normalized, ...get().recentColors.filter(c => c !== normalized)].slice(0, 10);
            set({ recentColors: updated });
            AsyncStorage.setItem('recentColors', JSON.stringify(updated));
        },

        getRecentColors: () => get().recentColors,
    };

    setTimeout(() => {
        loadSavedData().then(({ theme, primaryColor, recentColors }) => {
            const colors = theme === 'custom'
                ? generateThemeFromColor(primaryColor)
                : DEVELOPER_THEMES[theme as DeveloperTheme];

            set({ theme, primaryColor, colors, recentColors });
        });
    }, 0);

    return initialState;
});
