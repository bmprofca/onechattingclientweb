import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Sidebar } from '../component/Menu';
import {
  FiPlus,
  FiSearch,
  FiBriefcase,
  FiEye
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { fetchUserProfile, respondAgentInvitation } from '../api/auth';
import ProjectQRModal from '../component/Modals/ProjectQRModal';
import CreateProjectModal from '../component/Modals/CreateProjectModal';
import { LuQrCode } from 'react-icons/lu';

const SkeletonBar = ({ className = '' }) => (
  <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
);

const ProjectCardSkeleton = () => (
  <div className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 min-h-[100px] flex flex-col animate-pulse">
    <div className="flex items-start gap-2 w-full">
      <SkeletonBar className="h-5 flex-1" />
      <SkeletonBar className="h-5 w-16 rounded flex-shrink-0" />
    </div>
    <SkeletonBar className="h-4 w-2/3 mt-2" />
    <div className="mt-auto pt-2 flex items-center gap-2">
      <SkeletonBar className="h-5 w-16 rounded-full" />
      <SkeletonBar className="h-4 w-24" />
    </div>
  </div>
);

const ProjectsSkeleton = () => (
  <>
    <div className="mb-6 animate-pulse">
      <SkeletonBar className="h-10 w-full rounded-lg" />
    </div>

    <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-card border border-line dark:border-gray-700 border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
        >
          <SkeletonBar className="h-4 w-24 mb-2" />
          <SkeletonBar className="h-8 w-12" />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </div>
  </>
);

const mapProject = (project) => ({
  id: project.project_id,
  project_id: project.project_id,
  name: project.name,
  owned: project.owned,
  owner_name: project.owner_name,
  phone: project.wa_number || project.phone || project.display_phone_number || '',
  subscriptionEnd: project.subscription_end_date || project.valid_until || '',
  quality: project.wa_quality_rating || project.quality || '',
  image: project.profile_picture || project.profile_image || project.logo || project.image || ''
});

const projectInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts[1]?.[0] || '')).toUpperCase();
};

