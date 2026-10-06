import React from 'react';
import { FiX, FiChevronRight } from 'react-icons/fi';
import WhatsAppText from '../WhatsAppText';

export default function InteractiveOptionsModal({
    isOpen,
    onClose,
    headerTitle,
    bodyText,
    options = [],
    onSelectOption
}) {
    if (!isOpen) return null;

    // Group options by section title if available
    const groupedOptions = options.reduce((acc, option) => {
        const section = option.sectionTitle || 'Options';
        if (!acc[section]) acc[section] = [];
        acc[section].push(option);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-xs animate-fadeIn">
            {/* Backdrop click handler */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl transition-all dark:bg-[#1f2c34]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {headerTitle || 'Select an Option'}
                        </h3>
                        {bodyText && (
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                <WhatsAppText text={bodyText} />
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                        aria-label="Close options"
                    >
                        <FiX className="h-5 w-5" />
                    </button>
                </div>

                {/* Options List */}
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
                    {Object.entries(groupedOptions).map(([sectionTitle, items]) => (
                        <div key={sectionTitle} className="space-y-1">
                            {Object.keys(groupedOptions).length > 1 && (
                                <div className="px-3 pt-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    {sectionTitle}
                                </div>
                            )}
                            <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                                {items.map((option, idx) => (
                                    <button
                                        key={option.id || `${option.title}-${idx}`}
                                        onClick={() => {
                                            if (onSelectOption) onSelectOption(option);
                                            onClose();
                                        }}
                                        className="group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 active:scale-[0.99]"
                                    >
                                        <div className="flex-1 pr-3">
                                            <div className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 dark:text-gray-100 dark:group-hover:text-emerald-400 transition-colors">
                                                {option.title}
                                            </div>
                                            {option.description && (
                                                <div className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                                    {option.description}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 group-hover:bg-emerald-600 group-hover:text-white dark:bg-gray-800 dark:text-gray-500 dark:group-hover:bg-emerald-500 dark:group-hover:text-white transition-colors">
                                            <FiChevronRight className="h-4 w-4" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
