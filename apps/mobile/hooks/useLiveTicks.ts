// Polls the backend's live market prices (GET /api/market/ticks) about once a second while the
// screen using it is open and the app is in the foreground. Prices come from the server's single
// Deriv demo connection; the app never talks to Deriv directly.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export interface TickerSeries {
    symbol: string;
    name: string;
    quotes: number[]; // oldest first
}

export type FeedStatus = 'connecting' | 'live' | 'offline';

const POLL_MS = 1000;
const REQUEST_TIMEOUT_MS = 5000;
// Only show "Offline" after a few misses in a row, so one slow request doesn't flicker the badge
const FAILURES_BEFORE_OFFLINE = 3;

export function useLiveTicks() {
    const [series, setSeries] = useState<TickerSeries[]>([]);
    const [status, setStatus] = useState<FeedStatus>('connecting');

    useEffect(() => {
        const baseUrl = process.env.EXPO_PUBLIC_API_URL;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;
        let failures = 0;
        let active = AppState.currentState === 'active';

        const markFailure = () => {
            failures += 1;
            if (failures >= FAILURES_BEFORE_OFFLINE) setStatus('offline');
        };

        const poll = async () => {
            if (cancelled || !active) return;
            const controller = new AbortController();
            const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            try {
                const res = await fetch(`${baseUrl}/api/market/ticks`, { signal: controller.signal });
                const data = await res.json();
                if (cancelled) return;
                if (res.ok && Array.isArray(data.symbols)) {
                    failures = 0;
                    setSeries(data.symbols);
                    // Right after the backend starts it answers before Deriv has sent any prices:
                    // that is "connecting", not "offline". Offline = we had prices and they stopped.
                    const hasPrices = data.symbols.some((s: TickerSeries) => s.quotes?.length > 0);
                    setStatus(data.live ? 'live' : hasPrices ? 'offline' : 'connecting');
                } else {
                    markFailure();
                }
            } catch {
                if (!cancelled) markFailure();
            } finally {
                clearTimeout(abort);
                if (!cancelled && active) timer = setTimeout(poll, POLL_MS);
            }
        };

        // Pause while the app is in the background; resume when it comes back
        const sub = AppState.addEventListener('change', (state) => {
            const nowActive = state === 'active';
            if (nowActive && !active) {
                active = true;
                poll();
            } else if (!nowActive) {
                active = false;
                clearTimeout(timer);
            }
        });

        if (!baseUrl) {
            setStatus('offline');
        } else {
            poll();
        }

        return () => {
            cancelled = true;
            clearTimeout(timer);
            sub.remove();
        };
    }, []);

    return { series, status };
}
