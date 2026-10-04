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
} from 'react-icons/fi';
import { API_BASE_URL } from '../../config/api';
import { Encrypt } from '../../pages/encryption/payload-encryption';
import { parseServerDate } from '../../utils/dateTime';
import MediaModal from '../Modals/Conversation/MediaModal';
import Pagination from '../Pagination';
import RowActionMenu from '../table/RowActionMenu';
import RecordDetailsModal from '../table/RecordDetailsModal';
import { TableSkeletonRows } from '../table/TableSkeleton';

const MEDIA_TABS = [
    { id: 'all', label: 'All', icon: FiLayers },
    { id: 'image', label: 'Image', icon: FiImage },
    { id: 'video', label: 'Video', icon: FiVideo },
    { id: 'document', label: 'Document', icon: FiFile },
    { id: 'audio', label: 'Audio', icon: FiMusic },
];

const TYPE_LABELS = {
    image: 'Image',
    video: 'Video',
    document: 'Document',
    audio: 'Audio',
    location: 'Location',
};

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

const isPdfDocument = (item) => {
    const name = resolveFileName(item).toLowerCase();
    return name.endsWith('.pdf');
};

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

const MODAL_Z_INDEX = 'z-[9999]';

const renderInPortal = (node) => {
    if (typeof document === 'undefined' || !node) return null;
    return createPortal(node, document.body);
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

function DirectionBadge({ direction }) {
    const isIncoming = direction === 'incoming';
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
            className={`fixed inset-0 ${MODAL_Z_INDEX} flex items-center justify-center bg-black/80 p-4 overflow-hidden`}
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
                    <iframe
                        title="Location preview"
                        src={mapUrl}
                        className="w-full h-full border-0"
                        loading="lazy"
                    />
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
            className={`fixed inset-0 ${MODAL_Z_INDEX} flex items-center justify-center bg-black/80 p-4 overflow-hidden`}
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
                    <iframe
                        title={fileName}
                        src={item.media_url}
                        className="w-full h-full border-0"
                    />
                </div>
            </motion.div>
        </motion.div>
    );
}

function ContactMediaSection({ number, tokens }) {
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

    const fetchMedia = useCallback(async ({ page = 1, filter = 'all', limit = 10 } = {}) => {
        if (!tokens?.token || !tokens?.username || !number) return;

        setLoading(true);
        setError('');

        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                number: String(number).trim(),
                filter,
                page_no: page,
                limit,
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/message/chat-media`,
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
    }, [number, tokens?.token, tokens?.username, tokens?.selected_project_id]);

    useEffect(() => {
        setActiveTab('all');
        setPreviewItem(null);
        setPageNo(1);
        setPageLimit(10);
    }, [number]);

    useEffect(() => {
        if (!number || !tokens?.token) {
            setItems([]);
            setTotal(0);
            setTotalPages(1);
            setError('');
            return;
        }

        fetchMedia({ page: 1, filter: activeTab, limit: pageLimit });
    }, [number, tokens?.token, activeTab, pageLimit, fetchMedia]);

    const handleTabChange = (tabId) => {
        if (tabId === activeTab) return;
        setItems([]);
        setPreviewItem(null);
        setPageNo(1);
        setActiveTab(tabId);
    };

    const handlePageChange = useCallback((page) => {
        setPageNo(page);
        fetchMedia({ page, filter: activeTab, limit: pageLimit });
    }, [activeTab, pageLimit, fetchMedia]);

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
        e.stopPropagation();
        if (!canPreviewMedia(item)) return;
        setPreviewItem(item);
    };

    const renderThumbnail = (item) => {
        const TypeIcon = getTypeIcon(item.message_type);

        if (item.message_type === 'image' && item.media_url) {
            return (
                <img
                    src={item.media_url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            );
        }

        if (item.message_type === 'video' && item.media_url) {
            return (
                <div className="relative w-full h-full bg-gray-200 dark:bg-gray-600">
                    <video src={item.media_url} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <FiPlay className="w-4 h-4 text-white" />
                    </div>
                </div>
            );
        }

        return (
            <div className="w-full h-full flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/30">
                <TypeIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
        );
    };

    const renderMediaTableRow = (item, index) => {
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
                            { label: 'Preview', icon: <FiEye className="w-4 h-4" />, onClick: () => handlePreview({ stopPropagation() {} }, item), hidden: !showPreview },
                            { label: item.message_type === 'location' ? 'Open location' : 'Download', icon: <FiDownload className="w-4 h-4" />, onClick: () => handleDownload({ stopPropagation() {} }, item), hidden: !canDownload, disabled: isDownloading },
                        ]}
                    />
                </td>
            </tr>
        );
    };

    const previewType = previewItem ? getPreviewModalType(previewItem) : null;
    const previewFileName = previewItem ? resolveFileName(previewItem) : '';

    return (
        <>
            <section className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                            <FiLayers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Media & Documents</h4>
                            {!loading && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {total} item{total !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-3 pt-3 border-b border-gray-100 dark:border-gray-700">
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

                <div className="p-4">
                    {loading && items.length === 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr>
                                    {['#', 'Preview', 'Name', 'Type', 'Date', 'Dir.', ''].map((label, index) => (
                                        <th key={`${label}-${index}`} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <TableSkeletonRows rows={4} cells={['index', 'short', 'text', 'short', 'short', 'badge', 'action']} />
                            </tbody>
                        </table>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
                            <button
                                type="button"
                                onClick={() => fetchMedia({ page: pageNo, filter: activeTab, limit: pageLimit })}
                                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                Retry
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-10">
                            <FiLayers className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">No media found for this chat.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto -mx-1 rounded-xl border border-gray-200 dark:border-gray-700">
                                <table className="w-full text-sm min-w-[480px]">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preview</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Type</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hidden md:table-cell">Date</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Dir.</th>
                                            <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {loading ? (
                                            <TableSkeletonRows rows={4} cells={['index', 'short', 'text', 'short', 'short', 'badge', 'action']} />
                                        ) : (
                                            items.map(renderMediaTableRow)
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {!loading && total > 0 && (
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
                            )}
                        </>
                    )}
                </div>
            </section>

            {renderInPortal(
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
            )}

            {renderInPortal(
                previewItem && ['image', 'video', 'audio'].includes(previewType) ? (
                    <MediaModal
                        isOpen
                        onClose={() => setPreviewItem(null)}
                        mediaItem={{
                            serverUrl: previewItem.media_url,
                            name: previewFileName,
                        }}
                        type={previewType}
                    />
                ) : null
            )}
            <RecordDetailsModal
                isOpen={Boolean(mediaDetail)}
                onClose={() => setMediaDetail(null)}
                title={mediaDetail ? resolveFileName(mediaDetail) : 'Media'}
                fields={mediaDetail ? [
                    { label: 'Type', value: TYPE_LABELS[mediaDetail.message_type] || mediaDetail.message_type },
                    { label: 'Date', value: formatMediaDate(mediaDetail.create_date) },
                    { label: 'Direction', value: mediaDetail.direction },
                    { label: 'Voice note', value: mediaDetail.is_voice ? 'Yes' : '' },
                ] : []}
            />
        </>
    );
}

export default ContactMediaSection;
