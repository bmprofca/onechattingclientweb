import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Header, Sidebar } from '../component/Menu';
import { fetchProjectInfo } from '../store/projectSlice';
import { Encrypt } from './encryption/payload-encryption';
import { FiArrowLeft, FiLock, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Pagination from '../component/Pagination';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';

function AgentConfig() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isOwner = useSelector((state) => state.project?.owned ?? false);
    const projectInfo = useSelector((state) => state.project?.info);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    const [projectId, setProjectId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // agentUsePersonalKey = the AUTHORITATIVE backend value.
    // Invariant this component now enforces: agentUsePersonalKey can only be
    // true if apiKeys.length > 0. We never call the toggle API in a way that
    // would break that invariant.
    const [agentUsePersonalKey, setAgentUsePersonalKey] = useState(true);
    const [apiKeys, setApiKeys] = useState([]);
    const [keyPage, setKeyPage] = useState(1);
    const [keyPageSize, setKeyPageSize] = useState(20);
    const [keyDetail, setKeyDetail] = useState(null);

    // selectedTab = purely local UI state for which panel is shown.
    // Clicking a tab does NOT necessarily persist anything to the backend
    // anymore — see handleTabChange.
    const [selectedTab, setSelectedTab] = useState('onechat'); // 'onechat' | 'personal'

    const [agentProvider, setAgentProvider] = useState('gemini');
    const [agentApiKey, setAgentApiKey] = useState('');
    const [isSavingKey, setIsSavingKey] = useState(false);

    const availableAgentProviders = [
        { value: 'gemini', label: 'Gemini' },
        { value: 'claude', label: 'Claude' },
        { value: 'openai', label: 'OpenAI' },
        { value: 'groq', label: 'Groq' }
    ];

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        if (projectInfo === null && dispatch) {
            dispatch(fetchProjectInfo());
        }
    }, [dispatch, projectInfo]);

    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (!userData) {
            setIsLoading(false);
            return;
        }
        try {
            const parsed = JSON.parse(userData);
            const id = parsed?.selected_project_id || parsed?.projects?.list?.[0]?.project_id || '';
            setProjectId(id);
        } catch (_) { }
    }, []);

    const getAuthHeaders = () => {
        const userDataRaw = localStorage.getItem('userData');
        try {
            const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
            if (parsed?.token && parsed?.username) {
                return { token: parsed.token, username: parsed.username };
            }
        } catch (_) { }
        return null;
    };

    // Returns the fetched keys (or null on failure) so callers can make
    // decisions based on the freshest data instead of racing React state.
    const fetchApiKeys = async () => {
        if (!projectId || !isOwner) return null;
        const auth = getAuthHeaders();
        if (!auth) {
            setIsLoading(false);
            return null;
        }

        try {
            const payload = { project_id: projectId };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/list-api-keys`,
                JSON.stringify({ data, key }),
                { headers: { ...auth, 'Content-Type': 'application/json' } }
            );

            if (!response?.data?.error && response?.data?.data) {
                const usePersonal = Boolean(response.data.data.agent_use_personal_key);
                const keys = response.data.data.keys || [];
                setAgentUsePersonalKey(usePersonal);
                setApiKeys(keys);
                setSelectedTab(usePersonal ? 'personal' : 'onechat');
                return { usePersonal, keys };
            }
        } catch (error) {
            console.error('Failed to fetch api keys', error);
        } finally {
            setIsLoading(false);
        }
        return null;
    };

    useEffect(() => {
        if (projectId && isOwner) {
            fetchApiKeys();
        } else if (!isOwner) {
            setIsLoading(false);
        }
    }, [projectId, isOwner]);

    // Low-level call. Callers are responsible for only invoking this when the
    // resulting state is valid (i.e. never usePersonal=true with zero keys).
    const handleTogglePersonalKey = async (usePersonal) => {
        if (!projectId) return false;
        const auth = getAuthHeaders();
        if (!auth) {
            toast.error('Session expired. Please log in again.');
            return false;
        }

        try {
            const payload = { project_id: projectId, agent_use_personal_key: usePersonal };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/toggle-personal-key`,
                JSON.stringify({ data, key }),
                { headers: { ...auth, 'Content-Type': 'application/json' } }
            );

            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to update setting');
                return false;
            }

            setAgentUsePersonalKey(usePersonal);
            toast.success(response?.data?.msg || 'Updated successfully');
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to update setting');
            return false;
        }
    };

    // This is the click handler for the OneChat's / Personal tab pair.
    // Switching to "Personal" only flips the backend flag if a key is
    // already saved. If there are no keys yet, we just show the panel and
    // let handleSaveApiKey flip the flag once a key actually exists.
    const handleTabChange = async (tab) => {
        if (tab === selectedTab) return;

        if (tab === 'onechat') {
            setSelectedTab('onechat');
            if (agentUsePersonalKey) {
                await handleTogglePersonalKey(false);
            }
            return;
        }

        // tab === 'personal'
        setSelectedTab('personal');
        if (!agentUsePersonalKey && apiKeys.length > 0) {
            // Keys already exist from before — safe to re-enable immediately.
            await handleTogglePersonalKey(true);
        }
        // else: no keys yet, stay in "not enabled" state until one is saved.
    };

    const handleSaveApiKey = async () => {
        if (!projectId || !agentApiKey.trim()) return;
        const auth = getAuthHeaders();
        if (!auth) {
            toast.error('Session expired. Please log in again.');
            return;
        }

        setIsSavingKey(true);
        try {
            const payload = {
                project_id: projectId,
                api_provider: agentProvider,
                api_key: agentApiKey
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/save-api-key`,
                JSON.stringify({ data, key }),
                { headers: { ...auth, 'Content-Type': 'application/json' } }
            );

            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to save API key');
                return;
            }

            toast.success('API key saved successfully');
            setAgentApiKey(''); // reset input
            const result = await fetchApiKeys(); // refresh list, get fresh truth

            // First key just landed — flip the backend flag on now that it's
            // actually valid to do so. fetchApiKeys() will already reflect
            // whatever the backend says, but if the backend hasn't been told
            // yet (usePersonal still false) and we now have a key, tell it.
            if (result && !result.usePersonal && result.keys.length > 0) {
                const ok = await handleTogglePersonalKey(true);
                if (ok) setSelectedTab('personal');
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save API key');
        } finally {
            setIsSavingKey(false);
        }
    };

    const handleDeleteApiKey = async (keyUniqueId) => {
        if (!projectId || !keyUniqueId) return;
        const auth = getAuthHeaders();
        if (!auth) {
            toast.error('Session expired. Please log in again.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this API key?')) return;

        const wasActive = apiKeys.find((k) => k.unique_id === keyUniqueId)?.is_active;

        try {
            const payload = { project_id: projectId, key_unique_id: keyUniqueId };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/delete-api-key`,
                JSON.stringify({ data, key }),
                { headers: { ...auth, 'Content-Type': 'application/json' } }
            );

            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to delete API key');
                return;
            }

            toast.success('API key deleted successfully');
            const result = await fetchApiKeys(); // refresh list, get fresh truth

            // That was the last key — the backend can't legitimately keep
            // agent_use_personal_key = true with nothing to call, so fall
            // back to OneChat's managed provider automatically.
            if (result && result.keys.length === 0 && result.usePersonal) {
                const ok = await handleTogglePersonalKey(false);
                if (ok) {
                    setSelectedTab('onechat');
                    toast('Switched back to OneChat\'s provider — no personal keys left.', { icon: '\u2139\ufe0f' });
                }
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to delete API key');
        }
    };



    if (!isOwner) {
        return (
            <div className="min-h-screen bg-surface-ground">
                <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                    <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                        <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
                            <FiLock className="w-14 h-14 mx-auto text-slate-300 mb-4" />
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Access denied</h2>
                            <p className="text-slate-600 mb-6">Only the project admin can access agent configuration.</p>
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="oc-btn-primary"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const personalEnabledButNoKeys = selectedTab === 'personal' && apiKeys.length === 0 && !agentUsePersonalKey;
    const providerHints = {
        claude: 'Anthropic',
        openai: 'GPT models',
        gemini: 'Google',
        groq: 'Fast open models',
    };
    const providerOrder = ['claude', 'openai', 'gemini', 'groq'];
    const orderedProviders = providerOrder
        .map((value) => availableAgentProviders.find((provider) => provider.value === value))
        .filter(Boolean);
    const selectedProvider = orderedProviders.find((provider) => provider.value === agentProvider) || orderedProviders[0];
    const keyPageCount = Math.max(1, Math.ceil(apiKeys.length / keyPageSize) || 1);
    const safeKeyPage = Math.min(keyPage, keyPageCount);
    const pagedKeys = apiKeys.slice((safeKeyPage - 1) * keyPageSize, safeKeyPage * keyPageSize);

    return (
        <div className="min-h-screen bg-surface-ground">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-6 flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/project-config')}
                            className="mt-1.5 flex h-8 w-8 items-center justify-center rounded-[9px] text-ink-500 hover:bg-[#F3F2FA] hover:text-ink"
                            aria-label="Back to configuration"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="oc-page-title">AI agent</h1>
                            <p className="oc-page-sub">Choose the provider that writes AI auto-replies, and whether to use your own API key.</p>
                        </div>
                    </div>

                    <div className="oc-card p-5 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-[15px] font-bold text-ink">Provider</h2>
                            {isLoading && (
                                <span className="inline-block h-5 w-5 border-2 border-line border-t-brand-600 rounded-full animate-spin" />
                            )}
                        </div>
                        <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {orderedProviders.map((provider) => {
                                const selected = agentProvider === provider.value;
                                return (
                                    <button
                                        key={provider.value}
                                        type="button"
                                        onClick={() => setAgentProvider(provider.value)}
                                        className={`rounded-[12px] border px-3.5 py-3 text-left transition-colors ${selected ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-[#D5D2E4]'}`}
                                    >
                                        <span className="block text-sm font-bold text-ink">{provider.label}</span>
                                        <span className="mt-0.5 block text-xs text-ink-500">{providerHints[provider.value]}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <label className="mt-5 flex items-start gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedTab === 'personal'}
                                onChange={(event) => handleTabChange(event.target.checked ? 'personal' : 'onechat')}
                                className="mt-0.5 h-4 w-4 rounded accent-[#6C5CE7]"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-ink">Use my own API key</span>
                                <span className="mt-0.5 block text-xs text-ink-500">
                                    {selectedTab === 'personal' && selectedProvider
                                        ? `Usage is billed by ${selectedProvider.label} directly instead of through AI bills. Required for document uploads in Company context.`
                                        : 'OneChatting uses its managed provider. Turn this on to bill the provider directly with your key.'}
                                </span>
                            </span>
                        </label>
                        <p className="mt-2 text-xs text-ink-400">
                            {agentUsePersonalKey
                                ? 'Currently active: your personal API key.'
                                : 'Currently active: OneChatting\'s managed provider.'}
                        </p>

                        {selectedTab === 'personal' ? (
                            <div className="mt-5 border-t border-line pt-5">
                                {personalEnabledButNoKeys && (
                                    <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800 mb-4">
                                        Personal key mode isn&apos;t active yet. Add at least one API key and it will switch on automatically.
                                    </div>
                                )}
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <div className="flex-1">
                                        <label className="oc-label" htmlFor="agent-api-key">{selectedProvider ? `${selectedProvider.label} API key` : 'API key'}</label>
                                        <input
                                            id="agent-api-key"
                                            type="password"
                                            value={agentApiKey}
                                            onChange={(e) => setAgentApiKey(e.target.value)}
                                            placeholder="Enter your provider API key"
                                            className="oc-input"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSaveApiKey}
                                        disabled={isSavingKey || !agentApiKey.trim()}
                                        className="oc-btn-primary"
                                    >
                                        {isSavingKey ? 'Saving...' : 'Save key'}
                                    </button>
                                </div>

                                <h3 className="mt-6 text-sm font-bold text-ink">Saved API keys</h3>
                                {apiKeys.length > 1 && (
                                    <p className="mt-1 text-xs text-ink-400">
                                        You have multiple keys saved. Only the one marked <span className="font-semibold text-emerald-700">Active</span> is used for auto-reply.
                                    </p>
                                )}

                                {isLoading ? (
                                    <div className="mt-3 overflow-hidden rounded-[12px] border border-line">
                                        <table className="min-w-full">
                                            <thead>
                                                <tr>
                                                    {['#', 'Provider', 'API key', 'Status', 'Actions'].map((label) => (
                                                        <th key={label} className={`oc-th ${label === '#' ? 'w-12 text-center' : ''}`}>{label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <TableSkeletonRows rows={3} cells={['index', 'text', 'text', 'badge', 'action']} />
                                            </tbody>
                                        </table>
                                    </div>
                                ) : apiKeys.length === 0 ? (
                                    <p className="mt-3 rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-500">
                                        No personal API keys saved yet.
                                    </p>
                                ) : (
                                    <div className="mt-3 overflow-hidden rounded-[12px] border border-line">
                                        <table className="min-w-full">
                                            <thead>
                                                <tr>
                                                    <th className="oc-th w-12 text-center">#</th>
                                                    <th className="oc-th">Provider</th>
                                                    <th className="oc-th">API key</th>
                                                    <th className="oc-th">Status</th>
                                                    <th className="oc-th text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedKeys.map((keyObj, index) => (
                                                    <tr key={keyObj.unique_id} className="hover:bg-[#FAFAFD]">
                                                        <td className="oc-td text-center text-xs font-semibold text-ink-500 oc-num">{(safeKeyPage - 1) * keyPageSize + index + 1}</td>
                                                        <td className="oc-td text-sm font-semibold text-ink capitalize">{keyObj.api_provider}</td>
                                                        <td className="oc-td text-sm text-ink-500 font-mono">{keyObj.api_key_masked}</td>
                                                        <td className="oc-td text-sm">
                                                            {keyObj.is_active ? (
                                                                <span className="oc-badge bg-emerald-50 text-emerald-700" title="This key is currently used for auto-reply">Active</span>
                                                            ) : (
                                                                <span className="oc-badge bg-[#F3F2FA] text-ink-500">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="oc-td text-right whitespace-nowrap">
                                                            <button type="button" onClick={() => setKeyDetail(keyObj)} className="mr-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink">
                                                                <FiEye className="w-3.5 h-3.5" /> Details
                                                            </button>
                                                            <button type="button" onClick={() => handleDeleteApiKey(keyObj.unique_id)} className="h-8 px-3 rounded-[9px] border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50">
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <Pagination
                                            currentPage={safeKeyPage}
                                            totalPages={keyPageCount}
                                            totalRecords={apiKeys.length}
                                            pageSize={keyPageSize}
                                            onPageChange={setKeyPage}
                                            onPageSizeChange={(size) => {
                                                setKeyPageSize(size);
                                                setKeyPage(1);
                                            }}
                                            pageSizeOptions={[10, 20, 50, 100]}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="mt-5 rounded-[12px] border border-line bg-[#F7F6FB] p-4 text-sm text-ink-500">
                                OneChatting will use its managed provider for this agent. No provider key is required.
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <RecordDetailsModal
                isOpen={Boolean(keyDetail)}
                onClose={() => setKeyDetail(null)}
                title={keyDetail?.api_provider || 'API key'}
                fields={keyDetail ? [
                    { label: 'Provider', value: keyDetail.api_provider },
                    { label: 'API key', value: keyDetail.api_key_masked },
                    { label: 'Status', value: keyDetail.is_active ? 'Active' : 'Inactive' },
                ] : []}
            />
        </div>
    );
}

export default AgentConfig;