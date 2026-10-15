import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Selection model for paginated tables with server-side "select all".
 *
 * - Page mode: explicit ids are collected (they persist across pages).
 * - All-matching mode: every record matching the current filters is selected,
 *   minus `excludedIds`. The client never sends the full id list; it sends
 *   { select_all: true, excluded_ids } plus the active filters and the backend
 *   resolves the records itself.
 *
 * `resetKey` should change whenever the filter set changes (search, status, …),
 * because an "all matching" selection is only valid for one filter set.
 */
export default function useBulkSelection({ pageIds = [], totalCount = 0, resetKey = '' } = {}) {
    const [selected, setSelected] = useState(() => new Set());
    const [allMatching, setAllMatching] = useState(false);
    const [excluded, setExcluded] = useState(() => new Set());

    const clear = useCallback(() => {
        setSelected(new Set());
        setExcluded(new Set());
        setAllMatching(false);
    }, []);

    useEffect(() => {
        clear();
    }, [resetKey, clear]);

    const isSelected = useCallback(
        (id) => (allMatching ? !excluded.has(id) : selected.has(id)),
        [allMatching, excluded, selected]
    );

    const toggle = useCallback((id) => {
        if (allMatching) {
            setExcluded((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            });
            return;
        }
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, [allMatching]);

    const pageSelectedCount = useMemo(
        () => pageIds.reduce((count, id) => count + (isSelected(id) ? 1 : 0), 0),
        [pageIds, isSelected]
    );
    const allOnPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;
    const someOnPageSelected = pageSelectedCount > 0 && !allOnPageSelected;

    const togglePage = useCallback(() => {
        if (allOnPageSelected) {
            if (allMatching) {
                // Unchecking the master box while everything is selected clears the whole selection.
                clear();
                return;
            }
            setSelected((prev) => {
                const next = new Set(prev);
                pageIds.forEach((id) => next.delete(id));
                return next;
            });
            return;
        }
        if (allMatching) {
            setExcluded((prev) => {
                const next = new Set(prev);
                pageIds.forEach((id) => next.delete(id));
                return next;
            });
            return;
        }
        setSelected((prev) => {
            const next = new Set(prev);
            pageIds.forEach((id) => next.add(id));
            return next;
        });
    }, [allOnPageSelected, allMatching, pageIds, clear]);

    const selectAllMatching = useCallback(() => {
        setAllMatching(true);
        setExcluded(new Set());
        setSelected(new Set());
    }, []);

    const total = Number(totalCount) || 0;
    const selectedCount = allMatching ? Math.max(0, total - excluded.size) : selected.size;

    /** Payload fragment for bulk endpoints. `idKey` is the field name for explicit ids. */
    const buildPayload = useCallback((idKey = 'ids') => (
        allMatching
            ? { select_all: true, excluded_ids: Array.from(excluded) }
            : { select_all: false, [idKey]: Array.from(selected) }
    ), [allMatching, excluded, selected]);

    return {
        isSelected,
        toggle,
        togglePage,
        selectAllMatching,
        clear,
        allMatching,
        allOnPageSelected,
        someOnPageSelected,
        selectedCount,
        selectedIds: Array.from(selected),
        excludedIds: Array.from(excluded),
        hasSelection: selectedCount > 0,
        canSelectAllMatching: allOnPageSelected && !allMatching && total > pageIds.length,
        buildPayload,
    };
}
