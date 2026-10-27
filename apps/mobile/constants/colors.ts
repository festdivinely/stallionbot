// constants/colors.ts - NO CHANGES NEEDED, keep it exactly as you have it
export type Theme = "retro" | "blossom" | "ocean" | "forest" | "dark" | "purple";

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

export const THEME_COLORS: Record<Theme, Colors> = {
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
  },
} as const;