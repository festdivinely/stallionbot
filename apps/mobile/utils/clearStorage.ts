// src/utils/clearStorage.js
const SecureStore = require('expo-secure-store');

(async () => {
    try {
        await Promise.all([
            SecureStore.deleteItemAsync('refreshToken'),
            SecureStore.deleteItemAsync('accessToken'),
            SecureStore.deleteItemAsync('deviceId'),
            SecureStore.deleteItemAsync('csrfToken'),
        ]);
        console.log('Auth storage cleared successfully');
    } catch (error) {
        console.error('Error clearing auth storage:', error);
    }
})();