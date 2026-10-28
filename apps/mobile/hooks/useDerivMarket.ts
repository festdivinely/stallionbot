// Deriv options market data from our backend (server/src/market/catalog.ts), which reads it live
// from Deriv: the asset list, the trade types each asset allows, and price quotes.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import api from '../apis/authApi';
import type { AccountMode } from '../store/accountStore';
import type { StrategySummary } from './useSplitMoney';

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
    /** "End time" instead of a duration (epoch seconds) */
    dateExpiry?: number;
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

// ---------- Trading (demo account; the server runs every buy through its risk checks) ----------

export interface Trade {
    contractId: number;
    symbol: string;
    contractType: string;
    longcode: string;
    buyPrice: number;
    payout: number;
    purchaseTime: number;
    status: 'open' | 'won' | 'lost' | 'sold' | 'cancelled';
    profit: number;
    currentSpot?: number;
    entrySpot?: number;
    exitSpot?: number;
    dateExpiry?: number;
    tickCount?: number;
    ticksPassed?: number;
    canSell: boolean;
    bidPrice?: number;
    sellPrice?: number;
    barrier?: number;
    highBarrier?: number;
    lowBarrier?: number;
    dateStart?: number;
    entrySpotTime?: number;
    exitSpotTime?: number;
    /** Decimals Deriv quotes the price with */
    decimals?: number;
    /** Every price during the contract, oldest first (epoch seconds, price, price text as Deriv shows it) */
    path: { t: number; q: number; s?: string }[];
    /** Reset Call/Put: when the reset check happens, and the barrier after it */
    resetTime?: number;
    resetBarrier?: number;
    /** High/Low Ticks: the tick (1-5) the trader picked, and its price once it happened */
    selectedTick?: number;
    selectedSpot?: number;
    /** Split Money: the pot this trade's stake came from */
    potId?: string;
}

export interface TradesState {
    account: AccountMode;
    /** false when this account doesn't exist on Deriv yet (e.g. no real account) */
    available: boolean;
    balance: { balance: number; currency: string } | null;
    open: Trade[];
    recent: Trade[];
    risk: {
        limits: { maxStake: number; maxOpen: number; maxTradesPerDay: number; dailyLossLimit: number };
        tradesToday: number;
        netProfitToday: number;
        lossRoomLeft: number;
    };
    /** Split Money pots while the strategy is on, else null */
    strategy?: StrategySummary | null;
}

/** Buys on the given account (demo or real). The server checks the risk limits first; `message` says why not. */
export async function placeTrade(
    req: QuoteRequest,
    account: AccountMode,
    potId?: string
): Promise<{ ok: boolean; trade?: Trade; message?: string }> {
    try {
        // Never retried automatically: a repeated buy would buy twice
        const { data } = await api.post(`/api/market/trade?account=${account}`, potId ? { ...req, potId } : req, { 'axios-retry': { retries: 0 } } as any);
        return data;
    } catch (e: any) {
        return { ok: false, message: e.response?.data?.message || 'Could not place the trade. Nothing was bought.' };
    }
}

/** Closes an open trade now, at the market price. */
export async function sellTrade(contractId: number, account: AccountMode): Promise<{ ok: boolean; message?: string }> {
    try {
        const { data } = await api.post(`/api/market/trades/${contractId}/sell?account=${account}`, undefined, { 'axios-retry': { retries: 0 } } as any);
        return data;
    } catch (e: any) {
        return { ok: false, message: e.response?.data?.message || 'Could not sell right now.' };
    }
}

export interface AccountsSummary {
    demo: { available: boolean; balance: { balance: number; currency: string } | null };
    real: { available: boolean; balance: { balance: number; currency: string } | null };
}

/** Both Deriv accounts and their balances, refreshed every few seconds while `active`. */
export function useAccounts(active: boolean, everyMs = 5000) {
    const [data, setData] = useState<AccountsSummary | null>(null);
    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const load = async () => {
            if (AppState.currentState === 'active') {
                try {
                    const { data: body } = await api.get('/api/market/accounts');
                    if (!cancelled) setData(body);
                } catch {
                    // Keep the last known balances; try again next time
                }
            }
            if (!cancelled) timer = setTimeout(load, everyMs);
        };
        load();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [active, everyMs]);
    return data;
}

// After a failed request (no connection, server restarting), wait this long before asking again
const LIVE_RETRY_MS = 1500;

/**
 * One account's balance, open and recent trades, live while `active` (the screen is on top and
 * the app is open). Uses "long polling": each request tells the server the last version we have,
 * and the server answers the moment anything changes (a tick, a result, a new balance), so ticks
 * and results show up straight away. `addTrade()` shows a just-bought trade at once.
 */
export function useTrades(active: boolean, account: AccountMode) {
    const [data, setData] = useState<TradesState | null>(null);
    const [restart, setRestart] = useState(0);

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const controller = new AbortController();
        let version: number | undefined; // first request: answer at once
        // Switching account: don't show the other account's trades while the new ones load
        setData((d) => (d && d.account !== account ? null : d));
        const load = async () => {
            if (cancelled) return;
            if (AppState.currentState !== 'active') {
                timer = setTimeout(load, LIVE_RETRY_MS);
                return;
            }
            try {
                const since = version === undefined ? '' : `&since=${version}`;
                const { data: body } = await api.get(`/api/market/trades?account=${account}${since}`, {
                    signal: controller.signal,
                    timeout: 30_000, // the server answers within 20 s even when nothing changes
                    'axios-retry': { retries: 0 },
                } as any);
                if (cancelled) return;
                version = body.version;
                setData(body);
                load(); // ask again straight away: the server waits until something new happens
            } catch {
                // Keep showing the last known state and try again shortly
                if (!cancelled) timer = setTimeout(load, LIVE_RETRY_MS);
            }
        };
        load();
        // Coming back to the app: the open request may have been dropped, so start a fresh one
        const sub = AppState.addEventListener('change', (s) => s === 'active' && setRestart((r) => r + 1));
        return () => {
            cancelled = true;
            clearTimeout(timer);
            controller.abort();
            sub.remove();
        };
    }, [active, account, restart]);

    const addTrade = (trade: Trade) =>
        setData((d) => (d ? { ...d, open: [trade, ...d.open.filter((t) => t.contractId !== trade.contractId)] } : d));

    // The live updates already bring every change; this restarts them (e.g. after a sell)
    return { data, refresh: () => setRestart((r) => r + 1), addTrade };
}

/** Which of Deriv's default barriers applies for a duration unit. */
export const expiryKind = (unit: DurationUnit | undefined): 'tick' | 'intraday' | 'daily' =>
    unit === 't' ? 'tick' : unit === 'd' ? 'daily' : 'intraday';

export const UNIT_LABELS: Record<DurationUnit, string> = { t: 'Ticks', s: 'Seconds', m: 'Minutes', h: 'Hours', d: 'Days' };
