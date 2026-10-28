// Split Money strategy screen: set up the pots (sections + bank layers), see every pot, move money
// between them as loans, pay loans back, and follow the history. The rules themselves are enforced
// by the server (server/src/risk/splitMoney.ts); this screen shows them and sends the actions.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useRouter } from 'expo-router';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import BackHeader from '../../components/BackHeader';
import KeyboardSafeScroll from '../../components/KeyboardSafeScroll';
import AccountSwitch from '../../components/deriv/AccountSwitch';
import { useAccountStore } from '../../store/accountStore';
import { PRICE_DOWN, PRICE_UP, withAlpha } from '../../components/welcome/welcomePalette';
import { useSplitMoney, usd, type Loan, type Pot, type SplitSettings } from '../../hooks/useSplitMoney';

export default function SplitMoneyScreen() {
    const { colors } = useThemeStore();
    const router = useRouter();
    const focused = useIsFocused();
    const mode = useAccountStore((s) => s.mode);
    const split = useSplitMoney(mode, focused);
    const s = split.state;
    const [editing, setEditing] = useState(false);

    // Shows the server's answer when an action is refused
    const run = async (action: Promise<string | null>, done?: string) => {
        const problem = await action;
        if (problem) Alert.alert('Not done', problem);
        else if (done) Alert.alert(done);
        return !problem;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <BackHeader title="Split Money" subtitle={`Strategy · ${mode === 'real' ? 'Real' : 'Demo'} account`} right={<AccountSwitch compact />} />
            <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
                {!s ? (
                    split.error ? (
                        <Card>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>{split.error}</Text>
                            <Button label="Try again" onPress={split.reload} />
                        </Card>
                    ) : (
                        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
                    )
                ) : !s.exists ? (
                    <>
                        <Intro />
                        <Setup
                            initial={s.defaults}
                            balance={s.derivBalance}
                            minStake={s.minStake}
                            busy={split.busy}
                            saveLabel="Create my pots"
                            onSave={(x) => run(split.saveSettings(x), 'Your pots are ready. Turn the strategy on to start trading from them.')}
                        />
                    </>
                ) : (
                    <>
                        {/* On / off and the warnings */}
                        <Card>
                            <View style={styles.rowBetween}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.h2, { color: colors.textPrimary }]}>{s.active ? (s.pause ? 'Paused' : 'Strategy is on') : 'Strategy is off'}</Text>
                                    <Text style={[styles.small, { color: colors.textSecondary }]}>
                                        {s.active ? 'Every trade on the Options screen uses a pot.' : 'Turn it on to trade only from your pots.'}
                                    </Text>
                                </View>
                                <Button
                                    label={s.active ? 'Turn off' : 'Turn on'}
                                    tone={s.active ? 'outline' : 'primary'}
                                    busy={split.busy}
                                    onPress={() => run(s.active ? split.stop() : split.start())}
                                />
                            </View>
                            {s.pause && (
                                <View style={[styles.warning, { backgroundColor: withAlpha(PRICE_DOWN, 0.12) }]}>
                                    <Ionicons name="warning" size={18} color={PRICE_DOWN} />
                                    <View style={{ flex: 1, gap: 8 }}>
                                        <Text style={[styles.small, { color: PRICE_DOWN }]}>Paused: {s.pause.text}</Text>
                                        <Button
                                            label="Adjust pots to my balance"
                                            tone="danger"
                                            busy={split.busy}
                                            onPress={() =>
                                                Alert.alert('Adjust the pots?', 'The pots shrink to match your real balance, taking from the top bank first. Then trading resumes.', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    { text: 'Adjust', onPress: () => run(split.adjust()) },
                                                ])
                                            }
                                        />
                                    </View>
                                </View>
                            )}
                            <View style={styles.stats}>
                                <Stat label="In the pots" value={usd(s.held)} />
                                <Stat label="In open trades" value={usd(s.atRisk)} />
                                <Stat label="Today" value={`${s.dayNet >= 0 ? '+' : '−'}${usd(Math.abs(s.dayNet))}`} color={s.dayNet > 0 ? PRICE_UP : s.dayNet < 0 ? PRICE_DOWN : undefined} />
                            </View>
                            <Text style={[styles.small, { color: colors.textSecondary, marginTop: 8 }]}>
                                Deriv balance {s.derivBalance === null ? '—' : usd(s.derivBalance)} · today's loss cap leaves room for {usd(s.dailyRoom)}
                            </Text>
                            {s.active && (
                                <Button label="Trade from my pots" icon="arrow-forward" onPress={() => router.push('/deriv/options')} style={{ marginTop: 12 }} />
                            )}
                        </Card>

                        <PotsTree pots={s.pots} />
                        <LendForm pots={s.pots} busy={split.busy} onLend={(from, to, amount) => run(split.lend(from, to, amount))} />
                        <Loans loans={s.loans} pots={s.pots} busy={split.busy} onRepay={(id) => run(split.repay(id))} />

                        {/* Change the setup */}
                        <TouchableOpacity onPress={() => setEditing((e) => !e)} style={styles.rowBetween}>
                            <Text style={[styles.h2, { color: colors.textPrimary, marginTop: 18 }]}>Setup and rules</Text>
                            <Ionicons name={editing ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} style={{ marginTop: 18 }} />
                        </TouchableOpacity>
                        {editing && (
                            <Setup
                                initial={s.settings}
                                balance={s.derivBalance}
                                minStake={s.minStake}
                                busy={split.busy}
                                saveLabel="Save changes"
                                note="Changing the pots shares out the money they hold now; it never adds money. Finish open trades and clear loans first."
                                onSave={async (x) => {
                                    if (await run(split.saveSettings(x), 'Saved.')) setEditing(false);
                                }}
                            />
                        )}

                        <History items={s.history} />

                        <TouchableOpacity
                            onPress={() =>
                                Alert.alert(
                                    'Start over?',
                                    'This deletes your pots, loans and history on this account. Your Deriv money is not touched. You can then set up new pots.',
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        { text: 'Delete my pots', style: 'destructive', onPress: () => run(split.reset()) },
                                    ]
                                )
                            }
                            style={styles.startOver}
                        >
                            <Text style={[styles.small, { color: PRICE_DOWN }]}>Start over</Text>
                        </TouchableOpacity>
                    </>
                )}
            </KeyboardSafeScroll>
        </View>
    );
}

