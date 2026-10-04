import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  FiMenu, FiBriefcase, FiChevronDown, FiCreditCard,
  FiPlus, FiBell, FiUser, FiSettings, FiHelpCircle,
  FiLogOut, FiPieChart, FiMessageSquare, FiUsers,
  FiMail, FiZap, FiCpu, FiLock, FiChevronRight, FiX,
  FiMaximize2, FiMinimize2
} from 'react-icons/fi';

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
const THEME = {
  active: "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm", // Soft Indigo background for active
  inactive: "text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-600 border-transparent", // Subtle hover
  locked: "text-slate-300 cursor-not-allowed hover:bg-transparent",
  iconActive: "text-indigo-600",
  iconInactive: "text-slate-400 group-hover:text-indigo-500"
};

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

const isSubmenuItemActive = (submenuPath, currentPath) => {
  if (submenuPath === '/') return currentPath === '/' || currentPath === '';
  return submenuPath && submenuPath !== '#' && (currentPath === submenuPath || currentPath.startsWith(submenuPath + '/'));
};

// ==========================================
// 3. NavItem Component (MOVED OUTSIDE)
// ==========================================
const NavItem = React.memo(({ item, isMobile, isMinimized, isHovered, currentPath, openSubmenus, toggleSubmenu, setHoveredMenu, hoveredMenu, setMobileMenuOpen, hasProjects, unreadCount, navigate }) => {
  const isActive = isItemActive(item, currentPath);
  const isDashboard = item.key === 'dashboard' || item.path === '/';
  const isDisabled = !hasProjects && !isDashboard;
  const hasSubmenu = item.submenus && item.submenus.length > 0;
  const isOpen = isMobile ? openSubmenus[`mobile-${item.key}`] : openSubmenus[item.key];
  const isMini = !isMobile && isMinimized && !isHovered;
  const showUnreadBadge = item.key === 'live-chat' && unreadCount > 0;


  // Render Submenu Item (Parent)
  if (hasSubmenu) {
    return (
      <div className="mb-1">
        <button
          onClick={() => !isMini && !isDisabled && toggleSubmenu(isMobile ? `mobile-${item.key}` : item.key)}
          disabled={isDisabled}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group border
            ${isDisabled ? THEME.locked : isActive ? THEME.active : THEME.inactive}
            ${isMini ? 'justify-center px-2' : ''}`}
          onMouseEnter={() => isMini && setHoveredMenu(item.key)}
          onMouseLeave={() => isMini && setHoveredMenu(null)}
        >
          <div className={`flex items-center ${isMini ? 'justify-center w-full' : 'gap-3'}`}>
            <span className={`${isDisabled ? 'text-slate-300' : isActive ? THEME.iconActive : THEME.iconInactive} transition-colors`}>
              {item.icon}
            </span>
            {!isMini && (
              <div className="flex-1 flex items-center justify-between">
                <span>{item.title}</span>
                {isDisabled && <FiLock size={12} className="text-slate-300 ml-2" />}
              </div>
            )}
          </div>
          {!isMini && !isDisabled && (
            <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <FiChevronRight size={16} className={isActive ? "text-indigo-400" : "text-slate-400"} />
            </motion.span>
          )}

          {/* Tooltip for Mini Mode */}
          {isMini && hoveredMenu === item.key && (
            <div className="absolute left-16 ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md shadow-lg z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
              {item.title} {isDisabled && '(Locked)'}
            </div>
          )}
        </button>

        <AnimatePresence>
          {(!isMini && isOpen && !isDisabled) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="ml-5 pl-4 border-l-2 border-indigo-100 my-1 space-y-0.5">
                {item.submenus.map((sub, idx) => {
                  const isSubActive = isSubmenuItemActive(sub.path, currentPath);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        navigate(sub.path);
                        if (isMobile) setMobileMenuOpen(false);
                      }}
                      className={`block px-3 py-2 rounded-md text-sm transition-all duration-200 cursor-pointer ${isSubActive ? 'text-indigo-700 font-semibold bg-indigo-50' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-50'}`}
                    >
                      {sub.title}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Render Single Link Item
  return (
    <div className="mb-1 relative">
      <div
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
          } else {
            navigate(item.path);
            if (isMobile) setMobileMenuOpen(false);
          }
        }}
        className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group border cursor-pointer
          ${isDisabled ? THEME.locked : isActive ? THEME.active : THEME.inactive}
          ${isMini ? 'justify-center px-2' : ''}`}
        onMouseEnter={() => isMini && setHoveredMenu(item.key)}
        onMouseLeave={() => isMini && setHoveredMenu(null)}
      >
        <span className={`${isMini ? '' : 'mr-3'} ${isDisabled ? 'text-slate-300' : isActive ? THEME.iconActive : THEME.iconInactive} transition-colors relative`}>
          {item.icon}
          {isMini && showUnreadBadge && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-green-500 text-white text-[10px] font-semibold flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {!isMini && (
          <div className="flex-1 flex items-center justify-between">
            <span>{item.title}</span>
            <div className="flex items-center gap-2">
              {showUnreadBadge && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              {isDisabled && <FiLock size={12} className="text-slate-300" />}
            </div>
          </div>
        )}
        {isMini && hoveredMenu === item.key && (
          <div className="absolute left-16 ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-md shadow-lg z-50 whitespace-nowrap animate-in fade-in zoom-in-95 duration-200">
            {item.title} {isDisabled && '(Locked)'}
          </div>
        )}
      </div>
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
// 4. Header Component
// ==========================================
export const Header = ({ mobileMenuOpen, setMobileMenuOpen, isMinimized, setIsMinimized, isFullScreen = false }) => {
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
    const pInfo = getSelectedProjectInfo();
    setActiveProjectId(pInfo.id);
    setSelectedProjectName(pInfo.name);
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
    { title: 'Transactions', icon: <FiPieChart size={16} />, path: '/transactions' },
    { title: 'AI Bills', icon: <FiPieChart size={16} />, path: '/ai-bills' },
  ];

  return (
    <>
      <SubscriptionAlert isMinimized={isMinimized} isFullScreen={isFullScreen} />
      <header className={`fixed top-0 inset-x-0 z-50 h-16 border-b border-indigo-100 bg-white/90 backdrop-blur-md transition-all duration-300 ease-in-out ${isFullScreen ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}>
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              className="text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 p-2 rounded-md transition-colors focus:outline-none"
              onClick={window.innerWidth >= 768 ? toggleSidebar : () => setMobileMenuOpen(true)}
            >
              <FiMenu size={22} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')} aria-label="OneChatting home">
              <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
              <span className="text-lg font-bold tracking-tight text-slate-800 whitespace-nowrap">
                One<span className="text-indigo-600">Chatting</span>
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3 md:gap-5">
            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="hidden md:flex items-center justify-center h-9 w-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all duration-200"
              title={isBrowserFullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
              aria-label={isBrowserFullscreen ? 'Exit full screen' : 'Enter full screen'}
            >
              {isBrowserFullscreen ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
            </button>

            <button
              onClick={() => setSwitchProjectModalOpen(true)}
              className={`relative flex items-center gap-2 rounded-lg border bg-white px-2.5 md:px-3 py-1.5 text-sm font-medium hover:shadow-sm transition-all duration-200 group ${pendingInviteCount > 0 ? 'border-indigo-400 text-indigo-700' : 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-600'}`}
            >
              {pendingInviteCount > 0 && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-1 rounded-xl"
                  animate={{
                    boxShadow: [
                      '0 0 0 0 rgba(99,102,241,0.55)',
                      '0 0 12px 4px rgba(99,102,241,0.35)',
                      '0 0 0 0 rgba(99,102,241,0)'
                    ]
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <FiBriefcase size={16} className={`transition-colors ${pendingInviteCount > 0 ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
              <span className="hidden md:inline max-w-[120px] truncate">{selectedProjectName || selectedCompany?.name || 'Select Project'}</span>
              <FiChevronDown size={14} className="hidden md:inline text-slate-400" />
              {pendingInviteCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow">
                  {pendingInviteCount}
                </span>
              )}
            </button>

            {activeProjectId && (
              <button
                type="button"
                onClick={() => setProjectQrModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all duration-200 group"
                title="View & Download Project QR Code"
              >
                <LuQrCode size={15} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                <span>QR Code</span>
              </button>
            )}

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-3 shadow-sm hover:border-indigo-200 transition-colors cursor-default">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <FiCreditCard size={14} />
              </div>
              <div className="flex flex-col leading-none">
                {/* <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Balance</span> */}
                <span className="text-sm font-bold text-slate-700 font-mono">₹{Number(walletBalance).toFixed(2)}</span>
              </div>
              <button onClick={() => navigate('/wallet-recharge')} className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 transition-all shadow-md shadow-indigo-200">
                <FiPlus size={12} />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200"></div>


            <div className="relative" ref={profileDropdownRef}>
              <button className="flex items-center gap-2 focus:outline-none ring-offset-2 focus:ring-2 focus:ring-indigo-100 rounded-full transition-all" onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-medium text-sm shadow-md shadow-indigo-200 border-2 border-white">{getUserInitials()}</div>
              </button>

              {profileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-3 w-56 origin-top-right rounded-xl border border-slate-100 bg-white p-1 shadow-xl ring-1 ring-black ring-opacity-5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1">
                      <p className="text-sm font-semibold text-slate-900">{userProfile.name || 'User'}</p>
                      <p className="text-xs text-slate-500 truncate">{userProfile.email || ''}</p>
                    </div>
                    <button className={`md:hidden relative flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${pendingInviteCount > 0 ? 'text-indigo-700 bg-indigo-50' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}`} onClick={() => { setProfileDropdownOpen(false); setSwitchProjectModalOpen(true); }}>
                      <FiBriefcase size={16} /> Switch Project
                      {pendingInviteCount > 0 && (
                        <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white animate-pulse">
                          {pendingInviteCount}
                        </span>
                      )}
                    </button>
                    {activeProjectId && (
                      <div
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          setProjectQrModalOpen(true);
                        }}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        <LuQrCode size={16} className="text-indigo-500" /> Project QR Code
                      </div>
                    )}
                    {profileItems.map((item, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          if (item.path !== '#') navigate(item.path);
                          setProfileDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        {item.icon} {item.title}
                      </div>
                    ))}
                    <div className="my-1 h-px bg-slate-100"></div>
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <FiLogOut size={16} /> Logout
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

      {projectQrModalOpen && activeProjectId && (
        <ProjectQRModal
          isOpen={projectQrModalOpen}
          onClose={() => setProjectQrModalOpen(false)}
          projectId={activeProjectId}
          projectName={selectedProjectName || selectedCompany?.name || 'Project Chat'}
        />
      )}
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
export const Sidebar = ({ mobileMenuOpen, setMobileMenuOpen, isMinimized, setIsMinimized, totalUnreadCount: propUnreadCount, isFullScreen = false }) => {
  const [openSubmenus, setOpenSubmenus] = useState({});
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

  const toggleSubmenu = (menuKey) => {
    setOpenSubmenus(prev => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const handleSidebarHover = (hoverState) => {
    if (isMinimized) setIsHovered(hoverState);
  };

  const allMenuItems = [
    { key: 'dashboard', title: 'Dashboard', icon: <FiPieChart size={18} />, path: '/' },
    { key: 'live-chat', title: 'Live Chat', icon: <FiMessageSquare size={18} />, path: '/live-chat' },
    { key: 'open-cases', title: 'Open Cases', icon: <FiBriefcase size={18} />, path: '/open-cases' },
    { key: 'scanned-users', title: 'Scanned Users', icon: <LuQrCode size={18} />, path: '/scanned-users' },
    {
      key: 'contact', title: 'Audience', icon: <FiUsers size={18} />,
      submenus: [
        { title: 'All Contacts', path: '/contact' },
        { title: 'Groups', path: '/contact-group' },
      ]
    },
    { key: 'templates', title: 'Templates', icon: <FiMail size={18} />, path: '/template' },
    { key: 'campaigns', title: 'Campaigns', icon: <FiZap size={18} />, path: '/campaigns' },
    // {
    //   key: 'automation', title: 'Automation', icon: <FiCpu size={18} />,
    //   submenus: [
    //     { title: 'Auto Reply', path: '/auto-reply' },
    //     { title: 'Flow Builder', path: '/flow' }
    //   ]
    // },
    { key: 'projects', title: 'Projects', icon: <FiBriefcase size={18} />, path: '/projects' },
    {
      key: 'management', title: 'Management', icon: <FiSettings size={18} />,
      submenus: [
        { title: 'Agents', path: '/agent-management' },
        { title: 'Permissions', path: '/permission-list' },
        { title: 'Configuration', path: '/project-config' },
        { title: 'Developer Access', path: '/developer-access' }
      ]
    }
  ];

  // Filter menu items based on user role (hide Management for agents)
  const menuItems = allMenuItems.filter(item => {
    if (!isOwner && item.key === 'management') {
      return false;
    }
    return true;
  });

  return (
    <>
      <AnimatePresence>
        {mobileMenuOpen && !isFullScreen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} />
            <motion.div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl md:hidden flex flex-col" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: "spring", damping: 30, stiffness: 300 }}>
              <div className="h-16 flex items-center justify-between px-6 border-b border-indigo-100 bg-indigo-50/30">
                <span className="text-xl font-bold text-slate-800 font-sans">WICHAT</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                  <FiX size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                {menuItems.map(item => (
                  <NavItem
                    key={item.key}
                    item={item}
                    isMobile={true}
                    currentPath={currentPath}
                    openSubmenus={openSubmenus}
                    toggleSubmenu={toggleSubmenu}
                    hasProjects={hasProjects}
                    setMobileMenuOpen={setMobileMenuOpen}
                    unreadCount={totalUnreadCount}
                    navigate={navigate}
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 bg-white border-r border-indigo-100 z-40 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]"
        initial={false}
        animate={{
          width: (isMinimized && !isHovered) ? 80 : 260,
          x: isFullScreen ? -280 : 0,
          opacity: isFullScreen ? 0 : 1,
        }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        style={{
          top: isFullScreen ? 0 : '64px',
          height: isFullScreen ? '100vh' : 'calc(100vh - 64px)',
          pointerEvents: isFullScreen ? 'none' : 'auto',
        }}
        onMouseEnter={() => handleSidebarHover(true)}
        onMouseLeave={() => handleSidebarHover(false)}
      >
        <div className="flex-1 flex flex-col overflow-y-auto py-6 px-3 scrollbar-hide">
          <nav className="space-y-1">
            {menuItems.map(item => (
              <NavItem
                key={item.key}
                item={item}
                isMobile={false}
                isMinimized={isMinimized}
                isHovered={isHovered}
                currentPath={currentPath}
                openSubmenus={openSubmenus}
                toggleSubmenu={toggleSubmenu}
                setHoveredMenu={setHoveredMenu}
                hoveredMenu={hoveredMenu}
                hasProjects={hasProjects}
                unreadCount={totalUnreadCount}
                navigate={navigate}
              />
            ))}
          </nav>
        </div>

        <AnimatePresence>
          {(!isMinimized || isHovered) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ delay: 0.1 }} className="p-3 border-t border-indigo-100">
              <div
                onClick={() => hasProjects && navigate('/support')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all group ${hasProjects ? 'bg-gradient-to-r from-indigo-50 to-white border-indigo-100 hover:border-indigo-200 hover:shadow-sm cursor-pointer' : 'bg-slate-50 border-slate-100 cursor-not-allowed'}`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border transition-transform ${hasProjects ? 'text-indigo-600 border-indigo-50 group-hover:scale-105' : 'text-slate-300 border-slate-100'}`}>
                  <FiHelpCircle size={16} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold leading-none mb-0.5 ${hasProjects ? 'text-slate-700' : 'text-slate-300'}`}>Need Help?</span>
                  <span className={`text-[10px] font-medium ${hasProjects ? 'text-slate-500' : 'text-slate-300'}`}>{hasProjects ? 'Contact Support' : 'Locked'}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

// ==========================================
// 6. Main Layout Wrapper (Default Export)
// ==========================================
const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
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
        <div className="p-4 sm:p-6 lg:p-8 max-w-8xl mx-auto animate-in fade-in duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
