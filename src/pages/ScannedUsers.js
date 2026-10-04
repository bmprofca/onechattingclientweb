import React, { useState, useEffect, useCallback } from 'react';
import { Header, Sidebar } from '../component/Menu';
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
    Tag,
    FileText,
    X,
    Check,
    Download,
    RefreshCw,
    Heart,
    MapPin,
    UserCheck,
    AlertCircle,
    QrCode
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getScannedUsers,
    addScannedUser,
    updateScannedUser,
    deleteScannedUser
} from '../api/scannedUsers';
import { getProjectQRCodes } from '../api/qrcode';
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
    const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, total_pages: 1 });
    const [qrCodes, setQrCodes] = useState([]);

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
    const fetchUsers = useCallback(async (page = 1, search = searchTerm) => {
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
                limit: pagination.limit
            });

            if (!res.error && res.data) {
                setUsers(res.data);
                if (res.pagination) {
                    setPagination(res.pagination);
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

    // Fetch project QR codes for linking in form
    useEffect(() => {
        const fetchQrs = async () => {
            if (!projectId) return;
            try {
                const res = await getProjectQRCodes({ project_id: projectId });
                if (!res.error && res.qr_codes) {
                    setQrCodes(res.qr_codes);
                }
            } catch (e) {
                console.error('Error fetching QR codes:', e);
            }
        };
        fetchQrs();
    }, [projectId]);

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

            <main className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="p-4 sm:p-6 lg:p-8 max-w-8xl mx-auto space-y-6">

                    {/* Top Header Card */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                                <QrCode className="w-4 h-4" />
                                <span>QR Code Management</span>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                Scanned Users
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {pagination.total} Records
                                </span>
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                View and manage customer profiles captured through QR scans or added manually.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={exportCsv}
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm transition-all shadow-sm active:scale-95"
                            >
                                <Download className="w-4 h-4 text-slate-500" />
                                <span>Export CSV</span>
                            </button>

                            <button
                                onClick={() => fetchUsers(pagination.page, searchTerm)}
                                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium text-sm transition-all shadow-sm active:scale-95"
                                title="Refresh"
                            >
                                <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                            </button>

                            <button
                                onClick={handleOpenAddModal}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm hover:shadow transition-all active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Scanned User</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Total Scanned</p>
                                <p className="text-2xl font-bold text-slate-900">{pagination.total}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Active Profiles</p>
                                <p className="text-2xl font-bold text-emerald-600">{pagination.total}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <UserCheck className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Active QR Codes</p>
                                <p className="text-2xl font-bold text-amber-600">{qrCodes.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                <QrCode className="w-6 h-6" />
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">With Birthday/Anniv</p>
                                <p className="text-2xl font-bold text-pink-600">
                                    {users.filter(u => u.dob || u.anniversary).length}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600">
                                <Heart className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
                        <form onSubmit={handleSearchSubmit} className="flex gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, mobile, email, company, or tags..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-sm"
                            >
                                Search
                            </button>
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        fetchUsers(1, '');
                                    }}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-all"
                                >
                                    Clear
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Scanned Users Table */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        {loading ? (
                            <table className="w-full">
                                <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                                    <tr>
                                        {['#', 'User', 'Contact', 'Special Dates', 'QR Source', 'Date Added', ''].map((label) => (
                                            <th key={label || 'actions'} className="px-4 py-4 text-left">{label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <TableSkeletonRows rows={8} cells={['index', 'avatar', 'text', 'short', 'badge', 'short', 'action']} />
                                </tbody>
                            </table>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center max-w-md mx-auto">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">No scanned users found</h3>
                                <p className="text-sm text-slate-500 mb-6">
                                    {searchTerm
                                        ? 'No records match your search filter. Try different keywords.'
                                        : 'When customers scan your WhatsApp QR code or you add them manually, they will appear here.'}
                                </p>
                                <button
                                    onClick={handleOpenAddModal}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add First User</span>
                                </button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-600">
                                    <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="w-14 px-4 py-4 text-center">#</th>
                                            <th className="px-6 py-4">User</th>
                                            <th className="px-6 py-4">Contact</th>
                                            <th className="px-6 py-4">Special Dates</th>
                                            <th className="px-6 py-4">QR Source</th>
                                            <th className="px-6 py-4">Date Added</th>
                                            <th className="w-16 px-3 py-4 text-right">Actions</th>
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
                                                <tr key={user.scan_id || user.id} className="hover:bg-slate-50/60 transition-colors">
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

                        {/* Pagination Footer */}
                        {!loading && users.length > 0 && (
                            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500">
                                <p>
                                    Page <strong>{pagination.page}</strong> of <strong>{pagination.total_pages}</strong> · Total: {pagination.total}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={pagination.page <= 1}
                                        onClick={() => fetchUsers(pagination.page - 1, searchTerm)}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={pagination.page >= pagination.total_pages}
                                        onClick={() => fetchUsers(pagination.page + 1, searchTerm)}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
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
