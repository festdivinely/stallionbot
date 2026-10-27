// In your settings component
import { useAuthStore } from '../../store/authStore';
import { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';

export default function SecuritySettings() {
    const { disableTOTP, user } = useAuthStore();
    const [password, setPassword] = useState('');
    const [isDisabling, setIsDisabling] = useState(false);

    const handleDisableTOTP = async () => {
        if (!password.trim()) {
            Alert.alert('Error', 'Please enter your password to disable TOTP');
            return;
        }

        setIsDisabling(true);
        try {
            const result = await disableTOTP(password);

            if (result.success) {
                Alert.alert('Success', result.message || 'Two-factor authentication has been disabled.');
                setPassword('');
                // TOTP state will be automatically updated in the store
            } else {
                Alert.alert('Error', result.message || 'Failed to disable TOTP.');
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred.');
        } finally {
            setIsDisabling(false);
        }
    };

    return (
        <View>
            <Text>Two-Factor Authentication: {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}</Text>

            {user?.twoFactorEnabled && (
                <View>
                    <TextInput
                        placeholder="Enter your password to disable TOTP"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                    <Button
                        title={isDisabling ? "Disabling..." : "Disable TOTP"}
                        onPress={handleDisableTOTP}
                        disabled={isDisabling || !password.trim()}
                    />
                </View>
            )}
        </View>
    );
}