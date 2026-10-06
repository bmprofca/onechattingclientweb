import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { Header, Sidebar } from '../component/Menu';
import {
    FiMessageSquare,
    FiMail,
    FiUsers,
    FiZap,
    FiActivity,
    FiCheckCircle,
    FiSend,
    FiClock,
    FiAlertCircle,
    FiTrendingUp,
    FiFileText,
    FiUserCheck,
    FiUserX,
    FiBriefcase,
    FiPlus,
    FiPhone,
    FiGlobe,
    FiShield,
    FiUser,
    FiChevronRight,
    FiBarChart2,
    FiCpu,
    FiLayers
} from 'react-icons/fi';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import { getProjectMetaDetails } from '../api/auth';
import SwitchProjectModal from '../component/Modals/SwitchProjectModal';
import CreateProjectModal from '../component/Modals/CreateProjectModal';
import { useDispatch } from 'react-redux';
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
        <div className="space-y-6">
            <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-8 sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Start here</p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Create a project for your business</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-indigo-100">
                        A project is your WhatsApp Business workspace. It connects one number, holds your contacts,
                        chats, templates, and campaigns, and is where you invite your team. The rest of the platform
                        stays locked until that workspace exists.
                    </p>
                    <button
                        type="button"
                        onClick={onCreateProject}
                        className="mt-6 inline-flex items-center px-4 py-2.5 bg-white text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-50"
                    >
                        <FiPlus className="mr-2" size={16} />
                        Create project
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">What you can do after you create a project</h3>
                <p className="mt-1 text-sm text-gray-500">These tools run inside a project, so each business stays separate.</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {PLATFORM_FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <div key={feature.title} className={`rounded-xl border p-5 shadow-sm ${feature.card}`}>
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg shadow-sm ${feature.iconWrap}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h4 className={`mt-4 text-sm font-semibold ${feature.titleColor}`}>{feature.title}</h4>
                                <p className="mt-2 text-sm leading-relaxed text-gray-700">{feature.description}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Dashboard() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
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

    // Main Metrics Data
    const mainMetrics = dashboardData ? [
        {
            title: "Total Campaigns",
            value: dashboardData.campaign?.total?.toLocaleString() || "0",
            icon: <FiZap className="w-6 h-6" />,
            color: "bg-blue-500",
            bgColor: "bg-blue-50",
            textColor: "text-blue-600"
        },
        {
            title: "Total Chats",
            value: dashboardData.chat?.total?.toLocaleString() || "0",
            icon: <FiMessageSquare className="w-6 h-6" />,
            color: "bg-green-500",
            bgColor: "bg-green-50",
            textColor: "text-green-600"
        },
        {
            title: "Total Contacts",
            value: dashboardData.contact?.total?.toLocaleString() || "0",
            icon: <FiUsers className="w-6 h-6" />,
            color: "bg-purple-500",
            bgColor: "bg-purple-50",
            textColor: "text-purple-600"
        },
        {
            title: "Total Templates",
            value: dashboardData.template?.total?.toLocaleString() || "0",
            icon: <FiFileText className="w-6 h-6" />,
            color: "bg-orange-500",
            bgColor: "bg-orange-50",
            textColor: "text-orange-600"
        },
        {
            title: "Total Messages",
            value: dashboardData.message?.total?.toLocaleString() || "0",
            icon: <FiMail className="w-6 h-6" />,
            color: "bg-teal-500",
            bgColor: "bg-teal-50",
            textColor: "text-teal-600"
        },
        {
            title: "Today Sent",
            value: dashboardData.message?.today_sent?.toLocaleString() || "0",
            icon: <FiSend className="w-6 h-6" />,
            color: "bg-pink-500",
            bgColor: "bg-pink-50",
            textColor: "text-pink-600"
        },
    ] : [
        { title: "Total Campaigns", value: "0", icon: <FiZap className="w-6 h-6" />, color: "bg-blue-500", bgColor: "bg-blue-50", textColor: "text-blue-600" },
        { title: "Total Chats", value: "0", icon: <FiMessageSquare className="w-6 h-6" />, color: "bg-green-500", bgColor: "bg-green-50", textColor: "text-green-600" },
        { title: "Total Contacts", value: "0", icon: <FiUsers className="w-6 h-6" />, color: "bg-purple-500", bgColor: "bg-purple-50", textColor: "text-purple-600" },
        { title: "Total Templates", value: "0", icon: <FiFileText className="w-6 h-6" />, color: "bg-orange-500", bgColor: "bg-orange-50", textColor: "text-orange-600" },
        { title: "Total Messages", value: "0", icon: <FiMail className="w-6 h-6" />, color: "bg-teal-500", bgColor: "bg-teal-50", textColor: "text-teal-600" },
        { title: "Today Sent", value: "0", icon: <FiSend className="w-6 h-6" />, color: "bg-pink-500", bgColor: "bg-pink-50", textColor: "text-pink-600" },
        { title: "QR Scanned Users", value: "0", icon: <FiUserCheck className="w-6 h-6" />, color: "bg-indigo-500", bgColor: "bg-indigo-50", textColor: "text-indigo-600" },
    ];

    // Campaign message metrics
    const campaignMessageMetrics = dashboardData?.campaign?.message ? [
        { title: "Total Messages", value: dashboardData.campaign.message.total?.toLocaleString() || "0", icon: <FiMail className="w-5 h-5" />, color: "text-blue-600", bgColor: "bg-blue-100" },
        { title: "Sent", value: dashboardData.campaign.message.sent?.toLocaleString() || "0", icon: <FiSend className="w-5 h-5" />, color: "text-green-600", bgColor: "bg-green-100" },
        { title: "Pending", value: dashboardData.campaign.message.pending?.toLocaleString() || "0", icon: <FiClock className="w-5 h-5" />, color: "text-yellow-600", bgColor: "bg-yellow-100" },
        { title: "Delivered", value: dashboardData.campaign.message.delivered?.toLocaleString() || "0", icon: <FiCheckCircle className="w-5 h-5" />, color: "text-emerald-600", bgColor: "bg-emerald-100" },
        { title: "Read", value: dashboardData.campaign.message.read?.toLocaleString() || "0", icon: <FiActivity className="w-5 h-5" />, color: "text-indigo-600", bgColor: "bg-indigo-100" },
        { title: "Failed", value: dashboardData.campaign.message.failed?.toLocaleString() || "0", icon: <FiAlertCircle className="w-5 h-5" />, color: "text-red-600", bgColor: "bg-red-100" }
    ] : [];

    // Template status metrics
    const templateMetrics = dashboardData?.template ? [
        { title: "Approved", value: dashboardData.template.approved?.toLocaleString() || "0", icon: <FiUserCheck className="w-5 h-5" />, color: "text-green-600", bgColor: "bg-green-100", percentage: dashboardData.template.total > 0 ? Math.round((dashboardData.template.approved / dashboardData.template.total) * 100) : 0 },
        { title: "Pending", value: dashboardData.template.pending?.toLocaleString() || "0", icon: <FiClock className="w-5 h-5" />, color: "text-yellow-600", bgColor: "bg-yellow-100", percentage: dashboardData.template.total > 0 ? Math.round((dashboardData.template.pending / dashboardData.template.total) * 100) : 0 },
        { title: "Rejected", value: dashboardData.template.rejected?.toLocaleString() || "0", icon: <FiUserX className="w-5 h-5" />, color: "text-red-600", bgColor: "bg-red-100", percentage: dashboardData.template.total > 0 ? Math.round((dashboardData.template.rejected / dashboardData.template.total) * 100) : 0 }
    ] : [];

    const activities = [
        { id: 1, type: "Template", action: "Approved", name: "Order Confirmation", time: "10 min ago" },
        { id: 2, type: "Campaign", action: "Launched", name: "Summer Sale", time: "1 hour ago" },
        { id: 3, type: "Chat", action: "Assigned", name: "Customer #4582", time: "2 hours ago" },
    ];

    return (
        <div className="min-h-screen bg-[#f4f6fb]">
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

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full px-4 py-5">

                    {!hasSelectedProject && (
                        <NewUserWelcome onCreateProject={() => setShowCreateModal(true)} />
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* UPDATED SECTION: Main Metrics & Project Profile Layout Fix     */}
                    {/* ------------------------------------------------------------- */}

                    {hasSelectedProject && (
                        <>
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                    {[1, 2, 3, 4, 5, 6].map((index) => (
                                        <div key={index} className="bg-white rounded-xl shadow p-6 animate-pulse">
                                            <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
                                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : error ? (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
                                    <p className="text-red-600">{error}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 items-stretch">
                                    {/* Left Column: Metrics Grid (Takes 2/3 width on Desktop) */}
                                    <div className="lg:col-span-2">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 h-full">
                                            {mainMetrics.map((metric, index) => (
                                                <EnhancedMetricCard key={index} {...metric} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Column: Project Profile (Takes 1/3 width on Desktop) */}
                                    <div className="lg:col-span-1 h-full">
                                        <ProjectProfileCard
                                            project={projectMeta?.project}
                                            profile={projectMeta?.profile}
                                            loading={projectMetaLoading}
                                            error={projectMetaError}
                                            projectId={tokens?.selected_project_id}
                                            navigate={navigate}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* ------------------------------------------------------------- */}
                    {/* End of Updated Section                                        */}
                    {/* ------------------------------------------------------------- */}

                    {/* Campaign Message Analytics */}
                    {hasSelectedProject && !loading && !error && dashboardData?.campaign?.message && (
                        <div className="mb-5">
                            <div className="bg-white rounded-xl shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                                    <FiBarChart2 className="mr-2 text-blue-500" />
                                    Campaign Message Analytics
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                    {campaignMessageMetrics.map((metric, index) => (
                                        <MessageMetricCard key={index} {...metric} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Template Status & Performance Grid */}
                    {hasSelectedProject && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                            {/* Left column - Analytics and Activity */}
                            <div className="lg:col-span-2 space-y-6">

                                {/* Template Status Overview */}
                                {!loading && !error && dashboardData?.template && (
                                    <div className="bg-white rounded-xl shadow p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                                            <FiFileText className="mr-2 text-orange-500" />
                                            Template Status Overview
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {templateMetrics.map((metric, index) => (
                                                <TemplateStatusCard key={index} {...metric} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right column - Performance Stats */}
                            <div className="lg:col-span-1">
                                {!loading && !error && dashboardData && (
                                    <div className="bg-white rounded-xl shadow p-6 h-full">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                                            <FiTrendingUp className="mr-2 text-green-500" />
                                            Performance
                                        </h3>
                                        <div className="space-y-6">
                                            {/* Campaign Performance */}
                                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4">
                                                <h4 className="font-medium text-gray-900 mb-3">Campaign Success</h4>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Sent Success</span>
                                                        <span className="font-semibold text-green-600">
                                                            {dashboardData.campaign?.message?.total > 0
                                                                ? Math.round(((dashboardData.campaign.message.sent + dashboardData.campaign.message.delivered) / dashboardData.campaign.message.total) * 100)
                                                                : 0}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1">
                                                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${dashboardData.campaign?.message?.total > 0 ? ((dashboardData.campaign.message.sent + dashboardData.campaign.message.delivered) / dashboardData.campaign.message.total) * 100 : 0}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Template Approval */}
                                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
                                                <h4 className="font-medium text-gray-900 mb-3">Template Quality</h4>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">Approval Rate</span>
                                                        <span className="font-semibold text-green-600">
                                                            {dashboardData.template?.total > 0
                                                                ? Math.round((dashboardData.template.approved / dashboardData.template.total) * 100)
                                                                : 0}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-green-200 rounded-full h-1.5 mt-1">
                                                        <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${dashboardData.template?.total > 0 ? (dashboardData.template.approved / dashboardData.template.total) * 100 : 0}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
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

function ProjectProfileCard({ project, profile, loading, error, projectId, navigate }) {
    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow p-6 h-full animate-pulse flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2 w-full">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-6 bg-gray-200 rounded w-1/2" />
                    </div>
                </div>
                <div className="space-y-3 mt-auto">
                    {[1, 2, 3].map((key) => (
                        <div key={key} className="h-10 bg-gray-100 rounded" />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="bg-white rounded-xl shadow p-6 h-full flex flex-col items-center justify-center text-center">
                <div className="bg-indigo-50 p-4 rounded-full mb-4">
                    <FiUser className="text-indigo-500 w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {error ? 'Error Loading Profile' : 'Project Information'}
                </h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    {error || 'Select a project to view WhatsApp profile details.'}
                </p>
            </div>
        );
    }

    const imageSrc = project?.wa_display_image || profile?.profile_picture_url;
    const website = profile?.websites?.[0];
    const wa_number = profile?.wa_number

    return (
        <div className="bg-white rounded-xl shadow p-6 h-full flex flex-col overflow-hidden">
            {/* Header: Image & Name */}
            <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                    {imageSrc ? (
                        <img
                            src={imageSrc}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <FiUser className="text-gray-400 w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                    )}
                </div>

                <div
                    className="flex-1 min-w-0 group cursor-pointer p-4 rounded-lg border border-gray-200 
               hover:border-indigo-400 hover:shadow-md hover:bg-indigo-50/30 
               transition-all duration-200 active:scale-[0.99]"
                    onClick={() => navigate('/project-details')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate('/project-details')}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Project</p>
                                {project?.is_whatsapp_verified && (
                                    <FiShield className="text-emerald-500 w-3 h-3" title="Verified" />
                                )}
                            </div>
                            <h3
                                className="text-lg sm:text-xl font-bold text-gray-900 truncate 
                           group-hover:text-indigo-600 transition-colors"
                                title={project?.name}
                            >
                                {project?.name || '—'}
                            </h3>
                            <p className="text-sm text-gray-500 truncate mt-1">{project?.wa_display_name}</p>
                        </div>

                        {/* Clickable indicator */}
                        <FiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1
                                   group-hover:text-indigo-600 group-hover:translate-x-1 
                                   transition-all duration-200" />
                    </div>
                </div>
            </div>

            {/* Tags Section */}
            <div className="flex flex-wrap gap-2 mb-6">
                {project?.status && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {project.status.toUpperCase()}
                    </span>
                )}
                {project?.wa_quality_rating && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${project.wa_quality_rating === 'GREEN'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                        }`}>
                        Quality: {project.wa_quality_rating}
                    </span>
                )}
                {project?.wa_messaging_tier && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {project.wa_messaging_tier.replace('TIER_', 'T-').replace('_', ' ')}
                    </span>
                )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 mt-auto">
                <ProfileDetailRow
                    icon={<FiPhone className="w-4 h-4" />}
                    label="Number"
                    value={wa_number || project?.wa_number}
                />
                <ProfileDetailRow
                    icon={<FiFileText className="w-4 h-4" />}
                    label="Daily Limit"
                    value={typeof project?.daily_template_limit === 'number'
                        ? `${project.daily_template_limit} Templates`
                        : project?.daily_template_limit}
                />
                {/* <ProfileDetailRow
                    icon={<FiGlobe className="w-4 h-4" />}
                    label="Website"
                    value={website}
                    isLink={true}
                /> */}

                <ProfileDetailRow
                    icon={<FiActivity className="w-4 h-4" />}
                    label="Product"
                    value={profile?.messaging_product}
                />
            </div>
        </div>
    );
}

function ProfileDetailRow({ icon, label, value, isLink }) {
    if (!value) return null;

    return (
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
            <div className="text-indigo-500 mt-0.5 flex-shrink-0">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-0.5">{label}</p>
                {isLink ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-800 truncate block">
                        {value.replace(/^https?:\/\//, '')}
                    </a>
                ) : (
                    <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate" title={value}>
                        {value}
                    </p>
                )}
            </div>
        </div>
    );
}

function EnhancedMetricCard({ title, value, icon, color, bgColor, textColor }) {
    return (
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${bgColor} flex-shrink-0`}>
                    <div className={`${textColor} w-6 h-6`}>
                        {React.cloneElement(icon, { className: 'w-full h-full' })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MessageMetricCard({ title, value, icon, color, bgColor }) {
    return (
        <div className="bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} mb-3`}>
                <div className={color}>
                    {icon}
                </div>
            </div>
            <h4 className="text-xs font-medium text-gray-500 mb-1 truncate">{title}</h4>
            <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
    );
}

function TemplateStatusCard({ title, value, icon, color, bgColor, percentage }) {
    return (
        <div className="bg-white border border-gray-100 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${bgColor}`}>
                    <div className={color}>
                        {icon}
                    </div>
                </div>
                <span className={`text-sm font-bold ${color}`}>{percentage}%</span>
            </div>
            <h4 className="text-sm font-medium text-gray-500 mb-1">{title}</h4>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <div className="mt-3 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color.replace('text-', 'bg-')}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
}

function ActivityItem({ type, action, name, time }) {
    return (
        <div className="flex items-start p-2 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="flex-shrink-0 bg-indigo-50 rounded-lg p-2">
                {type === "Template" && <FiMail className="text-indigo-600" size={16} />}
                {type === "Campaign" && <FiZap className="text-indigo-600" size={16} />}
                {type === "Chat" && <FiMessageSquare className="text-indigo-600" size={16} />}
            </div>
            <div className="ml-3 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                    {action} <span className="text-indigo-600">{name}</span>
                </p>
                <p className="text-xs text-gray-500">{time}</p>
            </div>
        </div>
    );
}

export default Dashboard;