import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiMoreVertical } from 'react-icons/fi';

export default function RowActionMenu({ items = [], label = 'Open actions' }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const visible = items.filter((item) => item && !item.hidden);

    useEffect(() => {
        if (!open) return undefined;

        const place = () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;
            const menuWidth = 208;
            const estimatedHeight = visible.length * 40 + 12;
            const spaceBelow = window.innerHeight - rect.bottom;
            const top = spaceBelow < estimatedHeight && rect.top > estimatedHeight
                ? rect.top - estimatedHeight - 6
                : rect.bottom + 6;
            const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
            setPosition({ top, left });
        };

        place();
        const onPointer = (event) => {
            if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
            setOpen(false);
        };
        const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', () => setOpen(false), true);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', place);
        };
    }, [open, visible.length]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={label}
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
            >
                <FiMoreVertical className="h-4 w-4" />
            </button>
            {open && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 80, width: 208 }}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                >
                    {visible.map((item, index) => (
                        <button
                            key={`${item.label}-${index}`}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            onClick={() => {
                                setOpen(false);
                                item.onClick?.();
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'} ${item.danger && index > 0 ? 'border-t border-slate-100' : ''}`}
                        >
                            {item.icon ? <span className="text-current">{item.icon}</span> : null}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
