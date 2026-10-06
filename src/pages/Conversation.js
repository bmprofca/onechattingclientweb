import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { parseServerDate, toServerTimestamp } from '../utils/dateTime';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { fetchProjectInfo } from '../store/projectSlice';
import SearchableSelect from '../component/SearchableSelect';
import {
    FiPaperclip,
    FiMic,
    FiSmile,
    FiStar,
    FiArrowLeft,
    FiMoreVertical,
    FiImage,
    FiVideo,
    FiFile,
    FiMusic,
    FiMapPin,
    FiUser,
    FiDownload,
    FiX,
    FiZoomIn,
    FiPlay,
    FiExternalLink,
    FiCheck,
    FiClock,
    FiAlertCircle,
    FiInfo,
    FiActivity,
    FiMessageSquare,
    FiLayers,
    FiEye,
    FiSearch,
    FiEdit2,
    FiCalendar,
    FiHome,
    FiMail,
    FiGlobe,
    FiFileText,
    FiUserPlus,
    FiUserCheck,
    FiCornerUpLeft,
    FiPhone,
    FiCheckCircle,
    FiPlus,
    FiTrash2
} from 'react-icons/fi';
import { LuSendHorizontal } from "react-icons/lu";
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Encrypt } from './encryption/payload-encryption';
import { uploadFile } from '../utils/uploadFile';
import { dbHelper, contactDbHelper } from './db';
import ContactFormModal from '../component/Modals/ContactFormModal';
import ChatTemplateModal from '../component/Modals/ChatTemplateModal';
import TemplatePreview from '../component/Modals/TemplatePreview';
import EmojiPickerPopover from '../component/Modals/Conversation/EmojiPicker';
import ErrorModal from '../component/Modals/Conversation/ErrorModal';
import MessageInfoModal from '../component/Modals/Conversation/MessageInfoModal';
import MediaModal from '../component/Modals/Conversation/MediaModal';
import MessageStatusIndicator from '../component/Conversation/MessageStatusIndicator';
import DocumentPreview from '../component/Conversation/DocumentPreview';
import ImagePreview from '../component/Conversation/ImagePreview';
import VideoPreview from '../component/Conversation/VideoPreview';
import AudioPreview from '../component/Conversation/AudioPreview';
import LocationPreview from '../component/Conversation/LocationPreview';
import ContactPreview from '../component/Conversation/ContactPreview';
import { SearchChatModal } from '../component/Modals/Conversation/SearchChatModal';
import TemplateMessageRenderer from '../component/Conversation/TemplateMessageRender';
import WhatsAppText from '../component/WhatsAppText';
import { buildTemplateDisplayMessage } from '../utils/templateMessageDisplay';
import Pagination from '../component/Pagination';
import InteractiveMessageRenderer from '../component/Conversation/InteractiveMessageRenderer';
import ContactMediaSection from '../component/Conversation/ContactMediaSection';
import { getInteractiveSearchText, normalizeInteractiveMessage } from '../utils/interactiveMessage';

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const computeSimpleHash = (value) => {
    const str = String(value || '');
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
};


const getMessageKey = (msg) => {
    if (!msg) return 'message-unknown';
    const candidates = [
        msg.message_id,
        msg.wamid,
        msg.id,
        msg.unique_id,
        msg.local_id,
        msg.timestamp,
        msg.create_date
    ];

    for (const candidate of candidates) {
        if (candidate !== undefined && candidate !== null && candidate !== '') {
            return String(candidate);
        }
    }

    const fallbackPayload = JSON.stringify({
        type: msg.type,
        message: msg.message,
        media: msg.media_url,
        name: msg.name,
        timestamp: msg.timestamp,
        create_date: msg.create_date
    });

    return `msg-${computeSimpleHash(fallbackPayload)}`;
};

const getSearchableTextFromMessage = (msg) => {
    if (!msg) return '';

    if (msg.is_template) {
        if (typeof msg.message === 'string' && msg.message.trim().length > 0) {
            return msg.message;
        }

        const templateBody = msg.template?.template_data?.body;
        if (templateBody) {
            return templateBody;
        }

        const templateComponents = msg.template?.components || msg.template?.template_data?.components;
        if (Array.isArray(templateComponents)) {
            const displayText = buildTemplateDisplayMessage(msg.template, msg.component);
            if (displayText) {
                return displayText;
            }

            const bodyComponent = templateComponents.find((component) => component.type === 'BODY');
            if (bodyComponent?.text) {
                return bodyComponent.text;
            }
        }
    }

    const type = (msg.message_type || '').toLowerCase();

    if (type === 'interactive') {
        return getInteractiveSearchText(msg);
    }

    if (type === 'text' || type === '' || type === 'template') {
        return msg.message || '';
    }

    if (type === 'location') {
        return [msg.name, msg.address, msg.latitude, msg.longitude]
            .filter(Boolean)
            .join(' ');
    }

    if (type === 'contact') {
        const contactInfo = msg.contact || msg.contact_info || msg.contactInfo || {};
        return [
            msg.name,
            contactInfo.name,
            contactInfo.phone,
            contactInfo.email,
            msg.message
        ].filter(Boolean).join(' ');
    }

    if (['image', 'video', 'audio', 'document'].includes(type)) {
        return [msg.caption, msg.media_name, msg.message]
            .filter(Boolean)
            .join(' ');
    }

    return msg.message || '';
};

const getSnippetAroundTerm = (text, term, radius = 32) => {
    if (!text) return '';
    if (!term) return text.length > 160 ? `${text.slice(0, 160)}…` : text;

    const normalizedText = text.toLowerCase();
    const normalizedTerm = term.toLowerCase();
    const index = normalizedText.indexOf(normalizedTerm);

    if (index === -1) {
        return text.length > 160 ? `${text.slice(0, 160)}…` : text;
    }

    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + normalizedTerm.length + radius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';

    return `${prefix}${text.slice(start, end)}${suffix}`;
};

const HighlightedText = ({ text, term }) => {
    if (!term || !text) {
        return <>{text}</>;
    }

    const safeTerm = escapeRegExp(term);
    if (!safeTerm) {
        return <>{text}</>;
    }

    const regex = new RegExp(`(${safeTerm})`, 'ig');
    const segments = text.split(regex);
    const termLower = term.toLowerCase();

    return (
        <>
            {segments.map((segment, idx) => (
                segment.toLowerCase() === termLower ? (
                    <span
                        key={`${segment}-${idx}`}
                        className="bg-yellow-200 dark:bg-yellow-500/40 px-1 py-0.5 rounded"
                    >
                        {segment}
                    </span>
                ) : (
                    <React.Fragment key={`${segment}-${idx}`}>
                        {segment}
                    </React.Fragment>
                )
            ))}
        </>
    );
};

// Date Separator Component
const DateSeparator = ({ displayDate, dateId }) => {
    return (
        <div id={dateId} className="flex items-center justify-center my-4 sm:my-6">
            <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                <div className="px-3 sm:px-4 py-1 sm:py-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                    <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">
                        {displayDate}
                    </span>
                </div>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
            </div>
        </div>
    );
};



