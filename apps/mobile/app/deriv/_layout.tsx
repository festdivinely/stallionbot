// Screens for the Deriv broker: the hub (build a bot / trade manually), the bot builder and one
// screen per manual strategy. Login is checked in app/_layout.tsx.
import { Stack } from 'expo-router';

export default function DerivLayout() {
    return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />;
}
