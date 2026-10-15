import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown, FiFolder, FiSearch, FiX } from 'react-icons/fi';

/*
 * ProjectFilter — compact multi-select sized to match .oc-input (42px), with no
 * built-in label so it lines up with every other toolbar control.
 * Selection is drafted inside the menu and committed via "Apply" (or cleared).
 *
 * Props:
 *   options   [{ value, label }]
 *   value     array of selected values ([] = all)
 *   onChange  (nextArray) => void   called only on Apply / Clear
 */
export default function ProjectFilter({ options = [], value = [], onChange, allLabel = 'All projects', className = '', align = 'left' }) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);

  const place = () => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(300, vw - margin * 2);
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, vw - width - margin));
    const spaceBelow = Math.max(0, vh - rect.bottom - margin - 8);
    const spaceAbove = Math.max(0, rect.top - margin - 8);
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(360, openUp ? spaceAbove : spaceBelow);
    const listMax = Math.max(48, maxHeight - 148);
    setPos({
      left,
      width,
      maxHeight,
      listMax,
      ...(openUp ? { bottom: vh - rect.top + 8 } : { top: rect.bottom + 8 }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? options.filter((o) => String(o.label).toLowerCase().includes(term)) : options;
  }, [options, query]);

  const isSame = (a, b) => String(a) === String(b);
  const has = (list, v) => list.some((x) => isSame(x, v));

  const display = (() => {
    if (!value.length || value.length === options.length) return allLabel;
    if (value.length === 1) return options.find((o) => isSame(o.value, value[0]))?.label || '1 project';
    return `${value.length} projects`;
  })();

  const toggle = (v) => setDraft((prev) => (has(prev, v) ? prev.filter((x) => !isSame(x, v)) : [...prev, v]));

  const openMenu = () => {
    setDraft(value);
    setQuery('');
    setOpen(true);
  };

  const apply = () => {
    onChange?.(draft.length === options.length ? [] : draft);
    setOpen(false);
  };

  const clear = (event) => {
    event?.stopPropagation();
    setDraft([]);
    onChange?.([]);
    setOpen(false);
  };

  const active = value.length > 0 && value.length < options.length;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-[42px] w-full items-center gap-2 rounded-[9px] border bg-white pl-3 pr-2.5 text-left text-sm transition-colors ${
          open ? 'border-brand-600 ring-[3px] ring-brand-600/20' : 'border-line-strong hover:border-brand-400'
        }`}
      >
        <FiFolder size={15} className={active ? 'text-brand-700' : 'text-ink-400'} />
        <span className={`min-w-0 flex-1 truncate font-semibold ${active ? 'text-ink' : 'text-ink-700'}`}>{display}</span>
        {active ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear project filter"
            onClick={clear}
            onKeyDown={(e) => (e.key === 'Enter' ? clear(e) : null)}
            className="rounded p-0.5 text-ink-400 hover:bg-surface-soft hover:text-red-600"
          >
            <FiX size={14} />
          </span>
        ) : null}
        <FiChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, zIndex: 90 }}
          className="flex flex-col overflow-hidden rounded-[12px] border border-line bg-white shadow-pop"
        >
          <div className="shrink-0 border-b border-line-soft p-2">
            <div className="relative">
              <FiSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects"
                className="h-9 w-full rounded-[8px] border border-line bg-white pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-400 focus:border-brand-600"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between px-3 py-2 text-xs">
            <button type="button" onClick={() => setDraft(options.map((o) => o.value))} className="font-semibold text-brand-800 hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => setDraft([])} className="font-semibold text-ink-500 hover:text-ink">
              Clear
            </button>
          </div>
          <ul role="listbox" aria-multiselectable="true" style={{ maxHeight: pos.listMax }} className="min-h-0 overflow-y-auto px-1.5 pb-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-500">No projects match</li>
            ) : (
              filtered.map((option) => {
                const checked = has(draft, option.value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(option.value)}
                      className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors ${
                        checked ? 'bg-brand-50 text-ink' : 'text-ink-700 hover:bg-surface-soft'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-white'
                        }`}
                      >
                        {checked ? <FiCheck size={11} strokeWidth={3} /> : null}
                      </span>
                      <span className="truncate font-medium">{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line-soft bg-surface-soft px-3 py-2.5">
            <span className="text-xs text-ink-500">{draft.length ? `${draft.length} selected` : 'All projects'}</span>
            <button type="button" onClick={apply} className="oc-btn-primary h-[32px] px-3 text-xs">
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
