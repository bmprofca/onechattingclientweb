import React, { useEffect, useRef } from 'react';

/** Header checkbox with indeterminate state, driven by useBulkSelection. */
export function MasterCheckbox({ selection, disabled = false, label = 'Select all on this page' }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = Boolean(selection.someOnPageSelected);
    }, [selection.someOnPageSelected]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={selection.allOnPageSelected}
            onChange={selection.togglePage}
            disabled={disabled}
            aria-label={label}
            title={label}
        />
    );
}

/** Row checkbox. */
export function RowCheckbox({ selection, id, label = 'Select row', disabled = false }) {
    return (
        <input
            type="checkbox"
            checked={selection.isSelected(id)}
            onChange={() => selection.toggle(id)}
            onClick={(event) => event.stopPropagation()}
            disabled={disabled}
            aria-label={label}
        />
    );
}

/**
 * Bar shown above a table while something is selected. Offers the
 * "select all N matching" step and hosts the page's bulk action buttons.
 */
export function BulkActionBar({ selection, totalCount = 0, pageCount = 0, noun = 'items', children }) {
    if (!selection.hasSelection) return null;
    const total = Number(totalCount) || 0;
    const fmt = (value) => Number(value || 0).toLocaleString('en-IN');

    return (
        <div className="flex flex-col gap-3 border-b border-brand-100 bg-brand-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink">
                <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-brand-600 px-1.5 text-xs font-bold text-white oc-num">
                    {fmt(selection.selectedCount)}
                </span>
                {selection.allMatching ? (
                    <span>
                        All <strong>{fmt(selection.selectedCount)}</strong> {noun} matching the current view are selected
                        {selection.excludedIds.length > 0 ? ` (${fmt(selection.excludedIds.length)} excluded)` : ''}.
                    </span>
                ) : selection.canSelectAllMatching ? (
                    <span>
                        All <strong>{fmt(pageCount)}</strong> {noun} on this page are selected.
                    </span>
                ) : (
                    <span>{noun} selected.</span>
                )}
                {selection.canSelectAllMatching && (
                    <button
                        type="button"
                        onClick={selection.selectAllMatching}
                        className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                    >
                        Select all {fmt(total)} {noun}
                    </button>
                )}
                <button
                    type="button"
                    onClick={selection.clear}
                    className="font-semibold text-ink-500 underline-offset-2 hover:text-ink hover:underline"
                >
                    Clear selection
                </button>
            </div>
            {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
        </div>
    );
}
