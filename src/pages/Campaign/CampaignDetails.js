import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../config/api';
import { Header, Sidebar } from '../../component/Menu';
import SearchableSelect from '../../component/SearchableSelect';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiCopy,
  FiDownload,
  FiEye,
  FiLoader,
  FiPhone,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUsers,
  FiX,
  FiXCircle,
  FiZap
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
import DateTimePicker from './components/DateTimePicker';


const loadTokensFromStorage = () => {
  if (typeof window === 'undefined') return null;

  const storages = [localStorage, sessionStorage];
  for (const storage of storages) {
    try {
      const raw = storage?.getItem('userData');
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      // ignore and continue
    }
  }
  return null;
};

const getMessageStatus = (message) => {
  if (message?.failed_reason) return 'failed';
  if (message?.status) return message.status;
  if (message?.wamid && !message?.send_date) return 'pending';
  if (message?.send_date) return 'sent';
  return 'pending';
};

const mapMessageToRecipientRow = (message) => {
  let name = 'Unknown';
  if (Array.isArray(message?.component)) {
    const bodyComponent = message.component.find((c) => c.type === 'body');
    const textParam = bodyComponent?.parameters?.find((p) => p.type === 'text');
    if (textParam?.text) name = textParam.text;
  }
  if (name === 'Unknown' && message?.create_by?.name) name = message.create_by.name;

  return {
    id: message.unique_id,
    phone: message.number,
    name,
    status: getMessageStatus(message),
    date: message.send_date || message.create_date,
    templateName: message.template_name,
    templateId: message.template_id,
    wamid: message.wamid,
    failedReason: message.failed_reason,
    createBy: message.create_by,
    createDate: message.create_date,
    sendDate: message.send_date
  };
};

