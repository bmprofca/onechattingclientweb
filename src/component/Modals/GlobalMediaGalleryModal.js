import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import {
    FiImage,
    FiVideo,
    FiFile,
    FiMusic,
    FiLayers,
    FiArrowDownLeft,
    FiArrowUpRight,
    FiPlay,
    FiMapPin,
    FiDownload,
    FiEye,
    FiX,
    FiUser,
    FiSearch,
} from 'react-icons/fi';
import { API_BASE_URL } from '../../config/api';
import { Encrypt } from '../../pages/encryption/payload-encryption';
import { parseServerDate } from '../../utils/dateTime';
import MediaModal from './Conversation/MediaModal';
import Pagination from '../Pagination';
import RowActionMenu from '../table/RowActionMenu';
import RecordDetailsModal from '../table/RecordDetailsModal';
import { TableSkeletonRows } from '../table/TableSkeleton';
import DateRangePickerModal from '../DateRangePickerModal';

const MEDIA_TABS = [
    { id: 'all', label: 'All', icon: FiLayers },
    { id: 'image', label: 'Photos', icon: FiImage },
    { id: 'video', label: 'Videos', icon: FiVideo },
    { id: 'document', label: 'Documents', icon: FiFile },
    { id: 'audio', label: 'Audio', icon: FiMusic },
];

const GRID_TABS = new Set(['image', 'video']);

const TYPE_LABELS = {
    image: 'Image',
    video: 'Video',
    document: 'Document',
    audio: 'Audio',
    location: 'Location',
};

const MODAL_Z_INDEX = 'z-[100]';
const PREVIEW_Z_INDEX = 'z-[9999]';

