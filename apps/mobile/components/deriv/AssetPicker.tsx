// "Market" sheet: every Deriv options asset on ONE long list, by category (Forex, Stock Indices,
// ... Derived (Synthetics)) and group (Major Pairs, Continuous Indices...).
//  - The category tabs follow the scroll: the tab of the category you're looking at is active.
//  - Tapping a tab scrolls the list to that category.
//  - Search filters across everything (the tabs hide while searching).
//  - Opens at the category of the asset that is currently selected.
// ~90 rows, so a plain ScrollView is fine and lets us measure where each category starts.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { FONTS } from '../../constants/fonts';
import Sheet from './Sheet';
import type { Asset, AssetCategory } from '../../hooks/useDerivMarket';

interface Props {
    visible: boolean;
    categories: AssetCategory[] | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
    selected: string | null;
    onSelect: (asset: Asset) => void;
    onClose: () => void;
}

// A category counts as "current" a little before its heading reaches the top
const ACTIVE_OFFSET = 24;

export default function AssetPicker({ visible, categories, loading, error, onRetry, selected, onSelect, onClose }: Props) {
    const { colors } = useThemeStore();
    const [search, setSearch] = useState('');
    const [active, setActive] = useState<string | undefined>(undefined);

    const listRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const tabsRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
    // Where each category starts in the list, and where each tab sits in the tab row
    const categoryY = useRef<Record<string, number>>({});
    const tabX = useRef<Record<string, number>>({});
    // Where a tab tap is scrolling the list to (null when not jumping). Until the list arrives there,
    // the categories it passes on the way must not change the active tab.
    const jumpTarget = useRef<number | null>(null);
    const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // Sizes needed to know the furthest the list can scroll
    const contentHeight = useRef(0);
    const viewportHeight = useRef(0);
    const openedAtSelected = useRef(false);

    const selectedCategory = categories?.find((c) => c.groups.some((g) => g.assets.some((a) => a.symbol === selected)))?.id;

    // Searching: the same layout, only matching assets (empty groups and categories drop out)
    const shown = useMemo(() => {
        if (!categories) return [];
        const q = search.trim().toLowerCase();
        if (!q) return categories;
        return categories
            .map((c) => ({ ...c, groups: c.groups.map((g) => ({ ...g, assets: g.assets.filter((a) => a.name.toLowerCase().includes(q)) })).filter((g) => g.assets.length) }))
            .filter((c) => c.groups.length);
    }, [categories, search]);

    // Fresh start every time the sheet opens
    useEffect(() => {
        if (visible) {
            setActive(selectedCategory ?? categories?.[0]?.id);
            openedAtSelected.current = false;
            selectedGroupY.current = null;
            selectedRowY.current = null;
        } else {
            setSearch('');
            categoryY.current = {};
        }
    }, [visible]);

    // Keep the active tab visible in the tab row
    useEffect(() => {
        if (active && tabX.current[active] !== undefined) {
            tabsRef.current?.scrollTo({ x: Math.max(0, tabX.current[active]! - 24), animated: true });
        }
    }, [active]);

    // Latest scroll position, to check a tab jump really landed
    const lastOffset = useRef(0);
    const correctTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

    // The trader touched the list: scrolling decides the active tab again
    const endJump = () => {
        jumpTarget.current = null;
        clearTimeout(jumpTimer.current);
        correctTimers.current.forEach(clearTimeout);
        correctTimers.current = [];
    };

    const scrollToCategory = (id: string, animated = true) => {
        const top = categoryY.current[id];
        if (top === undefined) return;
        // A category near the end may not be able to reach the top: stop where the list ends
        const maxY = Math.max(0, contentHeight.current - viewportHeight.current);
        const y = maxY > 0 ? Math.min(top, maxY) : top;
        endJump();
        jumpTarget.current = y;
        setActive(id);
        listRef.current?.scrollTo({ y, animated });
        // A swipe that was still coasting when the tab was tapped can carry the list past its
        // target. Check after the scroll animation (and once more after a long fling would end)
        // and put the list back on the tapped category if it drifted.
        correctTimers.current = [450, 1200].map((ms) =>
            setTimeout(() => {
                if (jumpTarget.current === y && Math.abs(lastOffset.current - y) > 2) {
                    listRef.current?.scrollTo({ y, animated: true });
                }
            }, ms)
        );
    };

    useEffect(() => endJump, []);

    // Where the selected asset's row is: its category's top + its group's top in the category +
    // its own top in the group (each onLayout reports a position inside its parent)
    const selectedGroupY = useRef<number | null>(null);
    const selectedRowY = useRef<number | null>(null);

    // Open the list with the selected asset in view, once all three positions are known
    const openAtSelected = () => {
        const top = selectedCategory ? categoryY.current[selectedCategory] : undefined;
        if (openedAtSelected.current || search || top === undefined || selectedGroupY.current === null || selectedRowY.current === null) return;
        openedAtSelected.current = true;
        const y = Math.max(top, top + selectedGroupY.current + selectedRowY.current - 120);
        requestAnimationFrame(() => {
            jumpTarget.current = y;
            listRef.current?.scrollTo({ y, animated: false });
            jumpTimer.current = setTimeout(() => (jumpTarget.current = null), 300);
        });
    };

    const onCategoryLayout = (id: string, y: number) => {
        categoryY.current[id] = y;
        openAtSelected();
    };

    // The category the list is showing at scroll position `offsetY`
    const categoryAt = (offsetY: number) => {
        const y = offsetY + ACTIVE_OFFSET;
        let current = shown[0]?.id;
        for (const c of shown) {
            const top = categoryY.current[c.id];
            if (top !== undefined && top <= y) current = c.id;
        }
        // At the very bottom, the last category is current even if its heading can't reach the top
        if (offsetY + viewportHeight.current >= contentHeight.current - 4) current = shown[shown.length - 1]?.id;
        return current;
    };

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (search) return;
        const offsetY = e.nativeEvent.contentOffset.y;
        lastOffset.current = offsetY;
        // After a tab tap, that tab stays active until the trader touches the list again: the
        // list passing other categories on its way (or a swipe still coasting) must not change it
        if (jumpTarget.current !== null) return;
        const current = categoryAt(offsetY);
        if (current && current !== active) setActive(current);
    };

    return (
        <Sheet visible={visible} title="Market" onClose={onClose} tall>
            <View style={[styles.search, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search…"
                    placeholderTextColor={colors.placeholderText}
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    autoCorrect={false}
                />
                {!!search && (
                    <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {!search && !!categories && (
                <View>
                    <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                        {categories.map((c) => {
                            const isActive = c.id === active;
                            return (
                                <TouchableOpacity
                                    key={c.id}
                                    onPress={() => scrollToCategory(c.id)}
                                    onLayout={(e) => {
                                        tabX.current[c.id] = e.nativeEvent.layout.x;
                                        // On opening, the active tab may be off to the right: bring it into view
                                        if (c.id === active) tabsRef.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
                                    }}
                                    style={[styles.tab, isActive && { borderBottomColor: colors.primary }]}
                                    accessibilityRole="tab"
                                    accessibilityState={{ selected: isActive }}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            { color: isActive ? colors.textPrimary : colors.textSecondary },
                                            isActive && { fontFamily: FONTS.semibold },
                                        ]}
                                    >
                                        {c.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                    <View style={[styles.tabsLine, { backgroundColor: colors.border }]} />
                </View>
            )}

            {loading && !categories ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
            ) : error && !categories ? (
                <View style={styles.center}>
                    <Text style={[styles.muted, { color: colors.textSecondary }]}>{error}</Text>
                    <TouchableOpacity onPress={onRetry} style={[styles.retry, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: colors.white, fontFamily: FONTS.semibold }}>Try again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    ref={listRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.list}
                    onScroll={onScroll}
                    scrollEventThrottle={32}
                    // The trader grabbing the list cancels a tab jump: normal tracking takes over
                    onScrollBeginDrag={endJump}
                    onContentSizeChange={(_, h) => (contentHeight.current = h)}
                    onLayout={(e) => (viewportHeight.current = e.nativeEvent.layout.height)}
                    keyboardShouldPersistTaps="handled"
                >
                    {shown.length === 0 && (
                        <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 24 }]}>No market matches “{search}”.</Text>
                    )}
                    {shown.map((c) => (
                        <View key={c.id} onLayout={(e) => onCategoryLayout(c.id, e.nativeEvent.layout.y)}>
                            <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>{c.label}</Text>
                            {c.groups.map((g) => (
                                <View
                                    key={g.id}
                                    onLayout={
                                        g.assets.some((a) => a.symbol === selected)
                                            ? (e) => {
                                                  selectedGroupY.current = e.nativeEvent.layout.y;
                                                  openAtSelected();
                                              }
                                            : undefined
                                    }
                                >
                                    {/* The group name only adds something when it differs from the category's */}
                                    {g.label !== c.label && <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{g.label}</Text>}
                                    {g.assets.map((a) => {
                                        const isSelected = a.symbol === selected;
                                        const closed = !a.open || a.suspended;
                                        return (
                                            <TouchableOpacity
                                                key={a.symbol}
                                                onPress={() => {
                                                    onSelect(a);
                                                    onClose();
                                                }}
                                                style={[styles.row, isSelected && { backgroundColor: colors.primary }]}
                                                accessibilityState={{ selected: isSelected }}
                                                onLayout={
                                                    isSelected
                                                        ? (e) => {
                                                              selectedRowY.current = e.nativeEvent.layout.y;
                                                              openAtSelected();
                                                          }
                                                        : undefined
                                                }
                                            >
                                                <Text style={[styles.rowText, { color: isSelected ? colors.white : colors.textPrimary }]}>{a.name}</Text>
                                                {closed && (
                                                    <Text
                                                        style={[
                                                            styles.closed,
                                                            { color: isSelected ? colors.white : colors.textSecondary, borderColor: isSelected ? colors.white : colors.border },
                                                        ]}
                                                    >
                                                        {a.suspended ? 'Suspended' : 'Closed'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 6 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, fontFamily: FONTS.regular },
    tabs: { paddingHorizontal: 12 },
    tab: { paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontSize: 14, fontFamily: FONTS.medium },
    tabsLine: { height: StyleSheet.hairlineWidth, marginTop: -1 },
    list: { paddingHorizontal: 16, paddingBottom: 24 },
    categoryTitle: { fontSize: 16, fontFamily: FONTS.bold, marginTop: 18, marginBottom: 2, marginLeft: 4 },
    groupTitle: { fontSize: 13, fontFamily: FONTS.medium, marginTop: 10, marginBottom: 2, marginLeft: 4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 10 },
    rowText: { fontSize: 15, fontFamily: FONTS.regular, flex: 1 },
    closed: { fontSize: 11, fontFamily: FONTS.medium, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
    center: { alignItems: 'center', marginTop: 30, gap: 12 },
    muted: { fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center' },
    retry: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
});
