import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header, Sidebar } from '../component/Menu';
import { API_BASE_URL } from '../config/api';
import { Encrypt } from './encryption/payload-encryption';
import axios from 'axios';
import {
  FiAlertCircle,
  FiExternalLink,
  FiInfo,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiX,
} from 'react-icons/fi';

const COMMERCE_MANAGER_URL = 'https://business.facebook.com/commerce/';

function Catalogs() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebarMinimized')) === true;
    } catch {
      return false;
    }
  });
  const [tokens, setTokens] = useState(null);
  const [catalogs, setCatalogs] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [needsConnection, setNeedsConnection] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  const verifyConnectionOnFocusRef = useRef(false);

  const projectId = tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '';

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  const loadTokens = useCallback(() => {
    try {
      const saved = localStorage.getItem('userData');
      setTokens(saved ? JSON.parse(saved) : null);
    } catch (loadError) {
      console.error('Failed to read catalog page session:', loadError);
      setTokens(null);
    }
  }, []);

  useEffect(() => {
    loadTokens();
    window.addEventListener('projects-updated', loadTokens);
    return () => window.removeEventListener('projects-updated', loadTokens);
  }, [loadTokens]);

  const fetchCatalogs = useCallback(async (after = '', append = false, verifyConnection = false) => {
    if (!projectId) {
      setError('Select a project to view its product catalogs.');
      setCatalogs([]);
      setNextCursor('');
      return;
    }
    if (!tokens?.token || !tokens?.username) {
      setError('Your session is missing. Please sign in again.');
      return;
    }
    if (loadingRef.current) return;

    loadingRef.current = true;
    const requestId = ++requestIdRef.current;
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
            token: tokens.token,
            username: tokens.username,
            'Content-Type': 'application/json',
          },
        },
      );

      const body = response?.data || {};
      if (body.error && body.error !== false) {
        if (body.code === 'CATALOG_NOT_CONNECTED' || body.error?.code === 'CATALOG_NOT_CONNECTED') {
          setNeedsConnection(true);
          setCatalogs([]);
          setNextCursor('');
          setError('');
          return;
        }
        if (String(body.error).includes('Route POST /catalog/product-catalogs not found')) {
          throw new Error('The catalog API is not installed on the server yet. Deploy/restart the OneChatting server, then refresh this page.');
        }
        throw new Error(typeof body.error === 'string' ? body.error : body.message || 'Failed to load catalogs.');
      }

      const result = body.data || body;
      if (!Array.isArray(result.catalogs)) {
        throw new Error('AiSensy returned an unexpected catalog response.');
      }
      if (requestId !== requestIdRef.current) return;

      setCatalogs((current) => append ? [...current, ...result.catalogs] : result.catalogs);
      setNeedsConnection(!append && (
        typeof result.catalog_connected === 'boolean'
          ? !result.catalog_connected
          : result.catalogs.length === 0
      ));
      setNextCursor(typeof result.paging?.after === 'string' ? result.paging.after : '');
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      if (requestError?.response?.data?.error?.code === 'CATALOG_NOT_CONNECTED') {
        setNeedsConnection(true);
        setCatalogs([]);
        setNextCursor('');
        setError('');
        return;
      }
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Unable to load product catalogs.';
      setError(message);
      console.error('Failed to load product catalogs:', requestError);
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [projectId, tokens?.token, tokens?.username]);

  const connectCatalog = useCallback(async () => {
    if (!projectId || !tokens?.token || !tokens?.username) {
      setError(!projectId ? 'Select a project to connect a catalog.' : 'Your session is missing. Please sign in again.');
      return;
    }

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
            token: tokens.token,
            username: tokens.username,
            'Content-Type': 'application/json',
          },
        },
      );
      const result = response?.data?.data || response?.data;
      if (!result?.url) throw new Error('AiSensy did not return a catalog connection link.');
      verifyConnectionOnFocusRef.current = true;
      popup.location.href = result.url;
    } catch (requestError) {
      verifyConnectionOnFocusRef.current = false;
      popup.close();
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Unable to start the catalog connection.';
      setError(message);
      console.error('Failed to start catalog connection:', requestError);
    } finally {
      setConnecting(false);
    }
  }, [projectId, tokens?.token, tokens?.username]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadingRef.current = false;
    setLoading(false);
    setCatalogs([]);
    setNextCursor('');
    setNeedsConnection(false);
    setSelectedCatalog(null);
    fetchCatalogs();
  }, [fetchCatalogs]);

  useEffect(() => {
    const handleFocus = () => {
      if (!verifyConnectionOnFocusRef.current) return;
      verifyConnectionOnFocusRef.current = false;
      fetchCatalogs('', false, true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchCatalogs]);

  const filteredCatalogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalogs;
    return catalogs.filter((catalog) =>
      `${catalog.name || ''} ${catalog.id || ''} ${catalog.vertical || ''} ${catalog.business?.name || ''}`
        .toLowerCase()
        .includes(query),
    );
  }, [catalogs, search]);

  return (
    <div className="flex min-h-screen flex-col bg-surface-ground">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        isMinimized={isMinimized}
        setIsMinimized={setIsMinimized}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isMinimized={isMinimized}
          setIsMinimized={setIsMinimized}
        />
        <main className={`flex-1 overflow-y-auto pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
          <div className="mx-auto w-full max-w-[1320px] px-4 py-7 sm:px-7">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink">Product catalogs</h1>
                <p className="mt-1 text-sm text-slate-500">
                  View the catalogs connected to the selected WhatsApp project.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => needsConnection ? connectCatalog() : fetchCatalogs()}
                  disabled={loading || connecting}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {needsConnection
                    ? <FiExternalLink className="h-4 w-4" />
                    : <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
                  {needsConnection ? (connecting ? 'Connecting…' : 'Connect catalog') : 'Refresh'}
                </button>
                {!needsConnection && (
                  <a
                    href={COMMERCE_MANAGER_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <FiExternalLink className="h-4 w-4" />
                    Manage catalogs
                  </a>
                )}
              </div>
            </div>

            <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <FiInfo className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
              Connect a Meta catalog to this WhatsApp project to use it in conversations. Catalogs can be created or managed in Meta Commerce Manager.
              </p>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Connected catalogs <span className="ml-1 text-slate-400">({catalogs.length})</span>
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {projectId ? `Project: ${projectId}` : 'No project selected'}
                </p>
              </div>
              <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 sm:max-w-xs">
                <FiSearch className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search catalogs"
                  className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 focus:ring-0"
                />
              </label>
            </div>

            {error ? (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => fetchCatalogs()}
                    disabled={loading}
                    className="mt-2 font-semibold underline disabled:opacity-50"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {loading && catalogs.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">Loading catalogs…</div>
              ) : filteredCatalogs.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <FiShoppingBag className="h-7 w-7" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {search ? 'No matching catalogs' : 'No catalogs found'}
                  </h3>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    {search
                      ? 'Try another search term.'
                      : 'Connect a Meta catalog to this WhatsApp project to view and use it here.'}
                  </p>
                  {!search && (
                    <button
                      type="button"
                      onClick={needsConnection ? connectCatalog : () => fetchCatalogs()}
                      disabled={connecting || loading}
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {needsConnection ? (connecting ? 'Opening connection…' : 'Connect catalog') : 'Refresh catalogs'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCatalogs.map((catalog, index) => (
                    <button
                      type="button"
                      key={`${catalog.id || catalog.name || 'catalog'}-${index}`}
                      onClick={() => setSelectedCatalog(catalog)}
                      className="group flex min-h-36 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:shadow-sm"
                    >
                      {catalog.default_image_url ? (
                        <img
                          src={catalog.default_image_url}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <FiShoppingBag className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">
                          {catalog.name || 'Unnamed catalog'}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {Number(catalog.product_count) || 0} products · {catalog.vertical || 'Catalog'}
                        </span>
                        <span className="mt-2 block truncate font-mono text-[11px] text-slate-400">
                          ID: {catalog.id || '—'}
                        </span>
                        {catalog.business?.name && (
                          <span className="mt-1 block truncate text-xs text-slate-500">{catalog.business.name}</span>
                        )}
                      </span>
                      <FiInfo className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {nextCursor && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchCatalogs(nextCursor, true)}
                  disabled={loading}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50"
                >
                  {loading ? 'Loading…' : 'Load more catalogs'}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedCatalog && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCatalog(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="catalog-detail-title"
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="catalog-detail-title" className="text-lg font-bold text-slate-900">
                  {selectedCatalog.name || 'Unnamed catalog'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Catalog details from AiSensy</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCatalog(null)}
                aria-label="Close catalog details"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
              {[
                ['Catalog ID', selectedCatalog.id],
                ['Business', selectedCatalog.business?.name],
                ['Business ID', selectedCatalog.business?.id],
                ['Type', selectedCatalog.vertical],
                ['Products', selectedCatalog.product_count],
                ['Feeds', selectedCatalog.feed_count],
                ['Catalog segment', selectedCatalog.is_catalog_segment === undefined ? undefined : (selectedCatalog.is_catalog_segment ? 'Yes' : 'No')],
              ].filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="break-all text-right font-medium text-slate-800">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex justify-end">
              <a
                href={COMMERCE_MANAGER_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <FiExternalLink className="h-4 w-4" />
                Manage in Commerce Manager
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Catalogs;
