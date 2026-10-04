import React, { useState, useEffect } from 'react';
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
  FiUser,
  FiFileText,
  FiCheckCircle,
  FiUsers,
  FiEye
} from 'react-icons/fi';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';

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
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [detailGroup, setDetailGroup] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [sortColumn, setSortColumn] = useState(null); // 'name', '', 'firm_name'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

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
          limit: pageSize
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
            createdOn: g.create_date
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
        setSelectedGroups([]);
        setIsAllSelected(false);
      }
    };

    loadGroups();
  }, [tokens?.token, tokens?.username, tokens?.selected_project_id, tokens?.projects, pageNo, pageSize, reloadTick, permissions]);

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
    navigate(`/contact-group-list?group_id=${group.id}&group_name=${encodeURIComponent(group.name)}`);
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

  // Handle select all groups
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedGroups([]);
      setIsAllSelected(false);
    } else {
      setSelectedGroups(groups.map(g => g.id));
      setIsAllSelected(true);
    }
  };

  // Handle individual group selection
  const handleSelectGroup = (groupId) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
      setIsAllSelected(false);
    } else {
      const newSelected = [...selectedGroups, groupId];
      setSelectedGroups(newSelected);
      setIsAllSelected(newSelected.length === groups.length);
    }
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
        <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
          }`}>
          <div className="p-4 sm:p-6 md:p-8">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <h2 className="text-lg font-semibold text-gray-900">Access Denied</h2>
              <p className="mt-2 text-gray-600">You do not have permission to view contact groups.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
        }`}>
        <div className="p-4 sm:p-6 md:p-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-base font-bold text-gray-900">Group Management</h1>
                </div>
                <p className="text-gray-600 text-sm">Manage your contact groups and organize your contacts ({totalGroupCount} groups)</p>
              </div>

              <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">


                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiPlus className="mr-2 h-4 w-4" />
                  Create Group
                </button>
              </div>
            </div>
          </div>

          {/* Groups Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              {loading ? (
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', '', 'Group Name', 'Contacts', ''].map((label, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <TableSkeletonRows rows={8} cells={['index', 'short', 'avatar', 'badge', 'action']} />
                  </tbody>
                </table>
              ) : (
                <>
                  {/* Table Header */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-14 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('name')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Group Name</span>
                              {sortColumn === 'name' ? (
                                sortDirection === 'asc' ? (
                                  <FiChevronUp className="h-4 w-4 text-gray-700" />
                                ) : (
                                  <FiChevronDown className="h-4 w-4 text-gray-700" />
                                )
                              ) : (
                                <div className="flex flex-col -space-y-1">
                                  <FiChevronUp className="h-3 w-3 text-gray-400" />
                                  <FiChevronDown className="h-3 w-3 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('contact_count')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Contacts</span>
                              {sortColumn === 'contact_count' ? (
                                sortDirection === 'asc' ? (
                                  <FiChevronUp className="h-4 w-4 text-gray-700" />
                                ) : (
                                  <FiChevronDown className="h-4 w-4 text-gray-700" />
                                )
                              ) : (
                                <div className="flex flex-col -space-y-1">
                                  <FiChevronUp className="h-3 w-3 text-gray-400" />
                                  <FiChevronDown className="h-3 w-3 text-gray-400" />
                                </div>
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredGroups.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                              No groups found. Create your first group to get started.
                            </td>
                          </tr>
                        ) : (
                          filteredGroups.map((group, index) => (
                            <tr key={group.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 text-center text-sm text-gray-500">{(pageNo - 1) * pageSize + index + 1}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedGroups.includes(group.id)}
                                  onChange={() => handleSelectGroup(group.id)}
                                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                      <FiUser className="h-5 w-5 text-indigo-600" />
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <button
                                      onClick={() => handleGroupNameClick(group)}
                                      className="text-sm font-medium text-indigo-600 hover:text-indigo-900 hover:underline cursor-pointer text-left"
                                      title="View group contacts"
                                    >
                                      {group.name}
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                  {group.contact_count} contacts
                                </span>
                              </td>
                              <td className="px-3 py-4 text-right">
                                <RowActionMenu
                                  items={[
                                    { label: 'Details', icon: <FiEye className="h-4 w-4" />, onClick: () => setDetailGroup(group) },
                                    { label: 'View contacts', icon: <FiUsers className="h-4 w-4" />, onClick: () => handleGroupNameClick(group) },
                                    { label: 'Edit', icon: <FiEdit className="h-4 w-4" />, onClick: () => handleOpenEditModal(group) },
                                    { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, onClick: () => handleOpenDeleteModal(group), danger: true, disabled: group.contact_count > 0 },
                                  ]}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
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

                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-5/6 sm:w-3/6 md:w-3/6 lg:w-2/6 xl:w-6/9 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create Group</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiUser className="inline h-4 w-4 mr-1" />
                    Group Name *
                  </label>
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
                    placeholder="Enter group name"
                    required
                  />
                  {createErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{createErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiFileText className="inline h-4 w-4 mr-1" />
                    Remark
                  </label>
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
                    placeholder="Enter group description or remark"
                    rows="3"
                  />
                  {createErrors.remark && (
                    <p className="mt-1 text-sm text-red-600">{createErrors.remark}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {newGroup.remark.length}/1000 characters
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroup.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-5/6 sm:w-3/6 md:w-3/6 lg:w-2/6 xl:w-6/9 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Group</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiUser className="inline h-4 w-4 mr-1" />
                    Group Name *
                  </label>
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
                    placeholder="Enter group name"
                    required
                  />
                  {editErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{editErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <FiFileText className="inline h-4 w-4 mr-1" />
                    Remark
                  </label>
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
                    placeholder="Enter group description or remark"
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateGroup}
                  disabled={!editGroup.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
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


      {/* Success Modal */}
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
    </div>
  );
}

export default ContactGroup;