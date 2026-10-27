// The logged-in user's profile picture, used everywhere it appears (sidebar, settings...).
// Shows the uploaded photo, or a generated DiceBear avatar (an SVG) until one is uploaded.
// expo-image is used because React Native's own Image can't display SVGs.
import React from 'react';
import { type StyleProp, type ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { useAuthStore } from '../store/authStore';

export function avatarUrl(user: { profileImage?: string; username?: string; email?: string } | null | undefined) {
    if (user?.profileImage) return user.profileImage;
    const seed = encodeURIComponent(user?.username || user?.email || 'user');
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
}

interface Props {
    size: number;
    borderColor?: string;
    backgroundColor?: string;
    borderWidth?: number;
    style?: StyleProp<ImageStyle>;
}

export default function UserAvatar({ size, borderColor, backgroundColor, borderWidth = 2, style }: Props) {
    const user = useAuthStore((s) => s.user);
    return (
        <Image
            source={{ uri: avatarUrl(user) }}
            style={[
                { width: size, height: size, borderRadius: size / 2, borderWidth: borderColor ? borderWidth : 0, borderColor, backgroundColor },
                style,
            ]}
            contentFit="cover"
            transition={200}
            accessibilityLabel="Profile picture"
        />
    );
}
