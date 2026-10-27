// components/ThemeSelector.tsx - palette button that opens the theme colour picker.
// `draggable`: floats above the app and can be dragged anywhere on the visible screen
// (the root layout renders one of these for every screen). Otherwise it sits wherever `style` puts it.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Text,
  Modal,
  TextInput,
  ScrollView,
  Keyboard,
  Animated,
  PanResponder,
  Platform,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../store/themeStore';
import { FONTS } from '../constants/fonts';
import SimpleColorPicker from './simpleColorPicker';

const BUTTON_SIZE = 38;
const EDGE_GAP = 8;
const POSITION_KEY = 'paletteButtonPosition';
// Finger movement (px) before a touch counts as a drag instead of a tap
const DRAG_THRESHOLD = 4;

/** Wraps the button so it can be dragged; keeps it inside the visible screen and remembers where it was left. */
function DraggableWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // The allowed area: between the status bar and the bottom navigation bar, away from the edges
  const bounds = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  bounds.current = {
    minX: EDGE_GAP,
    maxX: width - BUTTON_SIZE - EDGE_GAP,
    minY: insets.top + EDGE_GAP,
    maxY: height - insets.bottom - BUTTON_SIZE - EDGE_GAP,
  };
  const clampPos = (x: number, y: number) => ({
    x: Math.min(Math.max(x, bounds.current.minX), bounds.current.maxX),
    y: Math.min(Math.max(y, bounds.current.minY), bounds.current.maxY),
  });

  // Starts at the top-right, under the screen's own top bar
  const start = clampPos(width - BUTTON_SIZE - 16, insets.top + 64);
  const pos = useRef(new Animated.ValueXY(start)).current;
  const current = useRef(start);

  useEffect(() => {
    const id = pos.addListener((v) => { current.current = v; });
    // Put it back where the user left it last time
    AsyncStorage.getItem(POSITION_KEY)
      .then((saved) => {
        if (!saved) return;
        const { x, y } = JSON.parse(saved);
        pos.setValue(clampPos(x, y));
      })
      .catch(() => {});
    return () => pos.removeListener(id);
  }, []);

  // If the screen size changes (e.g. rotation), pull the button back inside
  useEffect(() => {
    pos.setValue(clampPos(current.current.x, current.current.y));
  }, [width, height, insets.top, insets.bottom]);

  const isDrag = (_: unknown, g: { dx: number; dy: number }) =>
    Math.abs(g.dx) > DRAG_THRESHOLD || Math.abs(g.dy) > DRAG_THRESHOLD;

  const panResponder = useRef(
    PanResponder.create({
      // Taps go to the button inside; only a real movement turns into a drag
      onMoveShouldSetPanResponder: isDrag,
      onMoveShouldSetPanResponderCapture: isDrag,
      onPanResponderGrant: () => {
        pos.setOffset(current.current);
        pos.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pos.flattenOffset();
        const target = clampPos(current.current.x, current.current.y);
        Animated.spring(pos, { toValue: target, useNativeDriver: false, friction: 7, tension: 60 }).start();
        AsyncStorage.setItem(POSITION_KEY, JSON.stringify(target)).catch(() => {});
      },
      onPanResponderTerminate: () => pos.flattenOffset(),
    })
  ).current;

  return (
    <Animated.View
      style={[styles.floating, { transform: pos.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const DEVELOPER_COLORS = {
  retro: '#e17055',
  blossom: '#EC407A',
  ocean: '#1976D2',
  forest: '#4CAF50',
  dark: '#B8860B',
  purple: '#AB47BC',
};

const DEFAULT_COLORS = {
  background: '#f5f5f5',
  cardBackground: '#fff',
  border: '#ccc',
  primary: '#e17055',
  statusBar: '#e17055',
  textPrimary: '#333',
  textSecondary: '#666',
  textDark: '#000',
  black: '#000',
  white: '#fff',
  inputBackground: '#f0f0f0',
  placeholderText: '#666',
  warning: '#d63031',
  secondary: '#f0a500',
  success: '#00b894',
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  secondaryButton: '#f0f0f0',
};

const HEX_PATTERN = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ThemeSelector({ style, draggable = false }: { style?: StyleProp<ViewStyle>; draggable?: boolean }) {
  const store = useThemeStore();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const colors = store?.colors || DEFAULT_COLORS;
  const theme = store?.theme || 'retro';
  const primaryColor = store?.primaryColor || DEVELOPER_COLORS.retro;
  const recentColors = store?.recentColors || [];
  const setTheme = store?.setTheme || (() => { });
  const setCustomColor = store?.setCustomColor || (() => { });
  const addToRecentColors = store?.addToRecentColors || (() => { });

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const close = () => {
    Keyboard.dismiss();
    setShowColorPicker(false);
    setHexInput('');
    setInputError('');
  };

  // What the user typed, as a colour (or null while it isn't a valid hex code yet)
  const typedHex = hexInput.trim() ? (hexInput.trim().startsWith('#') ? hexInput.trim() : `#${hexInput.trim()}`) : '';
  const typedColor = HEX_PATTERN.test(typedHex) ? typedHex : null;

  const handleHexSubmit = () => {
    if (!hexInput.trim()) {
      setInputError('Enter a colour code, like E17055');
      return;
    }
    if (!typedColor) {
      setInputError('Use 6 characters (0-9, A-F), like E17055');
      return;
    }
    setCustomColor(typedColor);
    addToRecentColors(typedColor);
    close();
  };

  const selectPreset = (name: string) => {
    setTheme(name as any);
    close();
  };

  const selectColor = (color: string) => {
    setCustomColor(color);
    addToRecentColors(color);
    close();
  };

  const currentLabel = theme === 'custom' ? `Custom · ${primaryColor.toUpperCase()}` : capitalize(theme);

  // Palette button: opens the colour picker below
  const button = (
    <TouchableOpacity
      onPress={() => setShowColorPicker(true)}
      style={[
        styles.paletteButton,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.border,
          shadowColor: colors.textDark,
        },
        style,
      ]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Change app colours"
    >
      <Ionicons name="color-palette-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <>
      {draggable ? <DraggableWrapper>{button}</DraggableWrapper> : button}

      <Modal visible={showColorPicker} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
        <View
          style={[
            styles.overlay,
            { backgroundColor: colors.modalOverlay },
            // Android already moves the modal window above the keyboard by itself; lifting it here
            // too pushed the sheet off the top of the screen. iOS doesn't, so only lift there.
            Platform.OS === 'ios' && { paddingBottom: keyboardHeight },
          ]}
        >
          {/* Tap the dimmed area above the sheet to close */}
          <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close colour picker" />

          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.cardBackground,
                maxHeight: screenHeight * 0.88,
                paddingBottom: isKeyboardVisible ? 16 : insets.bottom + 16,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.headerIcon, { backgroundColor: colors.inputBackground }]}>
                <Ionicons name="color-palette" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Theme colours</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Pick a preset or make your own</Text>
              </View>
              <TouchableOpacity
                onPress={close}
                style={[styles.closeButton, { backgroundColor: colors.inputBackground }]}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Live preview of the current theme (hidden while typing, to keep the sheet small) */}
              {!isKeyboardVisible && (
                <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[styles.previewCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <View style={[styles.previewDot, { backgroundColor: colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>Your theme</Text>
                      <Text style={[styles.previewText, { color: colors.textSecondary }]}>{currentLabel}</Text>
                    </View>
                    <View style={[styles.previewButton, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.previewButtonText, { color: colors.white }]}>Button</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Custom hex colour: always visible, it's what the keyboard is for */}
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Custom colour</Text>
              <View style={styles.hexRow}>
                <View
                  style={[
                    styles.hexField,
                    { backgroundColor: colors.inputBackground, borderColor: inputError ? colors.warning : colors.border },
                  ]}
                >
                  {/* Shows the typed colour as soon as it's a valid code */}
                  <View
                    style={[
                      styles.hexSwatch,
                      { backgroundColor: typedColor || 'transparent', borderColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.hexHash, { color: colors.textSecondary }]}>#</Text>
                  <TextInput
                    style={[styles.hexInput, { color: colors.textPrimary }]}
                    value={hexInput.replace(/^#/, '')}
                    onChangeText={(text) => {
                      setHexInput(text.replace(/[^0-9A-Fa-f]/g, '').toUpperCase());
                      setInputError('');
                    }}
                    placeholder="E17055"
                    placeholderTextColor={colors.placeholderText}
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleHexSubmit}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: colors.primary }]}
                  onPress={handleHexSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.applyText, { color: colors.white }]}>Apply</Text>
                </TouchableOpacity>
              </View>
              {!!inputError && <Text style={[styles.error, { color: colors.warning }]}>{inputError}</Text>}

              {!isKeyboardVisible && (
                <>
                  {/* Presets */}
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Presets</Text>
                  <View style={styles.presetGrid}>
                    {Object.entries(DEVELOPER_COLORS).map(([name, color]) => {
                      const active = theme === name;
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[
                            styles.presetCard,
                            {
                              backgroundColor: colors.background,
                              borderColor: active ? colors.primary : colors.border,
                              borderWidth: active ? 2 : 1,
                            },
                          ]}
                          onPress={() => selectPreset(name)}
                          activeOpacity={0.75}
                          accessibilityLabel={`${capitalize(name)} theme`}
                        >
                          <View style={[styles.presetSwatch, { backgroundColor: color }]}>
                            {active && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                          </View>
                          <Text style={[styles.presetName, { color: colors.textPrimary }]}>{capitalize(name)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Recent custom colours */}
                  {recentColors.length > 0 && (
                    <>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                        {recentColors.slice(0, 10).map((color) => {
                          const active = theme === 'custom' && primaryColor.toUpperCase() === color.toUpperCase();
                          return (
                            <TouchableOpacity
                              key={color}
                              onPress={() => selectColor(color)}
                              activeOpacity={0.75}
                              style={[styles.recentRing, { borderColor: active ? colors.primary : 'transparent' }]}
                              accessibilityLabel={`Use ${color}`}
                            >
                              <View style={[styles.recentSwatch, { backgroundColor: color }]} />
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  )}

                  {/* Free picker */}
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pick any colour</Text>
                  <View style={styles.pickerWrap}>
                    <SimpleColorPicker
                      initialColor={primaryColor}
                      onColorChange={(color) => {
                        setCustomColor(color);
                        addToRecentColors(color);
                      }}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.doneButton, { backgroundColor: colors.primary }]} onPress={close} activeOpacity={0.85}>
              <Text style={[styles.doneText, { color: colors.white }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floating: {
    // top/left = 0 so the drag position is measured from the screen's top-left corner
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    elevation: 10,
  },
  paletteButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.semibold, fontSize: 18 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 13, marginTop: 1 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  preview: { borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 4 },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  previewDot: { width: 34, height: 34, borderRadius: 17 },
  previewTitle: { fontFamily: FONTS.semibold, fontSize: 14 },
  previewText: { fontFamily: FONTS.regular, fontSize: 12 },
  previewButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  previewButtonText: { fontFamily: FONTS.semibold, fontSize: 12 },
  sectionTitle: { fontFamily: FONTS.semibold, fontSize: 14, marginTop: 18, marginBottom: 10 },
  hexRow: { flexDirection: 'row', gap: 10 },
  hexField: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, height: 52 },
  hexSwatch: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, marginRight: 10 },
  hexHash: { fontFamily: FONTS.medium, fontSize: 16, marginRight: 2 },
  hexInput: { flex: 1, fontFamily: FONTS.medium, fontSize: 16, letterSpacing: 1.5, paddingVertical: 0 },
  applyButton: { borderRadius: 14, paddingHorizontal: 20, justifyContent: 'center' },
  applyText: { fontFamily: FONTS.semibold, fontSize: 15 },
  error: { fontFamily: FONTS.regular, fontSize: 12, marginTop: 6 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  presetCard: { width: '31.5%', alignItems: 'center', borderRadius: 16, paddingVertical: 12, gap: 8 },
  presetSwatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  presetName: { fontFamily: FONTS.medium, fontSize: 13 },
  recentRow: { gap: 8, paddingRight: 8 },
  recentRing: { padding: 3, borderRadius: 24, borderWidth: 2 },
  recentSwatch: { width: 36, height: 36, borderRadius: 18 },
  pickerWrap: { marginBottom: 4 },
  doneButton: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  doneText: { fontFamily: FONTS.semibold, fontSize: 16 },
});
