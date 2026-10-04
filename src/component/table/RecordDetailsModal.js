import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function RecordDetailsModal({ isOpen, onClose, title = 'Details', subtitle, fields = [] }) {
    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button type="button" aria-label="Close details" className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
            <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <FiX className="h-5 w-5" />
                    </button>
                </div>
                <div className="overflow-y-auto px-6 py-4">
                    <dl className="divide-y divide-slate-100">
                        {fields.map((field) => (
                            <div key={field.label} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                                <dt className="text-sm font-medium text-slate-500">{field.label}</dt>
                                <dd className="text-sm text-slate-900 sm:col-span-2 whitespace-pre-wrap break-words">{field.value || '—'}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </div>
    );
}
