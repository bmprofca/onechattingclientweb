import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
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
    FiChevronLeft,
    FiChevronRight,
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
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-2xl',
        lg: 'max-w-4xl',
        xl: 'max-w-6xl'
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className={`relative mx-auto p-5 border w-full ${sizeClasses[size]} shadow-lg rounded-md bg-white transform transition-all duration-300 scale-95 opacity-0 animate-modal-in`}>
                <div className="mt-3">
                    <div className="flex items-center justify-between pb-3 border-b">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                            {title}
                        </h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                            <FiX className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="mt-4 max-h-96 overflow-y-auto">
                        {children}
                    </div>
                    <div className="items-center px-4 py-3 mt-4 flex justify-end space-x-4 border-t">
                        {actions}
                    </div>
                </div>
            </div>
        </div>
    );
};

const AddAgentForm = React.memo(({
    newAgent,
    formErrors,
    addingAgent,
    fetchingAgent,
    fetchedAgent,
    onInputChange,
    permissionOptions,
}) => {
    const selectedPermission = permissionOptions.find((option) => option.value && option.value === newAgent.permission_id);

    return (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile number</label>
                <div className="relative">
                    <input
                        type="tel"
                        name="mobile"
                        value={newAgent.mobile}
                        onChange={onInputChange}
                        maxLength={10}
                        inputMode="numeric"
                        className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.mobile ? 'border-red-400' : 'border-slate-200'}`}
                        placeholder="10-digit mobile number"
                        disabled={addingAgent}
                    />
                    {fetchingAgent && (
                        <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    )}
                </div>
                {formErrors.mobile ? (
                    <p className="mt-1.5 text-sm text-red-600">{formErrors.mobile}</p>
                ) : (
                    <p className="mt-1.5 text-xs text-slate-500">
                        The account is looked up automatically after 10 digits. Email is not used to find the user.
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
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h4 className="text-sm font-semibold text-slate-800">Account found</h4>
                            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-xs text-slate-500">Name</dt>
                                    <dd className="font-medium text-slate-900">{fetchedAgent.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-slate-500">Mobile</dt>
                                    <dd className="font-medium text-slate-900">{formatMobile(fetchedAgent)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-slate-500">Status</dt>
                                    <dd>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${fetchedAgent.status ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                            {fetchedAgent.status ? 'Active' : 'Inactive'}
                                        </span>
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-slate-500">Email</dt>
                                    <dd className="font-medium text-slate-900">{fetchedAgent.email || 'Not provided'}</dd>
                                </div>
                            </dl>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Permission</label>
                <SearchableSelect
                    name="permission_id"
                    value={newAgent.permission_id}
                    onChange={onInputChange}
                    options={permissionOptions}
                    placeholder="Select permission"
                    className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.permission ? 'border-red-400' : 'border-slate-200'}`}
                    disabled={addingAgent || !fetchedAgent}
                />
                {formErrors.permission && <p className="mt-1.5 text-sm text-red-600">{formErrors.permission}</p>}
                {!fetchedAgent && (
                    <p className="mt-1.5 text-xs text-amber-600">Enter a mobile number to choose a permission.</p>
                )}

                <AnimatePresence initial={false}>
                    {selectedPermission && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                                    {selectedPermission.label} access
                                </p>
                                <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                    {PERMISSION_OPTION_LABELS.map(([key, label]) => {
                                        const enabled = Boolean(selectedPermission.permissions?.[key]);
                                        return (
                                            <li key={key} className={`flex items-center gap-2 text-sm ${enabled ? 'text-slate-800' : 'text-slate-400'}`}>
                                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                {label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <p className="mt-3 text-xs text-slate-500">
                    They join this project only after they accept the invitation. An email is sent when their account has an email address.
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
    const [itemsPerPage] = useState(10);
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
    const totalPages = Math.ceil(agents.length / itemsPerPage);

    // Change page
    const paginate = (pageNumber) => {
        setCurrentPage(pageNumber);
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
        if (!showAddModal) return undefined;
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
    }, [showAddModal, newAgent.mobile]);

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
    const handlePermissionChange = (agent) => {
        setCurrentAgent(agent);
        setSelectedPermission(agent?.permission?.permission_id);
        setShowPermissionModal(true);
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
                className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setShowAddModal(false)}
                disabled={addingAgent}
            >
                Cancel
            </button>
            <button
                className="px-4 py-2 bg-indigo-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                onClick={() => setShowPermissionModal(false)}
            >
                Cancel
            </button>
            <button
                className="px-4 py-2 bg-indigo-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
            className="px-4 py-2 bg-indigo-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => setShowViewModal(false)}
        >
            Close
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50">
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

            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.button
                            type="button"
                            aria-label="Close invite agent"
                            className="absolute inset-0 bg-slate-900/50"
                            onClick={() => !addingAgent && setShowAddModal(false)}
                        />
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="relative flex max-h-[min(640px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">Invite agent</h3>
                                    <p className="mt-0.5 text-sm text-slate-500">They can accept or reject from Switch Project.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !addingAgent && setShowAddModal(false)}
                                    disabled={addingAgent}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                                >
                                    <FiX className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="scrollbar-hide overflow-y-auto px-5 py-5">
                                <AddAgentForm
                                    newAgent={newAgent}
                                    formErrors={formErrors}
                                    addingAgent={addingAgent}
                                    fetchingAgent={fetchingAgent}
                                    fetchedAgent={fetchedAgent}
                                    onInputChange={handleInputChange}
                                    permissionOptions={permissionOptions}
                                />
                            </div>
                            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
                                {addModalActions}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                title="Agent Details"
                size="md"
                actions={viewModalActions}
            >
                {currentAgent && (
                    <div className="px-4 py-3 space-y-6">
                        {/* Basic Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <p className="text-sm text-gray-900">{currentAgent.name}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <p className="text-sm text-gray-900">
                                        {currentAgent.status ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                Inactive
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                                    <p className="text-sm text-gray-900">{formatMobile(currentAgent)}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <p className="text-sm text-gray-900">{currentAgent.email || 'Not provided'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Permission Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Permission Level</h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <p className="text-sm text-gray-900">{getPermissionLabel(currentAgent.permission)} <button class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded" onClick={() => {
                                        handlePermissionChange(currentAgent);
                                        setShowViewModal(false);
                                    }}>
                                        <MdEdit />
                                    </button></p>
                                </div>
                            </div>
                        </div>

                        {/* Timeline Information */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Created On</label>
                                    <p className="text-sm text-gray-900">{formatDate(currentAgent.create_date)}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Modified</label>
                                    <p className="text-sm text-gray-900">{formatDate(currentAgent.modify_date)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Created By Section */}
                        {currentAgent.create_by && (
                            <div className="pt-4 border-t">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Created By</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <p className="text-sm text-gray-900">{currentAgent.create_by.name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                                        <p className="text-sm text-gray-900">{currentAgent.create_by.mobile}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modified By Section */}
                        {currentAgent.modify_by && (
                            <div className="pt-4 border-t">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Modified By</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <p className="text-sm text-gray-900">{currentAgent.modify_by.name}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                                        <p className="text-sm text-gray-900">{currentAgent.modify_by.mobile}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
                }`}>
                <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                    {/* Page header */}
                    <div className="md:flex md:items-center md:justify-between mb-6">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                                Agent Management
                            </h2>
                        </div>
                        <div className="mt-4 flex md:mt-0 md:ml-4 gap-2">
                            <button
                                onClick={() => {
                                    fetchAgents();
                                }}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <LuRefreshCcwDot className="mr-2" />
                                Refresh
                            </button>
                            <button
                                onClick={handleAddAgent}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <FiUserPlus className="mr-2" />
                                Invite Agent
                            </button>
                        </div>
                    </div>

                    {/* Agents table */}
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="w-14 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            #
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Agent
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Contact Info
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Permission
                                        </th>
                                        <th scope="col" className="w-16 px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loading ? (
                                        <TableSkeletonRows rows={itemsPerPage} cells={['index', 'avatar', 'text', 'badge', 'text', 'action']} />
                                    ) : (
                                        // Actual data rows
                                        currentAgents.map((agent, index) => (
                                            <tr key={agent.mapping_id || agent.mobile || index} className="hover:bg-gray-50">
                                                <td className="px-4 py-4 text-center text-sm text-gray-500">{indexOfFirstItem + index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-10 w-10">
                                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                                                <FiUser className="h-6 w-6 text-indigo-600" />
                                                            </div>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {agent.name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{formatMobile(agent)}</div>
                                                    <div className="text-sm text-gray-500">{agent.email || 'No email'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {agent.invitation_status === 'pending' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                            Invitation pending
                                                        </span>
                                                    ) : agent.status ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{getPermissionLabel(agent.permission)}</div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <RowActionMenu
                                                        items={[
                                                            { label: 'Details', icon: <FiEye size={15} />, onClick: () => handleViewAgent(agent) },
                                                            { label: 'Change permission', icon: <FiKey size={15} />, onClick: () => handlePermissionChange(agent), hidden: agent.invitation_status === 'pending' },
                                                            { label: agent.invitation_status === 'pending' ? 'Cancel invitation' : 'Delete', icon: <FiTrash2 size={15} />, onClick: () => handleDeleteAgent(agent), danger: true },
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!loading && (
                            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-sm text-gray-700">
                                            Showing <span className="font-medium">{indexOfFirstItem + 1}</span> to{' '}
                                            <span className="font-medium">
                                                {Math.min(indexOfLastItem, agents.length)}
                                            </span>{' '}
                                            of <span className="font-medium">{agents.length}</span> results
                                        </p>
                                    </div>
                                    <div>
                                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                            <button
                                                onClick={() => paginate(Math.max(1, currentPage - 1))}
                                                disabled={currentPage === 1}
                                                className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium 
                          ${currentPage === 1 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                <span className="sr-only">Previous</span>
                                                <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
                                            </button>

                                            {/* Page numbers */}
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => paginate(page)}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                            ${currentPage === page
                                                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                                                >
                                                    {page}
                                                </button>
                                            ))}

                                            <button
                                                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                                                disabled={currentPage === totalPages}
                                                className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium 
                          ${currentPage === totalPages ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                <span className="sr-only">Next</span>
                                                <FiChevronRight className="h-5 w-5" aria-hidden="true" />
                                            </button>
                                        </nav>
                                    </div>
                                </div>
                            </div>
                        )}
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