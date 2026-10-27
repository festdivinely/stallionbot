// A scrolling screen container that keeps the text box you are typing in well above the keyboard,
// and keeps content clear of the bottom navigation bar. Use it instead of KeyboardAvoidingView.
//
// How: we read the keyboard's real size from the keyboard events, add that much room at the bottom
// of the scroll content, then measure the focused box on screen and scroll until it sits
// KEYBOARD_GAP pixels above the keyboard. (KeyboardAvoidingView guesses the overlap, and on Android
// with edge-to-edge it often moves the screen only part of the way.)
import React, { useEffect, useRef, useState } from 'react';
import {
    Keyboard,
    Platform,
    ScrollView,
    TextInput,
    type KeyboardEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Space between the bottom of the focused box and the top of the keyboard
const KEYBOARD_GAP = 100;

interface Props {
    children: React.ReactNode;
    contentContainerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
}

export default function KeyboardSafeScroll({ children, contentContainerStyle, style }: Props) {
    const insets = useSafeAreaInsets();
    const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const scrollY = useRef(0);
    const keyboardTop = useRef<number | null>(null);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Scroll so the focused box sits KEYBOARD_GAP above the keyboard (never scrolls down)
    const ensureFocusedVisible = () => {
        const input = TextInput.State.currentlyFocusedInput();
        const top = keyboardTop.current;
        if (!input || top === null || !scrollRef.current) return;
        input.measureInWindow((_x, y, _w, h) => {
            const overlap = y + h + KEYBOARD_GAP - top;
            if (overlap > 0) {
                scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
            }
        });
    };

    useEffect(() => {
        // iOS reports the keyboard before it animates in; Android only after it is shown
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            keyboardTop.current = e.endCoordinates.screenY;
            setKeyboardHeight(e.endCoordinates.height);
            // Wait a moment so the extra bottom room exists before scrolling into it
            setTimeout(ensureFocusedVisible, Platform.OS === 'ios' ? 250 : 60);
        };
        const onHide = () => {
            keyboardTop.current = null;
            setKeyboardHeight(0);
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    return (
        <ScrollView
            ref={scrollRef}
            style={[{ flex: 1 }, style]}
            contentContainerStyle={[
                { flexGrow: 1 },
                contentContainerStyle,
                // Room for the keyboard while it's open; otherwise stay clear of the navigation bar
                { paddingBottom: keyboardHeight > 0 ? keyboardHeight + KEYBOARD_GAP : insets.bottom + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
            // Tapping another box while the keyboard is open: bring that one up too
            onTouchEnd={() => { if (keyboardTop.current !== null) setTimeout(ensureFocusedVisible, 300); }}
        >
            {children}
        </ScrollView>
    );
}
