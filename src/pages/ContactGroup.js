import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiX,
  FiSearch,
  FiCheckCircle,
  FiUsers,
  FiEye
} from 'react-icons/fi';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';

import AnimatedModal from '../component/Modals/AnimatedModal';
import useBulkSelection from '../component/table/useBulkSelection';
import { MasterCheckbox, RowCheckbox, BulkActionBar } from '../component/table/BulkSelection';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import api from '../api/client';
function ContactGroup() {
  const navigate = useNavigate();
  const permissions = useSelector((state) => state.project.permissions);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [groups, setGroups] = useState([]);
  const [totalGroupCount, setTotalGroupCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState(null);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20); // Default 20 items per page
  const [reloadTick, setReloadTick] = useState(0);
  const [groupsMeta, setGroupsMeta] = useState({
    page_no: 1,
    limit: 20,
    total_records: 0,
    total_pages: 1,
    has_more: false
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [detailGroup, setDetailGroup] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [sortColumn, setSortColumn] = useState(null); // 'name', '', 'firm_name'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [groupQuery, setGroupQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search box; the list is searched on the server so "select all" matches it.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(groupQuery.trim());
      setPageNo(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [groupQuery]);

  // Form state for creating new group
  const [newGroup, setNewGroup] = useState({
    name: '',
    remark: ''
  });

  // Form state for editing group
  const [editGroup, setEditGroup] = useState({
    group_id: '',
    name: '',
    remark: ''
  });

  // Validation errors for create modal
  const [createErrors, setCreateErrors] = useState({
    name: '',
    remark: ''
  });

  // Validation errors for edit modal
  const [editErrors, setEditErrors] = useState({
    name: '',
    remark: ''
  });

  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  // Load auth tokens
  useEffect(() => {
    const loadTokens = async () => {
      try {
        // Load auth tokens from session
        const sessionData = localStorage.getItem('userData');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          if (parsed && typeof parsed === 'object') {
            setTokens(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load tokens:', e);
      }
    };

    loadTokens();
  }, []);

  // Load groups from API
  useEffect(() => {
    if (!tokens?.token || !tokens?.username) return;
    if (permissions && permissions.view_contact === false) return;

    const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';

    const loadGroups = async (requestedPageNo = pageNo) => {
      try {
        setLoading(true);
        console.log('🌐 Loading groups from API...');

        const payload = {
          project_id: projectId,
          page_no: requestedPageNo,
          limit: pageSize,
          search: debouncedQuery
        };

        const { data, key } = Encrypt(payload);
        const data_pass = JSON.stringify({ data, key });

        const response = await axios.post(
          `${API_BASE_URL}/contact/group-list`,
          data_pass,
          {
            headers: {
              'token': tokens.token,
              'username': tokens.username,
              'Content-Type': 'application/json'
            }
          }
        );

        console.log(response);


        if (!response?.data?.error) {
          const apiList = response?.data?.data || [];
          const meta = response?.data?.meta || null;
          const totalCount = meta?.total_records ?? response?.data?.count ?? 0;
          console.log(`📥 Received ${apiList.length} groups from API, total count: ${totalCount}`);

          const mappedGroups = apiList.map(g => ({
            id: g.group_id,
            name: g.name,
            contact_count: g.contact_count || 0,
            remark: g.remark,
            createdOn: g.create_date,
            modifiedOn: g.modify_date,
            createdBy: g.create_by?.name || g.create_by?.username || ''
          }));

          setGroups(mappedGroups);
          setTotalGroupCount(totalCount);
          if (meta) {
            setGroupsMeta(prev => ({
              page_no: meta?.page_no ?? requestedPageNo,
              limit: meta?.limit ?? prev?.limit ?? 20,
              total_records: meta?.total_records ?? totalCount,
              total_pages: meta?.total_pages ?? prev?.total_pages ?? 1,
              has_more: meta?.has_more ?? false
            }));
          } else {
            setGroupsMeta(prev => ({
              ...prev,
              page_no: requestedPageNo,
              total_records: totalCount
            }));
          }
          console.log(`✅ Loaded ${mappedGroups.length} groups, total: ${totalCount}`);
        } else {
          console.warn('⚠️ API returned error:', response?.data?.message);
          setGroups([]);
        }
      } catch (error) {
        console.error('❌ Error loading groups:', error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [tokens?.token, tokens?.username, tokens?.selected_project_id, tokens?.projects, pageNo, pageSize, reloadTick, permissions, debouncedQuery]);

  // Validation functions
  const validateGroupName = (name) => {
    if (!name || name.trim() === '') {
      return 'Group name is required';
    }
    if (name.trim().length < 2) {
      return 'Group name must be at least 2 characters long';
    }
    if (name.trim().length > 100) {
      return 'Group name must be less than 100 characters';
    }
    // Allow letters, spaces, hyphens, apostrophes, periods, and numbers
    const nameRegex = /^[\p{L}\s\-'\.0-9]+$/u;
    if (!nameRegex.test(name.trim())) {
      return 'Group name contains invalid characters';
    }
    return '';
  };

  const validateRemark = (remark) => {
    if (!remark || remark.trim() === '') {
      return ''; // Remark is optional
    }
    if (remark.trim().length > 1000) {
      return 'Remark must be less than 1000 characters';
    }
    return '';
  };

  // Validate create group form
  const validateCreateForm = () => {
    const errors = {
      name: validateGroupName(newGroup.name),
      remark: validateRemark(newGroup.remark)
    };
    setCreateErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  // Validate edit group form
  const validateEditForm = () => {
    const errors = {
      name: validateGroupName(editGroup.name),
      remark: validateRemark(editGroup.remark)
    };
    setEditErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  // Handle create group
  const handleCreateGroup = async () => {
    if (!tokens?.token || !tokens?.username) return;

    // Validate form before submitting
    if (!validateCreateForm()) {
      return;
    }

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        name: newGroup.name,
        remark: newGroup.remark
      };

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/create-group`,
        data_pass,
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response?.data?.error) {
        // Close modal and reset form
        setShowCreateModal(false);
        setNewGroup({
          name: '',
          remark: ''
        });
        setCreateErrors({
          name: '',
          remark: ''
        });

        // Refresh groups list
        setPageNo(1);
        setReloadTick(t => t + 1);

        // Show success message
        const successMsg = response?.data?.msg || 'Group created successfully';
        setSuccessMessage(successMsg);
        setShowSuccessModal(true);
      } else {
        alert('Failed to create group: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  // Handle opening edit modal
  const handleOpenEditModal = (group) => {
    console.log('🔧 Opening edit modal for group:', group);
    setEditingGroup(group);
    setEditGroup({
      group_id: group.id,
      name: group.name,
      remark: group.remark || ''
    });
    setEditErrors({
      name: '',
      remark: ''
    });
    setShowEditModal(true);
  };

  // Handle update group
  const handleUpdateGroup = async () => {
    if (!tokens?.token || !tokens?.username || !editGroup.group_id) return;

    // Validate form before submitting
    if (!validateEditForm()) {
      return;
    }

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        group_id: editGroup.group_id,
        name: editGroup.name,
        remark: editGroup.remark
      };

      console.log('📤 Sending update payload:', payload);

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/edit-group`,
        data_pass,
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response?.data?.error) {
        // Close modal and reset form
        setShowEditModal(false);
        setEditingGroup(null);
        setEditGroup({
          group_id: '',
          name: '',
          remark: ''
        });
        setEditErrors({
          name: '',
          remark: ''
        });

        // Refresh groups list
        setPageNo(1);
        setReloadTick(t => t + 1);

        // Show success message
        const successMsg = response?.data?.msg || 'Group updated successfully';
        setSuccessMessage(successMsg);
        setShowSuccessModal(true);
      } else {
        alert('Failed to update group: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update group:', error);
      alert('Failed to update group. Please try again.');
    }
  };

  // Handle delete group
  const handleDeleteGroup = async () => {
    if (!tokens?.token || !tokens?.username || !deletingGroup?.id) return;

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        group_id: deletingGroup.id
      };

      console.log('🗑️ Deleting group:', { group: deletingGroup.name, payload });

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/delete-group`,
        data_pass,
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response?.data?.error) {
        // Close delete modal
        setShowDeleteModal(false);
        setDeletingGroup(null);

        // Refresh groups list
        setPageNo(1);
        setReloadTick(t => t + 1);

        // Show success message
        const successMsg = response?.data?.msg || 'Group deleted successfully';
        setSuccessMessage(successMsg);
        setShowSuccessModal(true);
      } else {
        alert('Failed to delete group: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete group. Please try again.');
    }
  };

  // Handle opening delete modal
  const handleOpenDeleteModal = (group) => {
    setDeletingGroup(group);
    setShowDeleteModal(true);
  };

  // Handle group name click to navigate to group contacts
  const handleGroupNameClick = (group) => {
    const params = new URLSearchParams({
      group_id: group.id,
      group_name: group.name || ''
    });
    if (group.remark) params.set('remark', group.remark);
    navigate(`/contact-group-list?${params.toString()}`);
  };

  // Handle export to Excel
  const handleExportToExcel = () => {
    if (groups.length === 0) {
      alert('No groups to export');
      return;
    }

    const csvContent = [
      ['Name', 'Remark', 'Contact Count', 'Created On'],
      ...groups.map(group => [
        group.name,
        group.remark,
        group.contact_count,
        group.createdOn
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groups.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPageNo(1); // Reset to first page when changing page size
    setGroupsMeta(prev => ({
      ...prev,
      limit: newPageSize
    }));
  };

  const selection = useBulkSelection({
    pageIds: groups.map((g) => g.id),
    totalCount: totalGroupCount,
    resetKey: `${debouncedQuery}|${tokens?.selected_project_id || ''}|${reloadTick}`
  });

  const handleBulkDeleteGroups = async () => {
    if (!tokens?.token || !tokens?.username || !selection.hasSelection) return;
    setBulkDeleting(true);
    try {
      const result = await api.post('/contact/delete-group', {
        project_id: tokens.selected_project_id || '',
        ...selection.buildPayload('group_ids'),
        filters: { search: debouncedQuery }
      });
      toast.success(result.message || 'Groups deleted');
      setShowBulkDeleteModal(false);
      setPageNo(1);
      setReloadTick((t) => t + 1);
    } catch (error) {
      toast.error(error.message || 'Failed to delete groups. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const SortIcon = ({ column }) => (
    sortColumn === column
      ? (sortDirection === 'asc' ? <FiChevronUp className="h-3.5 w-3.5 text-ink" /> : <FiChevronDown className="h-3.5 w-3.5 text-ink" />)
      : <span className="inline-flex flex-col -space-y-1.5 text-ink-400"><FiChevronUp className="h-3 w-3" /><FiChevronDown className="h-3 w-3" /></span>
  );

  const formatUpdated = (value) => {
    if (!value) return '';
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  // Apply sorting to groups if a sort column is selected
  let filteredGroups = [...groups];
  if (sortColumn) {
    filteredGroups = filteredGroups.sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];

      // Handle numeric sorting for contact_count
      if (sortColumn === 'contact_count') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;

        if (aValue < bValue) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      }

      // Handle string sorting for other columns
      aValue = String(aValue || '').toLowerCase().trim();
      bValue = String(bValue || '').toLowerCase().trim();

      // Handle empty values - put them at the end
      if (aValue === '' && bValue === '') return 0;
      if (aValue === '') return 1;
      if (bValue === '') return -1;

      // Compare values
      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  if (permissions && permissions.view_contact === false) {
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
        <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
          }`}>
          <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
            <div className="bg-white rounded-card border border-line p-8 text-center">
              <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
              <p className="mt-2 text-gray-600">You do not have permission to view contact groups.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
        }`}>
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Groups</h1>
              <p className="mt-1.5 text-sm text-ink-500">Saved lists of contacts for campaigns and follow-ups.</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                <input
                  type="text"
                  value={groupQuery}
                  onChange={(e) => setGroupQuery(e.target.value)}
                  placeholder="Search groups"
                  className="h-[38px] w-full sm:w-56 pl-9 pr-3 rounded-[9px] border border-line bg-white text-sm text-ink placeholder:text-ink-400 outline-none focus:border-brand-600"
                />
              </div>
              <button type="button" onClick={() => setShowCreateModal(true)} className="oc-btn-primary">
                <FiPlus className="h-4 w-4" />
                Create group
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-white">
            <BulkActionBar selection={selection} totalCount={totalGroupCount} pageCount={groups.length} noun="groups">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={bulkDeleting}
                className="oc-btn h-9 bg-red-600 text-white hover:bg-red-700"
              >
                <FiTrash2 className="h-4 w-4" />
                Delete selected
              </button>
            </BulkActionBar>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="oc-th w-12 text-center">#</th>
                    <th className="oc-th w-10">
                      <MasterCheckbox selection={selection} disabled={loading || groups.length === 0} />
                    </th>
                    <th className="oc-th">
                      <button type="button" onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-ink">
                        Group <SortIcon column="name" />
                      </button>
                    </th>
                    <th className="oc-th">
                      <button type="button" onClick={() => handleSort('contact_count')} className="inline-flex items-center gap-1.5 hover:text-ink">
                        Contacts <SortIcon column="contact_count" />
                      </button>
                    </th>
                    <th className="oc-th hidden md:table-cell">Created by</th>
                    <th className="oc-th hidden sm:table-cell">Updated</th>
                    <th className="oc-th w-12 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows rows={8} cells={['index', 'short', 'avatar', 'short', 'text', 'short', 'action']} />
                  ) : filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                          <FiUsers className="h-6 w-6" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-ink">{debouncedQuery ? 'No groups match that search' : 'No groups yet'}</p>
                        <p className="mt-1 text-sm text-ink-500">{debouncedQuery ? 'Try another name.' : 'Create a group to start a saved list.'}</p>
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group, index) => {
                      const updated = formatUpdated(group.modifiedOn || group.createdOn);
                      const checked = selection.isSelected(group.id);
                      return (
                        <tr key={group.id} className={`transition-colors hover:bg-surface-soft ${checked ? 'bg-brand-50/60' : ''}`}>
                          <td className="oc-td text-center text-xs font-semibold text-ink-500 oc-num">{(groupsMeta.page_no - 1) * pageSize + index + 1}</td>
                          <td className="oc-td">
                            <RowCheckbox selection={selection} id={group.id} label={`Select ${group.name}`} />
                          </td>
                          <td className="oc-td">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                                <FiUsers className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleGroupNameClick(group)}
                                  className="block max-w-[320px] truncate text-left text-sm font-semibold text-ink hover:text-brand-700"
                                  title={group.name}
                                >
                                  {group.name}
                                </button>
                                {group.remark ? <p className="max-w-[320px] truncate text-xs text-ink-500" title={group.remark}>{group.remark}</p> : null}
                              </div>
                            </div>
                          </td>
                          <td className="oc-td">
                            <span className="oc-badge bg-surface-soft border border-line text-ink oc-num">
                              {Number(group.contact_count || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td className="oc-td hidden md:table-cell text-sm text-ink-500">{group.createdBy || '—'}</td>
                          <td className="oc-td hidden sm:table-cell text-sm text-ink-500 whitespace-nowrap">{updated || '—'}</td>
                          <td className="oc-td text-right">
                            <RowActionMenu
                              items={[
                                { label: 'View contacts', icon: <FiUsers className="h-4 w-4" />, onClick: () => handleGroupNameClick(group) },
                                { label: 'Details', icon: <FiEye className="h-4 w-4" />, onClick: () => setDetailGroup(group) },
                                { label: 'Edit', icon: <FiEdit className="h-4 w-4" />, onClick: () => handleOpenEditModal(group) },
                                { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, onClick: () => handleOpenDeleteModal(group), danger: true, disabled: group.contact_count > 0 },
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
            {!loading && totalGroupCount > 0 && (
              <div className="border-t border-line">
                <Pagination
                  currentPage={groupsMeta.page_no}
                  totalPages={groupsMeta.total_pages}
                  totalRecords={totalGroupCount}
                  pageSize={pageSize}
                  onPageChange={(page) => setPageNo(page)}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={[10, 20, 50, 100]}
                  showPageSizeSelector={true}
                  showGoToPage={true}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk delete groups confirmation */}
      <AnimatedModal open={showBulkDeleteModal}>
        {showBulkDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => !bulkDeleting && setShowBulkDeleteModal(false)}>
            <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <FiTrash2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-ink">Delete {selection.selectedCount.toLocaleString('en-IN')} group(s)?</h3>
                  <p className="mt-1 text-sm text-ink-500">
                    {selection.allMatching
                      ? 'Every group matching the current view will be deleted on the server, including groups on other pages.'
                      : 'The selected groups will be deleted.'}{' '}
                    Groups that still have contacts are skipped.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setShowBulkDeleteModal(false)} disabled={bulkDeleting} className="oc-btn-ghost">Cancel</button>
                <button type="button" onClick={handleBulkDeleteGroups} disabled={bulkDeleting} className="oc-btn bg-red-600 text-white hover:bg-red-700">
                  {bulkDeleting ? 'Deleting…' : 'Delete groups'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>

      <RecordDetailsModal
        isOpen={Boolean(detailGroup)}
        onClose={() => setDetailGroup(null)}
        title={detailGroup?.name || 'Group'}
        fields={detailGroup ? [
          { label: 'Remark', value: detailGroup.remark },
          { label: 'Contacts', value: String(detailGroup.contact_count ?? 0) },
        ] : []}
      />

      {/* Create Group Modal */}
      <AnimatedModal open={showCreateModal}>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40">
            <div className="relative top-20 mx-auto w-[min(100%-2rem,420px)] rounded-2xl border border-line bg-white p-5 shadow-pop">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-ink">Create group</h3>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewGroup({
                        name: '',
                        remark: ''
                      });
                      setCreateErrors({
                        name: '',
                        remark: ''
                      });
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="oc-label">Group name</label>
                    <input
                      type="text"
                      value={newGroup.name}
                      onChange={(e) => {
                        setNewGroup({ ...newGroup, name: e.target.value });
                        if (createErrors.name) {
                          setCreateErrors({ ...createErrors, name: validateGroupName(e.target.value) });
                        }
                      }}
                      onBlur={() => setCreateErrors({ ...createErrors, name: validateGroupName(newGroup.name) })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${createErrors.name
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-indigo-500'
                        }`}
                      placeholder="e.g. Wholesale buyers"
                      required
                    />
                    {createErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{createErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="oc-label">Description</label>
                    <textarea
                      value={newGroup.remark}
                      onChange={(e) => {
                        setNewGroup({ ...newGroup, remark: e.target.value });
                        if (createErrors.remark) {
                          setCreateErrors({ ...createErrors, remark: validateRemark(e.target.value) });
                        }
                      }}
                      onBlur={() => setCreateErrors({ ...createErrors, remark: validateRemark(newGroup.remark) })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${createErrors.remark
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-indigo-500'
                        }`}
                      placeholder="Who belongs in this group?"
                      rows="3"
                    />
                    {createErrors.remark && (
                      <p className="mt-1 text-sm text-red-600">{createErrors.remark}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-500">
                      {newGroup.remark.length}/1000 characters. After creating the group, add contacts from the group page or from Contacts.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewGroup({
                        name: '',
                        remark: ''
                      });
                      setCreateErrors({
                        name: '',
                        remark: ''
                      });
                    }}
                    className="oc-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroup.name}
                    className="oc-btn-primary"
                  >
                    Create group
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>

      {/* Edit Group Modal */}
      <AnimatedModal open={showEditModal}>
        {showEditModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40">
            <div className="relative top-20 mx-auto w-[min(100%-2rem,420px)] rounded-2xl border border-line bg-white p-5 shadow-pop">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-ink">Edit group</h3>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingGroup(null);
                      setEditGroup({
                        group_id: '',
                        name: '',
                        remark: ''
                      });
                      setEditErrors({
                        name: '',
                        remark: ''
                      });
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FiX className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="oc-label">Group name</label>
                    <input
                      type="text"
                      value={editGroup.name}
                      onChange={(e) => {
                        setEditGroup({ ...editGroup, name: e.target.value });
                        if (editErrors.name) {
                          setEditErrors({ ...editErrors, name: validateGroupName(e.target.value) });
                        }
                      }}
                      onBlur={() => setEditErrors({ ...editErrors, name: validateGroupName(editGroup.name) })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${editErrors.name
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-indigo-500'
                        }`}
                      placeholder="e.g. Wholesale buyers"
                      required
                    />
                    {editErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{editErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="oc-label">Description</label>
                    <textarea
                      value={editGroup.remark}
                      onChange={(e) => {
                        setEditGroup({ ...editGroup, remark: e.target.value });
                        if (editErrors.remark) {
                          setEditErrors({ ...editErrors, remark: validateRemark(e.target.value) });
                        }
                      }}
                      onBlur={() => setEditErrors({ ...editErrors, remark: validateRemark(editGroup.remark) })}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${editErrors.remark
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-indigo-500'
                        }`}
                      placeholder="Who belongs in this group?"
                      rows="3"
                    />
                    {editErrors.remark && (
                      <p className="mt-1 text-sm text-red-600">{editErrors.remark}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {editGroup.remark.length}/1000 characters
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingGroup(null);
                      setEditGroup({
                        group_id: '',
                        name: '',
                        remark: ''
                      });
                      setEditErrors({
                        name: '',
                        remark: ''
                      });
                    }}
                    className="oc-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateGroup}
                    disabled={!editGroup.name}
                    className="oc-btn-primary"
                  >
                    Save group
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>

      {/* Delete Group Modal */}
      <AnimatedModal open={showDeleteModal}>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-5/6 sm:w-3/6 md:w-2/6 lg:w-2/6 xl:w-1/4 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-center mb-4">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <FiTrash2 className="h-6 w-6 text-red-600" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Group</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to delete the group "{deletingGroup?.name}"? This action cannot be undone.
                  </p>
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setDeletingGroup(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteGroup}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete Group
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>


      {/* Success Modal */}
      <AnimatedModal open={showSuccessModal}>
        {showSuccessModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-5/6 sm:w-3/6 md:w-2/6 lg:w-2/6 xl:w-1/4 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-center mb-4">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                    <FiCheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Success</h3>
                  <p className="text-sm text-gray-600 mb-4">{successMessage}</p>
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}

export default ContactGroup;