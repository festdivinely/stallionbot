// "How this trade works", in plain words, for every options trade type the Options screen offers
// (keyed by the trade type ids from server/src/market/catalog.ts). Written from Deriv's own
// descriptions of each contract at developers.deriv.com / deriv.com, not copied from them.

export interface TradeExplanation {
    /** One sentence: what you are betting on */
    summary: string;
    /** How you win, one line per side (or rule) */
    points: string[];
    /** Something people often miss */
    note?: string;
}

export const TRADE_EXPLANATIONS: Record<string, TradeExplanation> = {
    rise_fall: {
        summary: 'You bet on whether the price ends higher or lower than where it started.',
        points: [
            'Rise: you win if the exit price is higher than the entry price.',
            'Fall: you win if the exit price is lower than the entry price.',
        ],
        note: 'If the exit price equals the entry price you lose, unless you allowed "equals".',
    },
    higher_lower: {
        summary: 'Like Rise/Fall, but compared with a barrier you choose instead of the entry price.',
        points: [
            'Higher: you win if the exit price is above the barrier.',
            'Lower: you win if the exit price is below the barrier.',
        ],
        note: 'A barrier far from the price pays more, because it is less likely to win.',
    },
    touch_no_touch: {
        summary: 'You bet on whether the price reaches a barrier at any moment before the end.',
        points: [
            'Touch: you win as soon as the price touches the barrier. The trade can end early.',
            'No Touch: you win if the price never touches the barrier until the end.',
        ],
    },
    ends_between: {
        summary: 'You set a high and a low barrier and bet on where the price is at the very end.',
        points: [
            'Ends Between: you win if the exit price is between the two barriers.',
            'Ends Outside: you win if the exit price is above the high barrier or below the low one.',
        ],
        note: 'Only the exit price counts. The price may leave the range and come back.',
    },
    stays_between: {
        summary: 'You set a high and a low barrier and bet on the price during the whole trade.',
        points: [
            'Stays Between: you win if the price never touches either barrier until the end.',
            'Goes Outside: you win as soon as the price touches either barrier.',
        ],
        note: 'One touch decides it: Stays Between loses at once, Goes Outside wins at once.',
    },
    matches_differs: {
        summary: 'You pick a digit (0–9) and bet on the last digit of the last tick.',
        points: [
            'Matches: you win if the last digit is your digit. Rare, so it pays a lot.',
            'Differs: you win if the last digit is any other digit. Common, so it pays little.',
        ],
        note: 'The last digit is the final decimal of the price, e.g. 7 in 1,234.567.',
    },
    even_odd: {
        summary: 'You bet on whether the last digit of the last tick is even or odd.',
        points: ['Even: you win on 0, 2, 4, 6 or 8.', 'Odd: you win on 1, 3, 5, 7 or 9.'],
    },
    over_under: {
        summary: 'You pick a digit and bet on whether the last digit of the last tick is above or below it.',
        points: [
            'Over: you win if the last digit is higher than your digit.',
            'Under: you win if the last digit is lower than your digit.',
        ],
        note: 'If the last digit equals your digit, both Over and Under lose.',
    },
    accumulators: {
        summary: 'Your stake grows by the growth rate every tick, as long as the price stays inside a narrow range.',
        points: [
            'Each tick the price stays in the range, your payout grows.',
            'If the price leaves the range, you lose your stake.',
            'Sell any time to take what you have built up.',
        ],
        note: 'A higher growth rate grows faster but uses a narrower range.',
    },
    multipliers: {
        summary: 'Your profit or loss is the price move multiplied by the multiplier you choose.',
        points: [
            'Up: you gain when the price goes up, and lose when it goes down.',
            'Down: you gain when the price goes down, and lose when it goes up.',
        ],
        note: 'You can never lose more than your stake: the trade closes if your loss reaches it.',
    },
    turbos: {
        summary: 'A trade with a barrier where the payout grows quickly the further the price moves your way.',
        points: [
            'Up: the price must stay above the barrier; the higher it ends, the more you get.',
            'Down: the price must stay below the barrier; the lower it ends, the more you get.',
        ],
        note: 'If the price touches the barrier, the trade ends and you lose your stake.',
    },
    vanillas: {
        summary: 'You get paid by how far past a strike price the market ends.',
        points: [
            'Call: you get paid if the exit price is above the strike; more the higher it is.',
            'Put: you get paid if the exit price is below the strike; more the lower it is.',
        ],
        note: 'If it ends on the wrong side of the strike, you lose your stake.',
    },
    asians: {
        summary: 'You compare the last tick with the average of all the ticks of the trade.',
        points: [
            'Asian Rise: you win if the last tick is higher than the average.',
            'Asian Fall: you win if the last tick is lower than the average.',
        ],
        note: 'The average (the dashed line) moves with every tick, so the barrier keeps changing.',
    },
    reset: {
        summary: 'Like Rise/Fall, but the barrier can be reset once, half way through, in your favour.',
        points: [
            'Reset Call: you win if the exit price is above the barrier.',
            'Reset Put: you win if the exit price is below the barrier.',
            'At the reset time, if you are losing, the barrier moves to the current price.',
        ],
        note: 'The reset gives you a second chance, so it pays less than Rise/Fall.',
    },
    high_low_ticks: {
        summary: 'You pick one of the next 5 ticks and bet that it will be the highest or the lowest.',
        points: [
            'High Tick: you win if your tick is the highest of the 5.',
            'Low Tick: you win if your tick is the lowest of the 5.',
        ],
        note: 'The trade ends early once another tick beats yours.',
    },
    only_ups_downs: {
        summary: 'You bet that every tick moves the same way, with no break.',
        points: [
            'Only Ups: you win if every tick is higher than the one before.',
            'Only Downs: you win if every tick is lower than the one before.',
        ],
        note: 'One tick the wrong way (or no change) ends the trade and you lose.',
    },
};

/** Trade types settled on the last digit: the Options screen shows last-digit stats for them. */
export const DIGIT_TRADE_IDS = ['matches_differs', 'even_odd', 'over_under'];
