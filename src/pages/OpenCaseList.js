import React, { useEffect, useState, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Header, Sidebar } from '../component/Menu';
import { Encrypt } from './encryption/payload-encryption';
import Pagination from '../component/Pagination';
import SearchableSelect from '../component/SearchableSelect';
import { FiAlertCircle, FiHash, FiPhone, FiFileText, FiUser, FiSearch, FiEye, FiEdit2, FiX, FiPlus, FiClock, FiCalendar, FiCheckSquare, FiRefreshCw } from 'react-icons/fi';
import { parseServerDate } from '../utils/dateTime';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import defaultCaseNames from '../data/caseNames.json';

const CUSTOM_CASE_NAMES_STORAGE_KEY = 'openCaseCustomNames';
const CUSTOM_CASE_NAME_VALUE = '__create_new_case_name__';

const getStoredCaseNames = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(CUSTOM_CASE_NAMES_STORAGE_KEY) || '[]');
        return Array.isArray(stored) ? stored.filter(name => typeof name === 'string' && name.trim()) : [];
    } catch (error) {
        return [];
    }
};

function OpenCaseList() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });
    const [tokens, setTokens] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [casesByNumber, setCasesByNumber] = useState([]);
    const [pageNo, setPageNo] = useState(1);
    const [limit, setLimit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPage, setTotalPage] = useState(1);
    const [search, setSearch] = useState('');
    const [caseNameFilter, setCaseNameFilter] = useState('');

    // Bulk-close state (main table)
    const [selectedNumbers, setSelectedNumbers] = useState(new Set());
    const [bulkCloseLoading, setBulkCloseLoading] = useState(false);

    // Case list modal state (shared structure with Conversation.js)
    const [showCaseListModal, setShowCaseListModal] = useState(false);
    const [caseModalNumber, setCaseModalNumber] = useState(null);
    const [caseModalContact, setCaseModalContact] = useState(null);
    const [caseList, setCaseList] = useState([]);
    const [caseDetail, setCaseDetail] = useState(null);
    const [numberDetail, setNumberDetail] = useState(null);
    const [caseListLoading, setCaseListLoading] = useState(false);
    const [caseListError, setCaseListError] = useState('');
    const [caseListPageNo, setCaseListPageNo] = useState(1);
    const [caseListLimit, setCaseListLimit] = useState(10);
    const [caseListTotal, setCaseListTotal] = useState(0);
    const [caseListTotalPage, setCaseListTotalPage] = useState(1);
    const [caseListSearch, setCaseListSearch] = useState('');
    const [caseListStatusFilter, setCaseListStatusFilter] = useState(''); // '' | 'open' | 'closed'

    // Bulk-close state inside case list modal
    const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
    const [modalBulkCloseLoading, setModalBulkCloseLoading] = useState(false);

    // Edit case state (mirrors Conversation.js)
    const [showCaseEditModal, setShowCaseEditModal] = useState(false);
    const [caseEditRow, setCaseEditRow] = useState(null);
    const [caseEditName, setCaseEditName] = useState('');
    const [caseEditRemark, setCaseEditRemark] = useState('');
    const [caseEditStatus, setCaseEditStatus] = useState('open');
    const [caseEditLoading, setCaseEditLoading] = useState(false);
    const [caseEditError, setCaseEditError] = useState('');

    // Create case (with contact picker) state
    const [showCaseCreateModal, setShowCaseCreateModal] = useState(false);
    const [caseCreateSelectedContact, setCaseCreateSelectedContact] = useState(null); // { id, name, number, ... }
    const [caseCreateName, setCaseCreateName] = useState('');
    const [caseCreateRemark, setCaseCreateRemark] = useState('');
    const [caseCreateStatus, setCaseCreateStatus] = useState('open');
    const [caseCreateLoading, setCaseCreateLoading] = useState(false);
    const [caseCreateError, setCaseCreateError] = useState('');

    const [caseCreateContacts, setCaseCreateContacts] = useState([]);
    const [caseCreateContactsLoading, setCaseCreateContactsLoading] = useState(false);
    const [caseCreateContactsQuery, setCaseCreateContactsQuery] = useState('');
    const [caseCreateContactsPage, setCaseCreateContactsPage] = useState(1);
    const [caseCreateContactsTotalPages, setCaseCreateContactsTotalPages] = useState(1);
    const [customCaseNames, setCustomCaseNames] = useState(getStoredCaseNames);
    const [newCaseName, setNewCaseName] = useState('');
    const [caseNameError, setCaseNameError] = useState('');
    const [caseCreateCustomNameMode, setCaseCreateCustomNameMode] = useState(false);
    const [caseEditCustomNameMode, setCaseEditCustomNameMode] = useState(false);

    const navigate = useNavigate();

    const caseNameOptions = [...new Set([
        ...(Array.isArray(defaultCaseNames) ? defaultCaseNames : []),
        ...customCaseNames,
        caseCreateName,
        caseEditName
    ].map(name => String(name || '').trim()).filter(Boolean))];

    const addCustomCaseName = (setName) => {
        const name = newCaseName.trim();
        if (!name) {
            setCaseNameError('Please enter a case name');
            return false;
        }

        const matchingName = caseNameOptions.find(option => option.toLowerCase() === name.toLowerCase());
        if (matchingName) {
            setName(matchingName);
            setNewCaseName('');
            setCaseNameError('');
            return true;
        }

        const updatedNames = [...customCaseNames, name];
        setCustomCaseNames(updatedNames);
        localStorage.setItem(CUSTOM_CASE_NAMES_STORAGE_KEY, JSON.stringify(updatedNames));
        setName(name);
        setNewCaseName('');
        setCaseNameError('');
        return true;
    };

    const handleCaseNameSelect = (value, setName, setCustomMode) => {
        if (value === CUSTOM_CASE_NAME_VALUE) {
            setName('');
            setCustomMode(true);
            setNewCaseName('');
            setCaseNameError('');
            return;
        }
        setCustomMode(false);
        setName(value);
        setCaseNameError('');
    };

    const formatShortDateTime = (value) => {
        if (!value) return '-';
        const d = parseServerDate(value);
        if (!d) return '-';
        return d.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatOpenSince = (value) => {
        if (!value) return '-';
        const created = parseServerDate(value);
        if (!created) return '-';
        const diffMs = Date.now() - created.getTime();
        if (diffMs < 0) return '0m';
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    };

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            setTokens(JSON.parse(userData));
        }
    }, []);

    const fetchOpenCases = useCallback(async (page = 1, overrides = {}) => {
        if (!tokens?.token || !tokens?.username) return;

        const selectedProjectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
        if (!selectedProjectId) {
            setError('No project selected. Please select a project to view cases.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const effectiveSearch = overrides.search !== undefined ? overrides.search : search;
            const effectiveCaseNameFilter = overrides.caseNameFilter !== undefined ? overrides.caseNameFilter : caseNameFilter;

            const payload = {
                project_id: selectedProjectId,
                page_no: page,
                limit,
                case_name_filter: effectiveCaseNameFilter || '',
                known_case_names: Array.isArray(defaultCaseNames) ? defaultCaseNames : []
            };

            if (effectiveSearch && String(effectiveSearch).trim()) {
                payload.search = String(effectiveSearch).trim();
            }

            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/message/open-case-list`,
                JSON.stringify({ data, key }),
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response?.data?.error) {
                const err = response.data.error;
                if (typeof err === 'string') {
                    setError(err);
                } else {
                    setError(response.data.msg || 'Failed to get open case list');
                }
                setCasesByNumber([]);
                setTotal(0);
                setTotalPage(1);
                return;
            }

            const list = Array.isArray(response?.data?.data) ? response.data.data : [];
            const meta = response?.data?.meta || {};

            setCasesByNumber(list);
            setPageNo(meta.page_no || page);
            setTotal(Number(meta.total) || 0);
            setTotalPage(Number(meta.total_page) || 1);
            setSelectedNumbers(new Set()); // Clear selection on page change
        } catch (err) {
            setError('Failed to get open case list');
            setCasesByNumber([]);
            setTotal(0);
            setTotalPage(1);
        } finally {
            setLoading(false);
        }
    }, [tokens, limit, search, caseNameFilter]);

    // ----- Bulk close (main table) -----
    const handleBulkCloseSelected = useCallback(async () => {
        if (selectedNumbers.size === 0) return;
        if (!tokens?.token || !tokens?.username) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
        if (!projectId) return;

        const caseIds = [];
        for (const num of selectedNumbers) {
            const item = casesByNumber.find(r => r.number === num);
            if (item && Array.isArray(item.cases)) {
                item.cases.forEach(c => {
                    if (c.status === true || c.status === '0' || c.status === 0) {
                        if (c.case_id) caseIds.push(c.case_id);
                    }
                });
            }
        }
        if (caseIds.length === 0) { toast.error('No open cases found for selected numbers'); return; }
        if (!window.confirm(`Close ${caseIds.length} open case(s) for ${selectedNumbers.size} number(s)?`)) return;
        setBulkCloseLoading(true);
        try {
            const payload = { project_id: projectId, case_ids: caseIds };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(`${API_BASE_URL}/message/case-bulk-close`, JSON.stringify({ data, key }), { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } });
            if (response?.data?.error) { toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to bulk close cases'); return; }
            toast.success(response?.data?.msg ?? `${caseIds.length} case(s) closed`);
            setSelectedNumbers(new Set());
            fetchOpenCases(pageNo, { search });
        } catch (e) { toast.error('Failed to bulk close cases. Please try again.'); }
        finally { setBulkCloseLoading(false); }
    }, [selectedNumbers, tokens, casesByNumber, pageNo, search, fetchOpenCases]);

    // ----- Bulk close inside case list modal -----
    const handleModalBulkClose = useCallback(async () => {
        if (selectedCaseIds.size === 0) return;
        if (!tokens?.token || !tokens?.username) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
        if (!projectId) return;
        if (!window.confirm(`Close ${selectedCaseIds.size} case(s)?`)) return;
        setModalBulkCloseLoading(true);
        try {
            const payload = { project_id: projectId, case_ids: [...selectedCaseIds] };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(`${API_BASE_URL}/message/case-bulk-close`, JSON.stringify({ data, key }), { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } });
            if (response?.data?.error) { toast.error(typeof response.data.error === 'string' ? response.data.error : 'Failed to bulk close cases'); return; }
            toast.success(response?.data?.msg ?? `${selectedCaseIds.size} case(s) closed`);
            setSelectedCaseIds(new Set());
            fetchCaseListForNumber(caseModalNumber, caseListPageNo, { search: caseListSearch, status: caseListStatusFilter });
            fetchOpenCases(pageNo, { search });
        } catch (e) { toast.error('Failed to bulk close cases. Please try again.'); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
        finally { setModalBulkCloseLoading(false); }
    }, [selectedCaseIds, tokens, caseModalNumber, caseListPageNo, caseListSearch, caseListStatusFilter, pageNo, search]);

    // ----- Create case (contact picker + create form) -----
    const openCaseCreateModal = useCallback(() => {
        setCaseCreateSelectedContact(null);
        setCaseCreateName('');
        setCaseCreateRemark('');
        setCaseCreateStatus('open');
        setCaseCreateError('');
        setCaseCreateContacts([]);
        setCaseCreateContactsQuery('');
        setCaseCreateContactsPage(1);
        setCaseCreateContactsTotalPages(1);
        setNewCaseName('');
        setCaseNameError('');
        setCaseCreateCustomNameMode(false);
        setShowCaseCreateModal(true);
    }, []);

    const closeCaseCreateModal = useCallback(() => {
        setShowCaseCreateModal(false);
        setCaseCreateSelectedContact(null);
        setCaseCreateName('');
        setCaseCreateRemark('');
        setCaseCreateStatus('open');
        setCaseCreateError('');
        setNewCaseName('');
        setCaseNameError('');
        setCaseCreateCustomNameMode(false);
    }, []);

    const fetchContactsForCaseCreate = useCallback(async (page = 1, queryOverride) => {
        if (!tokens?.token || !tokens?.username) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
        if (!projectId) return;

        setCaseCreateContactsLoading(true);
        try {
            const query = (queryOverride !== undefined ? queryOverride : caseCreateContactsQuery) || '';
            const payload = {
                project_id: projectId,
                page_no: page,
                limit: 10,
                query
            };

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/contact/contact-list`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response?.data?.error) {
                toast.error(response?.data?.message || response?.data?.error || 'Failed to load contacts');
                setCaseCreateContacts([]);
                setCaseCreateContactsTotalPages(1);
                return;
            }

            const list = response?.data?.data || [];
            const meta = response?.data?.meta || null;
            const mapped = list.map((c) => ({
                id: c.contact_id,
                name: c.name,
                number: c.number,
                firm_name: c.firm_name
            }));

            setCaseCreateContacts(mapped);
            setCaseCreateContactsPage(meta?.page_no ?? page);
            setCaseCreateContactsTotalPages(meta?.total_pages ?? 1);
        } catch (e) {
            toast.error('Failed to load contacts. Please try again.');
            setCaseCreateContacts([]);
            setCaseCreateContactsTotalPages(1);
        } finally {
            setCaseCreateContactsLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id, tokens?.projects, caseCreateContactsQuery]);

    useEffect(() => {
        if (!showCaseCreateModal) return;
        const q = String(caseCreateContactsQuery || '').trim();
        // Don't load contacts by default. User must type first.
        if (q.length === 0) {
            setCaseCreateContacts([]);
            setCaseCreateContactsPage(1);
            setCaseCreateContactsTotalPages(1);
            return;
        }
        const t = setTimeout(() => {
            fetchContactsForCaseCreate(1, q);
        }, 250);
        return () => clearTimeout(t);
    }, [showCaseCreateModal, caseCreateContactsQuery, fetchContactsForCaseCreate]);

    const fetchCreateCase = useCallback(async () => {
        if (!tokens?.token || !tokens?.username) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id;
        const number = caseCreateSelectedContact?.number;

        if (!projectId || !number) {
            setCaseCreateError('Please select a contact');
            return;
        }

        const name = String(caseCreateName ?? '').trim();
        if (!name) {
            setCaseCreateError('Case name is required');
            return;
        }

        setCaseCreateLoading(true);
        setCaseCreateError('');
        try {
            const payload = {
                project_id: projectId,
                number,
                name,
                remark: String(caseCreateRemark ?? '').trim(),
                status: caseCreateStatus === 'closed' ? 'closed' : 'open'
            };
            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/case-create`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to create case';
                setCaseCreateError(errMsg);
                return;
            }
            toast.success(response?.data?.msg ?? 'Case created successfully');
            closeCaseCreateModal();
            fetchOpenCases(1, { search });
        } catch (error) {
            setCaseCreateError(error?.response?.data?.error ?? 'Failed to create case. Please try again.');
        } finally {
            setCaseCreateLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id, tokens?.projects, caseCreateSelectedContact, caseCreateName, caseCreateRemark, caseCreateStatus, closeCaseCreateModal, fetchOpenCases, search]);

    useEffect(() => {
        if (tokens) {
            fetchOpenCases(1);
        }
    }, [tokens, fetchOpenCases]);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPage || newPage === pageNo) return;
        setPageNo(newPage);
        fetchOpenCases(newPage);
    };

    const getOpenCaseCount = (item) => {
        if (!Array.isArray(item?.cases)) return 0;
        return item.cases.filter(c => c.status === true || c.status === '0' || c.status === 0).length;
    };

    const fetchCaseListForNumber = useCallback(async (number, page = 1, overrides = {}) => {
        if (!tokens?.token || !tokens?.username || !tokens?.selected_project_id) return;
        if (!number) return;

        setCaseListLoading(true);
        setCaseListError('');

        try {
            const effectiveSearch = overrides.search !== undefined ? overrides.search : caseListSearch;
            const effectiveStatus = overrides.status !== undefined ? overrides.status : caseListStatusFilter;

            const payload = {
                project_id: tokens.selected_project_id || '',
                page_no: page,
                limit: Math.min(Math.max(caseListLimit, 1), 100),
                number: String(number).trim()
            };

            if (effectiveSearch && String(effectiveSearch).trim()) {
                payload.search = String(effectiveSearch).trim();
            }
            if (effectiveStatus === 'open' || effectiveStatus === 'closed') {
                payload.status = effectiveStatus;
            }

            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/case-list`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response?.data?.error) {
                setCaseListError(typeof response.data.error === 'string' ? response.data.error : (response.data.message || 'Failed to fetch case list'));
                setCaseList([]);
                setCaseListTotal(0);
                setCaseListTotalPage(1);
                return;
            }

            const list = response?.data?.data ?? [];
            const meta = response?.data?.meta ?? {};
            setCaseList(Array.isArray(list) ? list : []);
            setCaseListPageNo(meta.page_no ?? page);
            setCaseListTotal(Number(meta.total) || 0);
            setCaseListTotalPage(Number(meta.total_page) || 1);
            setSelectedCaseIds(new Set()); // Clear on reload
        } catch (err) {
            setCaseListError('Failed to fetch case list. Please try again.');
            setCaseList([]);
            setCaseListTotal(0);
            setCaseListTotalPage(1);
        } finally {
            setCaseListLoading(false);
        }
    }, [tokens, caseListLimit, caseListSearch, caseListStatusFilter]);

    // ---- Selection helpers ----
    const toggleNumber = (num) => {
        setSelectedNumbers(prev => { const next = new Set(prev); next.has(num) ? next.delete(num) : next.add(num); return next; });
    };
    const allOnPageSelected = casesByNumber.length > 0 && casesByNumber.every(item => selectedNumbers.has(item.number));
    const toggleAllOnPage = () => {
        if (allOnPageSelected) { setSelectedNumbers(prev => { const next = new Set(prev); casesByNumber.forEach(item => next.delete(item.number)); return next; }); }
        else { setSelectedNumbers(prev => { const next = new Set(prev); casesByNumber.forEach(item => next.add(item.number)); return next; }); }
    };
    const toggleCaseId = (id) => {
        setSelectedCaseIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    };

    const openCaseModal = (item) => {
        setCaseModalNumber(item.number || '');
        setCaseModalContact(item.contact || null);
        setCaseList([]);
        setCaseListError('');
        setCaseListPageNo(1);
        setCaseListTotal(0);
        setCaseListTotalPage(1);
        setCaseListSearch('');
        setCaseListStatusFilter('');
        setSelectedCaseIds(new Set());
        setShowCaseListModal(true);
        fetchCaseListForNumber(item.number, 1);
    };

    const closeCaseModal = () => {
        setShowCaseListModal(false);
        setSelectedCaseIds(new Set());
    };

    const handleCaseListPageChange = (newPage) => {
        if (newPage < 1 || newPage > caseListTotalPage || newPage === caseListPageNo) return;
        setCaseListPageNo(newPage);
        fetchCaseListForNumber(caseModalNumber, newPage);
    };

    const handleCaseListPageSizeChange = (newSize) => {
        const size = Math.min(Math.max(newSize, 1), 100);
        setCaseListLimit(size);
        setCaseListPageNo(1);
        fetchCaseListForNumber(caseModalNumber, 1);
    };

    const openCaseEditModal = (row) => {
        setCaseEditRow(row);
        setCaseEditName(row?.name ?? '');
        setCaseEditRemark(row?.remark ?? '');
        setCaseEditStatus(row?.status === true || row?.status === '1' ? 'open' : 'closed');
        setCaseEditError('');
        setNewCaseName('');
        setCaseNameError('');
        setCaseEditCustomNameMode(false);
        setShowCaseEditModal(true);
    };

    const closeCaseEditModal = () => {
        setShowCaseEditModal(false);
        setCaseEditRow(null);
        setCaseEditName('');
        setCaseEditRemark('');
        setCaseEditError('');
        setNewCaseName('');
        setCaseNameError('');
        setCaseEditCustomNameMode(false);
    };

    const fetchEditCase = useCallback(async () => {
        if (!tokens?.token || !tokens?.username || !tokens?.selected_project_id || !caseEditRow) return;
        const caseId = caseEditRow.case_id ?? caseEditRow.id;
        if (!caseId) return;
        if (!String(caseEditName ?? '').trim()) {
            setCaseEditError('Case name is required');
            return;
        }
        setCaseEditLoading(true);
        setCaseEditError('');
        try {
            const payload = {
                project_id: tokens.selected_project_id || '',
                case_id: caseId,
                name: String(caseEditName ?? '').trim(),
                remark: String(caseEditRemark ?? '').trim(),
                status: caseEditStatus === 'closed' ? 'closed' : 'open'
            };
            const { data, key } = Encrypt(payload);
            const data_pass = JSON.stringify({ data, key });
            const response = await axios.post(
                `${API_BASE_URL}/message/case-edit`,
                data_pass,
                {
                    headers: {
                        token: tokens.token,
                        username: tokens.username,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to update case';
                setCaseEditError(errMsg);
                return;
            }
            toast.success(response?.data?.msg ?? 'Case updated successfully');
            closeCaseEditModal();
            fetchCaseListForNumber(caseModalNumber, caseListPageNo);
            // Refresh main page table (not just modal)
            fetchOpenCases(pageNo, { search });
        } catch (error) {
            setCaseEditError(error?.response?.data?.error ?? 'Failed to update case. Please try again.');
        } finally {
            setCaseEditLoading(false);
        }
    }, [tokens?.token, tokens?.username, tokens?.selected_project_id, caseEditRow, caseEditName, caseEditRemark, caseEditStatus, closeCaseEditModal, fetchCaseListForNumber, caseModalNumber, caseListPageNo, fetchOpenCases, pageNo, search]);

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

            <main
                className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
                    }`}
            >
                <div className="w-full px-4 py-5">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Open cases</h1>
                            <p className="mt-1 text-sm text-slate-500">Contacts that still have at least one open case.</p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <div className="relative">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSearch(value);
                                        setPageNo(1);
                                        fetchOpenCases(1, { search: value });
                                    }}
                                    placeholder="Search name or phone"
                                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-56"
                                />
                            </div>
                            <SearchableSelect
                                value={caseNameFilter}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setCaseNameFilter(value);
                                    setPageNo(1);
                                    fetchOpenCases(1, { caseNameFilter: value });
                                }}
                                options={[
                                    { value: '', label: 'All case names' },
                                    ...(Array.isArray(defaultCaseNames) ? defaultCaseNames : []).map((name) => ({ value: name, label: name })),
                                    { value: 'others', label: 'Others' },
                                ]}
                                placeholder="All case names"
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-52"
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fetchOpenCases(pageNo, { search })}
                                    disabled={loading}
                                    title="Refresh"
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                {selectedNumbers.size > 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleBulkCloseSelected}
                                        disabled={bulkCloseLoading}
                                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-3.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                                    >
                                        <FiCheckSquare className="h-4 w-4" />
                                        {bulkCloseLoading ? 'Closing...' : `Close ${selectedNumbers.size}`}
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={openCaseCreateModal}
                                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                >
                                    <FiPlus className="h-4 w-4" />
                                    Create case
                                </button>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            <FiAlertCircle className="mt-0.5 h-4 w-4" />
                            <div>{error}</div>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="w-14 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">#</th>
                                        <th className="w-12 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage}
                                                className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" title="Select all on page" />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">Contact</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">Cases</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <TableSkeletonRows rows={8} cells={['index', 'short', 'text', 'text', 'action']} />
                                    ) : casesByNumber.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-16 text-center">
                                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                                                    <FiFileText className="h-6 w-6" />
                                                </div>
                                                <h2 className="mt-4 text-base font-semibold text-slate-900">No open cases</h2>
                                                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                                                    {search || caseNameFilter ? 'Nothing matches this search. Try another name or phone number.' : 'Open cases will show here when a contact still needs a reply.'}
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        casesByNumber.map((item, index) => {
                                            const sortedCases = Array.isArray(item.cases) && item.cases.length > 0
                                                ? [...item.cases].sort((a, b) => parseServerDate(b.modify_date || b.create_date) - parseServerDate(a.modify_date || a.create_date))
                                                : [];
                                            const latestCase = item.latest_case || sortedCases[0] || null;
                                            const contactName = (item?.contact?.name || '').toString().trim();
                                            const numberValue = (item?.number || '').toString().trim();
                                            const primaryTitle = contactName || numberValue || '-';
                                            const secondaryLine = contactName ? (numberValue || '-') : '';

                                            const isChecked = selectedNumbers.has(item.number);
                                            return (
                                                <tr
                                                    key={item.number || index}
                                                    className={`transition hover:bg-slate-50 ${isChecked ? 'bg-indigo-50/70' : ''}`}
                                                >
                                                    <td className="whitespace-nowrap px-4 py-3.5 text-center text-sm text-slate-400 sm:px-5">
                                                        {(pageNo - 1) * limit + index + 1}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center align-middle">
                                                        <input type="checkbox" checked={isChecked} onChange={() => toggleNumber(item.number)}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3.5 align-middle sm:px-5">
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate(`/live-chat/${item.number || ''}`)}
                                                            className="flex items-center gap-2 text-left group cursor-pointer"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-wide">
                                                                    {primaryTitle}
                                                                </span>
                                                                {secondaryLine ? (
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                        {secondaryLine}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3.5 align-middle sm:px-5">
                                                        {latestCase ? (
                                                            <div className="mb-2 rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-900/20 px-2.5 py-1.5">
                                                                <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Latest case</div>
                                                                <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{latestCase.name || 'Untitled Case'}</div>
                                                                <div className="text-[10px] text-gray-500 dark:text-gray-400">{formatShortDateTime(latestCase.modify_date || latestCase.create_date)}</div>
                                                            </div>
                                                        ) : sortedCases.length === 0 ? (
                                                            <div className="text-sm text-gray-700 dark:text-gray-200">-</div>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-2">
                                                                {sortedCases.map((c, idx) => {
                                                                    const caseCreateDate = c?.create_date || c?.created_at || c?.createdAt || c?.created_date;
                                                                    return (
                                                                        <div
                                                                            key={c?.case_id || c?.id || `${item.number || 'n'}-${idx}`}
                                                                            className="rounded-lg border border-indigo-100/70 dark:border-indigo-900/40 bg-gradient-to-br from-white to-indigo-50/40 dark:from-gray-900 dark:to-indigo-900/10 px-2.5 py-1.5 shadow-sm hover:shadow-md transition-shadow"
                                                                        >
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-indigo-600 text-white shadow-sm flex-shrink-0">
                                                                                    <FiFileText className="h-3 w-3" />
                                                                                </span>
                                                                                <div className="min-w-0">
                                                                                    <div className="text-xs text-gray-900 dark:text-gray-100 font-semibold truncate max-w-[120px]">
                                                                                        {c?.name || '-'}
                                                                                    </div>
                                                                                    <div className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                                                                                        <FiClock className="h-2.5 w-2.5" />
                                                                                        Open {formatOpenSince(caseCreateDate)}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                                                                                <FiCalendar className="h-3 w-3 text-indigo-500/80 flex-shrink-0" />
                                                                                <span className="font-medium text-gray-600 dark:text-gray-300">Created:</span>
                                                                                <span className="truncate">{formatShortDateTime(caseCreateDate)}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-right align-middle">
                                                        <RowActionMenu
                                                            items={[
                                                                {
                                                                    label: 'Details',
                                                                    icon: <FiEye className="w-4 h-4" />,
                                                                    onClick: () => setNumberDetail(item),
                                                                },
                                                                {
                                                                    label: 'View cases',
                                                                    icon: <FiFileText className="w-4 h-4" />,
                                                                    onClick: () => openCaseModal(item),
                                                                },
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

                        {/* Simple mobile fallback list */}
                        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-800 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                            {loading ? (
                                <div className="p-4">
                                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2 mb-2 animate-pulse" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3 mb-1 animate-pulse" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/3 animate-pulse" />
                                </div>
                            ) : casesByNumber.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                    No open cases found.
                                </div>
                            ) : (
                                casesByNumber.map((item, index) => {
                                    const sortedCases = Array.isArray(item.cases) && item.cases.length > 0
                                        ? [...item.cases].sort((a, b) => parseServerDate(b.modify_date || b.create_date) - parseServerDate(a.modify_date || a.create_date))
                                        : [];
                                    const latestCase = item.latest_case || sortedCases[0] || null;
                                    const contactName = (item?.contact?.name || '').toString().trim();
                                    const numberValue = (item?.number || '').toString().trim();
                                    const primaryTitle = contactName || numberValue || '-';
                                    const secondaryLine = contactName ? (numberValue || '-') : '';

                                    return (
                                        <div key={item.number || index} className="p-4 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-100">
                                                        {(pageNo - 1) * limit + index + 1}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                            {primaryTitle}
                                                        </div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {secondaryLine || (latestCase?.name || 'No case name')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {latestCase ? (
                                                <div className="rounded-lg border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-900/20 px-3 py-2">
                                                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Latest case</div>
                                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{latestCase.name || 'Untitled Case'}</div>
                                                    <div className="text-[11px] text-gray-500 dark:text-gray-400">{formatShortDateTime(latestCase.modify_date || latestCase.create_date)}</div>
                                                </div>
                                            ) : null}
                                            {sortedCases.length === 0 ? (
                                                <div className="text-xs text-gray-500 dark:text-gray-400">No cases</div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {sortedCases.map((c, idx) => {
                                                        const caseCreateDate = c?.create_date || c?.created_at || c?.createdAt || c?.created_date;
                                                        return (
                                                            <div
                                                                key={c?.case_id || c?.id || `${item.number || 'n'}-${idx}`}
                                                                className="rounded-xl border border-indigo-100/70 dark:border-indigo-900/40 bg-gradient-to-br from-white to-indigo-50/40 dark:from-gray-900 dark:to-indigo-900/10 px-3 py-2.5 shadow-sm"
                                                            >
                                                                <div className="flex items-start gap-2">
                                                                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-indigo-600 text-white shadow-sm flex-shrink-0">
                                                                        <FiFileText className="h-4 w-4" />
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm text-gray-900 dark:text-gray-100 font-semibold truncate">
                                                                            {c?.name || '-'}
                                                                        </div>
                                                                        <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200 px-2 py-0.5 text-[11px] font-semibold">
                                                                            <FiClock className="h-3 w-3" />
                                                                            Open {formatOpenSince(caseCreateDate)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                                    <FiCalendar className="h-3.5 w-3.5 text-indigo-500/80" />
                                                                    <span className="font-medium text-gray-600 dark:text-gray-300">Created:</span>
                                                                    <span className="truncate">{formatShortDateTime(caseCreateDate)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => openCaseModal(item)}
                                                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-700 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-900/40 hover:bg-indigo-100 hover:border-indigo-300 dark:hover:bg-indigo-900/70 transition-colors"
                                            >
                                                <FiEye className="w-3.5 h-3.5" />
                                                <span>View Cases</span>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination */}
                        {!loading && !error && total > 0 ? (
                            <>
                                <Pagination
                                    currentPage={pageNo}
                                    totalPages={Math.max(totalPage, 1)}
                                    totalRecords={total}
                                    pageSize={limit}
                                    onPageChange={handlePageChange}
                                    onPageSizeChange={(size) => {
                                        setPageNo(1);
                                        setLimit(size);
                                    }}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                />
                            </>
                        ) : null}
                    </div>
                </div>

                {/* Create Case Modal (contact picker + create form) */}
                {showCaseCreateModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">Create case</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Select a contact and create a new case.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeCaseCreateModal}
                                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    aria-label="Close"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto">
                                {/* Contact picker */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Select contact</div>
                                        {caseCreateSelectedContact?.number && (
                                            <button
                                                type="button"
                                                onClick={() => setCaseCreateSelectedContact(null)}
                                                className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
                                            >
                                                Change
                                            </button>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={caseCreateContactsQuery}
                                            onChange={(e) => {
                                                setCaseCreateContactsQuery(e.target.value);
                                                setCaseCreateContactsPage(1);
                                            }}
                                            placeholder="Search contacts..."
                                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 shadow-sm"
                                        />
                                    </div>

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                        <div className="h-60 overflow-y-auto bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                                            {String(caseCreateContactsQuery || '').trim().length === 0 ? (
                                                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                                                    Type to search contacts.
                                                </div>
                                            ) : caseCreateContactsLoading ? (
                                                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading contacts...</div>
                                            ) : caseCreateContacts.length === 0 ? (
                                                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No contacts found.</div>
                                            ) : (
                                                caseCreateContacts.map((c) => {
                                                    const active = caseCreateSelectedContact?.id === c.id;
                                                    return (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => setCaseCreateSelectedContact(c)}
                                                            className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                                                                }`}
                                                        >
                                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                                {c?.name || c?.number || '-'}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                {c?.name ? (c?.number || '-') : (c?.firm_name || '')}
                                                            </div>
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                type="button"
                                                disabled={caseCreateContactsLoading || caseCreateContactsPage <= 1}
                                                onClick={() => {
                                                    const next = Math.max(1, (caseCreateContactsPage || 1) - 1);
                                                    setCaseCreateContactsPage(next);
                                                    fetchContactsForCaseCreate(next);
                                                }}
                                                className="text-xs font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50"
                                            >
                                                Prev
                                            </button>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Page {caseCreateContactsPage} / {Math.max(caseCreateContactsTotalPages, 1)}
                                            </div>
                                            <button
                                                type="button"
                                                disabled={caseCreateContactsLoading || caseCreateContactsPage >= caseCreateContactsTotalPages}
                                                onClick={() => {
                                                    const next = Math.min(caseCreateContactsTotalPages, (caseCreateContactsPage || 1) + 1);
                                                    setCaseCreateContactsPage(next);
                                                    fetchContactsForCaseCreate(next);
                                                }}
                                                className="text-xs font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>

                                    {caseCreateSelectedContact?.number && (
                                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-900/20 px-3 py-2">
                                            <div className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Selected</div>
                                            <div className="text-sm text-emerald-900 dark:text-emerald-100 font-semibold">
                                                {caseCreateSelectedContact?.name || caseCreateSelectedContact?.number}
                                            </div>
                                            <div className="text-xs text-emerald-700 dark:text-emerald-300">
                                                {caseCreateSelectedContact?.number}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Create form (same structure as Conversation.js create case modal) */}
                                <div className="space-y-4">
                                    {caseCreateError && (
                                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                            {caseCreateError}
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                        <SearchableSelect
                                            value={caseCreateCustomNameMode ? CUSTOM_CASE_NAME_VALUE : caseCreateName}
                                            onChange={(e) => handleCaseNameSelect(e.target.value, setCaseCreateName, setCaseCreateCustomNameMode)}
                                            options={[
                                                { value: '', label: 'Select a case name' },
                                                ...caseNameOptions.map((name) => ({ value: name, label: name })),
                                                { value: CUSTOM_CASE_NAME_VALUE, label: '＋ Create new case name' },
                                            ]}
                                            placeholder="Select a case name"
                                            disabled={caseCreateLoading}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        {caseCreateCustomNameMode && (
                                            <div className="mt-2 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newCaseName}
                                                    onChange={(e) => { setNewCaseName(e.target.value); setCaseNameError(''); }}
                                                    className="min-w-0 flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    placeholder="Enter a new case name"
                                                    disabled={caseCreateLoading}
                                                    required
                                                    autoFocus
                                                />
                                                <button type="button" onClick={() => addCustomCaseName(setCaseCreateName) && setCaseCreateCustomNameMode(false)} disabled={caseCreateLoading} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">Add</button>
                                            </div>
                                        )}
                                        {caseCreateCustomNameMode && caseNameError && <p className="mt-1 text-xs text-red-600">{caseNameError}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remark</label>
                                        <textarea
                                            value={caseCreateRemark}
                                            onChange={(e) => setCaseCreateRemark(e.target.value)}
                                            rows={3}
                                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                            placeholder="Remark"
                                            disabled={caseCreateLoading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                        <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                            <button
                                                type="button"
                                                onClick={() => setCaseCreateStatus('open')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseCreateStatus === 'open'
                                                        ? 'bg-amber-500 text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                                    }`}
                                                disabled={caseCreateLoading}
                                            >
                                                Open
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCaseCreateStatus('closed')}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseCreateStatus === 'closed'
                                                        ? 'bg-green-500 text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                                    }`}
                                                disabled={caseCreateLoading}
                                            >
                                                Closed
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeCaseCreateModal}
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                                    disabled={caseCreateLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchCreateCase}
                                    disabled={caseCreateLoading || !caseCreateSelectedContact?.number}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {caseCreateLoading ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Creating...
                                        </span>
                                    ) : (
                                        'Create'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Case List Modal - table + pagination (mirrors Conversation.js) */}
                {showCaseListModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                        <FiFileText className="w-4 h-4 text-indigo-500" />
                                        Case List
                                    </h3>
                                    {caseModalNumber && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            Number: <span className="font-mono">{caseModalNumber}</span>
                                        </p>
                                    )}
                                    {caseModalContact?.name && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                                            <FiUser className="w-3 h-3" />
                                            <span>{caseModalContact.name}</span>
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={closeCaseModal}
                                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    aria-label="Close"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Filters + Bulk close */}
                            <div className="px-5 py-2.5 flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-gray-700">
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={caseListSearch}
                                    onChange={(e) => setCaseListSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchCaseListForNumber(caseModalNumber, 1, { search: caseListSearch, status: caseListStatusFilter })}
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-52"
                                />
                                <SearchableSelect
                                    value={caseListStatusFilter}
                                    onChange={(e) => {
                                        setCaseListStatusFilter(e.target.value);
                                        fetchCaseListForNumber(caseModalNumber, 1, { search: caseListSearch, status: e.target.value });
                                    }}
                                    options={[
                                        { value: '', label: 'All status' },
                                        { value: 'open', label: 'Open' },
                                        { value: 'closed', label: 'Closed' },
                                    ]}
                                    placeholder="All status"
                                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
                                />
                                <button
                                    type="button"
                                    onClick={() => fetchCaseListForNumber(caseModalNumber, 1, { search: caseListSearch, status: caseListStatusFilter })}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    Search
                                </button>
                                {selectedCaseIds.size > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleModalBulkClose}
                                        disabled={modalBulkCloseLoading}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
                                    >
                                        <FiCheckSquare className="w-3.5 h-3.5" />
                                        {modalBulkCloseLoading ? 'Closing...' : `Close ${selectedCaseIds.size} selected`}
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 overflow-auto min-h-0">
                                {caseListError && (
                                    <div className="px-6 py-4 text-sm text-red-600 dark:text-red-400">{caseListError}</div>
                                )}
                                {caseListLoading ? (
                                    <table className="w-full">
                                        <tbody><TableSkeletonRows rows={6} cells={['index', 'short', 'text', 'short', 'badge', 'action']} /></tbody>
                                    </table>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full divide-y divide-gray-200 dark:divide-gray-600">
                                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-gray-700/50 dark:to-gray-700/30">
                                                <tr>
                                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600 w-10">#</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600 w-10">
                                                        <input type="checkbox"
                                                            checked={caseList.filter(r => r.status === true || r.status === '1').length > 0 && caseList.filter(r => r.status === true || r.status === '1').every(r => selectedCaseIds.has(r.case_id ?? r.id))}
                                                            onChange={() => {
                                                                const openRows = caseList.filter(r => r.status === true || r.status === '1');
                                                                const allSel = openRows.every(r => selectedCaseIds.has(r.case_id ?? r.id));
                                                                if (allSel) setSelectedCaseIds(new Set());
                                                                else setSelectedCaseIds(new Set(openRows.map(r => r.case_id ?? r.id)));
                                                            }}
                                                            disabled={caseList.filter(r => r.status === true || r.status === '1').length === 0}
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                                                    </th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">Name</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">Create date</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200/50 dark:border-gray-600">Status</th>
                                                    <th className="w-16 px-3 py-2.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                                {caseList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="6" className="px-6 py-8 text-center">
                                                            <div className="flex flex-col items-center justify-center gap-3">
                                                                <p className="text-gray-500 dark:text-gray-400 font-medium">No cases found</p>
                                                                <p className="text-gray-400 dark:text-gray-500 text-sm">Try adjusting filters or search.</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    caseList.map((row, index) => {
                                                        const createDate = row.created_at ?? row.create_date ?? row.created_date ?? row.createdAt;
                                                        const createDateStr = createDate
                                                            ? parseServerDate(createDate)?.toLocaleDateString(undefined, {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })
                                                            : '—';
                                                        const isOpen = row.status === true || row.status === '1';
                                                        const rowId = row.case_id ?? row.id;
                                                        const isRowChecked = isOpen && selectedCaseIds.has(rowId);
                                                        return (
                                                            <tr key={rowId ?? index} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isRowChecked ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : ''}`}>
                                                                <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-center text-sm text-gray-700 dark:text-gray-300">
                                                                    {(caseListPageNo - 1) * caseListLimit + index + 1}
                                                                </td>
                                                                <td className="px-3 py-2 border-r border-gray-100 dark:border-gray-700 text-center">
                                                                    {isOpen ? (
                                                                        <input type="checkbox" checked={isRowChecked} onChange={() => toggleCaseId(rowId)}
                                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer" />
                                                                    ) : <span className="block h-3.5 w-3.5" />}
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-white">
                                                                    {row.name ?? '—'}
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
                                                                    {createDateStr}
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap border-r border-gray-100 dark:border-gray-700 text-center">
                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isOpen ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-200'}`}>
                                                                        {isOpen ? 'Open' : 'Closed'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <RowActionMenu
                                                                        items={[
                                                                            { label: 'Details', icon: <FiEye className="w-4 h-4" />, onClick: () => setCaseDetail(row) },
                                                                            { label: 'Edit', icon: <FiEdit2 className="w-4 h-4" />, onClick: () => openCaseEditModal(row) },
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
                                )}
                            </div>

                            {/* Pagination - same behavior as in Conversation.js */}
                            {!caseListLoading && caseList.length > 0 && (
                                <Pagination
                                    currentPage={caseListPageNo}
                                    totalPages={caseListTotalPage}
                                    totalRecords={caseListTotal}
                                    pageSize={caseListLimit}
                                    onPageChange={handleCaseListPageChange}
                                    onPageSizeChange={handleCaseListPageSizeChange}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                    showPageSizeSelector={true}
                                    showGoToPage={true}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Edit Case Modal - same structure as Conversation.js */}
                {showCaseEditModal && caseEditRow && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
                            <div className="flex justify-between items-center px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit case</h3>
                                <button
                                    type="button"
                                    onClick={closeCaseEditModal}
                                    className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    aria-label="Close"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="px-5 py-4 space-y-3">
                                {caseEditError && (
                                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                                        {caseEditError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Name
                                    </label>
                                    <SearchableSelect
                                        value={caseEditCustomNameMode ? CUSTOM_CASE_NAME_VALUE : caseEditName}
                                        onChange={(e) => handleCaseNameSelect(e.target.value, setCaseEditName, setCaseEditCustomNameMode)}
                                        options={[
                                            { value: '', label: 'Select a case name' },
                                            ...caseNameOptions.map((name) => ({ value: name, label: name })),
                                            { value: CUSTOM_CASE_NAME_VALUE, label: '＋ Create new case name' },
                                        ]}
                                        placeholder="Select a case name"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {caseEditCustomNameMode && (
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                type="text"
                                                value={newCaseName}
                                                onChange={(e) => { setNewCaseName(e.target.value); setCaseNameError(''); }}
                                                className="min-w-0 flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Enter a new case name"
                                                disabled={caseEditLoading}
                                                required
                                                autoFocus
                                            />
                                            <button type="button" onClick={() => addCustomCaseName(setCaseEditName) && setCaseEditCustomNameMode(false)} disabled={caseEditLoading} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">Add</button>
                                        </div>
                                    )}
                                    {caseEditCustomNameMode && caseNameError && <p className="mt-1 text-xs text-red-600">{caseNameError}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Remark
                                    </label>
                                    <textarea
                                        value={caseEditRemark}
                                        onChange={(e) => setCaseEditRemark(e.target.value)}
                                        rows={3}
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                        placeholder="Remark"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Status
                                    </label>
                                    <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                        <button
                                            type="button"
                                            onClick={() => setCaseEditStatus('open')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseEditStatus === 'open'
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            Open
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCaseEditStatus('closed')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${caseEditStatus === 'closed'
                                                ? 'bg-green-500 text-white shadow-sm'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                                }`}
                                        >
                                            Closed
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeCaseEditModal}
                                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchEditCase}
                                    disabled={caseEditLoading}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {caseEditLoading ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </span>
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <RecordDetailsModal
                    isOpen={Boolean(caseDetail)}
                    onClose={() => setCaseDetail(null)}
                    title={caseDetail?.name || 'Case'}
                    fields={caseDetail ? [
                        { label: 'Remark', value: caseDetail.remark },
                        { label: 'Status', value: caseDetail.status === true || caseDetail.status === '1' ? 'Open' : 'Closed' },
                        { label: 'Created', value: caseDetail.created_at || caseDetail.create_date || '' },
                    ] : []}
                />
                <RecordDetailsModal
                    isOpen={Boolean(numberDetail)}
                    onClose={() => setNumberDetail(null)}
                    title={numberDetail?.contact?.name || numberDetail?.number || 'Contact'}
                    subtitle={numberDetail?.contact?.name ? numberDetail.number : ''}
                    fields={numberDetail ? [
                        { label: 'Number', value: numberDetail.number },
                        { label: 'Contact', value: numberDetail.contact?.name },
                        { label: 'Open cases', value: Array.isArray(numberDetail.cases) ? numberDetail.cases.length : 0 },
                        { label: 'Latest case', value: numberDetail.latest_case?.name },
                        { label: 'Latest remark', value: numberDetail.latest_case?.remark },
                    ] : []}
                />
            </main>
        </div>
    );
}

export default OpenCaseList;

