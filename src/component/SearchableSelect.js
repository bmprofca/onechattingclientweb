import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCheck, FiChevronDown, FiSearch } from 'react-icons/fi';

const menuMaxHeight = 280;

function optionValue(option) {
  return option?.value ?? '';
}

function optionLabel(option) {
  if (option?.label != null && option.label !== '') return String(option.label);
  return String(optionValue(option));
}

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  name,
  placeholder = 'Select',
  disabled = false,
  className = '',
  id,
  searchable = true,
  emptyText = 'No matches',
}) {
  const autoId = useId();
  const controlId = id || autoId;
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);

  const selected = options.find((option) => String(optionValue(option)) === String(value ?? ''));
  const display = selected ? optionLabel(selected) : placeholder;
  const isPlaceholder = !selected || optionValue(selected) === '';

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => optionLabel(option).toLowerCase().includes(term));
  }, [options, query]);

  const placeMenu = () => {
    const trigger = rootRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuMaxHeight && rect.top > spaceBelow;
    const width = rect.width;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width,
      zIndex: 80,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    const onReflow = () => placeMenu();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const selectedIndex = filtered.findIndex((option) => String(optionValue(option)) === String(value ?? ''));
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const choose = (option) => {
    if (!option || option.disabled) return;
    onChange?.({ target: { name, value: optionValue(option) } });
    setOpen(false);
  };

  const onTriggerKeyDown = (event) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      rootRef.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      choose(filtered[highlight]);
    }
  };

  const menu = open && menuStyle ? createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800"
      onKeyDown={onMenuKeyDown}
    >
      {searchable && (
        <div className="p-2 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              placeholder="Search"
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      )}
      <ul className="max-h-60 overflow-y-auto py-1" role="listbox" aria-labelledby={controlId}>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{emptyText}</li>
        ) : (
          filtered.map((option, index) => {
            const isSelected = String(optionValue(option)) === String(value ?? '');
            const isActive = index === highlight;
            return (
              <li key={`${String(optionValue(option))}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(option)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 ${
                    option.disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : isActive
                        ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-100'
                        : 'text-gray-800 dark:text-gray-100'
                  }`}
                >
                  <span className="truncate">{optionLabel(option)}</span>
                  {isSelected && <FiCheck className="shrink-0 text-indigo-600" size={14} />}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={rootRef}
        id={controlId}
        type="button"
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
        className={`relative pr-8 text-left disabled:opacity-50 disabled:cursor-not-allowed ${className || 'w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500'}`}
      >
        <span className={`block truncate ${isPlaceholder ? 'text-gray-500 dark:text-gray-400' : ''}`}>{display}</span>
        <FiChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} size={16} />
      </button>
      {menu}
    </>
  );
}
