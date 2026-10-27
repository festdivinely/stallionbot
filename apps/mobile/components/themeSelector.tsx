// components/ThemeSelector.tsx - COMPLETE FILE (Fixed Keyboard Issue)
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  PanResponder,
  Animated,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/themeStore';
import AdvancedColorPicker from './advanceColorPicker';
import SimpleColorPicker from './simpleColorPicker';

const themes = ['retro', 'blossom', 'ocean', 'forest', 'dark', 'purple', 'custom'] as const;

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

export default function ThemeSelector() {
  const store = useThemeStore();

  const colors = store?.colors || DEFAULT_COLORS;
  const theme = store?.theme || 'retro';
  const primaryColor = store?.primaryColor || DEVELOPER_COLORS.retro;
  const recentColors = store?.recentColors || [];
  const setTheme = store?.setTheme || (() => { });
  const setCustomColor = store?.setCustomColor || (() => { });
  const addToRecentColors = store?.addToRecentColors || (() => { });

  const [showPresets, setShowPresets] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Dragging state
  const pan = useRef(new Animated.ValueXY({ x: 20, y: 60 })).current;

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const BUTTON_SIZE = 50;

  const STATUS_BAR_HEIGHT = 40;
  const NAVIGATION_BAR_HEIGHT = 60;
  const EDGE_PADDING = 5;

  // Safely track current pan position
  const position = useRef({ x: 20, y: 60 }).current;

  useEffect(() => {
    const id = pan.addListener((value) => {
      position.x = value.x;
      position.y = value.y;
    });

    return () => {
      pan.removeListener(id);
    };
  }, [pan]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,

      onPanResponderGrant: () => {
        setShowPresets(false);
        pan.setOffset({
          x: position.x,
          y: position.y,
        });
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: () => {
        pan.flattenOffset();

        const currentX = position.x;
        const currentY = position.y;

        const clampedX = Math.max(
          EDGE_PADDING,
          Math.min(currentX, screenWidth - BUTTON_SIZE - EDGE_PADDING)
        );
        const clampedY = Math.max(
          STATUS_BAR_HEIGHT,
          Math.min(currentY, screenHeight - NAVIGATION_BAR_HEIGHT - BUTTON_SIZE)
        );

        if (currentX !== clampedX || currentY !== clampedY) {
          Animated.spring(pan, {
            toValue: { x: clampedX, y: clampedY },
            useNativeDriver: false,
            friction: 8,
            tension: 40,
          }).start();
        }
      },

      onPanResponderTerminate: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const handleCirclePress = () => {
    setShowColorPicker(true);
    setShowPresets(false);
  };

  const handleThemeSelect = (selectedTheme: typeof themes[number]) => {
    if (selectedTheme === 'custom') {
      setShowPresets(false);
      setShowColorPicker(true);
    } else {
      setTheme(selectedTheme as any);
      setShowPresets(false);
      setShowColorPicker(false);
    }
  };

  const handleHexSubmit = () => {
    const trimmed = hexInput.trim();
    if (!trimmed) {
      setInputError('Please enter a color');
      return;
    }

    const testColor = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    if (!hexRegex.test(testColor)) {
      setInputError('Invalid hex color. Use format: RRGGBB or #RRGGBB');
      return;
    }

    setCustomColor(testColor);
    addToRecentColors(testColor);
    setHexInput('');
    setInputError('');
    setShowColorPicker(false);
  };

  const handleColorSelect = (color: string, isDeveloperColor: boolean = false) => {
    if (isDeveloperColor) {
      const themeKey = Object.entries(DEVELOPER_COLORS).find(
        ([, themeColor]) => themeColor === color
      )?.[0] as typeof themes[number];

      if (themeKey && themeKey !== 'custom') {
        setTheme(themeKey as any);
      }
    } else {
      setCustomColor(color);
      addToRecentColors(color);
    }
    setShowColorPicker(false);
  };

  const getThemeColor = (themeName: typeof themes[number]) => {
    if (themeName === 'custom') {
      return primaryColor;
    }
    return DEVELOPER_COLORS[themeName];
  };

  return (
    <>
      {/* Main Draggable Theme Selector */}
      <Animated.View
        style={[
          styles.draggableContainer,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={handleCirclePress}
          style={[
            styles.mainButton,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.primary,
              shadowColor: colors.textDark,
            },
          ]}
          activeOpacity={0.7}
          delayPressIn={0}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: getThemeColor(theme),
              borderWidth: 2,
              borderColor: colors.textDark,
            }}
          />
        </TouchableOpacity>

        {showPresets && (
          <View
            style={[
              styles.presetsContainer,
              {
                backgroundColor: colors.cardBackground,
                shadowColor: colors.textDark,
              },
            ]}
          >
            {themes.map((themeOption) => (
              <TouchableOpacity
                key={themeOption}
                onPress={() => handleThemeSelect(themeOption)}
                style={styles.themeOption}
                activeOpacity={0.6}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: getThemeColor(themeOption),
                    borderWidth: theme === themeOption ? 2 : 0,
                    borderColor: colors.textDark,
                  }}
                />
                {themeOption === 'custom' && (
                  <Text style={{ fontSize: 10, marginTop: 2, color: colors.textSecondary }}>
                    Custom
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Full Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowColorPicker(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={{ flex: 1, backgroundColor: colors.modalOverlay }}>
          <View style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: colors.modalOverlay
          }}>
            <View
              style={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                paddingTop: 20,
                backgroundColor: colors.cardBackground,
                maxHeight: screenHeight * 0.85,
              }}
            >
              <View style={styles.header}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.textPrimary }}>
                  Choose Theme Color
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowColorPicker(false);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Hex Input - Always visible */}
                <View style={styles.section}>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 15, color: colors.textPrimary }}>
                    Enter Hex Color
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', marginRight: 10, color: colors.textPrimary }}>#</Text>
                    <TextInput
                      style={{
                        flex: 1,
                        height: 50,
                        borderRadius: 10,
                        paddingHorizontal: 15,
                        fontSize: 16,
                        color: colors.textPrimary,
                        backgroundColor: colors.inputBackground,
                        borderColor: inputError ? colors.warning : colors.border,
                        borderWidth: 1,
                      }}
                      value={hexInput}
                      onChangeText={(text) => {
                        setHexInput(text);
                        setInputError('');
                      }}
                      placeholder="RRGGBB"
                      placeholderTextColor={colors.placeholderText}
                      maxLength={7}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      onSubmitEditing={handleHexSubmit}
                    />
                    <TouchableOpacity
                      style={{
                        marginLeft: 10,
                        paddingHorizontal: 20,
                        height: 50,
                        borderRadius: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: colors.primary,
                      }}
                      onPress={handleHexSubmit}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontWeight: '600', fontSize: 16, color: colors.white }}>
                        Apply
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {inputError && (
                    <Text style={{ marginTop: 5, fontSize: 12, color: colors.warning }}>
                      {inputError}
                    </Text>
                  )}
                </View>

                {/* Only show these sections when keyboard is NOT visible */}
                {!isKeyboardVisible && (
                  <>
                    {/* Preset Themes */}
                    <View style={styles.section}>
                      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 15, color: colors.textPrimary }}>
                        Preset Themes
                      </Text>
                      <View style={styles.colorGrid}>
                        {Object.entries(DEVELOPER_COLORS).map(([name, color]) => (
                          <TouchableOpacity
                            key={name}
                            style={styles.colorItem}
                            onPress={() => handleColorSelect(color, true)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={{
                                width: 60,
                                height: 60,
                                borderRadius: 10,
                                marginBottom: 8,
                                borderWidth: 2,
                                borderColor: '#fff',
                                elevation: 3,
                                backgroundColor: color,
                              }}
                            />
                            <Text style={{ fontSize: 12, marginBottom: 2, textAlign: 'center', color: colors.textSecondary }}>
                              {name.charAt(0).toUpperCase() + name.slice(1)}
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'monospace', color: colors.textSecondary }}>
                              {color}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Recent Colors */}
                    {recentColors.length > 0 && (
                      <View style={styles.section}>
                        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 15, color: colors.textPrimary }}>
                          Recent Colors ({recentColors.length})
                        </Text>
                        <View style={styles.recentGrid}>
                          {recentColors.slice(0, 10).map((color, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.recentColorButton}
                              onPress={() => handleColorSelect(color)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 8,
                                  marginBottom: 5,
                                  borderWidth: 2,
                                  borderColor: '#fff',
                                  elevation: 2,
                                  backgroundColor: color,
                                }}
                              />
                              <Text style={{ fontSize: 9, fontFamily: 'monospace', color: colors.textSecondary }}>
                                {color}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Basic Colors */}
                    <View style={styles.section}>
                      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 15, color: colors.textPrimary }}>
                        Color Picker
                      </Text>

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

              <TouchableOpacity
                style={{
                  marginHorizontal: 20,
                  marginBottom: 30,
                  paddingVertical: 15,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: colors.secondaryButton,
                }}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowColorPicker(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  draggableContainer: {
    position: 'absolute',
    zIndex: 1000,
  },
  mainButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  presetsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    borderRadius: 10,
    padding: 10,
    elevation: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    flexDirection: 'column',
    zIndex: 1001,
  },
  themeOption: {
    alignItems: 'center',
    marginVertical: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorItem: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 15,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recentColorButton: {
    width: '23%',
    alignItems: 'center',
    marginBottom: 15,
  },
  basicColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});