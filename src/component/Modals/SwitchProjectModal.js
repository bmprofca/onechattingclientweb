import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiBriefcase, FiRefreshCw, FiUser, FiShield, FiUserCheck, FiSearch } from 'react-icons/fi';
import { fetchUserProfile, listAgentInvitations, respondAgentInvitation } from '../../api/auth';

const SwitchProjectModal = ({ isOpen, onClose, companies = [], onSelectCompany, onInvitationsChange }) => {
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [projects, setProjects] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [respondingId, setRespondingId] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [activeProjectId, setActiveProjectId] = useState(null);

    // Load projects from localStorage immediately, then fetch from API
    useEffect(() => {
        if (isOpen) {
            // First, load from localStorage immediately (synchronous)
            const loadFromLocalStorage = () => {
                try {
                    const userData = localStorage.getItem('userData');
                    if (userData) {
                        const parsedData = JSON.parse(userData);
                        // Get active project ID
                        if (parsedData.selected_project_id) {
                            setActiveProjectId(parsedData.selected_project_id);
                        }
                        // Load projects
                        if (parsedData.projects?.list && Array.isArray(parsedData.projects.list)) {
                            setProjects(parsedData.projects.list);
                        } else if (parsedData.projects && Array.isArray(parsedData.projects)) {
                            setProjects(parsedData.projects);
                        }
                        if (Array.isArray(parsedData.pending_invitations)) {
                            setInvitations(parsedData.pending_invitations);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing userData from localStorage:', error);
                }
            };

            // Load from localStorage first
            loadFromLocalStorage();

            // Then fetch from API in the background
            const fetchFromAPI = async () => {
                setRefreshing(true);
                setError(null);
                try {
                    const [response, inviteResponse] = await Promise.all([
                        fetchUserProfile(),
                        listAgentInvitations().catch(() => null)
                    ]);

                    if (inviteResponse && Array.isArray(inviteResponse.list)) {
                        setInvitations(inviteResponse.list);
                        if (onInvitationsChange) onInvitationsChange(inviteResponse.list);
                    }

                    if (response && response.projects) {
                        // API returns projects as object with list property
                        let newProjects = [];
                        if (response.projects.list && Array.isArray(response.projects.list)) {
                            newProjects = response.projects.list;
                        } else if (Array.isArray(response.projects)) {
                            newProjects = response.projects;
                        }

                        // Smoothly update with new data
                        if (newProjects.length > 0) {
                            setProjects(newProjects);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching projects from API:', error);
                    setError('Failed to refresh projects');
                    // Keep showing localStorage data on error
                } finally {
                    setRefreshing(false);
                }
            };

            // Small delay to ensure localStorage data is shown first
            const timeoutId = setTimeout(() => {
                fetchFromAPI();
            }, 100);

            return () => clearTimeout(timeoutId);
        } else {
            // Reset state when modal closes
            setProjects([]);
            setInvitations([]);
            setRespondingId(null);
            setRefreshing(false);
            setError(null);
            setActiveProjectId(null);
        }
    }, [isOpen]);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            // Save the current scroll position
            const scrollY = window.scrollY;
            // Disable body scroll
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';

            return () => {
                // Re-enable body scroll when modal closes
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                // Restore scroll position
                window.scrollTo(0, scrollY);
            };
        }
    }, [isOpen]);

    // Use projects from API, fallback to companies prop, then empty array
    const projectList = projects.length > 0 ? projects : (companies.length > 0 ? companies : []);

    // Filter projects based on search query (name, description, owner)
    const filteredProjects = projectList.filter(project =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (project.owner_name && project.owner_name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleInvitation = async (invitation, action) => {
        if (!invitation?.invitation_id || respondingId) return;
        setRespondingId(invitation.invitation_id);
        setError(null);
        try {
            const result = await respondAgentInvitation({
                invitation_id: invitation.invitation_id,
                action
            });
            if (result?.error) {
                setError(typeof result.error === 'string' ? result.error : 'Could not update the invitation');
                return;
            }
            const profile = await fetchUserProfile();
            const nextProjects = profile?.projects?.list || (Array.isArray(profile?.projects) ? profile.projects : []);
            if (nextProjects.length > 0) setProjects(nextProjects);
            const remaining = invitations.filter((item) => item.invitation_id !== invitation.invitation_id);
            setInvitations(remaining);
            if (onInvitationsChange) onInvitationsChange(remaining);
        } catch (inviteError) {
            setError('Could not update the invitation');
        } finally {
            setRespondingId(null);
        }
    };

    const handleSelect = (company) => {
        setSelectedCompany(company);
        if (onSelectCompany) {
            onSelectCompany(company);
        }
        // Close modal after a brief delay to show selection
        setTimeout(() => {
            onClose();
            setSelectedCompany(null);
            setSearchQuery('');
        }, 300);
    };

    const initialsOf = (name = '') => {
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return 'P';
        return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
    };

    const AVATAR_TONES = [
        'from-brand-500 to-brand-700',
        'from-sky-500 to-blue-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600',
        'from-violet-500 to-fuchsia-600',
    ];
    const toneFor = (seed = '') => {
        let hash = 0;
        for (let i = 0; i < String(seed).length; i += 1) hash = (hash * 31 + String(seed).charCodeAt(i)) >>> 0;
        return AVATAR_TONES[hash % AVATAR_TONES.length];
    };

    const ownedCount = projectList.filter((project) => project.owned === true).length;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="switch-project-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-3 pt-4 pb-8 sm:px-6 sm:pt-8 sm:pb-12"
                    style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="switch-project-title"
                >
                    <motion.div
                        initial={{ scale: 0.96, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.97, opacity: 0, y: 12 }}
                        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                        className="relative w-full max-w-5xl max-h-[calc(100dvh-5rem)] sm:max-h-[86vh] flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_64px_-12px_rgba(23,20,38,0.35)] dark:bg-gray-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="relative px-5 sm:px-7 pt-6 pb-5 border-b border-line bg-gradient-to-br from-brand-50 via-white to-white dark:from-brand-900/20 dark:via-gray-800 dark:to-gray-800">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(108,92,231,0.6)]">
                                        <FiBriefcase className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 id="switch-project-title" className="text-lg sm:text-xl font-extrabold tracking-tight text-ink">
                                            Switch project
                                        </h3>
                                        <p className="mt-0.5 text-[13px] text-ink-500 flex items-center gap-2 flex-wrap">
                                            <span>{projectList.length} project{projectList.length !== 1 ? 's' : ''} available</span>
                                            {ownedCount > 0 && (
                                                <>
                                                    <span className="h-1 w-1 rounded-full bg-ink-400/60" />
                                                    <span>{ownedCount} owned</span>
                                                </>
                                            )}
                                            {refreshing && (
                                                <span className="inline-flex items-center gap-1 text-brand-700">
                                                    <motion.span
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                        className="inline-flex"
                                                    >
                                                        <FiRefreshCw className="w-3.5 h-3.5" />
                                                    </motion.span>
                                                    Syncing
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="flex-shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-lg text-ink-500 hover:text-ink hover:bg-white border border-transparent hover:border-line transition-colors"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="relative mt-5">
                                <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search by project name or owner..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="oc-input pl-10 pr-10 shadow-card"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        aria-label="Clear search"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink hover:bg-surface-soft"
                                    >
                                        <FiX className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-5 sm:px-7 pt-5 pb-8 bg-surface-ground/60 dark:bg-gray-900/30">
                            {error && (
                                <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                    {error}
                                </div>
                            )}

                            {invitations.length > 0 && (
                                <section className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="relative inline-flex h-2 w-2">
                                            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                        </span>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                                            Invitations waiting for you
                                        </h4>
                                        <span className="oc-badge bg-amber-100 text-amber-800">{invitations.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {invitations.map((invitation) => {
                                            const busy = respondingId === invitation.invitation_id;
                                            return (
                                                <div
                                                    key={invitation.invitation_id}
                                                    className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-card"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">
                                                            {initialsOf(invitation.project_name)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <h4 className="font-semibold text-ink truncate">{invitation.project_name}</h4>
                                                                <span className="flex-shrink-0 oc-badge gap-1 bg-amber-100 text-amber-800">
                                                                    <FiUserCheck className="w-3 h-3" />
                                                                    Agent invite
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-[13px] text-ink-500">
                                                                {invitation.invited_by_name ? `${invitation.invited_by_name} invited you` : 'You have a pending invitation'}
                                                                {invitation.permission_name ? ` · ${invitation.permission_name}` : ''}
                                                            </p>
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() => handleInvitation(invitation, 'accept')}
                                                                    className="oc-btn-primary h-8 px-3 text-xs"
                                                                >
                                                                    {busy ? 'Please wait…' : 'Accept'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() => handleInvitation(invitation, 'reject')}
                                                                    className="oc-btn-ghost h-8 px-3 text-xs"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {filteredProjects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center py-14">
                                    <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                                        <FiBriefcase className="w-6 h-6" />
                                    </div>
                                    <p className="mt-4 text-base font-semibold text-ink">No projects found</p>
                                    <p className="mt-1 text-sm text-ink-500">
                                        {searchQuery ? 'Try a different name or owner.' : 'Projects you own or join will show up here.'}
                                    </p>
                                </div>
                            ) : (
                                <section>
                                    {invitations.length > 0 && (
                                        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500">Your projects</h4>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                        {filteredProjects.map((project, index) => {
                                            const projectId = project.project_id || project.id;
                                            const isSelected = selectedCompany?.project_id === projectId || selectedCompany?.id === projectId;
                                            const isActive = activeProjectId === projectId;
                                            const isOwned = project.owned === true;
                                            const highlighted = isSelected || isActive;
                                            return (
                                                <motion.button
                                                    type="button"
                                                    key={projectId}
                                                    onClick={() => handleSelect(project)}
                                                    title={project.name}
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.22, delay: Math.min(index, 12) * 0.025 }}
                                                    whileHover={{ y: -2 }}
                                                    whileTap={{ scale: 0.985 }}
                                                    className={`group relative text-left rounded-xl border bg-white dark:bg-gray-800 p-4 min-h-[112px] flex flex-col transition-[border-color,box-shadow,background-color] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${highlighted
                                                        ? 'border-brand-500 ring-[3px] ring-brand-600/15 shadow-[0_10px_24px_-12px_rgba(108,92,231,0.55)]'
                                                        : 'border-line hover:border-brand-300 hover:shadow-[0_10px_24px_-14px_rgba(23,20,38,0.35)]'
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3 w-full min-w-0">
                                                        <div className={`flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br ${toneFor(project.name || projectId)} text-white text-sm font-bold flex items-center justify-center shadow-sm`}>
                                                            {initialsOf(project.name)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className={`font-semibold text-[15px] leading-snug truncate ${highlighted ? 'text-brand-800' : 'text-ink'}`} title={project.name}>
                                                                {project.name}
                                                            </h4>
                                                            {project.owner_name ? (
                                                                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500 min-w-0">
                                                                    <FiUser className="w-3.5 h-3.5 flex-shrink-0 text-ink-400" />
                                                                    <span className="truncate">{project.owner_name}</span>
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                        <span
                                                            className={`flex-shrink-0 h-6 w-6 rounded-full border flex items-center justify-center transition-all duration-200 ${highlighted
                                                                ? 'bg-brand-600 border-brand-600 text-white scale-100'
                                                                : 'border-line-strong text-transparent scale-90 group-hover:border-brand-300'
                                                                }`}
                                                            aria-hidden="true"
                                                        >
                                                            <FiCheck className="w-3.5 h-3.5" />
                                                        </span>
                                                    </div>

                                                    <div className="mt-auto pt-3 flex items-center gap-2 flex-wrap">
                                                        {isOwned ? (
                                                            <span className="oc-badge gap-1 bg-brand-50 text-brand-800">
                                                                <FiShield className="w-3 h-3" />
                                                                Admin
                                                            </span>
                                                        ) : (
                                                            <span className="oc-badge gap-1 bg-surface-soft text-ink-500 border border-line">
                                                                <FiUserCheck className="w-3 h-3" />
                                                                Agent
                                                            </span>
                                                        )}
                                                        {isActive && (
                                                            <span className="oc-badge gap-1 bg-emerald-50 text-emerald-700">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                Current
                                                            </span>
                                                        )}
                                                        {isSelected && !isActive && (
                                                            <span className="oc-badge bg-brand-600 text-white">Switching…</span>
                                                        )}
                                                    </div>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3.5 border-t border-line bg-white dark:bg-gray-800">
                            <p className="text-xs text-ink-500 truncate">
                                {searchQuery
                                    ? `${filteredProjects.length} of ${projectList.length} shown`
                                    : 'Select a project to switch your workspace.'}
                            </p>
                            <button type="button" onClick={onClose} className="oc-btn-ghost h-9">
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SwitchProjectModal;

