import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { toServerTimestamp, parseServerDate } from '../utils/dateTime';
import { FiSearch, FiStar, FiImage, FiVideo, FiFile, FiMusic, FiUser, FiCheck, FiClock, FiAlertCircle, FiMoreVertical, FiMessageCircle, FiRefreshCw, FiDelete, FiTrash2, FiChevronLeft, FiChevronRight, FiX, FiBriefcase, FiMaximize2, FiMinimize2, FiLayers } from 'react-icons/fi';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import { dbHelper } from './db';
import { socketManager } from './socket';
import GlobalMediaGalleryModal from '../component/Modals/GlobalMediaGalleryModal';
import SearchableSelect from '../component/SearchableSelect';

const COUNTRY_CODES = [
    { code: '91', country: 'India', dial: '+91' },
    { code: '1', country: 'USA/Canada', dial: '+1' },
    { code: '44', country: 'UK', dial: '+44' },
    { code: '81', country: 'Japan', dial: '+81' },
    { code: '86', country: 'China', dial: '+86' },
    { code: '49', country: 'Germany', dial: '+49' },
    { code: '33', country: 'France', dial: '+33' },
    { code: '61', country: 'Australia', dial: '+61' },
    { code: '55', country: 'Brazil', dial: '+55' },
    { code: '971', country: 'UAE', dial: '+971' },
    { code: '92', country: 'Pakistan', dial: '+92' },
    { code: '880', country: 'Bangladesh', dial: '+880' },
    { code: '94', country: 'Sri Lanka', dial: '+94' },
    { code: '65', country: 'Singapore', dial: '+65' },
    { code: '60', country: 'Malaysia', dial: '+60' },
];

// Maps the UI tab label to the value the backend's `/message/chat-list`
// route understands (it reads `filter` / `filter_type` / `type`, all set
// to the same value).
const mapTabToFilter = (tab) => {
    switch (tab) {
        case 'Unread': return 'unread';
        case 'Favourites': return 'favourites';
        case 'Assigned': return 'assigned';
        default: return 'all';
    }
};

