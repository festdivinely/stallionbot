// Line chart of recent prices with a soft fill underneath; green when the price is up over the
// window, red when it is down. Stretches to the width of its parent.
import React from 'react';
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg';
import { PRICE_DOWN, PRICE_UP } from './welcome/welcomePalette';

const W = 300;

export default function PriceChart({ quotes, height = 120 }: { quotes: number[]; height?: number }) {
    if (quotes.length < 2) return <Svg width="100%" height={height} />;

    const min = Math.min(...quotes);
    const max = Math.max(...quotes);
    const range = max - min || 1;
    const step = W / (quotes.length - 1);
    // SVG y grows downwards, so the highest price gets the smallest y
    const xy = quotes.map((q, i) => [i * step, height - 4 - ((q - min) / range) * (height - 8)] as const);
    const points = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const color = quotes[quotes.length - 1] >= quotes[0] ? PRICE_UP : PRICE_DOWN;
    const [lastX, lastY] = xy[xy.length - 1];

    return (
        <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
            <Polygon points={`0,${height} ${points} ${W},${height}`} fill={color} fillOpacity={0.12} />
            <Polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
            <Circle cx={lastX} cy={lastY} r={3.5} fill={color} />
        </Svg>
    );
}
