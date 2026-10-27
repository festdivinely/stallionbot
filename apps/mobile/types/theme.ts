// types/theme.ts
export interface Colors {
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
}

// Developer preset themes (your original themes)
export type DeveloperTheme = 'retro' | 'blossom' | 'ocean' | 'forest' | 'dark' | 'purple';

// User custom themes (dynamic)
export interface UserCustomTheme {
    id: string;
    name: string;
    primaryColor: string;
    createdAt: string;
    lastUsed: string;
}

export interface ThemeState {
    // Current active theme data
    primaryColor: string;
    colors: Colors;

    // Current selection type
    selectedThemeType: 'developer' | 'custom' | 'recent';
    selectedDeveloperTheme?: DeveloperTheme;
    selectedCustomThemeId?: string;

    // UI mode
    isDarkMode: boolean;

    // Recent colors (last 10)
    recentColors: string[]; // Array of hex colors

    // User saved custom themes
    customThemes: UserCustomTheme[];
}

export interface ThemeContextType {
    // Current theme state
    theme: ThemeState;

    // Actions
    selectDeveloperTheme: (theme: DeveloperTheme) => void;
    selectCustomColor: (hexColor: string, saveToRecent?: boolean) => void;
    saveCustomTheme: (name: string, hexColor: string) => Promise<string>;
    deleteCustomTheme: (themeId: string) => Promise<void>;
    toggleDarkMode: () => void;

    // Getters
    getDeveloperThemes: () => Record<DeveloperTheme, Colors>;
    getRecentColors: () => string[];
    getCustomThemes: () => UserCustomTheme[];

    // Color utilities
    generateThemeFromColor: (hexColor: string) => Colors;
}