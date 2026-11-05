import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiRefreshCw, FiShoppingBag, FiX } from 'react-icons/fi';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { Encrypt } from '../../pages/encryption/payload-encryption';

const ProductCatalogsModal = ({ isOpen, onClose, tokens, darkMode }) => {
    const [catalogs, setCatalogs] = useState([]);
    const [nextCursor, setNextCursor] = useState('');
    const [loading, setLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [needsConnection, setNeedsConnection] = useState(false);
    const [error, setError] = useState('');
    const loadingRef = useRef(false);
    const verifyConnectionOnFocusRef = useRef(false);
    const projectId = tokens?.selected_project_id || '';

    const loadCatalogs = useCallback(async (after = '', append = false, verifyConnection = false) => {
        if (!projectId) {
            setError('Select a project before viewing product catalogs.');
            return;
        }
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setNeedsConnection(false);
        setError('');

        try {
            const payload = { project_id: projectId };
            if (after) payload.after = after;
            if (verifyConnection) payload.verify_connection = true;
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/catalog/product-catalogs`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token: tokens?.token || '',
                        username: tokens?.username || '',
                        'Content-Type': 'application/json',
                    },
                },
            );
            const result = response.data?.data ?? response.data;
            if (!Array.isArray(result?.catalogs)) {
                throw new Error('AiSensy returned an invalid catalogs response');
            }
            setCatalogs((current) => append ? [...current, ...result.catalogs] : result.catalogs);
            setNeedsConnection(!append && (
                typeof result.catalog_connected === 'boolean'
                    ? !result.catalog_connected
                    : result.catalogs.length === 0
            ));
            setNextCursor(typeof result?.paging?.after === 'string' ? result.paging.after : '');
        } catch (requestError) {
            if (requestError?.response?.data?.error?.code === 'CATALOG_NOT_CONNECTED') {
                setNeedsConnection(true);
                setCatalogs([]);
                setNextCursor('');
                setError('');
                return;
            }
            setError(
                requestError?.response?.data?.message ||
                requestError?.response?.data?.error?.message ||
                requestError?.message ||
                'Failed to load product catalogs',
            );
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [projectId, tokens?.token, tokens?.username]);

    useEffect(() => {
        if (!isOpen) return;
        const handleFocus = () => {
            if (!verifyConnectionOnFocusRef.current) return;
            verifyConnectionOnFocusRef.current = false;
            loadCatalogs('', false, true);
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [isOpen, loadCatalogs]);

    const connectCatalog = useCallback(async () => {
        const popup = window.open('about:blank', '_blank');
        if (!popup) {
            setError('Allow pop-ups to open the AiSensy catalog connection page.');
            return;
        }

        setConnecting(true);
        setError('');
        try {
            const { data, key } = Encrypt({ project_id: projectId });
            const response = await axios.post(
                `${API_BASE_URL}/catalog/connect-link`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token: tokens?.token || '',
                        username: tokens?.username || '',
                        'Content-Type': 'application/json',
                    },
                },
            );
            const result = response.data?.data ?? response.data;
            if (!result?.url) throw new Error('AiSensy did not return a catalog connection link.');
            verifyConnectionOnFocusRef.current = true;
            popup.location.href = result.url;
        } catch (requestError) {
            verifyConnectionOnFocusRef.current = false;
            popup.close();
            setError(
                requestError?.response?.data?.error?.message ||
                requestError?.response?.data?.message ||
                requestError?.message ||
                'Unable to start the catalog connection.',
            );
        } finally {
            setConnecting(false);
        }
    }, [projectId, tokens?.token, tokens?.username]);

    useEffect(() => {
        if (!isOpen) return;
        setCatalogs([]);
        setNextCursor('');
        loadCatalogs();
    }, [isOpen, loadCatalogs]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="product-catalogs-title"
                        className={`flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl ${
                            darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
                        }`}
                        initial={{ y: 20, scale: 0.98 }}
                        animate={{ y: 0, scale: 1 }}
                        exit={{ y: 20, scale: 0.98 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className={`flex items-center justify-between border-b p-5 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-3">
                                <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
                                    <FiShoppingBag className="h-5 w-5" />
                                </span>
                                <div>
                                    <h2 id="product-catalogs-title" className="text-lg font-semibold">Product catalogs</h2>
                                    <p className={`mt-0.5 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Catalogs connected to this WhatsApp account
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => loadCatalogs()}
                                    disabled={loading}
                                    className={`rounded-lg p-2 transition ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'} disabled:opacity-50`}
                                    aria-label="Refresh catalogs"
                                >
                                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className={`rounded-lg p-2 ${darkMode ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
                                    aria-label="Close catalogs"
                                >
                                    <FiX className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="overflow-y-auto p-5">
                            {error && catalogs.length === 0 ? (
                                <div className={`rounded-xl border p-4 text-sm ${darkMode ? 'border-red-900 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                    <p>{error}</p>
                                    <button
                                        type="button"
                                        onClick={() => loadCatalogs()}
                                        disabled={loading}
                                        className="mt-3 font-semibold underline disabled:opacity-50"
                                    >
                                        Try again
                                    </button>
                                </div>
                            ) : loading && catalogs.length === 0 ? (
                                <div className={`py-12 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Loading product catalogs…
                                </div>
                            ) : catalogs.length === 0 ? (
                                <div className={`flex flex-col items-center gap-4 py-12 text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <p>{needsConnection ? 'Connect a Meta catalog to use it in conversations.' : 'No product catalogs are connected to this account.'}</p>
                                    {needsConnection && (
                                        <button
                                            type="button"
                                            onClick={connectCatalog}
                                            disabled={connecting}
                                            className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                        >
                                            {connecting ? 'Opening connection…' : 'Connect catalog'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {error && (
                                        <div className={`rounded-xl border p-3 text-sm ${darkMode ? 'border-red-900 bg-red-950/30 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                            {error}
                                        </div>
                                    )}
                                    {catalogs.map((catalog, index) => (
                                        <div
                                            key={`${catalog.id || catalog.name || 'catalog'}-${index}`}
                                            className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'}`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <h3 className="truncate font-semibold">{catalog.name || 'Unnamed catalog'}</h3>
                                                    <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                                        {catalog.product_count ?? 0} products · {catalog.vertical || 'Catalog'}
                                                    </p>
                                                    {catalog.business?.name && (
                                                        <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            {catalog.business.name}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                    {catalog.vertical || 'Catalog'}
                                                </span>
                                            </div>
                                            <p className={`mt-3 break-all font-mono text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                                                ID: {catalog.id}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {nextCursor && catalogs.length > 0 && (
                            <div className={`border-t p-4 ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                                <button
                                    type="button"
                                    onClick={() => loadCatalogs(nextCursor, true)}
                                    disabled={loading}
                                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    {loading ? 'Loading…' : error ? 'Retry loading more' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ProductCatalogsModal;
