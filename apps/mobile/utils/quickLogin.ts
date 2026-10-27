// Fingerprint login: after a normal login the user can choose to save their email/username and
// password on the phone, locked behind their fingerprint (Android Keystore / iOS Keychain with
// requireAuthentication: the system itself refuses to hand them over without a fingerprint).
// Logging out keeps them, so the next login is one touch. Nothing is sent anywhere but our server.
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const CREDENTIALS_KEY = 'quickLoginCredentials'; // fingerprint-locked
const ACCOUNT_KEY = 'quickLoginAccount'; // just the account name, to show "Log in as ..."
const DECLINED_KEY = 'quickLoginDeclined'; // user said "Not now": don't ask after every login

export interface QuickLoginCredentials {
    usernameOrEmail: string;
    password: string;
}

/** True when the phone has a fingerprint (or face) sensor AND at least one is enrolled. */
export async function canUseBiometrics(): Promise<boolean> {
    try {
        return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    } catch {
        return false;
    }
}

/** The saved account name, or null when fingerprint login is off. */
export async function getQuickLoginAccount(): Promise<string | null> {
    try {
        return await SecureStore.getItemAsync(ACCOUNT_KEY);
    } catch {
        return null;
    }
}

/** Whether to offer fingerprint login after a password login. */
export async function shouldOfferQuickLogin(): Promise<boolean> {
    if (!(await canUseBiometrics())) return false;
    if (await getQuickLoginAccount()) return false;
    return !(await SecureStore.getItemAsync(DECLINED_KEY).catch(() => null));
}

export async function declineQuickLogin(): Promise<void> {
    await SecureStore.setItemAsync(DECLINED_KEY, '1').catch(() => {});
}

/** Undo "Not now": offer fingerprint login again at the next password login. */
export async function allowQuickLoginOffer(): Promise<void> {
    await SecureStore.deleteItemAsync(DECLINED_KEY).catch(() => {});
}

/** Saves the login behind the fingerprint. Android asks for a fingerprint to confirm. */
export async function enableQuickLogin(creds: QuickLoginCredentials): Promise<boolean> {
    try {
        await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(creds), {
            requireAuthentication: true,
            authenticationPrompt: 'Confirm with your fingerprint to turn on fingerprint login',
        });
        await SecureStore.setItemAsync(ACCOUNT_KEY, creds.usernameOrEmail);
        await SecureStore.deleteItemAsync(DECLINED_KEY).catch(() => {});
        return true;
    } catch (e) {
        // Cancelled, or the sensor failed: leave it off
        console.warn('quickLogin: could not save', (e as Error).message);
        return false;
    }
}

/**
 * Asks for the fingerprint and returns the saved login, or null if the user cancelled.
 * If the saved login can no longer be opened (e.g. fingerprints were changed, which makes Android
 * retire the key), fingerprint login is switched off and 'reset' is returned.
 */
export async function readQuickLogin(): Promise<QuickLoginCredentials | null | 'reset'> {
    try {
        const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
            requireAuthentication: true,
            authenticationPrompt: 'Log in to Stallion Trader',
        });
        if (!raw) {
            await disableQuickLogin();
            return 'reset';
        }
        return JSON.parse(raw) as QuickLoginCredentials;
    } catch (e) {
        const message = (e as Error).message ?? '';
        // The user pressed Cancel / backed out of the fingerprint prompt
        if (/cancel/i.test(message)) return null;
        console.warn('quickLogin: could not read, switching it off', message);
        await disableQuickLogin();
        return 'reset';
    }
}

// ---------- Remember me ----------
// Only the email/username is remembered (pre-filled on the login screen), never the password:
// the password is covered by fingerprint login above and by Android's own password manager.
const REMEMBERED_KEY = 'rememberedAccount';

export async function getRememberedAccount(): Promise<string | null> {
    return SecureStore.getItemAsync(REMEMBERED_KEY).catch(() => null);
}

export async function setRememberedAccount(account: string | null): Promise<void> {
    await (account ? SecureStore.setItemAsync(REMEMBERED_KEY, account) : SecureStore.deleteItemAsync(REMEMBERED_KEY)).catch(() => {});
}

export async function disableQuickLogin(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(() => {}),
        SecureStore.deleteItemAsync(ACCOUNT_KEY).catch(() => {}),
    ]);
}
