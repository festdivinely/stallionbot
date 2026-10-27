// utils/themeGenerator.ts
import { Colors, DeveloperTheme } from '../types/theme';
import { adjustLightness, getAccessibleTextColor } from './colorUtils';

// Your original developer themes (kept exactly as you designed them)
export const DEVELOPER_THEMES: Record<DeveloperTheme, Colors> = {
    retro: {
        background: '#f5f5f5',
        cardBackground: '#fff',
        border: '#ccc',
        primary: '#e17055',
        statusBar: '#e17055',
        textPrimary: '#333',
        textSecondary: '#666',
        textDark: '#000',
        black: '#000',
        white: '#fff',
        inputBackground: '#f0f0f0',
        placeholderText: '#666',
        warning: '#d63031',
        secondary: '#f0a500',
        success: '#00b894',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#f0f0f0',
    },
    blossom: {
        background: '#fce4ec',
        cardBackground: '#fff',
        border: '#f8bbd0',
        primary: '#EC407A',
        statusBar: '#EC407A',
        textPrimary: '#4A2C40',
        textSecondary: '#7B5E74',
        textDark: '#2E1D2A',
        black: '#000',
        white: '#fff',
        inputBackground: '#f8bbd0',
        placeholderText: '#7B5E74',
        warning: '#e91e63',
        secondary: '#F06292',
        success: '#4CAF50',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#f8bbd0',
    },
    ocean: {
        background: '#e3f2fd',
        cardBackground: '#fff',
        border: '#90caf9',
        primary: '#1976D2',
        statusBar: '#1976D2',
        textPrimary: '#1A3C5A',
        textSecondary: '#4F7396',
        textDark: '#0D1F2D',
        black: '#000',
        white: '#fff',
        inputBackground: '#bbdefb',
        placeholderText: '#4F7396',
        warning: '#1565c0',
        secondary: '#2196F3',
        success: '#4CAF50',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#bbdefb',
    },
    forest: {
        background: '#e8f5e9',
        cardBackground: '#fff',
        border: '#a5d6a7',
        primary: '#4CAF50',
        statusBar: '#4CAF50',
        textPrimary: '#2E4A2E',
        textSecondary: '#5A7D5A',
        textDark: '#1A2F1A',
        black: '#000',
        white: '#fff',
        inputBackground: '#c8e6c9',
        placeholderText: '#5A7D5A',
        warning: '#2e7d32',
        secondary: '#66BB6A',
        success: '#2e7d32',
        modalOverlay: 'rgba(0, 0, 0, 0.7)',
        secondaryButton: '#c8e6c9',
    },
    dark: {
        background: '#121212',
        cardBackground: '#1E1E1E',
        border: '#424242',
        primary: '#B8860B',
        statusBar: '#B8860B',
        textPrimary: '#E0E0E0',
        textSecondary: '#B0B0B0',
        textDark: '#FFFFFF',
        black: '#000',
        white: '#fff',
        inputBackground: '#2C2C2C',
        placeholderText: '#B0B0B0',
        warning: '#ff6b6b',
        secondary: '#424242',
        success: '#00b894',
        modalOverlay: 'rgba(0, 0, 0, 0.85)',
        secondaryButton: '#2C2C2C',
    },
    purple: {
        background: '#1A0B2E',
        cardBackground: '#2A1B3D',
        border: '#663AB7',
        primary: '#AB47BC',
        statusBar: '#AB47BC',
        textPrimary: '#E1BEE7',
        textSecondary: '#CE93D8',
        textDark: '#F3E5F5',
        black: '#000',
        white: '#fff',
        inputBackground: '#3C2F5F',
        placeholderText: '#CE93D8',
        warning: '#e91e63',
        secondary: '#8E24AA',
        success: '#4CAF50',
        modalOverlay: 'rgba(26, 11, 46, 0.9)',
        secondaryButton: '#3C2F5F',
    },
};

/**
 * Generate a dynamic theme from any hex color
 */
export const generateThemeFromColor = (hexColor: string, isDarkMode: boolean = false): Colors => {
    const normalizedHex = hexColor.startsWith('#') ? hexColor : `#${hexColor}`;

    // Simple algorithm to create harmonious theme from a single color
    const primary = normalizedHex;

    // Generate background based on primary
    const background = isDarkMode
        ? adjustLightness(primary, -60)
        : adjustLightness(primary, 80);

    // Generate text colors
    const textPrimary = getAccessibleTextColor(background);
    const textSecondary = adjustLightness(textPrimary, isDarkMode ? -20 : 20);

    // Generate other colors
    const cardBackground = isDarkMode
        ? adjustLightness(background, 10)
        : '#FFFFFF';

    const border = adjustLightness(background, isDarkMode ? 15 : -15);
    const inputBackground = adjustLightness(background, isDarkMode ? 20 : -5);
    const secondaryButton = inputBackground;

    // Complementary color for secondary
    const secondary = adjustLightness(primary, isDarkMode ? 30 : -20);

    // Status bar - slightly different shade
    const statusBar = adjustLightness(primary, isDarkMode ? -10 : 10);

    // Keep functional colors consistent
    const warning = isDarkMode ? '#FF6B6B' : '#D32F2F';
    const success = isDarkMode ? '#4CAF50' : '#388E3C';

    return {
        background,
        cardBackground,
        border,
        primary,
        statusBar,
        textPrimary,
        textSecondary,
        textDark: textPrimary,
        black: '#000000',
        white: '#FFFFFF',
        inputBackground,
        placeholderText: textSecondary,
        warning,
        secondary,
        success,
        modalOverlay: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.7)',
        secondaryButton,
    };
};

/**
 * Add color to recent list (maintains last 10)
 */
export const addToRecentColors = (recentColors: string[], newColor: string): string[] => {
    const normalizedColor = newColor.startsWith('#') ? newColor : `#${newColor}`;

    // Remove if already exists
    const filtered = recentColors.filter(color => color !== normalizedColor);

    // Add to beginning
    const updated = [normalizedColor, ...filtered];

    // Keep only last 10
    return updated.slice(0, 10);
};

/**
 * Validate hex color
 */
export const isValidHexColor = (color: string): boolean => {
    const hexRegex = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
};

/**
 * Normalize hex color (ensure # prefix)
 */
export const normalizeHex = (color: string): string => {
    if (color.startsWith('#')) return color;
    return `#${color}`;
};