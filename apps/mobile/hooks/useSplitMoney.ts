// The Split Money strategy from the backend (server/src/api/routes/strategyRoutes.js): pots, banks,
// loans. The server enforces every rule; the app only shows the state and sends the trader's actions.
import { useCallback, useEffect, useState } from 'react';
import api from '../apis/authApi';
import type { AccountMode } from '../store/accountStore';

export interface SplitSettings {
    sections: number;
    sectionAmount: number;
    /** One amount per bank layer, lowest bank first */
    banks: number[];
    loanHours: number;
    coolDownMin: number;
    dailyLossCap: number;
}

export interface Pot {
    id: string;
    label: string;
    layer: number;
    start: number;
    balance: number;
    locked: boolean;
    maxStake: number;
    owes: number;
    lent: number;
    coolDownLeftMin: number;
    openTrades: number;
}

export interface Loan {
    id: string;
    from: string;
    to: string;
    fromLabel: string;
    toLabel: string;
    amount: number;
    owed: number;
    createdAt: number;
    dueAt: number;
    overdue: boolean;
}

export type SplitState =
    | { exists: false; defaults: SplitSettings; minStake: number; derivBalance: number | null }
    | {
          exists: true;
          settings: SplitSettings;
          active: boolean;
          pause: { kind: string; text: string } | null;
          minStake: number;
          derivBalance: number | null;
          held: number;
          atRisk: number;
          dayNet: number;
          dailyRoom: number;
          pots: Pot[];
          loans: Loan[];
          history: { at: number; text: string }[];
      };

/** The short pot list that comes with the Options screen's live trade updates. */
export interface StrategySummary {
    pause: { kind: string; text: string } | null;
    dailyRoom: number;
    pots: Pick<Pot, 'id' | 'label' | 'layer' | 'balance' | 'locked' | 'maxStake' | 'owes'>[];
}

type Reply = { ok: boolean; message?: string; strategy?: SplitState };

/** The strategy on one account, plus its actions. Each action returns Deriv-free plain words on failure. */
export function useSplitMoney(account: AccountMode, active: boolean) {
    const [state, setState] = useState<SplitState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get<Reply>(`/api/strategy/split?account=${account}`);
            if (data.strategy) setState(data.strategy);
            setError(null);
        } catch (e: any) {
            setError(e.response?.data?.message || 'Could not load your pots.');
        }
    }, [account]);

    useEffect(() => {
        if (!active) return;
        setState(null);
        load();
        // Loans get collected and trades settle in the background: refresh now and then
        const t = setInterval(load, 15_000);
        return () => clearInterval(t);
    }, [active, load]);

    /** Sends an action; updates the state from the reply. Returns null on success, else the reason. */
    const act = async (method: 'post' | 'put', path: string, body?: object): Promise<string | null> => {
        setBusy(true);
        try {
            // No automatic retry: a repeated "lend" would lend twice
            const { data } = await api[method]<Reply>(`/api/strategy/split${path}?account=${account}`, body ?? {}, { 'axios-retry': { retries: 0 } } as any);
            if (data.strategy) setState(data.strategy);
            return data.ok ? null : data.message || 'Not allowed.';
        } catch (e: any) {
            const reply: Reply | undefined = e.response?.data;
            if (reply?.strategy) setState(reply.strategy);
            return reply?.message || 'Could not reach the server. Try again.';
        } finally {
            setBusy(false);
        }
    };

    return {
        state,
        error,
        busy,
        reload: load,
        saveSettings: (s: SplitSettings) => act('put', '/settings', s),
        start: () => act('post', '/start'),
        stop: () => act('post', '/stop'),
        lend: (from: string, to: string, amount: number) => act('post', '/lend', { from, to, amount }),
        repay: (loanId: string, amount?: number) => act('post', '/repay', amount === undefined ? { loanId } : { loanId, amount }),
        adjust: () => act('post', '/adjust'),
        reset: () => act('post', '/reset'),
    };
}

/** "s3" -> "Section 3", "b1" -> "Bank 1" (short names for trade rows and cards). */
export const potName = (id: string) => (id.startsWith('s') ? `Section ${id.slice(1)}` : `Bank ${id.slice(1)}`);

export const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
