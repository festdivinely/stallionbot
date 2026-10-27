// Ready-made strategies for trading manually on Deriv. Each one has a `layout`, which picks the
// screen design in app/deriv/strategy/[id].tsx:
//   'trend'  -> big price chart, ups vs downs
//   'digits' -> last-digit statistics grid (digit contracts settle on the price's last digit)
import type { Ionicons } from '@expo/vector-icons';

export type StrategyLayout = 'trend' | 'digits';

export interface DerivStrategy {
    id: string;
    name: string;
    summary: string;
    /** Longer explanation shown at the top of the strategy screen. */
    howItWorks: string;
    icon: keyof typeof Ionicons.glyphMap;
    layout: StrategyLayout;
    /** The two sides the user picks between. */
    sides: [string, string];
    /** Does the user also pick a digit (barrier / prediction)? */
    needsDigit?: boolean;
    risk: 'Lower' | 'Medium' | 'Higher';
}

export const DERIV_STRATEGIES: DerivStrategy[] = [
    {
        id: 'rise-fall',
        name: 'Rise / Fall',
        summary: 'Follow the trend over a few ticks',
        howItWorks: 'Predict whether the price after your chosen number of ticks will be higher (Rise) or lower (Fall) than the entry price.',
        icon: 'trending-up-outline',
        layout: 'trend',
        sides: ['Rise', 'Fall'],
        risk: 'Medium',
    },
    {
        id: 'even-odd',
        name: 'Even / Odd',
        summary: 'Read the last-digit pattern',
        howItWorks: 'Predict whether the last digit of the final tick will be even (0, 2, 4, 6, 8) or odd (1, 3, 5, 7, 9).',
        icon: 'git-compare-outline',
        layout: 'digits',
        sides: ['Even', 'Odd'],
        risk: 'Medium',
    },
    {
        id: 'over-under',
        name: 'Over / Under',
        summary: 'Last digit above or below a barrier',
        howItWorks: 'Pick a barrier digit, then predict whether the last digit of the final tick will be over or under it.',
        icon: 'swap-vertical-outline',
        layout: 'digits',
        sides: ['Over', 'Under'],
        needsDigit: true,
        risk: 'Medium',
    },
    {
        id: 'matches-differs',
        name: 'Matches / Differs',
        summary: 'Hit or avoid one exact digit',
        howItWorks: 'Pick a digit, then predict whether the last digit of the final tick will match it exactly or be any other digit.',
        icon: 'locate-outline',
        layout: 'digits',
        sides: ['Matches', 'Differs'],
        needsDigit: true,
        risk: 'Higher',
    },
];

export const findStrategy = (id: string) => DERIV_STRATEGIES.find((s) => s.id === id);
