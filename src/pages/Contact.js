import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import Tooltip from '../component/Tooltip';
import Pagination from '../component/Pagination';
import SearchableSelect from '../component/SearchableSelect';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import ExcelUpload from './Campaign/components/AudienceType/ExcelUpload';
import GoogleSheet from './Campaign/components/AudienceType/GoogleSheet';
import ContactFormModal from '../component/Modals/ContactFormModal';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import {
  FiPlus,
  FiDownload,
  FiUpload,
  FiEdit,
  FiTrash2,
  FiChevronUp,
  FiChevronDown,
  FiX,
  FiUser,
  FiMail,
  FiPhone,
  FiGlobe,
  FiHome,
  FiFileText,
  FiStar,
  FiEye,
  FiFilter,
  FiSearch,
  FiCheckCircle
} from 'react-icons/fi';

function Contact() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(20); // Default 20 items per page
  const [tokens, setTokens] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [favoriteContacts, setFavoriteContacts] = useState(new Set());
  const [contactGroups, setContactGroups] = useState([]);
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkGroupLoading, setBulkGroupLoading] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [detailContact, setDetailContact] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeletePhrase, setBulkDeletePhrase] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sortColumn, setSortColumn] = useState(null); // 'name', 'email', 'firm_name'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const navigate = useNavigate();
  const permissions = useSelector((state) => state.project.permissions);

  // Infinite list (modal-style) state (smooth scroll + accurate scrollbar using API meta)
  const USE_INFINITE_CONTACTS_LIST = true;
  const CONTACT_LIST_ROW_HEIGHT = 64; // used to estimate scrollbar position like mobile contact lists
  const [contactsMeta, setContactsMeta] = useState({
    page_no: 1,
    limit: 20,
    total_records: 0,
    total_pages: 1,
    has_more: false,
    has_more_previous: false,
    has_more_next: false
  });
  const [contactsPageNo, setContactsPageNo] = useState(1);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [firstId, setFirstId] = useState(null); // cursor for scrolling UP
  const [lastId, setLastId] = useState(null);   // cursor for scrolling DOWN
  const [scrollbarPosition, setScrollbarPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false); // thumb drag only (not loading)
  const [scrollbarMetrics, setScrollbarMetrics] = useState({ trackHeight: 0, containerHeight: 0 });
  const contactsReqIdRef = useRef(0);
  const contactsLoadingRef = useRef(false);
  const contactsLastRequestedPageRef = useRef(0);
  const contactsHasUserScrolledRef = useRef(false);
  const contactsIgnoreNextSearchEffectRef = useRef(false);
  const scrollJumpTimeoutRef = useRef(null);
  const lastFetchedPageRef = useRef(1);
  const scrollContainerRef = useRef(null);
  const scrollbarTrackRef = useRef(null);
  const scrollWindowStartIndexRef = useRef(0); // global index offset for current loaded window (jump sets this)
  const thumbDragRef = useRef(null);
  const isDraggingRef = useRef(false); // ref version to prevent position updates during drag
  const dragPositionRef = useRef(0); // visual position during drag (avoids stale closures)

  // Keep stable scrollbar sizing (thumb height) based on visible rows vs total records
  useEffect(() => {
    if (!USE_INFINITE_CONTACTS_LIST) return;
    const trackEl = scrollbarTrackRef.current;
    const containerEl = scrollContainerRef.current;
    if (!trackEl || !containerEl) return;

    const update = () => {
      const track = scrollbarTrackRef.current;
      const container = scrollContainerRef.current;
      if (!track || !container) return;
      setScrollbarMetrics({
        trackHeight: track.clientHeight || 0,
        containerHeight: container.clientHeight || 0
      });
    };

    // Ensure we measure after layout too (first paint can report 0 height)
    update();
    const rafId = requestAnimationFrame(update);

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(trackEl);
      ro.observe(containerEl);
    } else {
      window.addEventListener('resize', update);
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [USE_INFINITE_CONTACTS_LIST, contactsMeta?.total_records]);

  // Form state for creating new contact
  const [newContact, setNewContact] = useState({
    number: '',
    name: '',
    email: '',
    firm_name: '',
    website: '',
    remark: '',
    group_id: ''
  });


  // Form state for editing contact
  const [editContact, setEditContact] = useState({
    contact_id: '',
    number: '',
    name: '',
    email: '',
    firm_name: '',
    website: '',
    remark: '',
    group_id: ''
  });


  // Import state for Excel/Google Sheets
  const [importAudienceType, setImportAudienceType] = useState('excel'); // 'excel' or 'sheet'
  const [importExcelMapping, setImportExcelMapping] = useState({ name: '', phone: '' });
  const [importSheetLink, setImportSheetLink] = useState('');
  const [importExcelHeaders, setImportExcelHeaders] = useState([]);
  const [importExcelData, setImportExcelData] = useState([]);
  const [importExcelFileUrl, setImportExcelFileUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  // Load auth tokens from session
  useEffect(() => {
    try {
      const sessionData = localStorage.getItem('userData');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed && typeof parsed === 'object') {
          setTokens(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load session data:', e);
    }
  }, []);

  // Load all groups for contact assignment selectors.
  useEffect(() => {
    if (!tokens?.token || !tokens?.username) return;
    if (permissions && permissions.view_contact === false) return;

    let cancelled = false;
    const loadGroups = async () => {
      try {
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';
        const allGroups = [];
        let pageNo = 1;
        let hasMore = true;

        for (let page = 0; page < 50 && hasMore; page += 1) {
          const payload = { project_id: projectId, page_no: pageNo, limit: 100 };
          const { data, key } = Encrypt(payload);
          const response = await axios.post(`${API_BASE_URL}/contact/group-list`, JSON.stringify({ data, key }), {
            headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' }
          });
          if (response?.data?.error) break;

          const rows = response?.data?.data || [];
          allGroups.push(...rows.map(group => ({
            id: group.group_id,
            name: group.name
          })).filter(group => group.id && group.name));

          const meta = response?.data?.meta || {};
          const currentPage = Number(meta.page_no || pageNo);
          const totalPages = Number(meta.total_pages || 1);
          hasMore = meta.has_more === true || currentPage < totalPages;
          pageNo = currentPage + 1;
          if (rows.length === 0) hasMore = false;
        }

        if (!cancelled) {
          setContactGroups(Array.from(new Map(allGroups.map(group => [group.id, group])).values()));
        }
      } catch (error) {
        console.error('Failed to load contact groups:', error);
      }
    };

    loadGroups();
    return () => { cancelled = true; };
  }, [tokens?.token, tokens?.username, tokens?.selected_project_id, tokens?.projects, permissions]);

  // Legacy paginated mode - fetch from API directly
  useEffect(() => {
    if (USE_INFINITE_CONTACTS_LIST) return;
    if (!tokens?.token || !tokens?.username) return;
    if (permissions && permissions.view_contact === false) return;

    const loadContacts = async () => {
      try {
        setLoading(true);

        const payload = {
          project_id: tokens.selected_project_id || '',
          page_no: currentPage,
          limit: pageSize,
          query: searchTerm || ''
        };

        const { data, key } = Encrypt(payload);
        const data_pass = JSON.stringify({ data, key });

        const response = await axios.post(
          `${API_BASE_URL}/contact/contact-list`,
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
          const apiList = response?.data?.data || [];
          const apiMeta = response?.data?.meta || null;

          const mapped = apiList.map(c => ({
            id: c.contact_id,
            name: c.name,
            mobile: c.number,
            email: c.email,
            firm_name: c.firm_name,
            website: c.website,
            remark: c.remark,
            languageCode: c.language_code,
            country: c.country,
            createdOn: c.create_date,
            is_favorite: c.is_favorite || false
          }));

          const favorites = new Set(mapped.filter(c => c.is_favorite).map(c => c.id));
          setFavoriteContacts(favorites);
          setContacts(mapped);

          if (apiMeta) {
            setTotalPages(apiMeta.total_pages > 0 ? apiMeta.total_pages : 1);
            setTotalRecords(apiMeta.total_records || 0);
          }
        } else {
          console.warn('⚠️ API returned error:', response?.data?.message);
          setContacts([]);
          setTotalPages(1);
          setTotalRecords(0);
        }
      } catch (error) {
        console.error('❌ Error loading contacts:', error);
        setContacts([]);
        setTotalPages(1);
        setTotalRecords(0);
      } finally {
        setLoading(false);
        setSelectedContacts([]);
        setIsAllSelected(false);
      }
    };

    loadContacts();
  }, [USE_INFINITE_CONTACTS_LIST, tokens?.token, tokens?.username, tokens?.selected_project_id, currentPage, pageSize, searchTerm, permissions]);

  // Load contacts with page-based pagination (for scrollbar jumps)
  const loadContactsPage = useCallback(
    async ({ requestedPageNo, query, append, isFavoriteOnly }) => {
      if (!tokens?.token || !tokens?.username) return;
      if (permissions && permissions.view_contact === false) return;
      if (contactsLoadingRef.current) return;

      const projectId = tokens.selected_project_id || '';
      const reqId = ++contactsReqIdRef.current;

      try {
        contactsLoadingRef.current = true;
        setContactsLoading(true);

        const payload = {
          project_id: projectId,
          page_no: requestedPageNo,
          limit: pageSize,
          query: query || '',
          ...(isFavoriteOnly ? { is_favorite_only: true } : {})
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

        // ignore stale results
        if (reqId !== contactsReqIdRef.current) return;

        if (!response?.data?.error) {
          const apiList = response?.data?.data || [];
          const meta = response?.data?.meta || null;
          const responseFirstId = response?.data?.first_id || null;
          const responseLastId = response?.data?.last_id || null;

          const mapped = apiList.map((c) => ({
            id: c.contact_id,
            name: c.name,
            mobile: c.number,
            email: c.email,
            firm_name: c.firm_name,
            website: c.website,
            remark: c.remark,
            languageCode: c.language_code,
            country: c.country,
            createdOn: c.create_date,
            is_favorite: c.is_favorite || false
          }));

          // Replace contacts entirely for page jump, append for infinite scroll
          setContacts((prev) => {
            const next = append ? [...prev, ...mapped] : mapped;
            const seen = new Set();
            return next.filter((row) => {
              if (!row?.id) return false;
              if (seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            });
          });

          // Update favorites
          if (append) {
            setFavoriteContacts((prev) => {
              const next = new Set(prev);
              for (const row of mapped) {
                if (row?.id && row.is_favorite) next.add(row.id);
              }
              return next;
            });
          } else {
            setFavoriteContacts(new Set(mapped.filter(c => c.is_favorite).map(c => c.id)));
          }

          const fallbackTotalRecords =
            meta?.total_records ??
            response?.data?.total_records ??
            response?.data?.count ??
            (append ? undefined : mapped.length);

          const totalPagesFallback =
            meta?.total_pages ??
            response?.data?.total_pages ??
            (typeof fallbackTotalRecords === 'number'
              ? Math.max(1, Math.ceil(fallbackTotalRecords / pageSize))
              : 1);

          const hasMoreFallback =
            meta?.has_more ??
            response?.data?.has_more ??
            (meta?.page_no
              ? meta.page_no < (meta.total_pages || totalPagesFallback)
              : requestedPageNo < totalPagesFallback);

          // Extract bidirectional flags
          const hasMorePrevious = response?.data?.has_more_previous ?? false;
          const hasMoreNext = response?.data?.has_more_next ?? hasMoreFallback;

          setContactsMeta({
            page_no: meta?.page_no ?? requestedPageNo,
            limit: meta?.limit ?? pageSize,
            total_records: meta?.total_records ?? response?.data?.total_records ?? (fallbackTotalRecords || 0),
            total_pages: totalPagesFallback,
            has_more: hasMoreFallback,
            has_more_previous: hasMorePrevious,
            has_more_next: hasMoreNext
          });
          setContactsPageNo(meta?.page_no ?? requestedPageNo);
          setCurrentPage(meta?.page_no ?? requestedPageNo);
          setTotalRecords(meta?.total_records ?? response?.data?.total_records ?? (fallbackTotalRecords || 0));
          setTotalPages(totalPagesFallback);

          // Update cursor IDs for bidirectional pagination
          if (responseFirstId) {
            setFirstId(responseFirstId);
          }
          if (responseLastId) {
            setLastId(responseLastId);
          }

          // Update scrollbar position for page-based loads - skip if user is dragging
          scrollWindowStartIndexRef.current = Math.max(0, (requestedPageNo - 1) * pageSize);
          if (!isDraggingRef.current && !append) {
            if (requestedPageNo === 1) {
              setScrollbarPosition(0);
            } else {
              const totalPages = meta?.total_pages ?? totalPagesFallback;
              const position = totalPages > 0 ? (((requestedPageNo - 1) / (totalPages - 1)) * 100) : 0;
              setScrollbarPosition(Math.min(position, 100));
            }
          }
        } else {
          console.warn('⚠️ contact-list API returned error:', response?.data?.message);
          if (!append) {
            setContacts([]);
            setContactsMeta({
              page_no: 1,
              limit: pageSize,
              total_records: 0,
              total_pages: 1,
              has_more: false,
              has_more_previous: false,
              has_more_next: false
            });
            setContactsPageNo(1);
            setCurrentPage(1);
            setTotalRecords(0);
            setTotalPages(1);
            setFirstId(null);
            setLastId(null);
            scrollWindowStartIndexRef.current = 0;
          }
        }
      } catch (error) {
        console.error('❌ Error loading contacts:', error);
        if (!append) {
          setContacts([]);
          setContactsMeta({
            page_no: 1,
            limit: pageSize,
            total_records: 0,
            total_pages: 1,
            has_more: false,
            has_more_previous: false,
            has_more_next: false
          });
          setContactsPageNo(1);
          setCurrentPage(1);
          setTotalRecords(0);
          setTotalPages(1);
          setFirstId(null);
          setLastId(null);
          scrollWindowStartIndexRef.current = 0;
        }
      } finally {
        if (reqId === contactsReqIdRef.current) {
          setContactsLoading(false);
          contactsLoadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [
      tokens?.token,
      tokens?.username,
      tokens?.selected_project_id,
      permissions,
      pageSize
    ]
  );

  // Load more contacts with cursor-based pagination (for infinite scroll via mouse wheel)
  const loadMoreContacts = useCallback(
    async (query, isFavoriteOnly) => {
      if (!tokens?.token || !tokens?.username) return;
      if (permissions && permissions.view_contact === false) return;
      if (contactsLoadingRef.current || !lastId || !contactsMeta.has_more) return;

      const projectId = tokens.selected_project_id || '';
      const reqId = ++contactsReqIdRef.current;

      try {
        contactsLoadingRef.current = true;
        setContactsLoading(true);

        const payload = {
          project_id: projectId,
          last_id: lastId,
          limit: pageSize,
          query: query || '',
          ...(isFavoriteOnly ? { is_favorite_only: true } : {})
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

        // ignore stale results
        if (reqId !== contactsReqIdRef.current) return;

        if (!response?.data?.error) {
          const apiList = response?.data?.data || [];
          const meta = response?.data?.meta || null;
          const responseFirstId = response?.data?.first_id || null;
          const responseLastId = response?.data?.last_id || null;

          const mapped = apiList.map((c) => ({
            id: c.contact_id,
            name: c.name,
            mobile: c.number,
            email: c.email,
            firm_name: c.firm_name,
            website: c.website,
            remark: c.remark,
            languageCode: c.language_code,
            country: c.country,
            createdOn: c.create_date,
            is_favorite: c.is_favorite || false
          }));

          // Append new contacts at the END (dedupe)
          setContacts((prev) => {
            const next = [...prev, ...mapped];
            const seen = new Set();
            return next.filter((row) => {
              if (!row?.id) return false;
              if (seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            });
          });

          // Update favorites
          setFavoriteContacts((prev) => {
            const next = new Set(prev);
            for (const row of mapped) {
              if (row?.id && row.is_favorite) next.add(row.id);
            }
            return next;
          });

          // Update cursor IDs
          if (responseFirstId && !firstId) {
            // Only set firstId if we don't have one yet
            setFirstId(responseFirstId);
          }
          if (responseLastId) {
            setLastId(responseLastId);
          }

          // Update meta with bidirectional flags
          const hasMore = meta?.has_more ?? response?.data?.has_more ?? (apiList.length === pageSize);
          const hasMoreNext = response?.data?.has_more_next ?? hasMore;
          const hasMorePrevious = response?.data?.has_more_previous ?? contactsMeta.has_more_previous;

          setContactsMeta((prev) => ({
            ...prev,
            has_more: hasMore,
            has_more_next: hasMoreNext,
            has_more_previous: hasMorePrevious,
            page_no: meta?.page_no ?? prev.page_no + 1,
            total_records: meta?.total_records ?? response?.data?.total_records ?? prev.total_records,
            total_pages: meta?.total_pages ?? response?.data?.total_pages ?? prev.total_pages
          }));
        } else {
          console.warn('⚠️ contact-list API returned error:', response?.data?.message);
        }
      } catch (error) {
        console.error('❌ Error loading more contacts:', error);
      } finally {
        if (reqId === contactsReqIdRef.current) {
          setContactsLoading(false);
          contactsLoadingRef.current = false;
        }
      }
    },
    [
      tokens?.token,
      tokens?.username,
      tokens?.selected_project_id,
      permissions,
      pageSize,
      lastId,
      contactsMeta.has_more,
      contactsMeta.has_more_previous,
      firstId
    ]
  );

  // Load previous contacts (scroll UP) with cursor-based pagination
  const loadPreviousContacts = useCallback(
    async (query, isFavoriteOnly) => {
      if (!tokens?.token || !tokens?.username) return;
      if (permissions && permissions.view_contact === false) return;
      if (contactsLoadingRef.current || !firstId || !contactsMeta.has_more_previous) return;

      const projectId = tokens.selected_project_id || '';
      const reqId = ++contactsReqIdRef.current;

      try {
        contactsLoadingRef.current = true;
        setContactsLoading(true);

        const payload = {
          project_id: projectId,
          first_id: firstId,
          limit: pageSize,
          query: query || '',
          ...(isFavoriteOnly ? { is_favorite_only: true } : {})
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

        // ignore stale results
        if (reqId !== contactsReqIdRef.current) return;

        if (!response?.data?.error) {
          const apiList = response?.data?.data || [];
          const meta = response?.data?.meta || null;
          const responseFirstId = response?.data?.first_id || null;
          const responseLastId = response?.data?.last_id || null;

          const mapped = apiList.map((c) => ({
            id: c.contact_id,
            name: c.name,
            mobile: c.number,
            email: c.email,
            firm_name: c.firm_name,
            website: c.website,
            remark: c.remark,
            languageCode: c.language_code,
            country: c.country,
            createdOn: c.create_date,
            is_favorite: c.is_favorite || false
          }));

          // Get current scroll position before prepending
          const scrollContainer = scrollContainerRef.current;
          const previousScrollHeight = scrollContainer?.scrollHeight || 0;

          // Prepend new contacts at the BEGINNING (dedupe)
          setContacts((prev) => {
            const next = [...mapped, ...prev];
            const seen = new Set();
            return next.filter((row) => {
              if (!row?.id) return false;
              if (seen.has(row.id)) return false;
              seen.add(row.id);
              return true;
            });
          });

          // Update favorites
          setFavoriteContacts((prev) => {
            const next = new Set(prev);
            for (const row of mapped) {
              if (row?.id && row.is_favorite) next.add(row.id);
            }
            return next;
          });

          // Update cursor IDs
          if (responseFirstId) {
            setFirstId(responseFirstId);
          }
          if (responseLastId && !lastId) {
            // Only set lastId if we don't have one yet
            setLastId(responseLastId);
          }

          // Update scrollWindowStartIndexRef to reflect new starting position
          scrollWindowStartIndexRef.current = Math.max(0, scrollWindowStartIndexRef.current - mapped.length);

          // Update meta with bidirectional flags
          const hasMorePrevious = response?.data?.has_more_previous ?? false;
          const hasMoreNext = response?.data?.has_more_next ?? contactsMeta.has_more_next;

          setContactsMeta((prev) => ({
            ...prev,
            has_more_previous: hasMorePrevious,
            has_more_next: hasMoreNext,
            page_no: Math.max(1, (meta?.page_no ?? prev.page_no) - 1),
            total_records: meta?.total_records ?? response?.data?.total_records ?? prev.total_records,
            total_pages: meta?.total_pages ?? response?.data?.total_pages ?? prev.total_pages
          }));

          // Maintain scroll position after prepending content
          requestAnimationFrame(() => {
            if (scrollContainer) {
              const newScrollHeight = scrollContainer.scrollHeight;
              const addedHeight = newScrollHeight - previousScrollHeight;
              scrollContainer.scrollTop = scrollContainer.scrollTop + addedHeight;
            }
          });
        } else {
          console.warn('⚠️ contact-list API returned error:', response?.data?.message);
        }
      } catch (error) {
        console.error('❌ Error loading previous contacts:', error);
      } finally {
        if (reqId === contactsReqIdRef.current) {
          setContactsLoading(false);
          contactsLoadingRef.current = false;
        }
      }
    },
    [
      tokens?.token,
      tokens?.username,
      tokens?.selected_project_id,
      permissions,
      pageSize,
      firstId,
      contactsMeta.has_more_previous,
      contactsMeta.has_more_next,
      lastId
    ]
  );

  const resetAndLoadContacts = useCallback(
    async (query, isFavoriteOnly) => {
      contactsReqIdRef.current += 1; // invalidate any in-flight
      contactsLoadingRef.current = false;
      contactsLastRequestedPageRef.current = 1;
      contactsHasUserScrolledRef.current = false;
      lastFetchedPageRef.current = 1;
      if (scrollJumpTimeoutRef.current) {
        clearTimeout(scrollJumpTimeoutRef.current);
        scrollJumpTimeoutRef.current = null;
      }
      setContacts([]);
      setContactsMeta({
        page_no: 1,
        limit: pageSize,
        total_records: 0,
        total_pages: 1,
        has_more: false,
        has_more_previous: false,
        has_more_next: false
      });
      setContactsPageNo(1);
      setCurrentPage(1);
      setFirstId(null);
      setLastId(null);
      setScrollbarPosition(0);
      dragPositionRef.current = 0;
      scrollWindowStartIndexRef.current = 0;
      setSelectedContacts([]);
      setIsAllSelected(false);
      setLoading(true);
      await loadContactsPage({
        requestedPageNo: 1,
        query,
        append: false,
        isFavoriteOnly
      });
      // Reset scroll position
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    },
    [loadContactsPage, pageSize]
  );

  // Initial load (infinite list mode)
  useEffect(() => {
    if (!USE_INFINITE_CONTACTS_LIST) return;
    if (!tokens?.token || !tokens?.username) return;
    if (permissions && permissions.view_contact === false) return;
    contactsIgnoreNextSearchEffectRef.current = true;
    resetAndLoadContacts('', showFavoritesOnly);
  }, [
    USE_INFINITE_CONTACTS_LIST,
    tokens?.token,
    tokens?.username,
    permissions,
    pageSize,
    reloadTick
  ]);

  // Debounced server-side search
  useEffect(() => {
    if (!USE_INFINITE_CONTACTS_LIST) return;
    if (contactsIgnoreNextSearchEffectRef.current) {
      contactsIgnoreNextSearchEffectRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      resetAndLoadContacts(searchTerm, showFavoritesOnly);
    }, 350);
    return () => clearTimeout(t);
  }, [USE_INFINITE_CONTACTS_LIST, searchTerm, showFavoritesOnly, resetAndLoadContacts]);



  // Handle create contact
  const handleCreateContact = async (formData, fullNumber, country) => {
    if (permissions && permissions.create_contact === false) {
      alert('You do not have permission to create contacts.');
      return;
    }
    if (!tokens?.token || !tokens?.username) return;

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        ...formData
      };

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/create-contact`,
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
        // Close modal
        setShowCreateModal(false);

        // Refresh contacts list immediately - go to page 1 to show new contact
        setCurrentPage(1);
        setReloadTick((t) => t + 1);

        // Show success toast
        const successMsg = response?.data?.msg || 'Contact created successfully';
        toast.success(successMsg, {
          duration: 3000,
          icon: '✓'
        });
      } else {
        toast.error('Failed to create contact: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create contact:', error);
      toast.error('Failed to create contact. Please try again.');
    }
  };

  // Handle opening edit modal
  const handleOpenEditModal = (contact) => {
    if (permissions && permissions.edit_contact === false) {
      alert('You do not have permission to edit contacts.');
      return;
    }
    console.log('🔧 Opening edit modal for contact:', contact);
    setEditingContact(contact);
    setEditContact({
      contact_id: contact.id || contact.contact_id,
      number: contact.mobile || contact.number,
      name: contact.name,
      email: contact.email || '',
      firm_name: contact.firm_name || '',
      website: contact.website || '',
      remark: contact.remark || '',
      groups: contact.groups || [],
      group_ids: contact.group_ids || [],
      group_id: contact.group_id || ''
    });
    setShowEditModal(true);
  };

  // Handle update contact
  const handleUpdateContact = async (formData, fullNumber, country) => {
    if (permissions && permissions.edit_contact === false) {
      alert('You do not have permission to edit contacts.');
      return;
    }
    if (!tokens?.token || !tokens?.username || !editContact.contact_id) return;

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        contact_id: editContact.contact_id,
        ...formData
      };

      console.log('📤 Sending update payload:', payload);

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/update-contact`,
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
        if (formData.group_id) {
          const groupResponse = await assignContactToGroup(editContact.contact_id, formData.group_id);
          if (!groupResponse) {
            toast.error('Contact updated, but it could not be added to the selected group.');
          }
        }
        // Close modal
        setShowEditModal(false);
        setEditingContact(null);

        // Refresh contacts list
        setReloadTick((t) => t + 1);

        // Show success toast
        const successMsg = response?.data?.msg || 'Contact updated successfully';
        toast.success(successMsg, {
          duration: 3000,
          icon: '✓'
        });
      } else {
        toast.error('Failed to update contact: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update contact:', error);
      toast.error('Failed to update contact. Please try again.');
    }
  };

  const assignContactToGroup = async (contactId, groupId) => {
    if (!tokens?.token || !tokens?.username || !contactId || !groupId) return false;
    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        group_id: groupId,
        contact_id: contactId
      };
      const { data, key } = Encrypt(payload);
      const response = await axios.post(
        `${API_BASE_URL}/contact/group-contact-add`,
        JSON.stringify({ data, key }),
        { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } }
      );
      return response?.data?.error === false;
    } catch (error) {
      console.error('Failed to add contact to group:', error);
      return false;
    }
  };

  const handleBulkAddToGroup = async () => {
    if (!bulkGroupId || selectedContacts.length === 0) return;
    if (!tokens?.token || !tokens?.username) return;

    setBulkGroupLoading(true);
    try {
      const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';
      const payload = {
        project_id: projectId,
        group_ids: [bulkGroupId],
        contact_ids: selectedContacts
      };
      const { data, key } = Encrypt(payload);
      const response = await axios.post(
        `${API_BASE_URL}/contact/group-contact-add-bulk`,
        JSON.stringify({ data, key }),
        { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } }
      );

      if (!response?.data?.error) {
        const msg = response?.data?.msg || `${selectedContacts.length} contact(s) added to the selected group.`;
        toast.success(msg);
        const targetGroup = contactGroups.find(g => String(g.id) === String(bulkGroupId));
        const groupName = targetGroup ? targetGroup.name : 'Group';
        const targetId = bulkGroupId;
        setBulkGroupId('');
        setSelectedContacts([]);
        setIsAllSelected(false);
        setReloadTick((t) => t + 1);
        navigate(`/contact-group-list?group_id=${targetId}&group_name=${encodeURIComponent(groupName)}`);
      } else {
        toast.error(response?.data?.error || response?.data?.msg || 'Failed to add contacts to group');
      }
    } catch (error) {
      console.error('Failed to bulk add contacts to group:', error);
      toast.error('Failed to add contacts to group');
    } finally {
      setBulkGroupLoading(false);
    }
  };

  // Handle import contacts
  const handleImportContacts = async () => {
    if (permissions && permissions.create_contact === false) {
      alert('You do not have permission to import contacts.');
      return;
    }
    if (!tokens?.token || !tokens?.username) return;

    // Validate that we have the required data
    if (!importExcelMapping.phone || !importExcelMapping.name) {
      alert('Please map the phone number and name columns before importing.');
      return;
    }

    let fileUrl;
    if (importAudienceType === 'excel') {
      fileUrl = importExcelFileUrl;
      if (!fileUrl || !fileUrl.startsWith('http')) {
        alert('Please upload an Excel file first.');
        return;
      }
    } else {
      // Google Sheet
      fileUrl = importSheetLink;
      if (!fileUrl || !fileUrl.trim()) {
        alert('Please provide a Google Sheet link.');
        return;
      }
    }

    // Get column indices from headers (0-based)
    const phoneIndex = importExcelHeaders.indexOf(importExcelMapping.phone);
    const nameIndex = importExcelHeaders.indexOf(importExcelMapping.name);

    if (phoneIndex < 0) {
      alert('Phone number column not found in headers.');
      return;
    }

    // Find optional column indices
    const emailIndex = importExcelHeaders.findIndex(h =>
      h.toLowerCase().includes('email') || h.toLowerCase().includes('e-mail')
    );
    const firmNameIndex = importExcelHeaders.findIndex(h =>
      h.toLowerCase().includes('firm') || h.toLowerCase().includes('company') || h.toLowerCase().includes('organization')
    );
    const websiteIndex = importExcelHeaders.findIndex(h =>
      h.toLowerCase().includes('website') || h.toLowerCase().includes('url') || h.toLowerCase().includes('web')
    );
    const remarkIndex = importExcelHeaders.findIndex(h =>
      h.toLowerCase().includes('remark') || h.toLowerCase().includes('note') || h.toLowerCase().includes('comment')
    );

    setIsImporting(true);

    try {
      // Build payload
      const payload = {
        project_id: tokens.selected_project_id || '',
        url: fileUrl.trim(),
        number_index: phoneIndex,
        name_index: nameIndex >= 0 ? nameIndex : 0,
        start_row: 1, // Skip header row
        end_row: importExcelData.length > 0 ? importExcelData.length : null
      };

      // Add optional fields only if found
      if (emailIndex >= 0) {
        payload.email_index = emailIndex;
      }
      if (firmNameIndex >= 0) {
        payload.firm_name_index = firmNameIndex;
      }
      if (websiteIndex >= 0) {
        payload.website_index = websiteIndex;
      }
      if (remarkIndex >= 0) {
        payload.remark_index = remarkIndex;
      }

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/import-contacts`,
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
        // Close modal and reset state
        setShowImportModal(false);
        setImportAudienceType('excel');
        setImportExcelMapping({ name: '', phone: '' });
        setImportSheetLink('');
        setImportExcelHeaders([]);
        setImportExcelData([]);
        setImportExcelFileUrl('');

        // Refresh contacts list
        setCurrentPage(1);
        setReloadTick((t) => t + 1);

        // Show success message with import statistics
        const importData = response?.data?.data || {};
        const successMsg = response?.data?.msg || 'Contacts imported successfully';
        const statsMsg = importData.total
          ? `${successMsg}\n\nTotal: ${importData.total}\nSuccess: ${importData.success}\nFailed: ${importData.failed}\nDuplicates: ${importData.duplicates}${importData.error_file ? `\n\nError file: ${importData.error_file}` : ''}`
          : successMsg;

        setSuccessMessage(statsMsg);
        setShowSuccessModal(true);
      } else {
        const errorMsg = response?.data?.error || response?.data?.message || 'Unknown error';
        alert('Failed to import contacts: ' + errorMsg);
      }
    } catch (error) {
      console.error('Failed to import contacts:', error);
      const errorMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Please try again.';
      alert('Failed to import contacts: ' + errorMsg);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle favorite contact toggle
  const handleToggleFavorite = async (contact) => {
    if (!tokens?.token || !tokens?.username) return;

    const isFavorite = favoriteContacts.has(contact.id);
    const action = isFavorite ? 'delete' : 'add';

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        number: contact.mobile,
        action: action
      };

      console.log('⭐ Toggling favorite:', { contact: contact.name, action, payload });

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/mark-as-favorite`,
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
        // Update local favorite state
        const newFavorites = new Set(favoriteContacts);
        const isFavorite = response?.data?.is_favorite || action === 'add';

        if (isFavorite) {
          newFavorites.add(contact.id);
          toast.success(`${contact.name} added to favorites`);
        } else {
          newFavorites.delete(contact.id);
          toast.success(`${contact.name} removed from favorites`);
        }
        setFavoriteContacts(newFavorites);
      } else {
        toast.error('Failed to update favorite status: ' + (response?.data?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast.error('Failed to update favorite status. Please try again.');
    }
  };

  // Handle delete contact - opens confirmation modal
  const handleDeleteContact = (contact) => {
    if (permissions && permissions.delete_contact === false) {
      toast.error('You do not have permission to delete contacts.');
      return;
    }
    setContactToDelete(contact);
    setShowDeleteModal(true);
  };

  // Confirm and execute delete
  const confirmDeleteContact = async () => {
    if (!tokens?.token || !tokens?.username || !contactToDelete) return;

    setIsDeleting(true);

    try {
      const payload = {
        all_contact_delete: false,
        contact_ids: [contactToDelete.id],
        numbers: [contactToDelete.mobile],
        project_id: tokens.selected_project_id || ''
      };

      console.log('🗑️ Deleting contact:', payload);

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/delete-contact`,
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
        // Refresh contacts list
        setReloadTick((t) => t + 1);

        // Update selected contacts
        setSelectedContacts(prev => prev.filter(id => id !== contactToDelete.id));
        setIsAllSelected(false);

        // Close modal
        setShowDeleteModal(false);
        setContactToDelete(null);

        // Show success toast
        const successMsg = response?.data?.msg || 'Contact deleted successfully';
        toast.success(successMsg);
      } else {
        toast.error('Failed to delete contact: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast.error('Failed to delete contact. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete
  const cancelDeleteContact = () => {
    setShowDeleteModal(false);
    setContactToDelete(null);
  };

  const handleOpenBulkDeleteAllContacts = () => {
    if (permissions && permissions.delete_contact === false) {
      alert('You do not have permission to delete contacts.');
      return;
    }
    if (!isAllSelected) return;
    setBulkDeletePhrase('');
    setBulkDeleteError('');
    setShowBulkDeleteModal(true);
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteModal(false);
    setBulkDeletePhrase('');
    setBulkDeleteError('');
  };

  const confirmBulkDelete = async () => {
    if (!tokens?.token || !tokens?.username || !tokens?.selected_project_id) return;
    if (bulkDeletePhrase.trim() !== 'all-delete') {
      setBulkDeleteError("Type 'all-delete' to confirm deleting ALL contacts.");
      return;
    }

    setIsBulkDeleting(true);
    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        all_contact_delete: true
      };

      console.log('🗑️ Bulk delete payload:', payload);

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/delete-contact`,
        data_pass,
        {
          headers: {
            token: tokens.token,
            username: tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response?.data?.error) {
        setContacts([]);
        setTotalPages(1);
        setTotalRecords(0);
        setCurrentPage(1);
        setFavoriteContacts(new Set());
        setSelectedContacts([]);
        setIsAllSelected(false);
        setContactsMeta({
          page_no: 1,
          limit: pageSize,
          total_records: 0,
          total_pages: 1,
          has_more: false,
          has_more_previous: false,
          has_more_next: false
        });
        setFirstId(null);
        setLastId(null);
        setScrollbarPosition(0);

        setShowBulkDeleteModal(false);
        setBulkDeletePhrase('');
        setBulkDeleteError('');

        const successMsg = response?.data?.msg || 'All contacts deleted successfully';
        setSuccessMessage(successMsg);
        setShowSuccessModal(true);
      } else {
        alert('Failed to delete contacts: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to bulk delete contacts:', error);
      alert('Failed to delete contacts. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };


  // Handle export to Excel - opens confirmation modal
  const handleExportToExcel = () => {
    if (contacts.length === 0) {
      alert('No contacts to export');
      return;
    }
    setShowExportModal(true);
  };

  // Confirm and execute export
  const confirmExportContacts = async () => {
    if (!tokens?.token || !tokens?.username) return;

    setIsExporting(true);

    try {
      const payload = {
        project_id: tokens.selected_project_id || '',
        type: 'excel'
      };

      console.log('📤 Exporting contacts:', payload);

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/contact/export-contacts`,
        data_pass,
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response?.data?.error && response?.data?.url) {
        // Download the file from the URL
        const downloadUrl = response.data.url;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', '');
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Close export modal
        setShowExportModal(false);

        // Show success message
        const successMsg = response?.data?.msg || 'Contacts exported successfully';
        setSuccessMessage(successMsg);
        setShowSuccessModal(true);
      } else {
        alert('Failed to export contacts: ' + (response?.data?.message || response?.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to export contacts:', error);
      alert('Failed to export contacts. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Cancel export
  const cancelExportContacts = () => {
    setShowExportModal(false);
  };

  // Handle toggle favorites only with API sync
  const handleToggleFavoritesOnly = async () => {
    const newShowFavoritesOnly = !showFavoritesOnly;
    setShowFavoritesOnly(newShowFavoritesOnly);

    if (USE_INFINITE_CONTACTS_LIST) {
      setLoadingFavorites(true);
      try {
        // Avoid double-fetch with the debounced search effect
        contactsIgnoreNextSearchEffectRef.current = true;
        await resetAndLoadContacts(searchTerm, newShowFavoritesOnly);
      } finally {
        setLoadingFavorites(false);
      }
      return;
    }

    // If switching to favorites view, fetch from API in background
    if (newShowFavoritesOnly && tokens?.token && tokens?.username) {
      setLoadingFavorites(true);
      try {
        const payload = {
          project_id: tokens.selected_project_id || '',
          page_no: currentPage,
          limit: pageSize,
          query: '',
          is_favorite_only: true
        };

        console.log('⭐ Fetching favorites from API:', payload);

        const { data, key } = Encrypt(payload);
        const data_pass = JSON.stringify({ data, key });

        const response = await axios.post(
          `${API_BASE_URL}/contact/contact-list`,
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
          const apiList = response?.data?.data || [];
          console.log(`📥 Received ${apiList.length} favorite contacts from API`);

          // Update favorites set from API response
          const apiFavoriteIds = new Set(apiList.map(c => c.contact_id));
          setFavoriteContacts(apiFavoriteIds);

          console.log('✅ Favorites synced from API');
        } else {
          console.warn('⚠️ API returned error:', response?.data?.message);
        }
      } catch (error) {
        console.error('❌ Error fetching favorites from API:', error);
      } finally {
        setLoadingFavorites(false);
      }
    }
  };

  // Handle select all contacts
  const handleSelectAll = () => {
    const visibleContacts = showFavoritesOnly
      ? contacts.filter(c => favoriteContacts.has(c.id))
      : contacts;

    if (isAllSelected) {
      setSelectedContacts([]);
      setIsAllSelected(false);
    } else {
      setSelectedContacts(visibleContacts.map(c => c.id));
      setIsAllSelected(visibleContacts.length > 0);
    }
  };

  // Handle individual contact selection
  const handleSelectContact = (contactId) => {
    const visibleContacts = showFavoritesOnly
      ? contacts.filter(c => favoriteContacts.has(c.id))
      : contacts;

    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
      setIsAllSelected(false);
    } else {
      const newSelected = [...selectedContacts, contactId];
      setSelectedContacts(newSelected);
      setIsAllSelected(visibleContacts.length > 0 && newSelected.length === visibleContacts.length);
    }
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
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

  const filteredContacts = useMemo(() => {
    // Safety net filter (in infinite mode, API may already return favorites-only)
    return showFavoritesOnly
      ? contacts.filter((contact) => favoriteContacts.has(contact.id))
      : contacts;
  }, [contacts, favoriteContacts, showFavoritesOnly]);

  const sortedContacts = useMemo(() => {
    if (!sortColumn) return filteredContacts;
    return [...filteredContacts].sort((a, b) => {
      let aValue = a[sortColumn] || '';
      let bValue = b[sortColumn] || '';

      // Convert to string and handle empty values
      aValue = String(aValue).toLowerCase().trim();
      bValue = String(bValue).toLowerCase().trim();

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
  }, [filteredContacts, sortColumn, sortDirection]);

  // Calculate display info for infinite scroll
  const totalFromApi = contactsMeta?.total_records || 0;
  const currentDisplayPage = contactsMeta?.page_no || 1;

  // Scroll handler: infinite scroll + scrollbar position tracking
  const handleContactsScroll = useCallback(
    (e) => {
      if (!USE_INFINITE_CONTACTS_LIST) return;
      if (isDragging) return; // Don't trigger infinite scroll while dragging scrollbar

      const el = e.currentTarget;
      if (!el) return;

      if (el.scrollTop > 0) contactsHasUserScrolledRef.current = true;
      if (!contactsHasUserScrolledRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = el;

      // Mobile-like scrollbar position (0-100%) mapped to GLOBAL list size
      const total = contactsMeta?.total_records || 0;
      if (total > 1) {
        const visibleIndex = Math.max(0, Math.floor(scrollTop / CONTACT_LIST_ROW_HEIGHT));
        const globalIndex = Math.max(0, scrollWindowStartIndexRef.current + visibleIndex);
        const pos = (globalIndex / (total - 1)) * 100;
        setScrollbarPosition(Math.max(0, Math.min(pos, 100)));
      } else {
        setScrollbarPosition(0);
      }

      // Load more when near bottom (scroll DOWN) - 90% threshold
      if (scrollTop + clientHeight >= scrollHeight * 0.9 && contactsMeta.has_more_next && !contactsLoadingRef.current) {
        loadMoreContacts(searchTerm, showFavoritesOnly);
      }

      // Load previous when near top (scroll UP) - 10% threshold
      if (scrollTop <= scrollHeight * 0.1 && contactsMeta.has_more_previous && !contactsLoadingRef.current) {
        loadPreviousContacts(searchTerm, showFavoritesOnly);
      }
    },
    [
      USE_INFINITE_CONTACTS_LIST,
      isDragging,
      contactsMeta.has_more_next,
      contactsMeta.has_more_previous,
      contactsMeta?.total_records,
      loadMoreContacts,
      loadPreviousContacts,
      searchTerm,
      showFavoritesOnly,
      CONTACT_LIST_ROW_HEIGHT
    ]
  );

  // Scrollbar drag handler: jump to specific position
  const handleScrollbarDrag = useCallback(
    async (position) => {
      // position is 0-100 (percentage)
      if (!tokens?.token || !tokens?.username) return;
      if (permissions && permissions.view_contact === false) return;
      if (contactsLoadingRef.current) return;

      setContactsLoading(true);
      contactsLoadingRef.current = true;

      try {
        // Calculate which page to load based on scrollbar position
        const totalPages = contactsMeta.total_pages || 1;
        const targetPage = Math.ceil((position / 100) * totalPages);
        const clampedPage = Math.max(1, Math.min(targetPage, totalPages));

        const projectId = tokens.selected_project_id || '';
        const reqId = ++contactsReqIdRef.current;

        const payload = {
          project_id: projectId,
          page_no: clampedPage,
          limit: pageSize,
          query: searchTerm || '',
          ...(showFavoritesOnly ? { is_favorite_only: true } : {})
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

        // ignore stale results
        if (reqId !== contactsReqIdRef.current) return;

        if (!response?.data?.error) {
          const apiList = response?.data?.data || [];
          const meta = response?.data?.meta || null;
          const responseFirstId = response?.data?.first_id || null;
          const responseLastId = response?.data?.last_id || null;

          const mapped = apiList.map((c) => ({
            id: c.contact_id,
            name: c.name,
            mobile: c.number,
            email: c.email,
            firm_name: c.firm_name,
            website: c.website,
            remark: c.remark,
            languageCode: c.language_code,
            country: c.country,
            createdOn: c.create_date,
            is_favorite: c.is_favorite || false
          }));

          // Replace contacts with new page data
          setContacts(mapped);

          setFavoriteContacts((prev) => {
            const next = new Set();
            for (const row of mapped) {
              if (row?.id && row.is_favorite) next.add(row.id);
            }
            return next;
          });

          const totalRecords = meta?.total_records ?? response?.data?.total_records ?? contactsMeta.total_records;
          const totalPages = meta?.total_pages ?? response?.data?.total_pages ?? contactsMeta.total_pages;
          const hasMore = meta?.has_more ?? response?.data?.has_more ?? false;
          const hasMorePrevious = response?.data?.has_more_previous ?? (clampedPage > 1);
          const hasMoreNext = response?.data?.has_more_next ?? (clampedPage < totalPages);

          setContactsMeta({
            page_no: meta?.page_no ?? clampedPage,
            limit: meta?.limit ?? pageSize,
            total_records: totalRecords,
            total_pages: totalPages,
            has_more: hasMore,
            has_more_previous: hasMorePrevious,
            has_more_next: hasMoreNext
          });
          setContactsPageNo(meta?.page_no ?? clampedPage);
          setCurrentPage(meta?.page_no ?? clampedPage);
          setTotalRecords(totalRecords);
          setTotalPages(totalPages);
          // Only update scrollbar position if not currently dragging
          if (!isDraggingRef.current) {
            setScrollbarPosition(position);
          }

          // Update cursor IDs for bidirectional pagination
          if (responseFirstId) {
            setFirstId(responseFirstId);
          }
          if (responseLastId) {
            setLastId(responseLastId);
          }

          // Scroll container to top
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
          }

          scrollWindowStartIndexRef.current = Math.max(0, (clampedPage - 1) * pageSize);
          lastFetchedPageRef.current = clampedPage;
        } else {
          console.warn('⚠️ contact-list API returned error:', response?.data?.message);
        }
      } catch (error) {
        console.error('❌ Error jumping to position:', error);
      } finally {
        setContactsLoading(false);
        contactsLoadingRef.current = false;
      }
    },
    [
      tokens?.token,
      tokens?.username,
      tokens?.selected_project_id,
      permissions,
      pageSize,
      contactsMeta.total_pages,
      contactsMeta.total_records,
      searchTerm,
      showFavoritesOnly
    ]
  );

  // Custom scrollbar (stable thumb size + smooth drag). Drag updates ref live, state on release.
  const totalForThumb = contactsMeta?.total_records || 0;
  const visibleRows = scrollbarMetrics.containerHeight
    ? Math.max(1, Math.floor(scrollbarMetrics.containerHeight / CONTACT_LIST_ROW_HEIGHT))
    : pageSize;
  const thumbFraction = totalForThumb > 0 ? Math.min(1, visibleRows / totalForThumb) : 1;
  const thumbHeight = scrollbarMetrics.trackHeight
    ? Math.max(28, Math.round(scrollbarMetrics.trackHeight * thumbFraction))
    : 28;
  const maxThumbTop = Math.max(0, (scrollbarMetrics.trackHeight || 0) - thumbHeight);

  // Use ref position during drag to avoid stale closure issues
  const currentPosition = isDragging ? dragPositionRef.current : scrollbarPosition;
  const thumbTop = maxThumbTop > 0 ? (maxThumbTop * (currentPosition / 100)) : 0;

  // Convert clientY to percentage position (0-100)
  const positionFromClientY = useCallback((clientY) => {
    const trackEl = scrollbarTrackRef.current;
    if (!trackEl) return 0;
    const rect = trackEl.getBoundingClientRect();
    const trackH = rect.height;
    if (trackH <= 0) return 0;
    // Calculate where the click/drag is relative to track
    const y = clientY - rect.top;
    // Clamp to valid range
    const clampedY = Math.max(0, Math.min(y, trackH));
    return (clampedY / trackH) * 100;
  }, []);

  const handleTrackPointerDown = (e) => {
    // Click on track jumps immediately
    if (!USE_INFINITE_CONTACTS_LIST) return;
    if (contactsLoadingRef.current) return;
    const pos = positionFromClientY(e.clientY);
    setScrollbarPosition(pos);
    dragPositionRef.current = pos;
    handleScrollbarDrag(pos);
  };

  const handleThumbPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (contactsLoadingRef.current) return;

    // Set dragging state
    setIsDragging(true);
    isDraggingRef.current = true;
    dragPositionRef.current = scrollbarPosition;

    // Store initial Y for delta calculation
    thumbDragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startPosition: scrollbarPosition
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {
      // ignore
    }
  };

  const handleThumbPointerMove = (e) => {
    if (!isDraggingRef.current || !thumbDragRef.current) return;

    const trackEl = scrollbarTrackRef.current;
    if (!trackEl) return;

    const { startY, startPosition } = thumbDragRef.current;
    const trackHeight = trackEl.getBoundingClientRect().height;
    if (trackHeight <= 0) return;

    // Calculate delta as percentage of track height
    const dy = e.clientY - startY;
    const deltaPercent = (dy / trackHeight) * 100;

    // Calculate new position
    const newPos = Math.max(0, Math.min(100, startPosition + deltaPercent));

    // Update ref for immediate visual feedback (no re-render delay)
    dragPositionRef.current = newPos;

    // Also update state to trigger re-render for visual update
    setScrollbarPosition(newPos);
  };

  const handleThumbPointerUp = async (e) => {
    if (!isDraggingRef.current) return;

    const finalPosition = dragPositionRef.current;

    // Clear drag state
    setIsDragging(false);
    isDraggingRef.current = false;
    thumbDragRef.current = null;

    // Sync final position to state
    setScrollbarPosition(finalPosition);

    // Fetch data for the final position
    await handleScrollbarDrag(finalPosition);
  };

  // Sync lastFetchedPageRef when contactsMeta changes
  useEffect(() => {
    lastFetchedPageRef.current = contactsMeta?.page_no || 1;
  }, [contactsMeta?.page_no]);

  // Sync dragPositionRef when scrollbarPosition changes (from non-drag sources)
  useEffect(() => {
    if (!isDraggingRef.current) {
      dragPositionRef.current = scrollbarPosition;
    }
  }, [scrollbarPosition]);

  // If user lacks permission to view contacts, show an access message
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
              <p className="mt-2 text-gray-600">You do not have permission to view contacts.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
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
                  <h1 className="text-base font-bold text-gray-900">Contact Management</h1>
                </div>
                <p className="text-gray-600 text-sm">
                  Manage your contacts and customer information
                  {USE_INFINITE_CONTACTS_LIST && totalFromApi > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      (Page {currentDisplayPage} of {contactsMeta?.total_pages || 1} • {totalFromApi} total)
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mt-4 sm:mt-0">
                <button
                  onClick={handleToggleFavoritesOnly}
                  disabled={loadingFavorites}
                  className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${showFavoritesOnly
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    } ${loadingFavorites ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loadingFavorites ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                  ) : (
                    <FiFilter className="mr-2 h-4 w-4 text-sm" />
                  )}
                  {showFavoritesOnly ? 'Show All' : 'Favorites Only'}
                </button>

                <button
                  onClick={handleExportToExcel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiDownload className="mr-2 h-4 w-4" />
                  Export to Excel
                </button>

                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FiUpload className="mr-2 h-4 w-4" />
                  Import from Excel
                </button>

                <Tooltip
                  content="Not authorized"
                  disabled={permissions && permissions.create_contact === false}
                  position="top"
                >
                  <button
                    onClick={() => {
                      if (!permissions || permissions.create_contact) {
                        setNewContact({
                          number: '',
                          name: '',
                          email: '',
                          firm_name: '',
                          website: '',
                          remark: ''
                        });
                        setShowCreateModal(true);
                      }
                    }}
                    disabled={permissions && permissions.create_contact === false}
                    className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${permissions && permissions.create_contact === false ? 'bg-indigo-400 cursor-not-allowed opacity-60' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    <FiPlus className="mr-2 h-4 w-4" />
                    Create Contact
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            {USE_INFINITE_CONTACTS_LIST && (
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Showing {sortedContacts.length} of {contactsMeta?.total_records || 0} contacts
                </span>
                {(contactsLoading && sortedContacts.length > 0) && (
                  <span className="flex items-center">
                    <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600 mr-2"></span>
                    Loading…
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Contacts Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-2 text-gray-600">Loading contacts...</span>
                </div>
              ) : (
                <>
                  {/* Bulk Actions */}
                  {selectedContacts.length > 0 && (
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-sm text-gray-700">
                        {isAllSelected
                          ? 'All contacts on this page are selected.'
                          : `${selectedContacts.length} contact(s) selected on this page.`}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {contactGroups.length > 0 && (
                          <>
                            <SearchableSelect
                              value={bulkGroupId}
                              onChange={(e) => setBulkGroupId(e.target.value)}
                              disabled={bulkGroupLoading}
                              options={[{ value: '', label: 'Add selected to group...' }, ...contactGroups.map((group) => ({ value: group.id, label: group.name }))]}
                              placeholder="Add selected to group..."
                              className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
                            />
                            <button
                              type="button"
                              onClick={handleBulkAddToGroup}
                              disabled={!bulkGroupId || bulkGroupLoading}
                              className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {bulkGroupLoading ? 'Adding...' : 'Add to group'}
                            </button>
                          </>
                        )}
                        {isAllSelected && (
                          <Tooltip
                            content="Not authorized"
                            disabled={permissions && permissions.delete_contact === false}
                            position="top"
                          >
                            <button
                              onClick={() => { if (!permissions || permissions.delete_contact) handleOpenBulkDeleteAllContacts(); }}
                              disabled={permissions && permissions.delete_contact === false}
                              className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${permissions && permissions.delete_contact === false
                                  ? 'bg-red-300 cursor-not-allowed opacity-60'
                                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                }`}
                            >
                              <FiTrash2 className="mr-2 h-4 w-4" />
                              Delete ALL contacts
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Table Header */}
                  <div className="overflow-x-auto">
                    <div className="flex" style={{ height: '65vh' }}>
                      <div
                        ref={scrollContainerRef}
                        className="relative flex-1 overflow-y-auto overscroll-contain scrollbar-hide"
                        style={{
                          scrollbarWidth: 'none', /* Firefox */
                          msOverflowStyle: 'none', /* IE and Edge */
                        }}
                        onScroll={handleContactsScroll}
                      >
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                              <th className="w-14 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                #
                              </th>
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
                                  <span>Name</span>
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
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Mobile
                              </th>
                              <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                                onClick={() => handleSort('email')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Email</span>
                                  {sortColumn === 'email' ? (
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
                                onClick={() => handleSort('firm_name')}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>Company</span>
                                  {sortColumn === 'firm_name' ? (
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
                            {contactsLoading && sortedContacts.length === 0 ? (
                              <TableSkeletonRows rows={8} cells={['index', 'short', 'avatar', 'text', 'text', 'text', 'action']} />
                            ) : sortedContacts.length === 0 && !contactsLoading ? (
                              <tr>
                                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                  {showFavoritesOnly
                                    ? 'No favorite contacts found. Mark some contacts as favorites to see them here.'
                                    : 'No contacts found. Create your first contact to get started.'
                                  }
                                </td>
                              </tr>
                            ) : (
                              sortedContacts.map((contact, idx) => (
                                <tr key={contact.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-4 text-center text-sm text-gray-500">
                                    {scrollWindowStartIndexRef.current + idx + 1}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={selectedContacts.includes(contact.id)}
                                      onChange={() => handleSelectContact(contact.id)}
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
                                      <div className="ml-4 cursor-pointer text-indigo-600">
                                        <div className="text-sm font-medium  " onClick={() => {
                                          navigate(`/live-chat/${contact.mobile}`);
                                        }}>
                                          {contact.name}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {contact.mobile}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {contact.email || '-'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {contact.firm_name || '-'}
                                  </td>
                                  <td className="px-3 py-4 text-right">
                                    <RowActionMenu
                                      items={[
                                        { label: 'Details', icon: <FiEye className="h-4 w-4" />, onClick: () => setDetailContact(contact) },
                                        { label: 'Edit', icon: <FiEdit className="h-4 w-4" />, onClick: () => handleOpenEditModal(contact), disabled: permissions && permissions.edit_contact === false },
                                        { label: favoriteContacts.has(contact.id) ? 'Remove favorite' : 'Add favorite', icon: <FiStar className="h-4 w-4" />, onClick: () => handleToggleFavorite(contact) },
                                        { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, onClick: () => handleDeleteContact(contact), danger: true, disabled: permissions && permissions.delete_contact === false },
                                      ]}
                                    />
                                  </td>
                                </tr>
                              ))
                            )}
                            {(USE_INFINITE_CONTACTS_LIST && contactsLoading && sortedContacts.length > 0) && (
                              <tr>
                                <td colSpan="7" className="px-6 py-3 text-center text-xs text-gray-500">
                                  <span className="inline-flex items-center">
                                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></span>
                                    Loading more…
                                  </span>
                                </td>
                              </tr>
                            )}

                            {(USE_INFINITE_CONTACTS_LIST && !contactsLoading && !contactsMeta.has_more && sortedContacts.length > 0) && (
                              <tr>
                                <td colSpan="7" className="px-6 py-3 text-center text-xs text-gray-400">
                                  End of contacts (Page {currentDisplayPage} of {contactsMeta?.total_pages || 1})
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Scrollbar */}
                      {USE_INFINITE_CONTACTS_LIST && contactsMeta.total_records > 0 && (
                        <div className="w-10 flex flex-col items-center bg-gray-50 border-l border-gray-200 py-2">
                          <div
                            ref={scrollbarTrackRef}
                            className="relative flex-1 w-5 rounded-full bg-gray-200/70 mx-auto"
                            onPointerDown={handleTrackPointerDown}
                            style={{ touchAction: 'none' }}
                            aria-label="Contacts scrollbar"
                            role="scrollbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(scrollbarPosition)}
                          >
                            <div
                              className="absolute left-1/2 -translate-x-1/2 w-4 rounded-full bg-indigo-600 shadow-sm"
                              style={{
                                height: `${thumbHeight}px`,
                                top: `${thumbTop}px`,
                                transition: isDragging ? 'none' : 'top 60ms linear',
                                touchAction: 'none',
                                cursor: isDragging ? 'grabbing' : 'grab'
                              }}
                              onPointerDown={handleThumbPointerDown}
                              onPointerMove={handleThumbPointerMove}
                              onPointerUp={handleThumbPointerUp}
                              onPointerCancel={handleThumbPointerUp}
                              title={`${Math.round(scrollbarPosition)}%`}
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-2 text-center font-medium tabular-nums">
                            {Math.round(scrollbarPosition)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pagination */}
                  {!USE_INFINITE_CONTACTS_LIST && totalRecords >= 0 && (
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalRecords={totalRecords}
                      pageSize={pageSize}
                      onPageChange={(page) => setCurrentPage(page)}
                      onPageSizeChange={handlePageSizeChange}
                      pageSizeOptions={[10, 20, 50, 100]}
                      showPageSizeSelector={true}
                      showGoToPage={true}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <RecordDetailsModal
        isOpen={Boolean(detailContact)}
        onClose={() => setDetailContact(null)}
        title={detailContact?.name || 'Contact'}
        subtitle={detailContact?.mobile}
        fields={detailContact ? [
          { label: 'Mobile', value: detailContact.mobile },
          { label: 'Email', value: detailContact.email },
          { label: 'Company', value: detailContact.firm_name },
          { label: 'Website', value: detailContact.website },
          { label: 'Address', value: detailContact.address },
          { label: 'Notes', value: detailContact.notes || detailContact.remark },
        ] : []}
      />

      {/* Create Contact Modal */}
      <ContactFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        initialData={newContact}
        isExisting={false}
        onSubmit={handleCreateContact}
        loading={false}
        submitting={false}
        error=""
        darkMode={false}
        groups={contactGroups}
      />

      {/* Edit Contact Modal */}
      <ContactFormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContact(null);
        }}
        initialData={editContact}
        isExisting={true}
        onSubmit={handleUpdateContact}
        loading={false}
        submitting={false}
        error=""
        darkMode={false}
        groups={contactGroups}
      />

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white my-10">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Import Contacts</h3>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportAudienceType('excel');
                    setImportExcelMapping({ name: '', phone: '' });
                    setImportSheetLink('');
                    setImportExcelHeaders([]);
                    setImportExcelData([]);
                    setImportExcelFileUrl('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              {/* Tab Selection */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                  onClick={() => setImportAudienceType('excel')}
                  className={`p-4 rounded-xl border-2 transition-all ${importAudienceType === 'excel'
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-gray-200 hover:border-indigo-300'
                    }`}
                >
                  <FiFileText className={`w-6 h-6 mb-2 mx-auto ${importAudienceType === 'excel' ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <div className="font-semibold text-gray-800">Upload Excel</div>
                  <div className="text-sm text-gray-500 mt-1">Import from Excel file</div>
                </button>

                <button
                  onClick={() => setImportAudienceType('sheet')}
                  className={`p-4 rounded-xl border-2 transition-all ${importAudienceType === 'sheet'
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-gray-200 hover:border-indigo-300'
                    }`}
                >
                  <FiGlobe className={`w-6 h-6 mb-2 mx-auto ${importAudienceType === 'sheet' ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <div className="font-semibold text-gray-800">Google Sheet</div>
                  <div className="text-sm text-gray-500 mt-1">Connect via link</div>
                </button>
              </div>

              {/* Component Content */}
              <div className="max-h-[calc(100vh-350px)] overflow-y-auto">
                {importAudienceType === 'excel' && (
                  <ExcelUpload
                    excelMapping={importExcelMapping}
                    setExcelMapping={setImportExcelMapping}
                    onContactsExtracted={() => { }}
                    onHeadersExtracted={(headers) => {
                      setImportExcelHeaders(headers);
                    }}
                    onDataExtracted={(data) => {
                      setImportExcelData(data);
                    }}
                    onFileUploaded={(url) => {
                      setImportExcelFileUrl(url);
                    }}
                    tokens={tokens}
                  />
                )}

                {importAudienceType === 'sheet' && (
                  <GoogleSheet
                    sheetLink={importSheetLink}
                    setSheetLink={setImportSheetLink}
                    excelMapping={importExcelMapping}
                    setExcelMapping={setImportExcelMapping}
                    onContactsExtracted={() => { }}
                    onHeadersExtracted={(headers) => {
                      setImportExcelHeaders(headers);
                    }}
                    onDataExtracted={(data) => {
                      setImportExcelData(data);
                    }}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 border-t pt-4">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportAudienceType('excel');
                    setImportExcelMapping({ name: '', phone: '' });
                    setImportSheetLink('');
                    setImportExcelHeaders([]);
                    setImportExcelData([]);
                    setImportExcelFileUrl('');
                  }}
                  disabled={isImporting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportContacts}
                  disabled={isImporting || !importExcelMapping.phone || !importExcelMapping.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <FiUpload className="h-4 w-4" />
                      Import Contacts
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Confirmation Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-6 border w-5/6 sm:w-3/6 md:w-2/6 lg:w-2/6 xl:w-1/4 shadow-xl rounded-lg bg-white transform transition-all">
            <div className="mt-2">
              {/* Download Icon */}
              <div className="flex items-center justify-center mb-4">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-indigo-100">
                  <FiDownload className="h-7 w-7 text-indigo-600" />
                </div>
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Export Contacts</h3>
                <p className="text-sm text-gray-500 mb-1">You are about to export</p>
                <p className="text-xs text-gray-400 mb-6">The file will be downloaded as Excel format.</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelExportContacts}
                  disabled={isExporting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmExportContacts}
                  disabled={isExporting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <FiDownload className="h-4 w-4" />
                      Download
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-6 border w-5/6 sm:w-3/6 md:w-2/6 lg:w-2/6 xl:w-1/4 shadow-xl rounded-lg bg-white transform transition-all">
            <div className="mt-2">
              <div className="flex items-center justify-center mb-4">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100">
                  <FiTrash2 className="h-7 w-7 text-red-600" />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Delete All Contacts
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  This will delete ALL contacts from this project.
                </p>
                <p className="text-xs text-gray-400 mb-4">This action cannot be undone.</p>

                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="font-semibold">all-delete</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={bulkDeletePhrase}
                    onChange={(e) => {
                      setBulkDeletePhrase(e.target.value);
                      if (bulkDeleteError) setBulkDeleteError('');
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${bulkDeleteError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'
                      }`}
                    placeholder="all-delete"
                    autoFocus
                  />
                  {bulkDeleteError && (
                    <p className="mt-1 text-sm text-red-600">{bulkDeleteError}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={cancelBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmBulkDelete}
                  disabled={isBulkDeleting || bulkDeletePhrase.trim() !== 'all-delete'}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBulkDeleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && contactToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative mx-auto p-6 border w-5/6 sm:w-3/6 md:w-2/6 lg:w-2/6 xl:w-1/4 shadow-xl rounded-lg bg-white transform transition-all">
            <div className="mt-2">
              {/* Warning Icon */}
              <div className="flex items-center justify-center mb-4">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-red-100">
                  <FiTrash2 className="h-7 w-7 text-red-600" />
                </div>
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Contact</h3>
                <p className="text-sm text-gray-500 mb-1">Are you sure you want to delete</p>
                <p className="text-base font-medium text-gray-800 mb-1">"{contactToDelete.name}"?</p>
                <p className="text-xs text-gray-400 mb-6">This action cannot be undone.</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDeleteContact}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteContact}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
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

export default Contact;
