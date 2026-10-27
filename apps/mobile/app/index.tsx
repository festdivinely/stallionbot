// app/index.tsx - the welcome screen (first thing a logged-out user sees).
// Live market slide + two info slides; all colours follow the user's theme.
// The palette button (theme colours) lives in the slides' top bar.
import React from 'react';
import { useThemeStore } from '../store/themeStore';
import WelcomeSlides from '../components/welcome/WelcomeSlides';
import { getWelcomePalette } from '../components/welcome/welcomePalette';

const WelcomeScreen: React.FC = () => {
  const colors = useThemeStore((state) => state.colors);
  return <WelcomeSlides palette={getWelcomePalette(colors)} />;
};

export default WelcomeScreen;
