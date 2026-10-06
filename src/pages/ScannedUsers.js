import React, { useState, useEffect, useCallback } from 'react';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import {
    Users,
    Plus,
    Search,
    Edit2,
    Trash2,
    Calendar,
    Phone,
    Mail,
    Briefcase,
    FileText,
    X,
    Check,
    Download,
    RefreshCw,
    Heart,
    QrCode
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

    return (
        <div className="min-h-screen bg-[#f4f6fb] font-sans text-slate-900">
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
                <div className="w-full px-4 py-5">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Scanned users</h1>
                            <p className="mt-1 text-sm text-slate-500">People who scanned a project QR code, or were added by hand.</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <form onSubmit={handleSearchSubmit} className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search name, mobile, or email"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-64"
                                />
                            </form>
                            <div className="flex items-center gap-2">
                                {searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            fetchUsers(1, '');
                                        }}
                                        className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                    >
                                        Clear
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={exportCsv}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                >
                                    <Download className="h-4 w-4" />
                                    Export
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchUsers(pagination.page, searchTerm)}
                                    disabled={loading}
                                    title="Refresh"
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenAddModal}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add user
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scanned Users Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        {loading ? (
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        {['#', 'User', 'Contact', 'Special dates', 'QR source', 'Added', ''].map((label) => (
                                            <th key={label || 'actions'} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">{label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <TableSkeletonRows rows={8} cells={['index', 'avatar', 'text', 'short', 'badge', 'short', 'action']} />
                                </tbody>
                            </table>
                        ) : users.length === 0 ? (
                            <div className="px-6 py-16 text-center">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                                    <Users className="h-6 w-6" />
                                </div>
                                <h2 className="mt-4 text-base font-semibold text-slate-900">No scanned users</h2>
                                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                    {searchTerm
                                        ? 'Nothing matches this search. Try another name or number.'
                                        : 'People show up here after they scan a project QR code, or after you add them.'}
                                </p>
                                {!searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={handleOpenAddModal}
                                        className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add user
                                    </button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            {['#', 'User', 'Contact', 'Special dates', 'QR source', 'Added', ''].map((label) => (
                                                <th key={label || 'actions'} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5 ${label === '' ? 'text-right' : 'text-left'}`}>{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((user, index) => {
                                            const initials = (user.name || 'U')
                                                .split(' ')
                                                .map(n => n[0])
                                                .join('')
                                                .toUpperCase()
                                                .slice(0, 2);

                                            return (
                                                <tr key={user.scan_id || user.id} className="transition hover:bg-slate-50">
                                                    <td className="px-4 py-4 text-center text-sm text-slate-500">{(pagination.page - 1) * pagination.limit + index + 1}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
                                                                {initials}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-slate-900 truncate">
                                                                    {user.name || 'Unnamed'}
                                                                </p>
                                                                {user.company && (
                                                                    <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                                                        <Briefcase className="w-3 h-3 flex-shrink-0" />
                                                                        {user.company}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Contact */}
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1">
                                                            <p className="font-semibold text-slate-900 flex items-center gap-1.5 text-xs">
                                                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                                <span>{user.mobile}</span>
                                                            </p>
                                                            {user.email ? (
                                                                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                                                    <span className="truncate max-w-[180px]">{user.email}</span>
                                                                </p>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">No email</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Dates (DOB & Anniversary) */}
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1 text-xs">
                                                            {user.dob ? (
                                                                <p className="flex items-center gap-1.5 text-slate-700">
                                                                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                                                    <span>DOB: <strong>{user.dob}</strong></span>
                                                                </p>
                                                            ) : null}
                                                            {user.anniversary ? (
                                                                <p className="flex items-center gap-1.5 text-pink-600">
                                                                    <Heart className="w-3.5 h-3.5 text-pink-500" />
                                                                    <span>Anniv: <strong>{user.anniversary}</strong></span>
                                                                </p>
                                                            ) : null}
                                                            {!user.dob && !user.anniversary && (
                                                                <span className="text-xs text-slate-400 italic">—</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* QR Source */}
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1.5">
                                                            {user.qr_label ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                    <QrCode className="w-3 h-3" />
                                                                    {user.qr_label}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                                                                    Direct
                                                                </span>
                                                            )}

                                                            {user.tags && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {user.tags.split(',').map((tag, idx) => (
                                                                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700 border border-violet-100">
                                                                            #{tag.trim()}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Date Added */}
                                                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                        {user.create_date ? user.create_date.slice(0, 16) : '—'}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-3 py-4 text-right">
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
                        ) : null}
                    </div>
                </div>
            </main>

            {/* ADD / EDIT MODAL */}
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

            {/* DELETE CONFIRMATION MODAL */}
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
                    { label: 'QR source', value: detailsUser.qr_label || 'Direct' },
                    { label: 'Tags', value: detailsUser.tags },
                    { label: 'Added', value: detailsUser.create_date },
                ] : []}
            />
        </div>
    );
}
