// Which Deriv account the trader is using: "demo" (virtual money) or "real" (real money).
// Deliberately NOT saved on the phone: every time the app starts, it starts in Demo.
import { create } from 'zustand';

export type AccountMode = 'demo' | 'real';

interface AccountState {
    mode: AccountMode;
    setMode: (mode: AccountMode) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
    mode: 'demo',
    setMode: (mode) => set({ mode }),
}));
