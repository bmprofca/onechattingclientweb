import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Header, Sidebar } from '../component/Menu';
import { fetchProjectInfo } from '../store/projectSlice';
import { Encrypt } from './encryption/payload-encryption';
import { FiSettings, FiLock, FiZap, FiMessageSquare, FiBell, FiShield, FiBarChart2, FiUserCheck, FiGitBranch } from 'react-icons/fi';
import toast from 'react-hot-toast';

const PROJECT_CONFIG_STORAGE_KEY = (projectId) => `project_config_${projectId}`;

const getStoredConfig = (projectId) => {
    try {
        const raw = localStorage.getItem(PROJECT_CONFIG_STORAGE_KEY(projectId));
        if (!raw) return {
            autoCaseCreate: false,
            autoReplyEnabled: false,
            autoReplyMode: 'all',
            companyContext: '',
            agentProvider: 'gemini',
            agentUsePersonalKey: true,
            agentApiKey: '',
            agentGeminiApiKey: '',
            agentClaudeApiKey: '',
            agentOpenaiApiKey: '',
            agentGroqApiKey: '',
            hasAgentApiKey: false,
            hasAgentGeminiApiKey: false,
            hasAgentClaudeApiKey: false,
            hasAgentOpenaiApiKey: false,
            hasAgentGroqApiKey: false
        };
        const parsed = JSON.parse(raw);
        return {
            autoCaseCreate: Boolean(parsed?.autoCaseCreate ?? false),
            autoReplyEnabled: Boolean(parsed?.autoReplyEnabled ?? false),
            autoReplyMode: parsed?.autoReplyMode || 'all',
            companyContext: parsed?.companyContext || '',
            agentProvider: parsed?.agentProvider || 'gemini',
            agentUsePersonalKey: Boolean(parsed?.agentUsePersonalKey ?? true),
            agentApiKey: parsed?.agentApiKey || '',
            agentGeminiApiKey: parsed?.agentGeminiApiKey || '',
            agentClaudeApiKey: parsed?.agentClaudeApiKey || '',
            agentOpenaiApiKey: parsed?.agentOpenaiApiKey || '',
            agentGroqApiKey: parsed?.agentGroqApiKey || '',
            hasAgentApiKey: Boolean(parsed?.hasAgentApiKey ?? false),
            hasAgentGeminiApiKey: Boolean(parsed?.hasAgentGeminiApiKey ?? false),
            hasAgentClaudeApiKey: Boolean(parsed?.hasAgentClaudeApiKey ?? false),
            hasAgentOpenaiApiKey: Boolean(parsed?.hasAgentOpenaiApiKey ?? false),
            hasAgentGroqApiKey: Boolean(parsed?.hasAgentGroqApiKey ?? false)
        };
    } catch {
        return {
            autoCaseCreate: false,
            autoReplyEnabled: false,
            autoReplyMode: 'all',
            companyContext: '',
            agentProvider: 'gemini',
            agentUsePersonalKey: true,
            agentApiKey: '',
            agentGeminiApiKey: '',
            agentClaudeApiKey: '',
            agentOpenaiApiKey: '',
            agentGroqApiKey: '',
            hasAgentApiKey: false,
            hasAgentGeminiApiKey: false,
            hasAgentClaudeApiKey: false,
            hasAgentOpenaiApiKey: false,
            hasAgentGroqApiKey: false
        };
    }
};

const setStoredConfig = (projectId, config) => {
    try {
        localStorage.setItem(PROJECT_CONFIG_STORAGE_KEY(projectId), JSON.stringify(config));
    } catch (e) {
        console.warn('Failed to save project config', e);
    }
};

const updateStoredConfig = (projectId, partialConfig) => {
    if (!projectId) return;
    const prev = getStoredConfig(projectId);
    setStoredConfig(projectId, { ...prev, ...partialConfig });
};

