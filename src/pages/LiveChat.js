import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ChatList from './ChatList';
import Conversation from './Conversation';
import { dbHelper, contactDbHelper } from './db';
import { socketManager } from './socket';
import { FiArrowLeft, FiSun, FiMoon, FiLock } from 'react-icons/fi';
import { Header, Sidebar } from '../component/Menu';

function LiveChat() {
    const navigate = useNavigate();
    const location = useLocation();
    const { phone } = useParams();
    const [tokens, setTokens] = useState(null);
    const [activeChat, setActiveChat] = useState(null);
    const [darkMode, setDarkMode] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [dbAvailable, setDbAvailable] = useState(false);
    const [chats, setChats] = useState([]);
    const [messages, setMessages] = useState([]);
    const [assignmentUpdate, setAssignmentUpdate] = useState(null);
    const [repairVersion, setRepairVersion] = useState(0);
    const previousLocationRef = useRef(null);
    const isBackNavigationRef = useRef(false);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        if (isFullScreen) {
            setMobileMenuOpen(false);
        }
    }, [isFullScreen]);

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && isFullScreen) {
                setIsFullScreen(false);
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isFullScreen]);

    const handleToggleFullScreen = () => {
        setIsFullScreen((prev) => !prev);
    };

    // Initialize app
    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            // Check session data first
            const sessionData = localStorage.getItem("userData");
            if (!sessionData) {
                navigate("/login");
                return;
            }

            const parsedData = JSON.parse(sessionData);
            if (!parsedData || typeof parsedData !== "object") {
                navigate("/login");
                return;
            }

            // Initialize chat database for the currently selected project
            let dbInitSuccess = false;
            const selectedProjectId = parsedData.selected_project_id;

            if (selectedProjectId) {
                dbInitSuccess = await dbHelper.init(selectedProjectId || 'default_project');
                setDbAvailable(dbInitSuccess);
            } else {
                console.warn('No project_id found for LiveChat DB init, falling back to disabled DB state');
            }

            setTokens(parsedData);
            setIsInitialized(true);

            // Initialize socket connection
            socketManager.connect(parsedData.token, parsedData.username);

            // Load initial data with the actual db status
            await loadInitialData(dbInitSuccess);

        } catch (error) {
            console.error('Initialization error:', error);
            // Fallback to localStorage only
            navigate("/login");
        }
    };

    const loadInitialData = async (dbAvailableParam = null) => {
        try {
            // Load chats from database first
            // Use the parameter if provided, otherwise fall back to state
            const shouldLoad = dbAvailableParam !== null ? dbAvailableParam : dbAvailable;
            let localChats = [];
            if (shouldLoad) {
                localChats = await dbHelper.getChats();
                setChats(localChats);
            }

        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    };

    const handleRepairChats = async () => {
        const projectId = tokens?.selected_project_id || 'default_project';
        setDbAvailable(false);
        await dbHelper.deleteDatabase();
        await contactDbHelper.deleteDatabase();
        const ok = await dbHelper.init(projectId);
        await contactDbHelper.init(projectId);
        setDbAvailable(ok);
        if (activeChat) setRepairVersion((v) => v + 1);
    };

    // Sync activeChat with URL phone parameter
    useEffect(() => {
        if (!isInitialized) return;

        if (phone) {
            // Find the chat with matching phone number
            const chat = chats.find(c => c.number === phone);
            if (chat) {
                // Only update if the activeChat is different or doesn't exist
                setActiveChat(prev => {
                    if (!prev || prev.number !== phone) {
                        return chat;
                    }
                    return prev;
                });
            } else {
                // Phone in URL but chat not found - create a new chat object for any phone number
                // This allows opening conversations for phone numbers that don't have existing chats
                const newChat = {
                    number: phone,
                    name: phone, // Use phone number as name initially, will be updated if contact details are fetched
                    unread_count: 0,
                    unread: false,
                    is_favorite: false,
                    timestamp: Date.now(),
                    create_date: new Date().toISOString(),
                    type: 'out',
                    message_type: 'text',
                    message: '',
                    status: 'pending',
                    unique_id: '',
                    last_id: '',
                    send_by_username: '',
                    send_by_mobile: ''
                };

                setActiveChat(prev => {
                    if (!prev || prev.number !== phone) {
                        return newChat;
                    }
                    return prev;
                });
            }
        } else {
            // Always clear activeChat when no phone in URL (no need to wait for db/chats)
            setActiveChat(null);
        }
    }, [phone, chats, isInitialized, dbAvailable]);

    // Set up socket listeners
    useEffect(() => {
        if (!isInitialized) return;

        const unsubscribeMessage = socketManager.onMessage(async (messageData) => {
            console.log('🔄 New message received via socket:', messageData);

            // Check if this is a message status update
            if (messageData.changes && ['sent', 'delivered', 'read', 'failed'].includes(messageData.changes)) {
                console.log('📊 Message status update received:', messageData);

                // Refresh messages for active chat if it's affected
                if (activeChat?.number && dbAvailable) {
                    const updatedMessage = await dbHelper.getMessages(activeChat.number);
                    setMessages([...updatedMessage]);
                }

                // Refresh chat list to show updated status
                if (dbAvailable) {
                    const updatedChats = await dbHelper.getChats();
                    console.log('✅ Refreshing chat list after status update:', updatedChats.length);
                    setChats([...updatedChats]);
                }
                return;
            }

            // Handle regular message updates
            // Refresh chats to show updated data
            if (dbAvailable) {
                const updatedChats = await dbHelper.getChats();
                setChats([...updatedChats]);

                if (activeChat?.number) {
                    const updatedMessage = await dbHelper.getMessages(activeChat.number);
                    setMessages([...updatedMessage]);
                }
            }

            // If active chat is the one receiving message, refresh messages
            if (activeChat) {
                const messageChatNumber = messageData.send_by?.mobile || messageData.read_by?.mobile;
                if (messageChatNumber === activeChat.number) {
                    // Trigger refresh in Conversation component
                    setActiveChat(prev => ({ ...prev, refresh: Date.now() }));
                }
            }
        });

        const unsubscribeAssignment = socketManager.onAssignment((assignData) => {
            console.log('🔄 chat_assigned received via socket:', assignData);
            setAssignmentUpdate(assignData);
        });

        const unsubscribeCaseStatus = socketManager.onCaseStatus(async () => {
            if (dbAvailable) {
                const updatedChats = await dbHelper.getChats();
                setChats([...updatedChats]);
            }
        });

        return () => {
            unsubscribeMessage();
            unsubscribeAssignment();
            unsubscribeCaseStatus();
        };
    }, [isInitialized, activeChat, dbAvailable]);

    // Set dark mode class on body
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Handle ESC key to go back to live-chat page
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                // Only navigate if we're on a chat page (has phone parameter)
                if (phone) {
                    setActiveChat(null);
                    navigate('/live-chat', { replace: true });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [phone, navigate]);

    // Handle browser back button navigation
    useEffect(() => {
        const handlePopState = () => {
            // Mark that this is a back navigation (not manual)
            isBackNavigationRef.current = true;
        };

        // Listen to popstate events (browser back/forward)
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    // Handle location changes and redirect if needed
    useEffect(() => {
        const currentPath = location.pathname;

        // If this is a back navigation (popstate) and we're on a phone route
        if (isBackNavigationRef.current) {
            // If we're on /live-chat/:phone, redirect to /live-chat
            if (currentPath.startsWith('/live-chat/') && currentPath !== '/live-chat') {
                // Redirect to /live-chat instead
                navigate('/live-chat', { replace: true });
                isBackNavigationRef.current = false;
                previousLocationRef.current = '/live-chat';
                return;
            }
            isBackNavigationRef.current = false;
        }

        // Update previous location
        previousLocationRef.current = currentPath;
    }, [location.pathname, navigate]);

    const handleChatSelect = (chat) => {
        setActiveChat(chat);
        // Mark as manual navigation (not back button)
        isBackNavigationRef.current = false;
        navigate(`/live-chat/${chat.number}`);
    };

    const handleBackToChatList = () => {
        setActiveChat(null);
        navigate('/live-chat', { replace: true });
    };

    const handleMessageStatusUpdate = async (chatNumber, messageId, status) => {
        try {
            console.log('🔄 handleMessageStatusUpdate called:', { chatNumber, messageId, status });
            // Refresh the chat list to show updated status
            if (dbAvailable) {
                const updatedChats = await dbHelper.getChats();
                console.log('✅ Updated chats fetched from DB:', updatedChats.length);
                // Create a new array reference to trigger React re-render
                setChats([...updatedChats]);
            }
        } catch (error) {
            console.error('Error updating chat list after status change:', error);
        }
    };

    const handleContactUpdate = async (chatNumber, contactName) => {
        try {
            console.log('🔄 handleContactUpdate called:', { chatNumber, contactName });
            // Refresh the chat list to show updated contact name
            if (dbAvailable) {
                const updatedChats = await dbHelper.getChats();
                console.log('✅ Updated chats fetched from DB after contact update:', updatedChats.length);
                // Create a new array reference to trigger React re-render
                setChats([...updatedChats]);

                // Also update activeChat if it matches the updated contact
                if (activeChat?.number === chatNumber) {
                    const updatedActiveChat = updatedChats.find(chat => chat.number === chatNumber);
                    if (updatedActiveChat) {
                        setActiveChat(updatedActiveChat);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating chat list after contact update:', error);
        }
    };

    if (!isInitialized) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900"
            >
                <div className="text-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"
                    />
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-4 text-gray-600 dark:text-gray-400"
                    >
                        Initializing chat...
                    </motion.p>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900"
        >

            <Header
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
                isFullScreen={isFullScreen}
            />
            <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
                isFullScreen={isFullScreen}
            />

            <motion.div
                className="flex flex-1 overflow-hidden w-full"
                initial={false}
                animate={{
                    paddingTop: isFullScreen ? 0 : 'calc(4rem + var(--subscription-alert-height, 0px))',
                }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
                <motion.div
                    layout
                    className={`flex flex-1 overflow-hidden w-full transition-[padding] duration-300 ease-in-out ${
                        isFullScreen ? 'md:pl-0' : (isMinimized ? 'md:pl-20' : 'md:pl-[260px]')
                    }`}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >

                {/* Header */}
                {/* <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center justify-between p-2 pl-4 pr-4 border-b dark:border-gray-700 bg-gradient-to-r from-green-500 to-green-600 text-white"
                >

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30"
                    >
                        <FiArrowLeft className="w-4 h-4" />
                    </motion.button>
                    <div className="flex items-center">
                        <h1 className="text-md font-semibold">WhatsApp Chat</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDarkMode(!darkMode)}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30"
                        >
                            {darkMode ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
                        </motion.button>
                    </div>
                </motion.div> */}

                {/* Main Container */}
                <div className={`flex flex-1 overflow-hidden`}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeChat ? 'chat-list-hidden' : 'chat-list-visible'}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            className={`w-full md:w-1/3 border-r flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}
                        >
                            <ChatList
                                tokens={tokens}
                                onChatSelect={handleChatSelect}
                                activeChat={activeChat}
                                darkMode={darkMode}
                                dbAvailable={dbAvailable}
                                socket_chats={chats}
                                onRepairChats={handleRepairChats}
                                isFullScreen={isFullScreen}
                                onToggleFullScreen={handleToggleFullScreen}
                            />
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        {activeChat ? (
                            <motion.div
                                key="conversation-active"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className={`w-full md:w-2/3 flex flex-col ${activeChat ? 'flex' : 'hidden md:flex'}`}
                            >
                                <Conversation
                                    key={`${activeChat?.number ?? 'none'}-${repairVersion}`}
                                    activeChat={activeChat}
                                    tokens={tokens}
                                    onBack={handleBackToChatList}
                                    darkMode={darkMode}
                                    dbAvailable={dbAvailable}
                                    refresh={activeChat.refresh}
                                    socketMessage={messages}
                                    socketAssigning={assignmentUpdate}
                                    onMessageStatusUpdate={handleMessageStatusUpdate}
                                    onContactUpdate={handleContactUpdate}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="conversation-placeholder"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="flex-1 hidden md:flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-8"
                            >
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-full shadow-xl relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-green-500/10 dark:bg-green-500/20 blur-xl rounded-full"></div>
                                    <img src="/logo.png" alt="OneChatting" className="w-20 h-20 object-cover relative z-10 rounded-2xl" />
                                </motion.div>

                                <motion.h2
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3"
                                >
                                    Welcome to 1Chat
                                </motion.h2>

                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-gray-500 dark:text-gray-400 max-w-md text-lg leading-relaxed"
                                >
                                    Select a conversation from the sidebar to start messaging, or create a new one to connect with your contacts.
                                </motion.p>

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="mt-12 flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full"
                                >
                                    <FiLock className="w-4 h-4" />
                                    <span>End-to-end encrypted connection</span>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}

export default LiveChat;