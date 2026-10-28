// Remembers where the user was, so the app reopens there when Android has closed it in the
// background (phones do this to save memory or battery; the app then starts from scratch).
//  - the screen (e.g. /deriv/options?split=1), saved on every screen change
//  - small per-screen choices, like the Options screen's market and trade type
// Only recent visits are restored: after a long time away the app starts at Home as usual.
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCREEN_KEY = 'lastScreen';
const RESTORE_WITHIN_MS = 2 * 60 * 60_000; // 2 hours

export interface SavedScreen {
    pathname: string;
    params: Record<string, string>;
    at: number;
}

export async function saveLastScreen(pathname: string, params: Record<string, string>): Promise<void> {
    try {
        await AsyncStorage.setItem(SCREEN_KEY, JSON.stringify({ pathname, params, at: Date.now() } satisfies SavedScreen));
    } catch {
        // Not being able to remember the screen only means starting at Home next time
    }
}

/** The screen to reopen, if the user was there recently. */
export async function loadLastScreen(): Promise<SavedScreen | null> {
    try {
        const raw = await AsyncStorage.getItem(SCREEN_KEY);
        const saved = raw ? (JSON.parse(raw) as SavedScreen) : null;
        return saved && Date.now() - saved.at < RESTORE_WITHIN_MS ? saved : null;
    } catch {
        return null;
    }
}

export async function clearLastScreen(): Promise<void> {
    await AsyncStorage.removeItem(SCREEN_KEY).catch(() => undefined);
}

/** A screen's own small choices (e.g. Options: market and trade type), stored as JSON. */
export async function saveScreenState(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(`screen:${key}`, JSON.stringify(value)).catch(() => undefined);
}

export async function loadScreenState<T>(key: string): Promise<T | null> {
    try {
        const raw = await AsyncStorage.getItem(`screen:${key}`);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}
