import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import { fetchProjectInfo } from '../store/projectSlice';
import {
    FiCode,
    FiLock,
    FiKey,
    FiRefreshCw,
    FiCopy,
    FiEye,
    FiEyeOff,
    FiUsers,
    FiExternalLink,
    FiX,
    FiAlertTriangle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';

const DEVELOPER_API_DOCS_URL = 'https://docs.onechatting.com';

const getAuthHeaders = () => {
    const userDataRaw = localStorage.getItem('userData');
    let token = '';
    let username = '';
    try {
        const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
        token = parsed?.token || '';
        username = parsed?.username || '';
    } catch (_) { }

    return {
        token,
        username,
        'Content-Type': 'application/json',
    };
};

const getProjectId = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem('userData') || '{}');
        return parsed?.selected_project_id || parsed?.projects?.[0]?.project_id || '';
    } catch (_) {
        return '';
    }
};

function ConfirmModal({ isOpen, title, message, confirmLabel, loading, onConfirm, onClose }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200"
                    >
                        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                    <FiAlertTriangle className="w-5 h-5" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-800 pt-1">{title}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {loading && (
                                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                {confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function TokenViewModal({ isOpen, userName, userEmail, token, onClose }) {
    const handleCopy = async () => {
        if (!token) return;
        try {
            await navigator.clipboard.writeText(token);
            toast.success('Token copied');
        } catch (_) {
            toast.error('Failed to copy token');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                                    <FiKey className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-semibold text-slate-800">Developer Token</h3>
                                    <p className="text-sm text-slate-500 mt-0.5 truncate">{userName}</p>
                                    {userEmail && (
                                        <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-5 py-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-sm font-mono text-slate-800 break-all leading-relaxed">{token}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                            >
                                <FiCopy className="w-4 h-4" />
                                Copy Token
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function TokenField({ token, onRegenerate, regenerating, emptyLabel = 'No token generated yet' }) {
    const [visible, setVisible] = useState(false);

    const handleCopy = async () => {
        if (!token) {
            toast.error('Nothing to copy');
            return;
        }
        try {
            await navigator.clipboard.writeText(token);
            toast.success('Token copied');
        } catch (_) {
            toast.error('Failed to copy token');
        }
    };

    const displayValue = token
        ? (visible ? token : `${token.slice(0, 8)}${'•'.repeat(24)}${token.slice(-8)}`)
        : emptyLabel;

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 min-h-[44px]">
                <FiKey className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className={`text-sm break-all font-mono ${token ? 'text-slate-800' : 'text-slate-400 italic'}`}>
                    {displayValue}
                </span>
                {token && (
                    <button
                        type="button"
                        onClick={() => setVisible((prev) => !prev)}
                        className="ml-auto p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title={visible ? 'Hide token' : 'Show token'}
                    >
                        {visible ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!token}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <FiCopy className="w-4 h-4" />
                    Copy
                </button>
                <button
                    type="button"
                    onClick={onRegenerate}
                    disabled={regenerating}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {regenerating ? (
                        <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <FiRefreshCw className="w-4 h-4" />
                    )}
                    {token ? 'Regenerate' : 'Generate'}
                </button>
            </div>
        </div>
    );
}

function DeveloperAccess() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isOwner = useSelector((state) => state.project?.owned ?? false);
    const projectInfo = useSelector((state) => state.project?.info);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    const [projectId, setProjectId] = useState('');
    const [loading, setLoading] = useState(true);
    const [userDetail, setUserDetail] = useState(null);
    const [developerAccess, setDeveloperAccess] = useState(false);
    const [accessLoading, setAccessLoading] = useState(false);
    const [projectToken, setProjectToken] = useState('');
    const [projectTokenLoading, setProjectTokenLoading] = useState(false);
    const [mappedUsers, setMappedUsers] = useState([]);
    const [userPage, setUserPage] = useState(1);
    const [userPageSize, setUserPageSize] = useState(20);
    const [userTokenLoading, setUserTokenLoading] = useState({});
    const [confirmModal, setConfirmModal] = useState({
        open: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        onConfirm: null,
    });
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [tokenViewModal, setTokenViewModal] = useState({
        open: false,
        userName: '',
        userEmail: '',
        token: '',
    });

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        if (projectInfo === null && dispatch) {
            dispatch(fetchProjectInfo());
        }
    }, [dispatch, projectInfo]);

    useEffect(() => {
        setProjectId(getProjectId());
    }, []);

    const closeTokenViewModal = () => {
        setTokenViewModal({
            open: false,
            userName: '',
            userEmail: '',
            token: '',
        });
    };

    const openTokenViewModal = (user) => {
        if (!user?.developer_token) return;
        setTokenViewModal({
            open: true,
            userName: user.name || '',
            userEmail: user.email || '',
            token: user.developer_token,
        });
    };

    const closeConfirmModal = () => {
        if (confirmLoading) return;
        setConfirmModal({
            open: false,
            title: '',
            message: '',
            confirmLabel: 'Confirm',
            onConfirm: null,
        });
    };

    const openConfirmModal = ({ title, message, confirmLabel, onConfirm }) => {
        setConfirmModal({
            open: true,
            title,
            message,
            confirmLabel: confirmLabel || 'Confirm',
            onConfirm,
        });
    };

    const handleConfirmAction = async () => {
        if (!confirmModal.onConfirm) return;
        setConfirmLoading(true);
        try {
            await confirmModal.onConfirm();
            closeConfirmModal();
        } finally {
            setConfirmLoading(false);
        }
    };

    const fetchAccessInfo = useCallback(async () => {
        const id = getProjectId();
        if (!id) {
            setLoading(false);
            return;
        }

        const headers = getAuthHeaders();
        if (!headers.token || !headers.username) {
            setLoading(false);
            toast.error('Session expired. Please log in again.');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/developer/access-info`,
                { project_id: id },
                { headers }
            );
            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to load developer access');
                return;
            }

            setDeveloperAccess(Boolean(response.data.developer_access));
            setProjectToken(response.data.developer_token || '');
            setMappedUsers(Array.isArray(response.data.users) ? response.data.users : []);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load developer access settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (projectId && isOwner) {
            fetchAccessInfo();
        } else if (!isOwner) {
            setLoading(false);
        }
    }, [projectId, isOwner, fetchAccessInfo]);

    const handleAccessChange = async (checked) => {
        if (!projectId) return;

        const headers = getAuthHeaders();
        if (!headers.token || !headers.username) {
            toast.error('Session expired. Please log in again.');
            return;
        }

        setAccessLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/developer/update-developer-access`,
                { status: checked, project_id: projectId },
                { headers }
            );

            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to update');
                return;
            }

            setDeveloperAccess(checked);
            toast.success(
                response?.data?.msg ||
                (checked
                    ? 'Developer access has been enabled'
                    : 'Developer access has been disabled')
            );
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to update developer access');
        } finally {
            setAccessLoading(false);
        }
    };

    const requestAccessChange = (checked) => {
        openConfirmModal({
            title: checked ? 'Enable developer access?' : 'Disable developer access?',
            message: checked
                ? 'External applications will be able to use developer tokens to access this project via the API.'
                : 'Developer API access for this project will be blocked until you enable it again.',
            confirmLabel: checked ? 'Enable' : 'Disable',
            onConfirm: () => handleAccessChange(checked),
        });
    };

    const handleRegenerateProjectToken = async () => {
        if (!projectId) return;

        const headers = getAuthHeaders();
        if (!headers.token || !headers.username) {
            toast.error('Session expired. Please log in again.');
            return;
        }

        setProjectTokenLoading(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/developer/update-developer-access`,
                { project_id: projectId },
                { headers }
            );

            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to generate token');
                return;
            }

            setProjectToken(response.data.developer_token || '');
            toast.success(response?.data?.msg || 'Developer token updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to generate token');
        } finally {
            setProjectTokenLoading(false);
        }
    };

    const requestProjectTokenRegenerate = () => {
        const isRegenerate = Boolean(projectToken);
        openConfirmModal({
            title: isRegenerate ? 'Regenerate project token?' : 'Generate project token?',
            message: isRegenerate
                ? 'The current project developer token will be invalidated immediately. Any integrations using it must be updated with the new token.'
                : 'A new project developer token will be created for API authentication.',
            confirmLabel: isRegenerate ? 'Regenerate' : 'Generate',
            onConfirm: handleRegenerateProjectToken,
        });
    };

    const handleRegenerateUserToken = async (uniqueId) => {
        if (!projectId || !uniqueId) return;

        const headers = getAuthHeaders();
        if (!headers.token || !headers.username) {
            toast.error('Session expired. Please log in again.');
            return;
        }

        setUserTokenLoading((prev) => ({ ...prev, [uniqueId]: true }));
        try {
            const response = await axios.put(
                `${API_BASE_URL}/developer/update-agent-developer-token`,
                { unique_id: uniqueId, project_id: projectId },
                { headers }
            );

            if (response?.data?.error) {
                toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to generate token');
                return;
            }

            const newToken = response.data.developer_token || '';
            setMappedUsers((prev) =>
                prev.map((user) =>
                    user.unique_id === uniqueId ? { ...user, developer_token: newToken } : user
                )
            );
            toast.success(response?.data?.msg || 'User token updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to generate user token');
        } finally {
            setUserTokenLoading((prev) => ({ ...prev, [uniqueId]: false }));
        }
    };

    const requestUserTokenRegenerate = (user) => {
        const isRegenerate = Boolean(user.developer_token);
        const userLabel = user.name || user.email || 'this user';
        openConfirmModal({
            title: isRegenerate ? `Regenerate token for ${userLabel}?` : `Generate token for ${userLabel}?`,
            message: isRegenerate
                ? 'The current developer token for this user will be invalidated immediately. Update any integrations using it.'
                : 'A new developer token will be created for this user.',
            confirmLabel: isRegenerate ? 'Regenerate' : 'Generate',
            onConfirm: () => handleRegenerateUserToken(user.unique_id),
        });
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
                            <p className="text-slate-600 mb-6">Only the project owner can manage developer access.</p>
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

    const userPageCount = Math.max(1, Math.ceil(mappedUsers.length / userPageSize) || 1);
    const safeUserPage = Math.min(userPage, userPageCount);
    const pagedUsers = mappedUsers.slice((safeUserPage - 1) * userPageSize, safeUserPage * userPageSize);

    return (
        <div className="min-h-screen bg-[#f4f6fb]">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full px-4 py-5">
                    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <FiCode className="w-7 h-7 text-indigo-600" />
                            Developer Access
                        </h1>
                        <a
                            href={DEVELOPER_API_DOCS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 self-start sm:self-auto px-4 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
                        >
                            <FiExternalLink className="w-4 h-4" />
                            API Reference
                        </a>
                    </div>

                    {loading ? (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
                                <div className="h-5 w-56 bg-slate-200 rounded" />
                                <div className="mt-3 h-4 w-80 bg-slate-100 rounded" />
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <table className="min-w-full">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            {['#', 'Name', 'Email', 'Role', 'Developer Token', ''].map((label, index) => (
                                                <th key={`${label}-${index}`} className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <TableSkeletonRows rows={5} cells={['index', 'text', 'text', 'badge', 'short', 'action']} />
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-100">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-800">Project Developer Access</h2>
                                            <p className="text-sm text-slate-600 mt-1">
                                                Turn on developer access to allow API integrations for this project.
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={developerAccess}
                                                disabled={accessLoading || confirmLoading}
                                                onChange={(e) => requestAccessChange(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-60" />
                                            <span className="ms-3 text-sm font-medium text-slate-700">
                                                {accessLoading ? 'Saving...' : (developerAccess ? 'Enabled' : 'Disabled')}
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div className="px-6 py-5">
                                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Project Developer Token</h3>
                                    <p className="text-sm text-slate-600 mb-4">
                                        Use this token for project-level developer API authentication.
                                    </p>
                                    <TokenField
                                        token={projectToken}
                                        onRegenerate={requestProjectTokenRegenerate}
                                        regenerating={projectTokenLoading}
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                            <FiUsers className="w-5 h-5 text-indigo-600" />
                                            User Tokens
                                        </h2>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                                        {mappedUsers.length} users
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">#</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Developer Token</th>
                                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100">
                                            {mappedUsers.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                                                        No active mapped users found for this project.
                                                    </td>
                                                </tr>
                                            ) : (
                                                pagedUsers.map((user, index) => (
                                                    <UserTokenRow
                                                        key={user.unique_id}
                                                        serialNo={(safeUserPage - 1) * userPageSize + index + 1}
                                                        user={user}
                                                        loading={Boolean(userTokenLoading[user.unique_id])}
                                                        onRegenerate={() => requestUserTokenRegenerate(user)}
                                                        onViewToken={() => openTokenViewModal(user)}
                                                        onDetails={() => setUserDetail(user)}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {mappedUsers.length > 0 ? (
                                    <Pagination
                                        currentPage={safeUserPage}
                                        totalPages={userPageCount}
                                        totalRecords={mappedUsers.length}
                                        pageSize={userPageSize}
                                        onPageChange={setUserPage}
                                        onPageSizeChange={(size) => {
                                            setUserPageSize(size);
                                            setUserPage(1);
                                        }}
                                        pageSizeOptions={[10, 20, 50, 100]}
                                    />
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.open}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmLabel={confirmModal.confirmLabel}
                loading={confirmLoading}
                onConfirm={handleConfirmAction}
                onClose={closeConfirmModal}
            />

            <RecordDetailsModal
                isOpen={Boolean(userDetail)}
                onClose={() => setUserDetail(null)}
                title={userDetail?.name || 'User'}
                subtitle={userDetail?.email}
                fields={userDetail ? [
                    { label: 'Email', value: userDetail.email },
                    { label: 'Role', value: userDetail.type === 'admin' ? 'Owner' : 'Agent' },
                    { label: 'Developer token', value: userDetail.developer_token ? 'Generated' : 'Not generated' },
                ] : []}
            />

            <TokenViewModal
                isOpen={tokenViewModal.open}
                userName={tokenViewModal.userName}
                userEmail={tokenViewModal.userEmail}
                token={tokenViewModal.token}
                onClose={closeTokenViewModal}
            />
        </div>
    );
}

function UserTokenRow({ serialNo, user, loading, onRegenerate, onViewToken, onDetails }) {
    const token = user.developer_token || '';

    return (
        <tr className="hover:bg-slate-50/80 transition-colors">
            <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">{serialNo}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{user.name}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{user.email}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.type === 'admin' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                    {user.type === 'admin' ? 'Owner' : 'Agent'}
                </span>
            </td>
            <td className="px-6 py-4 text-sm">
                {token ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Generated</span>
                ) : (
                    <span className="text-slate-400 italic">Not generated</span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
                <RowActionMenu
                    items={[
                        { label: 'Details', icon: <FiEye className="w-4 h-4" />, onClick: onDetails },
                        { label: 'View token', icon: <FiEye className="w-4 h-4" />, onClick: onViewToken, hidden: !token },
                        { label: token ? 'Regenerate' : 'Generate', icon: <FiRefreshCw className="w-4 h-4" />, onClick: onRegenerate, disabled: loading },
                    ]}
                />
            </td>
        </tr>
    );
}

export default DeveloperAccess;
