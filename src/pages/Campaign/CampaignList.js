import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../config/api';
import { Header, Sidebar } from '../../component/Menu';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../component/Pagination';
import SearchableSelect from '../../component/SearchableSelect';
import {
    FiPlus,
    FiSearch,
    FiTrash2,
    FiEye,
    FiX,
    FiLoader,
    FiZap,
    FiUsers,
    FiCalendar,
    FiCheckCircle,
    FiClock,
    FiXCircle,
    FiAlertCircle
} from 'react-icons/fi';
import moment from 'moment';
import { parseServerDate } from '../../utils/dateTime';
import axios from 'axios';
import toast from 'react-hot-toast';
import RowActionMenu from '../../component/table/RowActionMenu';
import RecordDetailsModal from '../../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../../component/table/TableSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Encrypt } from '../encryption/payload-encryption';


const CampaignList = () => {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tokens, setTokens] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);
    const [pageSize, setPageSize] = useState(20);

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [detailCampaign, setDetailCampaign] = useState(null);
    const [campaignToDelete, setCampaignToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

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
    }, []);

    // Fetch campaigns from API
    const fetchCampaigns = useCallback(async (page = 1) => {
        if (!tokens?.token || !tokens?.username) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const payload = {
                project_id: tokens.selected_project_id || '',
                page_no: page,
                limit: pageSize,
                status: filterStatus // 'all', 'complete', 'pending', 'stopped'
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/campaign/list`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response?.data?.error) {
                const apiCampaigns = response?.data?.data || [];

                // Map API response to component format
                const mappedCampaigns = apiCampaigns.map(campaign => {
                    // Map status: API uses 'pending'/'scheduled'/'complete'/'stopped', component uses 'scheduled'/'completed'/'failed'
                    let status = campaign.status;
                    if (status === 'pending') status = 'scheduled';
                    else if (status === 'complete') status = 'completed';
                    else if (status === 'stopped') status = 'failed';

                    // Get audience source (contact, group, excel, sheet)
                    const audienceSource = campaign.source === 'contact' ? 'Contacts' :
                        campaign.source === 'group' ? 'Contact Groups' :
                            campaign.source === 'excel' ? 'Excel Upload' :
                                campaign.source === 'sheet' ? 'Google Sheet' :
                                    'Custom';

                    return {
                        id: campaign.campaign_id,
                        name: campaign.name,
                        template: campaign.template?.template_name || 'N/A',
                        audience: audienceSource,
                        recipients: parseInt(campaign.recipients?.total || 0),
                        sent: parseInt(campaign.recipients?.sent || 0),
                        delivered: parseInt(campaign.recipients?.delivered || 0),
                        read: parseInt(campaign.recipients?.read || 0),
                        status: status,
                        createdDate: campaign.create_date,
                        scheduledDate: campaign.schedule_date || null,
                        completedDate: campaign.status === 'complete' ? campaign.modify_date : null,
                        hasError: campaign.has_error,
                        errorFile: campaign.error_file
                    };
                });

                // Replace campaigns (not append)
                setCampaigns(mappedCampaigns);

                // Update pagination metadata from API response
                const meta = response?.data?.meta || {};
                setCurrentPage(meta.page_no || page);
                setTotalPages(meta.total_pages || 1);
                setTotalRecords(meta.total_records || 0);
            } else {
                setError(response?.data?.message || 'Failed to fetch campaigns');
                setCampaigns([]);
            }
        } catch (err) {
            console.error('Error fetching campaigns:', err);
            setError(err?.response?.data?.message || err?.message || 'Failed to fetch campaigns');
            setCampaigns([]);
        } finally {
            setLoading(false);
        }
    }, [tokens, filterStatus, pageSize]);

    // Fetch campaigns when tokens are loaded or filter changes
    useEffect(() => {
        if (tokens?.token && tokens?.username) {
            setCurrentPage(1);
            fetchCampaigns(1);
        }
    }, [tokens?.token, tokens?.username, filterStatus, fetchCampaigns]);

    // Handler for page changes
    const handlePageChange = (page) => {
        fetchCampaigns(page);
    };

    // Handler for page size changes
    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(1);
    };

    // Refetch when page size changes
    useEffect(() => {
        if (tokens?.token && tokens?.username && pageSize) {
            fetchCampaigns(currentPage);
        }
    }, [pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

    const getStatusBadge = (status) => {
        const statusConfig = {
            completed: {
                bg: 'bg-green-100 dark:bg-green-900',
                text: 'text-green-800 dark:text-green-200',
                icon: <FiCheckCircle className="w-4 h-4" />,
                label: 'Completed'
            },
            scheduled: {
                bg: 'bg-blue-100 dark:bg-blue-900',
                text: 'text-blue-800 dark:text-blue-200',
                icon: <FiClock className="w-4 h-4" />,
                label: 'Scheduled'
            },
            pending: {
                bg: 'bg-yellow-100 dark:bg-yellow-900',
                text: 'text-yellow-800 dark:text-yellow-200',
                icon: <FiClock className="w-4 h-4" />,
                label: 'Pending'
            },
            draft: {
                bg: 'bg-gray-100 dark:bg-gray-700',
                text: 'text-gray-800 dark:text-gray-200',
                icon: <FiClock className="w-4 h-4" />,
                label: 'Draft'
            },
            failed: {
                bg: 'bg-red-100 dark:bg-red-900',
                text: 'text-red-800 dark:text-red-200',
                icon: <FiXCircle className="w-4 h-4" />,
                label: 'Failed'
            },
            stopped: {
                bg: 'bg-red-100 dark:bg-red-900',
                text: 'text-red-800 dark:text-red-200',
                icon: <FiXCircle className="w-4 h-4" />,
                label: 'Stopped'
            }
        };

        const config = statusConfig[status] || statusConfig.draft;
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                {config.icon}
                <span className="ml-1">{config.label}</span>
            </span>
        );
    };

    const filteredCampaigns = campaigns.filter(campaign => {
        const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            campaign.template.toLowerCase().includes(searchTerm.toLowerCase()) ||
            campaign.id.toLowerCase().includes(searchTerm.toLowerCase());

        // Map filter status to component status values
        let matchesStatus = true;
        if (filterStatus !== 'all') {
            if (filterStatus === 'complete') {
                matchesStatus = campaign.status === 'completed';
            } else if (filterStatus === 'pending') {
                matchesStatus = campaign.status === 'scheduled' || campaign.status === 'pending';
            } else if (filterStatus === 'stopped') {
                matchesStatus = campaign.status === 'failed' || campaign.status === 'stopped';
            } else {
                matchesStatus = campaign.status === filterStatus;
            }
        }

        return matchesSearch && matchesStatus;
    });

    const handleCreateCampaign = () => {
        navigate('/create-campaign');
    };

    const handleViewCampaign = (campaignId) => {
        navigate(`/campaign/${campaignId}`);
    };

    const openDeleteModal = (campaign) => {
        setCampaignToDelete(campaign);
        setDeleteError(null);
        setShowDeleteModal(true);
    };

    const closeDeleteModal = () => {
        setShowDeleteModal(false);
        setCampaignToDelete(null);
        setDeleteLoading(false);
        setDeleteError(null);
    };

    const handleDeleteConfirm = async () => {
        if (!campaignToDelete || !tokens?.token || !tokens?.username) {
            setDeleteError(campaignToDelete ? 'Session expired. Please log in again.' : 'No campaign selected.');
            return;
        }
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';
        if (!projectId) {
            setDeleteError('Project not selected.');
            return;
        }
        setDeleteLoading(true);
        setDeleteError(null);
        try {
            const payload = { project_id: projectId, campaign_id: campaignToDelete.id };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(`${API_BASE_URL}/campaign/delete`, JSON.stringify({ data, key }), {
                headers: {
                    token: tokens.token,
                    username: tokens.username,
                    'Content-Type': 'application/json'
                }
            });
            if (response?.data?.error) {
                setDeleteError(response?.data?.msg || response?.data?.error || 'Failed to delete campaign');
                return;
            }
            toast.success('Campaign deleted successfully');
            closeDeleteModal();
            fetchCampaigns(currentPage);
        } catch (err) {
            setDeleteError(err?.response?.data?.msg || err?.message || 'Failed to delete campaign');
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
                <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                    {/* Page Header */}
                    <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaigns</h1>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Manage and track your WhatsApp campaigns
                                </p>
                            </div>
                            <div className="mt-4 sm:mt-0">
                                <button
                                    onClick={handleCreateCampaign}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <FiPlus className="mr-2" size={18} />
                                    Create Campaign
                                </button>
                            </div>
                        </div>
                    </div>


                    {/* Summary Stats */}
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Campaigns</div>
                            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{campaigns.length}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</div>
                            <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
                                {campaigns.filter(c => c.status === 'completed').length}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</div>
                            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {campaigns.filter(c => c.status === 'scheduled' || c.status === 'pending').length}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Recipients</div>
                            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                                {campaigns.reduce((sum, c) => sum + c.recipients, 0).toLocaleString()}
                            </div>
                        </div>
                    </div>



                    {/* Search and Filter Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4 mt-6">
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Search */}
                            <div className="flex-1">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiSearch className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search campaigns..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    />
                                </div>
                            </div>

                            {/* Status Filter */}
                            <div className="sm:w-48">
                                <SearchableSelect
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    options={[
                                        { value: 'all', label: 'All Status' },
                                        { value: 'complete', label: 'Completed' },
                                        { value: 'pending', label: 'Pending' },
                                        { value: 'stopped', label: 'Stopped' },
                                    ]}
                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex items-center">
                                <FiAlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Campaigns Table */}
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            #
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Campaign
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Template
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Audience
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Recipients
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Created
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {loading ? (
                                        <TableSkeletonRows rows={8} cells={['index', 'avatar', 'text', 'short', 'short', 'badge', 'short', 'action']} />
                                    ) : filteredCampaigns.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                No campaigns found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCampaigns.map((campaign, index) => (
                                            <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 dark:text-white font-medium">
                                                        {(currentPage - 1) * pageSize + index + 1}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                                                            <FiZap size={20} />
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="flex items-center">
                                                                <button
                                                                    onClick={() => handleViewCampaign(campaign.id)}
                                                                    className="text-sm font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
                                                                >
                                                                    {campaign.name}
                                                                </button>
                                                                {campaign.hasError && (
                                                                    <a
                                                                        href={campaign.errorFile}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                                                                        title="View error file"
                                                                    >
                                                                        <FiAlertCircle size={16} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 dark:text-white">{campaign.template}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                                                        <FiUsers className="mr-1" size={16} />
                                                        {campaign.audience}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 dark:text-white">
                                                        <div className="font-medium">{campaign.recipients.toLocaleString()}</div>
                                                        {campaign.status === 'completed' && (
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {campaign.delivered} delivered, {campaign.read} read
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        {getStatusBadge(campaign.status)}
                                                        {campaign.status === 'scheduled' && campaign.scheduledDate && (
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                {moment(parseServerDate(campaign.scheduledDate)).format('MMM DD, HH:mm')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center">
                                                        <FiCalendar className="mr-1" size={14} />
                                                        {moment(parseServerDate(campaign.createdDate)).format('MMM DD, YYYY')}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <RowActionMenu
                                                        items={[
                                                            { label: 'Details', icon: <FiEye size={15} />, onClick: () => setDetailCampaign(campaign) },
                                                            { label: 'Open', icon: <FiZap size={15} />, onClick: () => handleViewCampaign(campaign.id) },
                                                            { label: 'Delete', icon: <FiTrash2 size={15} />, onClick: () => openDeleteModal(campaign), danger: true },
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
                        {!loading && filteredCampaigns.length > 0 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalRecords={totalRecords}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                                showPageSizeSelector={true}
                                showGoToPage={true}
                            />
                        )}
                    </div>


                </div>
            </div>

            <RecordDetailsModal
                isOpen={Boolean(detailCampaign)}
                onClose={() => setDetailCampaign(null)}
                title={detailCampaign?.name || 'Campaign'}
                fields={detailCampaign ? [
                    { label: 'Template', value: detailCampaign.template },
                    { label: 'Audience', value: detailCampaign.audience },
                    { label: 'Recipients', value: String(detailCampaign.recipients ?? '') },
                    { label: 'Delivered', value: String(detailCampaign.delivered ?? '') },
                    { label: 'Read', value: String(detailCampaign.read ?? '') },
                    { label: 'Status', value: detailCampaign.status },
                    { label: 'Scheduled', value: detailCampaign.scheduledDate ? moment(parseServerDate(detailCampaign.scheduledDate)).format('MMM DD, YYYY HH:mm') : '' },
                    { label: 'Created', value: detailCampaign.createdDate ? moment(parseServerDate(detailCampaign.createdDate)).format('MMM DD, YYYY') : '' },
                ] : []}
            />

            {/* Delete Campaign Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && campaignToDelete && (
                    <div key="delete-modal" className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex min-h-screen items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={closeDeleteModal}
                                aria-hidden="true"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-600" />
                                <div className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                            <FiTrash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Campaign</h3>
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                                Are you sure you want to delete this campaign? This action cannot be undone.
                                            </p>
                                            <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {campaignToDelete.name}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {deleteError && (
                                        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                            <p className="text-sm text-red-800 dark:text-red-200">{deleteError}</p>
                                        </div>
                                    )}
                                    <div className="mt-6 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={closeDeleteModal}
                                            disabled={deleteLoading}
                                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteConfirm}
                                            disabled={deleteLoading}
                                            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                                        >
                                            {deleteLoading ? (
                                                <FiLoader className="animate-spin" size={18} />
                                            ) : (
                                                <>
                                                    <FiTrash2 size={16} />
                                                    Delete
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CampaignList;
