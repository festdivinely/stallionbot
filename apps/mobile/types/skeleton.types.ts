// types/skeleton.types.ts
export type SkeletonType = 'feed' | 'profile' | 'card' | 'list' | 'custom' | 'chat' | 'dashboard';
export type AnimationType = 'shimmer' | 'pulse' | 'wave' | 'none';

export interface SkeletonElementProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    circle?: boolean;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    style?: any;
}

export interface SkeletonLoaderProps {
    /** Type of skeleton layout */
    type?: SkeletonType;
    /** Number of items to show (for list/feed types) */
    count?: number;
    /** Custom skeleton structure */
    customLayout?: React.ReactNode;
    /** Animation type */
    animationType?: AnimationType;
    /** Animation speed in milliseconds */
    speed?: number;
    /** Base background color */
    backgroundColor?: string;
    /** Highlight/Shimmer color */
    highlightColor?: string;
    /** Width of the skeleton container */
    width?: number | string;
    /** Height of the skeleton container */
    height?: number | string;
    /** Border radius of skeleton elements */
    borderRadius?: number;
    /** Spacing between skeleton elements */
    spacing?: number;
    /** Whether to show animation */
    animated?: boolean;
    /** Direction for list items */
    direction?: 'row' | 'column';
    /** Enable gradient effect */
    enableGradient?: boolean;
    /** Gradient colors */
    gradientColors?: [string, string, string];
    /** Custom style for the container */
    style?: any;
    /** Theme of the skeleton */
    theme?: 'light' | 'dark' | 'auto';
}

export interface SkeletonContextType {
    config: Omit<SkeletonLoaderProps, 'type' | 'count' | 'customLayout'>;
}