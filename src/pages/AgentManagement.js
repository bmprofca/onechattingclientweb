import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import Pagination from '../component/Pagination';
import RowActionMenu from '../component/table/RowActionMenu';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    FiMessageSquare,
    FiMail,
    FiSettings,
    FiUsers,
    FiZap,
    FiCalendar,
    FiActivity,
    FiPlus,
    FiDownload,
    FiUpload,
    FiEdit,
    FiTrash2,
    FiUserPlus,
    FiCheckSquare,
    FiSquare,
    FiChevronDown,
    FiX,
    FiUser,
    FiFile,
    FiSave,
    FiEye,
    FiKey,
    FiLock
} from 'react-icons/fi';
import { Encrypt } from './encryption/payload-encryption';
import axios from 'axios';
import { parseServerDate } from '../utils/dateTime';
import { LuRefreshCcwDot } from 'react-icons/lu';
import { MdEdit } from 'react-icons/md';

import AnimatedModal from '../component/Modals/AnimatedModal';
const PERMISSION_OPTION_LABELS = [
    ['contact_view', 'View contacts'],
    ['contact_create', 'Create contacts'],
    ['contact_edit', 'Edit contacts'],
    ['contact_delete', 'Delete contacts'],
    ['all_chat_view', 'View all chats'],
    ['chat_assign_access', 'Assign chats'],
    ['template_create', 'Create templates'],
    ['template_edit', 'Edit templates'],
    ['template_delete', 'Delete templates'],
    ['broadcast_access', 'Broadcast'],
    ['setting_access', 'Settings'],
];

const formatMobile = (person) => {
    if (!person?.mobile) return '—';
    const code = String(person.country_code || '').trim();
    if (!code) return person.mobile;
    return `${code.startsWith('+') ? code : `+${code}`} ${person.mobile}`;
};

// Modal component outside to prevent rerenders
const Modal = ({ isOpen, onClose, title, children, actions, size = 'md' }) => {
    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl'
    };

    return (
        <AnimatedModal open={isOpen}>
        {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="fixed inset-0 bg-gray-900/60" onClick={onClose} />
                <div className={`relative w-full ${sizeClasses[size]} rounded-2xl bg-white shadow-2xl`}>
                    <div className="flex items-center justify-between border-b border-[#F3F2F8] px-5 py-4">
                        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-soft hover:text-ink"
                        >
                            <FiX className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                        {children}
                    </div>
                    {actions ? (
                        <div className="flex justify-end gap-2 border-t border-[#F3F2F8] px-5 py-4">
                            {actions}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
        )}
        </AnimatedModal>
    );
};

