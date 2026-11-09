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
import WhatsAppText from '../component/WhatsAppText';

import AnimatedModal from '../component/Modals/AnimatedModal';
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
        case 'My Open': return 'my_open';
        case 'Unassigned': return 'unassigned';
        case 'SLA Breach': return 'sla_breach';
        case 'VIP': return 'vip';
        case 'Unread': return 'unread';
        case 'Favourites': return 'favourites';
        case 'Assigned': return 'assigned';
        default: return 'all';
    }
};

function ChatList({ tokens, onChatSelect, activeChat, darkMode, dbAvailable, socket_chats = [], onChatSnoozed, onRepairChats, isFullScreen = false, onToggleFullScreen }) {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [activeTab, setActiveTab] = useState('All');
    const [labelCatalog, setLabelCatalog] = useState([]);
    const [labelCatalogError, setLabelCatalogError] = useState('');
    const [assignmentMembers, setAssignmentMembers] = useState([]);
    const [assignmentMembersError, setAssignmentMembersError] = useState('');
    const [selectedLabelId, setSelectedLabelId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNumbers, setSelectedNumbers] = useState([]);
    const [bulkAction, setBulkAction] = useState('');
    const [bulkTarget, setBulkTarget] = useState('');
    const [bulkTagId, setBulkTagId] = useState('');
    const [bulkLabelAction, setBulkLabelAction] = useState('add');
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [bulkActionMessage, setBulkActionMessage] = useState('');
    const [snoozeChat, setSnoozeChat] = useState(null);
    const [snoozeMode, setSnoozeMode] = useState('time');
    const [snoozeUntil, setSnoozeUntil] = useState('');
    const [snoozeLoading, setSnoozeLoading] = useState(false);
    const [chats, setChats] = useState([]);
    const [chatListError, setChatListError] = useState('');
    const activeChatRef = React.useRef(activeChat);
    const selectedProjectIdRef = useRef(tokens?.selected_project_id || '');
    selectedProjectIdRef.current = tokens?.selected_project_id || '';
    const inboxContextRef = useRef({});
    inboxContextRef.current = {
        projectId: tokens?.selected_project_id || '',
        activeTab,
        searchQuery,
        selectedLabelId
    };
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
    const snoozeRefreshTimers = useRef(new Set());
    const loadNextSnoozeRef = useRef(null);

    useEffect(() => {
        setSelectedNumbers([]);
        setBulkTarget('');
        setBulkTagId('');
        setBulkActionMessage('');
    }, [activeTab, searchQuery, selectedLabelId, tokens?.selected_project_id]);

    useEffect(() => {
        setChats([]);
        setIsLoading(true);
        filterRequestId.current += 1;
    }, [tokens?.selected_project_id]);

    useEffect(() => {
        setSnoozeChat(null);
        snoozeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
        snoozeRefreshTimers.current.clear();
        let cancelled = false;
        if (!tokens?.selected_project_id || !tokens?.token) return undefined;

        const loadNextSnooze = async () => {
            snoozeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
            snoozeRefreshTimers.current.clear();
            try {
                const result = await getInboxRequest('next-snooze', {});
                if (cancelled) return;
                const nextSnooze = result.data?.next_snooze_at;
                if (nextSnooze) scheduleSnoozeRefresh(nextSnooze);
            } catch (error) {
                if (!cancelled) console.error('Failed to load the next snooze deadline:', error);
            }
        };
        loadNextSnoozeRef.current = loadNextSnooze;
        loadNextSnooze();

        return () => {
            cancelled = true;
            if (loadNextSnoozeRef.current === loadNextSnooze) loadNextSnoozeRef.current = null;
            snoozeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
            snoozeRefreshTimers.current.clear();
        };
        // getInboxRequest and scheduleSnoozeRefresh use current project/auth values captured by this effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens?.selected_project_id, tokens?.token, tokens?.username]);

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
        let cancelled = false;

        (async () => {
            const initialContext = inboxContextRef.current;
            const isDefaultView = !initialContext.searchQuery &&
                initialContext.activeTab === 'All' && !initialContext.selectedLabelId;
            // 1️⃣ Load local database and render first (if available)
            if (dbAvailable && isDefaultView) {
                const localChats = await dbHelper.getChats();
                if (cancelled) return;
                setChats(localChats);
                if (localChats.length > 0) setIsLoading(false);
            }

            // 2️⃣ Load the active view from the project-scoped API.
            const initialRequestId = filterRequestId.current + 1;
            const currentContext = inboxContextRef.current;
            const useDefaultView = !currentContext.searchQuery &&
                currentContext.activeTab === 'All' && !currentContext.selectedLabelId;
            if (useDefaultView) {
                await syncWithAPI(1, false);
            } else {
                await fetchFilteredChats(
                    currentContext.searchQuery,
                    currentContext.activeTab,
                    1,
                    false,
                    currentContext.selectedLabelId
                );
            }
            if (cancelled || filterRequestId.current !== initialRequestId) return;

            // 3️⃣ Re-fetch the unfiltered local mirror only for the default inbox.
            if (dbAvailable && useDefaultView) {
                const updatedChats = await dbHelper.getChats();
                if (cancelled || filterRequestId.current !== initialRequestId) return;
                setChats(updatedChats);
            }

            setIsLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [tokens, dbAvailable]);

    useEffect(() => {
        let cancelled = false;
        const projectId = tokens?.selected_project_id || '';
        setLabelCatalog([]);
        setLabelCatalogError('');
        setSelectedLabelId('');
        if (!projectId || !tokens?.token) return undefined;

        (async () => {
            try {
                const { data, key } = Encrypt({ project_id: projectId });
                const response = await axios.post(
                    `${API_BASE_URL}/contact/tags-list`,
                    JSON.stringify({ data, key }),
                    {
                        headers: {
                            token: tokens.token,
                            username: tokens.username,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (cancelled) return;
                if (response.data?.success === false || response.data?.error) {
                    throw new Error(response.data?.message || response.data?.error?.message || 'Could not load labels');
                }
                setLabelCatalog(Array.isArray(response.data?.data) ? response.data.data : []);
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load project conversation labels:', error);
                    setLabelCatalogError(error.message || 'Could not load project labels.');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [tokens?.selected_project_id, tokens?.token, tokens?.username]);

    useEffect(() => {
        let cancelled = false;
        const projectId = tokens?.selected_project_id || '';
        setAssignmentMembers([]);
        setAssignmentMembersError('');
        if (!projectId || !tokens?.token) return undefined;

        (async () => {
            try {
                const result = await getInboxRequest('project-members', {});
                if (!cancelled) setAssignmentMembers(Array.isArray(result.data) ? result.data : []);
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load project members for bulk assignment:', error);
                    setAssignmentMembersError(error.message || 'Could not load project members.');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // getInboxRequest is stable for the current render; this effect follows auth/project changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens?.selected_project_id, tokens?.token, tokens?.username]);

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
                            tags: socketChat.tags || existingChat?.tags || [],
                            labels: socketChat.labels || existingChat?.labels || [],
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
                            tags: socketChat.tags || existingChat?.tags || [],
                            labels: socketChat.labels || existingChat?.labels || [],
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
                        tags: socketChat.tags || existingChat?.tags || [],
                        labels: socketChat.labels || existingChat?.labels || [],
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
                inbox_status: apiChat.inbox_status || 'open',
                tags: Array.isArray(apiChat.contact.tags) ? apiChat.contact.tags : [],
                labels: Array.isArray(apiChat.contact.labels) ? apiChat.contact.labels : [],
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
        const requestId = ++filterRequestId.current;
        const projectId = tokens.selected_project_id || '';
        if (pageToFetch === 1) setChatListError('');

        if (pageToFetch > 1) {
            setLoadingMore(true);
        }

        try {
            // Use the currently selected project ID (fallback to first project if needed)
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

            if (requestId !== filterRequestId.current || selectedProjectIdRef.current !== projectId) return;
            if (!response.data.error && response.data.data) {
                const apiData = response.data.data;
                const meta = response.data.meta;
                const hasMoreFromMeta = meta ? !!meta.hasMore : apiData.length >= PAGE_LIMIT;
                setHasMore(hasMoreFromMeta);
                setPage(pageToFetch);

                await processApiResponse(apiData, append, () =>
                    requestId === filterRequestId.current && selectedProjectIdRef.current === projectId
                );
            } else {
                setHasMore(false);
                setChatListError(typeof response.data?.error === 'string'
                    ? response.data.error
                    : response.data?.error?.message || 'Could not load conversations.');
            }
        } catch (error) {
            if (requestId !== filterRequestId.current || selectedProjectIdRef.current !== projectId) return;
            console.error('Failed to sync conversations:', error);
            setChatListError(error.message || 'Could not load conversations.');
        } finally {
            if (requestId === filterRequestId.current && selectedProjectIdRef.current === projectId) {
                setIsLoading(false);
                setLoadingMore(false);
            }
        }
    };

    // Realtime search/filter: hits the API directly with the current search
    // text and active tab, and renders straight from the response. This is
    // NOT saved back into the local cache — the local cache stays a mirror
    // of the unfiltered "All" list (kept fresh by syncWithAPI above), while
    // this path is purely for what's currently on screen.
    const fetchFilteredChats = async (search, tab, pageToFetch = 1, append = false, tagId = selectedLabelId) => {
        if (!tokens) return;
        if (pageToFetch === 1) setChatListError('');

        const requestId = ++filterRequestId.current;
        const projectId = tokens.selected_project_id || '';
        if (pageToFetch === 1) {
            setIsFiltering(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const filterValue = mapTabToFilter(tab);

            const messagePayload = {
                project_id: projectId,
                page: pageToFetch,
                limit: PAGE_LIMIT,
                search: search || '',
                filter: filterValue,
                filter_type: filterValue,
                type: filterValue,
                view: filterValue,
                ...(tagId ? { tag_id: tagId } : {})
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
            if (requestId !== filterRequestId.current || selectedProjectIdRef.current !== projectId) return;

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
                setChatListError(typeof response.data?.error === 'string'
                    ? response.data.error
                    : response.data?.error?.message || 'Could not load conversations.');
            }
        } catch (error) {
            if (requestId !== filterRequestId.current || selectedProjectIdRef.current !== projectId) return;
            console.error('Failed to fetch filtered chats:', error);
            setChatListError(error.message || 'Could not load conversations.');
        } finally {
            if (requestId === filterRequestId.current && selectedProjectIdRef.current === projectId) {
                setIsFiltering(false);
                setLoadingMore(false);
                setIsLoading(false);
            }
        }
    };

    // Load next page of chats when scrolled to bottom
    const loadMoreChats = () => {
        if (isLoading || isFiltering || loadingMore || !hasMore) return;
        const nextPage = page + 1;
        if (searchQuery || activeTab !== 'All' || selectedLabelId) {
            fetchFilteredChats(searchQuery, activeTab, nextPage, true, selectedLabelId);
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
    }, [searchQuery, activeTab, selectedLabelId, tokens]);

    // Refresh chat list when cases are edited/created elsewhere
    useEffect(() => {
        const handler = () => {
            // Re-sync to refresh case_open_count + latest chat data for
            // whatever view (search/filter) is currently active.
            if (searchQuery || activeTab !== 'All' || selectedLabelId) {
                fetchFilteredChats(searchQuery, activeTab, 1, false, selectedLabelId);
            } else {
                syncWithAPI(1, false);
            }
        };
        window.addEventListener('case_updated', handler);
        return () => window.removeEventListener('case_updated', handler);
        // Intentionally depends on tokens so sync uses latest auth
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens, searchQuery, activeTab, selectedLabelId]);

    useEffect(() => {
        let refreshTimer;
        const unsubscribe = socketManager.onMessage((messageData) => {
            if (messageData?.changes) return;
            clearTimeout(refreshTimer);
            refreshTimer = setTimeout(() => refreshVisibleChats(), 300);
        });
        return () => {
            clearTimeout(refreshTimer);
            unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens, searchQuery, activeTab, selectedLabelId]);

    useEffect(() => {
        const handler = () => {
            if (searchQuery || activeTab !== 'All' || selectedLabelId) {
                fetchFilteredChats(searchQuery, activeTab, 1, false, selectedLabelId);
            } else {
                syncWithAPI(1, false);
            }
        };
        window.addEventListener('conversation_labels_updated', handler);
        return () => window.removeEventListener('conversation_labels_updated', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokens, searchQuery, activeTab, selectedLabelId]);

    const processApiResponse = async (apiChats, append = false, isCurrent = () => true) => {
        try {
            // Build list from API response
            const chatListFromApi = mapApiChats(apiChats);
            if (!isCurrent()) return;

            if (dbAvailable) {
                // Get current local chats to merge (preserve local name when API returns empty)
                const localChats = await dbHelper.getChats();
                if (!isCurrent()) return;
                const mergedList = chatListFromApi.map(apiChat => {
                    const local = localChats.find(c => c.number === apiChat.number);
                    const name = (apiChat.name && String(apiChat.name).trim() !== '')
                        ? apiChat.name
                        : (local?.name && String(local.name).trim() !== '' ? local.name : apiChat.number);
                    return { ...apiChat, name };
                });
                await dbHelper.saveChats(mergedList);
                const updatedChats = await dbHelper.getChats();
                if (!isCurrent()) return;
                setChats(updatedChats);
            } else {
                if (!isCurrent()) return;
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
            setChatListError(error.message || 'Could not update the conversation list.');
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
                return message ? <WhatsAppText text={message} /> : 'Message';
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
                return message ? <WhatsAppText text={message} /> : 'Message';
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

    const toggleConversationSelection = (number) => {
        if (selectedNumbers.includes(number)) {
            setSelectedNumbers(selectedNumbers.filter((selected) => selected !== number));
            setBulkActionMessage('');
            return;
        }
        if (selectedNumbers.length >= 200) {
            setBulkActionMessage('Bulk actions are limited to 200 conversations. Deselect some before adding more.');
            return;
        }
        setSelectedNumbers([...selectedNumbers, number]);
        setBulkActionMessage('');
    };

    const getInboxRequest = async (endpoint, payload) => {
        const { data, key } = Encrypt({ project_id: tokens?.selected_project_id || '', ...payload });
        const response = await axios.post(
            `${API_BASE_URL}/inbox/${endpoint}`,
            JSON.stringify({ data, key }),
            {
                headers: {
                    token: tokens?.token,
                    username: tokens?.username,
                    'Content-Type': 'application/json'
                }
            }
        );
        if (response.data?.error) {
            const message = typeof response.data.error === 'string'
                ? response.data.error
                : response.data.error?.message;
            throw new Error(message || response.data?.msg || 'Inbox request failed');
        }
        return response.data;
    };

    const refreshVisibleChats = () => {
        if (!searchQuery && activeTab === 'All' && !selectedLabelId) {
            return syncWithAPI(1, false);
        }
        return fetchFilteredChats(searchQuery, activeTab, 1, false, selectedLabelId);
    };
    const refreshVisibleChatsRef = useRef(refreshVisibleChats);
    refreshVisibleChatsRef.current = refreshVisibleChats;

    useEffect(() => () => {
        snoozeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
        snoozeRefreshTimers.current.clear();
    }, []);

    const scheduleSnoozeRefresh = (until) => {
        const targetTime = new Date(until).getTime();
        if (!Number.isFinite(targetTime)) {
            console.error('Received an invalid snooze deadline:', until);
            return;
        }
        snoozeRefreshTimers.current.forEach((timer) => clearTimeout(timer));
        snoozeRefreshTimers.current.clear();
        const schedule = () => {
            const delay = Math.min(Math.max(targetTime - Date.now(), 1000), 2_000_000_000);
            const timer = setTimeout(() => {
                snoozeRefreshTimers.current.delete(timer);
                if (Date.now() < targetTime) schedule();
                else {
                    refreshVisibleChatsRef.current();
                    loadNextSnoozeRef.current?.();
                }
            }, delay);
            snoozeRefreshTimers.current.add(timer);
        };
        schedule();
    };

    const downloadConversationExport = (rows) => {
        const columns = ['number', 'name', 'message', 'message_type', 'type', 'create_date', 'assigned_to'];
        const escapeCell = (value) => {
            let text = value === null || value === undefined ? '' : String(value);
            if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
            return `"${text.replace(/"/g, '""')}"`;
        };
        const csv = [
            columns.join(','),
            ...rows.map((row) => columns.map((column) => escapeCell(row[column])).join(','))
        ].join('\r\n');
        const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `conversations-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const runBulkAction = async () => {
        if (!bulkAction || selectedNumbers.length === 0 || bulkActionLoading) return;
        if (bulkAction === 'assign' && !bulkTarget.trim()) {
            setBulkActionMessage('Enter an active project member username to assign these conversations.');
            return;
        }
        if (bulkAction === 'label' && !bulkTagId) {
            setBulkActionMessage('Choose a project label first.');
            return;
        }
        const actionNames = { assign: 'assign', label: `${bulkLabelAction} the selected label on`, close: 'close', export: 'export' };
        if (!window.confirm(`Are you sure you want to ${actionNames[bulkAction]} ${selectedNumbers.length} selected conversation(s)?`)) return;

        const actionContext = { ...inboxContextRef.current };
        setBulkActionLoading(true);
        setBulkActionMessage('');
        try {
            const result = await getInboxRequest('bulk-actions', {
                action: bulkAction,
                numbers: selectedNumbers,
                ...(bulkAction === 'assign' ? { target: bulkTarget.trim() } : {}),
                ...(bulkAction === 'label' ? { tag_id: bulkTagId, label_action: bulkLabelAction } : {})
            });
            const currentContext = inboxContextRef.current;
            if (currentContext.projectId !== actionContext.projectId ||
                currentContext.activeTab !== actionContext.activeTab ||
                currentContext.searchQuery !== actionContext.searchQuery ||
                currentContext.selectedLabelId !== actionContext.selectedLabelId) return;
            if (!Array.isArray(result.results) || result.results.length !== selectedNumbers.length) {
                throw new Error('The server returned an incomplete bulk-action result. Your selection was kept.');
            }
            const results = result.results;
            const selectedNumberSet = new Set(selectedNumbers);
            if (results.some((item) =>
                !item ||
                !selectedNumberSet.has(item.number) ||
                typeof item.success !== 'boolean'
            )) {
                throw new Error('The server returned an invalid bulk-action result. Your selection was kept.');
            }
            const failedNumbers = results.filter((item) => !item.success).map((item) => item.number);
            const succeeded = results.length - failedNumbers.length;

            if (bulkAction === 'export') {
                if (!Array.isArray(result.data) || result.data.length !== succeeded) {
                    throw new Error('The server returned an incomplete export. Please retry.');
                }
                const rows = result.data;
                if (rows.length) downloadConversationExport(rows);
            }
            setSelectedNumbers(failedNumbers);
            setBulkActionMessage(
                `${succeeded} succeeded${failedNumbers.length ? `; ${failedNumbers.length} failed: ${results.filter((item) => !item.success).map((item) => `${item.number} (${item.error})`).join(', ')}` : ''}`
            );
            if (succeeded > 0 && bulkAction !== 'export') refreshVisibleChatsRef.current();
        } catch (error) {
            if (inboxContextRef.current.projectId !== actionContext.projectId) return;
            console.error('Inbox bulk action failed:', error);
            setBulkActionMessage(error.message || 'The bulk action failed. Your selection was kept.');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const openSnoozeDialog = (chat) => {
        const localDefault = new Date(Date.now() + 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        setSnoozeChat(chat);
        setSnoozeMode('time');
        setSnoozeUntil(localDefault);
    };

    const submitSnooze = async () => {
        if (!snoozeChat || snoozeLoading) return;
        const projectId = tokens?.selected_project_id || '';
        let payload;
        if (snoozeMode === 'time') {
            const until = new Date(snoozeUntil);
            if (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now()) {
                setBulkActionMessage('Choose a snooze time in the future.');
                return;
            }
            payload = { number: snoozeChat.number, until: until.toISOString() };
        } else {
            payload = { number: snoozeChat.number, until_next_reply: true };
        }

        setSnoozeLoading(true);
        try {
            await getInboxRequest('snooze', payload);
            if (selectedProjectIdRef.current !== projectId) return;
            setChats((current) => current.filter((chat) => chat.number !== snoozeChat.number));
            if (snoozeMode === 'time') loadNextSnoozeRef.current?.();
            setSnoozeChat(null);
            setBulkActionMessage(`${snoozeChat.name || snoozeChat.number} snoozed.`);
            try {
                await onChatSnoozed?.(snoozeChat.number);
            } catch (cacheError) {
                console.error('Snoozed conversation but could not update the local chat cache:', cacheError);
                setBulkActionMessage('Conversation snoozed, but the local cache could not be updated. Refresh the inbox if it reappears.');
            }
            refreshVisibleChatsRef.current();
        } catch (error) {
            if (selectedProjectIdRef.current !== projectId) return;
            console.error('Failed to snooze conversation:', error);
            setBulkActionMessage(error.message || 'Could not snooze this conversation.');
        } finally {
            setSnoozeLoading(false);
        }
    };

    return (
        <>
            <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                        <FiSearch className="text-gray-500 dark:text-gray-400 mr-2 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search names, numbers, or messages"
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
            <div className="flex overflow-x-auto border-b scrollbar-hide" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
                {['All', 'My Open', 'Unassigned', 'SLA Breach', 'VIP', 'Unread', 'Favourites', 'Assigned'].map((tab) => {
                    // Show total unread count badge on "All" tab
                    const showUnreadBadge = tab === 'All' && totalUnreadCount > 0;

                    return (
                        <button
                            key={tab}
                            title={tab === 'SLA Breach' ? 'Open chats with an unanswered customer message older than one hour' : undefined}
                            className={`flex-shrink-0 min-w-[76px] px-3 py-3 text-sm font-medium relative flex items-center justify-center gap-2 ${activeTab === tab
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
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
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

            <div className="border-b px-3 py-2 space-y-2" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (chats.length > 0 && chats.every((chat) => selectedNumbers.includes(chat.number))) {
                                setSelectedNumbers(selectedNumbers.filter((number) => !chats.some((chat) => chat.number === number)));
                            } else {
                                const nextSelection = [...new Set([...selectedNumbers, ...chats.map((chat) => chat.number)])];
                                if (nextSelection.length > 200) {
                                    setBulkActionMessage('Bulk actions are limited to 200 conversations. Deselect some before selecting this page.');
                                    return;
                                }
                                setBulkActionMessage('');
                                setSelectedNumbers(nextSelection);
                            }
                        }}
                        disabled={!chats.length || bulkActionLoading}
                        className="text-xs text-blue-600 dark:text-blue-400 disabled:opacity-50"
                    >
                        {chats.length > 0 && chats.every((chat) => selectedNumbers.includes(chat.number)) ? 'Deselect loaded' : 'Select loaded'}
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedNumbers.length} selected (max 200)
                    </span>
                    <select
                        value={bulkAction}
                        onChange={(event) => { setBulkAction(event.target.value); setBulkActionMessage(''); }}
                        className="ml-auto min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        aria-label="Bulk action"
                    >
                        <option value="">Bulk action...</option>
                        <option value="assign">Assign</option>
                        <option value="label">Add/remove label</option>
                        <option value="close">Close</option>
                        <option value="export">Export CSV</option>
                    </select>
                    <button
                        type="button"
                        onClick={runBulkAction}
                        disabled={!bulkAction || !selectedNumbers.length || bulkActionLoading}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                        {bulkActionLoading ? 'Working...' : 'Apply'}
                    </button>
                </div>
                {bulkAction === 'assign' && (
                    <>
                        <select
                            value={bulkTarget}
                            onChange={(event) => setBulkTarget(event.target.value)}
                            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            aria-label="Assign to project member"
                        >
                            <option value="">Choose an active project member...</option>
                            {assignmentMembers.map((member) => (
                                <option key={member.username} value={member.username}>
                                    {member.name || member.username} ({member.username})
                                </option>
                            ))}
                        </select>
                        {assignmentMembersError && <p role="alert" className="text-xs text-red-600">{assignmentMembersError}</p>}
                    </>
                )}
                {bulkAction === 'label' && (
                    <div className="flex gap-2">
                        <select
                            value={bulkLabelAction}
                            onChange={(event) => setBulkLabelAction(event.target.value)}
                            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            aria-label="Label operation"
                        >
                            <option value="add">Add</option>
                            <option value="remove">Remove</option>
                        </select>
                        <select
                            value={bulkTagId}
                            onChange={(event) => setBulkTagId(event.target.value)}
                            className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                            aria-label="Label"
                        >
                            <option value="">Choose a label...</option>
                            {labelCatalog.map((label) => <option key={label.tag_id} value={label.tag_id}>{label.name}</option>)}
                        </select>
                        {labelCatalogError && <p role="alert" className="self-center text-xs text-red-600">{labelCatalogError}</p>}
                    </div>
                )}
                {bulkActionMessage && (
                    <p role="status" className="break-words text-xs text-gray-600 dark:text-gray-300">{bulkActionMessage}</p>
                )}
            </div>

            {labelCatalog.length > 0 && (
                <div className="border-b px-3 py-2" aria-label="Filter conversations by label">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Conversation labels</p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    <button
                        type="button"
                        onClick={() => setSelectedLabelId('')}
                        className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                            selectedLabelId
                                ? 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
                                : 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                        aria-pressed={!selectedLabelId}
                    >
                        All labels
                    </button>
                    {labelCatalog.map((label) => {
                        const selected = selectedLabelId === label.tag_id;
                        const color = label.color || '#6366f1';
                        return (
                            <button
                                key={label.tag_id}
                                type="button"
                                onClick={() => setSelectedLabelId(selected ? '' : label.tag_id)}
                                className="flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium"
                                style={{
                                    borderColor: selected ? color : `${color}80`,
                                    backgroundColor: selected ? `${color}20` : 'transparent',
                                    color
                                }}
                                aria-pressed={selected}
                            >
                                {label.name}
                            </button>
                        );
                    })}
                    </div>
                </div>
            )}
            {chatListError && (
                <div role="alert" className="flex items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                    <span>{chatListError}</span>
                    <button type="button" onClick={refreshVisibleChats} className="font-semibold underline">Retry</button>
                </div>
            )}

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
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedNumbers.includes(chat.number)}
                                                        onChange={() => toggleConversationSelection(chat.number)}
                                                        onClick={(event) => event.stopPropagation()}
                                                        disabled={bulkActionLoading}
                                                        aria-label={`Select ${chat.name || chat.number}`}
                                                        className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-brand-100 text-brand-800 font-semibold">
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
                                                                {chat.inbox_status === 'closed' && (
                                                                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">Closed</span>
                                                                )}
                                                                        {chat.tags?.slice(0, 2).map((tag) => (
                                                                            <span
                                                                                key={tag.tag_id}
                                                                                className="max-w-[100px] truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                                                style={{
                                                                                    backgroundColor: `${tag.color || '#6366f1'}25`,
                                                                                    color: tag.color || '#6366f1'
                                                                                }}
                                                                                title={`Contact tag: ${tag.name}`}
                                                                            >
                                                                                <span className="opacity-70">Tag:</span> {tag.name}
                                                                            </span>
                                                                        ))}
                                                                        {(chat.tags?.length || 0) > 2 && (
                                                                            <span className="text-[10px] text-gray-500 dark:text-gray-400" title={chat.tags.slice(2).map((tag) => tag.name).join(', ')}>
                                                                                +{chat.tags.length - 2}
                                                                            </span>
                                                                        )}
                                                                        {chat.labels?.slice(0, 2).map((label) => (
                                                                            <span
                                                                                key={`label-${label.tag_id}`}
                                                                                className="max-w-[110px] truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                                                                                style={{
                                                                                    borderColor: `${label.color || '#6366f1'}80`,
                                                                                    color: label.color || '#6366f1'
                                                                                }}
                                                                                title={`Conversation label: ${label.name}`}
                                                                            >
                                                                                <span className="opacity-70">Label:</span> {label.name}
                                                                            </span>
                                                                        ))}
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
                                                                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-xs font-semibold flex items-center justify-center">
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
                                                        <div className="mt-1 flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={(event) => { event.stopPropagation(); openSnoozeDialog(chat); }}
                                                                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-gray-500 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
                                                                aria-label={`Snooze ${chat.name || chat.number}`}
                                                            >
                                                                <FiClock className="h-3 w-3" />
                                                                Snooze
                                                            </button>
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

            <AnimatedModal open={Boolean(snoozeChat)}>
                {snoozeChat && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !snoozeLoading && setSnoozeChat(null)}>
                        <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-800" onClick={(event) => event.stopPropagation()}>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Snooze conversation</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{snoozeChat.name || snoozeChat.number}</p>
                            <div className="mt-4 space-y-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <input type="radio" name="snooze-mode" checked={snoozeMode === 'time'} onChange={() => setSnoozeMode('time')} />
                                    Until a date and time
                                </label>
                                {snoozeMode === 'time' && (
                                    <input
                                        type="datetime-local"
                                        value={snoozeUntil}
                                        onChange={(event) => setSnoozeUntil(event.target.value)}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                                        aria-label="Snooze until"
                                    />
                                )}
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <input type="radio" name="snooze-mode" checked={snoozeMode === 'reply'} onChange={() => setSnoozeMode('reply')} />
                                    Until the next customer reply
                                </label>
                            </div>
                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSnoozeChat(null)}
                                    disabled={snoozeLoading}
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={submitSnooze}
                                    disabled={snoozeLoading}
                                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                                >
                                    {snoozeLoading ? 'Saving...' : 'Snooze'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatedModal>

            {/* Direct Chat Modal */}
            <AnimatedModal open={showDirectChatModal}>
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
            </AnimatedModal>

            {/* Repair Chats Confirm Modal */}
            <AnimatedModal open={showRepairChatsModal}>
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
            </AnimatedModal>

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