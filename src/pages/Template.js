import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import Tooltip from '../component/Tooltip';
import Pagination from '../component/Pagination'; // Import Pagination component
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit, FiTrash2, FiRefreshCw, FiAlertCircle, FiEye, FiFileText } from 'react-icons/fi';
import TemplatePreviewModal from '../component/Modals/TemplatePreviewModal';
import DeleteConfirmationModal from '../component/Modals/DeleteConfirmationModal';
import { useNavigate } from 'react-router-dom';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
function templateBody(template) {
  const components = template?.components || [];
  const body = components.find((component) => String(component?.type || '').toUpperCase() === 'BODY');
  return String(body?.text || '').replace(/\s+/g, ' ').trim();
}

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
];

function statusTone(status) {
  if (status === 'APPROVED') {
    return { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', bar: 'bg-emerald-500', dot: 'bg-emerald-500' };
  }
  if (status === 'PENDING') {
    return { chip: 'bg-amber-50 text-amber-700 ring-amber-200', bar: 'bg-amber-500', dot: 'bg-amber-500' };
  }
  if (status === 'REJECTED') {
    return { chip: 'bg-rose-50 text-rose-700 ring-rose-200', bar: 'bg-rose-500', dot: 'bg-rose-500' };
  }
  return { chip: 'bg-slate-50 text-slate-600 ring-slate-200', bar: 'bg-slate-300', dot: 'bg-slate-400' };
}

function Template() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [tokens, setTokens] = useState(null);
  const [detailTemplate, setDetailTemplate] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [templateToPreview, setTemplateToPreview] = useState(null);

  const abortControllerRef = useRef(null);

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
          preview: templateBody(t.template),
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

  const selectStatus = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6fb]">
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

        <main className={`flex-1 overflow-y-auto pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
          <div className="w-full px-4 py-5">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Templates</h1>
                <p className="mt-1 text-sm text-slate-500">WhatsApp message layouts for this project.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
                  {STATUS_FILTERS.map((option) => {
                    const active = statusFilter === option.value;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => selectStatus(option.value)}
                        className={`h-10 rounded-lg px-3 text-sm font-medium transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchTemplates}
                    disabled={loading}
                    title="Refresh"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <Link
                    to="/template-add"
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    <FiPlus className="h-4 w-4" />
                    New template
                  </Link>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {['#', 'Name', 'Language', 'Category', 'Status', 'Updated', ''].map((header) => (
                        <th key={header || 'actions'} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading && templates.length === 0 ? (
                      Array.from({ length: 6 }, (_, index) => (
                        <tr key={index}>
                          <td colSpan={7} className="px-5 py-4">
                            <div className="h-5 animate-pulse rounded-md bg-slate-100" />
                          </td>
                        </tr>
                      ))
                    ) : templates.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                            <FiFileText className="h-6 w-6" />
                          </div>
                          <h2 className="mt-4 text-base font-semibold text-slate-900">No templates yet</h2>
                          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            {statusFilter ? 'Nothing matches this status. Try another filter.' : 'Create a template to start sending approved WhatsApp messages.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      templates.map((template, index) => {
                        const tone = statusTone(template.status);
                        return (
                          <tr key={template.id} className="transition hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-400 sm:px-5">
                              {(currentPage - 1) * pageSize + index + 1}
                            </td>
                            <td className="max-w-xs px-4 py-3.5 sm:px-5">
                              <p className="truncate text-sm font-semibold text-slate-900">{template.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{template.preview || 'No message preview'}</p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-600 sm:px-5">{template.language}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm capitalize text-slate-600 sm:px-5">{template.category || '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone.chip}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                                  {template.status}
                                </span>
                                {template.status === 'REJECTED' && template.rejectReason ? (
                                  <Tooltip content={`Reason: ${template.rejectReason}`} disabled position="top">
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                                      <FiAlertCircle className="h-4 w-4" />
                                    </span>
                                  </Tooltip>
                                ) : null}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-500 sm:px-5">{template.updatedOn}</td>
                            <td className="px-3 py-3.5 text-right">
                              <RowActionMenu
                                label={`Actions for ${template.name}`}
                                items={[
                                  { label: 'Details', icon: <FiEye size={15} />, onClick: () => setDetailTemplate(template) },
                                  { label: 'Preview', icon: <FiEye size={15} />, onClick: () => handlePreviewClick(template) },
                                  { label: 'Edit', icon: <FiEdit size={15} />, onClick: () => navigate(`/template-edit/${template.id}`), disabled: template.status === 'PENDING' },
                                  { label: 'Delete', icon: <FiTrash2 size={15} />, onClick: () => handleDeleteClick(template), danger: true },
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {totalRecords > 0 ? (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              ) : null}
            </div>
          </div>
        </main>
      </div>

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