// Message Item Component with Info Button
const MessageItem = ({ msg, activeChat, displayName, darkMode, renderFilePreview, formatTime, messageKey, highlightedMessageId, onReply, allMessages, onScrollToMessage }) => {
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [audioTime, setAudioTime] = useState({ currentTime: 0, duration: 0 });

    // Find the original message if reply_to_message is not provided but reply_wamid exists
    const getReplyToMessage = () => {
        if (msg.reply_to_message) {
            return msg.reply_to_message;
        }
        if (msg.is_reply && msg.reply_wamid && allMessages) {
            return allMessages.find(m => m.wamid === msg.reply_wamid);
        }
        return null;
    };

    const replyToMessage = getReplyToMessage();

    // Handle click on reply preview to scroll to original message
    const handleReplyClick = () => {
        if (replyToMessage && onScrollToMessage) {
            const originalMessageKey = getMessageKey(replyToMessage);
            onScrollToMessage(originalMessageKey);
        }
    };

    const formatAudioDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleAudioTimeChange = (current, duration) => {
        setAudioTime({ currentTime: current, duration });
    };

    const isHighlighted = highlightedMessageId === messageKey;
    const bubbleHighlightClass = isHighlighted
        ? (msg.type === 'out'
            ? 'ring-2 ring-offset-2 ring-blue-500 ring-offset-blue-100 dark:ring-offset-blue-900/40 animate-pulse bg-[#c8f7c5]'
            : 'ring-2 ring-offset-2 ring-blue-500 ring-offset-gray-100 dark:ring-offset-gray-800 animate-pulse !bg-blue-50 dark:!bg-blue-900/30')
        : '';

    return (
        <>
            <div className={`flex ${msg.type === 'out' ? 'justify-end' : 'justify-start'} w-full group`}>
                <div className={`max-w-[80%] ${msg.type === 'out' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-end space-x-1 sm:space-x-2 ${msg.type === 'out' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {msg.type !== 'out' && (
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                                {(displayName || activeChat?.name || '').charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div
                            id={`message-${messageKey}`}
                            className={`p-1 rounded-2xl ${msg.type === 'out'
                                ? 'bg-[#D9FDD3] text-gray-800 rounded-br-md'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md border border-gray-200 dark:border-gray-700'
                                } max-w-full relative ${bubbleHighlightClass}`}
                        >
                            {/* Reply to message preview */}
                            {msg.is_reply && (
                                <div
                                    onClick={replyToMessage ? handleReplyClick : undefined}
                                    className={`mb-2 p-2 rounded-lg border-l-4 ${msg.type === 'out'
                                        ? 'border-green-600 bg-green-50 hover:bg-green-100'
                                        : 'border-blue-500 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'} ${replyToMessage ? 'cursor-pointer transition-colors' : ''}`}
                                >
                                    {replyToMessage ? (
                                        <div className="flex items-start gap-2">
                                            {/* Media Thumbnail for image/video/document */}
                                            {(() => {
                                                const replyMsg = replyToMessage;
                                                const msgType = (replyMsg.message_type || '').toLowerCase();
                                                const mediaUrl = replyMsg.media_url;

                                                // Image thumbnail
                                                if ((msgType === 'image' || msgType === 'photo') && mediaUrl) {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-200 dark:bg-gray-600">
                                                            <img
                                                                src={mediaUrl}
                                                                alt="Reply"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                }

                                                // Video thumbnail
                                                if (msgType === 'video' && mediaUrl) {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-800 flex items-center justify-center relative">
                                                            <FiVideo className="w-5 h-5 text-white" />
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <div className="w-4 h-4 bg-white/80 rounded-full flex items-center justify-center">
                                                                    <FiPlay className="w-2.5 h-2.5 text-gray-800 ml-0.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Audio icon
                                                if (msgType === 'audio') {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                                                            <FiMic className="w-5 h-5 text-white" />
                                                        </div>
                                                    );
                                                }

                                                // Document icon
                                                if (msgType === 'document') {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                            <FiFile className="w-5 h-5 text-red-500" />
                                                        </div>
                                                    );
                                                }

                                                // Location icon
                                                if (msgType === 'location') {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                            <FiMapPin className="w-5 h-5 text-blue-500" />
                                                        </div>
                                                    );
                                                }

                                                // Contact icon
                                                if (msgType === 'contact' || msgType === 'contacts') {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                                            <FiUser className="w-5 h-5 text-purple-500" />
                                                        </div>
                                                    );
                                                }

                                                // Sticker
                                                if (msgType === 'sticker') {
                                                    return (
                                                        <div className="flex-shrink-0 w-10 h-10 rounded bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                                            <span className="text-lg">🎭</span>
                                                        </div>
                                                    );
                                                }

                                                return null;
                                            })()}

                                            {/* Text content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold mb-0.5 text-gray-700 dark:text-gray-200">
                                                    {replyToMessage.type === 'out' ? 'You' : (displayName || activeChat?.name || 'Contact')}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 flex items-center gap-1">
                                                    {(() => {
                                                        const replyMsg = replyToMessage;
                                                        const msgType = (replyMsg.message_type || '').toLowerCase();

                                                        // Show icon + label for media types
                                                        if (msgType === 'image' || msgType === 'photo') {
                                                            return (
                                                                <>
                                                                    <FiImage className="w-3 h-3 flex-shrink-0" />
                                                                    <span>{replyMsg.message || 'Photo'}</span>
                                                                </>
                                                            );
                                                        }
                                                        if (msgType === 'video') {
                                                            return (
                                                                <>
                                                                    <FiVideo className="w-3 h-3 flex-shrink-0" />
                                                                    <span>{replyMsg.message || 'Video'}</span>
                                                                </>
                                                            );
                                                        }
                                                        if (msgType === 'audio') {
                                                            return (
                                                                <>
                                                                    <FiMic className="w-3 h-3 flex-shrink-0" />
                                                                    <span>{replyMsg.is_voice ? 'Voice message' : 'Audio'}</span>
                                                                </>
                                                            );
                                                        }
                                                        if (msgType === 'document') {
                                                            return (
                                                                <>
                                                                    <FiFile className="w-3 h-3 flex-shrink-0" />
                                                                    <span>{replyMsg.media_name || replyMsg.message || 'Document'}</span>
                                                                </>
                                                            );
                                                        }
                                                        if (msgType === 'location') {
                                                            return (
                                                                <>
                                                                    <FiMapPin className="w-3 h-3 flex-shrink-0" />
                                                                    <span>Location</span>
                                                                </>
                                                            );
                                                        }
                                                        if (msgType === 'contact' || msgType === 'contacts') {
                                                            return (
                                                                <>
                                                                    <FiUser className="w-3 h-3 flex-shrink-0" />
                                                                    <span>Contact</span>
                                                                </>
                                                            );
                                                        }
                                                        if (msgType === 'sticker') {
                                                            return <span>Sticker</span>;
                                                        }

                                                        // Template message
                                                        if (replyMsg.is_template && replyMsg.template) {
                                                            const text = buildTemplateDisplayMessage(replyMsg.template, replyMsg.component);
                                                            if (text) {
                                                                return <WhatsAppText text={text} />;
                                                            }
                                                            return <span>Template message</span>;
                                                        }

                                                        // Text message
                                                        if (replyMsg.message) {
                                                            return <WhatsAppText text={replyMsg.message} />;
                                                        }

                                                        return <span>Message</span>;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-shrink-0 w-8 h-8 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                                <FiMessageSquare className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                    Replied to a message
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                                                    Message not available
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {msg.is_template ? (
                                <TemplateMessageRenderer
                                    msg={msg}
                                    darkMode={darkMode}
                                    renderFilePreview={renderFilePreview}
                                    isOwnMessage={msg.type === 'out'}
                                    onAudioTimeChange={handleAudioTimeChange}
                                />
                            ) : (msg.message_type || '').toLowerCase() === 'interactive' ? (
                                <InteractiveMessageRenderer
                                    msg={msg}
                                    isOwnMessage={msg.type === 'out'}
                                    onSelectOption={(selectedOption, originalMsg) => {
                                        if (typeof window !== 'undefined' && typeof window.handleInteractiveSelect === 'function') {
                                            window.handleInteractiveSelect(selectedOption, originalMsg);
                                        }
                                    }}
                                />
                            ) : msg.message_type === 'text' ? (
                                <p className="p-1 whitespace-pre-wrap break-words text-sm sm:text-base"><WhatsAppText text={msg.message} /></p>
                            ) : (
                                <div className="space-y-2">
                                    {renderFilePreview(msg, { onAudioTimeChange: handleAudioTimeChange })}
                                    {msg.message && msg.message.trim() && (
                                        <p className="whitespace-pre-wrap break-words text-sm sm:text-base">
                                            <WhatsAppText text={msg.message} />
                                        </p>
                                    )}
                                </div>
                            )}


                            <div className={`flex items-center space-x-1 sm:space-x-2 mt-1 sm:mt-2 justify-between`}>
                                <div className='left'>
                                    {msg.message_type === 'audio' && (
                                        <span className="text-xs opacity-75">
                                            {(() => {
                                                const seconds = audioTime.currentTime > 0
                                                    ? audioTime.currentTime
                                                    : audioTime.duration;
                                                return seconds ? formatAudioDuration(seconds) : '';
                                            })()}
                                        </span>
                                    )}
                                </div>

                                <div className='right flex justify-center items-center space-x-1 sm:space-x-2 mt-1 sm:mt-2'>
                                    <span className="text-xs opacity-75">
                                        {formatTime(msg.timestamp || msg.create_date)}
                                    </span>

                                    <MessageStatusIndicator
                                        status={msg.status || 'pending'}
                                        isOwnMessage={msg.type === 'out'}
                                        darkMode={darkMode}
                                        failedReason={msg.failed_reason}
                                    />
                                    {onReply && msg.wamid && msg.status !== 'failed' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onReply(msg);
                                            }}
                                            className={`top-2 bg-gray-200 ${msg.type === 'out' ? 'left-2' : 'right-2'} 
                                         group-hover:opacity-100 transition-opacity duration-200
                                        p-1 rounded-full hover:bg-black hover:bg-opacity-10 dark:hover:bg-white dark:hover:bg-opacity-10
                                        focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
                                            title="Reply to message"
                                        >
                                            <FiCornerUpLeft className="w-2.5 h-2.5 text-gray-700 dark:text-gray-400" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowInfoModal(true);
                                        }}
                                        className={`top-2 bg-gray-200 ${msg.type === 'out' ? 'left-2' : 'right-2'} 
                                     group-hover:opacity-100 transition-opacity duration-200
                                    p-1 rounded-full hover:bg-black hover:bg-opacity-10 dark:hover:bg-white dark:hover:bg-opacity-10
                                    focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
                                        title="View message details"
                                    >
                                        <FiInfo className="w-2.5 h-2.5 text-gray-700 dark:text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            {/* Info Button */}

                        </div>
                    </div>
                </div>
            </div>

            <MessageInfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
                message={msg}
                activeChat={activeChat}
            />
        </>
    );
};




// Main Conversation Component
function Conversation({ activeChat, tokens, onBack, darkMode, dbAvailable, socketMessage = null, socketAssigning = null, onMessageStatusUpdate, onContactUpdate }) {
    const [messageInput, setMessageInput] = useState('');
    const [isAllowedToSendMessage, setIsAllowedToSendMessage] = useState(null);
    const [assignmentInfo, setAssignmentInfo] = useState(null);
    const [hasAcknowledgedUnassigned, setHasAcknowledgedUnassigned] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMediaModal, setShowMediaModal] = useState(false);
    const [showFileSelectModal, setShowFileSelectModal] = useState(false);
    const [fileSelectModalType, setFileSelectModalType] = useState('photo');
    const [filesInModal, setFilesInModal] = useState([]);
    const [previewFileItem, setPreviewFileItem] = useState(null);
    const [isDraggingOverFileModal, setIsDraggingOverFileModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showTemplatePreview, setShowTemplatePreview] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const selectedFile = selectedFiles[0] ?? null;
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingChatNumber, setLoadingChatNumber] = useState(null);
    const [loadingPrevious, setLoadingPrevious] = useState(false);
    const [messages, setMessages] = useState([]);
    const [lastId, setLastId] = useState("0");
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);
    const [showAssignMenu, setShowAssignMenu] = useState(false);
    const [assignActionLoading, setAssignActionLoading] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [contactLoading, setContactLoading] = useState(false);
    const [contactSubmitting, setContactSubmitting] = useState(false);
    const [contactError, setContactError] = useState('');
    const [existingContactId, setExistingContactId] = useState(null);
    const [contactDbReady, setContactDbReady] = useState(false);
    const [searchModalOpen, setSearchModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [caseStatus, setCaseStatus] = useState(null);
    const [caseStatusLoading, setCaseStatusLoading] = useState(false);
    const [showCaseListModal, setShowCaseListModal] = useState(false);
    const [caseList, setCaseList] = useState([]);
    const [caseListLoading, setCaseListLoading] = useState(false);
    const [caseDetail, setCaseDetail] = useState(null);
    const [caseListError, setCaseListError] = useState('');
    const [caseListPageNo, setCaseListPageNo] = useState(1);
    const [caseListLimit, setCaseListLimit] = useState(10);
    const [caseListTotal, setCaseListTotal] = useState(0);
    const [caseListTotalPage, setCaseListTotalPage] = useState(1);
    const [caseListSearch, setCaseListSearch] = useState('');
    const [caseListStatusFilter, setCaseListStatusFilter] = useState(''); // '' | 'open' | 'closed'
    const [showCaseEditModal, setShowCaseEditModal] = useState(false);
    const [caseEditRow, setCaseEditRow] = useState(null);
    const [caseEditName, setCaseEditName] = useState('');
    const [caseEditRemark, setCaseEditRemark] = useState('');
    const [caseEditStatus, setCaseEditStatus] = useState('open');
    const [caseEditLoading, setCaseEditLoading] = useState(false);
    const [caseEditError, setCaseEditError] = useState('');
    const [showCaseCreateModal, setShowCaseCreateModal] = useState(false);
    const [caseCreateName, setCaseCreateName] = useState('');
    const [caseCreateRemark, setCaseCreateRemark] = useState('');
    const [caseCreateStatus, setCaseCreateStatus] = useState('open');
    const [caseCreateLoading, setCaseCreateLoading] = useState(false);
    const [caseCreateError, setCaseCreateError] = useState('');
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const projectInfo = useSelector((state) => state.project.info);

    const [contactForm, setContactForm] = useState({
        name: activeChat?.name || '',
        number: activeChat?.number || '',
        email: '',
        firm_name: '',
        website: '',
        remark: '',
        language_code: '',
        country: ''
    });

    useEffect(() => {
        const number = activeChat?.number ?? null;
        activeChatNumberRef.current = number;
        setIsAllowedToSendMessage(null);
        setAssignmentInfo(null);
        setHasAcknowledgedUnassigned(false);
    }, [activeChat?.number]);



    const isChatUnassigned = assignmentInfo?.assigned === false;
    const needsUnassignedPrompt = false;
    const isComposerBlocked = isAllowedToSendMessage === false;


    // Voice recording states
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const recordingCancelledRef = useRef(false);

    // Contact details side panel state
    const [showContactDetails, setShowContactDetails] = useState(false);
    const [contactDetails, setContactDetails] = useState(null);
    const [contactDetailsLoading, setContactDetailsLoading] = useState(false);
    const [contactDetailsError, setContactDetailsError] = useState('');
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const initialScrollDoneRef = useRef(false);
    const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll to bottom
    const emojiButtonRef = useRef(null);
    const messageInputRef = useRef(null);
    const inputSelectionRef = useRef({ start: 0, end: 0 });
    const headerMenuButtonRef = useRef(null);
    const headerMenuRef = useRef(null);
    const assignMenuButtonRef = useRef(null);
    const assignMenuRef = useRef(null);
    const contactDbInitRef = useRef(false);
    const activeChatNumberRef = useRef(activeChat?.number ?? null);

    const dispatch = useDispatch();
    const selectedFilesRef = useRef(selectedFiles);
    selectedFilesRef.current = selectedFiles;
    useEffect(() => {
        return () => {
            (selectedFilesRef.current || []).forEach((item) => {
                if (item?.previewUrl && typeof URL !== 'undefined') {
                    URL.revokeObjectURL(item.previewUrl);
                }
            });
        };
    }, []);

    useEffect(() => {
        const inputEl = messageInputRef.current;
        if (!inputEl || isUploading || loadingHistory || loadingChatNumber) {
            return;
        }

        const handleFocus = () => {
            if (document.activeElement === inputEl) return;
            inputEl.focus();
            try {
                const caretPos = inputEl.value?.length ?? 0;
                inputEl.setSelectionRange(caretPos, caretPos);
            } catch (err) {
                // Some input types do not support setSelectionRange (e.g., mobile number types).
            }
        };


        const raf = requestAnimationFrame(handleFocus);
        return () => cancelAnimationFrame(raf);
    }, [activeChat, isUploading, loadingHistory, loadingChatNumber]);

    const projectId = tokens?.selected_project_id;

    const ensureContactDb = useCallback(async () => {
        if (contactDbInitRef.current && contactDbReady) {
            return true;
        }

        if (!projectId) {
            setContactDbReady(false);
            return false;
        }

        try {
            const result = await contactDbHelper.init(projectId);
            contactDbInitRef.current = result;
            setContactDbReady(result);
            return result;
        } catch (error) {
            contactDbInitRef.current = false;
            setContactDbReady(false);
            return false;
        }
    }, [projectId, contactDbReady]);


    const handleCloseContactModal = useCallback(() => {
        if (contactSubmitting) return;
        setShowContactModal(false);
    }, [contactSubmitting]);

    const handleContactMenuClick = useCallback(async () => {

        setShowHeaderMenu(false);
        if (!activeChat?.number) {
            setContactError('Active chat information is unavailable.');
            setShowContactModal(true);
            return;
        }



        setShowContactModal(true);
        setContactError('');
        setContactLoading(true);



        setContactForm((prev) => ({
            ...prev,
            // If name is same as number, it means it's not saved yet, so leave name empty
            name: (activeChat?.name && activeChat?.name !== activeChat?.number) ? activeChat.name : '',
            number: activeChat?.number || ''
        }));



        try {
            const ready = await ensureContactDb();


            if (!ready) {
                setContactError('Unable to access local contact storage.');
                return;
            }

            // Check if contactDetails exists and matches current contact
            let currentContactDetails = null;
            if (contactDetails?.contact?.number === activeChat.number && contactDetails?.has_contact) {
                currentContactDetails = contactDetails.contact;
            } else {
                // Fetch fresh contact details for current contact
                if (tokens?.token && tokens?.username) {
                    try {
                        const payload = {
                            project_id: tokens.selected_project_id || '',
                            number: activeChat.number
                        };
                        const { data, key } = Encrypt(payload);
                        const data_pass = JSON.stringify({ data, key });
                        const response = await axios.post(
                            `${API_BASE_URL}/contact/contact-details`,
                            data_pass,
                            {
                                headers: {
                                    'token': tokens.token,
                                    'username': tokens.username,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );
                        if (!response?.data?.error && response?.data?.has_contact) {
                            currentContactDetails = response.data.contact;
                            setContactDetails(response.data);
                        }
                    } catch (fetchError) {
                        // Continue with existing data if fetch fails
                    }
                }
            }

            let existing = await contactDbHelper.getContactByNumber(activeChat.number);

            // Prioritize contact_id from API response (currentContactDetails) over local DB
            setExistingContactId(currentContactDetails?.contact_id || existing?.contact_id || null);
            setContactForm({
                name: currentContactDetails?.name || existing?.name || activeChat.name || '',
                number: activeChat.number || '',
                email: currentContactDetails?.email || existing?.email || '',
                firm_name: currentContactDetails?.firm_name || existing?.firm_name || '',
                website: currentContactDetails?.website || existing?.website || '',
                remark: currentContactDetails?.remark || existing?.remark || '',
                language_code: currentContactDetails?.language_code || existing?.language_code || '',
                country: currentContactDetails?.country || existing?.country || ''
            });
        } catch (error) {
            setContactError('Failed to load contact details.');
        } finally {
            setContactLoading(false);
        }
    }, [activeChat, ensureContactDb, contactDetails, tokens]);

    const fetchContactDetails = useCallback(async (number) => {
        if (!tokens?.token || !tokens?.username) return;

        setContactDetailsLoading(true);
        setContactDetailsError('');

        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                number: number
            };


            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/contact/contact-details`,
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
                setContactDetails(response.data);
            } else {
                setContactDetailsError(response?.data?.message || 'Failed to fetch contact details');
            }
        } catch (error) {
            setContactDetailsError('Failed to fetch contact details. Please try again.');
        } finally {
            setContactDetailsLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id]);

    const fetchCaseStatus = useCallback(async (number) => {
        if (!tokens?.token || !tokens?.username || !number) return;
        setCaseStatusLoading(true);
        setCaseStatus(null);
        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                number: String(number).trim()
            };
            console.log(payload);
            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/open-case-count`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (!response?.data?.error && typeof response?.data?.case_open_count === 'number') {
                setCaseStatus(Math.max(0, response.data.case_open_count));
            } else {
                setCaseStatus(null);
            }
        } catch (error) {
            setCaseStatus(null);
        } finally {
            setCaseStatusLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id]);

    const fetchCaseList = useCallback(async (page = 1, limit = 10, overrides = {}) => {
        if (!tokens?.token || !tokens?.username || !tokens?.selected_project_id) return;
        setCaseListLoading(true);
        setCaseListError('');
        try {
            const numberFilter = overrides.number !== undefined ? overrides.number : (showCaseListModal ? activeChat?.number : '');
            const searchFilter = overrides.search !== undefined ? overrides.search : caseListSearch;
            const statusFilter = overrides.status !== undefined ? overrides.status : caseListStatusFilter;
            const payload = {
                project_id: tokens.selected_project_id || '',
                page_no: page,
                limit: Math.min(Math.max(limit, 1), 100)
            };
            if (numberFilter) payload.number = String(numberFilter).trim();
            if (searchFilter) payload.search = String(searchFilter).trim();
            if (statusFilter === 'open' || statusFilter === 'closed') payload.status = statusFilter;
            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/case-list`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                setCaseListError(typeof response.data.error === 'string' ? response.data.error : (response.data.message || 'Failed to fetch case list'));
                setCaseList([]);
                return;
            }
            const list = response?.data?.data ?? [];
            const meta = response?.data?.meta ?? {};
            setCaseList(Array.isArray(list) ? list : []);
            setCaseListPageNo(meta.page_no ?? page);
            setCaseListLimit(meta.limit ?? limit);
            setCaseListTotal(Number(meta.total) || 0);
            setCaseListTotalPage(Number(meta.total_page) || 1);
        } catch (error) {
            setCaseListError('Failed to fetch case list. Please try again.');
            setCaseList([]);
        } finally {
            setCaseListLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id, caseListSearch, caseListStatusFilter, showCaseListModal, activeChat?.number]);

    const openCaseListModal = useCallback(() => {
        setShowCaseListModal(true);
        setCaseListError('');
        setCaseListSearch('');
        setCaseListStatusFilter('');
        setCaseListPageNo(1);
        fetchCaseList(1, caseListLimit, { number: activeChat?.number || '', search: '', status: '' });
    }, [activeChat?.number, caseListLimit, fetchCaseList]);

    const handleCaseListPageChange = useCallback((page) => {
        setCaseListPageNo(page);
        fetchCaseList(page, caseListLimit);
    }, [caseListLimit, fetchCaseList]);

    const handleCaseListPageSizeChange = useCallback((newSize) => {
        setCaseListLimit(newSize);
        setCaseListPageNo(1);
        fetchCaseList(1, newSize);
    }, [fetchCaseList]);

    const openCaseEditModal = useCallback((row) => {
        setCaseEditRow(row);
        setCaseEditName(row?.name ?? '');
        setCaseEditRemark(row?.remark ?? '');
        setCaseEditStatus(row?.status === true || row?.status === '1' ? 'open' : 'closed');
        setCaseEditError('');
        setShowCaseEditModal(true);
    }, []);

    const closeCaseEditModal = useCallback(() => {
        setShowCaseEditModal(false);
        setCaseEditRow(null);
        setCaseEditName('');
        setCaseEditRemark('');
        setCaseEditError('');
    }, []);

    const fetchEditCase = useCallback(async () => {
        if (!tokens?.token || !tokens?.username || !tokens?.selected_project_id || !caseEditRow) return;
        const caseId = caseEditRow.case_id ?? caseEditRow.id;
        if (!caseId) return;
        setCaseEditLoading(true);
        setCaseEditError('');
        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                case_id: caseId,
                name: String(caseEditName ?? '').trim(),
                remark: String(caseEditRemark ?? '').trim(),
                status: caseEditStatus === 'closed' ? 'closed' : 'open'
            };
            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/case-edit`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to update case';
                setCaseEditError(errMsg);
                return;
            }
            toast.success(response?.data?.msg ?? 'Case updated successfully');
            window.dispatchEvent(new CustomEvent('case_updated'));
            closeCaseEditModal();
            fetchCaseList(caseListPageNo, caseListLimit);
            if (showContactDetails && activeChat?.number) {
                fetchCaseList(1, caseListLimit, { number: activeChat.number, search: '', status: 'open' });
            }
            if (activeChat?.number) {
                fetchCaseStatus(activeChat.number);
            }
        } catch (error) {
            setCaseEditError(error?.response?.data?.error ?? 'Failed to update case. Please try again.');
        } finally {
            setCaseEditLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id, caseEditRow, caseEditName, caseEditRemark, caseEditStatus, closeCaseEditModal, caseListPageNo, caseListLimit, fetchCaseList, fetchCaseStatus, showContactDetails, activeChat?.number]);

    const openCaseCreateModal = useCallback(() => {
        setCaseCreateName('');
        setCaseCreateRemark('');
        setCaseCreateStatus('open');
        setCaseCreateError('');
        setShowCaseCreateModal(true);
    }, []);

    const closeCaseCreateModal = useCallback(() => {
        setShowCaseCreateModal(false);
        setCaseCreateName('');
        setCaseCreateRemark('');
        setCaseCreateError('');
    }, []);

    const fetchCreateCase = useCallback(async () => {
        if (!tokens?.token || !tokens?.username || !tokens?.selected_project_id || !activeChat?.number) return;
        setCaseCreateLoading(true);
        setCaseCreateError('');
        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                number: activeChat.number,
                name: String(caseCreateName ?? '').trim(),
                remark: String(caseCreateRemark ?? '').trim(),
                status: caseCreateStatus === 'closed' ? 'closed' : 'open'
            };
            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/case-create`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to create case';
                setCaseCreateError(errMsg);
                return;
            }
            toast.success(response?.data?.msg ?? 'Case created successfully');
            window.dispatchEvent(new CustomEvent('case_updated'));
            closeCaseCreateModal();
            fetchCaseList(caseListPageNo, caseListLimit);
            if (showContactDetails && activeChat?.number) {
                fetchCaseList(1, caseListLimit, { number: activeChat.number, search: '', status: '' });
            }
            fetchCaseStatus(activeChat.number);
        } catch (error) {
            setCaseCreateError(error?.response?.data?.error ?? 'Failed to create case. Please try again.');
        } finally {
            setCaseCreateLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id, activeChat?.number, caseCreateName, caseCreateRemark, caseCreateStatus, closeCaseCreateModal, caseListPageNo, caseListLimit, fetchCaseList, fetchCaseStatus, showContactDetails]);

    const handleContactSave = useCallback(async (formData, fullNumber, country) => {
        if (contactSubmitting) return;

        if (!tokens?.token || !tokens?.username) {
            setContactError('Authentication required. Please login again.');
            return;
        }

        const trimmedNumber = fullNumber?.trim();
        const trimmedName = formData.name?.trim();

        if (!trimmedNumber) {
            setContactError('Mobile number is required.');
            return;
        }

        if (!trimmedName) {
            setContactError('Name is required.');
            return;
        }

        const ready = await ensureContactDb();
        if (!ready) {
            setContactError('Unable to access local contact storage.');
            return;
        }

        setContactSubmitting(true);
        setContactError('');

        try {
            const isUpdate = Boolean(existingContactId);

            const payload = {
                project_id: tokens.selected_project_id || '',
                number: trimmedNumber,
                name: trimmedName,
                email: formData.email?.trim() || '',
                firm_name: formData.firm_name?.trim() || '',
                website: formData.website?.trim() || '',
                remark: formData.remark?.trim() || ''
            };

            // Add contact_id for update requests
            if (isUpdate) {
                payload.contact_id = existingContactId;
            }

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const apiUrl = isUpdate
                ? `${API_BASE_URL}/contact/update-contact`
                : `${API_BASE_URL}/contact/create-contact`;

            const response = await axios.post(apiUrl, data_pass, {
                headers: {
                    'token': tokens.token,
                    'username': tokens.username,
                    'Content-Type': 'application/json'
                }
            });

            if (!response?.data?.error) {
                // Save to local database with response data
                const contactData = {
                    contact_id: isUpdate
                        ? existingContactId
                        : (response?.data?.data?.id || Date.now().toString()),
                    number: trimmedNumber,
                    name: trimmedName,
                    email: formData.email?.trim() || '',
                    firm_name: formData.firm_name?.trim() || '',
                    website: formData.website?.trim() || '',
                    remark: formData.remark?.trim() || '',
                    language_code: country?.iso2 || '',
                    country: country?.name || '',
                    create_date: isUpdate
                        ? undefined // Don't update create_date on edit
                        : new Date().toISOString()
                };

                await contactDbHelper.saveContacts([contactData]);

                if (isUpdate) {
                    setExistingContactId(existingContactId);
                } else {
                    setExistingContactId(contactData.contact_id);
                }

                // Update chat name in local database
                if (dbAvailable && trimmedName) {
                    try {
                        await dbHelper.updateChat(trimmedNumber, { name: trimmedName });
                    } catch (updateError) {
                    }
                }

                // Notify parent component to refresh chat list
                if (onContactUpdate && trimmedName) {
                    onContactUpdate(trimmedNumber, trimmedName);
                }

                // Refetch contact details from API to get complete updated data
                await fetchContactDetails(trimmedNumber);

                // Show success toast message
                toast.success(isUpdate ? 'Contact updated successfully' : 'Contact created successfully', {
                    duration: 3000,
                    icon: '✓'
                });

                setShowContactModal(false);
            } else {
                const errorMessage = response?.data?.message || 'Unknown error';
                setContactError(`Failed to ${isUpdate ? 'update' : 'create'} contact: ${errorMessage}`);
            }
        } catch (error) {
            setContactError(`Failed to ${existingContactId ? 'update' : 'create'} contact. Please try again.`);
        } finally {
            setContactSubmitting(false);
        }
    }, [existingContactId, ensureContactDb, contactSubmitting, dbAvailable, tokens, onContactUpdate, fetchContactDetails]);

    const handleSearchMenuClick = useCallback(() => {
        setShowHeaderMenu(false);
        setSearchQuery('');
        setSearchModalOpen(true);
    }, []);

    const handleSearchQueryChange = useCallback((value) => {
        setSearchQuery(value);
    }, []);

    const handleCloseSearchModal = useCallback(() => {
        setSearchModalOpen(false);
    }, []);

    const handleSearchResultClick = useCallback((messageKey) => {
        setSearchModalOpen(false);
        if (!messageKey) return;
        setHighlightedMessageId(messageKey);

        setTimeout(() => {
            const node = document.getElementById(`message-${messageKey}`);
            if (node?.scrollIntoView) {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 80);
    }, []);

    // Scroll to a message and highlight it (used for reply click)
    const handleScrollToMessage = useCallback((messageKey) => {
        if (!messageKey) return;

        const node = document.getElementById(`message-${messageKey}`);
        if (node?.scrollIntoView) {
            setHighlightedMessageId(messageKey);
            node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Message not found in current view - show toast
            toast.error('Message not found. It may have been deleted or not loaded yet.', {
                duration: 2500,
                icon: '💬'
            });
        }
    }, []);

    const handleDateClick = useCallback((selectedDate) => {
        setSearchModalOpen(false);
        if (!selectedDate) return;

        // Convert selected date to date string format used by getDateString
        const date = new Date(selectedDate);
        const dateString = date.toDateString(); // Format: "Mon Oct 26 2025"

        // Format date for display
        const formattedDate = formatDateForDisplay(date);

        setTimeout(() => {
            const node = document.getElementById(`date-separator-${dateString}`);
            if (node?.scrollIntoView) {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Date not found - show custom toast notification
                toast.custom((t) => (
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        className={`max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-xl pointer-events-auto flex border border-gray-200 dark:border-gray-700 overflow-hidden`}
                    >
                        <div className="flex-1 w-0 p-4">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                                        <FiCalendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                </div>
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        No conversations found
                                    </p>
                                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                        No messages on <span className="font-medium text-gray-700 dark:text-gray-300">{formattedDate}</span>
                                    </p>
                                </div>
                                <div className="ml-4 flex-shrink-0 flex">
                                    <button
                                        onClick={() => toast.dismiss(t.id)}
                                        className="inline-flex rounded-md p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                    >
                                        <FiX className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ), {
                    duration: 2000,
                    position: 'top-center',
                });
            }
        }, 80);
    }, [darkMode]);

    const searchResults = useMemo(() => {
        const term = searchQuery.trim();
        if (!term) return [];

        const lowerTerm = term.toLowerCase();
        const results = [];
        const seen = new Set();

        // Helper function to get date for search results (empty if today)
        const getSearchResultDate = (timestamp) => {
            if (!timestamp) return '';
            try {
                const date = typeof timestamp === 'number' ? new Date(timestamp) : parseServerDate(timestamp);
                if (!date) return '';
                const today = new Date();

                // Reset time to compare only dates
                const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                // If it's today, return empty string
                if (messageDate.getTime() === todayDate.getTime()) {
                    return '';
                }

                // Otherwise, format the date
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

                if (messageDate.getTime() === yesterdayDate.getTime()) {
                    return 'Yesterday';
                } else {
                    // Format as DD/MM/YYYY
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}/${month}/${year}`;
                }
            } catch {
                return '';
            }
        };

        messages.forEach((msg) => {
            const text = getSearchableTextFromMessage(msg);
            if (!text) return;
            if (!text.toLowerCase().includes(lowerTerm)) return;

            const key = getMessageKey(msg);
            if (seen.has(key)) return;
            seen.add(key);

            const msgTimestamp = msg.timestamp || msg.create_date;
            results.push({
                messageKey: key,
                snippet: getSnippetAroundTerm(text, term),
                timestamp: formatTime(msgTimestamp),
                date: getSearchResultDate(msgTimestamp),
                direction: msg.type === 'out' ? 'You' : (activeChat?.name || msg.send_by_name || msg.send_by_username || 'Contact')
            });
        });

        return results.slice(0, 50);
    }, [searchQuery, messages, activeChat?.name]);

    useEffect(() => {
        if (!highlightedMessageId) return;
        const timer = setTimeout(() => setHighlightedMessageId(null), 1100);
        return () => clearTimeout(timer);
    }, [highlightedMessageId]);

    useEffect(() => {
        if (!showHeaderMenu) return;

        const handleClickOutside = (event) => {
            if (!headerMenuRef.current && !headerMenuButtonRef.current) return;

            const menuNode = headerMenuRef.current;
            const buttonNode = headerMenuButtonRef.current;

            if (menuNode && menuNode.contains(event.target)) return;
            if (buttonNode && buttonNode.contains(event.target)) return;

            setShowHeaderMenu(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHeaderMenu]);

    useEffect(() => {
        setShowHeaderMenu(false);
    }, [activeChat?.number]);

    useEffect(() => {
        if (!showAssignMenu) return;

        const handleClickOutside = (event) => {
            const menuNode = assignMenuRef.current;
            const buttonNode = assignMenuButtonRef.current;

            if (menuNode && menuNode.contains(event.target)) return;
            if (buttonNode && buttonNode.contains(event.target)) return;

            setShowAssignMenu(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAssignMenu]);

    useEffect(() => {
        setShowAssignMenu(false);
    }, [activeChat?.number]);

    const restoreMessageInputFocus = useCallback(() => {
        const inputEl = messageInputRef.current;
        if (!inputEl) return;

        const { start, end } = inputSelectionRef.current || {};
        const caretStart = Number.isInteger(start) ? start : inputEl.value.length;
        const caretEnd = Number.isInteger(end) ? end : caretStart;

        requestAnimationFrame(() => {
            inputEl.focus();
            try {
                inputEl.setSelectionRange(caretStart, caretEnd);
            } catch (_) {
                // Ignore selection errors (e.g., unsupported inputs)
            }
        });
    }, []);

    const updateSelectionFromInput = useCallback(() => {
        const inputEl = messageInputRef.current;
        if (!inputEl) return;
        inputSelectionRef.current = {
            start: inputEl.selectionStart || 0,
            end: inputEl.selectionEnd || 0
        };
    }, []);

    useEffect(() => {
        if (!projectInfo) {
            dispatch(fetchProjectInfo());
        }
    }, [dispatch, projectInfo]);


    const handleEmojiSelect = (emoji) => {
        const inputEl = messageInputRef.current;
        const fallbackPosition = messageInput.length;
        const { start, end } = inputSelectionRef.current || {};
        const isValidSelection = Number.isInteger(start) && Number.isInteger(end);
        const inputIsFocused = inputEl && document.activeElement === inputEl;
        const shouldAppendToEnd = !isValidSelection || !inputIsFocused;
        const insertAt = shouldAppendToEnd ? fallbackPosition : start;
        const replaceTo = shouldAppendToEnd ? fallbackPosition : end;
        const newValue = messageInput.slice(0, insertAt) + emoji + messageInput.slice(replaceTo);
        setMessageInput(newValue);

        const newCaret = insertAt + emoji.length;
        inputSelectionRef.current = { start: newCaret, end: newCaret };

        // Restore focus and caret after updating value; default to end when picker steals focus
        requestAnimationFrame(() => {
            if (inputEl) {
                inputEl.focus();
                try {
                    inputEl.setSelectionRange(newCaret, newCaret);
                } catch (_) {
                    // ignore selection errors on some browsers
                }
            }
        });
    };

    const handleEmojiButtonMouseDown = useCallback((event) => {
        event.preventDefault();
        restoreMessageInputFocus();
    }, [restoreMessageInputFocus]);

    const handleComposerFocus = useCallback(() => {
        document.body.classList.add('chat-composer-focused');
        inputSelectionRef.current = {
            start: messageInput.length,
            end: messageInput.length
        };
    }, [messageInput.length]);

    const handleComposerBlur = useCallback(() => {
        document.body.classList.remove('chat-composer-focused');
        updateSelectionFromInput();
    }, [updateSelectionFromInput]);

    useEffect(() => {
        return () => document.body.classList.remove('chat-composer-focused');
    }, []);

    const handleEmojiButtonClick = useCallback((event) => {
        event.preventDefault();
        setShowEmojiPicker((prev) => !prev);
        restoreMessageInputFocus();
    }, [restoreMessageInputFocus]);

    // Mark as read only when tab/window is focused (like WhatsApp Web)
    useEffect(() => {
        if (!activeChat?.number) return;

        const runMarkAsReadIfVisible = () => {
            if (document.visibilityState === 'visible') {
                markAsRead(activeChat.number);
            }
        };

        runMarkAsReadIfVisible();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                markAsRead(activeChat.number);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [activeChat, messages]);

    useEffect(() => {
        setContactForm({
            name: activeChat?.name || '',
            number: activeChat?.number || '',
            email: '',
            firm_name: '',
            website: '',
            remark: '',
            language_code: '',
            country: ''
        });
        setExistingContactId(null);
        setContactError('');
    }, [activeChat?.name, activeChat?.number]);

    // Load message history when active chat changes: show loading immediately until API completes
    useEffect(() => {
        if (!tokens || !activeChat) return;

        const chatNumber = activeChat.number;
        setMessages([]);
        setLoadingChatNumber(chatNumber);

        (async () => {
            initialScrollDoneRef.current = false;
            shouldAutoScrollRef.current = true;
            setLastId("0");
            setHasMoreMessages(true);
            setLoadingPrevious(false);

            try {
                await syncWithAPI();

                if (activeChat?.number !== chatNumber) return;

                if (dbAvailable) {
                    await dbHelper.deleteMessagesWithNullId(activeChat.number);
                    const updatedMessage = await dbHelper.getMessages(activeChat.number);
                    const validMessages = (updatedMessage || []).filter((m) => m.id != null && m.id !== '');
                    setMessages(validMessages);
                }

                setTimeout(() => scrollToBottomImmediate(), 220);
            } finally {
                if (activeChat?.number === chatNumber) {
                    setLoadingChatNumber(null);
                }
            }
        })();
    }, [tokens, activeChat?.number]);

    // 🔹 When a new socket-driven refresh arrives (messages for active chat)
    useEffect(() => {
        if (Array.isArray(socketMessage) && socketMessage.length > 0 && activeChat?.number) {
            setMessages(socketMessage);
            // setTimeout(() => scrollToBottomImmediate(), 50);
        }
    }, [socketMessage, activeChat]);



    // Ensure we render from the bottom with no visible scroll on first paint
    useLayoutEffect(() => {
        // Only auto-scroll if we should (not loading previous messages or user is already at bottom)
        if (shouldAutoScrollRef.current) {
            scrollToBottomSync();
        }
    }, [messages]);

    // Add scroll event handler for infinite scroll
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;

            // Check if user is at or near the bottom (within 100px threshold)
            const isAtBottom = scrollHeight - scrollTop - clientHeight <= 100;
            shouldAutoScrollRef.current = isAtBottom;

            // Check if user has scrolled to the top (within 100px threshold)
            if (scrollTop <= 100 && hasMoreMessages && !loadingPrevious) {
                loadPreviousMessages();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMoreMessages, loadingPrevious]);


    const scrollToBottom = () => {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({
                    behavior: "auto",
                    block: "end",
                    inline: "nearest"
                });
                initialScrollDoneRef.current = true;
            }
        }, 0);
    };

    // Alternative scroll method for immediate scrolling
    const scrollToBottomImmediate = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior: "auto",
                block: "end",
                inline: "nearest"
            });
            initialScrollDoneRef.current = true;
        }
    };

    // Synchronous bottom scroll used in layout effect to avoid visual jump
    const scrollToBottomSync = () => {
        if (messagesEndRef.current) {
            try {
                messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end", inline: "nearest" });
                initialScrollDoneRef.current = true;
            } catch (_) { }
        }
    };

    // Handle media load scroll updates
    const handleMediaLoad = () => {
        // Use a small delay to ensure DOM has updated
        setTimeout(() => {
            // scrollToBottomImmediate();
        }, 50);
    };

    const updateSendPermission = useCallback((assigningInfo, forChatNumber = null) => {
        if (forChatNumber != null && forChatNumber !== activeChatNumberRef.current) {
            return;
        }
        setAssignmentInfo(assigningInfo || null);

        if (!assigningInfo) {
            setIsAllowedToSendMessage(true);
            return;
        }

        const hasAssignmentMeta =
            typeof assigningInfo.assigned !== 'undefined' ||
            typeof assigningInfo.assigned_to_me !== 'undefined';

        if (!hasAssignmentMeta) {
            setIsAllowedToSendMessage(true);
            return;
        }

        const canSend = assigningInfo.assigned === false || assigningInfo.assigned_to_me === true;
        setIsAllowedToSendMessage(canSend);
    }, []);

    // 🔹 When chat assignment updates arrive via socket (only apply when we know the chat and it's the current chat)
    useEffect(() => {
        if (!socketAssigning || !socketAssigning.assigning) return;

        const eventNumber = socketAssigning.number || socketAssigning.contact?.number;
        if (!eventNumber || eventNumber !== activeChatNumberRef.current) {
            return;
        }

        updateSendPermission(socketAssigning.assigning, eventNumber);

        if (socketAssigning.assigning.assigned === false) {
            setHasAcknowledgedUnassigned(false);
        }
    }, [socketAssigning, updateSendPermission]);

    const handleAssignmentChange = useCallback(async (type, targetUsername = '') => {
        if (type === 'assign' && !targetUsername) {
            toast.error('Please choose a user to assign this chat.');
            return;
        }

        if (!activeChat?.number) {
            toast.error('No active chat selected.');
            return;
        }

        if (!tokens?.token || !tokens?.username) {
            toast.error('Missing credentials to update assignment.');
            return;
        }

        setAssignActionLoading(true);

        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                type,
                number: activeChat.number
            };

            if (type === 'assign') {
                payload.target = targetUsername;
            }

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/message/chat-assign`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data?.error) {
                throw new Error(response.data?.message || 'Failed to update assignment.');
            }

            const newAssigning = response.data?.assigning;
            const chatNumber = activeChat.number;
            if (newAssigning) {
                updateSendPermission(newAssigning, chatNumber);
            } else {
                const selectedUser = assignmentInfo?.users?.find((user) => user.username === targetUsername);
                const fallbackInfo = type === 'assign'
                    ? {
                        assigned: true,
                        assigned_to_me: selectedUser?.is_me || targetUsername === tokens.username,
                        assigned_user: selectedUser || { username: targetUsername, name: selectedUser?.name || targetUsername },
                        users: assignmentInfo?.users || []
                    }
                    : {
                        assigned: false,
                        assigned_to_me: false,
                        assigned_user: null,
                        users: assignmentInfo?.users || []
                    };

                updateSendPermission(fallbackInfo, chatNumber);
            }

            if (type === 'unassign') {
                setHasAcknowledgedUnassigned(false);
            }

            toast.success(type === 'assign' ? 'Chat assigned successfully.' : 'Chat unassigned.');
            setShowAssignMenu(false);
        } catch (error) {
            const message = error.response?.data?.message || error.message || 'Failed to update assignment.';
            toast.error(message);
        } finally {
            setAssignActionLoading(false);
        }
    }, [activeChat?.number, tokens?.token, tokens?.username, tokens?.selected_project_id, assignmentInfo, updateSendPermission]);

    const syncWithAPI = async (isLoadingPrevious = false) => {
        if (!activeChat || (isLoadingPrevious ? loadingPrevious : loadingHistory)) return;

        const loadingForNumber = activeChat.number;

        if (isLoadingPrevious) {
            setLoadingPrevious(true);
        } else {
            setLoadingHistory(true);
        }

        try {
            const messagePayload = {
                project_id: tokens.selected_project_id || '',
                number: loadingForNumber,
                last_id: isLoadingPrevious ? lastId : "0"
            };

            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            const response = await axios.post(
                `${API_BASE_URL}/message/chat-history`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Only apply response for the chat we loaded (avoid assignment/messages glitch on desktop when switching chats)
            if (activeChat?.number !== loadingForNumber) return;

            if (!response.data.error && response.data.data) {
                updateSendPermission(response.data.assigning, loadingForNumber);
                const apiLastId = response.data.last_id;
                await processApiResponse(response.data.data, isLoadingPrevious, apiLastId);
            } else if (isLoadingPrevious && (!response.data.data || response.data.data.length === 0)) {
                setHasMoreMessages(false);
            }
        } catch (error) {
        } finally {
            if (isLoadingPrevious) {
                if (activeChat?.number === loadingForNumber) setLoadingPrevious(false);
            } else {
                setLoadingHistory(false);
            }
        }
    };

    const loadPreviousMessages = async () => {
        if (!hasMoreMessages || loadingPrevious) return;
        await syncWithAPI(true);
    };

    // Auto-fetch contact details when activeChat changes
    useEffect(() => {
        if (activeChat?.number && tokens?.token) {
            fetchContactDetails(activeChat.number);
        }
    }, [activeChat?.number, tokens?.token, fetchContactDetails]);

    // Reset contact details when switching chats
    useEffect(() => {
        if (activeChat?.number) {
            // Reset contact details state when switching to a new chat
            setContactDetails(null);
            setContactDetailsError('');
        }
    }, [activeChat?.number]);

    // Fetch case status when opening a chat conversation
    useEffect(() => {
        if (activeChat?.number && tokens?.token) {
            fetchCaseStatus(activeChat.number);
        } else {
            setCaseStatus(null);
            setCaseStatusLoading(false);
        }
    }, [activeChat?.number, tokens?.token, fetchCaseStatus]);

    // Compute display name: prefer contactDetails name if available, otherwise use activeChat.name
    const displayName = useMemo(() => {
        if (contactDetails?.has_contact && contactDetails?.contact?.name) {
            return contactDetails.contact.name;
        }
        return activeChat?.name || '';
    }, [contactDetails, activeChat?.name]);

    const processApiResponse = async (apiMessages, isLoadingPrevious = false, apiLastId = null) => {
        try {
            const messageList = apiMessages.map(apiMessage => {
                // Normalize `component` (API may send an array OR a JSON-stringified array)
                const normalizedComponent = (() => {
                    const c = apiMessage?.component;
                    if (!c) return [];
                    if (Array.isArray(c)) return c;
                    if (typeof c === 'string') {
                        try {
                            const parsed = JSON.parse(c);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                })();

                // Build readable text for template if server message is missing/empty



                const isTemplate = Boolean(apiMessage?.is_template || apiMessage?.message_type === 'template');
                const interactiveData = (apiMessage?.message_type || '').toLowerCase() === 'interactive'
                    || apiMessage?.interactive || apiMessage?.interactive_data
                    ? normalizeInteractiveMessage(apiMessage)
                    : null;
                let resolvedMessage = (apiMessage.message ?? '');
                if (isTemplate && (!resolvedMessage || resolvedMessage.length === 0)) {
                    resolvedMessage = buildTemplateDisplayMessage(
                        apiMessage.template,
                        normalizedComponent
                    ) || '';

                    if (!resolvedMessage) {
                        let bodyText = '';
                        if (apiMessage.template?.components) {
                            const bodyComp = apiMessage.template.components.find(c => c.type === 'BODY');
                            bodyText = bodyComp?.text || '';
                        } else if (apiMessage.template?.body) {
                            bodyText = apiMessage.template.body;
                        }
                        const params = (normalizedComponent || [])
                            .find(c => c?.type?.toLowerCase() === 'body')
                            ?.parameters || [];
                        const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
                        resolvedMessage = matches.reduce((acc, ph, idx) => {
                            const val = params[idx]?.text || `Variable ${idx + 1}`;
                            return acc.replace(ph, val);
                        }, bodyText) || '';
                    }
                }

                // Extract header media URL from component parameters for templates
                let headerMediaUrl = apiMessage.media_url || '';
                let headerMediaName = apiMessage.media_name || '';
                let derivedMessageType = apiMessage.message_type || '';

                if (isTemplate && normalizedComponent.length > 0) {
                    const headerComp = normalizedComponent.find(c => c.type?.toLowerCase() === 'header');
                    if (headerComp && headerComp.parameters && headerComp.parameters.length > 0) {
                        const param = headerComp.parameters[0];
                        if (param?.type === 'image' && param.image?.link) {
                            headerMediaUrl = param.image.link;
                            derivedMessageType = 'image';
                            headerMediaName = headerMediaUrl.split('/').pop() || 'Image';
                        } else if (param?.type === 'video' && param.video?.link) {
                            headerMediaUrl = param.video.link;
                            derivedMessageType = 'video';
                            headerMediaName = headerMediaUrl.split('/').pop() || 'Video';
                        } else if (param?.type === 'document' && param.document?.link) {
                            headerMediaUrl = param.document.link;
                            derivedMessageType = 'document';
                            headerMediaName = headerMediaUrl.split('/').pop() || 'Document';
                        }
                    }
                }

                // Fallback: Determine header media for templates if API provides media_url
                if (isTemplate && headerMediaUrl && !derivedMessageType) {
                    const lower = (headerMediaUrl || '').toLowerCase();
                    if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/.test(lower)) derivedMessageType = 'image';
                    else if (/(\.mp4|\.mov|\.avi|\.webm)$/.test(lower)) derivedMessageType = 'video';
                    else if (/(\.mp3|\.wav|\.ogg|\.m4a)$/.test(lower)) derivedMessageType = 'audio';
                    else derivedMessageType = 'document';
                }

                return ({
                    message_id: apiMessage.message_id || '',
                    wamid: apiMessage.wamid || '',
                    create_date: apiMessage.create_date || '',
                    type: apiMessage.type || '',
                    message_type: interactiveData ? 'interactive' : (derivedMessageType || apiMessage.message_type || ''),
                    message: interactiveData?.message || resolvedMessage,
                    is_template: isTemplate,
                    is_forwarded: apiMessage.is_forwarded || false,
                    is_reply: apiMessage.is_reply || false,
                    status: apiMessage.status || '',
                    id: apiMessage.id || '',
                    send_by_username: apiMessage.send_by?.username || '',
                    send_by_name: apiMessage.send_by?.name || '',
                    send_by_mobile: apiMessage.send_by?.mobile || '',
                    send_by_email: apiMessage.send_by?.email || '',
                    send_by_status: apiMessage.send_by?.status || false,
                    is_read: apiMessage.is_read || false,
                    read_by_username: apiMessage.read_by?.username || '',
                    read_by_name: apiMessage.read_by?.name || '',
                    read_by_mobile: apiMessage.read_by?.mobile || '',
                    read_by_email: apiMessage.read_by?.email || '',
                    read_by_status: apiMessage.read_by?.status || false,
                    failed_reason: apiMessage.failed_reason || '',
                    media_url: headerMediaUrl || apiMessage.media_url || '',
                    media_name: headerMediaName || apiMessage.media_name || '',
                    is_voice: apiMessage.is_voice || false,
                    address: apiMessage.address || '',
                    latitude: apiMessage.latitude || '',
                    longitude: apiMessage.longitude || '',
                    name: apiMessage.name || '',
                    reply_wamid: apiMessage.reply_wamid || '',
                    timestamp: apiMessage.timestamp || toServerTimestamp(apiMessage.create_date) || '',
                    retryCount: apiMessage.retryCount || '',
                    chat_number: activeChat.number,
                    // Store template and component data for rendering
                    template: apiMessage.template || null,
                    component: normalizedComponent.length ? normalizedComponent : null,
                    interactive: interactiveData?.interactive || apiMessage.interactive || null,
                    interactive_reply: interactiveData?.interactive_reply || apiMessage.interactive_reply || null
                });
            });

            if (isLoadingPrevious) {
                // Store current scroll position before prepending
                const container = messagesContainerRef.current;
                const scrollHeightBefore = container ? container.scrollHeight : 0;
                const scrollTopBefore = container ? container.scrollTop : 0;

                // Filter out duplicates by checking message_id and id
                setMessages(prev => {
                    const existingIds = new Set([
                        ...prev.map(m => m.message_id),
                        ...prev.map(m => m.id)
                    ]);

                    const newMessages = messageList.filter(msg =>
                        !existingIds.has(msg.message_id) && !existingIds.has(msg.id)
                    );

                    return [...newMessages, ...prev];
                });

                // Update lastId from API response (last_id + 20)
                if (apiLastId !== null && apiLastId !== undefined) {
                    const nextLastId = parseInt(apiLastId);
                    setLastId(nextLastId.toString());
                }

                // If we got no messages or fewer than expected, we might be at the end
                if (messageList.length === 0) {
                    setHasMoreMessages(false);
                }

                // Restore scroll position after DOM updates
                setTimeout(() => {
                    if (container) {
                        const scrollHeightAfter = container.scrollHeight;
                        const scrollDifference = scrollHeightAfter - scrollHeightBefore;
                        container.scrollTop = scrollTopBefore + scrollDifference;
                    }
                }, 50);
            } else {
                // Initial load - replace all messages
                setMessages(messageList);

                // Set lastId from API response for pagination
                if (apiLastId !== null && apiLastId !== undefined) {
                    const nextLastId = parseInt(apiLastId);
                    setLastId(nextLastId.toString());
                }
            }

            // Save to local DB (without duplicates)
            if (dbAvailable) {
                await dbHelper.saveMessage(messageList);
            }
        } catch (error) {
        }
    };

    const markAsRead = async (number) => {
        try {
            const messagePayload = {
                project_id: tokens.selected_project_id || '',
                number: number
            };

            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            await axios.post(
                `${API_BASE_URL}/message/mark-as-read`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
        }
    };

    const renderFilePreview = (message, options = {}) => {
        const { onAudioTimeChange } = options;
        const fileInfo = {
            serverUrl: message.media_url,
            name: message.media_name || 'File',
            size: 0
        };

        switch (message.message_type) {
            case 'image':
            case 'photo':
                return (
                    <ImagePreview
                        fileInfo={fileInfo}
                        isOwnMessage={message.send_by === 'You'}
                        onImageLoad={handleMediaLoad}
                    />
                );
            case 'video':
                return (
                    <VideoPreview
                        fileInfo={fileInfo}
                        isOwnMessage={message.send_by === 'You'}
                        onVideoLoad={handleMediaLoad}
                    />
                );
            case 'audio':
                return (
                    <AudioPreview
                        fileInfo={fileInfo}
                        isOwnMessage={message.send_by === 'You'}
                        isVoiceMessage={message.is_voice || false}
                        onTimeChange={onAudioTimeChange}
                    />
                );
            case 'document':
                return (
                    <DocumentPreview
                        fileInfo={fileInfo}
                        isOwnMessage={message.send_by === 'You'}
                    />
                );
            case 'location':
                return (
                    <LocationPreview
                        latitude={message.latitude}
                        longitude={message.longitude}
                        address={message.address}
                        name={message.name}
                        isOwnMessage={message.send_by === 'You'}
                    />
                );
            case 'contact':
                return (
                    <ContactPreview
                        contactInfo={{
                            name: message.name,
                            phone: message.message
                        }}
                        isOwnMessage={message.send_by === 'You'}
                    />
                );
            default:
                return (
                    <DocumentPreview
                        fileInfo={fileInfo}
                        isOwnMessage={message.send_by === 'You'}
                    />
                );
        }
    };



    // Handle template preview
    const handleTemplatePreview = (template) => {
        setSelectedTemplate(template);
        setShowTemplatePreview(true);
    };


    const handleSendMessage = async () => {
        if (!messageInput.trim() && selectedFiles.length === 0) return;

        if (selectedFiles.length > 0) {
            const attachmentMessage = messageInput.trim() || '';
            const allPreUploaded = selectedFiles.every((f) => f.uploadedUrl);
            if (allPreUploaded) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    await sendMessageWithUploadedUrl(selectedFiles[i], i === 0 ? attachmentMessage : '');
                }
            } else {
                setIsUploading(true);
                for (let i = 0; i < selectedFiles.length; i++) {
                    setUploadProgress(0);
                    await uploadAndSendOneFile(selectedFiles[i], i === 0 ? attachmentMessage : '');
                }
                setIsUploading(false);
                setUploadProgress(0);
            }
            revokeSelectedFilesUrls();
            setSelectedFiles([]);
            setMessageInput('');
            if (messageInputRef.current) {
                messageInputRef.current.style.height = 'auto';
            }
        } else {
            await sendTextMessage(messageInput);
        }
    };

    const sendTextMessage = async (text) => {
        const tempMessageId = `temp_${Date.now()}`;

        // Capture reply info before clearing
        const replyInfo = replyingToMessage ? {
            is_reply: true,
            reply_wamid: replyingToMessage.wamid,
            reply_to_message: replyingToMessage
        } : {
            is_reply: false,
            reply_wamid: '',
            reply_to_message: null
        };

        const newMessage = {
            id: Date.now().toString(),
            message_id: tempMessageId,
            type: 'out',
            message_type: 'text',
            message: text,
            status: 'pending',
            timestamp: Date.now(),
            send_by: 'You',
            chat_number: activeChat.number,
            ...replyInfo
        };

        setMessages(prev => [...prev, newMessage]);
        shouldAutoScrollRef.current = true; // Enable auto-scroll when sending new message
        setMessageInput('');
        setReplyingToMessage(null);
        // Reset textarea height after sending
        if (messageInputRef.current) {
            messageInputRef.current.style.height = 'auto';
        }

        if (onMessageStatusUpdate) {
            onMessageStatusUpdate(activeChat.number, tempMessageId, 'pending');
        }

        try {
            const messagePayload = {
                project_id: tokens.selected_project_id || '',
                message: text,
                number: activeChat.number,
                ...(replyInfo.is_reply && {
                    is_reply: true,
                    reply_wamid: replyInfo.reply_wamid
                })
            };

            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            const response = await axios.post(
                `${API_BASE_URL}/message/send-text-message`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.error) {
                setMessages(prev =>
                    prev.map(msg =>
                        msg.message_id === tempMessageId
                            ? { ...msg, status: 'sent' }
                            : msg
                    )
                );

                if (dbAvailable) {
                    const sentMessage = { ...newMessage, status: 'sent' };
                    await dbHelper.addMessage(activeChat.number, sentMessage);
                    await dbHelper.saveChats([
                        {
                            number: activeChat.number,
                            name: activeChat.name,
                            is_favorite: activeChat.is_favorite || false,
                            wamid: '',
                            create_date: new Date().toISOString(),
                            type: 'out',
                            message_type: 'text',
                            message: text,
                            status: 'sent',
                            unique_id: tempMessageId,
                            last_id: Date.now(),
                            send_by_username: tokens?.username || '',
                            send_by_mobile: ''
                        }
                    ]);
                }

                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, tempMessageId, 'sent');
                }
            } else {
                const errMsg = response.data.error || response.data.msg || 'Failed to send message';
                toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send message');
                setMessages(prev =>
                    prev.map(msg =>
                        msg.message_id === tempMessageId
                            ? { ...msg, status: 'failed' }
                            : msg
                    )
                );
                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
                }
            }
        } catch (error) {
            const errMsg = error.response?.data?.error || error.response?.data?.msg || error.message || 'Failed to send message';
            toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send message');
            setMessages(prev =>
                prev.map(msg =>
                    msg.message_id === tempMessageId
                        ? { ...msg, status: 'failed' }
                        : msg
                )
            );
            if (onMessageStatusUpdate) {
                onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
            }
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Voice recording functions
    const startRecording = async () => {
        try {
            if (!navigator?.mediaDevices?.getUserMedia) {
                toast.error('Audio recording is not supported in this browser.');
                return;
            }

            // Clear any previously selected attachment (including older voice drafts)
            if (selectedFiles.length > 0) {
                revokeSelectedFilesUrls();
                setSelectedFiles([]);
            }

            recordingCancelledRef.current = false;

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            audioChunksRef.current = [];

            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                setMediaRecorder(null);

                const wasCancelled = recordingCancelledRef.current;
                recordingCancelledRef.current = false;

                setTimeout(() => {
                    const chunks = audioChunksRef.current;
                    audioChunksRef.current = [];

                    if (wasCancelled) {
                        setRecordingTime(0);
                        return;
                    }

                    if (!chunks.length) {
                        toast.error('No audio captured. Please try again.');
                        setRecordingTime(0);
                        return;
                    }

                    const mimeType = 'audio/webm;codecs=opus';
                    const audioBlob = new Blob(chunks, { type: mimeType });
                    const fileName = `voice_${Date.now()}.webm`;
                    let audioFile;

                    try {
                        audioFile = new File([audioBlob], fileName, { type: mimeType });
                    } catch {
                        audioFile = audioBlob;
                    }

                    const previewUrl = URL.createObjectURL(audioBlob);

                    setSelectedFiles([{
                        file: audioFile,
                        type: 'audio',
                        isVoiceRecording: true,
                        previewUrl,
                        displayName: fileName
                    }]);

                    toast.success('Voice recording ready. Tap send to share.');
                    setRecordingTime(0);
                }, 80);
            };

            recorder.onerror = (event) => {
                toast.error('Recording error: ' + event.error);
            };

            recorder.start();
            toast.success('Recording started! Tap mic again to stop.');

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                toast.error('Microphone permission denied. Please allow microphone access and try again.');
            } else if (error.name === 'NotFoundError') {
                toast.error('No microphone found. Please connect a microphone and try again.');
            } else {
                toast.error('Could not access microphone: ' + error.message);
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            recordingCancelledRef.current = false;
            mediaRecorder.stop();
            setIsRecording(false);

            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            toast.success('Recording stopped. Processing audio…');
        }
    };

    const cancelRecording = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            recordingCancelledRef.current = true;
            mediaRecorder.stop();
        }

        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];

        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        toast.info('Recording cancelled');
    };

    const handleMicClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };


    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, []);

    const openFileSelectModal = (fileType) => {
        setFileSelectModalType(fileType);
        setFilesInModal([]);
        setShowMediaModal(false);
        setShowFileSelectModal(true);
    };

    const fileMatchesModalType = (file, modalType) => {
        if (modalType === 'photo') return (file.type || '').startsWith('image/');
        if (modalType === 'video') return (file.type || '').startsWith('video/');
        if (modalType === 'audio') return (file.type || '').startsWith('audio/');
        if (modalType === 'document') {
            const ext = (file.name || '').toLowerCase().replace(/^.*\./, '');
            return ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'xls', 'pptx', 'ppt', 'zip', 'rar'].includes(ext);
        }
        return true;
    };

    const addFilesToModal = (files) => {
        const list = Array.from(files || []).filter((f) => f && fileMatchesModalType(f, fileSelectModalType));
        if (list.length === 0) return;
        const items = list.map((file) => {
            const item = {
                id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                file,
                type: fileSelectModalType,
                displayName: file.name,
                uploadStatus: 'pending',
                uploadedUrl: undefined,
                uploadError: undefined
            };
            if (fileSelectModalType === 'photo' || fileSelectModalType === 'video') {
                item.previewUrl = URL.createObjectURL(file);
            }
            if (fileSelectModalType === 'document') {
                item.documentName = file.name || '';
            }
            return item;
        });
        setFilesInModal((prev) => [...prev, ...items]);
    };

    const openFilePickerForModal = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = getFileAccept(fileSelectModalType);
        input.multiple = true;
        input.onchange = (e) => addFilesToModal(e.target.files);
        input.click();
    };

    const handleFileModalDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverFileModal(true);
    };

    const handleFileModalDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingOverFileModal(false);
    };

    const handleFileModalDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverFileModal(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) addFilesToModal(files);
    };

    const removeFileFromModal = (index) => {
        setFilesInModal((prev) => {
            const next = prev.filter((_, i) => i !== index);
            const item = prev[index];
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            return next;
        });
    };

    const setDocumentNameInModal = (index, value) => {
        setFilesInModal((prev) => prev.map((it, i) => i === index ? { ...it, documentName: value } : it));
    };

    const confirmFileSelectModal = () => {
        const successItems = filesInModal.filter((f) => f.uploadStatus === 'success');
        if (successItems.length === 0) return;
        setSelectedFiles(successItems.map((item) => ({
            type: item.type,
            displayName: item.displayName,
            previewUrl: item.previewUrl || (item.type === 'audio' && item.file ? URL.createObjectURL(item.file) : undefined),
            uploadedUrl: item.uploadedUrl,
            ...(item.type === 'document' && { documentName: item.documentName ?? '' })
        })));
        setShowFileSelectModal(false);
        setFilesInModal([]);
    };

    const getFileAccept = (fileType) => {
        switch (fileType) {
            case 'photo':
                return 'image/*';
            case 'video':
                return 'video/*';
            case 'audio':
                return 'audio/*';
            case 'document':
                return '.pdf,.doc,.docx,.txt,.xlsx,.pptx,.zip,.rar';
            default:
                return '*';
        }
    };

    const getFileTypeLabel = (fileType) => {
        switch (fileType) {
            case 'photo':
                return 'Photo';
            case 'video':
                return 'Video';
            case 'audio':
                return 'Audio';
            case 'document':
                return 'Document';
            default:
                return 'File';
        }
    };

    const uploadFileInModal = async (item) => {
        if (!item?.file || !tokens?.token || !tokens?.username) return;
        const fallbackFileName = item.file?.name || item.displayName || `attachment_${Date.now()}`;
        try {
            const { link: fileUrl } = await uploadFile(item.file, { filename: fallbackFileName });

            setFilesInModal((prev) => prev.map((it) => it.id === item.id ? { ...it, uploadStatus: 'success', uploadedUrl: fileUrl, uploadError: undefined } : it));
        } catch (error) {
            const errMsg = error.response?.data?.message || error.message || 'Upload failed';
            setFilesInModal((prev) => prev.map((it) => it.id === item.id ? { ...it, uploadStatus: 'error', uploadError: typeof errMsg === 'string' ? errMsg : 'Upload failed' } : it));
        }
    };

    useEffect(() => {
        if (!showFileSelectModal) return;
        const pending = filesInModal.filter((f) => f.uploadStatus === 'pending');
        if (pending.length === 0) return;
        setFilesInModal((prev) => prev.map((it) => it.uploadStatus === 'pending' ? { ...it, uploadStatus: 'uploading' } : it));
        pending.forEach((item) => uploadFileInModal(item));
    }, [showFileSelectModal, filesInModal.length]);

    const uploadAndSendOneFile = async (fileItem, optionalCaption = '') => {
        if (!fileItem || !activeChat) return;

        const tempMessageId = `temp_${Date.now()}`;
        const isVoiceRecording = Boolean(fileItem?.isVoiceRecording);
        const fileLabel = getFileTypeLabel(fileItem.type).toLowerCase();
        const attachmentMessage = isVoiceRecording ? '' : (optionalCaption || '');
        const isVoiceParam = isVoiceRecording ? 'true' : 'false';
        const fallbackFileName = fileItem.file?.name || fileItem.displayName || `attachment_${Date.now()}`;

        try {
            const { link: fileUrl } = await uploadFile(fileItem.file, {
                filename: fallbackFileName,
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadProgress(progress);
                },
            });

            const fileType = fileItem.type;
            const fileName = fileItem.file?.name || fileItem.displayName || fallbackFileName;
            const displayName = fileType === 'document' ? (fileItem.documentName ?? fileName) : fileName;

            const tempMessage = {
                id: Date.now().toString(),
                message_id: tempMessageId,
                type: 'out',
                message_type: fileType,
                message: attachmentMessage,
                media_url: fileUrl,
                media_name: displayName,
                status: 'pending',
                timestamp: Date.now(),
                send_by: 'You',
                chat_number: activeChat.number,
                create_date: new Date().toISOString(),
                is_voice: isVoiceRecording
            };

            setMessages(prev => [...prev, tempMessage]);
            shouldAutoScrollRef.current = true;
            if (onMessageStatusUpdate) {
                onMessageStatusUpdate(activeChat.number, tempMessageId, 'pending');
            }

            const messagePayload = {
                project_id: tokens.selected_project_id || '',
                message: isVoiceRecording ? '' : attachmentMessage,
                number: activeChat.number
            };
            if (fileType === 'photo') messagePayload.image_link = fileUrl;
            else if (fileType === 'video') messagePayload.video_link = fileUrl;
            else if (fileType === 'audio') {
                messagePayload.audio_link = fileUrl;
                messagePayload.is_voice = isVoiceParam;
            }
            else if (fileType === 'document') {
                messagePayload.document_link = fileUrl;
                messagePayload.document_name = fileItem.documentName ?? '';
            }

            let api_url = 'send-text-message';
            if (fileType === 'photo') api_url = 'send-image-message';
            else if (fileType === 'video') api_url = 'send-video-message';
            else if (fileType === 'audio') api_url = 'send-audio-message';
            else if (fileType === 'document') api_url = 'send-document-message';

            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            const messageResponse = await axios.post(
                `${API_BASE_URL}/message/${api_url}`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!messageResponse.data.error) {
                const serverWamid = messageResponse?.data?.wamid || '';
                const serverMessageId = messageResponse?.data?.message_id || '';
                const serverId = messageResponse?.data?.id || '';

                const sentMediaMessage = {
                    ...tempMessage,
                    status: 'sent',
                    message_id: serverMessageId || tempMessageId,
                    wamid: serverWamid,
                    id: serverId || tempMessage.id
                };

                if (dbAvailable) {
                    await dbHelper.addMessage(activeChat.number, sentMediaMessage);
                    await dbHelper.saveChats([
                        {
                            number: activeChat.number,
                            name: activeChat.name,
                            is_favorite: activeChat.is_favorite || false,
                            wamid: serverWamid,
                            create_date: tempMessage.create_date,
                            type: 'out',
                            message_type: fileType,
                            message: tempMessage.message,
                            status: 'sent',
                            unique_id: serverMessageId || tempMessageId,
                            last_id: serverId || Date.now(),
                            send_by_username: tokens?.username || '',
                            send_by_mobile: ''
                        }
                    ]);
                }
                setMessages(prev =>
                    prev.map(msg =>
                        msg.message_id === tempMessageId
                            ? { ...msg, ...sentMediaMessage }
                            : msg
                    )
                );

                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, serverMessageId || tempMessageId, 'sent');
                }
            } else {
                const errMsg = messageResponse.data.error || messageResponse.data.msg || 'Failed to send message';
                toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send message');
                setMessages(prev =>
                    prev.map(msg =>
                        msg.message_id === tempMessageId ? { ...msg, status: 'failed' } : msg
                    )
                );
                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
                }
            }
        } catch (error) {
            const errMsg = error.response?.data?.error || error.response?.data?.msg || error.message || 'Failed to send message';
            toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send message');
            setMessages(prev =>
                prev.map(msg =>
                    msg.message_id === tempMessageId ? { ...msg, status: 'failed' } : msg
                )
            );
            if (onMessageStatusUpdate) {
                onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
            }
        }
    };

    const sendMessageWithUploadedUrl = async (fileItem, optionalCaption = '') => {
        if (!fileItem?.uploadedUrl || !activeChat) return;

        const tempMessageId = `temp_${Date.now()}`;
        const isVoiceRecording = Boolean(fileItem?.isVoiceRecording);
        const fileUrl = fileItem.uploadedUrl;
        const fileType = fileItem.type;
        const attachmentMessage = isVoiceRecording ? '' : (optionalCaption || '');
        const isVoiceParam = isVoiceRecording ? 'true' : 'false';
        const fileName = fileItem.displayName || 'Attachment';
        const displayName = fileType === 'document' ? (fileItem.documentName ?? fileName) : fileName;

        const tempMessage = {
            id: Date.now().toString(),
            message_id: tempMessageId,
            type: 'out',
            message_type: fileType,
            message: attachmentMessage,
            media_url: fileUrl,
            media_name: displayName,
            status: 'pending',
            timestamp: Date.now(),
            send_by: 'You',
            chat_number: activeChat.number,
            create_date: new Date().toISOString(),
            is_voice: isVoiceRecording
        };

        setMessages(prev => [...prev, tempMessage]);
        shouldAutoScrollRef.current = true;
        if (onMessageStatusUpdate) {
            onMessageStatusUpdate(activeChat.number, tempMessageId, 'pending');
        }

        const messagePayload = {
            project_id: tokens.selected_project_id || '',
            message: isVoiceRecording ? '' : attachmentMessage,
            number: activeChat.number
        };
        if (fileType === 'photo') messagePayload.image_link = fileUrl;
        else if (fileType === 'video') messagePayload.video_link = fileUrl;
        else if (fileType === 'audio') {
            messagePayload.audio_link = fileUrl;
            messagePayload.is_voice = isVoiceParam;
        }
        else if (fileType === 'document') {
            messagePayload.document_link = fileUrl;
            messagePayload.document_name = fileItem.documentName ?? '';
        }

        let api_url = 'send-text-message';
        if (fileType === 'photo') api_url = 'send-image-message';
        else if (fileType === 'video') api_url = 'send-video-message';
        else if (fileType === 'audio') api_url = 'send-audio-message';
        else if (fileType === 'document') api_url = 'send-document-message';

        try {
            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            const messageResponse = await axios.post(
                `${API_BASE_URL}/message/${api_url}`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!messageResponse.data.error) {
                const serverWamid = messageResponse?.data?.wamid || '';
                const serverMessageId = messageResponse?.data?.message_id || '';
                const serverId = messageResponse?.data?.id || '';

                const sentMediaMessage = {
                    ...tempMessage,
                    status: 'sent',
                    message_id: serverMessageId || tempMessageId,
                    wamid: serverWamid,
                    id: serverId || tempMessage.id
                };

                if (dbAvailable) {
                    await dbHelper.addMessage(activeChat.number, sentMediaMessage);
                    await dbHelper.saveChats([
                        {
                            number: activeChat.number,
                            name: activeChat.name,
                            is_favorite: activeChat.is_favorite || false,
                            wamid: serverWamid,
                            create_date: tempMessage.create_date,
                            type: 'out',
                            message_type: fileType,
                            message: tempMessage.message,
                            status: 'sent',
                            unique_id: serverMessageId || tempMessageId,
                            last_id: serverId || Date.now(),
                            send_by_username: tokens?.username || '',
                            send_by_mobile: ''
                        }
                    ]);
                }
                setMessages(prev =>
                    prev.map(msg =>
                        msg.message_id === tempMessageId
                            ? { ...msg, ...sentMediaMessage }
                            : msg
                    )
                );

                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, serverMessageId || tempMessageId, 'sent');
                }
            } else {
                const errMsg = messageResponse.data.error || messageResponse.data.msg || 'Failed to send message';
                toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send message');
                setMessages(prev =>
                    prev.map(msg =>
                        msg.message_id === tempMessageId ? { ...msg, status: 'failed' } : msg
                    )
                );
                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
                }
            }
        } catch (error) {
            const errMsg = error.response?.data?.error || error.response?.data?.msg || error.message || 'Failed to send message';
            toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send message');
            setMessages(prev =>
                prev.map(msg =>
                    msg.message_id === tempMessageId ? { ...msg, status: 'failed' } : msg
                )
            );
            if (onMessageStatusUpdate) {
                onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
            }
        }
    };

    const revokeSelectedFilesUrls = () => {
        selectedFiles.forEach((item) => { if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    };

    const removeSelectedFile = () => {
        revokeSelectedFilesUrls();
        setSelectedFiles([]);
    };

    // Handle template use from preview
    const handleTemplateUse = (finalContent) => {
        setMessageInput(finalContent);
        setShowTemplatePreview(false);
        setSelectedTemplate(null);
    };

    // Send Template (append to conversation immediately with pending status and update on API response)
    const sendTemplateMessage = async (template, providedComponents = null, previewText = '') => {
        let tempMessageId = null;
        try {
            if (!tokens?.token || !tokens?.username || !activeChat?.number || !template?.id) {
                return;
            }

            // Build components if not provided
            let formattedComponents = providedComponents || [];
            if (!providedComponents || providedComponents.length === 0) {
                if (template.template_data?.components) {
                    template.template_data.components.forEach((component) => {
                        if (component.type === 'BODY' && component.text) {
                            const variableMatches = component.text.match(/\{\{\d+\}\}/g);
                            const parameters = [];
                            if (variableMatches) {
                                variableMatches.forEach((match, index) => {
                                    const exampleValue = component.example?.body_text?.[0]?.[index] || `Variable ${index + 1}`;
                                    parameters.push({ type: 'text', text: exampleValue });
                                });
                            }
                            formattedComponents.push({ type: 'body', parameters });
                        }
                    });
                }
            }

            // Resolve message body text for local echo
            let messageBody = previewText;
            const isAuthTemplate = String(template.category || template.template_data?.category || '').toUpperCase() === 'AUTHENTICATION';

            if (!messageBody && isAuthTemplate) {
                const bodyComp = template.template_data?.components?.find((c) => c.type === 'BODY');
                const params = formattedComponents.find((c) => (c.type || '').toLowerCase() === 'body')?.parameters || [];

                if (bodyComp?.text) {
                    let text = bodyComp.text;
                    const matches = text.match(/\{\{\d+\}\}/g) || [];
                    messageBody = matches.reduce((acc, ph, idx) => {
                        const val = params[idx]?.text || '';
                        return acc.replace(ph, val);
                    }, text);
                } else {
                    const bodyParam = params[0]?.text;
                    if (bodyParam) {
                        const hasSecurity = Boolean(bodyComp?.add_security_recommendation);
                        messageBody = `${bodyParam} is your verification code.`;
                        if (hasSecurity) {
                            messageBody += ' For your security, do not share this code.';
                        }
                    }
                }
            }

            if (!messageBody) {
                let content = '';
                if (template.template_data?.body) {
                    content = template.template_data.body;
                } else if (template.template_data?.components) {
                    const bodyComponent = template.template_data.components.find((c) => c.type === 'BODY');
                    content = bodyComponent?.text || '';
                }
                // Replace placeholders with parameter values if present
                const params = formattedComponents.find((c) => c.type === 'body')?.parameters || [];
                const matches = content.match(/\{\{\d+\}\}/g) || [];
                messageBody = matches.reduce((acc, ph, idx) => {
                    const val = params[idx]?.text || `Variable ${idx + 1}`;
                    return acc.replace(ph, val);
                }, content);
            }

            tempMessageId = `temp_${Date.now()}`;
            // Detect header media from providedComponents for local preview
            let headerMediaLink = '';
            let headerMediaType = '';
            const headerComp = (formattedComponents || []).find((c) => (c.type || '').toLowerCase() === 'header');
            if (headerComp && Array.isArray(headerComp.parameters) && headerComp.parameters.length > 0) {
                const p = headerComp.parameters[0];
                if (p?.type === 'image' && p.image?.link) { headerMediaType = 'image'; headerMediaLink = p.image.link; }
                if (p?.type === 'video' && p.video?.link) { headerMediaType = 'video'; headerMediaLink = p.video.link; }
                if (p?.type === 'document' && p.document?.link) { headerMediaType = 'document'; headerMediaLink = p.document.link; }
            }

            const templatePayload = template.template_data || template.template || {};

            const tempMessage = {
                id: Date.now().toString(),
                message_id: tempMessageId,
                type: 'out',
                message_type: headerMediaType || 'text',
                message: messageBody,
                is_template: true,
                status: 'pending',
                timestamp: Date.now(),
                send_by: 'You',
                chat_number: activeChat.number,
                create_date: new Date().toISOString(),
                media_url: headerMediaLink || '',
                media_name: headerMediaLink ? (headerMediaLink.split('/').pop() || 'File') : '',
                template: templatePayload,
                component: formattedComponents
            };

            setMessages((prev) => [...prev, tempMessage]);
            shouldAutoScrollRef.current = true;

            if (onMessageStatusUpdate) {
                onMessageStatusUpdate(activeChat.number, tempMessageId, 'pending');
            }

            // Send template via API
            const payload = {
                project_id: tokens.selected_project_id || '',
                number: activeChat.number,
                template_id: template.id,
                component: formattedComponents
            };

            console.log('Sending template with payload:', payload);

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });

            const response = await axios.post(
                `${API_BASE_URL}/message/send-template`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response?.data?.error) {
                const serverWamid = response?.data?.wamid || '';
                const serverMessageId = response?.data?.message_id || '';
                const serverId = response?.data?.id || '';

                const sentTemplateMessage = {
                    ...tempMessage,
                    message_id: serverMessageId || tempMessageId,
                    wamid: serverWamid,
                    id: serverId || tempMessage.id,
                    status: 'sent',
                    message: response?.data?.message || tempMessage.message,
                    template: response?.data?.template || tempMessage.template,
                    component: response?.data?.component || tempMessage.component,
                };

                if (dbAvailable) {
                    await dbHelper.addMessage(activeChat.number, sentTemplateMessage);
                    await dbHelper.saveChats([
                        {
                            number: activeChat.number,
                            name: activeChat.name,
                            is_favorite: activeChat.is_favorite || false,
                            wamid: serverWamid,
                            create_date: new Date().toISOString(),
                            type: 'out',
                            message_type: 'template',
                            message: messageBody,
                            status: 'sent',
                            unique_id: serverMessageId || serverWamid,
                            last_id: serverId || Date.now(),
                            send_by_username: tokens?.username || '',
                            send_by_mobile: ''
                        }
                    ]);
                }

                setMessages((prev) => prev.map((m) => (
                    m.message_id === tempMessageId
                        ? { ...m, ...sentTemplateMessage }
                        : m
                )));

                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, serverMessageId || tempMessageId, 'sent');
                }
            } else {
                const errMsg = response?.data?.error || response?.data?.msg || 'Failed to send template';
                toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send template');
                setMessages((prev) => prev.map((m) => (m.message_id === tempMessageId ? { ...m, status: 'failed' } : m)));
                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
                }
            }
        } catch (error) {
            const errMsg = error.response?.data?.error || error.response?.data?.msg || error.message || 'Failed to send template';
            toast.error(typeof errMsg === 'string' ? errMsg : 'Failed to send template');
            if (tempMessageId) {
                setMessages((prev) => prev.map((m) => (m.message_id === tempMessageId ? { ...m, status: 'failed' } : m)));
                if (onMessageStatusUpdate) {
                    onMessageStatusUpdate(activeChat.number, tempMessageId, 'failed');
                }
            }
        }
    };

    const closeFileSelectModal = () => {
        filesInModal.forEach((item) => { if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl); });
        setFilesInModal([]);
        setShowFileSelectModal(false);
        setPreviewFileItem(null);
        setIsDraggingOverFileModal(false);
    };

    const closePreviewOverlay = () => {
        if (previewFileItem?.type === 'audio' && previewFileItem?.previewUrl) URL.revokeObjectURL(previewFileItem.previewUrl);
        setPreviewFileItem(null);
    };

    const assignmentLoading = loadingChatNumber === activeChat?.number;
    const assignmentUsers = assignmentInfo?.users || [];
    const assignedUsername = assignmentInfo?.assigned_user?.username;
    const assignedUserName = assignmentInfo?.assigned_user?.name || assignmentInfo?.assigned_user?.username || assignmentInfo?.assigned_user?.mobile || 'Unassigned';
    const isAssigned = !assignmentLoading && assignmentInfo?.assigned === true;
    const isAssignedToMeOrChatAssignAccess = assignmentInfo?.assigned_to_me === true || projectInfo?.permissions?.chat_assign_access === true;

    return (
        <div className="flex h-full dark:bg-gray-900 w-full relative overflow-hidden" style={{ backgroundImage: "url('/wpbg.png')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            {/* Main conversation area - hidden when contact details is open (WhatsApp Web style: contact takes full window) */}
            <div className={`flex flex-col transition-all duration-300 shrink-0 ${showContactDetails ? 'w-0 min-w-0 overflow-hidden' : 'w-full'}`}>
                {/* Chat header */}
                <div className="flex items-center justify-between p-3 pt-1 sm:p-2 border-b dark:border-gray-700 bg-white dark:bg-gray-800 w-full">
                    {/* user profile name or number */}
                    <div
                        className="flex items-center space-x-2 sm:space-x-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-1 transition-colors"
                        onClick={() => {
                            setShowContactDetails(true);
                            fetchContactDetails(activeChat.number);
                            if (activeChat?.number) {
                                setCaseListSearch('');
                                setCaseListStatusFilter('');
                                setCaseListPageNo(1);
                                fetchCaseList(1, caseListLimit, { number: activeChat.number, search: '', status: 'open' });
                            }
                        }}
                    >
                        <button
                            className="md:hidden mr-1 text-gray-700 dark:text-gray-300 p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                onBack();
                            }}
                        >
                            <FiArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>

                        <div className="relative">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm sm:text-base">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            {activeChat.isFavorite && (
                                <div className="absolute -top-1 -right-1">
                                    <FiStar className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                                {displayName}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1 sm:space-x-2">
                        {
                            isAssignedToMeOrChatAssignAccess && (
                                <div className="relative flex">
                                    <button
                                        ref={assignMenuButtonRef}
                                        onClick={() => setShowAssignMenu((prev) => !prev)}
                                        className="flex items-center space-x-2 sm:space-x-3 text-left text-sm text-gray-800 transition bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/60 dark:text-gray-100 dark:hover:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-700"
                                    >
                                        <div
                                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isAssigned
                                                ? (assignmentInfo?.assigned_to_me
                                                    ? 'bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-200'
                                                    : 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-200')
                                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-200'
                                                }`}
                                        >
                                            {assignActionLoading ? (
                                                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                (isAssigned ? <FiUserCheck className="h-4 w-4" /> : <FiUserPlus className="h-4 w-4" />)
                                            )}
                                        </div>
                                        <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap pr-1 sm:pr-2">Chat Assign</span>
                                    </button>

                                    <AnimatePresence>
                                        {showAssignMenu && (
                                            <motion.div
                                                key="conversation-assign-menu"
                                                ref={assignMenuRef}
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                                className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 z-40"
                                            >
                                                <div className="px-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                                                    <p className="font-semibold text-sm text-gray-900 dark:text-white">Assign chat</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Select an agent or unassign this chat.</p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        Current: {assignmentLoading ? 'Loading...' : (isAssigned ? assignedUserName : 'Unassigned')}
                                                    </p>
                                                </div>

                                                {isAssigned && assignmentInfo?.assigned_to_me && (
                                                    <button
                                                        onClick={() => handleAssignmentChange('unassign')}
                                                        disabled={assignActionLoading}
                                                        className={`flex w-full items-center space-x-3 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/30 border-b border-gray-200 dark:border-gray-700 ${assignActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                    >
                                                        <div className="flex-1">
                                                            <p className="font-semibold">Unassign chat</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">Make this chat available</p>
                                                        </div>
                                                    </button>
                                                )}

                                                <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                                                    {assignmentUsers.length === 0 && (
                                                        <p className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">No agents found for assignment.</p>
                                                    )}

                                                    {assignmentUsers.map((user) => {
                                                        const isActive = assignedUsername === user.username;
                                                        return (
                                                            <button
                                                                key={user.username}
                                                                onClick={() => handleAssignmentChange('assign', user.username)}
                                                                disabled={assignActionLoading || isActive}
                                                                className={`flex w-full items-center space-x-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 ${assignActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                            >
                                                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                                                    <FiUser className="h-4 w-4" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="font-semibold">
                                                                        {user.name || user.username || 'Unknown'}
                                                                        {user.is_me && <span className="ml-1 text-[11px] text-green-600 dark:text-green-300">(You)</span>}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {user.email || user.mobile || user.username}
                                                                    </p>
                                                                </div>
                                                                {isActive && <FiCheck className="h-4 w-4 text-green-500" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        }

                        {/* Case status icon - open/closed (after assign icon); click opens case list modal */}
                        {activeChat?.number && (
                            <button
                                type="button"
                                onClick={openCaseListModal}
                                className="flex items-center space-x-2 sm:space-x-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500"
                                title={caseStatusLoading ? 'Loading case status...' : (caseStatus ?? 0) > 0 ? `Open case (${caseStatus}) (click to view list)` : caseStatus === 0 ? 'No open case (click to view list)' : 'Case status (click to view list)'}
                            >
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${caseStatusLoading ? 'bg-gray-50 dark:bg-gray-700/60' : (caseStatus ?? 0) > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-200' : caseStatus === 0 ? 'bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-50 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400'
                                    }`}>
                                    {caseStatusLoading ? (
                                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (caseStatus ?? 0) > 0 ? (
                                        <FiAlertCircle className="h-4 w-4" />
                                    ) : caseStatus === 0 ? (
                                        <FiCheckCircle className="h-4 w-4" />
                                    ) : (
                                        <FiInfo className="h-4 w-4" />
                                    )}
                                </div>
                                <span className="hidden sm:inline text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap pr-1 sm:pr-2">
                                    {caseStatusLoading ? 'Case' : (caseStatus ?? 0) > 0 ? `Case Open (${caseStatus})` : caseStatus === 0 ? 'Case Closed' : 'Case'}
                                </span>
                            </button>
                        )}

                        <div className="relative flex">
                            <button
                                ref={headerMenuButtonRef}
                                onClick={() => setShowHeaderMenu((prev) => !prev)}
                                className="p-1 sm:p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg"
                                aria-label="Conversation options"
                            >
                                <FiMoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>

                            <AnimatePresence>
                                {showHeaderMenu && (
                                    <motion.div
                                        key="conversation-header-menu"
                                        ref={headerMenuRef}
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.18, ease: 'easeOut' }}
                                        className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 z-30"
                                    >
                                        <button
                                            onClick={handleContactMenuClick}
                                            className="flex w-full items-center space-x-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                        >
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                                                <FiEdit2 className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold">{contactDetails?.has_contact ? 'Edit contact' : 'Save contact'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{contactDetails?.has_contact ? 'Update contact details' : 'Add contact to your list'}</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={handleSearchMenuClick}
                                            className="flex w-full items-center space-x-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                        >
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300">
                                                <FiSearch className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold">Search</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Search in this conversation</p>
                                            </div>
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 dark:bg-gray-900 w-full">
                    {(loadingHistory || loadingChatNumber) ? (
                        <div className="flex flex-col items-center justify-center min-h-[200px] py-12 sm:py-16">
                            <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-2 border-blue-500 border-t-transparent"></div>
                            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading conversation...</p>
                        </div>
                    ) : (
                        <>
                            {/* Loading indicator for previous messages */}
                            {loadingPrevious && (
                                <div className="flex items-center justify-center py-3 sm:py-4">
                                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-500"></div>
                                    <span className="ml-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">Loading previous messages...</span>
                                </div>
                            )}

                            {groupMessagesByDate(messages.filter((m) => m.id != null && m.id !== '')).map((dateGroup, groupIndex) => (
                                <div key={dateGroup.date}>
                                    {/* Date Separator */}
                                    <DateSeparator displayDate={dateGroup.displayDate} dateId={`date-separator-${dateGroup.date}`} />

                                    {/* Messages for this date */}
                                    <div className="space-y-3 sm:space-y-4">
                                        {dateGroup.messages.map((msg) => {
                                            const messageKey = getMessageKey(msg);
                                            return (
                                                <MessageItem
                                                    key={messageKey}
                                                    messageKey={messageKey}
                                                    highlightedMessageId={highlightedMessageId}
                                                    msg={msg}
                                                    activeChat={activeChat}
                                                    displayName={displayName}
                                                    darkMode={darkMode}
                                                    renderFilePreview={renderFilePreview}
                                                    formatTime={formatTime}
                                                    onReply={(message) => {
                                                        setReplyingToMessage(message);
                                                        // Focus the input field after a short delay to ensure UI is ready
                                                        setTimeout(() => {
                                                            messageInputRef.current?.focus();
                                                        }, 50);
                                                    }}
                                                    allMessages={messages}
                                                    onScrollToMessage={handleScrollToMessage}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {isUploading && (
                                <div className="flex justify-end w-full mt-3 sm:mt-4">
                                    <div className="max-w-[80%] p-3 sm:p-4 rounded-2xl bg-blue-500 text-white rounded-br-md">
                                        <div className="flex items-center space-x-2 sm:space-x-3">
                                            <div className="w-4 h-4 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <div className="flex-1">
                                                <p className="text-xs sm:text-sm font-medium">Uploading file...</p>
                                                <div className="w-full bg-white bg-opacity-30 rounded-full h-1.5 sm:h-2 mt-1 sm:mt-2">
                                                    <div
                                                        className="bg-white h-1.5 sm:h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs mt-0.5 sm:mt-1 opacity-90">{uploadProgress}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Selected File Preview */}
                {selectedFile && (
                    <div className="px-3 sm:px-4 py-2 sm:py-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800 w-full">
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                                        {selectedFile.type === 'photo' && <FiImage className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />}
                                        {selectedFile.type === 'video' && <FiVideo className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />}
                                        {selectedFile.type === 'audio' && <FiMusic className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />}
                                        {selectedFile.type === 'document' && <FiFile className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {selectedFile.file?.name || selectedFile.displayName || 'Attachment'}
                                        </p>
                                        <p className="text-xs text-gray-600 dark:text-gray-300">
                                            {getFileTypeLabel(selectedFile.type)}
                                            {selectedFile.file?.size ? ` • ${(selectedFile.file.size / 1024 / 1024).toFixed(2)} MB` : ''}
                                            {selectedFiles.length > 1 ? ` • ${selectedFiles.length} files` : ''}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={removeSelectedFile}
                                    className="p-1 sm:p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            </div>

                            {selectedFile.type === 'audio' && selectedFile.previewUrl && (
                                <div className="p-2 sm:p-3 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                    <audio
                                        controls
                                        className="w-full"
                                        src={selectedFile.previewUrl}
                                    >
                                        Your browser does not support the audio element.
                                    </audio>
                                    {selectedFile.isVoiceRecording && (
                                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                                            Voice recording ready. Tap send to share.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Recording Indicator */}
                {isRecording && (
                    <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-600 dark:text-red-400 text-sm font-medium">
                                    Recording... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                            <button
                                onClick={cancelRecording}
                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Reply Preview */}
                {replyingToMessage && (
                    <div className="px-3 sm:px-4 py-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 w-full">
                        <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-xl border-l-4 border-blue-500 gap-3">
                            {/* Media Thumbnail */}
                            {(() => {
                                const replyMsg = replyingToMessage;
                                const msgType = (replyMsg.message_type || '').toLowerCase();
                                const mediaUrl = replyMsg.media_url;

                                if ((msgType === 'image' || msgType === 'photo') && mediaUrl) {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600">
                                            <img
                                                src={mediaUrl}
                                                alt="Reply"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                    );
                                }
                                if (msgType === 'video') {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center relative">
                                            <FiVideo className="w-6 h-6 text-white" />
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-5 h-5 bg-white/80 rounded-full flex items-center justify-center">
                                                    <FiPlay className="w-3 h-3 text-gray-800 ml-0.5" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                if (msgType === 'audio') {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                                            <FiMic className="w-6 h-6 text-white" />
                                        </div>
                                    );
                                }
                                if (msgType === 'document') {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                            <FiFile className="w-6 h-6 text-red-500" />
                                        </div>
                                    );
                                }
                                if (msgType === 'location') {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                            <FiMapPin className="w-6 h-6 text-blue-500" />
                                        </div>
                                    );
                                }
                                if (msgType === 'contact' || msgType === 'contacts') {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                            <FiUser className="w-6 h-6 text-purple-500" />
                                        </div>
                                    );
                                }
                                if (msgType === 'sticker') {
                                    return (
                                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                            <span className="text-2xl">🎭</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Text content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-0.5">
                                    <FiCornerUpLeft className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                        Replying to {replyingToMessage.type === 'out' ? 'yourself' : (displayName || activeChat?.name || 'Contact')}
                                    </p>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1 flex items-center gap-1">
                                    {(() => {
                                        const replyMsg = replyingToMessage;
                                        const msgType = (replyMsg.message_type || '').toLowerCase();

                                        if (msgType === 'image' || msgType === 'photo') {
                                            return (
                                                <>
                                                    <FiImage className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                    <span>{replyMsg.message || 'Photo'}</span>
                                                </>
                                            );
                                        }
                                        if (msgType === 'video') {
                                            return (
                                                <>
                                                    <FiVideo className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                    <span>{replyMsg.message || 'Video'}</span>
                                                </>
                                            );
                                        }
                                        if (msgType === 'audio') {
                                            return (
                                                <>
                                                    <FiMic className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                    <span>{replyMsg.is_voice ? 'Voice message' : 'Audio'}</span>
                                                </>
                                            );
                                        }
                                        if (msgType === 'document') {
                                            return (
                                                <>
                                                    <FiFile className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                    <span>{replyMsg.media_name || replyMsg.message || 'Document'}</span>
                                                </>
                                            );
                                        }
                                        if (msgType === 'location') {
                                            return (
                                                <>
                                                    <FiMapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                    <span>Location</span>
                                                </>
                                            );
                                        }
                                        if (msgType === 'contact' || msgType === 'contacts') {
                                            return (
                                                <>
                                                    <FiUser className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                                    <span>Contact</span>
                                                </>
                                            );
                                        }
                                        if (msgType === 'sticker') {
                                            return <span>Sticker</span>;
                                        }

                                        // Template message
                                        if (replyMsg.is_template && replyMsg.template) {
                                            const text = buildTemplateDisplayMessage(replyMsg.template, replyMsg.component);
                                            if (text) {
                                                return <span>{text}</span>;
                                            }
                                            return <span>Template message</span>;
                                        }

                                        // Text message
                                        if (replyMsg.message) {
                                            return <span>{replyMsg.message}</span>;
                                        }

                                        return <span>Message</span>;
                                    })()}
                                </div>
                            </div>

                            {/* Close button */}
                            <button
                                onClick={() => setReplyingToMessage(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                            >
                                <FiX className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Input Area */}

                <div className="p-2 sm:p-4 border-t dark:border-gray-800 bg-white dark:bg-gray-900 w-full">
                    <div className="max-w-6xl mx-auto relative">

                        {/* --- Input Row --- */}
                        <div className={`flex items-end space-x-2 ${isComposerBlocked || needsUnassignedPrompt ? 'filter blur-[2px] pointer-events-none select-none' : ''}`}>

                            {/* 1. Attachment Button */}
                            <button
                                onClick={() => setShowMediaModal(true)}
                                className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                                title="Attach file"
                            >
                                <FiPaperclip className="w-5 h-5" />
                            </button>

                            {/* 2. Main Input Pill */}
                            <div className="flex-1 flex items-end bg-gray-100 dark:bg-gray-800 rounded-[24px] border border-transparent  focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-200">

                                {/* Emoji Trigger */}
                                <button
                                    ref={emojiButtonRef}
                                    onMouseDown={handleEmojiButtonMouseDown}
                                    onClick={handleEmojiButtonClick}
                                    className="p-3 text-gray-500 hover:text-blue-500 transition-colors hidden sm:block"
                                >
                                    <FiSmile className="w-5 h-5" />
                                </button>

                                {/* Textarea */}
                                <textarea
                                    autoFocus
                                    autoComplete="off"
                                    placeholder="Type a message..."
                                    className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none outline-none py-3 px-3 sm:px-1 text-gray-900 dark:text-white text-[15px] leading-relaxed resize-none max-h-[150px] custom-scrollbar"
                                    style={{ outline: 'none', boxShadow: 'none' }}
                                    rows={1}
                                    value={messageInput}
                                    ref={messageInputRef}
                                    onChange={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                        setMessageInput(e.target.value);
                                        updateSelectionFromInput();
                                    }}
                                    onFocus={handleComposerFocus}
                                    onBlur={handleComposerBlur}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                    disabled={isUploading || loadingHistory || !!loadingChatNumber}
                                />

                                {/* Inside-Right Actions (Mic & Templates) - Hide when typing */}
                                {!messageInput.trim() && (
                                    <div className="flex items-center pr-2 pb-1.5">
                                        <button
                                            onClick={handleMicClick}
                                            className={`p-2 rounded-full transition-colors ${isRecording ? 'text-red-500 animate-pulse bg-red-50 dark:bg-red-900/20' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <FiMic className="w-5 h-5" />
                                        </button>

                                        <button
                                            onClick={() => {
                                                setShowTemplateModal(true);
                                                if (!contactDetails && activeChat?.number && tokens?.token) {
                                                    fetchContactDetails(activeChat.number);
                                                }
                                            }}
                                            className="p-2 text-gray-500 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-all"
                                            title="Templates"
                                        >
                                            <FiLayers className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* 3. Send Button - Only show when there's content to send */}
                            {(messageInput.trim() || selectedFiles.length > 0) && (
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isUploading || loadingHistory || !!loadingChatNumber}
                                    className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 bg-blue-600 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95 animate-in fade-in zoom-in"
                                >
                                    <LuSendHorizontal className="w-5 h-5 translate-x-0.5" />
                                </button>
                            )}
                        </div>

                        {/* --- Popovers & Overlays --- */}
                        <EmojiPickerPopover
                            open={showEmojiPicker}
                            onEmojiClick={(emojiData) => handleEmojiSelect(emojiData.emoji)}
                            onClose={() => {
                                setShowEmojiPicker(false);
                                restoreMessageInputFocus();
                            }}
                            anchorRef={emojiButtonRef}
                            darkMode={darkMode}
                        />

                        {/* Blocked State Overlay */}
                        {isComposerBlocked && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-[1px] rounded-xl">
                                <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-xl rounded-2xl p-4 flex flex-col items-center animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center text-amber-600 dark:text-amber-500 mb-1">
                                        <FiAlertCircle className="w-5 h-5 mr-2" />
                                        <span className="font-semibold text-sm">Chat Assigned to {assignmentInfo?.assigned_user?.name ?? 'Another agent'}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Request reassignment to send messages.</p>
                                </div>
                            </div>
                        )}

                        {/* Unassigned State Overlay */}
                        {needsUnassignedPrompt && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px]">
                                <button
                                    onClick={() => setHasAcknowledgedUnassigned(true)}
                                    className="group flex items-center space-x-3 bg-green-500 hover:bg-green-600 text-white px-6 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95"
                                >
                                    <span className="text-sm font-bold tracking-wide">CLAIM & CONTINUE</span>
                                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                        →
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <ContactFormModal
                    isOpen={showContactModal}
                    onClose={handleCloseContactModal}
                    initialData={contactForm}
                    isExisting={Boolean(existingContactId)}
                    onSubmit={handleContactSave}
                    loading={contactLoading}
                    submitting={contactSubmitting}
                    error={contactError}
                    darkMode={darkMode}
                />

                <SearchChatModal
                    isOpen={searchModalOpen}
                    onClose={handleCloseSearchModal}
                    query={searchQuery}
                    onQueryChange={handleSearchQueryChange}
                    results={searchResults}
                    onResultClick={handleSearchResultClick}
                    onDateClick={handleDateClick}
                />

                {/* Media Selection Modal - inline to avoid re-mount flicker */}
                <AnimatePresence>
                    {showMediaModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 w-full max-w-xs sm:max-w-md"
                            >
                                <div className="flex justify-between items-center mb-4 sm:mb-6">
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                                        Send Media
                                    </h3>
                                    <button
                                        onClick={() => setShowMediaModal(false)}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    {[
                                        { type: 'photo', icon: FiImage, label: 'Photo', color: 'bg-green-500' },
                                        { type: 'video', icon: FiVideo, label: 'Video', color: 'bg-purple-500' },
                                        { type: 'audio', icon: FiMusic, label: 'Audio', color: 'bg-blue-500' },
                                        { type: 'document', icon: FiFile, label: 'Document', color: 'bg-orange-500' }
                                    ].map((item) => {
                                        const IconComponent = item.icon;
                                        return (
                                            <button
                                                key={item.type}
                                                onClick={() => openFileSelectModal(item.type)}
                                                className="flex flex-col items-center p-3 sm:p-4 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 hover:scale-105"
                                            >
                                                <div className={`w-8 h-8 sm:w-10 sm:h-10 ${item.color} rounded-lg flex items-center justify-center mb-2 sm:mb-3`}>
                                                    <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                                </div>
                                                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                                                    {item.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* File Select Modal - inline to avoid re-mount flicker */}
                <AnimatePresence>
                    {showFileSelectModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className={`relative bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[85vh] flex flex-col transition-colors ${isDraggingOverFileModal ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900 bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                onDragOver={handleFileModalDragOver}
                                onDragLeave={handleFileModalDragLeave}
                                onDrop={handleFileModalDrop}
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                                        Select {getFileTypeLabel(fileSelectModalType)}
                                    </h3>
                                    <button
                                        onClick={closeFileSelectModal}
                                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={openFilePickerForModal}
                                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium mb-2"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Add files
                                </button>
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">or drag and drop files here</p>
                                {isDraggingOverFileModal && (
                                    <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 flex items-center justify-center z-10 pointer-events-none">
                                        <span className="text-blue-600 dark:text-blue-300 font-medium">Drop files here</span>
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto min-h-0">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {filesInModal.map((item, index) => (
                                            <div
                                                key={item.id}
                                                className={`relative rounded-xl border overflow-hidden group ${item.uploadStatus === 'error' ? 'border-red-400 dark:border-red-500 bg-red-50/50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'}`}
                                            >
                                                <div className="aspect-square flex items-center justify-center bg-gray-100 dark:bg-gray-700 relative">
                                                    {item.previewUrl && (fileSelectModalType === 'photo' || fileSelectModalType === 'video') ? (
                                                        fileSelectModalType === 'photo' ? (
                                                            <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <video src={item.previewUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                                        )
                                                    ) : (
                                                        <div className="text-gray-400 dark:text-gray-500">
                                                            {fileSelectModalType === 'audio' && <FiMusic className="w-10 h-10" />}
                                                            {fileSelectModalType === 'document' && <FiFile className="w-10 h-10" />}
                                                        </div>
                                                    )}
                                                    {item.uploadStatus === 'uploading' && (
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    )}
                                                    {item.uploadStatus === 'success' && (
                                                        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                                            <FiCheck className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="p-2 text-xs text-gray-700 dark:text-gray-300 truncate" title={item.displayName}>{item.displayName}</p>
                                                {fileSelectModalType === 'document' && (
                                                    <div className="px-2 pb-2">
                                                        <input
                                                            type="text"
                                                            value={item.documentName ?? ''}
                                                            onChange={(e) => setDocumentNameInModal(index, e.target.value)}
                                                            placeholder="Document name (optional)"
                                                            className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400"
                                                        />
                                                    </div>
                                                )}
                                                {item.uploadStatus === 'error' && item.uploadError && (
                                                    <p className="px-2 pb-2 text-xs text-red-600 dark:text-red-400" title={item.uploadError}>{item.uploadError}</p>
                                                )}
                                                <div className="absolute top-1 right-1 flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const forPreview = { ...item, index };
                                                            if (item.type === 'audio' && item.file) forPreview.previewUrl = URL.createObjectURL(item.file);
                                                            setPreviewFileItem(forPreview);
                                                        }}
                                                        disabled={item.uploadStatus === 'uploading'}
                                                        className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        title="Preview"
                                                    >
                                                        <FiEye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFileFromModal(index)}
                                                        className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-600"
                                                        title="Remove"
                                                    >
                                                        <FiTrash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={confirmFileSelectModal}
                                        disabled={filesInModal.length === 0 || filesInModal.some((f) => f.uploadStatus !== 'success')}
                                        className="px-4 py-2 rounded-xl bg-blue-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
                                    >
                                        Done
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Case List Modal - table + pagination (Transactions style) */}
                <AnimatePresence>
                    {showCaseListModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                            >
                                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Case List</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={openCaseCreateModal}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                        >
                                            <FiPlus className="w-4 h-4" />
                                            Create case
                                        </button>
                                        <button
                                            onClick={() => setShowCaseListModal(false)}
                                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                            aria-label="Close"
                                        >
                                            <FiX className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                {/* Filters */}
                                <div className="px-6 py-3 flex flex-wrap items-center gap-3 border-b border-gray-100 dark:border-gray-700">
                                    <input
                                        type="text"
                                        placeholder="Search by name..."
                                        value={caseListSearch}
                                        onChange={(e) => setCaseListSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchCaseList(1, caseListLimit, { search: caseListSearch, status: caseListStatusFilter })}
                                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-56"
                                    />
                                    <SearchableSelect
                                        value={caseListStatusFilter}
                                        onChange={(e) => {
                                            setCaseListStatusFilter(e.target.value);
                                            fetchCaseList(1, caseListLimit, { search: caseListSearch, status: e.target.value });
                                        }}
                                        options={[
                                            { value: '', label: 'All status' },
                                            { value: 'open', label: 'Open' },
                                            { value: 'closed', label: 'Closed' },
                                        ]}
                                        placeholder="All status"
                                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fetchCaseList(1, caseListLimit, { search: caseListSearch, status: caseListStatusFilter })}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        Search
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto min-h-0">
                                    {caseListError && (
                                        <div className="px-6 py-4 text-sm text-red-600 dark:text-red-400">{caseListError}</div>
                                    )}
                                    {caseListLoading ? (
                                        <table className="w-full">
                                            <thead><tr>{['#', 'Name', 'Create date', 'Status', ''].map((label) => <th key={label || 'actions'} className="px-6 py-4 text-left text-xs font-semibold text-gray-500">{label}</th>)}</tr></thead>
                                            <tbody><TableSkeletonRows rows={6} cells={['index', 'text', 'short', 'badge', 'action']} /></tbody>
                                        </table>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full divide-y divide-gray-200 dark:divide-gray-600">
                                                <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30">
                                                    <tr>
                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">#</th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">Name</th>
                                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">Create date</th>
                                                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">Status</th>
                                                        <th className="w-16 px-3 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                                    {caseList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="px-6 py-12 text-center">
                                                                <div className="flex flex-col items-center justify-center gap-3">
                                                                    <p className="text-gray-500 dark:text-gray-400 font-medium">No cases found</p>
                                                                    <p className="text-gray-400 dark:text-gray-500 text-sm">Try adjusting filters or search.</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        caseList.map((row, index) => {
                                                            const createDate = row.created_at ?? row.create_date ?? row.created_date ?? row.createdAt;
                                                            const createDateStr = createDate ? (typeof createDate === 'string' ? new Date(createDate) : new Date(createDate)).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                                                            return (
                                                                <tr key={row.id ?? index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                    <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-center text-sm text-gray-700 dark:text-gray-300">
                                                                        {(caseListPageNo - 1) * caseListLimit + index + 1}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-white">{row.name ?? '—'}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">{createDateStr}</td>
                                                                    <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-center">
                                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${row.status === true || row.status === '1' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-200'}`}>
                                                                            {row.status === true || row.status === '1' ? 'Open' : 'Closed'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-4 text-right">
                                                                        <RowActionMenu
                                                                            items={[
                                                                                { label: 'Details', icon: <FiEye className="w-4 h-4" />, onClick: () => setCaseDetail(row) },
                                                                                { label: 'Edit', icon: <FiEdit2 className="w-4 h-4" />, onClick: () => openCaseEditModal(row) },
                                                                            ]}
                                                                        />
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                                {!caseListLoading && caseList.length > 0 && (
                                    <Pagination
                                        currentPage={caseListPageNo}
                                        totalPages={caseListTotalPage}
                                        totalRecords={caseListTotal}
                                        pageSize={caseListLimit}
                                        onPageChange={handleCaseListPageChange}
                                        onPageSizeChange={handleCaseListPageSizeChange}
                                        pageSizeOptions={[10, 20, 50, 100]}
                                        showPageSizeSelector={true}
                                        showGoToPage={true}
                                    />
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <RecordDetailsModal
                    isOpen={Boolean(caseDetail)}
                    onClose={() => setCaseDetail(null)}
                    title={caseDetail?.name || 'Case'}
                    fields={caseDetail ? [
                        { label: 'Remark', value: caseDetail.remark },
                        { label: 'Status', value: caseDetail.status === true || caseDetail.status === '1' ? 'Open' : 'Closed' },
                        { label: 'Created', value: caseDetail.created_at || caseDetail.create_date || '' },
                    ] : []}
                />

                {/* Edit Case Modal - on top of case list modal, does not close case list */}
                <AnimatePresence>
                    {showCaseEditModal && caseEditRow && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
                            >
                                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit case</h3>
                                    <button
                                        type="button"
                                        onClick={closeCaseEditModal}
                                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        aria-label="Close"
                                    >
                                        <FiX className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="px-6 py-4 space-y-4">
                                    {caseEditError && (
                                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{caseEditError}</div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={caseEditName}
                                            onChange={(e) => setCaseEditName(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Case name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remark</label>
                                        <textarea
                                            value={caseEditRemark}
                                            onChange={(e) => setCaseEditRemark(e.target.value)}
                                            rows={3}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                            placeholder="Remark"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                        <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                            <button
                                                type="button"
                                                onClick={() => setCaseEditStatus('open')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseEditStatus === 'open' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                            >
                                                Open
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCaseEditStatus('closed')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseEditStatus === 'closed' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                            >
                                                Closed
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={closeCaseEditModal}
                                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={fetchEditCase}
                                        disabled={caseEditLoading}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {caseEditLoading ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Saving...
                                            </span>
                                        ) : (
                                            'Save'
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Create Case Modal - same layout as Edit Case */}
                <AnimatePresence>
                    {showCaseCreateModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
                            >
                                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create case</h3>
                                    <button
                                        type="button"
                                        onClick={closeCaseCreateModal}
                                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        aria-label="Close"
                                    >
                                        <FiX className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="px-6 py-4 space-y-4">
                                    {caseCreateError && (
                                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{caseCreateError}</div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={caseCreateName}
                                            onChange={(e) => setCaseCreateName(e.target.value)}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Case name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remark</label>
                                        <textarea
                                            value={caseCreateRemark}
                                            onChange={(e) => setCaseCreateRemark(e.target.value)}
                                            rows={3}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                            placeholder="Remark"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                        <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                            <button
                                                type="button"
                                                onClick={() => setCaseCreateStatus('open')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseCreateStatus === 'open' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                            >
                                                Open
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCaseCreateStatus('closed')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseCreateStatus === 'closed' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                                            >
                                                Closed
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={closeCaseCreateModal}
                                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={fetchCreateCase}
                                        disabled={caseCreateLoading}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {caseCreateLoading ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Creating...
                                            </span>
                                        ) : (
                                            'Create'
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Preview Overlay - inline to avoid re-mount flicker */}
                {previewFileItem && (
                    <div
                        className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4"
                        onClick={closePreviewOverlay}
                    >
                        <div className="max-w-full max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}>
                            {previewFileItem.type === 'photo' && previewFileItem.previewUrl && <img src={previewFileItem.previewUrl} alt="" className="max-h-[90vh] rounded-lg" />}
                            {previewFileItem.type === 'video' && previewFileItem.previewUrl && <video src={previewFileItem.previewUrl} controls className="max-h-[90vh] rounded-lg" />}
                            {previewFileItem.type === 'audio' && previewFileItem.previewUrl && (
                                <audio src={previewFileItem.previewUrl} controls className="rounded-lg" />
                            )}
                            {previewFileItem.type === 'document' && (
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-gray-700 dark:text-gray-300">
                                    <FiFile className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                    <p className="font-medium">{previewFileItem.displayName}</p>
                                    <p className="text-sm text-gray-500">Document preview not available</p>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={closePreviewOverlay}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                        >
                            <FiX className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Template Selection Modal */}
                <ChatTemplateModal
                    isOpen={showTemplateModal}
                    onClose={() => setShowTemplateModal(false)}
                    tokens={tokens}
                    onTemplatePreview={handleTemplatePreview}
                    darkMode={darkMode}
                    activeChat={activeChat}
                    contactDetails={contactDetails}
                    onSendTemplate={sendTemplateMessage}
                />

                {/* Template Preview Modal */}
                <TemplatePreview
                    isOpen={showTemplatePreview}
                    onClose={() => {
                        setShowTemplatePreview(false);
                        setSelectedTemplate(null);
                    }}
                    selectedTemplate={selectedTemplate}
                    darkMode={darkMode}
                    onUseTemplate={handleTemplateUse}
                    tokens={tokens}
                    activeChat={activeChat}
                    contactDetails={contactDetails}
                    onSendTemplate={sendTemplateMessage}
                    onCloseAll={() => {
                        // Close both Preview and Template selection modal after successful send
                        setShowTemplatePreview(false);
                        setSelectedTemplate(null);
                        setShowTemplateModal(false);
                    }}
                />
            </div>

            {/* Chat Info Panel - full width when open (Contact + Chat Assign + Case table) */}
            <AnimatePresence>
                {showContactDetails && (
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="absolute inset-0 left-0 right-0 top-0 bottom-0 z-10 flex flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700"
                    >
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0 shadow-sm">
                            <div className="min-w-0">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                    Chat Info
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5 truncate">
                                    <span className="truncate">
                                        {contactDetails?.has_contact
                                            ? `${contactDetails.contact.name} · ${contactDetails.contact.number}`
                                            : `${activeChat?.number || 'Unknown'}`
                                        }
                                    </span>
                                    {contactDetailsLoading && (
                                        <span className="inline-block h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                    )}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowContactDetails(false)}
                                className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
                                aria-label="Close"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="p-5 space-y-5">
                            {contactDetailsLoading && !contactDetails ? (
                                <section className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                                    <div className="flex items-center justify-center py-16">
                                        <div className="h-10 w-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                </section>
                            ) : contactDetailsError ? (
                                <section className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-800 p-8 text-center shadow-sm">
                                    <FiAlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500 dark:text-red-400" />
                                    <p className="text-red-600 dark:text-red-300 text-sm mb-5">{contactDetailsError}</p>
                                    <button
                                        onClick={() => fetchContactDetails(activeChat?.number)}
                                        className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                                    >
                                        Retry
                                    </button>
                                </section>
                            ) : (
                                    <section className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                                        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                                                <FiUser className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Contact Details</h4>
                                        </div>
                                        <div className="p-5">
                                            {contactDetails?.has_contact ? (
                                                <div className="space-y-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-semibold text-lg shrink-0 shadow-md">
                                                            {contactDetails.contact.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                                                                {contactDetails.contact.name}
                                                            </h4>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{contactDetails.contact.number}</p>
                                                        </div>
                                                    </div>
                                                    <dl className="space-y-3 text-sm">
                                                        {contactDetails.contact.contact_id && (
                                                            <div className="flex flex-col gap-0.5 py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                                                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact ID</dt>
                                                                <dd className="text-gray-800 dark:text-gray-200 font-mono text-xs break-all">{contactDetails.contact.contact_id}</dd>
                                                            </div>
                                                        )}
                                                        {(contactDetails.contact.email || contactDetails.contact.firm_name || contactDetails.contact.website || contactDetails.contact.remark) && (
                                                            <>
                                                                {contactDetails.contact.email && (
                                                                    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                                                                        <FiMail className="w-4 h-4 text-gray-400 shrink-0" />
                                                                        <div className="min-w-0">
                                                                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</dt>
                                                                            <dd className="text-gray-900 dark:text-white truncate">{contactDetails.contact.email}</dd>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {contactDetails.contact.firm_name && (
                                                                    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                                                                        <FiHome className="w-4 h-4 text-gray-400 shrink-0" />
                                                                        <div className="min-w-0">
                                                                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Company</dt>
                                                                            <dd className="text-gray-900 dark:text-white">{contactDetails.contact.firm_name}</dd>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {contactDetails.contact.website && (
                                                                    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                                                                        <FiGlobe className="w-4 h-4 text-gray-400 shrink-0" />
                                                                        <div className="min-w-0">
                                                                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Website</dt>
                                                                            <dd><a href={contactDetails.contact.website.startsWith('http') ? contactDetails.contact.website : `https://${contactDetails.contact.website}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline truncate block">{contactDetails.contact.website}</a></dd>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {contactDetails.contact.remark && (
                                                                    <div className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                                                                        <FiFileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                                                                        <div className="min-w-0">
                                                                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                                                                            <dd className="text-gray-900 dark:text-white text-sm">{contactDetails.contact.remark}</dd>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </dl>
                                                    {(contactDetails.contact.create_by || contactDetails.contact.modify_by) && (
                                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-4">
                                                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Audit</p>
                                                            {contactDetails.contact.create_date && contactDetails.contact.create_by && (
                                                                <div className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 text-sm">
                                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Created</p>
                                                                    <p className="text-gray-800 dark:text-gray-200">{new Date(contactDetails.contact.create_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                                    <p className="text-gray-600 dark:text-gray-300 mt-1">by {contactDetails.contact.create_by.name}{contactDetails.contact.create_by.mobile ? ` · ${contactDetails.contact.create_by.mobile}` : ''}{contactDetails.contact.create_by.email ? ` · ${contactDetails.contact.create_by.email}` : ''}</p>
                                                                </div>
                                                            )}
                                                            {contactDetails.contact.modify_date && contactDetails.contact.modify_by && (
                                                                <div className="py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 text-sm">
                                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Last modified</p>
                                                                    <p className="text-gray-800 dark:text-gray-200">{new Date(contactDetails.contact.modify_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                                                    <p className="text-gray-600 dark:text-gray-300 mt-1">by {contactDetails.contact.modify_by.name}{contactDetails.contact.modify_by.mobile ? ` · ${contactDetails.contact.modify_by.mobile}` : ''}{contactDetails.contact.modify_by.email ? ` · ${contactDetails.contact.modify_by.email}` : ''}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={handleContactMenuClick}
                                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                                                    >
                                                        <FiEdit2 className="w-4 h-4" />
                                                        Update Contact
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6">
                                                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                                                        <FiUser className="w-7 h-7 text-gray-400 dark:text-gray-500" />
                                                    </div>
                                                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Contact not saved</h4>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Save this number to store name, email, and notes.</p>
                                                    <button
                                                        onClick={() => {
                                                            setShowContactModal(true);
                                                            setContactForm({
                                                                name: (activeChat?.name && activeChat?.name !== activeChat?.number) ? activeChat.name : '',
                                                                number: activeChat?.number || '',
                                                                email: '', firm_name: '', website: '', remark: '', language_code: '', country: ''
                                                            });
                                                        }}
                                                        disabled={contactDetailsLoading}
                                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <FiUser className="w-4 h-4" />
                                                        Save Contact
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                            )}

                                    {/* ——— Media & Documents ——— */}
                                    {activeChat?.number && (
                                        <ContactMediaSection
                                            number={activeChat.number}
                                            tokens={tokens}
                                        />
                                    )}

                                    {/* ——— Chat Assign ——— */}
                                    {isAssignedToMeOrChatAssignAccess && (
                                        <section className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                                            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                                    <FiUserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Chat Assign</h4>
                                            </div>
                                            <div className="p-5 space-y-4">
                                                <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/40">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">Assigned to</span>
                                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {assignmentLoading ? '...' : (isAssigned ? assignedUserName : 'Unassigned')}
                                                    </span>
                                                </div>
                                                {isAssigned && assignmentInfo?.assigned_to_me && (
                                                    <button
                                                        onClick={() => handleAssignmentChange('unassign')}
                                                        disabled={assignActionLoading}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                                                    >
                                                        {assignActionLoading && <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                                                        Unassign chat
                                                    </button>
                                                )}
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Assign to agent</p>
                                                    {assignmentUsers.length === 0 ? (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 py-3">No agents available.</p>
                                                    ) : (
                                                        <ul className="space-y-2 max-h-52 overflow-y-auto">
                                                            {assignmentUsers.map((user) => {
                                                                const isActive = assignedUsername === user.username;
                                                                return (
                                                                    <li
                                                                        key={user.username}
                                                                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                                                    >
                                                                        <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0">
                                                                            <FiUser className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name || user.username || 'Unknown'}{user.is_me ? ' (You)' : ''}</p>
                                                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email || user.mobile || user.username}</p>
                                                                        </div>
                                                                        {isActive ? (
                                                                            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-medium shrink-0">
                                                                                <FiCheck className="w-4 h-4" /> Assigned
                                                                            </span>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleAssignmentChange('assign', user.username)}
                                                                                disabled={assignActionLoading}
                                                                                className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/60 disabled:opacity-50 transition-colors shrink-0"
                                                                                title="Assign to this agent"
                                                                            >
                                                                                <FiUserPlus className="w-3.5 h-3.5" />
                                                                                Assign
                                                                            </button>
                                                                        )}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        </section>
                                    )}

                                    {/* ——— Case (table by default) ——— */}
                                    {activeChat?.number && (
                                        <section className="rounded-2xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
                                            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(caseStatus ?? 0) > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                                                        {(caseStatus ?? 0) > 0 ? <FiAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
                                                    </div>
                                                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Case</h4>
                                                </div>
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${(caseStatus ?? 0) > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : caseStatus === 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'}`}>
                                                    {caseStatusLoading ? '...' : (caseStatus ?? 0) > 0 ? `Open (${caseStatus})` : caseStatus === 0 ? 'Closed' : '—'}
                                                </span>
                                            </div>
                                            <div className="p-5">
                                                {caseListLoading && caseList.length === 0 ? (
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                                                                {['#', 'Name', 'Date', 'Status', ''].map((label) => (
                                                                    <th key={label || 'actions'} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">{label}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody><TableSkeletonRows rows={4} cells={['index', 'text', 'short', 'badge', 'action']} /></tbody>
                                                    </table>
                                                ) : caseList.length === 0 ? (
                                                    <div className="text-center py-8">
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No cases for this chat.</p>
                                                        <div className="flex flex-wrap items-center justify-center gap-3">
                                                            <button
                                                                onClick={openCaseCreateModal}
                                                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                                            >
                                                                <FiPlus className="w-4 h-4" />
                                                                Create case
                                                            </button>
                                                            <button
                                                                onClick={() => { setShowCaseListModal(true); setCaseListPageNo(1); fetchCaseList(1, caseListLimit, { number: activeChat?.number || '', search: '', status: '' }); }}
                                                                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                                            >
                                                                View all case list
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="overflow-x-auto -mx-1 rounded-xl border border-gray-200 dark:border-gray-700">
                                                            <table className="w-full text-sm min-w-[320px]">
                                                                <thead>
                                                                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                                                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th>
                                                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:table-cell">Date</th>
                                                                        <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">Status</th>
                                                                        <th className="w-16 px-3 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                                    {caseList.slice(0, 5).map((row, index) => {
                                                                        const createDate = row.created_at ?? row.create_date ?? row.created_date ?? row.createdAt;
                                                                        const createDateStr = createDate ? new Date(createDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                                                                        return (
                                                                            <tr key={row.id ?? index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                                                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 font-medium">{index + 1}</td>
                                                                                <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium truncate max-w-[120px]">{row.name ?? '—'}</td>
                                                                                <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{createDateStr}</td>
                                                                                <td className="px-3 py-2.5 text-center">
                                                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${row.status === true || row.status === '1' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'}`}>
                                                                                        {row.status === true || row.status === '1' ? 'Open' : 'Closed'}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-3 py-2.5 text-right">
                                                                                    <RowActionMenu
                                                                                        items={[
                                                                                            { label: 'Details', icon: <FiEye className="w-4 h-4" />, onClick: () => setCaseDetail(row) },
                                                                                            { label: 'Edit', icon: <FiEdit2 className="w-4 h-4" />, onClick: () => openCaseEditModal(row) },
                                                                                        ]}
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        <div className="mt-4 flex flex-wrap gap-2">
                                                            <button
                                                                onClick={openCaseCreateModal}
                                                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                                            >
                                                                <FiPlus className="w-4 h-4" />
                                                                Create case
                                                            </button>
                                                            <button
                                                                onClick={() => { setShowCaseListModal(true); setCaseListPageNo(1); fetchCaseList(1, caseListLimit, { number: activeChat?.number || '', search: '', status: '' }); }}
                                                                className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                                                            >
                                                                <FiActivity className="w-4 h-4" />
                                                                View all case list
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </section>
                                    )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Contact Form Modal */}
            <ContactFormModal
                isOpen={showContactModal}
                onClose={handleCloseContactModal}
                initialData={contactForm}
                isExisting={Boolean(existingContactId)}
                onSubmit={handleContactSave}
                loading={contactLoading}
                submitting={contactSubmitting}
                error={contactError}
                darkMode={darkMode}
            />
        </div>
    );
}

// Helper function to format time
const formatTime = (value) => {
    if (!value) return '';
    try {
        const date = typeof value === 'number' ? new Date(value) : parseServerDate(value);
        if (!date) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

// Helper function to get date string for grouping
const getDateString = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = typeof timestamp === 'number' ? new Date(timestamp) : parseServerDate(timestamp);
        if (!date) return '';
        return date.toDateString(); // Returns format like "Mon Oct 26 2025"
    } catch {
        return '';
    }
};

// Helper function to format date for display
const formatDateForDisplay = (timestamp) => {
    if (!timestamp) return '';
    try {
        const date = typeof timestamp === 'number' ? new Date(timestamp) : parseServerDate(timestamp);
        if (!date) return '';
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Reset time to compare only dates
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

        if (messageDate.getTime() === todayDate.getTime()) {
            return 'Today';
        } else if (messageDate.getTime() === yesterdayDate.getTime()) {
            return 'Yesterday';
        } else {
            // Format as DD/MM/YYYY
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch {
        return '';
    }
};

// Helper function to group messages by date
const groupMessagesByDate = (messages) => {
    const groups = {};
    //i dont want to work any more

    messages.forEach(message => {
        const dateString = getDateString(message.timestamp || message.create_date);
        if (dateString) {
            if (!groups[dateString]) {
                groups[dateString] = [];
            }
            groups[dateString].push(message);
        }
    });

    // Sort groups by date (newest first)
    const sortedGroups = Object.keys(groups)
        .sort((a, b) => new Date(a) - new Date(b))
        .map(dateString => ({
            date: dateString,
            displayDate: formatDateForDisplay(new Date(dateString)),
            messages: groups[dateString]
        }));

    return sortedGroups;

};

export default Conversation;