const initialsOf = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const AddAgentForm = React.memo(({
    newAgent,
    formErrors,
    addingAgent,
    fetchingAgent,
    fetchedAgent,
    onInputChange,
    onFind,
    permissionOptions,
}) => {
    const selectedPermission = permissionOptions.find((option) => option.value && option.value === newAgent.permission_id);

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-[13px] font-semibold text-ink mb-1.5">Mobile number</label>
                <div className="flex gap-2">
                    <input
                        type="tel"
                        name="mobile"
                        value={newAgent.mobile}
                        onChange={onInputChange}
                        maxLength={10}
                        inputMode="numeric"
                        className={`w-full h-[42px] px-3 rounded-[9px] border bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 ${formErrors.mobile ? 'border-rose-400' : 'border-line-strong'}`}
                        placeholder="10-digit mobile"
                        disabled={addingAgent}
                    />
                    <button
                        type="button"
                        onClick={onFind}
                        disabled={addingAgent || fetchingAgent}
                        className="inline-flex items-center justify-center h-[42px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft disabled:opacity-50"
                    >
                        {fetchingAgent ? '...' : 'Find'}
                    </button>
                </div>
                {formErrors.mobile ? (
                    <p className="mt-1.5 text-sm text-rose-600">{formErrors.mobile}</p>
                ) : (
                    <p className="mt-1.5 text-xs text-ink-400">
                        Looked up after 10 digits. Email is not used to find the user.
                    </p>
                )}
            </div>

            <AnimatePresence initial={false}>
                {fetchedAgent && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-3">
                            <div className="h-9 w-9 flex-none rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center">
                                {initialsOf(fetchedAgent.name)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Account found</div>
                                <div className="text-sm font-bold text-ink truncate">{fetchedAgent.name}</div>
                                <div className="text-xs text-ink-500 truncate">{fetchedAgent.email || 'Email not provided'}</div>
                                <div className="mt-1 text-xs text-ink-500">{formatMobile(fetchedAgent)} · {fetchedAgent.status ? 'Active' : 'Inactive'}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <label className="block text-[13px] font-semibold text-ink mb-1.5">Permission</label>
                <SearchableSelect
                    name="permission_id"
                    value={newAgent.permission_id}
                    onChange={onInputChange}
                    options={permissionOptions}
                    placeholder="Select permission"
                    className={`w-full h-[42px] px-3 rounded-[9px] border bg-white text-sm text-ink outline-none ${formErrors.permission ? 'border-rose-400' : 'border-line-strong'}`}
                    disabled={addingAgent || !fetchedAgent}
                />
                {formErrors.permission && <p className="mt-1.5 text-sm text-rose-600">{formErrors.permission}</p>}
                {!fetchedAgent && (
                    <p className="mt-1.5 text-xs text-amber-700">Enter a mobile number to choose a permission.</p>
                )}

                <AnimatePresence initial={false}>
                    {selectedPermission && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 rounded-[12px] border border-brand-100 bg-brand-50/70 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">
                                    {selectedPermission.label} access
                                </p>
                                <ul className="mt-2 grid grid-cols-1 gap-1.5">
                                    {PERMISSION_OPTION_LABELS.map(([key, label]) => {
                                        const enabled = Boolean(selectedPermission.permissions?.[key]);
                                        return (
                                            <li key={key} className={`flex items-center gap-2 text-[13px] ${enabled ? 'text-ink' : 'text-ink-400'}`}>
                                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-line'}`} />
                                                {label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="mt-3 text-xs text-ink-500">
                    They can accept or decline the invitation from Switch project. An email is sent when their account has an email address.
                </p>
            </div>
        </div>
    );
});

function AgentManagement() {
    const [tokens, setTokens] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [permissionOptions, setPermissionOptions] = useState([]);

    // Modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [currentAgent, setCurrentAgent] = useState(null);

    // Form states
    const [newAgent, setNewAgent] = useState({
        mobile: '',
        permission_id: ''
    });

    // Delete confirmation state
    const [deleteMobile, setDeleteMobile] = useState('');
    const [deleteError, setDeleteError] = useState('');

    // Loading state for add agent
    const [addingAgent, setAddingAgent] = useState(false);
    const [fetchingAgent, setFetchingAgent] = useState(false);
    const [fetchedAgent, setFetchedAgent] = useState(null);

    const [selectedPermission, setSelectedPermission] = useState('');
    const [formErrors, setFormErrors] = useState({});
    const [lookupNonce, setLookupNonce] = useState(0);

    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

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

    const fetchPermissions = async () => {
        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/permission/list`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;

            var arr = [
                {
                    value: '',
                    label: '-Select-'
                }
            ];
            if (res_data?.data && res_data?.data.length > 0) {
                res_data?.data.forEach(element => {
                    arr.push({
                        value: element.permission_id,
                        label: element.name,
                        permissions: element.permissions || {},
                    })
                });
            }

            setPermissionOptions(arr)

        } catch (error) {
            toast.error('Failed to load permission list');
        }
    };

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/agent/list`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;
            console.log(res_data);

            if (res_data.error) {
                toast.error(res_data.error);
            }

            if (res_data.data && res_data.count > 0) {
                setAgents(res_data.data);
            }

            setLoading(false);

        } catch (error) {
            toast.error('Failed to load agent list');
        }
    };

    const fetchAgentByMobile = async (mobile) => {
        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                mobile
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/agent/fetch-agent`, // Updated endpoint
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;

            if (res_data.error) {
                throw new Error(res_data.error);
            }

            if (res_data.data) {
                return res_data.data; // Return the first agent found
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch agent by mobile:', error);
            throw error;
        }
    };

    // Fetch agent by mapping_id for view modal
    const fetchAgentByMappingId = async (mappingId) => {
        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                mapping_id: mappingId
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/agent/mapping`, // Assuming this endpoint exists
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;

            if (res_data.error) {
                throw new Error(res_data.error);
            }

            if (res_data.data && res_data.data.length > 0) {
                return res_data.data[0];
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch agent by mapping ID:', error);
            // Fallback to local data if API fails
            return agents.find(agent => agent.mapping_id === mappingId) || null;
        }
    };

    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const parsedData = JSON.parse(userData);
            setTokens(parsedData);
        }
    }, []);

    useEffect(() => {
        if (tokens) {
            fetchAgents();
            fetchPermissions();
        }
    }, [tokens]);

    // Get current agents for pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentAgents = agents.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.max(1, Math.ceil(agents.length / itemsPerPage) || 1);

    const handlePageSizeChange = (size) => {
        setItemsPerPage(size);
        setCurrentPage(1);
    };

    // Handle delete agent
    const handleDeleteAgent = (agent) => {
        setCurrentAgent(agent);
        setDeleteMobile('');
        setDeleteError('');
        setShowDeleteModal(true);
    };

    const handleDeleteMobileChange = (e) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
        setDeleteMobile(value);

        if (currentAgent && value !== currentAgent.mobile) {
            setDeleteError('Mobile number does not match');
        } else {
            setDeleteError('');
        }
    };

    // Confirm delete
    const confirmDelete = async () => {
        if (!currentAgent || deleteMobile !== currentAgent.mobile) {
            setDeleteError('Please enter the correct mobile number to confirm deletion');
            return;
        }


        try {
            const isPendingInvite = currentAgent?.invitation_status === 'pending';
            const payload = isPendingInvite
                ? {
                    project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                    invitation_id: currentAgent?.invitation_id,
                }
                : {
                    project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                    mapping_id: currentAgent?.mapping_id,
                };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/agent/${isPendingInvite ? 'invitation/cancel' : 'delete'}`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;
            console.log(res_data);

            if (res_data?.error) {
                throw new Error(res_data?.error);
            }

            if (res_data?.msg) {
                toast.success(res_data?.msg);
                return null;
            }
        } catch (error) {
            console.log('Failed to delete agent:', error);
            toast.error('Failed to delete agent. Please try again.');
        } finally {
            fetchAgents();
            setShowDeleteModal(false);
            setCurrentAgent(null);
            setDeleteMobile('');
            setDeleteError('');
        }
    };

    // Handle add agent
    const handleAddAgent = () => {
        setNewAgent({
            mobile: '',
            permission_id: ''
        });
        setFormErrors({});
        setFetchedAgent(null);
        setShowAddModal(true);
    };

    const lookupRequestRef = useRef(0);

    useEffect(() => {
        const mobile = newAgent.mobile.trim();
        if (!/^\d{10}$/.test(mobile)) return undefined;

        const requestId = ++lookupRequestRef.current;
        const timer = setTimeout(async () => {
            setFetchingAgent(true);
            setFormErrors((prev) => ({ ...prev, mobile: '' }));
            try {
                const agentDetails = await fetchAgentByMobile(mobile);
                if (requestId !== lookupRequestRef.current) return;

                if (!agentDetails) {
                    setFetchedAgent(null);
                    setFormErrors({ mobile: 'No user found with this mobile number' });
                    return;
                }

                if (agents.some((agent) => agent.mobile === mobile)) {
                    setFetchedAgent(null);
                    setFormErrors({ mobile: 'This user is already an agent on this project' });
                    return;
                }

                setFetchedAgent(agentDetails);
            } catch (error) {
                if (requestId !== lookupRequestRef.current) return;
                setFetchedAgent(null);
                setFormErrors({ mobile: error.message || 'Failed to fetch agent details. Please try again.' });
            } finally {
                if (requestId === lookupRequestRef.current) setFetchingAgent(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [newAgent.mobile, lookupNonce]);

    const handleFindAgent = () => {
        const mobile = newAgent.mobile.trim();
        if (!/^\d{10}$/.test(mobile)) {
            setFormErrors((prev) => ({ ...prev, mobile: 'Enter a valid 10-digit mobile number' }));
            return;
        }
        setLookupNonce((value) => value + 1);
    };

    // Handle view agent - UPDATED to filter by mapping_id
    const handleViewAgent = async (agent) => {
        try {
            // Fetch the latest agent data by mapping_id
            const agentDetails = await fetchAgentByMappingId(agent.mapping_id);
            setCurrentAgent(agentDetails || agent); // Use fetched data or fallback to current agent data
            setShowViewModal(true);
        } catch (error) {
            console.error('Failed to fetch agent details:', error);
            // Fallback to the current agent data if API call fails
            setCurrentAgent(agent);
            setShowViewModal(true);
        }
    };

    // Handle permission change
    const handleManageAgent = (agent) => {
        setCurrentAgent(agent);
        setSelectedPermission(agent?.permission?.permission_id || '');
        setShowViewModal(true);
    };

    // Save permission change
    const savePermissionChange = async () => {

        if (selectedPermission == '') {
            return;
        }

        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                mapping_id: currentAgent?.mapping_id,
                permission_id: selectedPermission
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/agent/change-permission`, // Updated endpoint
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;

            if (res_data.error) {
                throw new Error(res_data.error);
            }

            if (res_data.msg) {
                toast.success(res_data.msg || 'Permission updated successfully');
                fetchAgents();
            }
            return null;
        } catch (error) {
            console.error('Failed to update permission:', error);
            toast.error('Failed to update permission. Please try again.');
            throw error;
        } finally {
            setShowPermissionModal(false);
            setShowViewModal(false);
            setCurrentAgent(null);
        }




    };

    // Handle input change for forms
    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;

        setNewAgent(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when user starts typing
        setFormErrors(prev => ({
            ...prev,
            [name]: '',
            ...(name === 'permission_id' ? { permission: '' } : {}),
        }));

        if (name === 'mobile') {
            const digits = value.replace(/\D/g, '').slice(0, 10);
            setNewAgent(prev => ({
                ...prev,
                mobile: digits
            }));
            setFetchedAgent(null);
            return;
        }
    }, []);

    // Handle permission selection change
    const handlePermissionSelectChange = useCallback((e) => {
        setSelectedPermission(e.target.value);
    }, []);

    // Validate form
    const validateForm = () => {
        const errors = {};

        if (!/^\d{10}$/.test(newAgent.mobile.trim())) {
            errors.mobile = 'Enter a valid 10-digit mobile number';
        }

        if (!fetchedAgent) {
            errors.mobile = errors.mobile || 'Look up a user with a 10-digit mobile number first';
        }

        if (!newAgent.permission_id) {
            errors.permission = 'Permission level is required';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Save new agent - updated to use fetched agent details
    const saveNewAgent = async () => {
        if (!validateForm()) return;

        setAddingAgent(true);
        try {

            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                mobile: newAgent?.mobile,
                permission_id: newAgent?.permission_id,
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/agent/add`, // Updated endpoint
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const res_data = response.data;
            if (res_data?.error) {
                toast.error(res_data?.error);
            }

            if (res_data.msg) {
                toast.success(res_data.msg);
                fetchAgents();
            }


            setShowAddModal(false);
            setNewAgent({
                mobile: '',
                permission_id: ''
            });
            setFetchedAgent(null);
        } catch (error) {
            console.error('Failed to add agent:', error);
            toast.error('Failed to add agent. Please try again.');
            setFormErrors({ general: 'Failed to add agent. Please try again.' });
        } finally {
            setAddingAgent(false);
        }
    };

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = parseServerDate(dateString);
        if (!date) return 'N/A';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get permission label from value
    const getPermissionLabel = (permission) => {
        if (!permission) return 'Unknown';

        const permissionValue = permission.permission_id || permission.name || permission;
        const permissionOption = permissionOptions.find(opt =>
            opt.value === permissionValue.toLowerCase() ||
            opt.label.toLowerCase().includes(permissionValue.toLowerCase())
        );
        return permissionOption ? permissionOption.label : permissionValue;
    };

    // Modal actions
    const addModalActions = (
        <>
            <button
                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft disabled:opacity-50"
                onClick={() => setShowAddModal(false)}
                disabled={addingAgent}
            >
                Cancel
            </button>
            <button
                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                onClick={saveNewAgent}
                disabled={addingAgent || !fetchedAgent}
            >
                {addingAgent ? (
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                    </div>
                ) : (
                    'Send invitation'
                )}
            </button>
        </>
    );

    const permissionModalActions = (
        <>
            <button
                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft"
                onClick={() => setShowPermissionModal(false)}
            >
                Cancel
            </button>
            <button
                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                onClick={savePermissionChange}
                disabled={selectedPermission == '' ? true : false}
            >
                Save Changes
            </button>
        </>
    );

    const deleteModalActions = (
        <>
            <button
                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft"
                onClick={() => setShowDeleteModal(false)}
            >
                Cancel
            </button>
            <button
                className={`px-4 py-2 text-white text-base font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${deleteMobile === currentAgent?.mobile
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-red-400 cursor-not-allowed'
                    }`}
                onClick={confirmDelete}
                disabled={deleteMobile !== currentAgent?.mobile}
            >
                {currentAgent?.invitation_status === 'pending' ? 'Cancel invitation' : 'Delete Agent'}
            </button>
        </>
    );

    const viewModalActions = (
        <button
            className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700"
            onClick={() => setShowViewModal(false)}
        >
            Close
        </button>
    );

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


            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title={currentAgent?.invitation_status === 'pending' ? 'Cancel invitation' : 'Confirm Delete'}
                actions={deleteModalActions}
            >
                <div className="px-4 py-3">
                    <p className="text-sm text-gray-500 mb-4">
                        {currentAgent?.invitation_status === 'pending'
                            ? <>Cancel the invitation for "<strong>{currentAgent?.name}</strong>"? They will not be added unless you invite them again.</>
                            : <>Are you sure you want to delete the agent "<strong>{currentAgent?.name}</strong>"? This action cannot be undone.</>
                        }
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                        To confirm, please type the agent's mobile number: <strong>{formatMobile(currentAgent)}</strong>
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm mobile number</label>
                        <input
                            type="tel"
                            value={deleteMobile}
                            onChange={handleDeleteMobileChange}
                            maxLength={10}
                            inputMode="numeric"
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${deleteError ? 'border-red-500' : 'border-gray-300'
                                }`}
                            placeholder="Enter the 10-digit mobile number"
                        />
                        {deleteError && <p className="mt-1 text-sm text-red-600">{deleteError}</p>}
                    </div>
                </div>
            </Modal>

            {/* Permission Change Modal */}
            <Modal
                isOpen={showPermissionModal}
                onClose={() => setShowPermissionModal(false)}
                title="Change Agent Permissions"
                actions={permissionModalActions}
            >
                <div className="px-4 py-3 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Permission Level for {currentAgent?.name}
                        </label>
                        <SearchableSelect
                            value={selectedPermission}
                            onChange={handlePermissionSelectChange}
                            options={permissionOptions}
                            placeholder="Select permission"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="text-sm text-gray-500">
                        <p>This will update the agent's permission level and adjust their access rights accordingly.</p>
                    </div>
                </div>
            </Modal>

            {/* View Agent Modal */}
            <Modal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                title="Manage agent"
                size="md"
                actions={viewModalActions}
            >
                {currentAgent && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 flex-none rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center">
                                {initialsOf(currentAgent.name)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-bold text-ink truncate">{currentAgent.name}</div>
                                <div className="text-xs text-ink-500 truncate">{currentAgent.email || 'Email not provided'}</div>
                            </div>
                            {currentAgent.invitation_status === 'pending' ? (
                                <span className="ml-auto inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">Invited</span>
                            ) : currentAgent.status ? (
                                <span className="ml-auto inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Active</span>
                            ) : (
                                <span className="ml-auto inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">Inactive</span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <div className="text-[12px] font-semibold text-ink-400">Mobile</div>
                                <div className="mt-1 text-sm text-ink">{formatMobile(currentAgent)}</div>
                            </div>
                            <div>
                                <div className="text-[12px] font-semibold text-ink-400">Added</div>
                                <div className="mt-1 text-sm text-ink">{formatDate(currentAgent.create_date)}</div>
                            </div>
                        </div>

                        {currentAgent.invitation_status !== 'pending' ? (
                            <div>
                                <label className="block text-[13px] font-semibold text-ink mb-1.5">Permission</label>
                                <SearchableSelect
                                    value={selectedPermission}
                                    onChange={handlePermissionSelectChange}
                                    options={permissionOptions}
                                    placeholder="Select permission"
                                    className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={savePermissionChange}
                                    disabled={!selectedPermission}
                                    className="mt-3 inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                                >
                                    Save permission
                                </button>
                            </div>
                        ) : null}

                        <div className="pt-2 border-t border-[#F3F2F8]">
                            <button
                                type="button"
                                onClick={() => handleDeleteAgent(currentAgent)}
                                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold text-rose-600 border border-rose-200 bg-white hover:bg-rose-50"
                            >
                                {currentAgent.invitation_status === 'pending' ? 'Cancel invitation' : 'Remove agent'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Invite agent"
                actions={addModalActions}
            >
                <AddAgentForm
                    newAgent={newAgent}
                    formErrors={formErrors}
                    addingAgent={addingAgent}
                    fetchingAgent={fetchingAgent}
                    fetchedAgent={fetchedAgent}
                    onInputChange={handleInputChange}
                    onFind={handleFindAgent}
                    permissionOptions={permissionOptions}
                />
            </Modal>

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Agents</h1>
                            <p className="mt-1.5 text-sm text-ink-500">Invite people and manage who can work in this project.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fetchAgents()}
                                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft"
                            >
                                <LuRefreshCcwDot className="mr-2" />
                                Refresh
                            </button>
                            <Link
                                to="/permission-list"
                                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft"
                            >
                                Manage permissions
                            </Link>
                            <button
                                type="button"
                                onClick={handleAddAgent}
                                className="inline-flex items-center justify-center gap-2 h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700"
                            >
                                <FiUserPlus size={15} /> Invite agent
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr>
                                            <th className="w-12 text-center text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">#</th>
                                            <th className="text-left text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">Agent</th>
                                            <th className="text-left text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">Mobile</th>
                                            <th className="text-left text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">Permission</th>
                                            <th className="text-left text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">Status</th>
                                            <th className="text-left text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">Added</th>
                                            <th className="text-right text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loading ? (
                                            <TableSkeletonRows rows={6} cells={['index', 'avatar', 'text', 'badge', 'badge', 'short', 'action']} />
                                        ) : currentAgents.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-500">No agents in this project yet.</td>
                                            </tr>
                                        ) : (
                                            currentAgents.map((agent, index) => {
                                                const added = parseServerDate(agent.create_date);
                                                const addedLabel = added
                                                    ? added.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                    : '';
                                                const pending = agent.invitation_status === 'pending';
                                                return (
                                                    <tr key={agent.mapping_id || agent.invitation_id || agent.mobile || index} className="hover:bg-surface-soft/60">
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8] text-center text-xs font-semibold text-ink-500 oc-num">{indexOfFirstItem + index + 1}</td>
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8]">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="h-9 w-9 flex-none rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center">
                                                                    {initialsOf(agent.name)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-sm font-semibold text-ink truncate">{agent.name}</div>
                                                                    {agent.email ? <div className="text-xs text-ink-500 truncate">{agent.email}</div> : null}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8] whitespace-nowrap text-sm font-mono text-ink">{formatMobile(agent)}</td>
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8]">
                                                            <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-800">
                                                                {getPermissionLabel(agent.permission)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8]">
                                                            {pending ? (
                                                                <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">Invited</span>
                                                            ) : agent.status ? (
                                                                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">Active</span>
                                                            ) : (
                                                                <span className="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8] whitespace-nowrap text-sm text-ink-500">{addedLabel}</td>
                                                        <td className="px-3.5 py-3 border-b border-[#F3F2F8]">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button type="button" onClick={() => handleManageAgent(agent)} className="text-[13px] font-semibold text-brand-700 hover:text-brand-800">
                                                                    Manage
                                                                </button>
                                                                <RowActionMenu
                                                                    items={[
                                                                        { label: 'Manage', icon: <FiEye size={15} />, onClick: () => handleManageAgent(agent) },
                                                                        { label: pending ? 'Cancel invitation' : 'Remove', icon: <FiTrash2 size={15} />, onClick: () => handleDeleteAgent(agent), danger: true },
                                                                    ]}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {!loading && agents.length > 0 ? (
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalRecords={agents.length}
                                    pageSize={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={handlePageSizeChange}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>

            {/* CSS for animations */}
            <style jsx>
                {`
                @keyframes modalIn {
                0% {
                    transform: scale(0.95);
                    opacity: 0;
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
                }
                .animate-modal-in {
                animation: modalIn 0.2s ease-out forwards;
                }
            `}
            </style>
        </div>
    );
}

export default AgentManagement;