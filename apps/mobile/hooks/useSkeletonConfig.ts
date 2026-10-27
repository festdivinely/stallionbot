// hooks/useSkeletonConfig.ts
import { useMemo } from 'react';
import { SkeletonLoaderProps } from '../types/skeleton.types';

export const useSkeletonConfig = (props: SkeletonLoaderProps) => {
    return useMemo(() => {
        const defaultConfig: Omit<SkeletonLoaderProps, 'type' | 'count' | 'customLayout'> = {
            animationType: 'shimmer',
            speed: 1000,
            backgroundColor: '#E1E9EE',
            highlightColor: '#F2F8FC',
            borderRadius: 8,
            spacing: 12,
            animated: true,
            direction: 'column',
            enableGradient: false,
            theme: 'light',
        };

        return {
            ...defaultConfig,
            ...props,
        };
    }, [props]);
};