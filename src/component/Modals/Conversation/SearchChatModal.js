import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSearch, FiMessageSquare, FiCalendar } from 'react-icons/fi';

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText = ({ text, term }) => {
    if (!term || !text) {
        return <>{text}</>;
    }

    const safeTerm = escapeRegExp(term);
    if (!safeTerm) {
        return <>{text}</>;
    }

    const regex = new RegExp(`(${safeTerm})`, 'ig');
    const segments = text.split(regex);
    const termLower = term.toLowerCase();

    return (
        <>
            {segments.map((segment, idx) => (
                segment.toLowerCase() === termLower ? (
                    <span
                        key={`${segment}-${idx}`}
                        className="bg-yellow-200 dark:bg-yellow-500/40 px-1 py-0.5 rounded"
                    >
                        {segment}
                    </span>
                ) : (
                    <React.Fragment key={`${segment}-${idx}`}>
                        {segment}
                    </React.Fragment>
                )
            ))}
        </>
    );
};

export const SearchChatModal = ({
    isOpen,
    onClose,
    query,
    onQueryChange,
    results,
    onResultClick,
    onDateClick
}) => {
    const inputRef = useRef(null);
    const [selectedDate, setSelectedDate] = useState('');
    const dateInputRef = useRef(null);
    const dateInputId = 'date-picker-input';

    useEffect(() => {
        if (!isOpen) {
            setSelectedDate('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            const id = requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
            return () => cancelAnimationFrame(id);
        }
    }, [isOpen]);

    const handleCalendarClick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        // Directly trigger the date picker
        if (!dateInputRef.current) return;
        
        const input = dateInputRef.current;
        
        // Temporarily move input into viewport for browser compatibility
        const originalStyle = input.style.cssText;
        input.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0; pointer-events: auto; width: 1px; height: 1px; z-index: 9999;';
        
        // Focus first
        input.focus();
        
        // Restore style function
        const restoreStyle = () => {
            setTimeout(() => {
                if (dateInputRef.current) {
                    dateInputRef.current.style.cssText = originalStyle;
                }
            }, 100);
        };
        
        // Try showPicker() first (works in Chrome, Edge, Safari 16.4+)
        if (typeof input.showPicker === 'function') {
            try {
                const pickerResult = input.showPicker();
                // Check if it returns a Promise
                if (pickerResult && typeof pickerResult.then === 'function') {
                    pickerResult
                        .then(() => {
                            restoreStyle();
                        })
                        .catch((err) => {
                            console.log('showPicker failed, using click fallback:', err);
                            // Fallback to click if showPicker fails
                            setTimeout(() => {
                                if (dateInputRef.current) {
                                    dateInputRef.current.click();
                                    restoreStyle();
                                }
                            }, 0);
                        });
                } else {
                    // showPicker doesn't return a Promise, use click fallback
                    setTimeout(() => {
                        if (dateInputRef.current) {
                            dateInputRef.current.click();
                            restoreStyle();
                        }
                    }, 0);
                }
            } catch (err) {
                console.log('showPicker error, using click fallback:', err);
                // Fallback to click if showPicker throws
                setTimeout(() => {
                    if (dateInputRef.current) {
                        dateInputRef.current.click();
                        restoreStyle();
                    }
                }, 0);
            }
        } else {
            // Fallback for older browsers - use click
            setTimeout(() => {
                if (dateInputRef.current) {
                    dateInputRef.current.click();
                    restoreStyle();
                }
            }, 0);
        }
    };

    const handleDateChange = (e) => {
        const date = e.target.value;
        // Restore original style
        if (dateInputRef.current) {
            dateInputRef.current.style.cssText = 'position: absolute; left: -9999px; opacity: 0; pointer-events: auto; width: 1px; height: 1px;';
        }
        
        if (date && onDateClick) {
            onDateClick(date);
            setSelectedDate('');
        }
    };

    const handleDateInputClick = (e) => {
        e.stopPropagation();
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 overscroll-contain"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.25 }}
                        className="w-full h-full sm:h-auto max-w-2xl rounded-none sm:rounded-2xl bg-white shadow-xl dark:bg-gray-800 flex flex-col mobile-modal-shell"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Search Chat</h3>
                            <button
                                onClick={onClose}
                                className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                aria-label="Close search modal"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4 px-5 py-4 flex-1 mobile-modal-body">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCalendarClick}
                                    className="flex-shrink-0 p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:border-blue-500 transition-colors"
                                    aria-label="Select date"
                                    title="Go to date"
                                >
                                    <FiCalendar className="h-5 w-5" />
                                </button>
                                <div className="relative flex-1">
                                    <FiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                                    <input
                                        ref={inputRef}
                                        value={query}
                                        onChange={(e) => onQueryChange(e.target.value)}
                                        placeholder="Search messages, media captions, locations..."
                                        className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-10 pr-3 text-base sm:text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-800"
                                        autoComplete="off"
                                        inputMode="text"
                                    />
                                </div>
                                {/* Hidden date input - positioned off-screen but still functional */}
                                <input
                                    id={dateInputId}
                                    ref={dateInputRef}
                                    type="date"
                                    value={selectedDate}
                                    onChange={handleDateChange}
                                    onClick={handleDateInputClick}
                                    style={{ 
                                        position: 'absolute', 
                                        left: '-9999px',
                                        opacity: 0,
                                        pointerEvents: 'auto',
                                        width: '1px',
                                        height: '1px',
                                        zIndex: -1
                                    }}
                                />
                            </div>

                            <div
                                className="max-h-[50vh] sm:max-h-80 space-y-2 overflow-y-auto overscroll-contain"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                {!query.trim() ? (
                                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                                        Start typing to search within the loaded messages for this chat.
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                                        No messages matched "{query}".
                                    </div>
                                ) : (
                                    results.map((result) => (
                                        <button
                                            key={result.messageKey}
                                            onClick={() => onResultClick(result.messageKey)}
                                            className="w-full rounded-xl border border-transparent bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:bg-gray-900 dark:hover:bg-gray-700"
                                        >
                                            <div className="flex items-start justify-between space-x-3">
                                                <div className="flex items-start space-x-3">
                                                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                                                        <FiMessageSquare className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                            {result.direction}
                                                        </p>
                                                        <p className="mt-1 text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                                                            <HighlightedText text={result.snippet} term={query} />
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    {result.date && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap mb-1">
                                                            {result.date}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                        {result.timestamp}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};