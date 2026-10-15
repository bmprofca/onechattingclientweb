import React, { useState, useEffect, useCallback } from 'react';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    FileText,
    X,
    Check,
    Download,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getScannedUsers,
    addScannedUser,
    updateScannedUser,
    deleteScannedUser
} from '../api/scannedUsers';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';

import AnimatedModal from '../component/Modals/AnimatedModal';
const personInitials = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const parseLooseDate = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnly) {
        return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMonthDay = (value) => {
    const parsed = parseLooseDate(value);
    if (!parsed) return '';
    return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const formatAddedDate = (value) => {
    const parsed = parseLooseDate(value);
    if (!parsed) return '—';
    return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const isQrScanUser = (user) => {
    const addedBy = String(user?.added_by || '').trim().toUpperCase();
    return addedBy === 'WHATSAPP_QR' || Boolean(user?.qr_id);
};

const INITIAL_FORM = {
    name: '',
    mobile: '',
    email: '',
    dob: '',
    anniversary: '',
    company: '',
    address: '',
    notes: '',
    tags: '',
    qr_id: ''
};

export default function ScannedUsers() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebarMinimized');
            return saved ? JSON.parse(saved) : false;
        }
        return false;
    });

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 });

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
    const [selectedUser, setSelectedUser] = useState(null);
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [detailsUser, setDetailsUser] = useState(null);
    const [sourceFilter, setSourceFilter] = useState('all');

    // Get current project from storage
    const getUserData = () => {
        try {
            const userData = localStorage.getItem('userData');
            return userData ? JSON.parse(userData) : null;
        } catch (e) {
            return null;
        }
    };

    const userData = getUserData();
    const projectId = userData?.selected_project_id;

    // Fetch scanned users
    const fetchUsers = useCallback(async (page = 1, search = searchTerm, limit = pagination.limit) => {
        if (!projectId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await getScannedUsers({
                project_id: projectId,
                search: search,
                page: page,
                limit
            });

            if (!res.error && res.data) {
                setUsers(res.data);
                if (res.pagination) {
                    const returnedLimit = Number(res.pagination.limit);
                    const allowedLimits = [10, 20, 50, 100];
                    setPagination((prev) => ({
                        ...prev,
                        ...res.pagination,
                        limit: allowedLimits.includes(returnedLimit) ? returnedLimit : limit
                    }));
                }
            } else {
                toast.error(res.error || 'Failed to load scanned users');
            }
        } catch (error) {
            console.error('Error fetching scanned users:', error);
            toast.error('Network error loading scanned users');
        } finally {
            setLoading(false);
        }
    }, [projectId, pagination.limit, searchTerm]);

    useEffect(() => {
        fetchUsers(1, searchTerm);
    }, [projectId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchUsers(1, searchTerm);
    };

    const handleOpenAddModal = () => {
        setModalMode('add');
        setSelectedUser(null);
        setFormData(INITIAL_FORM);
        setModalOpen(true);
    };

    const handleOpenEditModal = (user) => {
        setModalMode('edit');
        setSelectedUser(user);
        setFormData({
            name: user.name || '',
            mobile: user.mobile || '',
            email: user.email || '',
            dob: user.dob ? user.dob.split('T')[0] : '',
            anniversary: user.anniversary ? user.anniversary.split('T')[0] : '',
            company: user.company || '',
            address: user.address || '',
            notes: user.notes || '',
            tags: user.tags || '',
            qr_id: user.qr_id || ''
        });
        setModalOpen(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Please enter user name');
            return;
        }
        if (!formData.mobile.trim()) {
            toast.error('Please enter mobile number');
            return;
        }

        try {
            setSubmitting(true);
            if (modalMode === 'add') {
                const payload = {
                    ...formData,
                    project_id: projectId
                };
                const res = await addScannedUser(payload);
                if (!res.error) {
                    toast.success('Scanned user added successfully');
                    setModalOpen(false);
                    fetchUsers(1, searchTerm);
                } else {
                    toast.error(res.error || 'Failed to add user');
                }
            } else {
                const payload = {
                    ...formData,
                    scan_id: selectedUser.scan_id,
                    project_id: projectId
                };
                const res = await updateScannedUser(payload);
                if (!res.error) {
                    toast.success('Scanned user updated successfully');
                    setModalOpen(false);
                    fetchUsers(pagination.page, searchTerm);
                } else {
                    toast.error(res.error || 'Failed to update user');
                }
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('Something went wrong saving user details');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenDeleteModal = (user) => {
        setUserToDelete(user);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!userToDelete) return;
        try {
            setDeleting(true);
            const res = await deleteScannedUser({
                scan_id: userToDelete.scan_id,
                project_id: projectId
            });
            if (!res.error) {
                toast.success('User deleted successfully');
                setDeleteModalOpen(false);
                setUserToDelete(null);
                fetchUsers(pagination.page, searchTerm);
            } else {
                toast.error(res.error || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Network error deleting user');
        } finally {
            setDeleting(false);
        }
    };

    // Export CSV
    const exportCsv = () => {
        if (users.length === 0) {
            toast.error('No records to export');
            return;
        }
        const headers = ['Name', 'Mobile', 'Email', 'DOB', 'Anniversary', 'Company', 'Address', 'Tags', 'Notes', 'QR Source', 'Added Date'];
        const rows = users.map(u => [
            `"${(u.name || '').replace(/"/g, '""')}"`,
            `"${(u.mobile || '').replace(/"/g, '""')}"`,
            `"${(u.email || '').replace(/"/g, '""')}"`,
            `"${u.dob || ''}"`,
            `"${u.anniversary || ''}"`,
            `"${(u.company || '').replace(/"/g, '""')}"`,
            `"${(u.address || '').replace(/"/g, '""')}"`,
            `"${(u.tags || '').replace(/"/g, '""')}"`,
            `"${(u.notes || '').replace(/"/g, '""')}"`,
            `"${(u.qr_label || u.qr_id || '').replace(/"/g, '""')}"`,
            `"${u.create_date || ''}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `scanned_users_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const visibleUsers = sourceFilter === 'all'
        ? users
        : users.filter((user) => (sourceFilter === 'qr' ? isQrScanUser(user) : !isQrScanUser(user)));

    const fullSetLoaded = !loading && !String(searchTerm || '').trim() && Number(pagination.total_pages) <= 1;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const currentMonth = new Date().getMonth();
    const addedThisWeek = fullSetLoaded
        ? users.filter((user) => {
            const created = parseLooseDate(user.create_date);
            return created && created >= weekStart;
        }).length
        : null;
    const birthdaysThisMonth = fullSetLoaded
        ? users.filter((user) => {
            const dob = parseLooseDate(user.dob);
            return dob && dob.getMonth() === currentMonth;
        }).length
        : null;

    return (
        <div className="min-h-screen bg-surface-ground font-sans text-slate-900">
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

            <main className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Scanned users</h1>
                            <p className="mt-1 text-sm text-ink-500">People who scanned a project QR code, or were added by hand.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => fetchUsers(pagination.page, searchTerm)}
                                disabled={loading}
                                title="Refresh"
                                className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[9px] border border-[#E1DFEC] bg-white text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                type="button"
                                onClick={exportCsv}
                                className="inline-flex h-[38px] items-center gap-2 rounded-[9px] border border-[#E1DFEC] bg-white px-3.5 text-[13px] font-semibold text-ink hover:bg-surface-soft"
                            >
                                <Download className="h-4 w-4" />
                                Export
                            </button>
                            <button
                                type="button"
                                onClick={handleOpenAddModal}
                                className="inline-flex h-[38px] items-center gap-2 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-700"
                            >
                                <Plus className="h-4 w-4" />
                                Add user
                            </button>
                        </div>
                    </div>

                    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-[14px] border border-line bg-white px-5 py-4">
                            <p className="text-[13px] text-ink-500">Total scanned users</p>
                            <p className="oc-num mt-2 text-[28px] leading-none text-ink">{Number(pagination.total) || 0}</p>
                        </div>
                        {fullSetLoaded ? (
                            <>
                                <div className="rounded-[14px] border border-line bg-white px-5 py-4">
                                    <p className="text-[13px] text-ink-500">Added this week</p>
                                    <p className="oc-num mt-2 text-[28px] leading-none text-ink">{addedThisWeek}</p>
                                </div>
                                <div className="rounded-[14px] border border-line bg-white px-5 py-4">
                                    <p className="text-[13px] text-ink-500">Birthdays this month</p>
                                    <p className="oc-num mt-2 text-[28px] leading-none text-ink">{birthdaysThisMonth}</p>
                                </div>
                            </>
                        ) : null}
                    </div>

                    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
                        <div className="flex flex-col gap-3 border-b border-[#ECEAF3] p-3 sm:flex-row sm:items-center sm:justify-between">
                            <form onSubmit={handleSearchSubmit} className="relative min-w-0 flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                                <input
                                    type="text"
                                    placeholder="Search name, mobile, or email"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-[38px] w-full rounded-[9px] border border-line bg-white pl-9 pr-16 text-[13px] text-ink outline-none placeholder:text-ink-400 focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20"
                                />
                                {searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            fetchUsers(1, '');
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-ink-500 hover:text-ink"
                                    >
                                        Clear
                                    </button>
                                ) : null}
                            </form>
                            <div className="inline-flex shrink-0 rounded-[9px] border border-line bg-surface-soft p-0.5">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'qr', label: 'QR scan' },
                                    { id: 'hand', label: 'Added by hand' },
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setSourceFilter(option.id)}
                                        className={`h-8 rounded-[7px] px-3 text-[12px] font-semibold ${sourceFilter === option.id ? 'bg-ink text-white' : 'text-ink-500 hover:text-ink'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        {['#', 'Name', 'Email', 'Company', 'Tags', 'QR source', 'Dates', 'Added', ''].map((label) => (
                                            <th key={label || 'actions'} className={`oc-th ${label === '#' ? 'w-12 text-center' : ''}`}>{label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <TableSkeletonRows rows={8} cells={['index', 'avatar', 'text', 'short', 'badge', 'badge', 'short', 'short', 'action']} />
                                </tbody>
                            </table>
                        ) : visibleUsers.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                                    <Users className="h-6 w-6" />
                                </div>
                                <h2 className="mt-4 text-base font-semibold text-ink">No scanned users</h2>
                                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
                                    {searchTerm
                                        ? 'Nothing matches this search. Try another name or number.'
                                        : sourceFilter !== 'all'
                                            ? 'Nothing on this page matches that source. Try another page or show all.'
                                            : 'People show up here after they scan a project QR code, or after you add them.'}
                                </p>
                                {!searchTerm && sourceFilter === 'all' ? (
                                    <button
                                        type="button"
                                        onClick={handleOpenAddModal}
                                        className="mt-5 inline-flex h-[38px] items-center gap-2 rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add user
                                    </button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full">
                                    <thead>
                                        <tr>
                                            {['#', 'Name', 'Email', 'Company', 'Tags', 'QR source', 'Dates', 'Added', ''].map((label) => (
                                                <th key={label || 'actions'} className={`oc-th ${label === '' ? 'text-right' : ''} ${label === '#' ? 'w-12 text-center' : ''}`}>{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleUsers.map((user, index) => {
                                            const qrScan = isQrScanUser(user);
                                            const tags = String(user.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
                                            return (
                                                <tr key={user.scan_id || user.id} className="transition hover:bg-surface-soft">
                                                    <td className="oc-td text-center text-xs font-semibold text-ink-500 oc-num">{((Number(pagination.page) || 1) - 1) * (Number(pagination.limit) || 0) + index + 1}</td>
                                                    <td className="oc-td">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-800">
                                                                {personInitials(user.name)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-ink">{user.name || 'Unnamed'}</p>
                                                                <p className="truncate font-mono text-[11px] text-ink-400">{user.mobile || '—'}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="oc-td text-sm text-ink-500">
                                                        {user.email ? <span className="block max-w-[200px] truncate">{user.email}</span> : <span className="text-ink-400">No email</span>}
                                                    </td>
                                                    <td className="oc-td text-sm text-ink">
                                                        {user.company || <span className="text-ink-400">—</span>}
                                                    </td>
                                                    <td className="oc-td">
                                                        {tags.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {tags.map((tag, tagIndex) => (
                                                                    <span key={`${tag}-${tagIndex}`} className="inline-flex items-center rounded-md bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-ink-700">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-ink-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="oc-td">
                                                        {qrScan ? (
                                                            <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">QR scan</span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">Added by hand</span>
                                                        )}
                                                    </td>
                                                    <td className="oc-td text-xs text-ink-700">
                                                        {user.dob ? <p>DOB {formatMonthDay(user.dob)}</p> : null}
                                                        {user.anniversary ? <p>Anniv {formatMonthDay(user.anniversary)}</p> : null}
                                                        {!user.dob && !user.anniversary ? <span className="text-ink-400">—</span> : null}
                                                    </td>
                                                    <td className="oc-td whitespace-nowrap text-xs text-ink-500">
                                                        {formatAddedDate(user.create_date)}
                                                    </td>
                                                    <td className="oc-td text-right">
                                                        <RowActionMenu
                                                            items={[
                                                                { label: 'Details', icon: <FileText className="w-4 h-4" />, onClick: () => setDetailsUser(user) },
                                                                { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => handleOpenEditModal(user) },
                                                                { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenDeleteModal(user), danger: true },
                                                            ]}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!loading && pagination.total > 0 ? (
                            <>
                                <p className="border-t border-[#ECEAF3] px-4 pt-3 text-xs text-ink-500">
                                    Showing {visibleUsers.length} of {pagination.total}
                                </p>
                                <Pagination
                                    currentPage={pagination.page}
                                    totalPages={pagination.total_pages}
                                    totalRecords={pagination.total}
                                    pageSize={pagination.limit}
                                    onPageChange={(page) => fetchUsers(page, searchTerm)}
                                    onPageSizeChange={(size) => {
                                        setPagination((prev) => ({ ...prev, limit: size, page: 1 }));
                                        fetchUsers(1, searchTerm, size);
                                    }}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                />
                            </>
                        ) : null}
                    </div>
                </div>
            </main>

            {/* ADD / EDIT MODAL */}
            <AnimatedModal open={modalOpen}>
              {modalOpen && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all">
                          {/* Modal Header */}
                          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                      {modalMode === 'add' ? <Plus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-bold text-slate-900">
                                          {modalMode === 'add' ? 'Add Scanned User' : 'Edit User Profile'}
                                      </h3>
                                      <p className="text-xs text-slate-500">
                                          Enter customer details to record their scan and communication preferences.
                                      </p>
                                  </div>
                              </div>
                              <button
                                  onClick={() => setModalOpen(false)}
                                  className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                  <X className="w-5 h-5" />
                              </button>
                          </div>

                          {/* Modal Form Body */}
                          <form onSubmit={handleSubmit}>
                              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {/* Name */}
                                      <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                              Full Name <span className="text-red-500">*</span>
                                          </label>
                                          <input
                                              type="text"
                                              name="name"
                                              required
                                              value={formData.name}
                                              onChange={handleFormChange}
                                              placeholder="e.g. Rahul Sharma"
                                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                          />
                                      </div>

                                      {/* Mobile */}
                                      <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                              Mobile Number <span className="text-red-500">*</span>
                                          </label>
                                          <input
                                              type="text"
                                              name="mobile"
                                              required
                                              value={formData.mobile}
                                              onChange={handleFormChange}
                                              placeholder="e.g. 919876543210"
                                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                          />
                                      </div>

                                      {/* Email */}
                                      <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                              Email Address
                                          </label>
                                          <input
                                              type="email"
                                              name="email"
                                              value={formData.email}
                                              onChange={handleFormChange}
                                              placeholder="e.g. rahul@example.com"
                                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                          />
                                      </div>

                                      {/* Company / Firm */}
                                      <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                              Company / Business Name
                                          </label>
                                          <input
                                              type="text"
                                              name="company"
                                              value={formData.company}
                                              onChange={handleFormChange}
                                              placeholder="e.g. Acme Corporation"
                                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                          />
                                      </div>

                                      {/* DOB */}
                                      <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                              Date of Birth (DOB)
                                          </label>
                                          <input
                                              type="date"
                                              name="dob"
                                              value={formData.dob}
                                              onChange={handleFormChange}
                                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                          />
                                      </div>

                                      {/* Anniversary */}
                                      <div>
                                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                              Anniversary Date
                                          </label>
                                          <input
                                              type="date"
                                              name="anniversary"
                                              value={formData.anniversary}
                                              onChange={handleFormChange}
                                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                          />
                                      </div>
                                  </div>

                                

                                  {/* Tags */}
                                  <div>
                                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                          Tags (Comma-separated)
                                      </label>
                                      <input
                                          type="text"
                                          name="tags"
                                          value={formData.tags}
                                          onChange={handleFormChange}
                                          placeholder="e.g. VIP, Retail, Walk-in"
                                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                      />
                                  </div>

                                  {/* Address */}
                                  <div>
                                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                          Address
                                      </label>
                                      <input
                                          type="text"
                                          name="address"
                                          value={formData.address}
                                          onChange={handleFormChange}
                                          placeholder="Street address, city, pincode"
                                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                      />
                                  </div>

                                  {/* Notes */}
                                  <div>
                                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                          Notes / Special Preferences
                                      </label>
                                      <textarea
                                          name="notes"
                                          rows={3}
                                          value={formData.notes}
                                          onChange={handleFormChange}
                                          placeholder="Customer preferences, discussion remarks, visit details..."
                                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                      ></textarea>
                                  </div>
                              </div>

                              {/* Modal Footer */}
                              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-3">
                                  <button
                                      type="button"
                                      onClick={() => setModalOpen(false)}
                                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-white font-medium text-sm transition-all"
                                  >
                                      Cancel
                                  </button>
                                  <button
                                      type="submit"
                                      disabled={submitting}
                                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50"
                                  >
                                      {submitting ? (
                                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                          <Check className="w-4 h-4" />
                                      )}
                                      <span>{modalMode === 'add' ? 'Save User' : 'Update User'}</span>
                                  </button>
                              </div>
                          </form>
                      </div>
                  </div>
              )}
            </AnimatedModal>

            {/* DELETE CONFIRMATION MODAL */}
            <AnimatedModal open={(deleteModalOpen && userToDelete)}>
              {deleteModalOpen && userToDelete && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
                              <Trash2 className="w-7 h-7" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Scanned User?</h3>
                          <p className="text-sm text-slate-500 mb-6">
                              Are you sure you want to remove <strong>{userToDelete.name}</strong> ({userToDelete.mobile})? This action can be undone by admin.
                          </p>
                          <div className="flex items-center justify-center gap-3">
                              <button
                                  type="button"
                                  onClick={() => setDeleteModalOpen(false)}
                                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-all"
                              >
                                  Cancel
                              </button>
                              <button
                                  type="button"
                                  onClick={confirmDelete}
                                  disabled={deleting}
                                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm shadow-sm transition-all disabled:opacity-50"
                              >
                                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                              </button>
                          </div>
                      </div>
                  </div>
              )}
            </AnimatedModal>
            <RecordDetailsModal
                isOpen={Boolean(detailsUser)}
                onClose={() => setDetailsUser(null)}
                title={detailsUser?.name || 'Scanned user'}
                subtitle={detailsUser?.mobile}
                fields={detailsUser ? [
                    { label: 'Email', value: detailsUser.email },
                    { label: 'Company', value: detailsUser.company },
                    { label: 'Address', value: detailsUser.address },
                    { label: 'Notes', value: detailsUser.notes },
                    { label: 'Date of birth', value: detailsUser.dob },
                    { label: 'Anniversary', value: detailsUser.anniversary },
                    { label: 'QR source', value: isQrScanUser(detailsUser) ? (detailsUser.qr_id ? `QR ${detailsUser.qr_id}` : 'QR scan') : 'Added by hand' },
                    { label: 'Tags', value: detailsUser.tags },
                    { label: 'Added', value: detailsUser.create_date },
                ] : []}
            />
        </div>
    );
}