const Projects = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [projectFilter, setProjectFilter] = useState('all');
  const [qrModalProject, setQrModalProject] = useState(null);
  // Keep the last project so the QR modal can finish its exit animation after close.
  const lastQrProjectRef = useRef(null);
  if (qrModalProject) lastQrProjectRef.current = { id: qrModalProject.id || qrModalProject.project_id, name: qrModalProject.name };

  const userProjects = Array.isArray(userData?.projects?.list) ? userData.projects.list : [];
  const hasUserProjects = userData && userProjects.length > 0;

  const [activeProjectId, setActiveProjectId] = useState(null);

  // Get active project ID from localStorage
  useEffect(() => {
    const getUserData = () => {
      try {
        const userData = localStorage.getItem('userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          return parsed.selected_project_id || null;
        }
      } catch (error) {
        console.error('Error parsing userData:', error);
      }
      return null;
    };
    setActiveProjectId(getUserData());
  }, [userData]); // Update when userData changes

  // Fetch user profile data on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setLoading(true);
        const response = await fetchUserProfile();

        if (response && !response.error) {
          const profileData = response;
          setUserData(profileData);


          // Set projects from API response
          if (Array.isArray(profileData.projects?.list)) {
            setProjects(profileData.projects.list.map(mapProject));
          }
          setInvitations(Array.isArray(profileData.pending_invitations) ? profileData.pending_invitations : []);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast.error('Failed to load projects');

      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

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

  const searchedProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.owner_name && project.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const ownedCount = searchedProjects.filter(p => p.owned === true).length;
  const sharedCount = searchedProjects.filter(p => p.owned === false).length;
  const filteredProjects = searchedProjects.filter((project) => {
    if (projectFilter === 'owned') return project.owned === true;
    if (projectFilter === 'agent') return project.owned === false;
    return true;
  });

  const handleCreateProject = () => {
    setShowCreateModal(true);
  };

  const handleProjectCreated = (profileResponse) => {
    if (!profileResponse || profileResponse.error) return;
    setUserData(profileResponse);
    if (Array.isArray(profileResponse.projects?.list)) {
      setProjects(profileResponse.projects.list.map(mapProject));
    }
    if (Array.isArray(profileResponse.pending_invitations)) {
      setInvitations(profileResponse.pending_invitations);
    }
  };

  const handleInvitation = async (invitation, action) => {
    if (!invitation?.invitation_id || respondingId) return;
    setRespondingId(invitation.invitation_id);
    try {
      const result = await respondAgentInvitation({
        invitation_id: invitation.invitation_id,
        action
      });
      if (result?.error) {
        toast.error(typeof result.error === 'string' ? result.error : 'Could not update the invitation');
        return;
      }
      const profile = await fetchUserProfile();
      if (profile && !profile.error) {
        setUserData(profile);
        if (Array.isArray(profile.projects?.list)) setProjects(profile.projects.list.map(mapProject));
        setInvitations(Array.isArray(profile.pending_invitations)
          ? profile.pending_invitations
          : invitations.filter((item) => item.invitation_id !== invitation.invitation_id));
      } else {
        setInvitations((prev) => prev.filter((item) => item.invitation_id !== invitation.invitation_id));
      }
      toast.success(action === 'accept' ? 'Invitation accepted' : 'Invitation declined');
    } catch (inviteError) {
      toast.error('Could not update the invitation');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-ground">
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

      {/* Main content - same layout as Switch Project Modal */}
      <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
            <div>
              <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Projects</h1>
              <p className="mt-1.5 text-sm text-ink-500">Each project is one WhatsApp Business number with its own contacts, chats and team.</p>
            </div>
            <button type="button" onClick={handleCreateProject} className="oc-btn-primary">
              <FiPlus size={16} />
              Create project
            </button>
          </div>

          {loading ? (
            <ProjectsSkeleton />
          ) : (
            <>
              {!hasUserProjects && (
                <div className="mb-5 rounded-[14px] border border-amber-200 bg-amber-50 p-4">
                  <h2 className="text-sm font-bold text-amber-900">No projects yet</h2>
                  <p className="mt-1 text-sm text-amber-800">You need a project before live chat, templates, and campaigns are available.</p>
                  <button type="button" onClick={handleCreateProject} className="oc-btn-primary mt-3">
                    Create your first project
                  </button>
                </div>
              )}

              {invitations.length > 0 && (
                <div className="mb-5 space-y-3">
                  {invitations.map((invitation) => {
                    const busy = respondingId === invitation.invitation_id;
                    const who = invitation.project_name || invitation.invited_by_name;
                    const invitedDate = (() => {
                      if (!invitation.create_date) return '';
                      const parsed = new Date(String(invitation.create_date).replace(' ', 'T'));
                      if (Number.isNaN(parsed.getTime())) return '';
                      return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    })();
                    return (
                      <div key={invitation.invitation_id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[14px] border border-amber-200 bg-[#FFF8EC] px-4 py-3">
                        <p className="text-sm text-ink">
                          <span className="font-bold">{who || 'A project'}</span>
                          {' invited you as an agent'}
                          {invitation.permission_name ? ` · ${invitation.permission_name}` : ''}
                          {invitedDate ? ` · invited ${invitedDate}` : ''}
                        </p>
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={busy} onClick={() => handleInvitation(invitation, 'reject')} className="oc-btn-ghost">
                            Decline
                          </button>
                          <button type="button" disabled={busy} onClick={() => handleInvitation(invitation, 'accept')} className="oc-btn-primary">
                            {busy ? 'Please wait' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'all', label: 'All', count: searchedProjects.length },
                    { id: 'owned', label: 'Owned', count: ownedCount },
                    { id: 'agent', label: 'As agent', count: sharedCount }
                  ].map((pill) => {
                    const active = projectFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setProjectFilter(pill.id)}
                        className={`h-8 px-3 rounded-full text-[13px] font-semibold ${active ? 'bg-ink text-white' : 'bg-white text-ink-500 border border-line'}`}
                      >
                        {pill.label} {pill.count}
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search by project name or owner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-[38px] w-full lg:w-72 pl-9 pr-3 rounded-[9px] border border-line bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600"
                  />
                </div>
              </div>

              {filteredProjects.length === 0 ? (
                <div className="bg-white border border-line rounded-[14px] p-12 text-center">
                  <FiBriefcase className="mx-auto text-ink-400 mb-4" size={40} />
                  <h2 className="text-base font-bold text-ink mb-1">{searchTerm || projectFilter !== 'all' ? 'No projects found' : 'No projects yet'}</h2>
                  <p className="text-sm text-ink-500 mb-4">{searchTerm ? 'Try a different search.' : 'Create a project for a WhatsApp Business number.'}</p>
                  {!searchTerm && projectFilter === 'all' && (
                    <button type="button" onClick={handleCreateProject} className="oc-btn-primary">
                      <FiPlus size={16} />
                      Create project
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => {
                    const isActive = activeProjectId === project.id;
                    const isOwned = project.owned === true;
                    const rows = [
                      { label: 'Your role', value: isOwned ? 'Owner' : 'Agent' },
                      project.phone ? { label: 'Number', value: project.phone } : null,
                      project.subscriptionEnd ? { label: 'Valid until', value: project.subscriptionEnd } : null,
                      project.quality ? { label: 'Quality', value: project.quality } : null
                    ].filter(Boolean);
                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white rounded-[14px] border p-4 flex flex-col ${isActive ? 'border-brand-600' : 'border-line'} ${isOwned ? '' : 'opacity-95'}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                            {projectInitials(project.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <h2 className="truncate text-[15px] font-bold text-ink" title={project.name}>{project.name}</h2>
                              {isActive && <span className="oc-badge bg-brand-50 text-brand-800">Current</span>}
                            </div>
                            {project.phone ? <p className="mt-0.5 font-mono text-[13px] text-ink-500">{project.phone}</p> : null}
                          </div>
                        </div>
                        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                          {rows.map((row) => (
                            <React.Fragment key={row.label}>
                              <dt className="text-ink-500">{row.label}</dt>
                              <dd className={`m-0 text-right font-semibold text-ink ${row.label === 'Number' ? 'font-mono' : ''}`}>{row.value}</dd>
                            </React.Fragment>
                          ))}
                        </dl>
                        {!isOwned && project.owner_name ? (
                          <p className="mt-2 text-xs text-ink-500 truncate">Owner · {project.owner_name}</p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQrModalProject(project)}
                            className="oc-btn-ghost h-8 px-2.5 text-xs"
                          >
                            <LuQrCode size={14} />
                            QR code
                          </button>
                          {isOwned && (
                            <button
                              type="button"
                              onClick={() => navigate(`/project-details/${project.id}`)}
                              className="oc-btn-ghost h-8 px-2.5 text-xs"
                            >
                              <FiEye size={14} />
                              Details
                            </button>
                          )}
                          {isActive && (
                            <button type="button" onClick={() => navigate('/')} className="oc-btn-primary h-8 px-3 text-xs">
                              Open
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleProjectCreated}
      />

      {/* Project QR Code Modal */}
      <ProjectQRModal
        isOpen={!!qrModalProject}
        onClose={() => setQrModalProject(null)}
        projectId={qrModalProject ? (qrModalProject.id || qrModalProject.project_id) : lastQrProjectRef.current?.id}
        projectName={qrModalProject ? qrModalProject.name : lastQrProjectRef.current?.name}
      />
    </div>
  );
};

export default Projects;