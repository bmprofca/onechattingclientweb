import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import { Encrypt } from './encryption/payload-encryption';
import axios from 'axios';
import toast from 'react-hot-toast';
import moment from 'moment/moment';
import { parseServerDate } from '../utils/dateTime';
import {
    FiEdit,
    FiSettings,
    FiX,
    FiAlertCircle,
    FiSave,
    FiUser,
    FiMail,
    FiPhone,
    FiCalendar,
    FiCheck,
    FiSquare,
    FiPlus,
    FiTrash2,
    FiShield,
    FiLock,
    FiKey,
    FiUsers,
    FiClock,
    FiTag,
    FiList,
    FiCheckSquare,
    FiSquare as FiSquareIcon
} from 'react-icons/fi';
import RowActionMenu from '../component/table/RowActionMenu';
import Pagination from '../component/Pagination';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';

import AnimatedModal from '../component/Modals/AnimatedModal';
const PERMISSION_MATRIX = [
    { area: 'Contacts', view: 'view contact', create: 'create contact', edit: 'edit contact', delete: 'delete contact' },
    { area: 'Templates', create: 'create template', edit: 'edit template', delete: 'delete template' },
    { area: 'Live chat', view: 'view all chat' },
];

const EXTRA_FLAGS = [
    { permission: 'chat assign access', label: 'Can assign and reassign live chats' },
    { permission: 'broadcast access', label: 'Broadcast access' },
    { permission: 'setting access', label: 'Settings access' },
];

