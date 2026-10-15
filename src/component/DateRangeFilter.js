import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import { FiCalendar, FiChevronDown, FiCheck, FiArrowRight } from 'react-icons/fi';
import 'react-datepicker/dist/react-datepicker.css';

/*
 * DateRangeFilter
 * ----------------
 * Compact, toolbar-aligned date range picker (same 42px height as .oc-input).
 * - Values in/out are 'YYYY-MM-DD' strings built from LOCAL dates (no toISOString,
 *   which shifts dates by a day in IST).
 * - Presets include Indian financial-year ranges (1 Apr – 31 Mar).
 * - Popover is portalled + fixed-positioned so it never gets clipped by cards/tables.
 *
 * Props:
 *   from, to          'YYYY-MM-DD' | ''
 *   onChange({ from, to })
 *   maxDate           'YYYY-MM-DD' (defaults to today)
 *   minDate           'YYYY-MM-DD' (optional)
 *   align             'left' | 'right' (popover alignment relative to trigger)
 *   className         extra classes for the trigger wrapper
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const toYMD = (date) => {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseYMD = (value) => {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const minDateOf = (a, b) => (a <= b ? a : b);

const formatShort = (date, withYear = true) =>
  date ? `${date.getDate()} ${MONTHS[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ''}` : '';

export const formatRangeLabel = (from, to) => {
  const start = parseYMD(from);
  const end = parseYMD(to);
  if (start && end) {
    if (toYMD(start) === toYMD(end)) return formatShort(start);
    const sameYear = start.getFullYear() === end.getFullYear();
    return `${formatShort(start, !sameYear)} – ${formatShort(end)}`;
  }
  if (start) return `From ${formatShort(start)}`;
  if (end) return `Until ${formatShort(end)}`;
  return 'All time';
};

const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000) + 1;

const buildPresets = (today) => {
  const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
  return [
    { key: 'today', label: 'Today', range: [today, today] },
    { key: 'yesterday', label: 'Yesterday', range: [addDays(today, -1), addDays(today, -1)] },
    { key: 'last7', label: 'Last 7 days', range: [addDays(today, -6), today] },
    { key: 'last30', label: 'Last 30 days', range: [addDays(today, -29), today] },
    { key: 'last90', label: 'Last 90 days', range: [addDays(today, -89), today] },
    { key: 'thisMonth', label: 'This month', range: [new Date(today.getFullYear(), today.getMonth(), 1), today] },
    {
      key: 'lastMonth',
      label: 'Last month',
      range: [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)],
    },
    { key: 'thisQuarter', label: 'This quarter', range: [new Date(today.getFullYear(), quarterStartMonth, 1), today] },
    { key: 'thisFY', label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`, hint: 'Current FY', range: [new Date(fyStartYear, 3, 1), today] },
    {
      key: 'lastFY',
      label: `FY ${fyStartYear - 1}-${String(fyStartYear).slice(-2)}`,
      hint: 'Previous FY',
      range: [new Date(fyStartYear - 1, 3, 1), new Date(fyStartYear, 2, 31)],
    },
  ];
};

const useIsWide = (query = '(min-width: 860px)') => {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : true);
  const [wide, setWide] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const handler = () => setWide(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler));
  }, [query]);
  return wide;
};

const PICKER_CSS = `
.oc-drp .react-datepicker { font-family: inherit; border: 0; background: transparent; display: flex; gap: 20px; overflow: visible; }
.oc-drp .react-datepicker__month-container,
.oc-drp .react-datepicker__month,
.oc-drp .react-datepicker__header { float: none; overflow: visible; }
.oc-drp .react-datepicker__header { background: transparent; border-bottom: 0; padding: 4px 0 0; }
.oc-drp .react-datepicker__current-month { font-size: 13px; font-weight: 700; color: #171426; margin-bottom: 8px; }
.oc-drp .react-datepicker__day-names { margin: 0; }
.oc-drp .react-datepicker__day-name { width: 36px; line-height: 28px; margin: 0; font-size: 11px; font-weight: 700; color: #7A7690; text-transform: uppercase; }
.oc-drp .react-datepicker__month { margin: 0; }
.oc-drp .react-datepicker__week { display: flex; }
.oc-drp .react-datepicker__day { width: 36px; height: 32px; line-height: 32px; margin: 0; border-radius: 0; font-size: 13px; font-weight: 500; color: #3D3954; position: relative; }
.oc-drp .react-datepicker__day:hover { background: #EBE8FC; border-radius: 8px; color: #4A3BC4; }
.oc-drp .react-datepicker__day--outside-month { visibility: hidden; pointer-events: none; }
.oc-drp .react-datepicker__day--today { font-weight: 800; color: #6C5CE7; }
.oc-drp .react-datepicker__day--today::after { content: ''; position: absolute; left: 50%; bottom: 4px; width: 4px; height: 4px; margin-left: -2px; border-radius: 9999px; background: currentColor; }
.oc-drp .react-datepicker__day--keyboard-selected { background: transparent; }
.oc-drp .react-datepicker__day--in-range,
.oc-drp .react-datepicker__day--in-selecting-range { background: #F4F2FE !important; color: #4A3BC4 !important; border-radius: 0; }
.oc-drp .react-datepicker__day--selected,
.oc-drp .react-datepicker__day--range-start,
.oc-drp .react-datepicker__day--range-end,
.oc-drp .react-datepicker__day--selecting-range-start,
.oc-drp .react-datepicker__day--selecting-range-end { background: #6C5CE7 !important; color: #fff !important; font-weight: 700; border-radius: 8px; }
.oc-drp .react-datepicker__day--range-start:not(.react-datepicker__day--range-end) { border-radius: 8px 0 0 8px; }
.oc-drp .react-datepicker__day--range-end:not(.react-datepicker__day--range-start) { border-radius: 0 8px 8px 0; }
.oc-drp .react-datepicker__day--disabled { color: #D5D2E2 !important; background: transparent !important; cursor: not-allowed; }
.oc-drp .react-datepicker__navigation { top: 2px; }
.oc-drp .react-datepicker__navigation-icon::before { border-color: #7A7690; border-width: 2px 2px 0 0; height: 7px; width: 7px; }
.oc-drp .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before { border-color: #6C5CE7; }
.dark .oc-drp .react-datepicker__current-month { color: #EEEDF6; }
.dark .oc-drp .react-datepicker__day { color: #D6D3E6; }
.dark .oc-drp .react-datepicker__day:hover { background: #2A2640; color: #fff; }
.dark .oc-drp .react-datepicker__day--in-range,
.dark .oc-drp .react-datepicker__day--in-selecting-range { background: rgba(108,92,231,0.22) !important; color: #E4E0FF !important; }
.dark .oc-drp .react-datepicker__day--disabled { color: #4A4560 !important; }
`;

export default function DateRangeFilter({
  from,
  to,
  onChange,
  maxDate,
  minDate,
  align = 'left',
  className = '',
  disabled = false,
}) {
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(parseYMD(from));
  const [draftEnd, setDraftEnd] = useState(parseYMD(to));
  const [pos, setPos] = useState(null);
  const [viewDate, setViewDate] = useState(null);
  const isWide = useIsWide();

  const today = useMemo(() => startOfDay(new Date()), []);
  const max = useMemo(() => parseYMD(maxDate) || today, [maxDate, today]);
  const min = useMemo(() => parseYMD(minDate), [minDate]);

  const presets = useMemo(
    () =>
      buildPresets(max).map((preset) => ({
        ...preset,
        range: [preset.range[0], minDateOf(preset.range[1], max)],
      })),
    [max]
  );

  const activePreset = useMemo(
    () => presets.find((p) => toYMD(p.range[0]) === from && toYMD(p.range[1]) === to),
    [presets, from, to]
  );

  const draftPreset = useMemo(
    () =>
      draftStart && draftEnd
        ? presets.find((p) => toYMD(p.range[0]) === toYMD(draftStart) && toYMD(p.range[1]) === toYMD(draftEnd))
        : null,
    [presets, draftStart, draftEnd]
  );

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(isWide ? 800 : 500, vw - 16);
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const spaceBelow = vh - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const needed = 430;
    const openUp = spaceBelow < needed && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    setPos({
      left,
      width,
      ...(openUp ? { bottom: vh - rect.top + 8 } : { top: rect.bottom + 8 }),
      ...(available < needed ? { maxHeight: available } : {}),
    });
  }, [align, isWide]);

  const openPicker = () => {
    if (disabled) return;
    setDraftStart(parseYMD(from));
    setDraftEnd(parseYMD(to));
    // Fix the visible months once per open, so the calendar doesn't jump while picking.
    // With two months visible, the range's end month sits on the right-hand side.
    const anchor = parseYMD(to) || parseYMD(from) || max;
    setViewDate(isWide ? new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1) : anchor);
    setOpen(true);
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
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (popRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
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

  const commit = (start, end) => {
    onChange?.({ from: toYMD(start), to: toYMD(end || start) });
    setOpen(false);
  };

  const applyPreset = (preset) => {
    setDraftStart(preset.range[0]);
    setDraftEnd(preset.range[1]);
    commit(preset.range[0], preset.range[1]);
  };

  const canApply = Boolean(draftStart);
  const dayCount = draftStart ? daysBetween(draftStart, draftEnd || draftStart) : 0;

  const popover =
    open && pos
      ? createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Select date range"
            style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, zIndex: 90 }}
            className={`oc-drp flex flex-col rounded-[14px] border border-line bg-white shadow-pop ${pos.maxHeight ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            <style>{PICKER_CSS}</style>
            <div className="flex min-w-0 flex-col sm:flex-row">
              {/* Presets */}
              <div className="min-w-0 max-w-full border-b border-line-soft p-2 sm:w-[172px] sm:shrink-0 sm:border-b-0 sm:border-r">
                <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-ink-400">Quick ranges</p>
                <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 scrollbar-hide sm:flex-col sm:gap-0.5 sm:overflow-visible sm:pb-0">
                  {presets.map((preset) => {
                    const active = draftPreset?.key === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className={`flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-[8px] px-2.5 py-[5px] text-left text-[13px] font-semibold transition-colors ${
                          active ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-surface-soft'
                        }`}
                      >
                        <span>
                          {preset.label}
                          {preset.hint ? <span className="ml-1.5 hidden text-[11px] font-medium text-ink-400 sm:inline">{preset.hint}</span> : null}
                        </span>
                        {active ? <FiCheck size={13} className="hidden sm:block" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calendar */}
              <div className="flex-1 p-4">
                <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className={`rounded-[9px] border px-3 py-1.5 ${!draftStart ? 'border-brand-600 ring-[3px] ring-brand-600/15' : 'border-line'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">From</p>
                    <p className="text-[13px] font-semibold text-ink">{draftStart ? formatShort(draftStart) : 'Pick a date'}</p>
                  </div>
                  <FiArrowRight className="text-ink-400" size={14} />
                  <div className={`rounded-[9px] border px-3 py-1.5 ${draftStart && !draftEnd ? 'border-brand-600 ring-[3px] ring-brand-600/15' : 'border-line'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">To</p>
                    <p className="text-[13px] font-semibold text-ink">{draftEnd ? formatShort(draftEnd) : draftStart ? 'Pick end date' : '—'}</p>
                  </div>
                </div>
                <div className="flex justify-center">
                  <DatePicker
                    inline
                    selectsRange
                    startDate={draftStart}
                    endDate={draftEnd}
                    selected={draftStart}
                    openToDate={viewDate || undefined}
                    onChange={(dates) => {
                      const [start, end] = dates || [];
                      setDraftStart(start ? startOfDay(start) : null);
                      setDraftEnd(end ? startOfDay(end) : null);
                    }}
                    maxDate={max}
                    minDate={min}
                    monthsShown={isWide ? 2 : 1}
                    calendarStartDay={1}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line-soft bg-surface-soft px-4 py-3">
              <p className="text-xs text-ink-500">
                {draftStart ? (
                  <>
                    <span className="font-semibold text-ink">{dayCount}</span> day{dayCount === 1 ? '' : 's'} selected
                    {!draftEnd ? <span className="text-ink-400"> · pick an end date or apply for a single day</span> : null}
                  </>
                ) : (
                  'Select a start date'
                )}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(false)} className="oc-btn-ghost h-[34px]">
                  Cancel
                </button>
                <button type="button" disabled={!canApply} onClick={() => commit(draftStart, draftEnd)} className="oc-btn-primary h-[34px]">
                  Apply range
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`group flex h-[42px] w-full items-center gap-2.5 rounded-[9px] border bg-white pl-2 pr-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-brand-600 ring-[3px] ring-brand-600/20' : 'border-line-strong hover:border-brand-400'
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-brand-50 text-brand-700">
          <FiCalendar size={14} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          {activePreset ? (
            <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-ink-400">{activePreset.label}</span>
          ) : null}
          <span className={`block truncate font-semibold text-ink ${activePreset ? 'text-[13px]' : 'text-sm'}`}>{formatRangeLabel(from, to)}</span>
        </span>
        <FiChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {popover}
    </div>
  );
}
