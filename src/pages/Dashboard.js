import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { Header, Sidebar } from '../component/Menu';
import {
    FiMessageSquare,
    FiMail,
    FiUsers,
    FiZap,
    FiSend,
    FiFileText,
    FiUserCheck,
    FiBriefcase,
    FiPlus,
    FiShield,
    FiUser,
    FiChevronRight,
    FiCpu,
    FiLayers
} from 'react-icons/fi';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import { getProjectMetaDetails } from '../api/auth';
import SwitchProjectModal from '../component/Modals/SwitchProjectModal';
import CreateProjectModal from '../component/Modals/CreateProjectModal';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedProjectId, setAuthData } from '../store/authSlice';

const PLATFORM_FEATURES = [
    {
        title: 'Live chat',
        description: 'Reply to customers on WhatsApp in real time, with media, documents, and unread conversations in one inbox.',
        icon: FiMessageSquare,
        card: 'border-emerald-200 bg-emerald-50/70',
        iconWrap: 'bg-emerald-500 text-white',
        titleColor: 'text-emerald-900',
    },
    {
        title: 'Open cases',
        description: 'Track support issues against each phone number, add remarks, and see what is still waiting on your team.',
        icon: FiBriefcase,
        card: 'border-amber-200 bg-amber-50/70',
        iconWrap: 'bg-amber-500 text-white',
        titleColor: 'text-amber-900',
    },
    {
        title: 'Audience',
        description: 'Keep contacts and groups ready so campaigns go to the right customers without rebuilding the list each time.',
        icon: FiUsers,
        card: 'border-sky-200 bg-sky-50/70',
        iconWrap: 'bg-sky-500 text-white',
        titleColor: 'text-sky-900',
    },
    {
        title: 'Templates',
        description: 'Submit Marketing, Utility, and Authentication templates and follow them from pending to approved.',
        icon: FiMail,
        card: 'border-violet-200 bg-violet-50/70',
        iconWrap: 'bg-violet-500 text-white',
        titleColor: 'text-violet-900',
    },
    {
        title: 'Campaigns',
        description: 'Send approved messages to contacts or groups and watch sent, delivered, read, and failed results.',
        icon: FiZap,
        card: 'border-orange-200 bg-orange-50/70',
        iconWrap: 'bg-orange-500 text-white',
        titleColor: 'text-orange-900',
    },
    {
        title: 'QR leads',
        description: 'Share a project QR code and see who scanned it, so new customers can start a chat with your business.',
        icon: FiLayers,
        card: 'border-teal-200 bg-teal-50/70',
        iconWrap: 'bg-teal-500 text-white',
        titleColor: 'text-teal-900',
    },
    {
        title: 'Team access',
        description: 'Invite agents, set what each person can do, and share one WhatsApp number across your staff.',
        icon: FiUserCheck,
        card: 'border-indigo-200 bg-indigo-50/70',
        iconWrap: 'bg-indigo-500 text-white',
        titleColor: 'text-indigo-900',
    },
    {
        title: 'Developer API',
        description: 'Connect your own apps with project tokens and send or receive WhatsApp messages from your systems.',
        icon: FiCpu,
        card: 'border-rose-200 bg-rose-50/70',
        iconWrap: 'bg-rose-500 text-white',
        titleColor: 'text-rose-900',
    },
];