// ---------- Pieces ----------

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
    const { colors } = useThemeStore();
    return <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.border }, style]}>{children}</View>;
}

function Button({
    label,
    onPress,
    tone = 'primary',
    busy,
    icon,
    style,
}: {
    label: string;
    onPress: () => void;
    tone?: 'primary' | 'outline' | 'danger';
    busy?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
    style?: object;
}) {
    const { colors } = useThemeStore();
    const bg = tone === 'primary' ? colors.primary : tone === 'danger' ? PRICE_DOWN : 'transparent';
    const fg = tone === 'outline' ? colors.primary : '#FFFFFF';
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={busy}
            style={[styles.button, { backgroundColor: bg, borderColor: tone === 'outline' ? colors.primary : bg, opacity: busy ? 0.6 : 1 }, style]}
            accessibilityRole="button"
        >
            <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
            {icon && <Ionicons name={icon} size={16} color={fg} />}
        </TouchableOpacity>
    );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
    const { colors } = useThemeStore();
    return (
        <View style={{ flex: 1 }}>
            <Text style={[styles.small, { color: colors.textSecondary }]}>{label}</Text>
            <Text style={[styles.statValue, { color: color ?? colors.textPrimary }]}>{value}</Text>
        </View>
    );
}

function Intro() {
    const { colors } = useThemeStore();
    const points = [
        'Your balance is split into small pots. A trade can only use the money in the pot you pick.',
        'An empty pot is locked: switch to another pot, or get a loan for it.',
        'Banks sit above the pots. A bank lends only to the layer just below it; sections can lend to each other.',
        'Every loan must be paid back. When it is due it is collected automatically.',
        'If your real balance drops below the pots (e.g. trading on deriv.com), the strategy pauses.',
    ];
    return (
        <Card>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>How Split Money works</Text>
            {points.map((p) => (
                <View key={p} style={styles.point}>
                    <Text style={{ color: colors.primary, fontFamily: FONTS.bold }}>•</Text>
                    <Text style={[styles.body, { color: colors.textSecondary, flex: 1 }]}>{p}</Text>
                </View>
            ))}
        </Card>
    );
}

