// Colours for the welcome screen, taken straight from the user's current theme (themeStore),
// exactly like every other screen: no colours are invented here, so changing the theme with the
// theme selector changes this screen the same way it changes the rest of the app.

interface ThemeColors {
    background: string;
    cardBackground: string;
    border: string;
    primary: string;
    textPrimary: string;
    textSecondary: string;
    inputBackground: string;
    white: string;
}

/** `hex` at the given opacity (0-1), as an 8-digit hex colour. Used for light tints of theme colours. */
export const withAlpha = (hex: string, alpha: number) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return `#${h.slice(0, 6)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
};

// Price up/down colours stay green/red in every theme: traders read them as meaning, not decoration
export const PRICE_UP = '#16A34A';
export const PRICE_DOWN = '#DC2626';

export function getWelcomePalette(colors: ThemeColors) {
    return {
        background: colors.background,
        card: colors.cardBackground,
        cardBorder: colors.border,
        accent: colors.primary,
        accentSoft: colors.inputBackground,
        text: colors.textPrimary,
        textMuted: colors.textSecondary,
        dot: colors.border,
        onAccent: colors.white,
    };
}

export type WelcomePalette = ReturnType<typeof getWelcomePalette>;
