import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "../store/themeStore";

export default function SafeScreen({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    const colors = useThemeStore((state) => state.colors);

    // Default background color if colors is undefined
    const backgroundColor = colors?.background || '#f5f5f5';

    return (
        <View style={[styles.container, {
            paddingTop: insets.top,
            backgroundColor
        }]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});