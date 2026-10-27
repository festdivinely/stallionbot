// Deriv options market data from our backend (server/src/market/catalog.ts), which reads it live
// from Deriv: the asset list, the trade types each asset allows, and price quotes.
import { useEffect, useState } from 'react';
import api from '../apis/authApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface Asset {
    symbol: string;
    name: string;
    pipSize: number;
    open: boolean;
    suspended: boolean;
}
export interface AssetGroup {
    id: string;
    label: string;
    assets: Asset[];
}
export interface AssetCategory {
    id: string;
    label: string;
    groups: AssetGroup[];
}

export type DurationUnit = 't' | 's' | 'm' | 'h' | 'd';
export interface DurationOption {
    unit: DurationUnit;
    min: number;
    max: number;
}
interface BarrierDefault {
    barrier?: string;
    high?: string;
    low?: string;
}
export interface TradeSide {
    contractType: string;
    label: string;
    equalsContractType?: string;
    lastDigits?: number[];
}
export interface TradeType {
    id: string;
    label: string;
    sides: TradeSide[];
    durations: DurationOption[];
    barriers: number;
    defaultBarriers: { tick?: BarrierDefault; intraday?: BarrierDefault; daily?: BarrierDefault };
    barrierChoices?: string[];
    multipliers?: number[];
    growthRates?: number[];
    cancellationOptions?: string[];
    payoutChoices?: number[];
    minStake?: number;
    maxStake?: number;
    defaultStake?: number;
}

export interface QuoteRequest {
    symbol: string;
    contractType: string;
    amount: number;
    duration?: number;
    durationUnit?: DurationUnit;
    barrier?: string;
    barrier2?: string;
    multiplier?: number;
    growthRate?: number;
    cancellation?: string;
    selectedTick?: number;
}
export interface Quote {
    ok: boolean;
    askPrice?: number;
    payout?: number;
    longcode?: string;
    spot?: number;
    message?: string;
}

type Load<T> = { data: T | null; loading: boolean; error: string | null; reload: () => void };

// The asset list rarely changes while the app is open: fetch it once and share it
let assetsCache: AssetCategory[] | null = null;

export function useAssets(): Load<AssetCategory[]> {
    const [data, setData] = useState<AssetCategory[] | null>(assetsCache);
    const [loading, setLoading] = useState(!assetsCache);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (assetsCache && attempt === 0) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/api/market/assets`)
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.message || 'Could not load markets');
                return body.categories as AssetCategory[];
            })
            .then((categories) => {
                assetsCache = categories;
                if (!cancelled) setData(categories);
            })
            .catch((e) => !cancelled && setError(e.message || 'Could not load markets'))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    return { data, loading, error, reload: () => setAttempt((a) => a + 1) };
}

/** Trade types Deriv offers for one asset; reloads whenever the asset changes. */
export function useTradeTypes(symbol: string | null): Load<TradeType[]> {
    const [data, setData] = useState<TradeType[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;
        setData(null);
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/api/market/assets/${encodeURIComponent(symbol)}/trade-types`)
            .then(async (res) => {
                const body = await res.json();
                if (!res.ok) throw new Error(body.message || 'Could not load trade types');
                return body.tradeTypes as TradeType[];
            })
            .then((types) => !cancelled && setData(types))
            .catch((e) => !cancelled && setError(e.message || 'Could not load trade types'))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [symbol, attempt]);

    return { data, loading, error, reload: () => setAttempt((a) => a + 1) };
}

/** Deriv's price for a trade with these settings, or Deriv's reason they aren't allowed. Never buys. */
export async function fetchQuote(req: QuoteRequest): Promise<Quote> {
    try {
        const { data } = await api.post('/api/market/quote', req);
        return data as Quote;
    } catch (e: any) {
        return { ok: false, message: e.response?.data?.message || 'Could not get a price right now' };
    }
}

/** Which of Deriv's default barriers applies for a duration unit. */
export const expiryKind = (unit: DurationUnit | undefined): 'tick' | 'intraday' | 'daily' =>
    unit === 't' ? 'tick' : unit === 'd' ? 'daily' : 'intraday';

export const UNIT_LABELS: Record<DurationUnit, string> = { t: 'Ticks', s: 'Seconds', m: 'Minutes', h: 'Hours', d: 'Days' };
