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
        if (mobileMenuOpen || isCreateModalOpen || isEditModalOpen || isSettingsModalOpen || isDeleteModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [mobileMenuOpen, isCreateModalOpen, isEditModalOpen, isSettingsModalOpen, isDeleteModalOpen]);

    // Get user tokens from localStorage
    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const parsedData = JSON.parse(userData);
            setTokens(parsedData);
        }
    }, []);

    const fetchPermissions = async () => {
        setPermissions([]);
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

            if (res_data.msg) {
                if (res_data.count > 0) {
                    setPermissions(res_data.data);
                } else {
                    setPermissions([]);
                }
            }

        } catch (error) {
            toast.error('Failed to load permission list');
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
        setCreateFormData({ name: '', remark: '' });
        setIsCreateModalOpen(true);
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

    const permissionPageCount = Math.max(1, Math.ceil(permissions.length / permissionPageSize) || 1);
    const safePermissionPage = Math.min(permissionPage, permissionPageCount);
    const pagedPermissions = permissions.slice(
        (safePermissionPage - 1) * permissionPageSize,
        safePermissionPage * permissionPageSize
    );

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
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
                }`}>
                <div className="w-full px-4 py-5">
                    {/* Header with title and create button - Professional styling */}
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                                    <FiKey className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                                        Permissions
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Three system roles are included with every project. Those cannot be deleted. You can still create your own.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex md:mt-0 md:ml-4">
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="relative inline-flex items-center px-6 py-2.5 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105"
                            >
                                <FiPlus className="w-4 h-4 mr-2" />
                                Create Permission
                            </button>
                        </div>
                    </div>

                    {/* Permissions Table - Professional card design */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80">
                                        <th className="w-14 px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            #
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Agents
                                        </th>
                                        <th className="w-16 px-3 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loading ? (
                                        <TableSkeletonRows rows={6} cells={['index', 'text', 'badge', 'action']} />
                                    ) : (
                                        pagedPermissions.map((permission, index) => (
                                            <tr
                                                key={permission.permission_id}
                                                className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-transparent transition-all duration-200 group"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-gray-900 bg-gray-50 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-100 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-all duration-200">
                                                        {(safePermissionPage - 1) * permissionPageSize + index + 1}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <FiTag className="w-4 h-4 text-indigo-500 mr-2" />
                                                        <span className="text-sm font-semibold text-gray-900">
                                                            {permission.name}
                                                        </span>
                                                        {permission.is_system && (
                                                            <span className="ml-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                                                <FiLock className="h-3 w-3" />
                                                                System
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center space-x-1">
                                                        <FiUsers className="w-4 h-4 text-indigo-400" />
                                                        <span className="text-sm font-medium text-gray-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                                            {permission.agent_count || 0}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <RowActionMenu
                                                        items={[
                                                            { label: 'Details', icon: <FiList className="h-4 w-4" />, onClick: () => setDetailsPermission(permission) },
                                                            { label: 'Edit', icon: <FiEdit className="h-4 w-4" />, onClick: () => handleEdit(permission) },
                                                            { label: 'Set access', icon: <FiSettings className="h-4 w-4" />, onClick: () => handleSettings(permission) },
                                                            { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, onClick: () => handleDelete(permission), danger: true, disabled: permission.is_system },
                                                        ]}
                                                    />
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

                    {/* Empty state - Professional design */}
                    {!loading && permissions.length === 0 && (
                        <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-gray-100 mt-6">
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-full inline-flex mx-auto">
                                <FiAlertCircle className="h-12 w-12 text-indigo-500" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-gray-900">No permissions found</h3>
                            <p className="mt-1 text-sm text-gray-500">Get started by creating your first permission.</p>
                            <div className="mt-6">
                                <button
                                    type="button"
                                    onClick={handleCreate}
                                    className="inline-flex items-center px-6 py-2.5 border border-transparent shadow-lg text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105"
                                >
                                    <FiPlus className="w-4 h-4 mr-2" />
                                    Create Permission
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

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

            {/* Create Permission Modal - Professional design */}
            {isCreateModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                        </div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-2xl px-6 pt-6 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-8 relative">
                            {/* Gradient header bar */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

                            <div className="absolute top-0 right-0 pt-5 pr-5">
                                <button
                                    type="button"
                                    disabled={formLoading}
                                    onClick={closeCreateModal}
                                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all duration-200"
                                >
                                    <span className="sr-only">Close</span>
                                    <FiX className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSubmit}>
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-0 text-center sm:mt-0 sm:text-left w-full">
                                        <div className="flex items-center space-x-3 mb-6">
                                            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                                                <FiPlus className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900">
                                                    Create Permission
                                                </h3>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    Add a new permission role to the system
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div>
                                                <label htmlFor="create-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                    Permission Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <FiKey className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        id="create-name"
                                                        required
                                                        disabled={formLoading}
                                                        value={createFormData.name}
                                                        onChange={handleCreateInputChange}
                                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 bg-gray-50 focus:bg-white"
                                                        placeholder="e.g., Manager, Editor, Viewer"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label htmlFor="create-remark" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                    Remark
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute top-3 left-3 pointer-events-none">
                                                        <FiList className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    <textarea
                                                        name="remark"
                                                        id="create-remark"
                                                        rows="3"
                                                        disabled={formLoading}
                                                        value={createFormData.remark}
                                                        onChange={handleCreateInputChange}
                                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 bg-gray-50 focus:bg-white"
                                                        placeholder="Enter a description or remark for this permission"
                                                    ></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent shadow-lg text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                                    >
                                        {formLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                                Creating...
                                            </>
                                        ) : (
                                            <>
                                                <FiSave className="w-4 h-4 mr-2" />
                                                Create Permission
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={formLoading}
                                        onClick={closeCreateModal}
                                        className="mt-3 sm:mt-0 w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Permission Modal - Updated color scheme to match Create modal */}
            {isEditModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                        </div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="inline-block align-bottom bg-white rounded-2xl px-6 pt-6 pb-6 text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-8 relative">
                            {/* Gradient header bar - now indigo/purple */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

                            <div className="absolute top-0 right-0 pt-5 pr-5">
                                <button
                                    type="button"
                                    disabled={formLoading}
                                    onClick={closeEditModal}
                                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all duration-200"
                                >
                                    <span className="sr-only">Close</span>
                                    <FiX className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleEditSubmit}>
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-0 text-center sm:mt-0 sm:text-left w-full">
                                        <div className="flex items-center space-x-3 mb-6">
                                            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                                                <FiEdit className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900">
                                                    Edit Permission
                                                </h3>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    Update the permission role details
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div>
                                                <label htmlFor="edit-name" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                    Permission Name <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <FiKey className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        id="edit-name"
                                                        required
                                                        disabled={formLoading}
                                                        value={editFormData.name}
                                                        onChange={handleEditInputChange}
                                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 bg-gray-50 focus:bg-white"
                                                        placeholder="Enter permission name"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label htmlFor="edit-remark" className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                    Remark
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute top-3 left-3 pointer-events-none">
                                                        <FiList className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                    <textarea
                                                        name="remark"
                                                        id="edit-remark"
                                                        rows="3"
                                                        disabled={formLoading}
                                                        value={editFormData.remark}
                                                        onChange={handleEditInputChange}
                                                        className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 bg-gray-50 focus:bg-white"
                                                        placeholder="Enter remark"
                                                    ></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 sm:mt-8 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                                    <button
                                        type="submit"
                                        disabled={formLoading}
                                        className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent shadow-lg text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                                    >
                                        {formLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                                Updating...
                                            </>
                                        ) : (
                                            <>
                                                <FiSave className="w-4 h-4 mr-2" />
                                                Update Permission
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={formLoading}
                                        onClick={closeEditModal}
                                        className="mt-3 sm:mt-0 w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal - Scrollable body, sticky bulk actions, fixed footer */}
            {isSettingsModalOpen && (
                <div className="fixed z-50 inset-0 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
                        </div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        {/* Modal container - flex column layout */}
                        <div className="inline-flex flex-col align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative"
                            style={{ maxHeight: '80vh' }}>

                            {/* Gradient header bar */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 z-10"></div>

                            {/* Fixed Header Section */}
                            <div className="flex-shrink-0 px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                                            <FiSettings className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">
                                                Permission Settings
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                Configure permissions for <span className="font-semibold text-indigo-600">{selectedPermission?.name}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={formLoading}
                                        onClick={closeSettingsModal}
                                        className="bg-gray-50 hover:bg-gray-100 rounded-xl p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all duration-200"
                                    >
                                        <span className="sr-only">Close</span>
                                        <FiX className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Sticky Bulk Actions Bar (outside scrollable area) */}
                            <div className="flex-shrink-0 px-6 sm:px-8 pb-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-y border-gray-100 bg-white">
                                    <div className="flex items-center space-x-2">
                                        <FiShield className="w-5 h-5 text-indigo-500" />
                                        <span className="text-sm font-semibold text-gray-800">Manage Permissions</span>
                                        <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                                            {permissionSettings.filter(p => p.status).length} active
                                        </span>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            type="button"
                                            onClick={handleSelectAll}
                                            disabled={formLoading}
                                            className="inline-flex items-center px-3 py-1.5 border border-indigo-200 text-xs font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        >
                                            <FiCheckSquare className="w-3.5 h-3.5 mr-1.5" />
                                            Select All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeselectAll}
                                            disabled={formLoading}
                                            className="inline-flex items-center px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                                        >
                                            <FiSquareIcon className="w-3.5 h-3.5 mr-1.5" />
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Body Section - only the permission list */}
                            <div className="flex-grow overflow-y-auto px-6 sm:px-8 py-2">
                                <PermissionList
                                    permissions={permissionSettings}
                                    onToggle={handleSettingToggle}
                                    disabled={formLoading}
                                    onSelectAll={handleSelectAll}      // still passed, but not used internally
                                    onDeselectAll={handleDeselectAll}  // still passed, but not used internally
                                    cardless={true}
                                    showBulkActions={false}           // HIDE internal bulk actions
                                    scrollRef={scrollContainerRef}    // PASS the ref for scroll position
                                />
                            </div>

                            {/* Fixed Footer Section */}
                            <div className="flex-shrink-0 px-6 py-5 sm:px-8 sm:py-6 bg-gray-50 border-t border-gray-100">
                                <div className="sm:flex sm:flex-row-reverse sm:gap-3">
                                    <button
                                        type="button"
                                        disabled={formLoading}
                                        onClick={handleSaveSettings}
                                        className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent shadow-lg text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] sm:w-auto sm:ml-3"
                                    >
                                        {formLoading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <FiSave className="w-4 h-4 mr-2" />
                                                Save Permission Settings
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={formLoading}
                                        onClick={closeSettingsModal}
                                        className="mt-3 sm:mt-0 w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 shadow-sm text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 sm:w-auto"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PermissionsList;