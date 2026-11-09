import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FiActivity, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { API_BASE_URL } from '../../config/api';
import { parseServerDate } from '../../utils/dateTime';
import { Encrypt } from '../../pages/encryption/payload-encryption';

function readEnvelope(response) {
    const body = response?.data;
    if (body?.success === false || body?.error) {
        throw new Error(body?.message || body?.error?.message || body?.error || 'Request failed');
    }
    return body;
}

function formatTimelineDate(value) {
    const date = parseServerDate(value);
    return date
        ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : 'Date unavailable';
}

export default function ContactTimelinePanel({ projectId, number, tokens, onOpenMessage }) {
    const [events, setEvents] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const requestVersion = useRef(0);

    const loadPage = useCallback(async (nextPage, append) => {
        if (!projectId || !number || !tokens?.token || !tokens?.username) return;
        const version = requestVersion.current;
        setLoading(true);
        setError('');
        try {
            const { data, key } = Encrypt({ project_id: projectId, number, page: nextPage, limit: 20 });
            const response = await axios.post(
                `${API_BASE_URL}/inbox/contact-timeline`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            const body = readEnvelope(response);
            if (version !== requestVersion.current) return;
            const rows = Array.isArray(body?.data) ? body.data : [];
            setEvents((current) => append ? [...current, ...rows] : rows);
            setPage(nextPage);
            setHasMore(Boolean(body?.meta?.has_more));
        } catch (loadError) {
            if (version === requestVersion.current) {
                setError(loadError?.message || 'Could not load contact activity.');
            }
        } finally {
            if (version === requestVersion.current) setLoading(false);
        }
    }, [number, projectId, tokens?.token, tokens?.username]);

    useEffect(() => {
        requestVersion.current += 1;
        setEvents([]);
        setPage(1);
        setHasMore(false);
        setError('');
        if (projectId && number && tokens?.token && tokens?.username) {
            loadPage(1, false);
        }
        return () => {
            requestVersion.current += 1;
        };
    }, [loadPage, number, projectId, tokens?.token, tokens?.username]);

    return (
        <section className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                        <FiActivity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Contact timeline</h4>
                </div>
                <button
                    type="button"
                    onClick={() => loadPage(1, false)}
                    disabled={loading}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                    aria-label="Refresh contact timeline"
                >
                    <FiRefreshCw className={`w-4 h-4 ${loading && events.length === 0 ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-4">
                {loading && events.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500 dark:text-gray-400">
                        <FiRefreshCw className="w-4 h-4 animate-spin" /> Loading activity…
                    </div>
                ) : error && events.length === 0 ? (
                    <div className="py-6 text-center">
                        <FiAlertCircle className="w-5 h-5 mx-auto mb-2 text-red-500" />
                        <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                        <button
                            type="button"
                            onClick={() => loadPage(1, false)}
                            className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Retry
                        </button>
                    </div>
                ) : events.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No activity for this contact yet.
                    </p>
                ) : (
                    <>
                        <ol className="space-y-4">
                            {events.map((event) => {
                                const eventId = String(event.event_id || '');
                                const messageId = eventId.match(/^chat:(\d+)$/)?.[1]
                                    || eventId.match(/^campaign-message:\d+:(\d+)$/)?.[1];
                                const content = (
                                    <>
                                    <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-4 ring-indigo-50 dark:ring-indigo-900/40" />
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{event.title}</p>
                                    {event.description && (
                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">
                                            {event.description}
                                        </p>
                                    )}
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {formatTimelineDate(event.occurred_at)}
                                        {event.actor ? ` · ${event.actor}` : ''}
                                    </p>
                                    </>
                                );
                                return (
                                    <li key={event.event_id} className="relative pl-5">
                                        {messageId && onOpenMessage ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenMessage(messageId)}
                                                className="w-full text-left rounded-lg hover:bg-indigo-50 dark:hover:bg-gray-700/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                aria-label={`Open conversation message from ${formatTimelineDate(event.occurred_at)}`}
                                            >
                                                {content}
                                            </button>
                                        ) : content}
                                    </li>
                                );
                            })}
                        </ol>
                        {error && (
                            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>
                        )}
                        {hasMore && (
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => loadPage(page + 1, true)}
                                className="mt-4 w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                                {loading ? 'Loading…' : 'Load older activity'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
