import React, { useState, useEffect, useRef, useCallback, useMemo, useContext, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiMenu, FiBriefcase, FiChevronDown, FiCreditCard,
  FiPlus, FiUser, FiHelpCircle,
  FiLogOut, FiList, FiCpu, FiMessageSquare, FiUsers,
  FiLock, FiX, FiMaximize2, FiMinimize2,
  FiGrid, FiFolder, FiFileText, FiSend, FiUserCheck, FiSliders, FiCode, FiLayers,
  FiSun, FiMoon, FiMonitor, FiCheck
} from 'react-icons/fi';
import { useTheme } from '../theme/ThemeContext';

// Adjust these import paths if necessary
import { fetchProjectInfo } from '../store/projectSlice';
import { setSelectedProjectId, setAuthData } from '../store/authSlice';
import { fetchUserProfile, getTotalUnreadCount, listAgentInvitations, logoutUser } from '../api/auth';
import SwitchProjectModal from './Modals/SwitchProjectModal';
import ProjectQRModal from './Modals/ProjectQRModal';
import { LuQrCode } from 'react-icons/lu';
import SubscriptionAlert from './SubscriptionAlert';
import { dbHelper } from '../pages/db';
import { socketManager } from '../pages/socket';

// ==========================================
// 1. Constants & Styles (Modern Indigo Theme)
// ==========================================

// ==========================================
// 2. Helper Functions
// ==========================================
const getUserData = () => {
  try {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
  } catch (error) { return null; }
};

const isItemActive = (item, currentPath) => {
  if (item.path && item.path !== '#') {
    if (item.path === '/') return currentPath === '/' || currentPath === '';
    return currentPath === item.path || currentPath.startsWith(item.path + '/');
  }
  if (item.submenus) {
    return item.submenus.some(submenu =>
      submenu.path && submenu.path !== '#' &&
      (currentPath === submenu.path || currentPath.startsWith(submenu.path + '/'))
    );
  }
  return false;
};


// ==========================================
// 3. NavItem Component (MOVED OUTSIDE)
// ==========================================
const NavItem = React.memo(({ item, isMobile, isMinimized, isHovered, currentPath, setHoveredMenu, hoveredMenu, setMobileMenuOpen, hasProjects, unreadCount, navigate }) => {
  const isActive = isItemActive(item, currentPath);
  const isDashboard = item.key === 'dashboard' || item.path === '/';
  const isDisabled = !hasProjects && !isDashboard;
  const isMini = !isMobile && isMinimized && !isHovered;
  const showUnreadBadge = item.key === 'live-chat' && unreadCount > 0;
  const iconClass = isDisabled
    ? 'text-slate-300'
    : isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-700';

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isDisabled}
        aria-current={isActive ? 'page' : undefined}
        aria-label={isMini ? item.title : undefined}
        onClick={() => {
          if (isDisabled) return;
          navigate(item.path);
          if (isMobile && setMobileMenuOpen) setMobileMenuOpen(false);
        }}
        onMouseEnter={() => isMini && setHoveredMenu && setHoveredMenu(item.key)}
        onMouseLeave={() => isMini && setHoveredMenu && setHoveredMenu(null)}
        className={`group w-full flex items-center gap-2.5 h-[38px] rounded-[9px] text-sm transition-colors
          ${isMini ? 'justify-center px-0' : 'px-2.5'}
          ${isDisabled
            ? 'text-slate-300 cursor-not-allowed'
            : isActive
              ? 'bg-brand-50 text-brand-800 font-semibold'
              : 'text-ink-700 font-medium hover:bg-[#F3F2FA] hover:text-ink'}`}
      >
        <span className={`relative flex-none transition-colors ${iconClass}`}>
          {item.icon}
          {isMini && showUnreadBadge && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {!isMini && (
          <>
            <span className="flex-1 text-left truncate">{item.title}</span>
            {showUnreadBadge && (
              <span className="min-w-[22px] h-5 px-1.5 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            {isDisabled && <FiLock size={12} className="text-slate-300" />}
          </>
        )}
      </button>
      {isMini && hoveredMenu === item.key && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-ink text-white text-xs font-medium rounded-md shadow-pop z-50 whitespace-nowrap">
          {item.title} {isDisabled && '(Locked)'}
        </div>
      )}
    </div>
  );
});

NavItem.displayName = 'NavItem';