const CampaignDetails = () => {
  const navigate = useNavigate();
  const { campaignId } = useParams();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [tokens, setTokens] = useState(null);

  const [campaignDetails, setCampaignDetails] = useState(null);
  const [recipients, setRecipients] = useState([]);

  const [loadingDetails, setLoadingDetails] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [detailRecipient, setDetailRecipient] = useState(null);
  const [detailsError, setDetailsError] = useState(null);
  const [messagesError, setMessagesError] = useState(null);

  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Duplicate modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateScheduleDate, setDuplicateScheduleDate] = useState('');
  const [duplicateIsScheduled, setDuplicateIsScheduled] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    setTokens(loadTokensFromStorage());
  }, []);

  const postEncrypted = useCallback(
    async (path, payload) => {
      const { data, key } = Encrypt(payload);
      const body = JSON.stringify({ data, key });
      return axios.post(`${API_BASE_URL}${path}`, body, {
        headers: {
          token: tokens.token,
          username: tokens.username,
          'Content-Type': 'application/json'
        }
      });
    },
    [tokens?.token, tokens?.username]
  );

  const fetchCampaignDetails = useCallback(async () => {
    if (!tokens?.token || !tokens?.username || !campaignId) {
      setLoadingDetails(false);
      return;
    }

    setLoadingDetails(true);
    setDetailsError(null);
    try {
      const payload = {
        project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id || '',
        campaign_id: campaignId
      };
      const response = await postEncrypted('/campaign/campaign-details', payload);

      if (response?.data?.error) {
        setDetailsError(response?.data?.msg || 'Failed to fetch campaign details');
        setCampaignDetails(null);
        return;
      }
      setCampaignDetails(response?.data?.data || null);
    } catch (err) {
      setDetailsError(err?.response?.data?.msg || err?.message || 'Failed to fetch campaign details');
      setCampaignDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  }, [campaignId, postEncrypted, tokens?.projects, tokens?.token, tokens?.username]);

  const fetchCampaignMessages = useCallback(
    async (page = 1) => {
      if (!tokens?.token || !tokens?.username || !campaignId) {
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      setMessagesError(null);

      try {
        const project_id = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';
        const limit = Math.min(Math.max(1, itemsPerPage), 100);
        const payload = {
          project_id,
          campaign_id: campaignId,
          status: statusFilter === 'all' ? 'all' : statusFilter,
          page_no: page,
          limit
        };

        const response = await postEncrypted('/campaign/campaign-messages', payload);

        if (response?.data?.error) {
          setMessagesError(response?.data?.msg || response?.data?.message || 'Failed to fetch campaign messages');
          setRecipients([]);
          return;
        }

        const apiMessages = response?.data?.data || [];
        const mapped = apiMessages.map(mapMessageToRecipientRow);
        setRecipients(mapped);

        const meta = response?.data?.meta || {};
        setTotalRecords(Number(meta.total_records) || 0);
        setTotalPages(Math.max(1, Number(meta.total_pages) || 1));
        setHasMore(Boolean(meta.has_more));
      } catch (err) {
        setMessagesError(err?.response?.data?.msg || err?.response?.data?.message || err?.message || 'Failed to fetch campaign messages');
        setRecipients([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [campaignId, itemsPerPage, postEncrypted, statusFilter, tokens?.projects, tokens?.selected_project_id, tokens?.token, tokens?.username]
  );

  useEffect(() => {
    if (tokens?.token && tokens?.username && campaignId) fetchCampaignDetails();
  }, [campaignId, fetchCampaignDetails, tokens?.token, tokens?.username]);

  useEffect(() => {
    if (tokens?.token && tokens?.username && campaignId) fetchCampaignMessages(currentPage);
  }, [campaignId, currentPage, fetchCampaignMessages, statusFilter, itemsPerPage, tokens?.token, tokens?.username]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, itemsPerPage]);

  const getRecipientStatusBadge = (status) => {
    const statusConfig = {
      pending: {
        bg: 'bg-yellow-100 dark:bg-yellow-900',
        text: 'text-yellow-800 dark:text-yellow-200',
        icon: <FiClock className="w-3 h-3" />,
        label: 'Pending'
      },
      sent: {
        bg: 'bg-blue-100 dark:bg-blue-900',
        text: 'text-blue-800 dark:text-blue-200',
        icon: <FiSend className="w-3 h-3" />,
        label: 'Sent'
      },
      delivered: {
        bg: 'bg-green-100 dark:bg-green-900',
        text: 'text-green-800 dark:text-green-200',
        icon: <FiCheckCircle className="w-3 h-3" />,
        label: 'Delivered'
      },
      read: {
        bg: 'bg-purple-100 dark:bg-purple-900',
        text: 'text-purple-800 dark:text-purple-200',
        icon: <FiEye className="w-3 h-3" />,
        label: 'Read'
      },
      failed: {
        bg: 'bg-red-100 dark:bg-red-900',
        text: 'text-red-800 dark:text-red-200',
        icon: <FiXCircle className="w-3 h-3" />,
        label: 'Failed'
      }
    };

    const config = statusConfig[status] || statusConfig.sent;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </span>
    );
  };

  const filteredRecipients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((recipient) =>
      recipient.name.toLowerCase().includes(q) || recipient.phone.includes(q)
    );
  }, [recipients, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, itemsPerPage]);

  const startRecord = totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(currentPage * itemsPerPage, totalRecords);
  const paginatedRecipients = filteredRecipients;

  const campaignStats = useMemo(() => {
    const r = campaignDetails?.recipients || {};
    return {
      total: Number(r.total || 0),
      pending: Number(r.pending || 0),
      sent: Number(r.sent || 0),
      delivered: Number(r.delivered || 0),
      read: Number(r.read || 0),
      failed: Number(r.failed || 0)
    };
  }, [campaignDetails]);

  const percent = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);
  const deliveryRate = percent(campaignStats.delivered, campaignStats.sent);
  const readRate = percent(campaignStats.read, campaignStats.delivered);
  const sentRate = percent(campaignStats.sent, campaignStats.total);
  const pendingRate = percent(campaignStats.pending, campaignStats.total);
  const failedRate = percent(campaignStats.failed, campaignStats.total);

  const stats = useMemo(
    () => [
      {
        title: 'All',
        value: campaignStats.total.toLocaleString(),
        total: campaignStats.total.toLocaleString(),
        percentage: 100,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        icon: <FiUsers className="w-5 h-5" />
      },
      {
        title: 'Pending',
        value: campaignStats.pending.toLocaleString(),
        total: campaignStats.total.toLocaleString(),
        percentage: pendingRate,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        icon: <FiClock className="w-5 h-5" />
      },
      {
        title: 'Sent',
        value: campaignStats.sent.toLocaleString(),
        total: campaignStats.total.toLocaleString(),
        percentage: sentRate,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: <FiSend className="w-5 h-5" />
      },
      {
        title: 'Delivered',
        value: campaignStats.delivered.toLocaleString(),
        total: campaignStats.sent.toLocaleString(),
        percentage: deliveryRate,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: <FiCheckCircle className="w-5 h-5" />
      },
      {
        title: 'Read',
        value: campaignStats.read.toLocaleString(),
        total: campaignStats.delivered.toLocaleString(),
        percentage: readRate,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        icon: <FiEye className="w-5 h-5" />
      },
      {
        title: 'Failed',
        value: campaignStats.failed.toLocaleString(),
        total: campaignStats.total.toLocaleString(),
        percentage: failedRate,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: <FiXCircle className="w-5 h-5" />
      }
    ],
    [campaignStats, deliveryRate, failedRate, pendingRate, readRate, sentRate]
  );

  const showFailedReasonColumn = recipients.some((r) => r.failedReason);

  const handleBack = () => navigate('/campaigns');

  const openDeleteModal = () => {
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteLoading(false);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!tokens?.token || !tokens?.username) {
      setDeleteError('Session expired. Please log in again.');
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
      const payload = {
        project_id: projectId,
        campaign_id: campaignId
      };
      const response = await postEncrypted('/campaign/delete', payload);
      if (response?.data?.error) {
        setDeleteError(response?.data?.msg || response?.data?.error || 'Failed to delete campaign');
        return;
      }
      toast.success('Campaign deleted successfully');
      closeDeleteModal();
      navigate('/campaigns');
    } catch (err) {
      setDeleteError(err?.response?.data?.msg || err?.message || 'Failed to delete campaign');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = () => {
    const url = campaignDetails?.url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openDuplicateModal = () => {
    setDuplicateName(campaignDetails?.name ? `Copy of ${campaignDetails.name}` : '');
    setDuplicateScheduleDate('');
    setDuplicateIsScheduled(false);
    setDuplicateError(null);
    setShowDuplicateModal(true);
  };

  const closeDuplicateModal = () => {
    setShowDuplicateModal(false);
    setDuplicateName('');
    setDuplicateScheduleDate('');
    setDuplicateIsScheduled(false);
    setDuplicateLoading(false);
    setDuplicateError(null);
  };

  const formatScheduleDate = (dateTimeLocal) => {
    if (!dateTimeLocal) return null;
    const [date, time] = dateTimeLocal.split('T');
    return `${date} ${time}:00`;
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleDuplicateSubmit = async (e) => {
    e.preventDefault();
    setDuplicateError(null);
    const trimmedName = duplicateName?.trim();
    if (!trimmedName) {
      setDuplicateError('Please enter a campaign name.');
      return;
    }
    if (duplicateIsScheduled && !duplicateScheduleDate) {
      setDuplicateError('Please select a schedule date and time.');
      return;
    }
    if (!tokens?.token || !tokens?.username) {
      setDuplicateError('Session expired. Please log in again.');
      return;
    }
    setDuplicateLoading(true);
    try {
      const payload = {
        campaign_id: campaignId,
        name: trimmedName,
        schedule_date: duplicateIsScheduled ? formatScheduleDate(duplicateScheduleDate) : null
      };
      const response = await postEncrypted('/campaign/duplicate', payload);
      if (response?.data?.error) {
        setDuplicateError(response?.data?.msg || 'Failed to duplicate campaign');
        return;
      }
      toast.success('Campaign duplicated successfully');
      closeDuplicateModal();
      const newCampaignId = response?.data?.campaign_id || response?.data?.data?.campaign_id;
      if (newCampaignId) {
        navigate(`/campaign/${newCampaignId}`);
      } else {
        fetchCampaignDetails();
      }
    } catch (err) {
      setDuplicateError(err?.response?.data?.msg || err?.message || 'Failed to duplicate campaign');
    } finally {
      setDuplicateLoading(false);
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

      <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-6">
          <div className="mb-6">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors"
            >
              <FiArrowLeft className="mr-2" size={20} />
              Back to Campaigns
            </button>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="flex-shrink-0 h-12 w-12 flex items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">
                    <FiZap size={24} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaignDetails?.name || 'Campaign Details'}</h1>
                  </div>
                </div>
                {detailsError && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-800 dark:text-red-200">{detailsError}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 sm:mt-0 flex items-center space-x-3">
                <button
                  onClick={openDuplicateModal}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiCopy className="mr-2" size={16} />
                  Duplicate
                </button>
                <button
                  onClick={handleExport}
                  disabled={!campaignDetails?.url}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiDownload className="mr-2" size={16} />
                  Export
                </button>
                <button
                  onClick={openDeleteModal}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <FiTrash2 className="mr-2" size={16} />
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {stats.map((stat) => (
              <div key={stat.title} className={`${stat.bgColor} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={stat.color}>{stat.icon}</div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.title}</span>
                  </div>
                  <span className={`text-lg font-bold ${stat.color}`}>{stat.percentage}%</span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">/ {stat.total}</span>
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`${stat.color.replace('text-', 'bg-')} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(100, Math.max(0, stat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Campaign Information Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
              <FiZap className="mr-2 text-indigo-500" />
              Campaign Information
            </h3>
            {loadingDetails ? (
              <div className="flex items-center py-4 text-sm text-gray-600 dark:text-gray-400">
                <FiLoader className="animate-spin mr-2" size={18} />
                Loading details...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Template</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={campaignDetails?.template?.template_name}>
                      {campaignDetails?.template?.template_name || 'N/A'}
                    </p>
                    {campaignDetails?.template?.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200">
                        {campaignDetails.template.category}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Created By</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white truncate" title={campaignDetails?.create_by?.name}>
                    {campaignDetails?.create_by?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Created Date</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                    {campaignDetails?.create_date ? moment(parseServerDate(campaignDetails.create_date)).format('MMM DD, YYYY') : 'N/A'}
                    <span className="block text-xs text-gray-500 font-normal">
                      {campaignDetails?.create_date ? moment(parseServerDate(campaignDetails.create_date)).format('hh:mm A') : ''}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</p>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${campaignDetails?.status === 'complete' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        campaignDetails?.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                      {campaignDetails?.status || 'N/A'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Source</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white capitalize">
                    {campaignDetails?.source || 'N/A'}
                  </p>
                </div>
                {campaignDetails?.cost && (
                  <>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Cost</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                        <span className="text-gray-600 dark:text-gray-400">₹</span>
                        {Number(campaignDetails.cost.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">per message × total recipients</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Per Message Cost</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                        <span className="text-gray-600 dark:text-gray-400">₹</span>
                        {Number(campaignDetails.cost.per_message ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">when delivered</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Cost Used</p>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                        <span className="text-gray-600 dark:text-gray-400">₹</span>
                        {Number(campaignDetails.cost.used ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">delivered messages</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recipients Table Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <FiUsers className="mr-2 text-indigo-500" />
                Recipients List
                <span className="ml-2 px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {totalRecords}
                </span>
              </h3>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full sm:w-64 pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <SearchableSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Status' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'sent', label: 'Sent' },
                    { value: 'delivered', label: 'Delivered' },
                    { value: 'read', label: 'Read' },
                    { value: 'failed', label: 'Failed' },
                  ]}
                  className="block w-full sm:w-44 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {messagesError && (
              <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{messagesError}</p>
              </div>
            )}

            <div className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto">
                {loadingMessages ? (
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {['#', 'Phone', 'Status', 'Date', ''].map((label) => (
                          <th key={label || 'actions'} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <TableSkeletonRows rows={8} cells={['index', 'text', 'badge', 'text', 'action']} />
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                      <tr>
                        {/* <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                          Name / Template
                        </th> */}
                        <th scope="col" className="w-14 px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                          #
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                          Phone
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                          Date
                        </th>
                        <th scope="col" className="w-16 px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {paginatedRecipients.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            <div className="flex flex-col items-center justify-center">
                              <FiUsers className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                              <p className="text-base font-medium">No recipients found</p>
                              <p className="text-sm mt-1">Try adjusting your search or filters</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedRecipients.map((recipient, index) => (
                          <tr key={recipient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                            {/* <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{recipient.name}</span>
                                {recipient.templateName && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{recipient.templateName}</span>
                                )}
                              </div>
                            </td> */}
                            <td className="px-4 py-4 text-center text-sm text-gray-500">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-300">
                                <FiPhone className="mr-2 text-gray-400" size={14} />
                                <span className="font-mono">{recipient.phone}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getRecipientStatusBadge(recipient.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex flex-col">
                                <span>{moment(parseServerDate(recipient.date)).format('MMM DD, YYYY')}</span>
                                <span className="text-xs text-gray-400">{moment(parseServerDate(recipient.date)).format('hh:mm A')}</span>
                              </div>
                            </td>
                            <td className="px-3 py-4 text-right">
                              <RowActionMenu
                                items={[{ label: 'Details', icon: <FiEye size={15} />, onClick: () => setDetailRecipient(recipient) }]}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer Pagination */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing <span className="font-medium">{startRecord}</span> to <span className="font-medium">{endRecord}</span> of <span className="font-medium">{totalRecords}</span> results
              </div>

              <div className="flex items-center gap-2">
                <SearchableSelect
                  value={String(itemsPerPage)}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  options={[
                    { value: '10', label: '10 / pg' },
                    { value: '20', label: '20 / pg' },
                    { value: '25', label: '25 / pg' },
                    { value: '50', label: '50 / pg' },
                    { value: '100', label: '100 / pg' },
                  ]}
                  className="block w-28 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                />

                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loadingMessages}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:outline-offset-0">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || loadingMessages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <FiChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Campaign Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={closeDuplicateModal}
              aria-hidden="true"
            />
            <div className="relative w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Duplicate Campaign</h3>
                <button
                  onClick={closeDuplicateModal}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FiX size={20} />
                </button>
              </div>
              <form onSubmit={handleDuplicateSubmit} className="p-6 space-y-4">
                {duplicateError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-800 dark:text-red-200">{duplicateError}</p>
                  </div>
                )}
                <div>
                  <label htmlFor="duplicate-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Campaign Name
                  </label>
                  <input
                    id="duplicate-name"
                    type="text"
                    value={duplicateName}
                    onChange={(e) => setDuplicateName(e.target.value)}
                    placeholder="Enter campaign name"
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={duplicateIsScheduled}
                      onChange={(e) => setDuplicateIsScheduled(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Schedule for later</span>
                  </label>
                </div>
                {duplicateIsScheduled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Schedule Date & Time
                    </label>
                    <DateTimePicker
                      selectedDate={duplicateScheduleDate}
                      onChange={setDuplicateScheduleDate}
                      minDate={getMinDateTime()}
                      placeholder="Select date and time"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeDuplicateModal}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={duplicateLoading}
                    className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {duplicateLoading ? (
                      <FiLoader className="animate-spin" size={18} />
                    ) : (
                      'Duplicate'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
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
                      {campaignDetails?.name && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {campaignDetails.name}
                          </p>
                        </div>
                      )}
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
      <RecordDetailsModal
        isOpen={Boolean(detailRecipient)}
        onClose={() => setDetailRecipient(null)}
        title={detailRecipient?.phone || 'Recipient'}
        fields={detailRecipient ? [
          { label: 'Name', value: detailRecipient.name },
          { label: 'Phone', value: detailRecipient.phone },
          { label: 'Status', value: detailRecipient.status },
          { label: 'Date', value: detailRecipient.date ? moment(parseServerDate(detailRecipient.date)).format('MMM DD, YYYY hh:mm A') : '' },
          { label: 'Error details', value: detailRecipient.failedReason },
          { label: 'Template', value: detailRecipient.templateName },
        ] : []}
      />
    </div>
  );
};

export default CampaignDetails;
