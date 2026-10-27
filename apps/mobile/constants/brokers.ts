// The brokers Stallion Trader works with. Add a broker here and it appears in the sidebar, on the
// home screen and on the welcome slides. `id` matches the bot templates' `platform` field on the
// server (see server/src/api/models/botTemplateModel.js).
import type { Ionicons } from '@expo/vector-icons';

export interface Broker {
    id: string;
    name: string;
    /** Short line under the name. */
    tagline: string;
    /** Letters shown in the broker's round badge (we don't ship other companies' logos). */
    initials: string;
    icon: keyof typeof Ionicons.glyphMap;
    /** 'available' opens the broker's screens; 'soon' is listed but not usable yet. */
    status: 'available' | 'soon';
    /** Screen that opens when the broker is picked. */
    route?: '/deriv';
}

export const BROKERS: Broker[] = [
    {
        id: 'deriv',
        name: 'Deriv',
        tagline: 'Synthetic indices, 24/7',
        initials: 'D',
        icon: 'pulse-outline',
        status: 'available',
        route: '/deriv',
    },
    {
        id: 'expert_option',
        name: 'ExpertOption',
        tagline: 'Coming soon',
        initials: 'EO',
        icon: 'stats-chart-outline',
        status: 'soon',
    },
];

/** Name for a broker id, including ids the app doesn't list yet ("iq_option" -> "Iq Option"). */
export const brokerName = (id: string) =>
    BROKERS.find((b) => b.id === id)?.name ??
    id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