/** The setup form: sections, bank layers (×10 by default), and the safety rules. */
function Setup({
    initial,
    balance,
    minStake,
    busy,
    saveLabel,
    note,
    onSave,
}: {
    initial: SplitSettings;
    balance: number | null;
    minStake: number;
    busy: boolean;
    saveLabel: string;
    note?: string;
    onSave: (s: SplitSettings) => void;
}) {
    const { colors } = useThemeStore();
    const [sections, setSections] = useState(String(initial.sections));
    const [sectionAmount, setSectionAmount] = useState(String(initial.sectionAmount));
    const [banks, setBanks] = useState(initial.banks.map(String));
    const [loanHours, setLoanHours] = useState(String(initial.loanHours));
    const [coolDownMin, setCoolDownMin] = useState(String(initial.coolDownMin));
    const [dailyLossCap, setDailyLossCap] = useState(String(initial.dailyLossCap));

    const n = (v: string) => Number(v.replace(',', '.'));
    const total = n(sections) * n(sectionAmount) + banks.reduce((a, b) => a + (n(b) || 0), 0);

    // Adding a bank layer: 10× the layer below by default (sections total → bank 1 → bank 2...)
    const addBank = () => {
        const below = banks.length ? n(banks[banks.length - 1]!) : n(sectionAmount);
        setBanks([...banks, String(Math.round(below * 10 * 100) / 100)]);
    };

    const save = () =>
        onSave({
            sections: Math.round(n(sections)),
            sectionAmount: n(sectionAmount),
            banks: banks.map(n),
            loanHours: Math.round(n(loanHours)),
            coolDownMin: Math.round(n(coolDownMin)),
            dailyLossCap: n(dailyLossCap),
        });

    return (
        <Card>
            <Text style={[styles.h3, { color: colors.textPrimary }]}>Sections (bottom layer)</Text>
            <View style={styles.inputRow}>
                <Field label="How many" value={sections} onChange={setSections} />
                <Field label="Each (USD)" value={sectionAmount} onChange={setSectionAmount} />
            </View>

            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 12 }]}>Banks (layers above)</Text>
            {banks.map((b, i) => (
                <View key={i} style={styles.inputRow}>
                    <Field label={`Bank ${i + 1}${i === 0 ? ' (lends to sections)' : ` (lends to bank ${i})`}`} value={b} onChange={(v) => setBanks(banks.map((x, j) => (j === i ? v : x)))} />
                    {i === banks.length - 1 && (
                        <TouchableOpacity onPress={() => setBanks(banks.slice(0, -1))} style={styles.iconBtn} accessibilityLabel="Remove the top bank">
                            <Ionicons name="trash-outline" size={20} color={PRICE_DOWN} />
                        </TouchableOpacity>
                    )}
                </View>
            ))}
            {banks.length < 4 && (
                <TouchableOpacity onPress={addBank} style={styles.addBank}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text style={[styles.small, { color: colors.primary }]}>Add a bank layer (10× the one below)</Text>
                </TouchableOpacity>
            )}

            <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 12 }]}>Safety rules</Text>
            <View style={styles.inputRow}>
                <Field label="Loans due after (hours)" value={loanHours} onChange={setLoanHours} />
                <Field label="Cool-down after empty (min)" value={coolDownMin} onChange={setCoolDownMin} />
            </View>
            <View style={styles.inputRow}>
                <Field label="Daily loss cap (USD)" value={dailyLossCap} onChange={setDailyLossCap} />
            </View>

            <View style={[styles.totalBox, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
                <Text style={[styles.body, { color: colors.textPrimary }]}>
                    Total in the pots: <Text style={{ fontFamily: FONTS.bold }}>{Number.isFinite(total) ? usd(total) : '—'}</Text>
                </Text>
                <Text style={[styles.small, { color: balance !== null && total > balance ? PRICE_DOWN : colors.textSecondary }]}>
                    Your balance: {balance === null ? '—' : usd(balance)}
                    {balance !== null && total > balance ? ' (not enough)' : ''} · smallest stake {usd(minStake)}
                </Text>
            </View>
            {note && <Text style={[styles.small, { color: colors.textSecondary, marginTop: 8 }]}>{note}</Text>}
            <Button label={saveLabel} busy={busy} onPress={save} style={{ marginTop: 12 }} />
        </Card>
    );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    const { colors } = useThemeStore();
    return (
        <View style={{ flex: 1 }}>
            <Text style={[styles.small, { color: colors.textSecondary, marginBottom: 4 }]}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={(t) => onChange(t.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            />
        </View>
    );
}

/** Banks from the top down, then the sections in a grid. */
function PotsTree({ pots }: { pots: Pot[] }) {
    const { colors } = useThemeStore();
    const banks = pots.filter((p) => p.layer > 0).sort((a, b) => b.layer - a.layer);
    const sections = pots.filter((p) => p.layer === 0);
    return (
        <View style={{ marginTop: 6 }}>
            <Text style={[styles.h2, { color: colors.textPrimary, marginTop: 12 }]}>Your pots</Text>
            {banks.map((p) => (
                <View key={p.id} style={{ alignItems: 'center' }}>
                    <PotCard pot={p} wide />
                    <Ionicons name="arrow-down" size={16} color={colors.textSecondary} style={{ marginVertical: 2 }} />
                </View>
            ))}
            <View style={styles.grid}>
                {sections.map((p) => (
                    <PotCard key={p.id} pot={p} />
                ))}
            </View>
        </View>
    );
}

function PotCard({ pot, wide }: { pot: Pot; wide?: boolean }) {
    const { colors } = useThemeStore();
    const share = pot.start > 0 ? Math.min(1, pot.balance / pot.start) : 0;
    const tone = pot.locked ? PRICE_DOWN : pot.balance > pot.start ? PRICE_UP : colors.primary;
    return (
        <View
            style={[
                styles.pot,
                wide ? styles.potWide : styles.potHalf,
                { backgroundColor: colors.cardBackground, borderColor: pot.locked ? PRICE_DOWN : colors.border },
            ]}
        >
            <View style={styles.rowBetween}>
                <Text style={[styles.potName, { color: colors.textPrimary }]}>{pot.label}</Text>
                {pot.locked && <Ionicons name="lock-closed" size={14} color={PRICE_DOWN} />}
            </View>
            <Text style={[styles.potBalance, { color: tone }]}>{usd(pot.balance)}</Text>
            <Text style={[styles.tiny, { color: colors.textSecondary }]}>of {usd(pot.start)}</Text>
            <View style={[styles.bar, { backgroundColor: withAlpha(colors.textSecondary, 0.15) }]}>
                <View style={[styles.barFill, { width: `${share * 100}%`, backgroundColor: tone }]} />
            </View>
            <View style={styles.badges}>
                {pot.owes > 0 && <Badge text={`Owes ${usd(pot.owes)}`} color={PRICE_DOWN} />}
                {pot.lent > 0 && <Badge text={`Lent ${usd(pot.lent)}`} color={colors.primary} />}
                {pot.coolDownLeftMin > 0 && <Badge text={`Break ${pot.coolDownLeftMin}m`} color={colors.textSecondary} />}
                {pot.openTrades > 0 && <Badge text={`${pot.openTrades} open`} color={PRICE_UP} />}
            </View>
        </View>
    );
}

function Badge({ text, color }: { text: string; color: string }) {
    return <Text style={[styles.badge, { color, backgroundColor: withAlpha(color, 0.14) }]}>{text}</Text>;
}

/** Lend: pick who gives, who receives (only the allowed directions), and how much. */
function LendForm({ pots, busy, onLend }: { pots: Pot[]; busy: boolean; onLend: (from: string, to: string, amount: number) => Promise<boolean> }) {
    const { colors } = useThemeStore();
    const [from, setFrom] = useState<string | null>(null);
    const [to, setTo] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const giver = pots.find((p) => p.id === from);
    const targets = useMemo(
        () => (giver ? pots.filter((p) => p.id !== giver.id && (giver.layer === 0 ? p.layer === 0 : p.layer === giver.layer - 1)) : []),
        [giver, pots]
    );
    useEffect(() => {
        if (to && !targets.some((t) => t.id === to)) setTo(null);
    }, [targets, to]);

    return (
        <Card style={{ marginTop: 16 }}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>Lend money</Text>
            <Text style={[styles.small, { color: colors.textSecondary, marginBottom: 8 }]}>A loan must be paid back. Banks lend to the layer just below them.</Text>
            <Text style={[styles.h3, { color: colors.textPrimary }]}>From</Text>
            <Chips pots={pots.filter((p) => p.balance > 0)} selected={from} onSelect={setFrom} />
            {giver && (
                <>
                    <Text style={[styles.h3, { color: colors.textPrimary, marginTop: 8 }]}>To</Text>
                    <Chips pots={targets} selected={to} onSelect={setTo} />
                </>
            )}
            {giver && to && (
                <View style={[styles.inputRow, { alignItems: 'flex-end' }]}>
                    <Field label={`Amount (up to ${usd(giver.balance)})`} value={amount} onChange={setAmount} />
                    <Button
                        label="Lend"
                        busy={busy}
                        onPress={async () => {
                            if (await onLend(giver.id, to, Number(amount.replace(',', '.')))) {
                                setAmount('');
                                setTo(null);
                            }
                        }}
                    />
                </View>
            )}
        </Card>
    );
}

function Chips({ pots, selected, onSelect }: { pots: Pot[]; selected: string | null; onSelect: (id: string) => void }) {
    const { colors } = useThemeStore();
    if (!pots.length) return <Text style={[styles.small, { color: colors.textSecondary }]}>None available.</Text>;
    return (
        <View style={styles.chips}>
            {pots.map((p) => {
                const active = p.id === selected;
                return (
                    <TouchableOpacity
                        key={p.id}
                        onPress={() => onSelect(p.id)}
                        style={[styles.chip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}
                    >
                        <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.textPrimary }]}>{p.label}</Text>
                        <Text style={[styles.tiny, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{usd(p.balance)}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

function dueText(l: Loan) {
    if (l.overdue) return 'Overdue: being collected';
    const h = Math.max(0, (l.dueAt - Date.now()) / 3_600_000);
    return h >= 1 ? `Due in ${Math.floor(h)}h ${Math.round((h % 1) * 60)}m` : `Due in ${Math.ceil(h * 60)}m`;
}

function Loans({ loans, pots, busy, onRepay }: { loans: Loan[]; pots: Pot[]; busy: boolean; onRepay: (id: string) => void }) {
    const { colors } = useThemeStore();
    return (
        <View>
            <Text style={[styles.h2, { color: colors.textPrimary, marginTop: 18 }]}>Loans</Text>
            {!loans.length && <Text style={[styles.small, { color: colors.textSecondary }]}>No loans right now.</Text>}
            {loans.map((l) => {
                const borrower = pots.find((p) => p.id === l.to);
                return (
                    <Card key={l.id} style={{ marginTop: 8 }}>
                        <View style={styles.rowBetween}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.body, { color: colors.textPrimary, fontFamily: FONTS.semibold }]}>
                                    {l.toLabel} owes {l.fromLabel}
                                </Text>
                                <Text style={[styles.small, { color: l.overdue ? PRICE_DOWN : colors.textSecondary }]}>
                                    {usd(l.owed)} of {usd(l.amount)} · {dueText(l)}
                                </Text>
                            </View>
                            <Button
                                label="Pay back"
                                tone="outline"
                                busy={busy || !borrower || borrower.balance <= 0}
                                onPress={() => onRepay(l.id)}
                            />
                        </View>
                    </Card>
                );
            })}
        </View>
    );
}

function History({ items }: { items: { at: number; text: string }[] }) {
    const { colors } = useThemeStore();
    if (!items.length) return null;
    return (
        <View>
            <Text style={[styles.h2, { color: colors.textPrimary, marginTop: 18 }]}>History</Text>
            <Card style={{ marginTop: 8 }}>
                {items.map((h, i) => (
                    <View key={i} style={[styles.historyRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                        <Text style={[styles.tiny, { color: colors.textSecondary, width: 62 }]}>
                            {new Date(h.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={[styles.small, { color: colors.textPrimary, flex: 1 }]}>{h.text}</Text>
                    </View>
                ))}
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingBottom: 40 },
    card: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
    h2: { fontSize: 17, fontFamily: FONTS.semibold },
    h3: { fontSize: 14, fontFamily: FONTS.semibold, marginBottom: 6 },
    body: { fontSize: 14, fontFamily: FONTS.regular, lineHeight: 20 },
    small: { fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17 },
    tiny: { fontSize: 11, fontFamily: FONTS.regular },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    point: { flexDirection: 'row', gap: 8, marginTop: 6 },
    warning: { flexDirection: 'row', gap: 8, borderRadius: 10, padding: 10, marginTop: 12 },
    stats: { flexDirection: 'row', marginTop: 14 },
    statValue: { fontSize: 16, fontFamily: FONTS.semibold, marginTop: 2 },
    button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
    buttonText: { fontSize: 14, fontFamily: FONTS.semibold },
    inputRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, fontFamily: FONTS.medium },
    iconBtn: { justifyContent: 'flex-end', paddingBottom: 10, paddingHorizontal: 4 },
    addBank: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    totalBox: { borderRadius: 10, padding: 10, marginTop: 14, gap: 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    pot: { borderWidth: 1.5, borderRadius: 14, padding: 12, marginTop: 8 },
    potWide: { alignSelf: 'stretch' },
    potHalf: { width: '48.5%' },
    potName: { fontSize: 13, fontFamily: FONTS.semibold },
    potBalance: { fontSize: 20, fontFamily: FONTS.bold, marginTop: 2 },
    bar: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
    badge: { fontSize: 10, fontFamily: FONTS.semibold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
    chipText: { fontSize: 12, fontFamily: FONTS.semibold },
    historyRow: { flexDirection: 'row', gap: 8, paddingVertical: 7 },
    startOver: { alignSelf: 'center', padding: 14, marginTop: 10 },
});