function ChatList({ tokens, onChatSelect, activeChat, darkMode, dbAvailable, socket_chats = [], onRepairChats, isFullScreen = false, onToggleFullScreen }) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeTab, setActiveTab] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [chats, setChats] = useState([]);
    const activeChatRef = React.useRef(activeChat);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showDirectChatModal, setShowDirectChatModal] = useState(false);
    const [showRepairChatsModal, setShowRepairChatsModal] = useState(false);
    const [showMediaGalleryModal, setShowMediaGalleryModal] = useState(false);
    const [directChatCountryCode, setDirectChatCountryCode] = useState('91');
    const [directChatNumber, setDirectChatNumber] = useState('');
    const [repairChatsConfirming, setRepairChatsConfirming] = useState(false);
    const settingsMenuRef = useRef(null);
    const directChatInputRef = useRef(null);
    const isFirstFilterRun = useRef(true);
    const filterRequestId = useRef(0);

    // Update ref when activeChat changes
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
                setShowSettingsMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (showDirectChatModal && directChatInputRef.current) {
            directChatInputRef.current.focus();
        }
    }, [showDirectChatModal]);

    // Ensure unread badge clears as soon as a chat becomes active
    useEffect(() => {
        if (!activeChat?.number) return;

        const activeNumber = activeChat.number;
        const activeChatFromState = chats.find(chat => chat.number === activeNumber);

        if (!activeChatFromState) return;

        const unreadValue = Number(activeChatFromState.unread_count ?? 0);
        const normalizedUnread = Number.isFinite(unreadValue) ? unreadValue : 0;
        const shouldClear = normalizedUnread > 0 || activeChatFromState.unread;

        if (!shouldClear) return;

        const clearedChat = { ...activeChatFromState, unread_count: 0, unread: false };

        setChats(prevChats =>
            prevChats.map(chat =>
                chat.number === activeNumber ? clearedChat : chat
            )
        );

        activeChatRef.current = clearedChat;

        if (dbAvailable) {
            dbHelper.updateChat(activeNumber, { unread_count: 0 });
        }
    }, [activeChat?.number, chats, dbAvailable]);

    // 1. Render from local first → 2. Sync with API (merge local + API, save to local) → 3. Re-render from local
    useEffect(() => {
        if (!tokens) return;

        (async () => {
            // 1️⃣ Load local database and render first (if available)
            if (dbAvailable) {
                const localChats = await dbHelper.getChats();
                setChats(localChats);
                if (localChats.length > 0) setIsLoading(false);
            }

            // 2️⃣ Call chat list API (unfiltered "All" view); merge API response
            // with local, save updated data to local
            await syncWithAPI(1, false);

            // 3️⃣ Re-fetch from local DB and re-render (single source of truth for UI)
            if (dbAvailable) {
                const updatedChats = await dbHelper.getChats();
                setChats(updatedChats);
            }

            setIsLoading(false);
        })();
    }, [tokens, dbAvailable]);

    // 🔹 When socket_chats prop changes (including status updates)
    useEffect(() => {
        if (socket_chats && socket_chats.length > 0) {
            setChats(prevChats => {
                const updatedChats = socket_chats.map(socketChat => {
                    // Find existing chat to get current unread_count (for incrementing)
                    const existingChat = prevChats.find(c => c.number === socketChat.number);

                    // Check if this is the currently open chat
                    const isCurrentlyOpen = activeChatRef.current?.number === socketChat.number;

                    // If chat is currently open, keep count at 0 but PRESERVE status from socket/DB
                    if (isCurrentlyOpen) {
                        return {
                            ...socketChat,
                            unread_count: 0,
                            unread: false
                        };
                    }

                    // Check if this chat received a NEW incoming message
                    // Compare message IDs to detect new messages
                    const hasNewMessage = existingChat &&
                        socketChat.type === 'in' &&
                        (socketChat.wamid !== existingChat.wamid ||
                            socketChat.unique_id !== existingChat.unique_id ||
                            socketChat.last_id !== existingChat.last_id);

                    // Only increment unread count if this specific chat received a new message
                    if (hasNewMessage) {
                        const currentUnread = existingChat?.unread_count || 0;
                        return {
                            ...socketChat,
                            unread_count: currentUnread + 1,
                            unread: true
                        };
                    }

                    // For status updates: use the status from socket/DB (socketChat.status)
                    // This ensures status changes (sent→delivered→read) are reflected
                    // Only preserve unread_count from existing if socket doesn't have it
                    const unreadCount = typeof socketChat.unread_count === 'number'
                        ? socketChat.unread_count
                        : (existingChat?.unread_count || 0);

                    return {
                        ...socketChat,
                        unread_count: unreadCount,
                        unread: unreadCount > 0
                    };
                });

                // Only save unread counts back to DB, not the full chat data
                // (status updates are already handled by socket.js)
                if (dbAvailable) {
                    const unreadUpdates = updatedChats
                        .filter(chat => {
                            const existing = prevChats.find(c => c.number === chat.number);
                            return existing && existing.unread_count !== chat.unread_count;
                        })
                        .map(chat => ({ number: chat.number, unread_count: chat.unread_count }));

                    if (unreadUpdates.length > 0) {
                        unreadUpdates.forEach(update => {
                            dbHelper.updateChat(update.number, { unread_count: update.unread_count });
                        });
                    }
                }

                return updatedChats;
            });
        }
    }, [socket_chats, dbAvailable]);

    // 🔹 Subscribe to case_status socket: updates case_open_count for chat by number
    useEffect(() => {
        const unsubscribe = socketManager.onCaseStatus(({ number, case_open_count }) => {
            setChats(prevChats =>
                prevChats.map(chat =>
                    chat.number === number ? { ...chat, case_open_count } : chat
                )
            );
        });
        return unsubscribe;
    }, []);

    // Pure mapper: turns raw API chat objects into the shape the UI uses.
    // Extracted out of processApiResponse so both the local-cache sync path
    // and the realtime search/filter path can share it.
    const mapApiChats = (apiChats) => {
        return apiChats.map(apiChat => {
            const unreadCount = typeof apiChat.unread_count === 'number'
                ? apiChat.unread_count
                : Number(apiChat.unread_count) || 0;

            const caseOpenCount = typeof apiChat.case_open_count === 'number'
                ? Math.max(0, apiChat.case_open_count)
                : 0;

            return {
                number: apiChat.contact.number,
                name: apiChat.contact.name || apiChat.contact.number,
                is_favorite: apiChat.contact.is_favorite || false,
                case_open_count: caseOpenCount,
                wamid: apiChat.last_message.wamid,
                create_date: apiChat.last_message.create_date,
                timestamp: apiChat.last_message.create_date ? toServerTimestamp(apiChat.last_message.create_date) : Date.now(),
                type: apiChat.last_message.type,
                message_type: apiChat.last_message.message_type,
                message: apiChat.last_message.message,
                status: apiChat.last_message.status,
                unique_id: apiChat.last_message.unique_id,
                last_id: apiChat.last_message.id,
                unread_count: unreadCount,
                unread: unreadCount > 0,
                send_by_username: apiChat.last_message.send_by?.username || '',
                send_by_mobile: apiChat.last_message.send_by?.mobile || ''
            };
        });
    };

    const PAGE_LIMIT = 30;

    const syncWithAPI = async (pageToFetch = 1, append = false) => {
        if (!tokens) return;

        if (pageToFetch > 1) {
            setLoadingMore(true);
        }

        try {
            // Use the currently selected project ID (fallback to first project if needed)
            const projectId = tokens.selected_project_id || '';

            const messagePayload = {
                project_id: projectId,
                page: pageToFetch,
                limit: PAGE_LIMIT,
                search: '',
                filter: 'all',
                filter_type: 'all',
                type: 'all',
                last_id: "0"
            };

            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            const response = await axios.post(
                `${API_BASE_URL}/message/chat-list`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.error && response.data.data) {
                const apiData = response.data.data;
                const meta = response.data.meta;
                const hasMoreFromMeta = meta ? !!meta.hasMore : apiData.length >= PAGE_LIMIT;
                setHasMore(hasMoreFromMeta);
                setPage(pageToFetch);

                await processApiResponse(apiData, append);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to sync conversations:', error);
        } finally {
            setIsLoading(false);
            setLoadingMore(false);
        }
    };

    // Realtime search/filter: hits the API directly with the current search
    // text and active tab, and renders straight from the response. This is
    // NOT saved back into the local cache — the local cache stays a mirror
    // of the unfiltered "All" list (kept fresh by syncWithAPI above), while
    // this path is purely for what's currently on screen.
    const fetchFilteredChats = async (search, tab, pageToFetch = 1, append = false) => {
        if (!tokens) return;

        const requestId = ++filterRequestId.current;
        if (pageToFetch === 1) {
            setIsFiltering(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const projectId = tokens.selected_project_id || '';
            const filterValue = mapTabToFilter(tab);

            const messagePayload = {
                project_id: projectId,
                page: pageToFetch,
                limit: PAGE_LIMIT,
                search: search || '',
                filter: filterValue,
                filter_type: filterValue,
                type: filterValue,
            };

            const { data, key } = Encrypt(messagePayload);
            const data_pass = JSON.stringify({ "data": data, "key": key });

            const response = await axios.post(
                `${API_BASE_URL}/message/chat-list`,
                data_pass,
                {
                    headers: {
                        'token': tokens.token,
                        'username': tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // If a newer search/filter request has since started, drop this
            // stale response instead of clobbering the UI with old results.
            if (requestId !== filterRequestId.current) return;

            if (!response.data.error && response.data.data) {
                const apiData = response.data.data;
                const meta = response.data.meta;
                const hasMoreFromMeta = meta ? !!meta.hasMore : apiData.length >= PAGE_LIMIT;
                setHasMore(hasMoreFromMeta);
                setPage(pageToFetch);

                const newMappedChats = mapApiChats(apiData);
                if (append) {
                    setChats(prev => {
                        const existingNumbers = new Set(prev.map(c => c.number));
                        const uniqueNew = newMappedChats.filter(c => !existingNumbers.has(c.number));
                        return [...prev, ...uniqueNew];
                    });
                } else {
                    setChats(newMappedChats);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Failed to fetch filtered chats:', error);
        } finally {
            if (requestId === filterRequestId.current) {
                setIsFiltering(false);
                setLoadingMore(false);
            }
        }
    };

    // Load next page of chats when scrolled to bottom
    const loadMoreChats = () => {
        if (isLoading || isFiltering || loadingMore || !hasMore) return;
        const nextPage = page + 1;
        if (searchQuery || activeTab !== 'All') {
            fetchFilteredChats(searchQuery, activeTab, nextPage, true);
        } else {
            syncWithAPI(nextPage, true);
        }
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 120 && !isLoading && !isFiltering && !loadingMore && hasMore) {
            loadMoreChats();
        }
    };

    // Debounce search input + immediately react to tab switches, both
    // calling the API for a realtime, server-side filtered/searched list.
    useEffect(() => {
        if (!tokens) return;

        // Skip the very first run — the mount effect above already loads the
        // default "All" / no-search view, so firing again here would just
        // duplicate that initial request.
        if (isFirstFilterRun.current) {
            isFirstFilterRun.current = false;
            return;
        }

        setPage(1);
        setHasMore(true);

        const handler = setTimeout(() => {
            fetchFilteredChats(searchQuery, activeTab, 1, false);
        }, searchQuery ? 400 : 0); // instant on tab switch, debounced while typing

        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, activeTab, tokens]);

    // Refresh chat list when cases are edited/created elsewhere
    useEffect(() => {
        const handler = () => {
            // Re-sync to refresh case_open_count + latest chat data for
            // whatever view (search/filter) is currently active.
            if (searchQuery || activeTab !== 'All') {
                fetchFilteredChats(searchQuery, activeTab, 1, false);
            } else {
                syncWithAPI(1, false);
            }
        };
        window.addEventListener('case_updated', handler);
        return () => window.removeEventListener('case_updated', handler);
        // Intentionally depends on tokens so sync uses latest auth
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens, searchQuery, activeTab]);

    const processApiResponse = async (apiChats, append = false) => {
        try {
            // Build list from API response
            const chatListFromApi = mapApiChats(apiChats);

            if (dbAvailable) {
                // Get current local chats to merge (preserve local name when API returns empty)
                const localChats = await dbHelper.getChats();
                const mergedList = chatListFromApi.map(apiChat => {
                    const local = localChats.find(c => c.number === apiChat.number);
                    const name = (apiChat.name && String(apiChat.name).trim() !== '')
                        ? apiChat.name
                        : (local?.name && String(local.name).trim() !== '' ? local.name : apiChat.number);
                    return { ...apiChat, name };
                });
                await dbHelper.saveChats(mergedList);
                const updatedChats = await dbHelper.getChats();
                setChats(updatedChats);
            } else {
                if (append) {
                    setChats(prev => {
                        const existingNumbers = new Set(prev.map(c => c.number));
                        const uniqueNew = chatListFromApi.filter(c => !existingNumbers.has(c.number));
                        return [...prev, ...uniqueNew];
                    });
                } else {
                    setChats(chatListFromApi);
                }
            }
        } catch (error) {
            console.error('Error processing API response:', error);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = parseServerDate(dateString);
        if (!date) return '';
        return date.toLocaleDateString('en-GB');
    };

    // Format last message based on message type
    const formatLastMessage = (chat) => {
        if (!chat.message && !chat.message_type) {
            return 'No messages yet';
        }

        const messageType = chat.message_type || 'text';
        const message = chat.message || '';

        switch (messageType) {
            case 'text':
                return message || 'Message';
            case 'image':
                return '📷 Photo';
            case 'video':
                return '🎥 Video';
            case 'audio':
                return '🎵 Audio';
            case 'document':
                return '📄 Document';
            case 'location':
                return '📍 Location';
            case 'contact':
                return '👤 Contact';
            case 'sticker':
                return '😀 Sticker';
            case 'voice':
                return '🎤 Voice message';
            default:
                return message || 'Message';
        }
    };

    // Get message status icon for sent messages
    const getMessageStatusIcon = (status, isOwnMessage) => {
        if (!isOwnMessage) return null;

        switch (status) {
            case 'pending':
                return <FiClock className="w-3 h-3 text-gray-400" />;
            case 'sent':
                return <FiCheck className="w-3 h-3 text-gray-400" />;
            case 'delivered':
                return (
                    <div className="flex">
                        <FiCheck className="w-3 h-3 text-gray-400" />
                        <FiCheck className="w-3 h-3 -ml-1 text-gray-400" />
                    </div>
                );
            case 'read':
                return (
                    <div className="flex">
                        <FiCheck className="w-3 h-3 text-green-500" />
                        <FiCheck className="w-3 h-3 -ml-1 text-green-500" />
                    </div>
                );
            case 'failed':
                return <FiAlertCircle className="w-3 h-3 text-red-500" />;
            default:
                return <FiClock className="w-3 h-3 text-gray-400" />;
        }
    };

    // Check if the last message was sent by the current user
    const isLastMessageFromUser = (chat) => {
        // Check if the message type is 'out' or if it's a sent message
        return chat.type === 'out' || chat.send_by_username || chat.send_by_mobile;
    };

    // Get message type icon
    const getMessageTypeIcon = (messageType) => {
        switch (messageType) {
            case 'image':
                return <FiImage className="w-3 h-3" />;
            case 'video':
                return <FiVideo className="w-3 h-3" />;
            case 'audio':
            case 'voice':
                return <FiMusic className="w-3 h-3" />;
            case 'document':
                return <FiFile className="w-3 h-3" />;
            case 'location':
                return null;
            case 'contact':
                return <FiUser className="w-3 h-3" />;
            default:
                return null;
        }
    };

    // Format time for display
    const formatTime = (dateStringOrEpoch) => {
        if (!dateStringOrEpoch) return '';
        const date = typeof dateStringOrEpoch === 'number'
            ? new Date(dateStringOrEpoch)
            : parseServerDate(dateStringOrEpoch);
        if (!date) return '';
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 168) { // Less than a week
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    // Sort chats by most recent. Search/tab filtering now happens server-side
    // (see fetchFilteredChats) — `chats` already reflects the active
    // search + filter by the time it gets here, so this just orders it.
    const groupedChats = () => {
        const sorted = [...chats].sort((a, b) => {
            const timeA = a.timestamp || toServerTimestamp(a.create_date) || 0;
            const timeB = b.timestamp || toServerTimestamp(b.create_date) || 0;
            return timeB - timeA; // Most recent first
        });

        return [{ isGroup: false, groupName: activeTab, chats: sorted }];
    };

    const handleChatClick = (chat) => {
        const updatedChat = {
            ...chat,
            unread_count: 0,
            unread: false
        };

        // Immediately update the active chat ref
        activeChatRef.current = updatedChat;

        // Reset unread count immediately in UI state
        setChats(prevChats =>
            prevChats.map(c =>
                c.number === chat.number ? updatedChat : c
            )
        );

        // Update IndexedDB in background (non-blocking)
        if (dbAvailable && (chat.unread_count || 0) > 0) {
            dbHelper.updateChat(chat.number, { unread_count: 0 });
        }

        // Notify parent component with the updated chat payload
        onChatSelect(updatedChat);
    };

    // Calculate total unread count across all chats
    const getTotalUnreadCount = () => {
        return chats.reduce((total, chat) => {
            const unreadValueRaw = Number(chat.unread_count ?? 0);
            const unreadCount = Number.isFinite(unreadValueRaw) ? Math.max(0, unreadValueRaw) : 0;
            return total + unreadCount;
        }, 0);
    };


    const totalUnreadCount = getTotalUnreadCount();

    return (
        <>
            <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                        <FiSearch className="text-gray-500 dark:text-gray-400 mr-2 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search"
                            className="w-full bg-transparent focus:outline-none placeholder-gray-500 dark:placeholder-gray-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {isFiltering && (
                            <FiRefreshCw className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0 ml-2" />
                        )}
                    </div>
                    <div className="relative" ref={settingsMenuRef}>
                        <button
                            type="button"
                            onClick={() => setShowSettingsMenu((p) => !p)}
                            className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                            title="Menu"
                        >
                            <FiMoreVertical className="w-5 h-5" />
                        </button>
                        {showSettingsMenu && (
                            <div className="absolute right-0 mt-1 w-52 py-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg z-50">
                                <button
                                    type="button"
                                    onClick={() => { setShowSettingsMenu(false); setShowDirectChatModal(true); }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <FiMessageCircle className="w-4 h-4" />
                                    Direct Chat
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowSettingsMenu(false); setShowRepairChatsModal(true); }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <FiRefreshCw className="w-4 h-4" />
                                    Repair Chats
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowSettingsMenu(false); onToggleFullScreen?.(); }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    {isFullScreen ? (
                                        <>
                                            <FiMinimize2 className="w-4 h-4" />
                                            Exit Full Screen
                                        </>
                                    ) : (
                                        <>
                                            <FiMaximize2 className="w-4 h-4" />
                                            Full Screen
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowSettingsMenu(false); setShowMediaGalleryModal(true); }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <FiLayers className="w-4 h-4" />
                                    Media Gallery
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
                {['All', 'Unread', 'Favourites', 'Assigned'].map((tab) => {
                    // Show total unread count badge on "All" tab
                    const showUnreadBadge = tab === 'All' && totalUnreadCount > 0;

                    return (
                        <button
                            key={tab}
                            className={`flex-1 py-3 text-sm font-medium relative flex items-center justify-center gap-2 ${activeTab === tab
                                ? darkMode
                                    ? 'text-blue-400'
                                    : 'text-blue-600'
                                : darkMode
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }`}
                            onClick={() => setActiveTab(tab)}
                        >
                            <span>{tab}</span>
                            {showUnreadBadge && (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center justify-center">
                                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                                </span>
                            )}
                            {activeTab === tab && (
                                <div
                                    className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-1 rounded-full ${darkMode ? 'bg-blue-400' : 'bg-blue-600'
                                        }`}
                                ></div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide" onScroll={handleScroll}>
                {isLoading && chats.length === 0 ? (
                    <div className="p-4 space-y-4">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="flex items-center space-x-3">
                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                                <div className="flex-1">
                                    <div className="h-4 w-3/4 mb-2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                                    <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        {groupedChats().map((group, groupIndex) => (
                            <div key={groupIndex}>
                                {/* Chat Items */}
                                <div className="divide-y" style={{ divideColor: darkMode ? '#374151' : '#e5e7eb' }}>
                                    {group.chats.map((chat) => {
                                        const unreadValueRaw = Number(chat.unread_count ?? 0);
                                        const unreadCount = Number.isFinite(unreadValueRaw) ? Math.max(0, unreadValueRaw) : 0;
                                        const hasUnread = unreadCount > 0;
                                        const isActive = activeChat?.number === chat.number;
                                        return (
                                            <div
                                                key={chat.number || chat.id}
                                                onClick={() => handleChatClick(chat)}
                                                className={`p-4 cursor-pointer transition-colors  ${isActive && !darkMode ? 'bg-gray-100' : ''
                                                    } ${isActive && darkMode ? 'bg-gray-700' : ''
                                                    } ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-blue-500 text-white font-semibold">
                                                            {(chat.name || chat.number || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        {chat.is_favorite && (
                                                            <div className="absolute -top-1 -right-1">
                                                                <FiStar className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                <h3 className="font-medium truncate text-gray-900 dark:text-white">
                                                                    {(chat.name || chat.number || '').startsWith("91") ? `+${chat.name || chat.number}` : (chat.name || chat.number)}
                                                                </h3>
                                                                {(chat.case_open_count || 0) > 0 && (
                                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex-shrink-0" title="Open cases">
                                                                        <FiBriefcase className="w-3 h-3" />
                                                                        Case {(chat.case_open_count || 0) > 99 ? '99+' : chat.case_open_count}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {formatTime(chat.timestamp || chat.create_date)}
                                                                </div>
                                                                {hasUnread && !isActive && (
                                                                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center justify-center">
                                                                        {unreadCount > 99 ? '99+' : unreadCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center space-x-1 min-w-0 flex-1">
                                                                {getMessageTypeIcon(chat.message_type)}
                                                                <p className="text-sm truncate text-gray-500 dark:text-gray-400">
                                                                    {formatLastMessage(chat)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center space-x-1 flex-shrink-0">
                                                                {getMessageStatusIcon(chat.status, isLastMessageFromUser(chat))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Bottom loading spinner for pagination */}
                        {loadingMore && (
                            <div className="flex justify-center items-center py-4">
                                <FiRefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                            </div>
                        )}

                        {chats.length === 0 && !isLoading && (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                    <FiSearch className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    No conversations found
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">
                                    {searchQuery ? 'Try adjusting your search terms' : 'Start a new conversation to see it here'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Direct Chat Modal */}
            {showDirectChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDirectChatModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b dark:border-gray-700 flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Direct Chat</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Enter number and start chat</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDirectChatModal(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                                aria-label="Close"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex gap-2">
                                <SearchableSelect
                                    value={directChatCountryCode}
                                    onChange={(e) => setDirectChatCountryCode(e.target.value)}
                                    options={COUNTRY_CODES.map((c) => ({ value: c.code, label: `${c.dial} ${c.country}` }))}
                                    className="flex-shrink-0 w-36 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    ref={directChatInputRef}
                                    type="tel"
                                    inputMode="numeric"
                                    placeholder="Phone number"
                                    value={directChatNumber}
                                    onChange={(e) => setDirectChatNumber(e.target.value.replace(/\D/g, ''))}
                                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            const el = directChatInputRef.current;
                                            const start = el ? (el.selectionStart ?? directChatNumber.length) : directChatNumber.length;
                                            const end = el ? (el.selectionEnd ?? directChatNumber.length) : directChatNumber.length;
                                            const next = directChatNumber.slice(0, start) + key + directChatNumber.slice(end);
                                            setDirectChatNumber(next);
                                            setTimeout(() => {
                                                if (directChatInputRef.current) {
                                                    directChatInputRef.current.focus();
                                                    directChatInputRef.current.setSelectionRange(start + 1, start + 1);
                                                }
                                            }, 0);
                                        }}
                                        className="py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium text-lg transition-colors"
                                    >
                                        {key}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            const trimmed = String(text || '').trim().replace(/\s/g, '').replace(/\D/g, '');
                                            if (!trimmed) return;
                                            const el = directChatInputRef.current;
                                            const start = el ? (el.selectionStart ?? directChatNumber.length) : directChatNumber.length;
                                            const end = el ? (el.selectionEnd ?? directChatNumber.length) : directChatNumber.length;
                                            const next = directChatNumber.slice(0, start) + trimmed + directChatNumber.slice(end);
                                            setDirectChatNumber(next);
                                            setTimeout(() => {
                                                if (directChatInputRef.current) {
                                                    directChatInputRef.current.focus();
                                                    const pos = start + trimmed.length;
                                                    directChatInputRef.current.setSelectionRange(pos, pos);
                                                }
                                            }, 0);
                                        } catch (_) { }
                                    }}
                                    className="py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium text-sm"
                                >
                                    Paste
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        const el = directChatInputRef.current;
                                        const start = el ? (el.selectionStart ?? directChatNumber.length) : directChatNumber.length;
                                        const end = el ? (el.selectionEnd ?? directChatNumber.length) : directChatNumber.length;
                                        const next = directChatNumber.slice(0, start) + '0' + directChatNumber.slice(end);
                                        setDirectChatNumber(next);
                                        setTimeout(() => {
                                            if (directChatInputRef.current) {
                                                directChatInputRef.current.focus();
                                                directChatInputRef.current.setSelectionRange(start + 1, start + 1);
                                            }
                                        }, 0);
                                    }}
                                    className="py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium text-lg"
                                >
                                    0
                                </button>
                                <div className="flex gap-0.5">
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            const el = directChatInputRef.current;
                                            if (el) { const pos = Math.max(0, (el.selectionStart ?? el.value.length) - 1); el.setSelectionRange(pos, pos); el.focus(); }
                                        }}
                                        className="flex-1 w-1/2 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white flex items-center justify-center"
                                    >
                                        <FiChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            const el = directChatInputRef.current;
                                            if (el) { const len = el.value.length; const pos = Math.min(len, (el.selectionStart ?? 0) + 1); el.setSelectionRange(pos, pos); el.focus(); }
                                        }}
                                        className="flex-1 w-1/2 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white flex items-center justify-center"
                                    >
                                        <FiChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        setDirectChatNumber('');
                                        setTimeout(() => directChatInputRef.current?.focus(), 0);
                                    }}
                                    className="flex-1 w-1/2 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-1.5"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        const el = directChatInputRef.current;
                                        const start = el ? (el.selectionStart ?? directChatNumber.length) : directChatNumber.length;
                                        const end = el ? (el.selectionEnd ?? directChatNumber.length) : directChatNumber.length;
                                        if (start >= end && start === 0) return;
                                        const delStart = start > 0 && start === end ? start - 1 : start;
                                        const next = directChatNumber.slice(0, delStart) + directChatNumber.slice(end);
                                        setDirectChatNumber(next);
                                        setTimeout(() => {
                                            if (directChatInputRef.current) {
                                                directChatInputRef.current.focus();
                                                directChatInputRef.current.setSelectionRange(delStart, delStart);
                                            }
                                        }, 0);
                                    }}
                                    className="flex-1 w-1/2 py-2 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-1.5"
                                >
                                    <FiDelete className="w-4 h-4" />
                                    Backspace
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const fullNumber = directChatCountryCode + directChatNumber.replace(/\D/g, '');
                                    if (fullNumber.length >= 10) {
                                        setShowDirectChatModal(false);
                                        setDirectChatNumber('');
                                        navigate(`/live-chat/${fullNumber}`);
                                    }
                                }}
                                disabled={!directChatNumber.replace(/\D/g, '').length}
                                className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2"
                            >
                                <FiMessageCircle className="w-5 h-5" />
                                Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Repair Chats Confirm Modal */}
            {showRepairChatsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !repairChatsConfirming && setShowRepairChatsModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Repair Chats</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            This will clear local chat and contact data and reload from the server. Continue?
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowRepairChatsModal(false)}
                                disabled={repairChatsConfirming}
                                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!onRepairChats) return;
                                    setRepairChatsConfirming(true);
                                    try {
                                        await onRepairChats();
                                        setShowRepairChatsModal(false);
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setRepairChatsConfirming(false);
                                    }
                                }}
                                disabled={repairChatsConfirming}
                                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium disabled:opacity-50"
                            >
                                {repairChatsConfirming ? 'Please wait...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <GlobalMediaGalleryModal
                isOpen={showMediaGalleryModal}
                onClose={() => setShowMediaGalleryModal(false)}
                tokens={tokens}
                onChatSelect={onChatSelect}
            />
        </>
    );
}

export default ChatList;