const formatMediaDate = (value) => {
    if (!value) return '';
    try {
        const date = parseServerDate(value);
        if (!date) return '';
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
};

const getTypeIcon = (messageType) => {
    switch (messageType) {
        case 'image':
            return FiImage;
        case 'video':
            return FiVideo;
        case 'document':
            return FiFile;
        case 'audio':
            return FiMusic;
        case 'location':
            return FiMapPin;
        default:
            return FiLayers;
    }
};

const resolveFileName = (item) => {
    const genericNames = new Set(['image', 'video', 'document', 'audio', 'file']);
    const rawName = String(item.media_name || item.message || '').trim();

    if (rawName && !genericNames.has(rawName.toLowerCase())) {
        return rawName;
    }

    if (item.media_url) {
        try {
            const fromUrl = decodeURIComponent(new URL(item.media_url).pathname.split('/').pop() || '');
            if (fromUrl) return fromUrl;
        } catch {
            // ignore
        }
    }

    const extMap = { image: 'jpg', video: 'mp4', audio: 'mp3', document: 'pdf' };
    const ext = extMap[item.message_type] || 'file';
    return `media_${item.message_id || item.id || Date.now()}.${ext}`;
};

const isPdfDocument = (item) => resolveFileName(item).toLowerCase().endsWith('.pdf');

const canPreviewMedia = (item) => {
    if (item.message_type === 'location') {
        return Boolean(item.latitude && item.longitude);
    }
    if (!item.media_url) return false;
    if (['image', 'video', 'audio'].includes(item.message_type)) return true;
    if (item.message_type === 'document') return isPdfDocument(item);
    return false;
};

const getPreviewModalType = (item) => {
    if (item.message_type === 'location') return 'location';
    if (item.message_type === 'document' && isPdfDocument(item)) return 'pdf';
    return item.message_type;
};

const downloadMediaFile = async (url, filename) => {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
        throw new Error('Download failed');
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
};

function DirectionBadge({ direction, compact = false }) {
    const isIncoming = direction === 'incoming';

    if (compact) {
        return (
            <span
                className={`absolute top-1.5 right-1.5 p-1 rounded-full shadow-sm ${
                    isIncoming ? 'bg-emerald-500 text-white' : 'bg-sky-500 text-white'
                }`}
                title={isIncoming ? 'Incoming' : 'Outgoing'}
            >
                {isIncoming ? <FiArrowDownLeft className="w-3 h-3" /> : <FiArrowUpRight className="w-3 h-3" />}
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${
                isIncoming
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
            }`}
            title={isIncoming ? 'Incoming' : 'Outgoing'}
        >
            {isIncoming ? <FiArrowDownLeft className="w-3 h-3" /> : <FiArrowUpRight className="w-3 h-3" />}
            {isIncoming ? 'In' : 'Out'}
        </span>
    );
}

function LocationPreviewModal({ item, fileName, onClose }) {
    const mapUrl = `https://www.google.com/maps?q=${item.latitude},${item.longitude}&z=15&output=embed`;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${PREVIEW_Z_INDEX} flex items-center justify-center bg-black/80 p-4 overflow-hidden`}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90dvh] overflow-hidden shadow-xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{fileName}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {item.address || item.name || `${item.latitude}, ${item.longitude}`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <div className="aspect-video bg-gray-100 dark:bg-gray-900">
                    <iframe title="Location preview" src={mapUrl} className="w-full h-full border-0" loading="lazy" />
                </div>
            </motion.div>
        </motion.div>
    );
}

function PdfPreviewModal({ item, fileName, onClose }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${PREVIEW_Z_INDEX} flex items-center justify-center bg-black/80 p-4 overflow-hidden`}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90dvh] overflow-hidden shadow-xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{fileName}</h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <FiX className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <div className="flex-1 min-h-0 bg-gray-100 dark:bg-gray-900">
                    <iframe title={fileName} src={item.media_url} className="w-full h-full border-0" />
                </div>
            </motion.div>
        </motion.div>
    );
}

function GlobalMediaGalleryModal({ isOpen, onClose, tokens, onChatSelect }) {
    const [activeTab, setActiveTab] = useState('all');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [pageNo, setPageNo] = useState(1);
    const [pageLimit, setPageLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [downloadingId, setDownloadingId] = useState(null);
    const [previewItem, setPreviewItem] = useState(null);
    const [mediaDetail, setMediaDetail] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [dateFromInput, setDateFromInput] = useState('');
    const [dateToInput, setDateToInput] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({ search: '', date_from: '', date_to: '' });

    const fetchMedia = useCallback(async ({
        page = 1,
        filter = 'all',
        limit = 10,
        search = '',
        date_from = '',
        date_to = '',
    } = {}) => {
        if (!tokens?.token || !tokens?.username) return;

        setLoading(true);
        setError('');

        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                filter,
                page_no: page,
                limit,
            };

            const trimmedSearch = String(search || '').trim();
            if (trimmedSearch) payload.search = trimmedSearch;
            if (date_from) payload.date_from = date_from;
            if (date_to) payload.date_to = date_to;

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/message/project-media`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response?.data?.error) {
                const nextItems = Array.isArray(response?.data?.data) ? response.data.data : [];
                setItems(nextItems);
                setPageNo(page);
                setTotal(Number(response?.data?.meta?.total) || 0);
                setTotalPages(Number(response?.data?.meta?.total_page) || 1);
            } else {
                const errMsg = typeof response.data.error === 'string'
                    ? response.data.error
                    : (response.data.msg || 'Failed to load media');
                setError(errMsg);
                setItems([]);
                setTotal(0);
                setTotalPages(1);
            }
        } catch (err) {
            setError('Failed to load media. Please try again.');
            setItems([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event) => {
            if (event.key === 'Escape' && !previewItem) {
                onClose?.();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, previewItem]);

    useEffect(() => {
        if (!isOpen) {
            setActiveTab('all');
            setItems([]);
            setError('');
            setPageNo(1);
            setPageLimit(10);
            setTotal(0);
            setTotalPages(1);
            setPreviewItem(null);
            setSearchInput('');
            setDateFromInput('');
            setDateToInput('');
            setAppliedFilters({ search: '', date_from: '', date_to: '' });
            return;
        }

        fetchMedia({
            page: 1,
            filter: activeTab,
            limit: pageLimit,
            ...appliedFilters,
        });
    }, [isOpen, activeTab, pageLimit, appliedFilters, fetchMedia]);

    const handleApplyFilters = () => {
        if (dateFromInput && dateToInput && dateFromInput > dateToInput) {
            setError('Start date cannot be after end date.');
            return;
        }

        setError('');
        setPageNo(1);
        setAppliedFilters({
            search: searchInput.trim(),
            date_from: dateFromInput,
            date_to: dateToInput,
        });
    };

    const handleClearFilters = () => {
        setSearchInput('');
        setDateFromInput('');
        setDateToInput('');
        setError('');
        setPageNo(1);
        setAppliedFilters({ search: '', date_from: '', date_to: '' });
    };

    const hasActiveFilters = Boolean(
        appliedFilters.search || appliedFilters.date_from || appliedFilters.date_to
    );

    const handleTabChange = (tabId) => {
        if (tabId === activeTab) return;
        setItems([]);
        setPreviewItem(null);
        setPageNo(1);
        setActiveTab(tabId);
    };

    const handlePageChange = useCallback((page) => {
        setPageNo(page);
        fetchMedia({
            page,
            filter: activeTab,
            limit: pageLimit,
            ...appliedFilters,
        });
    }, [activeTab, pageLimit, appliedFilters, fetchMedia]);

    const handlePageSizeChange = useCallback((newSize) => {
        setPageLimit(newSize);
        setPageNo(1);
    }, []);

    const handleDownload = async (e, item) => {
        e.stopPropagation();

        if (item.message_type === 'location') {
            if (item.latitude && item.longitude) {
                window.open(
                    `https://www.google.com/maps?q=${item.latitude},${item.longitude}`,
                    '_blank',
                    'noopener,noreferrer'
                );
            }
            return;
        }

        if (!item?.media_url) {
            toast.error('File URL not available');
            return;
        }

        const itemKey = item.message_id || item.id;
        setDownloadingId(itemKey);

        try {
            await downloadMediaFile(item.media_url, resolveFileName(item));
            toast.success('Download started');
        } catch (err) {
            console.error('Download failed:', err);
            toast.error('Failed to download file');
        } finally {
            setDownloadingId(null);
        }
    };

    const handlePreview = (e, item) => {
        e?.stopPropagation?.();
        if (!canPreviewMedia(item)) return;
        setPreviewItem(item);
    };

    const handleOpenChat = (item) => {
        if (!item?.number || !onChatSelect) return;
        onChatSelect({
            number: item.number,
            name: item.contact_name || item.number,
            unread_count: 0,
            unread: false,
        });
        onClose?.();
    };

    const renderContactLabel = (item) => item.contact_name || item.number || 'Unknown';

    const renderThumbnail = (item, className = 'w-full h-full object-cover') => {
        const TypeIcon = getTypeIcon(item.message_type);

        if (item.message_type === 'image' && item.media_url) {
            return <img src={item.media_url} alt="" className={className} loading="lazy" />;
        }

        if (item.message_type === 'video' && item.media_url) {
            return (
                <div className="relative w-full h-full bg-gray-200 dark:bg-gray-600">
                    <video src={item.media_url} className={className} muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <FiPlay className="w-6 h-6 text-white" />
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full h-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30">
                <TypeIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
        );
    };

    const renderGridItem = (item) => {
        const itemKey = item.message_id || item.id;
        const fileName = resolveFileName(item);

        return (
            <button
                key={itemKey}
                type="button"
                onClick={() => handlePreview(null, item)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:ring-2 hover:ring-indigo-500 transition-all"
                title={fileName}
            >
                {renderThumbnail(item)}
                <DirectionBadge direction={item.direction} compact />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">{renderContactLabel(item)}</p>
                    <p className="text-[10px] text-white/80 truncate">{formatMediaDate(item.create_date)}</p>
                </div>
            </button>
        );
    };

    const renderTableRow = (item, index) => {
        const itemKey = item.message_id || item.id;
        const isDownloading = downloadingId === itemKey;
        const fileName = resolveFileName(item);
        const typeLabel = TYPE_LABELS[item.message_type] || item.message_type;
        const showPreview = canPreviewMedia(item);
        const canDownload = item.message_type === 'location'
            ? Boolean(item.latitude && item.longitude)
            : Boolean(item.media_url);

        return (
            <tr key={itemKey} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                    {(pageNo - 1) * pageLimit + index + 1}
                </td>
                <td className="px-3 py-2.5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700">
                        {renderThumbnail(item)}
                    </div>
                </td>
                <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium max-w-[140px]">
                    <div className="truncate" title={fileName}>{fileName}</div>
                    {item.is_voice && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Voice note</span>
                    )}
                </td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300 max-w-[120px]">
                    <button
                        type="button"
                        onClick={() => handleOpenChat(item)}
                        className="flex items-center gap-1.5 text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-w-0"
                        title="Open chat"
                    >
                        <FiUser className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{renderContactLabel(item)}</span>
                    </button>
                </td>
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap hidden sm:table-cell">
                    {typeLabel}
                </td>
                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:table-cell">
                    {formatMediaDate(item.create_date)}
                </td>
                <td className="px-3 py-2.5 text-center">
                    <DirectionBadge direction={item.direction} />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <RowActionMenu
                        items={[
                            { label: 'Details', icon: <FiEye className="w-4 h-4" />, onClick: () => setMediaDetail(item) },
                            { label: 'Preview', icon: <FiEye className="w-4 h-4" />, onClick: () => handlePreview({ stopPropagation() {}, preventDefault() {} }, item), hidden: !showPreview },
                            { label: item.message_type === 'location' ? 'Open location' : 'Download', icon: <FiDownload className="w-4 h-4" />, onClick: () => handleDownload({ stopPropagation() {}, preventDefault() {} }, item), hidden: !canDownload, disabled: isDownloading },
                        ]}
                    />
                </td>
            </tr>
        );
    };

    const previewType = previewItem ? getPreviewModalType(previewItem) : null;
    const previewFileName = previewItem ? resolveFileName(previewItem) : null;
    const useGridLayout = GRID_TABS.has(activeTab);

    if (!isOpen || typeof document === 'undefined') return null;

    return createPortal(
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`fixed inset-0 ${MODAL_Z_INDEX} flex items-center justify-center bg-black/50 p-3 sm:p-6`}
                    >
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 12 }}
                            transition={{ type: 'spring', duration: 0.3 }}
                            className="w-full max-w-6xl h-[92dvh] sm:h-[88vh] rounded-2xl bg-white dark:bg-gray-800 shadow-2xl flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                                        <FiLayers className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Media Gallery</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            All incoming & outgoing files across chats
                                            {!loading && total > 0 ? ` · ${total} item${total !== 1 ? 's' : ''}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    aria-label="Close gallery"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
                                <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                                    <div className="flex-1 min-w-0">
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                            Search
                                        </label>
                                        <div className="relative">
                                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                value={searchInput}
                                                onChange={(e) => setSearchInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                                placeholder="Contact name, number, or file name"
                                                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-64 shrink-0">
                                        <DateRangePickerModal
                                            label="Date range"
                                            placeholder="All dates"
                                            startDate={dateFromInput}
                                            endDate={dateToInput}
                                            onChange={({ startDate, endDate }) => {
                                                setDateFromInput(startDate);
                                                setDateToInput(endDate);
                                            }}
                                            onClear={() => {
                                                setDateFromInput('');
                                                setDateToInput('');
                                            }}
                                            zIndexClass="z-[110]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleApplyFilters}
                                            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            Search
                                        </button>
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                onClick={handleClearFilters}
                                                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {hasActiveFilters && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Filtered
                                        {appliedFilters.search ? ` · "${appliedFilters.search}"` : ''}
                                        {appliedFilters.date_from ? ` · from ${appliedFilters.date_from}` : ''}
                                        {appliedFilters.date_to ? ` · to ${appliedFilters.date_to}` : ''}
                                    </p>
                                )}
                            </div>

                            <div className="px-4 pt-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
                                <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
                                    {MEDIA_TABS.map((tab) => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => handleTabChange(tab.id)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                                                    isActive
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                {tab.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-auto p-4">
                                {loading && items.length === 0 ? (
                                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                                        <table className="w-full text-sm min-w-[720px]">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-700/50">
                                                    {['#', 'Preview', 'Name', 'Contact', 'Type', 'Date', 'Dir.', ''].map((label, index) => (
                                                        <th key={`${label}-${index}`} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <TableSkeletonRows rows={6} cells={['index', 'short', 'text', 'text', 'short', 'short', 'badge', 'action']} />
                                            </tbody>
                                        </table>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
                                        <button
                                            type="button"
                                            onClick={() => fetchMedia({
                                                page: pageNo,
                                                filter: activeTab,
                                                limit: pageLimit,
                                                ...appliedFilters,
                                            })}
                                            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : items.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-center">
                                        <FiLayers className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {hasActiveFilters ? 'No media matches your filters.' : 'No media found in this project.'}
                                        </p>
                                    </div>
                                ) : useGridLayout ? (
                                    <div className={`grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                                        {items.map(renderGridItem)}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                                        <table className="w-full text-sm min-w-[720px]">
                                            <thead>
                                                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preview</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Contact</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Type</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Date</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Dir.</th>
                                                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {loading ? (
                                                    <TableSkeletonRows rows={6} cells={['index', 'short', 'text', 'text', 'short', 'short', 'badge', 'action']} />
                                                ) : (
                                                    items.map(renderTableRow)
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {!loading && total > 0 && (
                                <div className="shrink-0 border-t border-gray-200 dark:border-gray-700">
                                    <Pagination
                                        currentPage={pageNo}
                                        totalPages={totalPages}
                                        totalRecords={total}
                                        pageSize={pageLimit}
                                        onPageChange={handlePageChange}
                                        onPageSizeChange={handlePageSizeChange}
                                        pageSizeOptions={[10, 20, 50]}
                                        showPageSizeSelector={true}
                                        showGoToPage={true}
                                    />
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {previewItem && previewType === 'location' && (
                    <LocationPreviewModal
                        item={previewItem}
                        fileName={previewFileName}
                        onClose={() => setPreviewItem(null)}
                    />
                )}
                {previewItem && previewType === 'pdf' && (
                    <PdfPreviewModal
                        item={previewItem}
                        fileName={previewFileName}
                        onClose={() => setPreviewItem(null)}
                    />
                )}
            </AnimatePresence>

            {previewItem && ['image', 'video', 'audio'].includes(previewType) && (
                <MediaModal
                    isOpen
                    onClose={() => setPreviewItem(null)}
                    mediaItem={{
                        serverUrl: previewItem.media_url,
                        name: previewFileName,
                    }}
                    type={previewType}
                />
            )}
            <RecordDetailsModal
                isOpen={Boolean(mediaDetail)}
                onClose={() => setMediaDetail(null)}
                title={mediaDetail ? resolveFileName(mediaDetail) : 'Media'}
                fields={mediaDetail ? [
                    { label: 'Contact', value: renderContactLabel(mediaDetail) },
                    { label: 'Type', value: TYPE_LABELS[mediaDetail.message_type] || mediaDetail.message_type },
                    { label: 'Date', value: formatMediaDate(mediaDetail.create_date) },
                    { label: 'Direction', value: mediaDetail.direction },
                    { label: 'Voice note', value: mediaDetail.is_voice ? 'Yes' : '' },
                ] : []}
            />
        </>,
        document.body
    );
}

export default GlobalMediaGalleryModal;
