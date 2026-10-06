import React, { useState } from 'react';
import { FiList } from 'react-icons/fi';
import { getInteractiveOptions, normalizeInteractiveMessage } from '../../utils/interactiveMessage';
import InteractiveOptionsModal from './InteractiveOptionsModal';
import WhatsAppText from '../WhatsAppText';

export default function InteractiveMessageRenderer({ msg, isOwnMessage = false, onSelectOption }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const normalized = normalizeInteractiveMessage(msg);
    const { interactive, interactive_reply: reply } = normalized;
    const options = getInteractiveOptions(msg);
    const body = interactive.body?.text || msg.message || '';
    const buttonLabel = interactive.action?.button || 'Choose an Option';

    return (
        <>
            <div className={`w-full max-w-[min(85vw,360px)] overflow-hidden rounded-2xl p-3.5 transition-all ${
                isOwnMessage 
                    ? '' 
                    : 'bg-gray-100/90 text-gray-800 dark:bg-[#1f2c34] dark:text-gray-100'
            }`}>
                {/* Mode 1: Selected Option / Interactive Reply */}
                {reply ? (
                    <div className="relative pl-3.5 py-0.5 border-l-3 border-emerald-500 dark:border-emerald-400">
                        {interactive.header?.text && (
                            <div className="text-xs font-bold tracking-wide text-emerald-700 dark:text-emerald-400">
                                <WhatsAppText text={interactive.header.text} />
                            </div>
                        )}
                        {body && (
                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
                                <WhatsAppText text={body} />
                            </div>
                        )}
                        
                        {/* Selected Entity Details - separated cleanly by font-weight, color & size without box borders */}
                        <div className="mt-2.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                                {reply.title || reply.id}
                            </div>
                            {reply.description && (
                                <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 leading-normal">
                                    {reply.description}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Mode 2: Interactive Prompt with Modal Trigger */
                    <div className="space-y-3">
                        {interactive.header?.text && (
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                <WhatsAppText text={interactive.header.text} />
                            </div>
                        )}
                        
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                            <WhatsAppText text={body} />
                        </p>

                        {interactive.footer?.text && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                <WhatsAppText text={interactive.footer.text} />
                            </p>
                        )}

                        {/* Interactive Option Button */}
                        {options.length > 0 && (
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white dark:bg-gray-800/80 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 shadow-xs hover:bg-emerald-50 dark:hover:bg-gray-800 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <FiList className="h-4 w-4" />
                                <span>{buttonLabel}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Modal for Selecting Options */}
            <InteractiveOptionsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                headerTitle={interactive.header?.text || buttonLabel}
                bodyText={body}
                options={options}
                onSelectOption={(selectedOption) => {
                    if (onSelectOption) {
                        onSelectOption(selectedOption, msg);
                    }
                }}
            />
        </>
    );
}

