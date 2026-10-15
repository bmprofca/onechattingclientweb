import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Header, Sidebar } from '../component/Menu';
import { fetchProjectInfo } from '../store/projectSlice';
import { Encrypt } from './encryption/payload-encryption';
import { FiLock, FiMessageSquare, FiShield, FiGitBranch, FiFileText } from 'react-icons/fi';
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
    const projectName = useSelector((state) => state.project?.projectName || '');

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
            <div className="min-h-screen bg-surface-ground">
                <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                    <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                        <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center">
                            <FiLock className="w-14 h-14 mx-auto text-slate-300 mb-4" />
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Access denied</h2>
                            <p className="text-slate-600 mb-6">Only the project admin can access project configuration.</p>
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

    const displayProjectName = projectName || projectInfo?.project?.name || '';

    let companyContextCount = null;
    if (companyContext && String(companyContext).trim()) {
        try {
            const parsed = JSON.parse(companyContext);
            if (parsed && typeof parsed === 'object') {
                let count = 0;
                if (String(parsed.companyOverview || '').trim()) count += 1;
                if (String(parsed.companyAddress || '').trim()) count += 1;
                if (Array.isArray(parsed.sections)) {
                    parsed.sections.forEach((section) => {
                        count += Array.isArray(section?.items) ? section.items.length : 0;
                    });
                }
                companyContextCount = count > 0 ? count : null;
            }
        } catch (_) {
            companyContextCount = null;
        }
    }

    const replyModes = [
        {
            id: 'auto-reply-all',
            value: 'all',
            title: 'All conversations',
            detail: 'Every conversation can receive an auto-reply.',
        },
        {
            id: 'auto-reply-new',
            value: 'new',
            title: 'New conversations only',
            detail: 'Only new conversations receive an auto-reply.',
        },
    ];

    return (
        <div className="min-h-screen bg-surface-ground">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-6">
                        <h1 className="oc-page-title">Configuration</h1>
                        <p className="oc-page-sub">
                            Settings for {displayProjectName || 'this project'}. Only the project owner can change these.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <section className="oc-card p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-[15px] font-bold text-ink">Auto case create</h2>
                                    <p className="mt-1 text-sm text-ink-500 max-w-2xl">Open a case automatically when a customer messages, so nothing is missed in Open cases.</p>
                                </div>
                                {autoCaseCreateStatusLoading ? (
                                    <span className="inline-block h-5 w-5 border-2 border-line border-t-brand-600 rounded-full animate-spin" />
                                ) : (
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={autoCaseCreate}
                                            disabled={autoCaseCreateLoading}
                                            onChange={(e) => handleAutoCaseCreateChange(e.target.checked)}
                                            className="sr-only peer"
                                            aria-label="Auto case create"
                                        />
                                        <div className="w-11 h-6 bg-[#E4E1EF] rounded-full peer peer-checked:bg-brand-600 peer-disabled:opacity-60 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                                    </label>
                                )}
                            </div>
                            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-400">Auto-reply scope</p>
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {replyModes.map((mode) => {
                                    const selected = autoReplyMode === mode.value;
                                    return (
                                        <label
                                            key={mode.value}
                                            htmlFor={mode.id}
                                            className={`flex items-start gap-3 rounded-[12px] border p-3.5 cursor-pointer transition-colors ${selected ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-[#D5D2E4]'}`}
                                        >
                                            <input
                                                id={mode.id}
                                                type="radio"
                                                name="autoReplyMode"
                                                value={mode.value}
                                                checked={selected}
                                                disabled={autoReplyLoading || autoReplyStatusLoading}
                                                onChange={() => handleAutoReplyModeChange(mode.value)}
                                                className="mt-0.5 h-4 w-4 accent-[#6C5CE7]"
                                            />
                                            <span>
                                                <span className="block text-sm font-semibold text-ink">{mode.title}</span>
                                                <span className="block mt-0.5 text-xs text-ink-500">{mode.detail}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                type="button"
                                onClick={() => navigate('/agent-config')}
                                className="oc-card p-4 text-left hover:border-brand-300 transition-colors"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                                    <FiShield className="w-4 h-4" />
                                </span>
                                <span className="mt-3 flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-ink">AI agent</span>
                                </span>
                                <span className="mt-1 block text-xs text-ink-500">Provider and API key for AI auto-replies</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate('/context-config')}
                                className="oc-card p-4 text-left hover:border-brand-300 transition-colors"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                                    <FiFileText className="w-4 h-4" />
                                </span>
                                <span className="mt-3 flex items-center justify-between gap-2">
                                    <span className="text-sm font-bold text-ink">Company context</span>
                                    {companyContextCount != null && (
                                        <span className="oc-badge bg-[#F3F2FA] text-ink-700">{companyContextCount} {companyContextCount === 1 ? 'item' : 'items'}</span>
                                    )}
                                </span>
                                <span className="mt-1 block text-xs text-ink-500">What the AI knows about your business</span>
                            </button>

                            <div className="oc-card p-4">
                                <button
                                    type="button"
                                    onClick={() => navigate('/auto-reply')}
                                    className="w-full text-left"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                                        <FiMessageSquare className="w-4 h-4" />
                                    </span>
                                    <span className="mt-3 block text-sm font-bold text-ink">Auto reply</span>
                                    <span className="mt-1 block text-xs text-ink-500">Keyword and away-hours replies</span>
                                </button>
                                <div className="mt-3 flex items-center justify-between">
                                    {autoReplyStatusLoading ? (
                                        <span className="inline-block h-4 w-4 border-2 border-line border-t-brand-600 rounded-full animate-spin" />
                                    ) : (
                                        <label className="relative inline-flex items-center gap-2 cursor-pointer" onClick={(event) => event.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={autoReplyEnabled}
                                                disabled={autoReplyLoading}
                                                onChange={(e) => handleAutoReplyEnabledChange(e.target.checked)}
                                                className="sr-only peer"
                                                aria-label="Auto reply"
                                            />
                                            <span className="relative w-9 h-5 bg-[#E4E1EF] rounded-full peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-disabled:opacity-60" />
                                            <span className="text-xs font-semibold text-ink-500">{autoReplyLoading ? '...' : (autoReplyEnabled ? 'On' : 'Off')}</span>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate('/flows')}
                                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/flow'); }}
                                className="oc-card p-4 text-left cursor-pointer hover:border-brand-300 transition-colors"
                            >
                                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                                    <FiGitBranch className="w-4 h-4" />
                                </span>
                                <span className="mt-3 block text-sm font-bold text-ink">Flow builder</span>
                                <span className="mt-1 block text-xs text-ink-500">Multi-step menus and chatbots</span>
                            </div>
                        </div>

                        <section className="oc-card p-5">
                            <h2 className="text-[15px] font-bold text-ink">Coming next</h2>
                            <p className="mt-1 text-sm text-ink-500">These settings are planned and will appear here.</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {['Agent assignment rules', 'Notification preferences', 'Analytics and reports'].map((title) => (
                                    <span key={title} className="inline-flex items-center h-8 px-3 rounded-full border border-line bg-[#F7F6FB] text-xs font-semibold text-ink-500">
                                        {title}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProjectConfig;
