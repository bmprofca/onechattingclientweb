import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import Tooltip from '../component/Tooltip';
import Pagination from '../component/Pagination'; // Import Pagination component
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit, FiTrash2, FiRefreshCw, FiAlertCircle, FiMoreVertical, FiChevronDown, FiCheck, FiEye } from 'react-icons/fi';
import TemplatePreviewModal from '../component/Modals/TemplatePreviewModal';
import DeleteConfirmationModal from '../component/Modals/DeleteConfirmationModal';
import AiTemplateModal from '../component/Modals/AiTemplateModal';
import { RiSparklingFill } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';

function Template() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [tokens, setTokens] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [templateToPreview, setTemplateToPreview] = useState(null);

  const abortControllerRef = useRef(null);
  const filterRef = useRef(null);

  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (userData) setTokens(JSON.parse(userData));
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!tokens?.token || !tokens?.username) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);

    try {
      const selectedProjectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
      const payload = {
        project_id: selectedProjectId,
        status: statusFilter,
        page_no: currentPage,
        limit: pageSize
      };

      const { data, key } = Encrypt(payload);
      const response = await axios.post(
        `${API_BASE_URL}/template/template-list`,
        JSON.stringify({ data, key }),
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          },
          signal: abortControllerRef.current.signal
        }
      );

      if (!response?.data?.error && response?.data?.data) {
        const apiTemplates = response.data.data.map(t => ({
          id: t.template_id,
          name: t.template_name,
          language: t.template?.language?.toUpperCase() || 'EN',
          category: t.category,
          status: t.status,
          rejectReason: t.reject_reason || null,
          updatedOn: new Date(t.create_date).toLocaleDateString(),
          template_data: t.template
        }));

        setTemplates(apiTemplates);

        if (response.data.meta) {
          setTotalPages(response.data.meta.total_pages);
          setTotalRecords(response.data.meta.total_records);
        }
      } else {
        setTemplates([]);
        setTotalPages(1);
        setTotalRecords(0);
      }
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error('Fetch error:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [tokens, statusFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchTemplates();
    return () => abortControllerRef.current?.abort();
  }, [fetchTemplates]);



  const getStatusStyle = (status) => {
    const styles = {
      APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm',
      PENDING: 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm',
      REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm',
    };
    return styles[status] || 'bg-gray-100 text-gray-800 border border-gray-200';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'PENDING':
        return (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      case 'REJECTED':
        return (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleDeleteClick = (template) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;

    if (!tokens?.token || !tokens?.username) {
      toast.error('Session expired. Please login again.');
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
      return;
    }

    setIsDeleting(true);

    try {
      const selectedProjectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
      if (!selectedProjectId) {
        toast.error('No project selected.');
        setIsDeleting(false);
        setDeleteModalOpen(false);
        setTemplateToDelete(null);
        return;
      }

      const payload = {
        project_id: selectedProjectId,
        template_id: templateToDelete.id
      };

      const { data, key } = Encrypt(payload);
      const response = await axios.post(
        `${API_BASE_URL}/template/template-delete`,
        JSON.stringify({ data, key }),
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response?.data?.error === false) {
        // Remove the deleted template from the list
        setTemplates(prev => prev.filter(template => template.id !== templateToDelete.id));
        toast.success(response.data.msg || 'Template deleted successfully');
        setDeleteModalOpen(false);
        setTemplateToDelete(null);
      } else {
        toast.error(response?.data?.msg || 'Failed to delete template');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error?.response?.data?.msg || 'An error occurred while deleting the template');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  const handlePreviewClick = (template) => {
    setTemplateToPreview(template);
    setPreviewModalOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewModalOpen(false);
    setTemplateToPreview(null);
  };

  const filterOptions = [
    {
      value: '',
      label: 'All Status',
      color: 'text-gray-600',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )
    },
    {
      value: 'APPROVED',
      label: 'Approved',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      value: 'PENDING',
      label: 'Pending',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      value: 'REJECTED',
      label: 'Rejected',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )
    },
  ];

  const selectedFilter = filterOptions.find(opt => opt.value === statusFilter) || filterOptions[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        isMinimized={isMinimized}
        setIsMinimized={setIsMinimized}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isMinimized={isMinimized}
          setIsMinimized={setIsMinimized}
        />

        <main className={`flex-1 transition-all duration-300 ease-in-out pt-16 overflow-y-auto ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Templates</h1>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Custom Filter Dropdown */}
                <div className="relative flex-1 sm:flex-initial" ref={filterRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    aria-expanded={isFilterOpen}
                    aria-haspopup="listbox"
                    aria-label="Filter by status"
                    className="w-full sm:w-auto min-w-[140px] inline-flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:border-indigo-500 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {selectedFilter.icon && (
                        <span className={`flex-shrink-0 ${selectedFilter.color}`}>{selectedFilter.icon}</span>
                      )}
                      <span className="truncate">{selectedFilter.label}</span>
                    </div>
                    <FiChevronDown className={`flex-shrink-0 w-4 h-4 text-gray-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isFilterOpen && (
                    <div
                      className="absolute z-20 mt-2 w-full sm:min-w-[200px] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn"
                      role="listbox"
                    >
                      <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</p>
                      </div>
                      <div className="py-1.5">
                        {filterOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={statusFilter === option.value}
                            onClick={() => {
                              setStatusFilter(option.value);
                              setIsFilterOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${statusFilter === option.value
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            {option.icon && (
                              <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${statusFilter === option.value ? 'bg-indigo-100' : option.bgColor || 'bg-gray-100'} ${option.color}`}>
                                {option.icon}
                              </span>
                            )}
                            <span className="font-medium flex-1">{option.label}</span>
                            {statusFilter === option.value && (
                              <FiCheck className="flex-shrink-0 w-4 h-4 text-indigo-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={fetchTemplates}
                  className="p-2.5 text-gray-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm border border-gray-200 hover:border-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  title="Refresh"
                >
                  <FiRefreshCw className={`${loading ? 'animate-spin' : ''} w-4 h-4`} />
                </button>

                <Link
                  to="/template-add"
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-indigo-800 active:scale-95 transition-all shadow-md hover:shadow-lg"
                >
                  <FiPlus className="mr-2 w-4 h-4" />
                  <span className="hidden sm:inline">New Template</span>
                  <span className="sm:hidden">New</span>
                </Link>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Name', 'Language', 'Category', 'Status', 'Updated', ''].map((header) => (
                        <th key={header} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loading && templates.length === 0 ? (
                      <TableSkeletonRows rows={6} cells={['index', 'text', 'short', 'short', 'badge', 'short', 'action']} />
                    ) : (
                      templates.map((template, index) => (
                        <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                            {(currentPage - 1) * pageSize + index + 1}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-gray-900">{template.name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600 font-medium">{template.language}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600 capitalize">{template.category}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusStyle(template.status)}`}>
                                {getStatusIcon(template.status)}
                                {template.status}
                              </span>
                              {template.status === 'REJECTED' && template.rejectReason && (
                                <Tooltip
                                  content={`Reason: ${template.rejectReason}`}
                                  disabled={true}
                                  position="top"
                                >
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 transition-all"
                                  >
                                    <FiAlertCircle className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{template.updatedOn}</td>
                          <td className="px-3 py-4 text-right">
                            <RowActionMenu
                              items={[
                                { label: 'Details', icon: <FiEye size={15} />, onClick: () => setDetailTemplate(template) },
                                { label: 'Preview', icon: <FiEye size={15} />, onClick: () => handlePreviewClick(template) },
                                { label: 'Edit', icon: <FiEdit size={15} />, onClick: () => navigate(`/template-edit/${template.id}`), disabled: template.status === 'PENDING' },
                                { label: 'Delete', icon: <FiTrash2 size={15} />, onClick: () => handleDeleteClick(template), danger: true },
                              ]}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {loading && templates.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 animate-pulse">
                    <div className="h-5 bg-gray-100 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                  </div>
                ))
              ) : (
                templates.map((template, index) => (
                  <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                            {template.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="font-medium">{template.language}</span>
                            <span>•</span>
                            <span className="capitalize">{template.category}</span>
                          </div>
                        </div>
                        <div className="relative ml-2">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === template.id ? null : template.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <FiMoreVertical size={18} />
                          </button>

                          {activeDropdown === template.id && (
                            <div className="absolute right-0 bottom-full mb-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                              <button
                                onClick={() => {
                                  handlePreviewClick(template);
                                  setActiveDropdown(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <FiEye size={16} />
                                View
                              </button>
                              {template.status === 'APPROVED' ? (
                                <Tooltip
                                  content="Can not edit for approved Template"
                                  disabled={false}
                                  position="left"
                                >
                                  <span className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed opacity-50">
                                    <FiEdit size={16} />
                                    Edit
                                  </span>
                                </Tooltip>
                              ) : (
                                <Link
                                  to={`/template-edit/${template.id}`}
                                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  onClick={() => setActiveDropdown(null)}
                                >
                                  <FiEdit size={16} />
                                  Edit
                                </Link>
                              )}
                              <button
                                onClick={() => {
                                  handleDeleteClick(template);
                                  setActiveDropdown(null);
                                }}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <FiTrash2 size={16} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status & Date */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${getStatusStyle(template.status)}`}>
                            {getStatusIcon(template.status)}
                            {template.status}
                          </span>
                          {template.status === 'REJECTED' && template.rejectReason && (
                            <Tooltip
                              content={`Reason: ${template.rejectReason}`}
                              disabled={true}
                              position="top"
                            >
                              <button
                                type="button"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-rose-100 text-rose-600"
                              >
                                <FiAlertCircle className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{template.updatedOn}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </main>
      </div>

      {/* AI Template Modal */}
      <AiTemplateModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSavedDirectly={() => {
          fetchTemplates();
        }}
        onApplyTemplate={(aiData) => {
          navigate('/template-add', { state: { aiTemplateData: aiData } });
        }}
        projectId={tokens?.selected_project_id || tokens?.projects?.[0]?.project_id}
        tokens={tokens}
      />

      <RecordDetailsModal
        isOpen={Boolean(detailTemplate)}
        onClose={() => setDetailTemplate(null)}
        title={detailTemplate?.name || 'Template'}
        fields={detailTemplate ? [
          { label: 'Language', value: detailTemplate.language },
          { label: 'Category', value: detailTemplate.category },
          { label: 'Status', value: detailTemplate.status },
          { label: 'Reject reason', value: detailTemplate.rejectReason },
          { label: 'Updated', value: detailTemplate.updatedOn },
        ] : []}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        message="Are you sure you want to delete"
        itemName={templateToDelete?.name}
        loading={isDeleting}
      />

      {/* Preview Modal */}
      <TemplatePreviewModal
        isOpen={previewModalOpen}
        onClose={handlePreviewClose}
        template={templateToPreview}
      />
    </div>
  );
}

export default Template;