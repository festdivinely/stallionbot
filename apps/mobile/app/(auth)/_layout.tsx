import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
            }}
        >
            <Stack.Screen
                name="index"
                options={{ title: 'Welcome' }}
            />
            <Stack.Screen
                name="signup"
                options={{ title: 'Sign Up' }}
            />
            <Stack.Screen
                name="verifyDevice"
                options={{ title: 'Verify Device' }}
            />
            <Stack.Screen
                name="resetPassword"
                options={{ title: 'Reset Password' }}
            />
            <Stack.Screen
                name="resetPasswordCode"
                options={{ title: 'Reset Password Code' }}
            />
            <Stack.Screen
                name="verifyEmail"
                options={{ title: 'Verify Email' }}
            />
            <Stack.Screen
                name="TOTPVerification"
                options={{ title: 'TOTP Verification' }}
            />
            <Stack.Screen
                name="TOTPSetup"
                options={{ title: 'TOTP Setup' }}
            />
        </Stack>
    );
}