function NewUserWelcome({ onCreateProject }) {
    return (
        <div className="flex flex-col gap-5">
            <section className="oc-card overflow-hidden">
                <div className="bg-ink-900 px-6 py-8 sm:px-8">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#B9B0FF]">Start here</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-white">Create a project for your business</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#C9C5DD]">
                        A project is your WhatsApp Business workspace. It connects one number, holds your contacts,
                        chats, templates, and campaigns, and is where you invite your team. The rest of the platform
                        stays locked until that workspace exists.
                    </p>
                    <button type="button" onClick={onCreateProject} className="oc-btn-primary mt-6 h-10 px-4">
                        <FiPlus size={16} />
                        Create project
                    </button>
                </div>
            </section>

            <section className="oc-card p-5 sm:p-6">
                <h3 className="text-base font-bold text-ink">What you can do after you create a project</h3>
                <p className="mt-1 text-sm text-ink-500">These tools run inside a project, so each business stays separate.</p>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                    {PLATFORM_FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <div key={feature.title} className="rounded-xl border border-line-soft bg-surface-soft p-4">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                                    <Icon className="w-[18px] h-[18px]" />
                                </span>
                                <h4 className="mt-3.5 text-sm font-bold text-ink">{feature.title}</h4>
                                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{feature.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

function Dashboard() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isOwnerProject = useSelector((state) => state.project?.owned ?? true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [tokens, setTokens] = useState(null);
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [projectMeta, setProjectMeta] = useState(null);
    const [projectMetaLoading, setProjectMetaLoading] = useState(false);
    const [projectMetaError, setProjectMetaError] = useState(null);
    const [switchProjectModalOpen, setSwitchProjectModalOpen] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const [isMinimized, setIsMinimized] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebarMinimized');
            return saved ? JSON.parse(saved) : false;
        }
        return false;
    });

    // Get user data and check project count
    const getUserData = () => {
        try {
            const userData = localStorage.getItem('userData');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error parsing userData from localStorage:', error);
            return null;
        }
    };

    const userData = getUserData();
    const hasSelectedProject = Boolean(userData?.selected_project_id || tokens?.selected_project_id);

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        if (sessionStorage.getItem('showProjectPicker') !== '1') return;
        try {
            const stored = localStorage.getItem('userData');
            if (!stored) return;
            const parsed = JSON.parse(stored);
            const projectList = parsed.projects?.list || (Array.isArray(parsed.projects) ? parsed.projects : []);
            const hasProjects = Number(parsed.project_count) > 0 || projectList.length > 0;
            if (hasProjects && !parsed.selected_project_id) {
                setSwitchProjectModalOpen(true);
            }
        } catch (error) {
            console.error('Error checking project selection:', error);
        }
    }, []);

    // Load tokens from storage
    useEffect(() => {
        const loadTokens = () => {
            try {
                if (typeof window === 'undefined') return;
                const storages = [localStorage, sessionStorage];
                for (const storage of storages) {
                    try {
                        const data = storage?.getItem('userData');
                        if (data) {
                            const parsed = JSON.parse(data);
                            if (parsed && typeof parsed === 'object') {
                                setTokens(parsed);
                                return;
                            }
                        }
                    } catch (storageError) {
                        console.error('Failed to parse tokens from storage:', storageError);
                    }
                }
                setTokens(null);
            } catch (e) {
                console.error('Failed to load tokens:', e);
            }
        };
        loadTokens();
        window.addEventListener('projects-updated', loadTokens);
        return () => window.removeEventListener('projects-updated', loadTokens);
    }, []);

    // Fetch dashboard data from API
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!tokens?.token || !tokens?.username) {
                setLoading(false);
                return;
            }

            if (!tokens?.selected_project_id) {
                setLoading(false);
                setError(null);
                setDashboardData({
                    campaign: { total: 0, message: { total: 0, sent: 0, pending: 0, delivered: 0, read: 0, failed: 0 } },
                    chat: { total: 0 },
                    contact: { total: 0 },
                    template: { total: 0, approved: 0, pending: 0, rejected: 0 },
                    message: { total: 0, today_sent: 0 },
                    qr_scanned_users: { total: 0 }
                });
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const payload = { project_id: tokens.selected_project_id };
                const { data, key } = Encrypt(payload);
                const data_pass = JSON.stringify({ data, key });

                const response = await axios.post(
                    `${API_BASE_URL}/project/dashboard`,
                    data_pass,
                    {
                        headers: {
                            'token': tokens.token,
                            'username': tokens.username,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!response?.data?.error && response?.data?.data) {
                    setDashboardData(response.data.data);
                } else {
                    setError(response?.data?.message || 'Failed to fetch dashboard data');
                }
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError('Failed to fetch dashboard data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id]);

    // Prevent background scrolling when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [mobileMenuOpen]);

    // Fetch project profile/meta information
    useEffect(() => {
        const fetchProjectMetaDetails = async () => {
            if (!tokens?.selected_project_id) {
                setProjectMeta(null);
                setProjectMetaLoading(false);
                return;
            }

            setProjectMetaLoading(true);
            setProjectMetaError(null);

            try {
                const response = await getProjectMetaDetails({
                    project_id: tokens.selected_project_id
                });

                if (!response?.error && response?.data) {
                    setProjectMeta(response.data);
                } else {
                    setProjectMeta(null);
                    setProjectMetaError(response?.message || 'Failed to fetch project profile');
                }
            } catch (metaError) {
                console.error('Failed to fetch project profile:', metaError);
                setProjectMeta(null);
                setProjectMetaError('Failed to fetch project profile. Please try again.');
            } finally {
                setProjectMetaLoading(false);
            }
        };

        fetchProjectMetaDetails();
    }, [tokens?.selected_project_id]);

    // Handle project selection from modal
    const handleSelectCompany = (company) => {
        if (!company) return;
        try {
            const stored = localStorage.getItem('userData');
            const parsed = stored ? JSON.parse(stored) : {};
            const selectedId = company.project_id || company.id || null;
            const updatedUserData = { ...parsed, selected_project_id: selectedId };
            localStorage.setItem('userData', JSON.stringify(updatedUserData));
            if (selectedId) {
                dispatch(setSelectedProjectId(selectedId));
                dispatch(setAuthData(updatedUserData));
            }
            sessionStorage.removeItem('showProjectPicker');
            setSwitchProjectModalOpen(false);
            window.location.reload();
        } catch (error) {
            console.error('Failed to update selected project', error);
        }
    };

    const handleModalClose = () => {
        sessionStorage.removeItem('showProjectPicker');
        setSwitchProjectModalOpen(false);
    };

    const num = (v) => (Number(v) || 0);
    const fmt = (v) => num(v).toLocaleString('en-IN');
    const pct = (part, total) => (num(total) > 0 ? Math.round((num(part) / num(total)) * 100) : 0);

    const projectList = userData?.projects?.list || (Array.isArray(userData?.projects) ? userData.projects : []);
    const currentProjectName = projectMeta?.project?.name
        || projectList.find(p => (p.project_id === userData?.selected_project_id || p.id === userData?.selected_project_id))?.name
        || 'your project';

    const kpis = [
        { label: 'Contacts', value: fmt(dashboardData?.contact?.total), note: 'Saved in this project', icon: FiUsers, to: '/contact' },
        { label: 'Conversations', value: fmt(dashboardData?.chat?.total), note: 'Chats with your business', icon: FiMessageSquare, to: '/live-chat' },
        { label: 'Sent today', value: fmt(dashboardData?.message?.today_sent), note: 'Template and session messages', icon: FiSend, to: null },
        { label: 'Total messages', value: fmt(dashboardData?.message?.total), note: 'Since the project was created', icon: FiMail, to: null },
        { label: 'Campaigns', value: fmt(dashboardData?.campaign?.total), note: 'Created in this project', icon: FiZap, to: '/campaigns' },
        { label: 'Templates', value: fmt(dashboardData?.template?.total), note: 'Submitted to Meta', icon: FiFileText, to: '/template' },
    ];

    const cm = dashboardData?.campaign?.message || {};
    const cmTotal = num(cm.total);
    const funnel = [
        { label: 'Read', value: cm.read, color: '#4A3BC4' },
        { label: 'Delivered', value: cm.delivered, color: '#8C80EE' },
        { label: 'Sent', value: cm.sent, color: '#CBC4F8' },
        { label: 'Pending', value: cm.pending, color: '#E8A93A' },
        { label: 'Failed', value: cm.failed, color: '#C2412D' },
    ];
    const funnelSum = funnel.reduce((s, f) => s + num(f.value), 0) || 1;

    const tpl = dashboardData?.template || {};
    const tplRows = [
        { label: 'Approved', value: tpl.approved, color: '#0E8A5F' },
        { label: 'Pending review', value: tpl.pending, color: '#E8A93A' },
        { label: 'Rejected', value: tpl.rejected, color: '#C2412D' },
    ];

    const quickActions = [
        { title: 'Create a template', sub: 'Marketing, Utility or Authentication', to: '/template-add' },
        { title: 'Start a campaign', sub: 'Send an approved template to many people', to: '/create-campaign' },
        { title: 'Import contacts', sub: 'Excel file or Google Sheet', to: '/contact' },
        ...(isOwnerProject ? [{ title: 'Invite an agent', sub: 'Share the inbox with your team', to: '/agent-management' }] : []),
    ];

    return (
        <div className="min-h-screen bg-surface-ground">
            <Header
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />
            <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />

            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <main className="w-full max-w-[1440px] px-4 sm:px-7 py-7 flex flex-col gap-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="oc-page-title">Dashboard</h1>
                            <p className="oc-page-sub">
                                {hasSelectedProject
                                    ? <>Performance for <span className="font-semibold text-ink">{currentProjectName}</span> on WhatsApp Business.</>
                                    : 'Set up your first project to start messaging customers.'}
                            </p>
                        </div>
                        {hasSelectedProject && (
                            <button type="button" onClick={() => navigate('/create-campaign')} className="oc-btn-primary">
                                <FiPlus size={16} /> New campaign
                            </button>
                        )}
                    </div>

                    {!hasSelectedProject && (
                        <NewUserWelcome onCreateProject={() => setShowCreateModal(true)} />
                    )}

                    {hasSelectedProject && (
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
                            {/* Right: WhatsApp account — first on small screens, pinned on large screens */}
                            <aside className="xl:col-start-2 xl:row-start-1 xl:sticky xl:top-[88px]">
                                <ProjectProfileCard
                                    project={projectMeta?.project}
                                    profile={projectMeta?.profile}
                                    loading={projectMetaLoading}
                                    error={projectMetaError}
                                    projectId={tokens?.selected_project_id}
                                    navigate={navigate}
                                />
                            </aside>

                            {/* Left: statistics */}
                            <div className="xl:col-start-1 xl:row-start-1 min-w-0 flex flex-col gap-3.5">
                                {loading && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                        {[1, 2, 3, 4, 5, 6].map((i) => (
                                            <div key={i} className="oc-card p-5 animate-pulse">
                                                <div className="h-3.5 bg-line-soft rounded w-24 mb-4"></div>
                                                <div className="h-7 bg-line-soft rounded w-20"></div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!loading && error && (
                                    <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                                )}

                                {!loading && !error && (
                                    <>
                                        <section aria-label="Key metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                            {kpis.map((k) => {
                                                const Icon = k.icon;
                                                const body = (
                                                    <>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[13px] font-semibold text-ink-500">{k.label}</span>
                                                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={16} /></span>
                                                        </div>
                                                        <div className="oc-num text-[28px] text-ink">{k.value}</div>
                                                        <div className="text-xs text-ink-500">{k.note}</div>
                                                    </>
                                                );
                                                return k.to ? (
                                                    <button key={k.label} type="button" onClick={() => navigate(k.to)} className="oc-card p-[18px] flex flex-col gap-2.5 text-left hover:border-brand-300 transition-colors">{body}</button>
                                                ) : (
                                                    <div key={k.label} className="oc-card p-[18px] flex flex-col gap-2.5">{body}</div>
                                                );
                                            })}
                                        </section>

                                        <section className="oc-card p-5 flex flex-col gap-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <h2 className="text-base font-bold text-ink">Campaign delivery</h2>
                                                    <p className="mt-1 text-[13px] text-ink-500">Status of every campaign message in this project</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="oc-num text-[22px] text-ink">{fmt(cmTotal)}</div>
                                                    <div className="text-xs text-ink-500">messages across {fmt(dashboardData?.campaign?.total)} campaigns</div>
                                                </div>
                                            </div>
                                            {cmTotal > 0 ? (
                                                <div
                                                    className="flex h-3.5 rounded-full overflow-hidden gap-0.5 bg-line-soft"
                                                    role="img"
                                                    aria-label={funnel.map(f => `${f.label} ${pct(f.value, funnelSum)} percent`).join(', ')}
                                                >
                                                    {funnel.map(f => num(f.value) > 0 && (
                                                        <div key={f.label} style={{ width: `${(num(f.value) / funnelSum) * 100}%`, background: f.color }} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="rounded-[10px] border border-dashed border-line-strong px-4 py-5 text-sm text-ink-500">
                                                    No campaign messages yet. <button type="button" onClick={() => navigate('/create-campaign')} className="font-semibold text-brand-800 hover:text-brand-900">Start your first campaign</button>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                                {funnel.map(f => (
                                                    <div key={f.label} className="rounded-[10px] border border-line-soft bg-surface-soft p-3 flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                                                            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: f.color }} />{f.label}
                                                        </div>
                                                        <div className="oc-num text-lg text-ink">{fmt(f.value)}</div>
                                                        <div className="text-xs text-ink-500">{pct(f.value, funnelSum)}%</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                                            <section className="oc-card p-5 flex flex-col gap-3.5">
                                                <div className="flex items-center justify-between">
                                                    <h2 className="text-base font-bold text-ink">Template health</h2>
                                                    <button type="button" onClick={() => navigate('/template')} className="text-[13px] font-semibold text-brand-800 hover:text-brand-900">View all</button>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="oc-num text-[28px] text-ink">{fmt(tpl.total)}</span>
                                                    <span className="text-[13px] text-ink-500">templates · {pct(tpl.approved, tpl.total)}% approval rate</span>
                                                </div>
                                                {tplRows.map(t => (
                                                    <div key={t.label} className="flex flex-col gap-1.5">
                                                        <div className="flex justify-between text-[13px]">
                                                            <span className="font-semibold text-ink">{t.label}</span>
                                                            <span className="oc-num text-ink">{fmt(t.value)}</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
                                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct(t.value, tpl.total)}%`, background: t.color }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </section>

                                            <section className="oc-card p-5 flex flex-col gap-2.5">
                                                <h2 className="text-base font-bold text-ink mb-1">Quick actions</h2>
                                                {quickActions.map(q => (
                                                    <button
                                                        key={q.title}
                                                        type="button"
                                                        onClick={() => navigate(q.to)}
                                                        className="flex items-center gap-3 rounded-[10px] border border-line-soft bg-surface-soft p-3 text-left hover:border-brand-200 hover:bg-brand-50/40 transition-colors"
                                                    >
                                                        <span className="flex-1">
                                                            <span className="block text-[13px] font-bold text-ink">{q.title}</span>
                                                            <span className="block text-xs text-ink-500">{q.sub}</span>
                                                        </span>
                                                        <FiChevronRight className="text-ink-400" size={16} />
                                                    </button>
                                                ))}
                                            </section>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            <CreateProjectModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreated={() => {
                    try {
                        const stored = localStorage.getItem('userData');
                        if (stored) setTokens(JSON.parse(stored));
                    } catch (error) {
                        console.error('Error reading user data after project create:', error);
                    }
                }}
            />

            {/* Project Selection Modal */}
            <SwitchProjectModal
                isOpen={switchProjectModalOpen}
                onClose={handleModalClose}
                onSelectCompany={handleSelectCompany}
            />
        </div>
    );
}

// ----------------------------------------------------------------------
// Reusable Components
// ----------------------------------------------------------------------

function ProjectProfileCard({ project, profile, loading, error, navigate }) {
    if (loading) {
        return (
            <div className="oc-card p-5 animate-pulse flex flex-col gap-4">
                <div className="h-4 bg-line-soft rounded w-40" />
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-line-soft rounded-full" />
                    <div className="flex-1 space-y-2"><div className="h-3.5 bg-line-soft rounded w-1/2" /><div className="h-3 bg-line-soft rounded w-1/3" /></div>
                </div>
                {[1, 2, 3].map((k) => <div key={k} className="h-4 bg-line-soft rounded" />)}
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="oc-card p-6 flex flex-col items-center justify-center text-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><FiUser size={22} /></span>
                <h2 className="text-base font-bold text-ink">{error ? 'Could not load WhatsApp profile' : 'WhatsApp account'}</h2>
                <p className="text-sm text-ink-500 max-w-xs">{error || 'Select a project to view WhatsApp profile details.'}</p>
            </div>
        );
    }

    const imageSrc = project?.wa_display_image || profile?.profile_picture_url;
    const waNumber = profile?.wa_number || project?.wa_number;
    const quality = project?.wa_quality_rating;
    const qualityStyle = quality === 'GREEN'
        ? 'bg-emerald-50 text-emerald-800'
        : quality === 'YELLOW' ? 'bg-amber-50 text-amber-800' : quality === 'RED' ? 'bg-red-50 text-red-800' : 'bg-line-soft text-ink-700';
    const rows = [
        { label: 'Connection', value: project?.status ? project.status.charAt(0).toUpperCase() + project.status.slice(1) : null },
        { label: 'Messaging tier', value: project?.wa_messaging_tier ? project.wa_messaging_tier.replace('TIER_', 'Tier ').replace('_', ' ') : null },
        { label: 'Daily template limit', value: typeof project?.daily_template_limit === 'number' ? `${project.daily_template_limit.toLocaleString('en-IN')} templates` : project?.daily_template_limit },
        { label: 'Product', value: profile?.messaging_product },
    ].filter(r => r.value);

    return (
        <section className="oc-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-ink">WhatsApp account</h2>
                <button type="button" onClick={() => navigate('/project-details')} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-800 hover:text-brand-900">
                    Business profile <FiChevronRight size={14} />
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <div className="h-11 w-11 flex-none rounded-full overflow-hidden bg-ink text-white flex items-center justify-center">
                    {imageSrc ? <img src={imageSrc} alt="" className="h-full w-full object-cover" /> : <FiUser size={18} />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-ink truncate" title={project?.name}>{project?.wa_display_name || project?.name || '—'}</span>
                        {project?.is_whatsapp_verified && <FiShield className="text-emerald-600 flex-none" size={14} title="Verified" />}
                    </div>
                    {waNumber && <div className="font-mono text-[13px] text-ink-500">{waNumber}</div>}
                </div>
                {quality && <span className={`oc-badge ml-auto ${qualityStyle}`}>Quality · {quality.charAt(0) + quality.slice(1).toLowerCase()}</span>}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
                {rows.map(r => (
                    <React.Fragment key={r.label}>
                        <dt className="text-ink-500">{r.label}</dt>
                        <dd className="m-0 text-right font-semibold text-ink truncate">{r.value}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </section>
    );
}

export default Dashboard;
