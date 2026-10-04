import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, Sidebar } from '../component/Menu';
import {
  FiPlus,
  FiSearch,
  FiBriefcase,
  FiEye,
  FiUser,
  FiShield,
  FiUserCheck
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { fetchUserProfile } from '../api/auth';
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
          className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
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
  const [qrModalProject, setQrModalProject] = useState(null);

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
            setProjects(profileData.projects.list.map(project => ({
              id: project.project_id,
              project_id: project.project_id,
              name: project.name,
              owned: project.owned,
              owner_name: project.owner_name
            })));
          }
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

  // Filter projects based on search (name, owner)
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.owner_name && project.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ownedCount = filteredProjects.filter(p => p.owned === true).length;
  const sharedCount = filteredProjects.filter(p => p.owned === false).length;

  const handleCreateProject = () => {
    setShowCreateModal(true);
  };

  const handleProjectCreated = (profileResponse) => {
    if (!profileResponse || profileResponse.error) return;
    setUserData(profileResponse);
    if (Array.isArray(profileResponse.projects?.list)) {
      setProjects(profileResponse.projects.list.map(project => ({
        id: project.project_id,
        project_id: project.project_id,
        name: project.name,
        owned: project.owned,
        owner_name: project.owner_name
      })));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
        <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-6">
          {/* Header - same style as modal */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <FiBriefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Projects</h1>
                {loading ? (
                  <SkeletonBar className="h-4 w-36 mt-1" />
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} · {sharedCount} agent
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleCreateProject}
              className="flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <FiPlus size={20} />
              <span>Create Project</span>
            </button>
          </div>

          {loading ? (
            <ProjectsSkeleton />
          ) : (
            <>
              {/* No Projects Warning */}
              {!hasUserProjects && (
                <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <FiBriefcase className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        No Projects Found
                      </h3>
                      <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                        <p>
                          You need to create at least one project to access Live Chat, Templates, and Campaigns features.
                        </p>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={handleCreateProject}
                          className="bg-amber-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                        >
                          Create Your First Project
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Search Bar - same style as modal */}
              <div className="mb-6 px-0 py-0">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                  <input
                    type="text"
                    placeholder="Search by project name or owner..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                  />
                </div>
              </div>

              {/* Stats Summary - Total, Owned, Shared */}
              {filteredProjects.length > 0 && (
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Projects</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{filteredProjects.length}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Owned</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{ownedCount}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Agent</p>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{sharedCount}</p>
                  </div>
                </div>
              )}

              {/* Projects Grid - same card design as Switch Project Modal */}
              {filteredProjects.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <FiBriefcase className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {searchTerm ? 'No projects found' : 'No projects yet'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {searchTerm ? 'Try a different search term' : 'Get started by creating your first project'}
                  </p>
                  {!searchTerm && (
                    <button
                      onClick={handleCreateProject}
                      className="inline-flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <FiPlus size={18} />
                      <span>Create Project</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => {
                    const isActive = activeProjectId === project.id;
                    const isOwned = project.owned === true;
                    return (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 min-h-[100px] flex flex-col ${isOwned
                          ? 'cursor-pointer'
                          : 'cursor-not-allowed'
                          } ${isActive
                            ? 'border-indigo-400 bg-indigo-50/70 dark:bg-indigo-900/15'
                            : isOwned
                              ? 'border-gray-200 dark:border-gray-600 hover:border-indigo-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-sm'
                              : 'border-gray-200 dark:border-gray-600 opacity-90'
                          }`}
                        onClick={() => { if (isOwned) navigate(`/project-details/${project.id}`); }}
                      >
                        {/* Row 1: Project name + role badge (same as modal) */}
                        <div className="flex items-start gap-2 w-full min-w-0">
                          <h3 className={`flex-1 min-w-0 font-semibold text-base truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`} title={project.name}>
                            {project.name}
                          </h3>
                          <span className="flex-shrink-0 mt-0.5">
                            {isOwned ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 rounded">
                                <FiShield className="w-3 h-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-600/50 rounded">
                                <FiUserCheck className="w-3 h-3" />
                                Agent
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Row 2: Owner */}
                        {project.owner_name && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 min-w-0">
                            <FiUser className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            <span className="truncate">{project.owner_name}</span>
                          </p>
                        )}

                        {/* Row 3: Active + Actions */}
                        <div className="mt-auto pt-2 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isActive && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 rounded-full">
                                Current
                              </span>
                            )}
                            {isOwned && (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/project-details/${project.id}`); }}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                                View Details
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQrModalProject(project);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-800"
                            title="View & Download Project QR Code"
                          >
                            <LuQrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>QR Code</span>
                          </button>
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
      {qrModalProject && (
        <ProjectQRModal
          isOpen={!!qrModalProject}
          onClose={() => setQrModalProject(null)}
          projectId={qrModalProject.id || qrModalProject.project_id}
          projectName={qrModalProject.name}
        />
      )}
    </div>
  );
};

export default Projects;