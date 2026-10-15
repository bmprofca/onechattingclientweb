import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config/api';
import { Header, Sidebar } from '../../component/Menu';
import Pagination from '../../component/Pagination';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCopy,
  FiDownload,
  FiLoader,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX
} from 'react-icons/fi';
import moment from 'moment';
import { parseServerDate } from '../../utils/dateTime';
import axios from 'axios';
import toast from 'react-hot-toast';
import RecordDetailsModal from '../../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../../component/table/TableSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Encrypt } from '../encryption/payload-encryption';
import DateTimePicker from './components/DateTimePicker';


import AnimatedModal from '../../component/Modals/AnimatedModal';
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

const percentOf = (num, den) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

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
      pending: { bg: 'bg-amber-50', text: 'text-amber-800', label: 'Pending' },
      sent: { bg: 'bg-sky-50', text: 'text-sky-800', label: 'Sent' },
      delivered: { bg: 'bg-brand-50', text: 'text-brand-800', label: 'Delivered' },
      read: { bg: 'bg-[#EBE8FC]', text: 'text-brand-800', label: 'Read' },
      failed: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Failed' }
    };

    const config = statusConfig[status] || statusConfig.sent;
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${config.bg} ${config.text}`}>
        {config.label}
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

  const stats = useMemo(
    () => [
      { title: 'Total', filter: 'all', value: campaignStats.total.toLocaleString(), percentage: campaignStats.total > 0 ? 100 : 0, dot: 'bg-ink' },
      { title: 'Read', filter: 'read', value: campaignStats.read.toLocaleString(), percentage: percentOf(campaignStats.read, campaignStats.total), dot: 'bg-brand-600' },
      { title: 'Delivered', filter: 'delivered', value: campaignStats.delivered.toLocaleString(), percentage: percentOf(campaignStats.delivered, campaignStats.total), dot: 'bg-[#A78BFA]' },
      { title: 'Sent', filter: 'sent', value: campaignStats.sent.toLocaleString(), percentage: percentOf(campaignStats.sent, campaignStats.total), dot: 'bg-sky-400' },
      { title: 'Pending', filter: 'pending', value: campaignStats.pending.toLocaleString(), percentage: percentOf(campaignStats.pending, campaignStats.total), dot: 'bg-amber-400' },
      { title: 'Failed', filter: 'failed', value: campaignStats.failed.toLocaleString(), percentage: percentOf(campaignStats.failed, campaignStats.total), dot: 'bg-rose-500' }
    ],
    [campaignStats]
  );

  const sourceLabel = (source) => {
    const key = String(source || '').toLowerCase();
    if (key === 'excel') return { label: 'Excel upload', phrase: 'an Excel upload' };
    if (key === 'contact') return { label: 'Contacts', phrase: 'contacts' };
    if (key === 'group') return { label: 'Contact group', phrase: 'a contact group' };
    if (key === 'sheet' || key === 'sheets') return { label: 'Google Sheet', phrase: 'a Google Sheet' };
    return source ? { label: String(source), phrase: String(source) } : null;
  };

  const campaignStatusPill = (status) => {
    const key = String(status || '').toLowerCase();
    const map = {
      complete: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
      completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
      pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-800' },
      scheduled: { label: 'Scheduled', cls: 'bg-amber-50 text-amber-800' },
      stopped: { label: 'Stopped', cls: 'bg-rose-50 text-rose-700' },
      failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700' }
    };
    const item = map[key] || (status ? { label: status, cls: 'bg-brand-50 text-brand-800' } : null);
    if (!item) return null;
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${item.cls}`}>
        {item.label}
      </span>
    );
  };

  const formatInr = (value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const sentWhen = campaignDetails?.create_date
    ? moment(parseServerDate(campaignDetails.create_date)).format('D MMM YYYY, HH:mm')
    : '';
  const audienceSource = sourceLabel(campaignDetails?.source);
  const subtitle = [
    sentWhen ? `Sent ${sentWhen}` : '',
    campaignDetails ? `to ${campaignStats.total.toLocaleString()} recipients` : '',
    audienceSource?.phrase ? `from ${audienceSource.phrase}` : ''
  ].filter(Boolean).join(' ');

  const category = campaignDetails?.template?.category;
  const metaRows = [
    { label: 'Template', value: campaignDetails?.template?.template_name },
    { label: 'Category', value: category ? category.charAt(0) + category.slice(1).toLowerCase() : '' },
    { label: 'Source', value: audienceSource?.label },
    { label: 'Created by', value: campaignDetails?.create_by?.name },
    {
      label: 'Created',
      value: campaignDetails?.create_date
        ? moment(parseServerDate(campaignDetails.create_date)).format('DD MMM YYYY, HH:mm')
        : ''
    }
  ].filter((row) => row.value);

  const cost = campaignDetails?.cost;
  const costRows = [
    cost?.per_message != null && { label: 'Per message cost', value: formatInr(cost.per_message) },
    cost?.used != null && { label: 'Cost used', value: formatInr(cost.used) },
    cost?.total != null && { label: 'Total cost', value: formatInr(cost.total) }
  ].filter(Boolean);

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
    <div className="min-h-screen bg-surface-ground dark:bg-gray-900">
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
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
          <div className="flex flex-col xl:flex-row xl:items-start gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] text-ink-500 hover:bg-white hover:text-ink"
                      aria-label="Back to campaigns"
                    >
                      <FiArrowLeft size={18} />
                    </button>
                    <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink truncate">
                      {campaignDetails?.name || 'Campaign'}
                    </h1>
                    {campaignStatusPill(campaignDetails?.status)}
                  </div>
                  {subtitle ? <p className="mt-1.5 pl-10 text-sm text-ink-500">{subtitle.endsWith('.') ? subtitle : `${subtitle}.`}</p> : null}
                  {detailsError && (
                    <div className="mt-3 ml-10 p-3 bg-rose-50 border border-rose-200 rounded-[14px]">
                      <p className="text-sm text-rose-700">{detailsError}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <button type="button" onClick={openDuplicateModal} className="oc-btn-ghost">
                    <FiCopy size={15} />
                    Duplicate
                  </button>
                  <button type="button" onClick={handleExport} disabled={!campaignDetails?.url} className="oc-btn-ghost">
                    <FiDownload size={15} />
                    Export report
                  </button>
                  <button type="button" onClick={openDeleteModal} className="oc-btn-ghost text-red-600 hover:bg-rose-50">
                    <FiTrash2 size={15} />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
                {stats.map((stat) => {
                  const selected = statusFilter === stat.filter;
                  return (
                    <button
                      key={stat.title}
                      type="button"
                      onClick={() => setStatusFilter(stat.filter)}
                      className={`text-left rounded-[14px] border px-4 py-3.5 transition-colors ${selected ? 'bg-[#F4F2FE] border-brand-600' : 'bg-white border-line hover:border-brand-300'}`}
                    >
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-500">
                        <span className={`h-2 w-2 rounded-full ${stat.dot}`} />
                        {stat.title}
                      </div>
                      <div className="mt-2 font-mono text-[26px] font-semibold leading-none tracking-tight text-ink">{stat.value}</div>
                      <div className="mt-1.5 text-xs font-semibold text-ink-500">{stat.percentage}%</div>
                    </button>
                  );
                })}
              </div>

              <div className="bg-white border border-line rounded-[14px] flex flex-col min-h-[420px]">
                <div className="px-4 py-3.5 border-b border-[#ECEAF3] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-[15px] font-bold text-ink">
                    Recipients
                    <span className="ml-2 text-sm font-semibold text-ink-500">· {statusFilter === 'all' ? 'All' : statusFilter}</span>
                  </h2>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Search name or phone"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-[38px] w-full sm:w-64 pl-9 pr-3 rounded-[9px] border border-line bg-surface-soft text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600"
                    />
                  </div>
                </div>

                {messagesError && (
                  <div className="mx-4 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-[14px]">
                    <p className="text-sm text-rose-700">{messagesError}</p>
                  </div>
                )}

                <div className="overflow-x-auto">
                  {loadingMessages ? (
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          {['#', 'Name', 'Phone', 'Status', 'Updated', 'Error details'].map((label) => (
                            <th key={label} className={`oc-th ${label === '#' ? 'w-12 text-center' : ''}`}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <TableSkeletonRows rows={8} cells={['index', 'text', 'text', 'badge', 'text', 'text']} />
                      </tbody>
                    </table>
                  ) : (
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          <th className="oc-th w-12 text-center">#</th>
                          <th className="oc-th">Name</th>
                          <th className="oc-th">Phone</th>
                          <th className="oc-th">Status</th>
                          <th className="oc-th">Updated</th>
                          <th className="oc-th">Error details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRecipients.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-ink-500">
                              <div className="flex flex-col items-center justify-center">
                                <FiUsers className="w-10 h-10 text-ink-400 mb-3" />
                                <p className="text-sm font-semibold text-ink">No recipients found</p>
                                <p className="text-sm mt-1">Try another name, phone, or status.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          paginatedRecipients.map((recipient, index) => (
                            <tr
                              key={recipient.id}
                              onClick={() => setDetailRecipient(recipient)}
                              className="cursor-pointer hover:bg-surface-soft"
                            >
                              <td className="oc-td text-center text-xs font-semibold text-ink-500 oc-num">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                              <td className="oc-td">
                                <span className="text-sm font-semibold text-ink">{recipient.name}</span>
                              </td>
                              <td className="oc-td">
                                <span className="font-mono text-[13px] text-ink">{recipient.phone}</span>
                              </td>
                              <td className="oc-td">{getRecipientStatusBadge(recipient.status)}</td>
                              <td className="oc-td text-sm text-ink-500 whitespace-nowrap">
                                {recipient.date ? moment(parseServerDate(recipient.date)).format('D MMM, HH:mm') : '—'}
                              </td>
                              <td className="oc-td text-sm max-w-[240px]">
                                {recipient.failedReason ? (
                                  <span className="text-rose-600" title={recipient.failedReason}>{recipient.failedReason}</span>
                                ) : (
                                  <span className="text-ink-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {totalRecords > 0 ? (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalRecords={totalRecords}
                    pageSize={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setItemsPerPage}
                    pageSizeOptions={[10, 20, 50, 100]}
                  />
                ) : null}
              </div>
            </div>

            <aside className="w-full xl:w-[320px] xl:shrink-0">
              <div className="bg-white border border-line rounded-[14px] p-5">
                <h2 className="text-base font-bold text-ink">Campaign</h2>
                {loadingDetails ? (
                  <div className="flex items-center py-6 text-sm text-ink-500">
                    <FiLoader className="animate-spin mr-2" size={16} />
                    Loading details...
                  </div>
                ) : (
                  <>
                    {metaRows.length > 0 && (
                      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
                        {metaRows.map((row) => (
                          <React.Fragment key={row.label}>
                            <dt className="text-ink-500">{row.label}</dt>
                            <dd className="m-0 text-right font-semibold text-ink truncate" title={String(row.value)}>{row.value}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                    {costRows.length > 0 && (
                      <dl className="mt-4 pt-4 border-t border-line grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[13px]">
                        {costRows.map((row) => (
                          <React.Fragment key={row.label}>
                            <dt className="text-ink-500">{row.label}</dt>
                            <dd className="m-0 text-right font-mono font-semibold text-ink">{row.value}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Duplicate Campaign Modal */}
      <AnimatedModal open={showDuplicateModal}>
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
      </AnimatedModal>

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
