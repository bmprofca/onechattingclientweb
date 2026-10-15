import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Header, Sidebar } from '../component/Menu';
import { getProjectMetaDetails, getEmbedSignupLink, updateWabaProfileDetails, submitWabaId, getEmbeddedSignupConfig } from '../api/auth';
import toast from 'react-hot-toast';
import { uploadFile } from '../utils/uploadFile';
import {
    FiArrowLeft,
    FiCheckCircle, FiAlertCircle, FiTrash2, FiPlus, FiExternalLink, FiRefreshCw
} from 'react-icons/fi';
import ProjectQRModal from '../component/Modals/ProjectQRModal';
import SearchableSelect from '../component/SearchableSelect';
import { LuQrCode } from 'react-icons/lu';

import AnimatedModal from '../component/Modals/AnimatedModal';
// Business type (vertical) options for WABA profile { name: display text, value: API value }
const BUSINESS_VERTICALS = [
    { name: 'UNDEFINED', value: 'UNDEFINED' },
    { name: 'OTHER', value: 'OTHER' },
    { name: 'AUTO', value: 'AUTO' },
    { name: 'BEAUTY', value: 'BEAUTY' },
    { name: 'APPAREL', value: 'APPAREL' },
    { name: 'EDUCATION', value: 'EDU' },
    { name: 'ENTERTAINMENT', value: 'ENTERTAIN' },
    { name: 'EVENT PLAN', value: 'EVENT_PLAN' },
    { name: 'FINANCE', value: 'FINANCE' },
    { name: 'GROCERY', value: 'GROCERY' },
    { name: 'GOVT', value: 'GOVT' },
    { name: 'HOTEL', value: 'HOTEL' },
    { name: 'HEALTH', value: 'HEALTH' },
    { name: 'NON PROFIT ORGANIZATION', value: 'NONPROFIT' },
    { name: 'PROFESSIONAL SERVICES', value: 'PROF_SERVICES' },
    { name: 'RETAIL', value: 'RETAIL' },
    { name: 'TRAVEL', value: 'TRAVEL' },
    { name: 'RESTAURANT', value: 'RESTAURANT' },
    { name: 'NOT A BUSINESS', value: 'NOT_A_BIZ' }
];