const getFullscreenElement = () =>
  document.fullscreenElement
  || document.webkitFullscreenElement
  || document.mozFullScreenElement
  || document.msFullscreenElement
  || null;

const requestBrowserFullscreen = () => {
  const el = document.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
  return Promise.reject(new Error('Fullscreen API is not supported'));
};

const exitBrowserFullscreen = () => {
  if (document.exitFullscreen) return document.exitFullscreen();
  if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  if (document.mozCancelFullScreen) return document.mozCancelFullScreen();
  if (document.msExitFullscreen) return document.msExitFullscreen();
  return Promise.reject(new Error('Fullscreen API is not supported'));
};

// ==========================================
// Theme switcher (Light / Dark / System)
// ==========================================
const THEME_OPTIONS = [
  { id: 'light', label: 'Light', icon: FiSun },
  { id: 'dark', label: 'Dark', icon: FiMoon },
  { id: 'system', label: 'System', icon: FiMonitor },
];

const ThemeMenu = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = THEME_OPTIONS.find(o => o.id === theme) || THEME_OPTIONS[2];
  const CurrentIcon = current.icon;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        className="flex items-center justify-center h-9 w-9 rounded-[9px] border border-[#E1DFEC] bg-white text-ink-700 hover:bg-surface-soft transition-colors"
      >
        <CurrentIcon size={16} />
      </button>
      {open && (
        <div role="menu" aria-label="Theme" className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-white p-1.5 shadow-pop z-50">
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">Theme</p>
          {THEME_OPTIONS.map(option => {
            const Icon = option.icon;
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => { setTheme(option.id); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${selected ? 'bg-brand-50 text-brand-800' : 'text-ink-700 hover:bg-[#F3F2FA] hover:text-ink'}`}
              >
                <Icon size={15} />
                <span className="flex-1 text-left">{option.label}</span>
                {option.id === 'system' && (
                  <span className="text-[11px] font-semibold text-ink-400">{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</span>
                )}
                {selected && <FiCheck size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. Header Component
// ==========================================
const HeaderView = ({ mobileMenuOpen, setMobileMenuOpen, isMinimized, setIsMinimized, isFullScreen = false }) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [switchProjectModalOpen, setSwitchProjectModalOpen] = useState(false);
  const [projectQrModalOpen, setProjectQrModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedProjectName, setSelectedProjectName] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [userProfile, setUserProfile] = useState({ name: '', email: '' });
  const [walletBalance, setWalletBalance] = useState(0);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const profileDropdownRef = React.useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectInfoStatus = useSelector((state) => state.project?.status || 'idle');

  useEffect(() => {
    const getSelectedProjectInfo = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (!userData) return { id: null, name: null };
        const parsed = JSON.parse(userData);
        const selectedProjectId = parsed.selected_project_id;
        const projects = parsed.projects?.list || (Array.isArray(parsed.projects) ? parsed.projects : []);

        if (selectedProjectId && projects.length > 0) {
          const selectedProject = projects.find(p => (p.project_id === selectedProjectId || p.id === selectedProjectId));
          return {
            id: selectedProjectId,
            name: selectedProject ? selectedProject.name : null
          };
        }
        return { id: selectedProjectId || null, name: null };
      } catch (error) { return { id: null, name: null }; }
    };
    const applySelectedProject = () => {
      const next = getSelectedProjectInfo();
      setActiveProjectId(next.id);
      setSelectedProjectName(next.name);
    };
    applySelectedProject();
    window.addEventListener('projects-updated', applySelectedProject);
    return () => window.removeEventListener('projects-updated', applySelectedProject);
  }, [switchProjectModalOpen]);

  useEffect(() => {
    let active = true;
    const loadInvitations = () => {
      listAgentInvitations()
        .then((res) => {
          if (active) setPendingInviteCount(Array.isArray(res?.list) ? res.list.length : 0);
        })
        .catch(() => {});
    };
    loadInvitations();
    window.addEventListener('projects-updated', loadInvitations);
    return () => {
      active = false;
      window.removeEventListener('projects-updated', loadInvitations);
    };
  }, [switchProjectModalOpen]);

  const toggleSidebar = () => {
    if (setIsMinimized) setIsMinimized(!isMinimized);
  };

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsBrowserFullscreen(Boolean(getFullscreenElement()));
    };

    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState);
    document.addEventListener('mozfullscreenchange', syncFullscreenState);
    document.addEventListener('MSFullscreenChange', syncFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState);
      document.removeEventListener('mozfullscreenchange', syncFullscreenState);
      document.removeEventListener('MSFullscreenChange', syncFullscreenState);
    };
  }, []);

  const toggleBrowserFullscreen = async () => {
    try {
      if (getFullscreenElement()) {
        await exitBrowserFullscreen();
      } else {
        await requestBrowserFullscreen();
      }
    } catch (error) {
      console.error('Failed to toggle browser fullscreen:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const userData = getUserData();
      if (userData?.token) {
        await logoutUser(userData.token);
      }
    } catch (error) {
      console.error('Logout API failed:', error);
    }
    localStorage.removeItem("userData");
    navigate('/login');
  };

  const handleSelectCompany = (company) => {
    if (!company) return;
    setSelectedCompany(company);
    try {
      const stored = localStorage.getItem('userData');
      const parsed = stored ? JSON.parse(stored) : {};
      const selectedId = company.project_id || company.id || null;
      const updatedUserData = { ...parsed, selected_project_id: selectedId };
      localStorage.setItem('userData', JSON.stringify(updatedUserData));
      sessionStorage.removeItem('showProjectPicker');
      if (selectedId) dispatch(setSelectedProjectId(selectedId));
      dispatch(setAuthData(updatedUserData));
    } catch (error) { console.error('Failed to update selected project', error); }
    window.location.reload();
  };

  useEffect(() => {
    if (projectInfoStatus === 'idle') {
      dispatch(fetchProjectInfo());
    }
  }, [dispatch, projectInfoStatus]);

  // Load user profile - first from localStorage, then fetch from API
  useEffect(() => {
    // Load from localStorage immediately
    const loadFromLocalStorage = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          if (parsed.profile) {
            setUserProfile({
              name: parsed.profile.name || '',
              email: parsed.profile.email || ''
            });
          }
          if (parsed.balance != null) {
            setWalletBalance(Number(parsed.balance) || 0);
          }
        }
      } catch (error) {
        console.error('Error parsing userData from localStorage:', error);
      }
    };

    loadFromLocalStorage();

    // Fetch from API in the background (profile endpoint returns balance)
    const fetchProfile = async () => {
      try {
        const response = await fetchUserProfile();
        if (response && response.profile) {
          setUserProfile({
            name: response.profile.name || '',
            email: response.profile.email || ''
          });
          if (response.balance != null) {
            setWalletBalance(Number(response.balance) || 0);
          }
          // Update localStorage with fresh data (auth already saves balance via fetchUserProfile)
          try {
            const userData = localStorage.getItem('userData');
            if (userData) {
              const parsed = JSON.parse(userData);
              localStorage.setItem('userData', JSON.stringify({
                ...parsed,
                profile: response.profile,
                balance: response.balance
              }));
            }
          } catch (error) {
            console.error('Error updating localStorage:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Keep showing localStorage data on error
      }
    };

    fetchProfile();
  }, []);

  // Refetch profile (and balance) when user returns e.g. from payment gateway
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUserProfile().then((response) => {
          if (response && response.balance != null) {
            setWalletBalance(Number(response.balance) || 0);
          }
        }).catch(() => { });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Handle click outside profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownOpen && profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (userProfile.name) {
      const names = userProfile.name.trim().split(' ');
      if (names.length >= 2) {
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
      }
      return userProfile.name.substring(0, 2).toUpperCase();
    }
    return 'U'; // Default initial
  };

  const profileItems = [
    { title: 'My Profile', icon: <FiUser size={16} />, path: '/my-profile' },
    { title: 'My Subscription', icon: <FiCreditCard size={16} />, path: '/my-subscription' },
    { title: 'Transactions', icon: <FiList size={16} />, path: '/transactions' },
    { title: 'AI Bills', icon: <FiCpu size={16} />, path: '/ai-bills' },
  ];

  return (
    <>
      <SubscriptionAlert isMinimized={isMinimized} isFullScreen={isFullScreen} />
      <header className={`fixed top-0 right-0 left-0 ${isMinimized ? 'md:left-20' : 'md:left-[260px]'} z-50 h-16 border-b border-line bg-white/95 backdrop-blur-md transition-all duration-300 ease-in-out ${isFullScreen ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}>
        <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label={isMinimized ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex h-9 w-9 items-center justify-center rounded-[9px] text-ink-500 hover:bg-[#F3F2FA] hover:text-ink transition-colors"
              onClick={window.innerWidth >= 768 ? toggleSidebar : () => setMobileMenuOpen(true)}
            >
              <FiMenu size={20} />
            </button>
            <button type="button" className="md:hidden flex items-center gap-2" onClick={() => navigate('/')} aria-label="OneChatting home">
              <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-base font-extrabold tracking-tight text-ink">OneChatting</span>
            </button>
            <button
              type="button"
              onClick={() => setSwitchProjectModalOpen(true)}
              className="hidden md:flex items-center gap-2 min-w-0 rounded-[9px] px-2.5 h-9 text-sm text-ink-500 hover:bg-[#F3F2FA] transition-colors"
            >
              <span className="text-ink-400">Project</span>
              <span className="font-semibold text-ink truncate max-w-[220px]">{selectedProjectName || selectedCompany?.name || 'Select project'}</span>
              <FiChevronDown size={14} className="text-ink-400 flex-none" />
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="hidden md:flex items-center justify-center h-9 w-9 rounded-[9px] border border-[#E1DFEC] bg-white text-ink-700 hover:bg-surface-soft transition-colors"
              title={isBrowserFullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
              aria-label={isBrowserFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isBrowserFullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
            </button>

            <ThemeMenu />

            {activeProjectId && (
              <button
                type="button"
                onClick={() => setProjectQrModalOpen(true)}
                className="hidden sm:flex items-center gap-2 h-9 rounded-[9px] border border-[#E1DFEC] bg-white px-3 text-[13px] font-semibold text-ink hover:bg-surface-soft transition-colors"
                title="View & Download Project QR Code"
              >
                <LuQrCode size={15} className="text-ink-500" />
                <span>Project QR</span>
              </button>
            )}

            <div className="flex items-center gap-2 h-9 rounded-[9px] border border-[#E1DFEC] bg-white pl-3 pr-1">
              <span className="hidden lg:inline text-xs font-semibold text-ink-500">Wallet</span>
              <span className="text-sm font-semibold text-ink font-mono">₹{Number(walletBalance).toFixed(2)}</span>
              <button
                type="button"
                onClick={() => navigate('/wallet-recharge')}
                aria-label="Recharge wallet"
                title="Recharge wallet"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <FiPlus size={14} />
              </button>
            </div>

            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={profileDropdownOpen}
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-800 text-[13px] font-bold hover:bg-brand-200 transition-colors"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              >
                {getUserInitials()}
                {pendingInviteCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {pendingInviteCount}
                  </span>
                )}
              </button>

              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-line bg-white p-1.5 shadow-pop z-50">
                    <div className="px-3 py-2.5 border-b border-line-soft mb-1">
                      <p className="text-sm font-bold text-ink truncate">{userProfile.name || 'User'}</p>
                      <p className="text-xs text-ink-500 truncate">{userProfile.email || ''}</p>
                    </div>
                    <button
                      type="button"
                      className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pendingInviteCount > 0 ? 'text-brand-800 bg-brand-50' : 'text-ink-700 hover:bg-[#F3F2FA] hover:text-ink'}`}
                      onClick={() => { setProfileDropdownOpen(false); setSwitchProjectModalOpen(true); }}
                    >
                      <FiBriefcase size={16} /> Switch project
                      {pendingInviteCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                          {pendingInviteCount}
                        </span>
                      )}
                    </button>
                    {activeProjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setProjectQrModalOpen(true);
                        }}
                        className="sm:hidden flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-[#F3F2FA] hover:text-ink transition-colors"
                      >
                        <LuQrCode size={16} /> Project QR code
                      </button>
                    )}
                    {profileItems.map((item, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => {
                          if (item.path !== '#') navigate(item.path);
                          setProfileDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 hover:bg-[#F3F2FA] hover:text-ink transition-colors"
                      >
                        {item.icon} {item.title}
                      </button>
                    ))}
                    <div className="my-1 h-px bg-line-soft"></div>
                    <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors">
                      <FiLogOut size={16} /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <SwitchProjectModal
        isOpen={switchProjectModalOpen}
        onClose={() => setSwitchProjectModalOpen(false)}
        onSelectCompany={handleSelectCompany}
        onInvitationsChange={(list) => setPendingInviteCount(Array.isArray(list) ? list.length : 0)}
      />

      <ProjectQRModal
        isOpen={Boolean(projectQrModalOpen && activeProjectId)}
        onClose={() => setProjectQrModalOpen(false)}
        projectId={activeProjectId}
        projectName={selectedProjectName || selectedCompany?.name || 'Project Chat'}
      />
    </>
  );
};

// Global state for unread count (shared across all Sidebar instances)
let globalUnreadCount = 0;
let unreadCountListeners = [];
let isSocketInitialized = false;
let lastFetchTime = 0;
const FETCH_COOLDOWN = 10000; // 10 seconds cooldown between fetches

const notifyUnreadCountListeners = (count) => {
  globalUnreadCount = count;
  unreadCountListeners.forEach(listener => listener(count));
};

// ==========================================
// 5. Sidebar Component
// ==========================================
const SidebarView = ({ mobileMenuOpen, setMobileMenuOpen, isMinimized, setIsMinimized, totalUnreadCount: propUnreadCount, isFullScreen = false }) => {
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(globalUnreadCount);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Initialize global socket connection and unread count management (once)
  useEffect(() => {
    // Register this component's state setter
    const listenerId = setTotalUnreadCount;
    unreadCountListeners.push(listenerId);

    const userData = getUserData();
    const token = userData?.token;
    const username = userData?.username;
    const selectedProjectId = userData?.selected_project_id;

    // Only fetch if we haven't fetched recently
    const shouldFetch = (Date.now() - lastFetchTime) > FETCH_COOLDOWN;

    if (shouldFetch) {
      // Fetch initial unread count from API (in background)
      const fetchInitialUnreadCount = async () => {
        if (!selectedProjectId) {
          notifyUnreadCountListeners(0);
          return;
        }

        try {
          lastFetchTime = Date.now();
          const response = await getTotalUnreadCount({ project_id: selectedProjectId });
          if (!response.error && typeof response.count === 'number') {
            notifyUnreadCountListeners(response.count);
          }
        } catch (error) {
          console.error('❌ Failed to fetch unread count:', error);
        }
      };

      fetchInitialUnreadCount();
    } else {
      // Use cached value
      setTotalUnreadCount(globalUnreadCount);
    }

    // Initialize socket connection only once
    if (!isSocketInitialized && token && username) {
      isSocketInitialized = true;

      // Connect socket (singleton - will reuse if already exists)
      socketManager.connect(token, username);

      // Register global callback for unread count updates
      socketManager.onUnreadCount((data) => {
        if (data && typeof data.count === 'number') {
          notifyUnreadCountListeners(data.count);
        }
      });
    }

    // Cleanup function
    return () => {
      // Remove this component's listener
      unreadCountListeners = unreadCountListeners.filter(l => l !== listenerId);
    };
  }, []);


  // Check if user is the owner of the project
  const isOwner = useSelector((state) => state.project?.owned ?? true);

  const [projectRevision, setProjectRevision] = useState(0);

  useEffect(() => {
    const refreshProjects = () => setProjectRevision((value) => value + 1);
    window.addEventListener('projects-updated', refreshProjects);
    return () => window.removeEventListener('projects-updated', refreshProjects);
  }, []);

  const userData = getUserData();
  void projectRevision;
  const hasProjects = Boolean(userData?.selected_project_id);

  const handleSidebarHover = (hoverState) => {
    if (isMinimized) setIsHovered(hoverState);
  };

  const sections = [
    {
      key: 'workspace', title: 'Workspace', items: [
        { key: 'dashboard', title: 'Dashboard', icon: <FiGrid size={18} />, path: '/' },
        { key: 'live-chat', title: 'Live chat', icon: <FiMessageSquare size={18} />, path: '/live-chat' },
        { key: 'open-cases', title: 'Open cases', icon: <FiBriefcase size={18} />, path: '/open-cases' },
        { key: 'scanned-users', title: 'Scanned users', icon: <LuQrCode size={18} />, path: '/scanned-users' },
      ]
    },
    {
      key: 'audience', title: 'Audience', items: [
        { key: 'contact', title: 'Contacts', icon: <FiUsers size={18} />, path: '/contact' },
        { key: 'contact-group', title: 'Groups', icon: <FiFolder size={18} />, path: '/contact-group' },
      ]
    },
    {
      key: 'messaging', title: 'Messaging', items: [
        { key: 'templates', title: 'Templates', icon: <FiFileText size={18} />, path: '/template' },
        { key: 'campaigns', title: 'Campaigns', icon: <FiSend size={18} />, path: '/campaigns' },
      ]
    },
    {
      key: 'management', title: 'Management', ownerOnly: true, items: [
        { key: 'agents', title: 'Agents', icon: <FiUserCheck size={18} />, path: '/agent-management' },
        { key: 'permissions', title: 'Permissions', icon: <FiLock size={18} />, path: '/permission-list' },
        { key: 'configuration', title: 'Configuration', icon: <FiSliders size={18} />, path: '/project-config' },
        { key: 'developer', title: 'Developer access', icon: <FiCode size={18} />, path: '/developer-access' },
      ]
    },
    {
      key: 'account', title: 'Account', items: [
        { key: 'projects', title: 'Projects', icon: <FiLayers size={18} />, path: '/projects' },
      ]
    },
  ];

  // Filter sections based on user role (hide Management for agents)
  const visibleSections = sections.filter(section => !(section.ownerOnly && !isOwner));

  const renderNav = (isMobile) => (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {visibleSections.map(section => (
        <div key={section.key} className="flex flex-col gap-0.5">
          {(isMobile || !isMinimized || isHovered) ? (
            <div className="px-2.5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">{section.title}</div>
          ) : (
            <div className="mx-3 my-3 h-px bg-line-soft" />
          )}
          {section.items.map(item => (
            <NavItem
              key={item.key}
              item={item}
              isMobile={isMobile}
              isMinimized={isMinimized}
              isHovered={isHovered}
              currentPath={currentPath}
              setHoveredMenu={setHoveredMenu}
              hoveredMenu={hoveredMenu}
              hasProjects={hasProjects}
              setMobileMenuOpen={setMobileMenuOpen}
              unreadCount={totalUnreadCount}
              navigate={navigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );

  const renderHelp = (compact) => (
    <button
      type="button"
      onClick={() => hasProjects && navigate('/support')}
      disabled={!hasProjects}
      title="Contact support"
      className={`flex items-center gap-3 w-full rounded-[11px] border border-line text-left transition-colors ${compact ? 'justify-center p-2' : 'px-3 py-2.5'} ${hasProjects ? 'bg-white hover:bg-surface-soft' : 'bg-surface-soft cursor-not-allowed opacity-60'}`}
    >
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <FiHelpCircle size={16} />
      </span>
      {!compact && (
        <span className="flex flex-col">
          <span className="text-[13px] font-bold text-ink leading-tight">Need help?</span>
          <span className="text-xs text-ink-500">{hasProjects ? 'Contact support' : 'Locked'}</span>
        </span>
      )}
    </button>
  );

  const isCompact = isMinimized && !isHovered;

  return (
    <>
      <AnimatePresence>
        {mobileMenuOpen && !isFullScreen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} />
            <motion.div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl md:hidden flex flex-col" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="h-16 flex items-center justify-between px-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover" />
                  <span className="text-[17px] font-extrabold tracking-tight text-ink">OneChatting</span>
                </div>
                <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-[9px] text-ink-500 hover:bg-[#F3F2FA] hover:text-ink transition-colors">
                  <FiX size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3.5 py-4">
                {renderNav(true)}
              </div>
              <div className="p-3.5 border-t border-line">{renderHelp(false)}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.aside
        className="hidden md:flex md:flex-col md:fixed md:top-0 md:left-0 bg-white border-r border-line z-40"
        initial={false}
        animate={{
          width: isCompact ? 80 : 260,
          x: isFullScreen ? -280 : 0,
          opacity: isFullScreen ? 0 : 1,
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{
          height: '100vh',
          pointerEvents: isFullScreen ? 'none' : 'auto',
        }}
        onMouseEnter={() => handleSidebarHover(true)}
        onMouseLeave={() => handleSidebarHover(false)}
      >
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="OneChatting home"
          className={`h-16 flex-none flex items-center gap-2.5 border-b border-line ${isCompact ? 'justify-center px-0' : 'px-5'}`}
        >
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-cover flex-none" />
          {!isCompact && <span className="text-[17px] font-extrabold tracking-tight text-ink whitespace-nowrap">OneChatting</span>}
        </button>
        <div className="flex-1 flex flex-col overflow-y-auto px-3.5 py-4 scrollbar-hide">
          {renderNav(false)}
        </div>
        <div className="p-3.5 border-t border-line">{renderHelp(isCompact)}</div>
      </motion.aside>
    </>
  );
};


// ==========================================
// 6. Persistent app shell
// ==========================================
// The header and sidebar are rendered ONCE by <ShellProvider> (mounted around the
// routes in index.js), so navigating between pages no longer remounts them — the
// sidebar keeps its scroll position and nothing flashes. Pages still render
// <Header/> and <Sidebar/>; inside the shell those calls only sync state
// (collapsed sidebar, full-screen mode) and render nothing.
const ShellContext = React.createContext(null);

const readMinimizedPref = () => {
  try { return JSON.parse(localStorage.getItem('sidebarMinimized')) === true; } catch (e) { return false; }
};

const hasActiveSession = () => {
  try { return Boolean(JSON.parse(localStorage.getItem('userData'))?.token); } catch (e) { return false; }
};

export const ShellProvider = ({ children }) => {
  const location = useLocation();
  const [isMinimized, setIsMinimizedState] = useState(readMinimizedPref);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  const setIsMinimized = useCallback((value) => {
    setIsMinimizedState(prev => {
      const next = typeof value === 'function' ? value(prev) : Boolean(value);
      try { localStorage.setItem('sidebarMinimized', JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  const register = useCallback(() => {
    setActiveCount(c => c + 1);
    return () => setActiveCount(c => Math.max(0, c - 1));
  }, []);

  // Close the mobile drawer after navigating
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  // Lock page scroll while the mobile drawer is open
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);

  const value = useMemo(() => ({
    isMinimized, setIsMinimized, mobileMenuOpen, setMobileMenuOpen, isFullScreen, setIsFullScreen, register,
  }), [isMinimized, setIsMinimized, mobileMenuOpen, isFullScreen, register]);

  const sessionActive = hasActiveSession();
  const visible = sessionActive && activeCount > 0;

  // Mount the header/sidebar only after a protected page has rendered (i.e. after the
  // session check), then keep them mounted for the rest of the session.
  const [shellReady, setShellReady] = useState(false);
  useEffect(() => {
    if (visible && !shellReady) setShellReady(true);
    if (!sessionActive && shellReady) setShellReady(false);
  }, [visible, sessionActive, shellReady]);

  return (
    <ShellContext.Provider value={value}>
      {/* Shell first in the DOM so page modals (z-50) render above the header */}
      {sessionActive && (shellReady || visible) && (
        <div style={visible ? undefined : { display: 'none' }}>
          <HeaderView
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            isMinimized={isMinimized}
            setIsMinimized={setIsMinimized}
            isFullScreen={isFullScreen}
          />
          <SidebarView
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            isMinimized={isMinimized}
            setIsMinimized={setIsMinimized}
            isFullScreen={isFullScreen}
          />
        </div>
      )}
      {children}
    </ShellContext.Provider>
  );
};

export const useShell = () => useContext(ShellContext);

// Page-level Header: inside the shell it only syncs state; outside it renders as before.
export const Header = ({ isMinimized, setIsMinimized, isFullScreen = false, ...rest }) => {
  const shell = useContext(ShellContext);
  const register = shell?.register;
  const shellMinimized = shell?.isMinimized;
  const setShellFullScreen = shell?.setIsFullScreen;

  useLayoutEffect(() => (register ? register() : undefined), [register]);

  useLayoutEffect(() => {
    if (shell && typeof setIsMinimized === 'function' && isMinimized !== shellMinimized) {
      setIsMinimized(shellMinimized);
    }
  }, [shell, shellMinimized, isMinimized, setIsMinimized]);

  useLayoutEffect(() => {
    if (setShellFullScreen) setShellFullScreen(Boolean(isFullScreen));
  }, [setShellFullScreen, isFullScreen]);

  useLayoutEffect(() => () => { if (setShellFullScreen) setShellFullScreen(false); }, [setShellFullScreen]);

  if (shell) return null;
  return <HeaderView isMinimized={isMinimized} setIsMinimized={setIsMinimized} isFullScreen={isFullScreen} {...rest} />;
};

// Page-level Sidebar: rendered by the shell instead.
export const Sidebar = (props) => {
  const shell = useContext(ShellContext);
  if (shell) return null;
  return <SidebarView {...props} />;
};

// ==========================================
// 7. Main Layout Wrapper (Default Export)
// ==========================================
const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="min-h-screen bg-surface-ground font-sans text-ink">
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

      <main
        className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
          }`}
      >
        <div className="w-full px-4 py-5 animate-in fade-in duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