function ProjectConfig() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isOwner = useSelector((state) => state.project?.owned ?? false);
    const projectInfo = useSelector((state) => state.project?.info);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });
    const [autoCaseCreate, setAutoCaseCreate] = useState(false);
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
    const [autoReplyMode, setAutoReplyMode] = useState('all');
    const [companyContext, setCompanyContext] = useState('');
    const [projectId, setProjectId] = useState(null);
    const [autoCaseCreateLoading, setAutoCaseCreateLoading] = useState(false);
    const [autoReplyLoading, setAutoReplyLoading] = useState(false);
    const [autoCaseCreateStatusLoading, setAutoCaseCreateStatusLoading] = useState(true);
    const [autoReplyStatusLoading, setAutoReplyStatusLoading] = useState(true);

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
            setAutoReplyStatusLoading(false);
            return;
        }
        try {
            const parsed = JSON.parse(userData);
            const id = parsed?.selected_project_id || parsed?.projects?.list?.[0]?.project_id || '';
            setProjectId(id);
            if (id) {
                const storedConfig = getStoredConfig(id);
                setAutoCaseCreate(storedConfig.autoCaseCreate);
                setAutoReplyEnabled(storedConfig.autoReplyEnabled);
                setAutoReplyMode(storedConfig.autoReplyMode);
                setCompanyContext(storedConfig.companyContext);
            }
        } catch (_) { }
        setAutoReplyStatusLoading(false);
    }, []);

    useEffect(() => {
        if (!projectId || !isOwner) {
            setAutoCaseCreateStatusLoading(false);
            return;
        }
        let cancelled = false;
        const fetchStatus = async () => {
            const userDataRaw = localStorage.getItem('userData');
            let token = '';
            let username = '';
            try {
                const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
                token = parsed?.token || '';
                username = parsed?.username || '';
            } catch (_) { }
            if (!token || !username) {
                setAutoCaseCreateStatusLoading(false);
                return;
            }
            try {
                const payload = { project_id: projectId };
                const { data, key } = Encrypt(payload);
                const response = await axios.post(
                    `${API_BASE_URL}/project/auto-case-create-status`,
                    JSON.stringify({ data, key }),
                    {
                        headers: {
                            token,
                            username,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (cancelled) return;
                if (response?.data?.error) {
                    setAutoCaseCreate(getStoredConfig(projectId).autoCaseCreate);
                    return;
                }
                const status = Boolean(response?.data?.status);
                setAutoCaseCreate(status);
                setStoredConfig(projectId, { ...getStoredConfig(projectId), autoCaseCreate: status });
            } catch (_) {
                if (!cancelled) setAutoCaseCreate(getStoredConfig(projectId).autoCaseCreate);
            } finally {
                if (!cancelled) setAutoCaseCreateStatusLoading(false);
            }
        };
        fetchStatus();
        return () => { cancelled = true; };
    }, [projectId, isOwner]);

    useEffect(() => {
        if (!projectId || !isOwner) {
            setAutoReplyStatusLoading(false);
            return;
        }

        let cancelled = false;
        const fetchSettings = async () => {
            const userDataRaw = localStorage.getItem('userData');
            let token = '';
            let username = '';
            try {
                const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
                token = parsed?.token || '';
                username = parsed?.username || '';
            } catch (_) { }
            if (!token || !username) {
                setAutoReplyStatusLoading(false);
                return;
            }
            try {
                const payload = { project_id: projectId };
                const { data, key } = Encrypt(payload);
                const response = await axios.post(
                    `${API_BASE_URL}/bot-reply/get-settings`,
                    JSON.stringify({ data, key }),
                    {
                        headers: {
                            token,
                            username,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (cancelled) return;
                if (response?.data?.error) {
                    const stored = getStoredConfig(projectId);
                    setAutoReplyEnabled(stored.autoReplyEnabled);
                    setAutoReplyMode(stored.autoReplyMode);
                    setCompanyContext(stored.companyContext);
                    return;
                }
                const responseData = response?.data?.data || {};
                setAutoReplyEnabled(Boolean(responseData.auto_reply));
                setAutoReplyMode(responseData.auto_reply_type || getStoredConfig(projectId).autoReplyMode);
                setCompanyContext(responseData.context || '');
                updateStoredConfig(projectId, {
                    autoReplyEnabled: Boolean(responseData.auto_reply),
                    autoReplyMode: responseData.auto_reply_type || getStoredConfig(projectId).autoReplyMode,
                    companyContext: responseData.context || ''
                });
            } catch (_) {
                if (!cancelled) {
                    const stored = getStoredConfig(projectId);
                    setAutoReplyEnabled(stored.autoReplyEnabled);
                    setAutoReplyMode(stored.autoReplyMode);
                    setCompanyContext(stored.companyContext);
                }
            } finally {
                if (!cancelled) setAutoReplyStatusLoading(false);
            }
        };

        fetchSettings();
        return () => { cancelled = true; };
    }, [projectId, isOwner]);


    const handleAutoCaseCreateChange = async (checked) => {
        if (!projectId) return;
        const userDataRaw = localStorage.getItem('userData');
        let token = '';
        let username = '';
        try {
            const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
            token = parsed?.token || '';
            username = parsed?.username || '';
        } catch (_) { }
        if (!token || !username) {
            toast.error('Session expired. Please log in again.');
            return;
        }
        setAutoCaseCreateLoading(true);
        try {
            const payload = {
                project_id: projectId,
                action: checked ? 'active' : 'deactive'
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/project/update-auto-case-create`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token,
                        username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to update';
                toast.error(errMsg);
                return;
            }
            setAutoCaseCreate(checked);
            updateStoredConfig(projectId, { autoCaseCreate: checked });
            toast.success(response?.data?.msg ?? 'Auto case create updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error ?? 'Failed to update. Please try again.');
        } finally {
            setAutoCaseCreateLoading(false);
        }
    };

    const handleAutoReplyEnabledChange = async (checked) => {
        if (!projectId) return;
        const userDataRaw = localStorage.getItem('userData');
        let token = '';
        let username = '';
        try {
            const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
            token = parsed?.token || '';
            username = parsed?.username || '';
        } catch (_) { }
        if (!token || !username) {
            toast.error('Session expired. Please log in again.');
            return;
        }
        setAutoReplyLoading(true);
        try {
            const payload = {
                project_id: projectId,
                auto_reply: checked
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/toggle-auto-reply`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token,
                        username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to update auto reply';
                toast.error(errMsg);
                return;
            }
            setAutoReplyEnabled(checked);
            updateStoredConfig(projectId, { autoReplyEnabled: checked });
            toast.success(response?.data?.msg ?? 'Auto reply updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error ?? 'Failed to update auto reply. Please try again.');
        } finally {
            setAutoReplyLoading(false);
        }
    };

    const handleAutoReplyModeChange = async (mode) => {
        if (!projectId) return;
        const userDataRaw = localStorage.getItem('userData');
        let token = '';
        let username = '';
        try {
            const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
            token = parsed?.token || '';
            username = parsed?.username || '';
        } catch (_) { }
        if (!token || !username) {
            toast.error('Session expired. Please log in again.');
            return;
        }
        setAutoReplyLoading(true);
        try {
            const payload = {
                project_id: projectId,
                auto_reply_type: mode
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/update-auto-reply-type`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token,
                        username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to update auto reply type';
                toast.error(errMsg);
                return;
            }
            setAutoReplyMode(mode);
            updateStoredConfig(projectId, { autoReplyMode: mode });
            toast.success(response?.data?.msg ?? 'Auto reply type updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error ?? 'Failed to update auto reply type. Please try again.');
        } finally {
            setAutoReplyLoading(false);
        }
    };

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-[#f4f6fb]">
                <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                    <div className="w-full px-4 py-5">
                        <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
                            <FiLock className="w-14 h-14 mx-auto text-slate-300 mb-4" />
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Access denied</h2>
                            <p className="text-slate-600 mb-6">Only the project admin can access project configuration.</p>
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

    return (
        <div className="min-h-screen bg-[#f4f6fb]">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full px-4 py-5">
                    <div className="mb-5">
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FiSettings className="w-7 h-7 text-indigo-600" />
                            Project Configuration
                        </h1>
                        <p className="mt-1 text-slate-600">Manage settings for the selected project.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {/* Auto Case Create - active card */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
                                        <FiZap className="w-6 h-6" />
                                    </div>
                                    {autoCaseCreateStatusLoading ? (
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <span className="inline-block h-5 w-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-medium">Loading...</span>
                                        </div>
                                    ) : (
                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={autoCaseCreate}
                                                disabled={autoCaseCreateLoading}
                                                onChange={(e) => handleAutoCaseCreateChange(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-60" />
                                            <span className="ms-3 text-sm font-medium text-slate-700">{autoCaseCreateLoading ? '...' : (autoCaseCreate ? 'On' : 'Off')}</span>
                                        </label>
                                    )}
                                </div>
                                <h3 className="font-semibold text-slate-800 mt-4">Auto Case Create</h3>
                                <p className="text-sm text-slate-600 mt-1.5">Create a new case automatically based on your project rules.</p>
                            </div>
                        </div>

                        {/* Auto Reply - active card */}
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                                        <FiMessageSquare className="w-6 h-6" />
                                    </div>
                                    {autoReplyStatusLoading ? (
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <span className="inline-block h-5 w-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-medium">Loading...</span>
                                        </div>
                                    ) : (
                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={autoReplyEnabled}
                                                disabled={autoReplyLoading}
                                                onChange={(e) => handleAutoReplyEnabledChange(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-disabled:opacity-60" />
                                            <span className="ms-3 text-sm font-medium text-slate-700">{autoReplyLoading ? '...' : (autoReplyEnabled ? 'On' : 'Off')}</span>
                                        </label>
                                    )}
                                </div>
                                <h3 className="font-semibold text-slate-800 mt-4">Auto Reply</h3>
                                <p className="text-sm text-slate-600 mt-1.5">Send automatic replies to all conversations or only new conversation starts.</p>
                                {autoReplyEnabled && (
                                    <div className="mt-4 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="auto-reply-all"
                                                type="radio"
                                                name="autoReplyMode"
                                                value="all"
                                                checked={autoReplyMode === 'all'}
                                                onChange={() => handleAutoReplyModeChange('all')}
                                                className="h-4 w-4 text-emerald-600 border-slate-300"
                                            />
                                            <label htmlFor="auto-reply-all" className="text-sm text-slate-700">All conversations</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="auto-reply-new"
                                                type="radio"
                                                name="autoReplyMode"
                                                value="new"
                                                checked={autoReplyMode === 'new'}
                                                onChange={() => handleAutoReplyModeChange('new')}
                                                className="h-4 w-4 text-emerald-600 border-slate-300"
                                            />
                                            <label htmlFor="auto-reply-new" className="text-sm text-slate-700">New conversations only</label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Flow Builder - navigable card */}
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate('/flows')}
                            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/flow'); }}
                            className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden cursor-pointer transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50"
                        >
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
                                        <FiGitBranch className="w-6 h-6" />
                                    </div>
                                    <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition group-hover:bg-indigo-100 group-hover:text-indigo-700">
                                        Open builder
                                    </div>
                                </div>
                                <h3 className="font-semibold text-slate-800 mt-4">Flow Builder</h3>
                                <p className="text-sm text-slate-600 mt-1.5">Build drag-and-drop conversation flows for your project chats.</p>
                            </div>
                        </div>

                        {/* Agent Configuration - active card */}
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate('/agent-config')}
                            className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden cursor-pointer transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50"
                        >
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600">
                                        <FiShield className="w-6 h-6" />
                                    </div>
                                    <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition group-hover:bg-violet-100 group-hover:text-violet-700">
                                        Open settings
                                    </div>
                                </div>
                                <h3 className="font-semibold text-slate-800 mt-4">Agent Configuration</h3>
                                <p className="text-sm text-slate-600 mt-1.5">Manage provider and personal API key settings on a dedicated page.</p>
                            </div>
                        </div>

                        {/* Company Context - navigable card */}
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate('/context-config')}
                            className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden cursor-pointer transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50"
                        >
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-2.5 rounded-xl bg-sky-100 text-sky-600">
                                        <FiShield className="w-6 h-6" />
                                    </div>
                                    <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition group-hover:bg-sky-100 group-hover:text-sky-700">
                                        Open settings
                                    </div>
                                </div>
                                <h3 className="font-semibold text-slate-800 mt-4">Company Context</h3>
                                <p className="text-sm text-slate-600 mt-1.5">Update the company context used by the bot to answer FAQs and support queries.</p>
                            </div>
                        </div>

                        {/* Coming soon cards */}
                        {[
                            { icon: FiBell, title: 'Notification Preferences', desc: 'Choose how and when you get notified for new messages.' },
                            { icon: FiBarChart2, title: 'Analytics & Reports', desc: 'Enable dashboards and scheduled reports.' },
                            { icon: FiUserCheck, title: 'Agent Assignment Rules', desc: 'Auto-assign chats to agents by rules.' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm overflow-hidden flex flex-col opacity-75 pointer-events-none">
                                    <div className="p-5 flex-1 relative">
                                        <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">
                                            Coming soon
                                        </span>
                                        <div className="p-2.5 rounded-xl bg-slate-200 text-slate-500">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-semibold text-slate-700 mt-4">{item.title}</h3>
                                        <p className="text-sm text-slate-500 mt-1.5">{item.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProjectConfig;
