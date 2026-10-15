import React from 'react';

const TONES = {
  brand: { tile: 'bg-brand-50 text-brand-700', bar: 'bg-brand-600', value: 'text-ink' },
  emerald: { tile: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', value: 'text-emerald-600' },
  rose: { tile: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500', value: 'text-rose-600' },
  amber: { tile: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', value: 'text-ink' },
  ink: { tile: 'bg-surface-soft text-ink-700', bar: 'bg-ink-400', value: 'text-ink' },
};

/** KPI tile used on the billing pages. Equal height in a grid; value never wraps under the icon. */
export default function StatCard({ icon: Icon, label, value, hint, tone = 'brand', valueTone, loading = false }) {
  const t = TONES[tone] || TONES.brand;
  const valueClass = valueTone ? (TONES[valueTone] || TONES.brand).value : t.value;
  return (
    <div className="oc-card relative flex h-full flex-col overflow-hidden p-4 sm:p-5">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${t.bar} opacity-80`} aria-hidden="true" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-500">{label}</p>
        {Icon ? (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${t.tile}`}>
            <Icon size={17} />
          </span>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-3 h-[26px] w-2/3 animate-pulse rounded-md bg-surface-soft" />
      ) : (
        <p className={`mt-2 truncate font-mono text-[18px] font-bold leading-tight tracking-tight sm:text-[22px] lg:text-[24px] ${valueClass}`} title={typeof value === 'string' ? value : undefined}>
          {value}
        </p>
      )}
      {hint ? <p className="mt-1.5 truncate text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}
