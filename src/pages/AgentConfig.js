import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import { fetchProjectInfo } from '../store/projectSlice';
import { Encrypt } from './encryption/payload-encryption';
import { FiArrowLeft, FiShield, FiLock, FiTrash2, FiPlus, FiEye } from 'react-icons/fi';
import toast from 'react-hot-toast';
import RowActionMenu from '../component/table/RowActionMenu';
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
            <div className="min-h-screen bg-slate-50">
                <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                    <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-8">
                        <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
                            <FiLock className="w-14 h-14 mx-auto text-slate-300 mb-4" />
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Access denied</h2>
                            <p className="text-slate-600 mb-6">Only the project admin can access agent configuration.</p>
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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

    return (
        <div className="min-h-screen bg-slate-50">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-8">
                    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <button
                                type="button"
                                onClick={() => navigate('/project-config')}
                                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                            >
                                <FiArrowLeft className="w-4 h-4" />
                                Back to Project Config
                            </button>
                            <h1 className="text-2xl font-bold text-slate-800 mt-4">Agent Configuration</h1>
                            <p className="mt-1 text-slate-600">Configure the auto-reply agent provider and personal key settings.</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-violet-100 p-3 text-violet-600">
                                        <FiShield className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-800">Agent provider and key settings</h2>
                                        <p className="text-sm text-slate-500">Choose your provider and whether to use a personal API key.</p>
                                    </div>
                                </div>
                                {isLoading && (
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <span className="inline-block h-5 w-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm">Loading...</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6">
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange('onechat')}
                                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${selectedTab === 'onechat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        OneChat's
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTabChange('personal')}
                                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${selectedTab === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        Personal
                                    </button>
                                </div>
                                {/* Explicit status so it's never ambiguous what the backend is actually doing */}
                                <p className="mt-2 text-xs text-slate-400">
                                    {agentUsePersonalKey
                                        ? 'Currently active: your personal API key.'
                                        : 'Currently active: OneChat\'s managed provider.'}
                                </p>
                            </div>

                            {selectedTab === 'personal' ? (
                                <div className="mt-6 border-t border-slate-200 pt-6">
                                    <h3 className="text-md font-semibold text-slate-800 mb-4">Saved API Keys</h3>

                                    {personalEnabledButNoKeys && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-6">
                                            Personal key mode isn't active yet — add at least one API key below and it will switch on automatically.
                                        </div>
                                    )}

                                    {apiKeys.length > 1 && (
                                        <p className="text-xs text-slate-400 mb-3">
                                            You have multiple keys saved. Only the one marked <span className="font-medium text-emerald-600">Active</span> is used for auto-reply.
                                        </p>
                                    )}

                                    {isLoading ? (
                                        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
                                            <table className="min-w-full">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        {['#', 'Provider', 'API Key', 'Status', ''].map((label, index) => (
                                                            <th key={`${label}-${index}`} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <TableSkeletonRows rows={3} cells={['index', 'text', 'text', 'badge', 'action']} />
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : apiKeys.length === 0 ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 mb-6 text-center">
                                            No personal API keys saved. Add one below to get started.
                                        </div>
                                    ) : (
                                        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider w-14">#</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Provider</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">API Key</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                                        <th className="w-16 px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                    {apiKeys.map((keyObj, index) => (
                                                        <tr key={keyObj.unique_id} className={keyObj.is_active ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50'}>
                                                            <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-slate-500">{index + 1}</td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800 capitalize">
                                                                {keyObj.api_provider}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-mono">
                                                                {keyObj.api_key_masked}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                {keyObj.is_active ? (
                                                                    <span
                                                                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700"
                                                                        title="This key is currently used for auto-reply"
                                                                    >
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                        Active
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                                                        Inactive
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                                <RowActionMenu
                                                                    items={[
                                                                        { label: 'Details', icon: <FiEye className="w-4 h-4" />, onClick: () => setKeyDetail(keyObj) },
                                                                        { label: 'Delete', icon: <FiTrash2 className="w-4 h-4" />, danger: true, onClick: () => handleDeleteApiKey(keyObj.unique_id) },
                                                                    ]}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <h3 className="text-md font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <FiPlus className="w-4 h-4" /> Add New Key
                                    </h3>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Provider</label>
                                            <SearchableSelect
                                                value={agentProvider}
                                                onChange={(e) => setAgentProvider(e.target.value)}
                                                options={availableAgentProviders.map((p) => ({ value: p.value, label: p.label }))}
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">API Key</label>
                                            <input
                                                type="password"
                                                value={agentApiKey}
                                                onChange={(e) => setAgentApiKey(e.target.value)}
                                                placeholder="Enter your provider API key"
                                                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveApiKey}
                                            disabled={isSavingKey || !agentApiKey.trim()}
                                            className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            {isSavingKey ? 'Saving...' : 'Add API Key'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    OneChat will use its managed provider and default model for this agent. No model or provider key selection is required.
                                </div>
                            )}

                        </div>
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