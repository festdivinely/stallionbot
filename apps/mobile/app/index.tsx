import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';
import ThemeSelector from '../components/themeSelector';
import createStyles from '../assets/styles/landing.styles';
import ThemeStatusBar from '../components/themeStatusBar';
import RobotIllustration from '../components/robotFace';

const LandingPage: React.FC = () => {
  const colors = useThemeStore((state) => state.colors);
  const styles = createStyles(colors);
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <ThemeStatusBar />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <RobotIllustration
              width={300}
              height={300}
            />
          </View>
          <Text style={styles.title}>Quantum Robots</Text>
          <Text style={styles.subtitle}>
            Efficient Trading At Its Best
          </Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => router.push('/(auth)')}
          >
            <Ionicons name="log-in-outline" size={20} color={colors.white} style={styles.buttonIcon} />
            <Text style={[styles.buttonText, { color: colors.white }]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, {
              backgroundColor: colors.cardBackground,
              borderColor: colors.primary
            }]}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Ionicons name="person-add-outline" size={20} color={colors.primary} style={styles.buttonIcon} />
            <Text style={[styles.buttonText, { color: colors.primary }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>
        <ThemeSelector />
      </View>
    </View>
  );
};

export default LandingPage;