const ProjectDetails = () => {
    // --- Routing & UI State ---
    const { projectId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    // --- Data State ---
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isWabaConnected, setIsWabaConnected] = useState(true);
    const [showQrModal, setShowQrModal] = useState(false);
    const [isLoadingSignupLink, setIsLoadingSignupLink] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showManualRefresh, setShowManualRefresh] = useState(false);
    const syncIntervalRef = useRef(null);
    const pollCountRef = useRef(0);
    const wabaIdRef = useRef(null); // Store WABA ID from Facebook event
    const phoneNumberIdRef = useRef(null); // Store Phone Number ID from Facebook event (needed for 'own' provider)
    const [debugLogs, setDebugLogs] = useState([]); // Debug logs for troubleshooting
    const [showDebugPanel, setShowDebugPanel] = useState(false); // Toggle debug panel
    const [showErrorModal, setShowErrorModal] = useState(false); // Error modal state
    const [errorModalMessage, setErrorModalMessage] = useState(''); // Error modal message
    const [countdownSeconds, setCountdownSeconds] = useState(0); // Countdown timer state
    const countdownIntervalRef = useRef(null); // Countdown interval reference

    // --- Meta Tech Provider State (admin-configured: 'own' vs 'aisensy', read entirely from
    // system_tech_providers via GET /project/embedded-signup-config - no hardcoded values here) ---
    // Shape: { error, provider: 'own' | 'aisensy', meta_app_id, meta_config_id, meta_graph_version, solution_id }
    const [techProvider, setTechProvider] = useState(null);
    const [isLoadingProviderConfig, setIsLoadingProviderConfig] = useState(true);

    const waitForFbSdk = (timeoutMs = 15000) => new Promise((resolve, reject) => {
        if (window.FB) {
            resolve();
            return;
        }
        const startedAt = Date.now();
        const poll = () => {
            if (window.FB) {
                resolve();
                return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
                reject(new Error('Facebook SDK failed to load. Please refresh the page and try again.'));
                return;
            }
            setTimeout(poll, 100);
        };
        poll();
    });

    // --- Editing State ---
    const [, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingPicture, setIsUploadingPicture] = useState(false);
    const fileInputRef = useRef(null);
    const [profilePictureFile, setProfilePictureFile] = useState(null);
    const [originalProfilePictureUrl, setOriginalProfilePictureUrl] = useState('');
    const [editForm, setEditForm] = useState({
        about: '',
        description: '',
        vertical: '',
        address: '',
        email: '',
        profile_picture_url: '',
        websites: []
    });

    const activeProjectId = useMemo(() => {
        // Prefer query param: ?project_id=...
        const qp = new URLSearchParams(location?.search || '');
        const queryProjectId = qp.get('project_id');
        if (queryProjectId) return queryProjectId;
        // Backward compatible: /project-details/:projectId
        if (projectId) return projectId;
        // Fallback: selected project in storage
        try {
            const stored = localStorage.getItem('userData');
            const parsed = stored ? JSON.parse(stored) : null;
            return parsed?.selected_project_id || '';
        } catch (e) {
            return '';
        }
    }, [location?.search, projectId]);

    // --- Helper Functions ---
    const addDebugLog = (message, data = null) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            time: timestamp,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        setDebugLogs(prev => [...prev, logEntry]);
        console.log(`[${timestamp}] ${message}`, data || '');
    };

    // --- Effects ---
    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    // Prevent background scrolling when mobile menu is open
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

    useEffect(() => {
        fetchData();
    }, [activeProjectId]);

    // Cleanup intervals on unmount
    useEffect(() => {
        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (!activeProjectId) throw new Error("Project ID missing");

            const response = await getProjectMetaDetails({ project_id: activeProjectId });

            if (response?.data) {
                setData(response.data);
                // Check if WABA is connected
                const wabaConnected = response.data.is_waba_connected !== false;
                setIsWabaConnected(wabaConnected);

                // Only initialize form if profile exists (WABA is connected)
                if (wabaConnected && response.data.profile) {
                    const profilePictureUrl = response.data.profile?.profile_picture_url || '';
                    // Initialize form with fetched data
                    setEditForm({
                        about: response.data.profile?.about || '',
                        description: response.data.profile?.description || '',
                        vertical: response.data.profile?.vertical || '',
                        address: response.data.profile?.address || '',
                        email: response.data.profile?.email || '',
                        profile_picture_url: profilePictureUrl,
                        websites: response.data.profile?.websites || []
                    });
                    setOriginalProfilePictureUrl(profilePictureUrl);
                }
            } else {
                setError(response.msg || "Failed to load data");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers ---
    const handleProfilePictureClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleProfilePictureChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            toast.error('Please select an image file');
            return;
        }

        // Validate file size (e.g., 5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image size must be less than 5MB');
            toast.error('Image size must be less than 5MB');
            return;
        }

        setIsUploadingPicture(true);
        setError(null);

        try {
            // Load tokens
            const stored = localStorage.getItem('userData');
            const parsed = stored ? JSON.parse(stored) : null;
            const token = parsed?.token;
            const username = parsed?.username;

            if (!token || !username) {
                throw new Error('Session expired');
            }

            const { link: imageUrl } = await uploadFile(file);

            // Update form with new image URL
            setEditForm(prev => ({
                ...prev,
                profile_picture_url: imageUrl
            }));
            setProfilePictureFile(file);
            toast.success('Profile picture uploaded successfully');

        } catch (err) {
            console.error('Error uploading profile picture:', err);
            setError(err.message || 'Failed to upload profile picture');
            toast.error(err.message || 'Failed to upload profile picture');
        } finally {
            setIsUploadingPicture(false);
        }
    };

    const handleSave = async () => {
        if (isSaving) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const activeId = activeProjectId;
            if (!activeId) {
                throw new Error("Project ID missing");
            }

            // Get the latest profile data to ensure we have all current values
            const currentProfile = data?.profile || {};

            // Validate profile picture: user must upload one before saving profile details
            const profilePictureUrl = (editForm.profile_picture_url || '').trim();
            if (!profilePictureUrl) {
                toast.error('Please upload a profile picture first.');
                setIsSaving(false);
                return;
            }

            // Update profile details (include profile_picture URL; no separate picture endpoint)
            // Always use current profile data as base, then override with editForm values if they're non-empty
            const payload = {
                project_id: activeId,
                profile_picture: profilePictureUrl,
                // Use editForm value if it's a non-empty string, otherwise use current profile value
                about: (editForm.about && editForm.about.trim() !== '')
                    ? editForm.about
                    : (currentProfile.about || ''),
                address: (editForm.address && editForm.address.trim() !== '')
                    ? editForm.address
                    : (currentProfile.address || ''),
                vertical: (editForm.vertical && editForm.vertical.trim() !== '')
                    ? editForm.vertical
                    : (currentProfile.vertical || ''),
                email: (editForm.email && editForm.email.trim() !== '')
                    ? editForm.email
                    : (currentProfile.email || ''),
                websites: (Array.isArray(editForm.websites) && editForm.websites.length > 0)
                    ? editForm.websites
                    : (Array.isArray(currentProfile.websites) ? currentProfile.websites : []),
                description: (editForm.description && editForm.description.trim() !== '')
                    ? editForm.description
                    : (currentProfile.description || '')
            };

            // Log payload for debugging
            console.log('Profile update payload:', payload);
            console.log('Current profile data:', currentProfile);
            console.log('Edit form data:', editForm);

            const detailsResponse = await updateWabaProfileDetails(payload);

            if (detailsResponse?.error) {
                const msg = typeof detailsResponse.error === 'string' ? detailsResponse.error : (detailsResponse.msg || 'Failed to update profile details');
                throw new Error(msg);
            }

            // Update local state
            setData(prev => ({
                ...prev,
                profile: {
                    ...prev.profile,
                    about: editForm.about,
                    description: editForm.description,
                    vertical: editForm.vertical,
                    address: editForm.address,
                    email: editForm.email,
                    profile_picture_url: editForm.profile_picture_url,
                    websites: editForm.websites
                }
            }));

            setOriginalProfilePictureUrl(editForm.profile_picture_url);
            setProfilePictureFile(null);
            setIsEditing(false);
            setSuccessMessage('Profile updated successfully');
            toast.success('WABA profile updated successfully');

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(null), 5000);

        } catch (err) {
            console.error('Error saving profile:', err);
            const message = err.message || 'Failed to save profile';
            toast.error(message);
            // Don't setError so the form stays visible (no blank screen)
        } finally {
            setIsSaving(false);
        }
    };

    const handleWebsiteChange = (index, value) => {
        const newWebsites = [...editForm.websites];
        newWebsites[index] = value;
        setEditForm({ ...editForm, websites: newWebsites });
    };

    const addWebsite = () => setEditForm({ ...editForm, websites: [...editForm.websites, ''] });

    const removeWebsite = (index) => {
        const newWebsites = editForm.websites.filter((_, i) => i !== index);
        setEditForm({ ...editForm, websites: newWebsites });
    };

    const handleCancel = () => {
        // Reset form to original data
        if (data?.profile) {
            setEditForm({
                about: data.profile?.about || '',
                description: data.profile?.description || '',
                vertical: data.profile?.vertical || '',
                address: data.profile?.address || '',
                email: data.profile?.email || '',
                profile_picture_url: originalProfilePictureUrl,
                websites: data.profile?.websites || []
            });
        }
        setProfilePictureFile(null);
        setError(null);
        setSuccessMessage(null);
        setIsEditing(false);
    };

    // ------------------------------------------------------------------
    // Facebook / Meta Embedded Signup Configuration
    // ------------------------------------------------------------------
    // Everything below is resolved ENTIRELY from the backend, which in turn
    // reads the single active row (is_active = '1') in system_tech_providers.
    // There are NO hardcoded app_id / config_id / graph_version / solution_id
    // values anywhere in this file. Whichever provider is active in the DB
    // ('own' or 'aisensy') just works, because we always use whatever
    // `techProvider` holds after GET /project/embedded-signup-config resolves.
    const resolvedAppId = techProvider?.meta_app_id || '';
    const resolvedConfigId = techProvider?.meta_config_id || '';
    const resolvedGraphVersion = techProvider?.meta_graph_version || 'v21.0';
    const resolvedSolutionId = techProvider?.solution_id || '';

    // Fetches which Meta Tech Provider is currently active (system_tech_providers.is_active = '1')
    // via the shared, authenticated api/auth.js helper (same token/username header pattern used
    // everywhere else in this app - fixes the previous "Session expired" issue on this endpoint).
    const fetchEmbeddedSignupConfig = async () => {
        const response = await getEmbeddedSignupConfig();

        if (response?.error) {
            throw new Error(typeof response.error === 'string' ? response.error : 'Failed to fetch embedded signup config');
        }

        return response; // { error: false, provider: 'own' | 'aisensy', meta_app_id, meta_config_id, meta_graph_version, solution_id }
    };

    // Initialize Facebook SDK - first resolves which tech provider is active, then
    // initializes FB.init with the correct appId/graph version for that provider.
    useEffect(() => {
        let isMounted = true;

        const handleMessage = (event) => {
            try {
                if (!event.origin || !event.origin.includes('facebook.com')) return;

                let data = event.data;
                if (typeof data === "string") {
                    try {
                        data = JSON.parse(data);
                    } catch { }
                }

                if (data && data.type === 'WA_EMBEDDED_SIGNUP') {
                    addDebugLog('WA_EMBEDDED_SIGNUP event received', data);

                    // Handle different events
                    if (data.event === 'FINISH' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
                        addDebugLog('Signup completed successfully', data.data);
                        // Store WABA ID from the event
                        if (data.data && data.data.waba_id) {
                            wabaIdRef.current = data.data.waba_id;
                            addDebugLog('WABA ID stored', { waba_id: data.data.waba_id });
                        } else {
                            addDebugLog('WARNING: No WABA ID in FINISH event', data.data);
                        }
                        // Store Phone Number ID from the event (used by the 'own' provider flow)
                        if (data.data && data.data.phone_number_id) {
                            phoneNumberIdRef.current = data.data.phone_number_id;
                            addDebugLog('Phone Number ID stored', { phone_number_id: data.data.phone_number_id });
                        }
                    } else if (data.event === 'CANCEL') {
                        addDebugLog('Signup cancelled by user');
                        setIsLoadingSignupLink(false);
                        setIsSyncing(false);
                        const cancelMsg = 'WhatsApp signup was cancelled';
                        setError(cancelMsg);
                        setErrorModalMessage(cancelMsg);
                        setShowErrorModal(true);
                        toast.error(cancelMsg);
                    } else if (data.event === 'ERROR') {
                        addDebugLog('Signup error occurred', data);
                        setIsLoadingSignupLink(false);
                        setIsSyncing(false);
                        const errorMsg = data.error_message || 'Failed to complete WhatsApp signup. Please check your Meta App configuration.';
                        setError(errorMsg);
                        setErrorModalMessage(errorMsg);
                        setShowErrorModal(true);
                        toast.error(errorMsg);
                    } else {
                        addDebugLog('Unknown event type', data);
                    }
                }
            } catch (e) {
                console.log("message listener error:", e);
            }
        };

        window.addEventListener('message', handleMessage);

        const init = async () => {
            addDebugLog('Component mounted');
            try {
                addDebugLog('Fetching active Meta Tech Provider config...');
                const config = await fetchEmbeddedSignupConfig();
                if (!isMounted) return;

                addDebugLog('Tech provider config received', config);
                setTechProvider(config);

                // Both fields come straight from the DB-backed API response - no fallback literals.
                const appId = config.meta_app_id || '';
                const graphVer = config.meta_graph_version || 'v21.0';

                if (!appId) {
                    addDebugLog('WARNING: No meta_app_id returned by embedded-signup-config. Check system_tech_providers row.');
                }

                const initFb = () => {
                    window.FB.init({
                        appId,
                        autoLogAppEvents: true,
                        xfbml: true,
                        version: graphVer
                    });
                    addDebugLog('FB SDK initialized', { appId, graphVer, provider: config.provider });
                };

                if (!window.FB) {
                    addDebugLog('Loading Facebook SDK...');
                    window.fbAsyncInit = initFb;

                    const script = document.createElement('script');
                    script.src = 'https://connect.facebook.net/en_US/sdk.js';
                    script.async = true;
                    script.defer = true;
                    script.crossOrigin = 'anonymous';
                    script.onerror = () => {
                        addDebugLog('ERROR: Facebook SDK script failed to load (check Content-Security-Policy)');
                    };
                    document.body.appendChild(script);
                } else {
                    // SDK script already present (e.g. re-mount) - (re)initialize with the resolved appId/version
                    addDebugLog('FB SDK already available, re-initializing with resolved config');
                    initFb();
                }
            } catch (err) {
                console.error('Error loading embedded signup config:', err);
                addDebugLog('ERROR fetching tech provider config', { error: err.message });
                if (isMounted) {
                    setError('Failed to load WhatsApp signup configuration. Please refresh and try again.');
                }
            } finally {
                if (isMounted) setIsLoadingProviderConfig(false);
            }
        };

        init();

        return () => {
            isMounted = false;
            window.removeEventListener('message', handleMessage);
        };
    }, []);

    // Handle Facebook login response (separated because FB.login callback cannot be async)
    const handleFBLoginResponse = async (response, activeId) => {
        try {
            addDebugLog('FB Login Response received', response);

            // Check if user cancelled or login failed
            if (!response || response.status === 'unknown') {
                addDebugLog('Login not completed or cancelled', { status: response?.status });
                setIsLoadingSignupLink(false);
                setIsSyncing(false);
                toast.error('Login was not completed. Please try again.');
                return;
            }

            if (response && response.authResponse && response.authResponse.code) {
                const code = response.authResponse.code;
                addDebugLog('Authorization code received', { code: code.substring(0, 20) + '...' });

                const isOwnProvider = techProvider?.provider === 'own';

                // Wait (best-effort) for the WABA ID / phone number ID sent via the
                // WA_EMBEDDED_SIGNUP postMessage FINISH event.
                // - AiSensy flow: waba_id is REQUIRED (partner API links the WABA by id).
                // - Own Meta Tech Provider flow: best-effort only, since the authorization
                //   `code` alone is enough to complete the token exchange server-side.
                let attempts = 0;
                const maxAttempts = 10; // 10 attempts * 500ms = 5 seconds max wait
                while (!wabaIdRef.current && attempts < maxAttempts) {
                    if (attempts === 0) {
                        addDebugLog('WABA ID not yet received, waiting for event...');
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }

                if (!wabaIdRef.current) {
                    addDebugLog('WARNING: WABA ID not received after waiting', {
                        attempts,
                        maxAttempts,
                        waitedSeconds: attempts * 0.5
                    });
                    if (!isOwnProvider) {
                        // AiSensy flow cannot proceed without a WABA ID
                        throw new Error('WABA ID not received. The signup may not have completed successfully. Please try again.');
                    }
                } else {
                    addDebugLog('WABA ID received successfully', { waba_id: wabaIdRef.current });
                }

                // Build the payload according to which Meta Tech Provider is active.
                // - 'aisensy': { project_id, waba_id }
                // - 'own':     { project_id, waba_id?, code, phone_number_id? }
                const submitPayload = {
                    project_id: activeId,
                    ...(wabaIdRef.current ? { waba_id: wabaIdRef.current } : {}),
                    ...(isOwnProvider ? {
                        code,
                        ...(phoneNumberIdRef.current ? { phone_number_id: phoneNumberIdRef.current } : {})
                    } : {})
                };

                addDebugLog('Payload before encryption', submitPayload);

                setIsSyncing(true);
                setIsLoadingSignupLink(false);

                if (!isOwnProvider) {
                    // AiSensy's partner-side WABA registration needs a short window to
                    // propagate before submit-facebook-access-token will reliably succeed.
                    addDebugLog('Starting 1-minute countdown before calling submitWabaId API...');
                    setCountdownSeconds(60);

                    await new Promise((resolve) => {
                        let remainingSeconds = 60;
                        countdownIntervalRef.current = setInterval(() => {
                            remainingSeconds--;
                            setCountdownSeconds(remainingSeconds);

                            if (remainingSeconds <= 0) {
                                if (countdownIntervalRef.current) {
                                    clearInterval(countdownIntervalRef.current);
                                    countdownIntervalRef.current = null;
                                }
                                setCountdownSeconds(0);
                                resolve();
                            }
                        }, 1000);
                    });

                    addDebugLog('Countdown completed. Calling submitWabaId API with encryption...');
                } else {
                    // Own Meta Tech Provider: the authorization code exchange is synchronous
                    // server-side, so there's no propagation delay to wait out.
                    addDebugLog('Calling submitWabaId API to exchange authorization code via Meta Tech Provider...');
                }

                // Submit to backend - server branches on the active tech provider to either
                // exchange the code directly with Meta (own) or call AiSensy's partner API.
                const wabaResponse = await submitWabaId(submitPayload);

                addDebugLog('WABA submission response received', wabaResponse);

                // Check response
                if (wabaResponse?.error) {
                    addDebugLog('WABA submission failed', wabaResponse);
                    throw new Error(typeof wabaResponse.error === 'string' ? wabaResponse.error : wabaResponse.msg || 'Failed to connect WABA');
                }

                // Show success toast
                addDebugLog('WABA connected successfully');
                toast.success(wabaResponse?.msg || 'WABA connected successfully');

                // Clear the stored IDs
                wabaIdRef.current = null;
                phoneNumberIdRef.current = null;

                // Start polling for connection status
                setIsSyncing(true);
                setIsLoadingSignupLink(false);
                setShowManualRefresh(false);

                // Reset poll count
                pollCountRef.current = 0;
                const maxPolls = 60; // 3 minutes = 180 seconds / 3 seconds = 60 polls

                const pollConnectionStatus = async () => {
                    try {
                        const statusResponse = await getProjectMetaDetails({ project_id: activeId });

                        if (statusResponse?.data) {
                            const wabaConnected = statusResponse.data.is_waba_connected !== false;
                            setIsWabaConnected(wabaConnected);

                            // Update data if connected
                            if (wabaConnected) {
                                setData(statusResponse.data);
                                // Initialize form if profile exists
                                if (statusResponse.data.profile) {
                                    const profilePictureUrl = statusResponse.data.profile?.profile_picture_url || '';
                                    setEditForm({
                                        about: statusResponse.data.profile?.about || '',
                                        description: statusResponse.data.profile?.description || '',
                                        vertical: statusResponse.data.profile?.vertical || '',
                                        address: statusResponse.data.profile?.address || '',
                                        email: statusResponse.data.profile?.email || '',
                                        profile_picture_url: profilePictureUrl,
                                        websites: statusResponse.data.profile?.websites || []
                                    });
                                    setOriginalProfilePictureUrl(profilePictureUrl);
                                }
                                // Stop polling if connected
                                if (syncIntervalRef.current) {
                                    clearInterval(syncIntervalRef.current);
                                    syncIntervalRef.current = null;
                                }
                                setIsSyncing(false);
                                setShowManualRefresh(false);
                                setSuccessMessage('WhatsApp Business Account connected successfully!');
                                setTimeout(() => setSuccessMessage(null), 3000);
                                return;
                            }
                        }

                        pollCountRef.current++;

                        // Stop after 3 minutes (60 polls)
                        if (pollCountRef.current >= maxPolls) {
                            if (syncIntervalRef.current) {
                                clearInterval(syncIntervalRef.current);
                                syncIntervalRef.current = null;
                            }
                            setIsSyncing(false);
                            setShowManualRefresh(true);
                        }
                    } catch (err) {
                        console.error('Error polling connection status:', err);
                        // Continue polling even if one request fails
                        pollCountRef.current++;
                        if (pollCountRef.current >= maxPolls) {
                            if (syncIntervalRef.current) {
                                clearInterval(syncIntervalRef.current);
                                syncIntervalRef.current = null;
                            }
                            setIsSyncing(false);
                            setShowManualRefresh(true);
                        }
                    }
                };

                // Start polling every 3 seconds
                syncIntervalRef.current = setInterval(pollConnectionStatus, 3000);
                // Also call immediately
                pollConnectionStatus();

            } else {
                console.log('Login response:', response);
                throw new Error('Login failed or was cancelled. Please try again.');
            }
        } catch (err) {
            console.error('Error in FB login callback:', err);
            const errorMessage = err.message || 'Failed to complete WhatsApp signup';
            addDebugLog('ERROR in signup flow', { error: errorMessage });
            setError(errorMessage);
            setErrorModalMessage(errorMessage);
            setShowErrorModal(true);
            toast.error(errorMessage);
            setIsLoadingSignupLink(false);
            setIsSyncing(false);
            // Clear countdown if it's running
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
            }
            setCountdownSeconds(0);
            // Clear the stored IDs on error
            wabaIdRef.current = null;
            phoneNumberIdRef.current = null;
        }
    };

    const handleGetSignupLink = async () => {
        try {
            addDebugLog('Signup button clicked');

            if (isLoadingProviderConfig || !techProvider) {
                toast.error('Signup configuration is still loading. Please wait a moment and try again.');
                return;
            }

            setIsLoadingSignupLink(true);
            setError(null);

            const activeId = activeProjectId;
            if (!activeId) {
                addDebugLog('ERROR: Project ID missing');
                throw new Error("Project ID missing");
            }

            addDebugLog('Project ID found', { project_id: activeId });
            addDebugLog('Active Meta Tech Provider', techProvider);

            const isOwnProvider = techProvider.provider === 'own';

            // ==============================================================
            // AiSensy Provider Flow
            // Backend generates a one-time embeddedSignupURL via the AiSensy
            // Partner API. We open it in a new tab. The user completes the
            // Meta embedded signup inside AiSensy's hosted flow.
            // After completion, the user pastes their WABA ID back.
            // ==============================================================
            if (!isOwnProvider) {
                addDebugLog('AiSensy provider detected — generating signup URL from server...');
                const linkResponse = await getEmbedSignupLink({ project_id: activeId });

                if (linkResponse?.error) {
                    throw new Error(typeof linkResponse.error === 'string' ? linkResponse.error : 'Failed to generate signup link');
                }

                const signupUrl = linkResponse?.url;
                if (!signupUrl) {
                    throw new Error('No signup URL returned from server. Please try again.');
                }

                addDebugLog('AiSensy signup URL received', { url: signupUrl.substring(0, 60) + '...' });

                // Open in new tab
                window.open(signupUrl, '_blank', 'noopener,noreferrer');
                toast.success('Signup page opened in a new tab. Complete the Meta flow and come back to submit your WABA ID.');
                setIsLoadingSignupLink(false);
                return;
            }

            // ==============================================================
            // Own Meta Tech Provider Flow
            // Uses FB.init() + FB.login() with the credentials from DB.
            // The authorization code + WABA data is returned via postMessage
            // and the handleFBLoginResponse function processes it.
            // ==============================================================
            if (!resolvedAppId || !resolvedConfigId) {
                addDebugLog('ERROR: Missing meta_app_id / meta_config_id from active tech provider', techProvider);
                toast.error('WhatsApp signup is not configured yet (missing App ID or Config ID). Please contact support.');
                setIsLoadingSignupLink(false);
                return;
            }

            // Wait for FB SDK (may still be loading from useEffect)
            addDebugLog('Waiting for FB SDK...');
            await waitForFbSdk();
            addDebugLog('FB SDK ready');

            const baseExtras = {
                featureType: "whatsapp_business_app_onboarding",
                sessionInfoVersion: "3",
                features: [{ name: "marketing_messages_lite" }],
                version: "v3"
            };

            const fbLoginConfig = {
                config_id: resolvedConfigId,
                response_type: 'code',
                override_default_response_type: true,
                extras: baseExtras
            };

            addDebugLog('Launching FB.login with Own Meta embedded signup', fbLoginConfig);

            // Launch Facebook Login with WhatsApp Embedded Signup
            // Note: FB.login callback must be a regular function, not async
            window.FB.login(function (response) {
                handleFBLoginResponse(response, activeId);
            }, fbLoginConfig);

        } catch (err) {
            console.error('Error launching WhatsApp signup:', err);
            const errorMessage = err.message || 'Failed to launch WhatsApp signup';
            addDebugLog('ERROR launching signup', { error: errorMessage });
            setError(errorMessage);
            setErrorModalMessage(errorMessage);
            setShowErrorModal(true);
            toast.error(errorMessage);
            setIsLoadingSignupLink(false);
            setIsSyncing(false);
        }
    };

    const handleManualRefresh = async () => {
        try {
            setIsSyncing(true);
            setShowManualRefresh(false);
            setError(null);

            const activeId = activeProjectId;
            if (!activeId) {
                throw new Error("Project ID missing");
            }

            const statusResponse = await getProjectMetaDetails({ project_id: activeId });

            if (statusResponse?.data) {
                const wabaConnected = statusResponse.data.is_waba_connected !== false;
                setIsWabaConnected(wabaConnected);

                // Update data if connected
                if (wabaConnected) {
                    setData(statusResponse.data);
                    // Initialize form if profile exists
                    if (statusResponse.data.profile) {
                        const profilePictureUrl = statusResponse.data.profile?.profile_picture_url || '';
                        setEditForm({
                            about: statusResponse.data.profile?.about || '',
                            description: statusResponse.data.profile?.description || '',
                            vertical: statusResponse.data.profile?.vertical || '',
                            address: statusResponse.data.profile?.address || '',
                            email: statusResponse.data.profile?.email || '',
                            profile_picture_url: profilePictureUrl,
                            websites: statusResponse.data.profile?.websites || []
                        });
                        setOriginalProfilePictureUrl(profilePictureUrl);
                    }
                    setIsSyncing(false);
                    setShowManualRefresh(false);
                    setSuccessMessage('WhatsApp Business Account connected successfully!');
                    setTimeout(() => setSuccessMessage(null), 3000);
                } else {
                    setIsSyncing(false);
                    setShowManualRefresh(true);
                }
            } else {
                setIsSyncing(false);
                setShowManualRefresh(true);
            }
        } catch (err) {
            console.error('Error refreshing connection status:', err);
            setError(err.message || 'Failed to refresh connection status');
            setIsSyncing(false);
            setShowManualRefresh(true);
        }
    };

    // --- Sub-Components ---

    const formatTier = (value) => {
        if (!value) return '';
        return String(value).replace(/^TIER_/i, 'Tier ').replace(/_/g, ' ');
    };

    const formatQuality = (value) => {
        const key = String(value || '').toUpperCase();
        if (key === 'GREEN') return 'High · Green';
        if (key === 'YELLOW') return 'Medium · Yellow';
        if (key === 'RED') return 'Low · Red';
        return String(value);
    };

    const qualityTone = (value) => {
        const key = String(value || '').toUpperCase();
        if (key === 'GREEN' || key === 'HIGH') return 'text-emerald-700';
        if (key === 'YELLOW' || key === 'MEDIUM') return 'text-amber-700';
        if (key === 'RED' || key === 'LOW') return 'text-rose-600';
        return 'text-ink';
    };

    const formatCharge = (amount, currency) => {
        if (amount == null || amount === '' || Number.isNaN(Number(amount))) return null;
        const formatted = Number(amount).toFixed(2);
        const code = String(currency || '').toUpperCase();
        if (code === 'INR') return `₹${formatted}`;
        if (code) return `${code} ${formatted}`;
        return formatted;
    };

    const displayName = data?.project?.wa_display_name || data?.project?.name || '';
    const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
    const photoUrl = (editForm.profile_picture_url || data?.profile?.profile_picture_url || '').trim();
    const phoneNumber = data?.profile?.wa_number || '';
    const chargeCurrency = data?.project?.billing_currency;
    const chargeRows = data?.charges ? [
        { label: 'Marketing', value: formatCharge(data.charges.marketing, chargeCurrency) },
        { label: 'Utility', value: formatCharge(data.charges.utility, chargeCurrency) },
        { label: 'Authentication', value: formatCharge(data.charges.authentication, chargeCurrency) },
    ].filter((row) => row.value) : [];
    const accountRows = data?.project ? [
        { label: 'Connection', value: isWabaConnected ? 'Connected' : 'Not connected', className: isWabaConnected ? 'text-emerald-700' : 'text-ink-500' },
        data.project.wa_quality_rating ? { label: 'Quality rating', value: formatQuality(data.project.wa_quality_rating), className: qualityTone(data.project.wa_quality_rating) } : null,
        data.project.wa_messaging_tier ? { label: 'Messaging tier', value: formatTier(data.project.wa_messaging_tier), className: 'text-ink font-semibold' } : null,
        data.project.fb_business_manager_status ? { label: 'Business verification', value: data.project.fb_business_manager_status, className: 'text-emerald-700' } : null,
        typeof data.project.is_whatsapp_verified === 'boolean' ? { label: 'Official business account', value: data.project.is_whatsapp_verified ? 'Verified' : 'Not verified', className: data.project.is_whatsapp_verified ? 'text-emerald-700' : 'text-ink-500' } : null,
        data.project.wa_display_name_status ? { label: 'Display name status', value: data.project.wa_display_name_status, className: 'text-ink font-semibold' } : null,
        data.project.daily_template_limit != null && data.project.daily_template_limit !== '' ? { label: 'Daily limit', value: String(data.project.daily_template_limit), className: 'text-ink font-mono font-semibold' } : null,
        data.project.status ? { label: 'Project status', value: data.project.status, className: 'text-ink font-semibold' } : null,
    ].filter(Boolean) : [];

    // --- Main Render ---
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

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                        </div>
                    ) : error && !showErrorModal && !data ? (
                        <div className="bg-rose-50 text-rose-700 p-4 rounded-[14px] border border-rose-100 flex items-center gap-2"><FiAlertCircle /> {error}</div>
                    ) : (
                        <div className="space-y-5">
                            {successMessage && (
                                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-[14px] border border-emerald-100 flex items-center gap-2"><FiCheckCircle /> {successMessage}</div>
                            )}
                            {error && !showErrorModal && (
                                <div className="bg-rose-50 text-rose-700 p-4 rounded-[14px] border border-rose-100 flex items-center gap-2"><FiAlertCircle /> {error}</div>
                            )}

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Business profile</h1>
                                    <p className="mt-1.5 text-sm text-ink-500">
                                        {isWabaConnected
                                            ? 'What customers see when they open your business on WhatsApp.'
                                            : 'Connect your WhatsApp Business Account to get started.'}
                                    </p>
                                </div>
                                {isWabaConnected ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                            className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft disabled:opacity-50"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Save changes'}
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            {!isWabaConnected ? (
                                <div className="space-y-5">
                                    <div className="bg-white border border-line rounded-[14px] p-8">
                                        <div className="text-center max-w-md mx-auto">
                                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                                                <FiAlertCircle className="h-8 w-8" />
                                            </div>
                                            <h2 className="text-xl font-extrabold tracking-tight text-ink">WhatsApp Business Account not connected</h2>
                                            <p className="mt-2 text-sm text-ink-500">
                                                You need to connect your WhatsApp Business Account to manage your business profile and settings.
                                            </p>
                                            <div className="mt-6">
                                                {isSyncing ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        {countdownSeconds > 0 ? (
                                                            <>
                                                                <div className="relative w-20 h-20 flex items-center justify-center">
                                                                    <svg className="transform -rotate-90 w-20 h-20">
                                                                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" fill="none" className="text-line" />
                                                                        <circle
                                                                            cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="4" fill="none"
                                                                            strokeDasharray={`${2 * Math.PI * 36}`}
                                                                            strokeDashoffset={`${2 * Math.PI * 36 * (1 - (60 - countdownSeconds) / 60)}`}
                                                                            className="text-brand-600 transition-all duration-1000"
                                                                            strokeLinecap="round"
                                                                        />
                                                                    </svg>
                                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                                        <span className="text-2xl font-bold text-brand-700">{countdownSeconds}</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm font-medium text-ink">Waiting before submission... {countdownSeconds}s</p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600">
                                                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                                                                </div>
                                                                <p className="text-sm font-medium text-ink">Updating/Syncing...</p>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : showManualRefresh ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <p className="text-sm text-ink-500 text-center">Connection status not updated. Please try refreshing manually.</p>
                                                        <button
                                                            type="button"
                                                            onClick={handleManualRefresh}
                                                            disabled={isSyncing}
                                                            className="inline-flex items-center justify-center gap-2 h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                                                        >
                                                            <FiRefreshCw /> {isSyncing ? 'Refreshing...' : 'Refresh status'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={handleGetSignupLink}
                                                        disabled={isLoadingSignupLink || isLoadingProviderConfig}
                                                        className="inline-flex items-center justify-center gap-2 h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 mx-auto"
                                                    >
                                                        {isLoadingProviderConfig ? 'Loading configuration...' : isLoadingSignupLink ? 'Getting signup link...' : (<><FiExternalLink /> Sign up with Facebook</>)}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {data?.project && (
                                        <div className="bg-white border border-line rounded-[14px] p-5">
                                            <h3 className="text-[15px] font-bold text-ink mb-3">Project information</h3>
                                            <dl className="divide-y divide-[#F3F2F8] text-[13px]">
                                                {data.project.name && (
                                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                                        <dt className="text-ink-500">Project name</dt>
                                                        <dd className="font-semibold text-ink">{data.project.name}</dd>
                                                    </div>
                                                )}
                                                {data.project.status && (
                                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                                        <dt className="text-ink-500">Project status</dt>
                                                        <dd className="font-semibold text-ink">{data.project.status}</dd>
                                                    </div>
                                                )}
                                                {data.project.wa_messaging_tier && (
                                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                                        <dt className="text-ink-500">Messaging tier</dt>
                                                        <dd className="font-semibold text-ink">{formatTier(data.project.wa_messaging_tier)}</dd>
                                                    </div>
                                                )}
                                                {data.project.daily_template_limit != null && data.project.daily_template_limit !== '' && (
                                                    <div className="flex items-center justify-between gap-4 py-2.5">
                                                        <dt className="text-ink-500">Daily limit</dt>
                                                        <dd className="font-mono font-semibold text-ink">{data.project.daily_template_limit}</dd>
                                                    </div>
                                                )}
                                            </dl>
                                            <button
                                                type="button"
                                                onClick={() => setShowQrModal(true)}
                                                className="mt-4 inline-flex items-center justify-center gap-2 h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft"
                                            >
                                                <LuQrCode size={15} /> Project QR
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
                                    <section className="bg-white border border-line rounded-[14px] p-5 sm:p-6">
                                        <div className="flex items-center gap-4 pb-5 mb-5 border-b border-[#F3F2F8]">
                                            <div className="h-14 w-14 flex-none rounded-full bg-ink text-white overflow-hidden flex items-center justify-center text-sm font-bold">
                                                {photoUrl ? (
                                                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    initials || 'BP'
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[15px] font-bold text-ink truncate">{displayName || 'Business profile'}</div>
                                                {phoneNumber ? <div className="font-mono text-[13px] text-ink-500">{phoneNumber}</div> : null}
                                            </div>
                                            <div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleProfilePictureChange}
                                                    className="hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleProfilePictureClick}
                                                    disabled={isUploadingPicture}
                                                    className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft disabled:opacity-50"
                                                >
                                                    {isUploadingPicture ? 'Uploading...' : 'Change photo'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Display name</label>
                                                    <input
                                                        type="text"
                                                        value={displayName}
                                                        readOnly
                                                        className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-surface-soft text-sm text-ink outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Industry</label>
                                                    <SearchableSelect
                                                        value={editForm.vertical}
                                                        onChange={(e) => setEditForm({ ...editForm, vertical: e.target.value })}
                                                        options={[{ value: '', label: 'Select business type' }, ...BUSINESS_VERTICALS.map((item) => ({ value: item.value, label: item.name }))]}
                                                        placeholder="Select business type"
                                                        className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink outline-none"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[13px] font-semibold text-ink mb-1.5">About</label>
                                                <input
                                                    type="text"
                                                    maxLength={139}
                                                    value={editForm.about}
                                                    onChange={(e) => setEditForm({ ...editForm, about: e.target.value })}
                                                    className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                                    placeholder="About text"
                                                />
                                                <p className="mt-1.5 text-xs text-ink-400">{editForm.about.length}/139 characters</p>
                                            </div>

                                            <div>
                                                <label className="block text-[13px] font-semibold text-ink mb-1.5">Business description</label>
                                                <textarea
                                                    rows={3}
                                                    value={editForm.description}
                                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                    className="w-full px-3 py-2.5 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                                    placeholder="Business description"
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Email</label>
                                                    <input
                                                        type="email"
                                                        value={editForm.email}
                                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                        className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink mb-1.5">Website</label>
                                                    <div className="space-y-2">
                                                        {editForm.websites.map((site, idx) => (
                                                            <div key={idx} className="flex gap-2">
                                                                <input
                                                                    type="url"
                                                                    value={site}
                                                                    onChange={(e) => handleWebsiteChange(idx, e.target.value)}
                                                                    className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                                                    placeholder="https://example.com"
                                                                />
                                                                <button type="button" onClick={() => removeWebsite(idx)} className="h-[42px] px-2 text-rose-600" aria-label="Remove website">
                                                                    <FiTrash2 />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button type="button" onClick={addWebsite} className="text-[13px] font-semibold text-brand-700 inline-flex items-center gap-1">
                                                            <FiPlus /> Add website
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[13px] font-semibold text-ink mb-1.5">Address</label>
                                                <input
                                                    type="text"
                                                    value={editForm.address}
                                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                    className="w-full h-[42px] px-3 rounded-[9px] border border-line-strong bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <aside className="space-y-4">
                                        {accountRows.length > 0 && (
                                            <section className="bg-white border border-line rounded-[14px] p-5">
                                                <h2 className="text-[15px] font-bold text-ink mb-3">Account status</h2>
                                                <dl className="space-y-2.5 text-[13px]">
                                                    {accountRows.map((row) => (
                                                        <div key={row.label} className="flex items-center justify-between gap-3">
                                                            <dt className="text-ink-500">{row.label}</dt>
                                                            <dd className={`text-right font-semibold ${row.className}`}>{row.value}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </section>
                                        )}

                                        <section className="bg-white border border-line rounded-[14px] p-5">
                                            <h2 className="text-[15px] font-bold text-ink">Template message charges</h2>
                                            <p className="mt-1 text-xs text-ink-500">Per delivered message, deducted from your wallet.</p>
                                            {chargeRows.length > 0 ? (
                                                <dl className="mt-4 space-y-2.5 text-[13px]">
                                                    {chargeRows.map((row) => (
                                                        <div key={row.label} className="flex items-center justify-between gap-3">
                                                            <dt className="text-ink-500">{row.label}</dt>
                                                            <dd className="font-mono font-semibold text-ink">{row.value}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            ) : (
                                                <p className="mt-3 text-sm text-ink-500">Charges not available for this project.</p>
                                            )}
                                        </section>

                                        <section className="bg-white border border-line rounded-[14px] p-4 flex items-center gap-3">
                                            <div className="h-12 w-12 flex-none rounded-[10px] border border-line flex items-center justify-center text-ink">
                                                <LuQrCode size={22} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-ink">Project QR code</div>
                                                <p className="text-xs text-ink-500">Customers scan it to start a chat.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowQrModal(true)}
                                                className="inline-flex items-center justify-center h-[38px] px-3.5 rounded-[9px] text-[13px] font-semibold bg-white text-ink border border-[#E1DFEC] hover:bg-surface-soft"
                                            >
                                                Download
                                            </button>
                                        </section>
                                    </aside>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Debug Panel - Fixed at bottom */}
            {!isWabaConnected && (
                <div className="fixed bottom-0 left-0 right-0 z-50">
                    {showDebugPanel ? (
                        <div className="bg-gray-900 text-white border-t-2 border-indigo-500 shadow-2xl" style={{ maxHeight: '400px' }}>
                            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="font-semibold">Debug Console</span>
                                    <span className="text-xs text-gray-400">({debugLogs.length} logs)</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setDebugLogs([])}
                                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
                                    >
                                        Clear
                                    </button>
                                    <button
                                        onClick={() => {
                                            const logText = debugLogs.map(log =>
                                                `[${log.time}] ${log.message}${log.data ? '\n' + log.data : ''}`
                                            ).join('\n\n');
                                            navigator.clipboard.writeText(logText);
                                            toast.success('Logs copied to clipboard');
                                        }}
                                        className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded"
                                    >
                                        Copy Logs
                                    </button>
                                    <button
                                        onClick={() => setShowDebugPanel(false)}
                                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-y-auto p-4 space-y-2" style={{ maxHeight: '350px' }}>
                                {debugLogs.length === 0 ? (
                                    <div className="text-gray-400 text-sm text-center py-8">
                                        No logs yet. Click "Sign Up with Facebook" to start debugging.
                                    </div>
                                ) : (
                                    debugLogs.map((log, index) => (
                                        <div key={index} className="bg-gray-800 rounded p-2 text-xs font-mono">
                                            <div className="flex items-start gap-2">
                                                <span className="text-gray-500">[{log.time}]</span>
                                                <span className="text-green-400 flex-1">{log.message}</span>
                                            </div>
                                            {log.data && (
                                                <pre className="mt-1 text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                                    {log.data}
                                                </pre>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowDebugPanel(true)}
                            className="fixed bottom-4 right-4 px-4 py-2 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 flex items-center gap-2 border border-indigo-500"
                        >
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium">Debug Console</span>
                            {debugLogs.length > 0 && (
                                <span className="px-2 py-0.5 bg-indigo-600 rounded-full text-xs">
                                    {debugLogs.length}
                                </span>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Error Modal */}
            <AnimatedModal open={showErrorModal}>
              {showErrorModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
                          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                              <FiAlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                          </div>

                          <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                              Connection Failed
                          </h3>

                          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                              {errorModalMessage}
                          </p>

                          <div className="space-y-3">
                              <button
                                  onClick={() => {
                                      setShowErrorModal(false);
                                      navigate('/project-details');
                                  }}
                                  className="w-full px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                              >
                                  <FiArrowLeft />
                                  Go to All Projects
                              </button>

                              <button
                                  onClick={() => {
                                      setShowErrorModal(false);
                                      setError(null);
                                  }}
                                  className="w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                  Try Again
                              </button>
                          </div>

                          {debugLogs.length > 0 && (
                              <button
                                  onClick={() => setShowDebugPanel(true)}
                                  className="w-full mt-3 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              >
                                  View Debug Logs ({debugLogs.length})
                              </button>
                          )}
                      </div>
                  </div>
              )}
            </AnimatedModal>

            {/* Project QR Code Modal */}
            <ProjectQRModal
                isOpen={showQrModal}
                onClose={() => setShowQrModal(false)}
                projectId={projectId || (data?.project?.id || data?.project?.project_id)}
                projectName={data?.project?.name || ''}
            />
        </div>
    );
};

export default ProjectDetails;