function PermissionsList() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [permissions, setPermissions] = useState([]);
    const [permissionPage, setPermissionPage] = useState(1);
    const [permissionPageSize, setPermissionPageSize] = useState(20);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingPermission, setDeletingPermission] = useState(null);
    const [detailsPermission, setDetailsPermission] = useState(null);
    const [editingPermission, setEditingPermission] = useState(null);
    const [selectedPermission, setSelectedPermission] = useState(null);
    const [createFormData, setCreateFormData] = useState({
        name: '',
        remark: ''
    });
    const [editFormData, setEditFormData] = useState({
        name: '',
        remark: ''
    });
    const [formLoading, setFormLoading] = useState(false);
    const [permissionSettings, setPermissionSettings] = useState([]);
    const [tokens, setTokens] = useState(null);
    const [editorMode, setEditorMode] = useState('edit');
    const [activeRoleId, setActiveRoleId] = useState(null);
    const [roleModalOpen, setRoleModalOpen] = useState(false);

    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    // Available permissions list with proper mapping to API keys
    const availablePermissions = [
        { permission: "create contact", apiKey: "contact_create", status: false },
        { permission: "edit contact", apiKey: "contact_edit", status: false },
        { permission: "delete contact", apiKey: "contact_delete", status: false },
        { permission: "view contact", apiKey: "contact_view", status: false },
        { permission: "create template", apiKey: "template_create", status: false },
        { permission: "edit template", apiKey: "template_edit", status: false },
        { permission: "delete template", apiKey: "template_delete", status: false },
        { permission: "view all chat", apiKey: "all_chat_view", status: false },
        { permission: "broadcast access", apiKey: "broadcast_access", status: false },
        { permission: "setting access", apiKey: "setting_access", status: false },
        { permission: "chat assign access", apiKey: "chat_assign_access", status: false },
    ];

    // Ref to track scroll position
    const scrollContainerRef = useRef(null);
    const scrollPositionRef = useRef(0);

    // Prevent background scrolling when mobile menu or any modal is open
    useEffect(() => {
        if (mobileMenuOpen || isCreateModalOpen || isEditModalOpen || isSettingsModalOpen || isDeleteModalOpen || roleModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [mobileMenuOpen, isCreateModalOpen, isEditModalOpen, isSettingsModalOpen, isDeleteModalOpen, roleModalOpen]);

    // Get user tokens from localStorage
    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const parsedData = JSON.parse(userData);
            setTokens(parsedData);
        }
    }, []);

    const fetchPermissions = async () => {
        setLoading(true);
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

            if (res_data.error) {
                toast.error(res_data.error);
            }

            let list = [];
            if (res_data.msg) {
                if (res_data.count > 0) {
                    list = res_data.data || [];
                    setPermissions(list);
                } else {
                    setPermissions([]);
                }
            }
            return list;

        } catch (error) {
            toast.error('Failed to load permission list');
            return [];
        } finally {
            setLoading(false);
        }
    };

    // Initial fetch when tokens are available
    useEffect(() => {
        if (tokens) {
            fetchPermissions();
        }
    }, [tokens]);

    // Create Permission Functions
    const handleCreate = () => {
        setEditorMode('create');
        setCreateFormData({ name: '', remark: '' });
        setPermissionSettings(availablePermissions.map((item) => ({ ...item, status: false })));
        setRoleModalOpen(true);
    };

    const openRoleModal = (permission) => {
        setEditorMode('edit');
        setActiveRoleId(permission.permission_id);
        setRoleModalOpen(true);
    };

    const handleCreateInputChange = (e) => {
        const { name, value } = e.target;
        setCreateFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);

        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                name: createFormData.name,
                remark: createFormData.remark
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/permission/create`,
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
                toast.error(res_data.error);
                return;
            }

            if (res_data.msg) {
                await fetchPermissions();
                setIsCreateModalOpen(false);
                setCreateFormData({ name: '', remark: '' });
                toast.success('Permission created successfully!');
            }

        } catch (error) {
            console.error('Error creating permission:', error);
            toast.error('Error creating permission. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    // Edit Permission Functions
    const handleEdit = (permission) => {
        setEditingPermission(permission);
        setEditFormData({
            name: permission.name,
            remark: permission.remark
        });
        setIsEditModalOpen(true);
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);

        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                permission_id: editingPermission.permission_id,
                name: editFormData.name,
                remark: editFormData.remark
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/permission/edit`,
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
                return;
            }

            if (res_data.msg) {
                await fetchPermissions();
                setIsEditModalOpen(false);
                setEditFormData({ name: '', remark: '' });
                setEditingPermission(null);
                toast.success('Permission updated successfully!');
            }

        } catch (error) {
            console.error('Error updating permission:', error);
            toast.error('Error updating permission. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = (permission) => {
        if (permission?.is_system) {
            toast.error('System permissions cannot be deleted');
            return;
        }
        setDeletingPermission(permission);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteSubmit = async () => {
        if (!deletingPermission || deletingPermission.is_system) return;
        setFormLoading(true);
        try {
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                permission_id: deletingPermission.permission_id,
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/permission/delete`,
                JSON.stringify({ data, key }),
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
                toast.error(typeof res_data.error === 'string' ? res_data.error : 'Failed to delete permission');
                return;
            }
            toast.success(res_data.msg || 'Permission deleted successfully');
            setIsDeleteModalOpen(false);
            setDeletingPermission(null);
            await fetchPermissions();
        } catch (error) {
            toast.error('Failed to delete permission');
        } finally {
            setFormLoading(false);
        }
    };

    // Settings Functions
    const handleSettings = (permission) => {
        setSelectedPermission(permission);

        // Map the permission settings from API response to our format
        const mappedSettings = availablePermissions.map(item => ({
            ...item,
            status: permission.permissions?.[item.apiKey] || false
        }));

        setPermissionSettings(mappedSettings);
        setIsSettingsModalOpen(true);
    };

    const handleSettingToggle = useCallback((permissionName) => {
        setPermissionSettings(prevSettings => {
            const newSettings = prevSettings.map(setting =>
                setting.permission === permissionName
                    ? { ...setting, status: !setting.status }
                    : setting
            );

            // Save scroll position before state update
            if (scrollContainerRef.current) {
                scrollPositionRef.current = scrollContainerRef.current.scrollTop;
            }

            return newSettings;
        });
    }, []);

    // Restore scroll position after state update
    useEffect(() => {
        if (scrollContainerRef.current && scrollPositionRef.current > 0) {
            const restoreScroll = setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollPositionRef.current;
                }
            }, 0);

            return () => clearTimeout(restoreScroll);
        }
    }, [permissionSettings]);

    const handleSelectAll = useCallback(() => {
        // Save scroll position before update
        if (scrollContainerRef.current) {
            scrollPositionRef.current = scrollContainerRef.current.scrollTop;
        }

        setPermissionSettings(prevSettings =>
            prevSettings.map(setting => ({ ...setting, status: true }))
        );
    }, []);

    const handleDeselectAll = useCallback(() => {
        // Save scroll position before update
        if (scrollContainerRef.current) {
            scrollPositionRef.current = scrollContainerRef.current.scrollTop;
        }

        setPermissionSettings(prevSettings =>
            prevSettings.map(setting => ({ ...setting, status: false }))
        );
    }, []);

    const handleSaveSettings = async () => {
        setFormLoading(true);
        try {
            // Convert permissionSettings to the API format
            const payload = {
                project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                permission_id: selectedPermission.permission_id,
            };

            permissionSettings.forEach(setting => {
                payload[setting.apiKey] = setting.status;
            });

            console.log(payload);

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/permission/set-access`,
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
                return;
            }

            if (res_data.msg) {
                await fetchPermissions();
                setIsSettingsModalOpen(false);
                setSelectedPermission(null);
                toast.success(res_data.msg);
            }

        } catch (error) {
            console.log('Error saving permission settings:', error);
            toast.error('Error saving permission settings. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    useEffect(() => {
        if (editorMode === 'create') return;
        if (!permissions.length) {
            setActiveRoleId(null);
            return;
        }
        setActiveRoleId((current) => (
            current && permissions.some((item) => item.permission_id === current)
                ? current
                : permissions[0].permission_id
        ));
    }, [permissions, editorMode]);

    useEffect(() => {
        if (editorMode === 'create') return;
        const role = permissions.find((item) => item.permission_id === activeRoleId);
        if (!role) return;
        setSelectedPermission(role);
        setEditFormData({ name: role.name || '', remark: role.remark || '' });
        setPermissionSettings(availablePermissions.map((item) => ({
            ...item,
            status: Boolean(role.permissions?.[item.apiKey]),
        })));
    }, [activeRoleId, permissions, editorMode]);

    const handleCancelEditor = () => {
        setRoleModalOpen(false);
        if (editorMode === 'create') {
            setEditorMode('edit');
            return;
        }
        const role = permissions.find((item) => item.permission_id === activeRoleId);
        if (!role) return;
        setEditFormData({ name: role.name || '', remark: role.remark || '' });
        setPermissionSettings(availablePermissions.map((item) => ({
            ...item,
            status: Boolean(role.permissions?.[item.apiKey]),
        })));
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
        const headers = {
            token: tokens.token,
            username: tokens.username,
            'Content-Type': 'application/json',
        };
        setFormLoading(true);
        try {
            if (editorMode === 'create') {
                if (!createFormData.name.trim()) {
                    toast.error('Role name is required');
                    return;
                }
                const previousIds = new Set(permissions.map((item) => item.permission_id));
                const payload = {
                    project_id: projectId,
                    name: createFormData.name,
                    remark: createFormData.remark,
                };
                const { data, key } = Encrypt(payload);
                const response = await axios.post(
                    `${API_BASE_URL}/permission/create`,
                    JSON.stringify({ data, key }),
                    { headers }
                );
                if (response.data?.error) {
                    toast.error(response.data.error);
                    return;
                }
                const list = await fetchPermissions();
                const created = (list || []).find((item) => item.name === createFormData.name && !previousIds.has(item.permission_id))
                    || (list || []).find((item) => item.name === createFormData.name);
                if (created && permissionSettings.some((item) => item.status)) {
                    const accessPayload = {
                        project_id: projectId,
                        permission_id: created.permission_id,
                    };
                    permissionSettings.forEach((setting) => {
                        accessPayload[setting.apiKey] = setting.status;
                    });
                    const encrypted = Encrypt(accessPayload);
                    const accessResponse = await axios.post(
                        `${API_BASE_URL}/permission/set-access`,
                        JSON.stringify({ data: encrypted.data, key: encrypted.key }),
                        { headers }
                    );
                    if (accessResponse.data?.error) {
                        toast.error(accessResponse.data.error);
                        return;
                    }
                    await fetchPermissions();
                }
                setEditorMode('edit');
                setRoleModalOpen(false);
                if (created?.permission_id) setActiveRoleId(created.permission_id);
                toast.success('Permission created successfully!');
                return;
            }

            const role = permissions.find((item) => item.permission_id === activeRoleId);
            if (!role) return;
            if (!editFormData.name.trim()) {
                toast.error('Role name is required');
                return;
            }
            const editPayload = {
                project_id: projectId,
                permission_id: role.permission_id,
                name: editFormData.name,
                remark: editFormData.remark,
            };
            const encryptedEdit = Encrypt(editPayload);
            const editResponse = await axios.post(
                `${API_BASE_URL}/permission/edit`,
                JSON.stringify({ data: encryptedEdit.data, key: encryptedEdit.key }),
                { headers }
            );
            if (editResponse.data?.error) {
                toast.error(editResponse.data.error);
                return;
            }
            const accessPayload = {
                project_id: projectId,
                permission_id: role.permission_id,
            };
            permissionSettings.forEach((setting) => {
                accessPayload[setting.apiKey] = setting.status;
            });
            const encryptedAccess = Encrypt(accessPayload);
            const accessResponse = await axios.post(
                `${API_BASE_URL}/permission/set-access`,
                JSON.stringify({ data: encryptedAccess.data, key: encryptedAccess.key }),
                { headers }
            );
            if (accessResponse.data?.error) {
                toast.error(accessResponse.data.error);
                return;
            }
            await fetchPermissions();
            setRoleModalOpen(false);
            toast.success(accessResponse.data?.msg || 'Permission updated successfully!');
        } catch (error) {
            toast.error('Error saving role. Please try again.');
        } finally {
            setFormLoading(false);
        }
    };

    const settingByName = (permissionName) => permissionSettings.find((item) => item.permission === permissionName);

    // Close modal functions
    const closeCreateModal = () => setIsCreateModalOpen(false);
    const closeEditModal = () => setIsEditModalOpen(false);
    const closeSettingsModal = () => setIsSettingsModalOpen(false);

    // Skeleton loader component - Professional shimmer effect
    const formatPerson = (person) => {
        if (!person?.name && !person?.mobile) return '—';
        return [person.name, person.mobile, person.type].filter(Boolean).join(' · ');
    };

    // Permission Toggle Switch Component - Professional design
    const PermissionToggle = React.memo(({ permission, checked, onChange, disabled }) => {
        const handleClick = useCallback(() => {
            onChange(permission);
        }, [onChange, permission]);

        return (
            <button
                type="button"
                disabled={disabled}
                onClick={handleClick}
                className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-all ease-in-out duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transform hover:scale-105 ${checked
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                    : 'bg-gradient-to-r from-gray-200 to-gray-300'
                    }`}
                role="switch"
                aria-checked={checked}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition-all ease-in-out duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'
                        }`}
                />
            </button>
        );
    });

    // Permission List Component - Now supports cardless mode for modal usage
    // Permission List Component - Supports both card and cardless (modal) modes
    const PermissionList = React.memo(({
        permissions,
        onToggle,
        disabled,
        onSelectAll,
        onDeselectAll,
        cardless = false,
        showBulkActions = true,    // NEW: control bulk actions visibility
        scrollRef = null           // NEW: allow external ref for scroll container
    }) => {
        if (cardless) {
            return (
                <>
                    {/* Bulk Actions - only if showBulkActions is true */}
                    {showBulkActions && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
                            <div className="flex items-center space-x-2">
                                <FiShield className="w-5 h-5 text-indigo-500" />
                                <span className="text-sm font-semibold text-gray-800">Manage Permissions</span>
                                <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                    {permissions.filter(p => p.status).length} active
                                </span>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    type="button"
                                    onClick={onSelectAll}
                                    disabled={disabled}
                                    className="inline-flex items-center px-3 py-1.5 border border-indigo-200 text-xs font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                >
                                    <FiCheckSquare className="w-3.5 h-3.5 mr-1.5" />
                                    Select All
                                </button>
                                <button
                                    type="button"
                                    onClick={onDeselectAll}
                                    disabled={disabled}
                                    className="inline-flex items-center px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                >
                                    <FiSquareIcon className="w-3.5 h-3.5 mr-1.5" />
                                    Deselect All
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Permission Settings List - scrollable area */}
                    <div
                        ref={scrollRef || scrollContainerRef}  // Use provided ref or fallback to internal
                        className="overflow-y-auto divide-y divide-gray-50 pr-1"
                        style={{ maxHeight: showBulkActions ? '320px' : '100%' }}  // Adjust height if needed
                    >
                        {permissions.map((setting) => (
                            <div
                                key={setting.apiKey}
                                className="flex items-center justify-between p-3 hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-transparent transition-all duration-200 rounded-lg"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className={`w-2 h-2 rounded-full ${setting.status ? 'bg-green-500' : 'bg-gray-300'}`} />
                                    <span className="text-sm font-medium text-gray-700 capitalize">
                                        {setting.permission}
                                    </span>
                                    {setting.status && (
                                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[10px] font-medium border border-green-100">
                                            enabled
                                        </span>
                                    )}
                                </div>
                                <PermissionToggle
                                    permission={setting.permission}
                                    checked={setting.status}
                                    onChange={onToggle}
                                    disabled={disabled}
                                />
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        // Original card version (unchanged)
        return (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                {/* ... original card version content ... */}
            </div>
        );
    });

    const activeRole = permissions.find((item) => item.permission_id === activeRoleId) || null;
    const permissionPageCount = Math.max(1, Math.ceil(permissions.length / permissionPageSize) || 1);
    const safePermissionPage = Math.min(permissionPage, permissionPageCount);
    const pagedPermissions = permissions.slice(
        (safePermissionPage - 1) * permissionPageSize,
        safePermissionPage * permissionPageSize
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

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
                }`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Permissions</h1>
                            <p className="mt-1.5 text-sm text-ink-500">Roles decide what each agent can see and change in this project. System roles cannot be deleted.</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex items-center justify-center gap-2 h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700"
                        >
                            <FiPlus size={15} /> New role
                        </button>
                    </div>

                    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr>
                                        {['#', 'Role', 'Description', 'Agents', 'Actions'].map((label, index) => (
                                            <th
                                                key={label}
                                                className={`${index === 4 ? 'text-right' : 'text-left'} text-xs font-bold text-ink-500 px-3.5 py-3 bg-surface-soft border-b border-[#ECEAF3]`}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <TableSkeletonRows rows={6} cells={['index', 'text', 'text', 'short', 'action']} />
                                    ) : permissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-500">No roles yet.</td>
                                        </tr>
                                    ) : (
                                        pagedPermissions.map((permission, index) => (
                                            <tr key={permission.permission_id} className="hover:bg-surface-soft/60">
                                                <td className="px-3.5 py-3 border-b border-[#F3F2F8] text-xs font-semibold text-ink-500 oc-num">
                                                    {(safePermissionPage - 1) * permissionPageSize + index + 1}
                                                </td>
                                                <td className="px-3.5 py-3 border-b border-[#F3F2F8]">
                                                    <div className="text-sm font-semibold text-ink">{permission.name}</div>
                                                    {permission.is_system ? (
                                                        <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-ink-400">System</span>
                                                    ) : null}
                                                </td>
                                                <td className="px-3.5 py-3 border-b border-[#F3F2F8] text-sm text-ink-500 max-w-md">
                                                    <span className="line-clamp-2">{permission.remark || '—'}</span>
                                                </td>
                                                <td className="px-3.5 py-3 border-b border-[#F3F2F8] text-sm text-ink">{permission.agent_count || 0}</td>
                                                <td className="px-3.5 py-3 border-b border-[#F3F2F8]">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openRoleModal(permission)}
                                                            className="text-[13px] font-semibold text-brand-700 hover:text-brand-800"
                                                        >
                                                            Manage
                                                        </button>
                                                        <RowActionMenu
                                                            items={[
                                                                { label: 'Manage', icon: <FiEdit size={15} />, onClick: () => openRoleModal(permission) },
                                                                { label: 'Details', icon: <FiList size={15} />, onClick: () => setDetailsPermission(permission) },
                                                                { label: 'Delete', icon: <FiTrash2 size={15} />, onClick: () => handleDelete(permission), danger: true, hidden: permission.is_system },
                                                            ]}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {!loading && permissions.length > 0 ? (
                            <Pagination
                                currentPage={safePermissionPage}
                                totalPages={permissionPageCount}
                                totalRecords={permissions.length}
                                pageSize={permissionPageSize}
                                onPageChange={setPermissionPage}
                                onPageSizeChange={(size) => {
                                    setPermissionPageSize(size);
                                    setPermissionPage(1);
                                }}
                                pageSizeOptions={[10, 20, 50, 100]}
                            />
                        ) : null}
                    </div>
                </div>
            </div>

            <AnimatedModal open={roleModalOpen}>
                {roleModalOpen && (
                    <div className="fixed z-50 inset-0 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 py-8">
                            <div className="fixed inset-0 bg-gray-900/60" onClick={() => !formLoading && handleCancelEditor()} />
                            <form onSubmit={handleSaveRole} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-5 sm:p-6">
                            <div className="flex items-start justify-between gap-3 mb-5">
                                <div>
                                    <h2 className="text-[15px] font-bold text-ink">{editorMode === 'create' ? 'New role' : 'Edit role'}</h2>
                                    {editorMode !== 'create' && activeRole ? (
                                        <button type="button" onClick={() => setDetailsPermission(activeRole)} className="mt-1 text-[13px] font-semibold text-brand-700">
                                            View details
                                        </button>
                                    ) : null}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleSelectAll} disabled={formLoading} className="text-[12px] font-semibold text-brand-700 disabled:opacity-50">Select all</button>
                                    <button type="button" onClick={handleDeselectAll} disabled={formLoading} className="text-[12px] font-semibold text-ink-500 disabled:opacity-50">Clear</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Role name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        disabled={formLoading}
                                        value={editorMode === 'create' ? createFormData.name : editFormData.name}
                                        onChange={editorMode === 'create' ? handleCreateInputChange : handleEditInputChange}
                                        className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Description</label>
                                    <textarea
                                        name="remark"
                                        rows={2}
                                        disabled={formLoading}
                                        value={editorMode === 'create' ? createFormData.remark : editFormData.remark}
                                        onChange={editorMode === 'create' ? handleCreateInputChange : handleEditInputChange}
                                        className="w-full px-3 py-2.5 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr>
                                            {['Area', 'View', 'Create', 'Edit', 'Delete'].map((label) => (
                                                <th key={label} className="text-left text-xs font-bold text-ink-500 px-3 py-2.5 bg-surface-soft border-b border-[#ECEAF3]">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PERMISSION_MATRIX.map((row) => (
                                            <tr key={row.area}>
                                                <td className="px-3 py-3 border-b border-[#F3F2F8] text-sm font-semibold text-ink">{row.area}</td>
                                                {['view', 'create', 'edit', 'delete'].map((column) => {
                                                    const permissionName = row[column];
                                                    const setting = permissionName ? settingByName(permissionName) : null;
                                                    return (
                                                        <td key={column} className="px-3 py-3 border-b border-[#F3F2F8]">
                                                            {setting ? (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean(setting.status)}
                                                                    disabled={formLoading}
                                                                    onChange={() => handleSettingToggle(permissionName)}
                                                                    className="h-4 w-4 rounded border-line-strong accent-brand-600"
                                                                    aria-label={`${row.area} ${column}`}
                                                                />
                                                            ) : null}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 space-y-2">
                                {EXTRA_FLAGS.map((flag) => {
                                    const setting = settingByName(flag.permission);
                                    if (!setting) return null;
                                    return (
                                        <label key={flag.permission} className="flex items-center gap-2.5 text-sm text-ink">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(setting.status)}
                                                disabled={formLoading}
                                                onChange={() => handleSettingToggle(flag.permission)}
                                                className="h-4 w-4 rounded border-line-strong accent-brand-600"
                                            />
                                            {flag.label}
                                        </label>
                                    );
                                })}
                            </div>

                            <div className="mt-6 pt-4 border-t border-[#F3F2F8] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                {editorMode !== 'create' && activeRole ? (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(activeRole)}
                                        disabled={formLoading || activeRole.is_system}
                                        className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold text-rose-600 border border-rose-200 bg-white hover:bg-rose-50 disabled:opacity-40"
                                    >
                                        Delete role
                                    </button>
                                ) : <span />}
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCancelEditor}
                                        disabled={formLoading}
                                        className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formLoading || (editorMode !== 'create' && !activeRole)}
                                        className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                                    >
                                        {formLoading ? 'Saving...' : 'Save role'}
                                    </button>
                                </div>
                            </div>
                        </form>
                        </div>
                    </div>
                )}
            </AnimatedModal>

            <RecordDetailsModal
                isOpen={Boolean(detailsPermission)}
                onClose={() => setDetailsPermission(null)}
                title={detailsPermission?.name || 'Permission'}
                subtitle={detailsPermission?.is_system ? 'System role' : 'Custom permission'}
                fields={detailsPermission ? [
                    { label: 'Remark', value: detailsPermission.remark },
                    { label: 'Agents', value: String(detailsPermission.agent_count || 0) },
                    { label: 'Created by', value: formatPerson(detailsPermission.create_by) },
                    { label: 'Created', value: detailsPermission.create_date ? moment(parseServerDate(detailsPermission.create_date)).format('DD/MM/YYYY hh:mm A') : '—' },
                    { label: 'Modified by', value: formatPerson(detailsPermission.modify_by) },
                    { label: 'Modified', value: detailsPermission.modify_date ? moment(parseServerDate(detailsPermission.modify_date)).format('DD/MM/YYYY hh:mm A') : '—' },
                    ...Object.entries(detailsPermission.permissions || {}).map(([key, enabled]) => ({
                        label: key.replaceAll('_', ' '),
                        value: enabled ? 'Allowed' : 'Not allowed',
                    })),
                ] : []}
            />

            <AnimatedModal open={(isDeleteModalOpen && deletingPermission)}>
              {isDeleteModalOpen && deletingPermission && (
                  <div className="fixed z-50 inset-0 overflow-y-auto">
                      <div className="flex items-center justify-center min-h-screen px-4">
                          <div className="fixed inset-0 bg-gray-900/60" onClick={() => !formLoading && setIsDeleteModalOpen(false)} />
                          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                              <h3 className="text-lg font-bold text-gray-900">Delete permission</h3>
                              <p className="mt-2 text-sm text-gray-600">
                                  Delete <strong>{deletingPermission.name}</strong>? Agents already using it must be moved first.
                              </p>
                              <div className="mt-6 flex justify-end gap-2">
                                  <button
                                      type="button"
                                      disabled={formLoading}
                                      onClick={() => setIsDeleteModalOpen(false)}
                                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium"
                                  >
                                      Cancel
                                  </button>
                                  <button
                                      type="button"
                                      disabled={formLoading}
                                      onClick={handleDeleteSubmit}
                                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-60"
                                  >
                                      {formLoading ? 'Deleting…' : 'Delete'}
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
            </AnimatedModal>

        </div>
    );
}

export default PermissionsList;