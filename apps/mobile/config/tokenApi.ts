import * as SecureStore from 'expo-secure-store';

// ========== TOKEN MANAGEMENT ==========

/**
 * Save refresh token to secure storage
 */
export const saveRefreshToken = async (token: string): Promise<boolean> => {
    try {
        if (!token || token.length < 10) {
            console.error('Invalid refresh token');
            return false;
        }

        await SecureStore.setItemAsync('refresh_token', token);
        console.log('Refresh token saved');
        return true;
    } catch (error: any) {
        console.error('Failed to save refresh token:', error.message);
        return false;
    }
};

/**
 * Load refresh token from secure storage
 */
export const loadRefreshToken = async (): Promise<string | null> => {
    try {
        const token = await SecureStore.getItemAsync('refresh_token');

        if (!token) {
            console.log('No refresh token found');
            return null;
        }

        return token;
    } catch (error: any) {
        console.error('Failed to load refresh token:', error.message);
        return null;
    }
};

/**
 * Delete refresh token from secure storage
 */
export const deleteRefreshToken = async (): Promise<boolean> => {
    try {
        await SecureStore.deleteItemAsync('refresh_token');
        console.log('Refresh token deleted');
        return true;
    } catch (error: any) {
        console.error('Failed to delete refresh token:', error.message);
        return false;
    }
};

// ========== ACCESS TOKEN MANAGEMENT ==========

export const saveAccessToken = async (token: string): Promise<boolean> => {
    try {
        if (!token || token.length < 10) {
            console.error('Invalid access token');
            return false;
        }

        await SecureStore.setItemAsync('access_token', token);
        console.log('Access token saved');
        return true;
    } catch (error: any) {
        console.error('Failed to save access token:', error.message);
        return false;
    }
};

export const loadAccessToken = async (): Promise<string | null> => {
    try {
        const token = await SecureStore.getItemAsync('access_token');
        return token;
    } catch (error: any) {
        console.error('Failed to load access token:', error.message);
        return null;
    }
};

export const deleteAccessToken = async (): Promise<boolean> => {
    try {
        await SecureStore.deleteItemAsync('access_token');
        return true;
    } catch (error: any) {
        console.error('Failed to delete access token:', error.message);
        return false;
    }
};

// ========== DEVICE ID MANAGEMENT ==========

export const saveDeviceId = async (deviceId: string): Promise<boolean> => {
    try {
        await SecureStore.setItemAsync('device_id', deviceId);
        return true;
    } catch (error: any) {
        console.error('Failed to save device ID:', error.message);
        return false;
    }
};

export const loadDeviceId = async (): Promise<string | null> => {
    try {
        const deviceId = await SecureStore.getItemAsync('device_id');
        return deviceId;
    } catch (error: any) {
        console.error('Failed to load device ID:', error.message);
        return null;
    }
};

export const deleteDeviceId = async (): Promise<boolean> => {
    try {
        await SecureStore.deleteItemAsync('device_id');
        return true;
    } catch (error: any) {
        console.error('Failed to delete device ID:', error.message);
        return false;
    }
};

// ========== COMPREHENSIVE FUNCTIONS ==========

export const saveAllTokens = async (
    refreshToken: string,
    accessToken: string,
    deviceId: string
): Promise<boolean> => {
    try {
        await Promise.all([
            saveRefreshToken(refreshToken),
            saveAccessToken(accessToken),
            saveDeviceId(deviceId)
        ]);
        return true;
    } catch (error: any) {
        console.error('Failed to save all tokens:', error.message);
        return false;
    }
};

export const loadAllTokens = async () => {
    try {
        const [refreshToken, accessToken, deviceId] = await Promise.all([
            loadRefreshToken(),
            loadAccessToken(),
            loadDeviceId()
        ]);
        return { refreshToken, accessToken, deviceId };
    } catch (error: any) {
        console.error('Failed to load all tokens:', error.message);
        return { refreshToken: null, accessToken: null, deviceId: null };
    }
};

export const deleteAllTokens = async (): Promise<boolean> => {
    try {
        await Promise.all([
            deleteRefreshToken(),
            deleteAccessToken(),
            deleteDeviceId()
        ]);
        console.log('All tokens deleted');
        return true;
    } catch (error: any) {
        console.error('Failed to delete all tokens:', error.message);
        return false;
    }
};

export const hasValidTokens = async (): Promise<boolean> => {
    try {
        const { refreshToken, accessToken } = await loadAllTokens();
        return !!(refreshToken && accessToken);
    } catch (error: any) {
        console.error('Failed to validate tokens:', error.message);
        return false;
    }
};