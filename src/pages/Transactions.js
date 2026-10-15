import React, { useState, useEffect, useRef, useMemo } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import {
  FiFileText,
  FiRefreshCw, FiX, FiUser, FiCreditCard,
  FiMessageSquare, FiCopy, FiArrowDownLeft, FiArrowUpRight,
  FiTrendingUp, FiList, FiDownload, FiEye, FiSend, FiRepeat,
  FiPlusCircle, FiRotateCcw, FiInbox, FiAlertCircle
} from 'react-icons/fi';
import moment from 'moment';
import { parseServerDate } from '../utils/dateTime';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import Pagination from '../component/Pagination';
import DateRangeFilter, { formatRangeLabel } from '../component/DateRangeFilter';
import ProjectFilter from '../component/ProjectFilter';
import StatCard from '../component/StatCard';
import AnimatedModal from '../component/Modals/AnimatedModal';

const formatMoment = (value, format) => {
  const date = parseServerDate(value);
  return date ? moment(date).format(format) : 'N/A';
};

const inr = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isOwnedProject = (project) => project?.owned === true || project?.type === 'admin';

const defaultFrom = () => moment().subtract(29, 'days').format('YYYY-MM-DD');
const defaultTo = () => moment().format('YYYY-MM-DD');

const ENTRY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: '1', label: 'Credit', icon: FiArrowDownLeft },
  { value: '0', label: 'Debit', icon: FiArrowUpRight },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All transaction types' },
  { value: 'template send', label: 'Template send' },
  { value: 'wallet topup', label: 'Wallet top-up' },
  { value: 'project renewal', label: 'Project renewal' },
  { value: 'project create', label: 'Project create' },
];

const Transactions = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokens, setTokens] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [totalDebit, setTotalDebit] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  // Copy feedback state
  const [copiedField, setCopiedField] = useState(null);

  // Server-side filters (payload options)
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [transactionType, setTransactionType] = useState('all'); // template send | wallet topup | project renewal | project create | all
  const [entryType, setEntryType] = useState('all'); // Credit=1, Debit=0, all
  const [selectedProjects, setSelectedProjects] = useState([]); // Array of project_ids, empty array = all projects

  // Guards against out-of-order responses when filters change quickly
  const requestIdRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mobileMenuOpen]);

  // Load auth tokens
  useEffect(() => {
    try {
      const sessionData = localStorage.getItem('userData');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed && typeof parsed === 'object') setTokens(parsed);
      }
      if (!sessionData) {
        setError('Your session has expired. Please sign in again.');
        setLoading(false);
      }
    } catch (e) {
      console.error('Failed to load tokens:', e);
      setError('Failed to load authentication data');
      setLoading(false);
    }
  }, []);

  // Fetch transactions from API (reads the current filter state)
  const fetchTransactions = async () => {
    if (!tokens?.token || !tokens?.username) return;
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError('');

      const payload = {
        page_no: currentPage,
        limit: pageSize,
        // Empty array = all projects (backend contract)
        project_ids: selectedProjects,
        ...(fromDate ? { from_date: fromDate } : {}),
        ...(toDate ? { to_date: toDate } : {}),
        ...(transactionType !== 'all' ? { transaction_type: transactionType } : {}),
        ...(entryType !== 'all' ? { type: entryType } : {})
      };

      const { data, key } = Encrypt(payload);
      const response = await axios.post(
        `${API_BASE_URL}/payment/transaction-history`,
        JSON.stringify({ data, key }),
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (requestId !== requestIdRef.current) return; // a newer request superseded this one

      if (response?.data?.error) {
        setError(response?.data?.message || 'Failed to fetch transactions');
        return;
      }

      const responseData = response.data || {};
      const rows = responseData.data || [];
      setTransactions(rows);
      setTotalCredit(parseFloat(responseData.total_credit || 0));
      setTotalDebit(parseFloat(responseData.total_debit || 0));

      if (responseData.meta) {
        setTotalPages(responseData.meta.total_pages || 1);
        setTotalRecords(responseData.meta.total_records || 0);
      } else {
        setTotalRecords(rows.length);
        setTotalPages(1);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to fetch transactions:', err);
      setError('Failed to fetch transactions. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  // Single source of truth: any filter / paging change triggers exactly one fetch
  useEffect(() => {
    if (tokens?.token && tokens?.username) fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, fromDate, toDate, transactionType, entryType, selectedProjects, currentPage, pageSize, refreshKey]);

  const projectOptions = useMemo(
    () => (tokens?.projects || [])
      .filter(isOwnedProject)
      .map((project) => ({ value: project.project_id, label: project.name })),
    [tokens]
  );

  const projectNameById = (projectId) => {
    if (!projectId) return '';
    const match = (tokens?.projects || []).find((project) => String(project.project_id) === String(projectId));
    return match?.name || '';
  };

  // Transform API data to match component expectations
  const transformedTransactions = transactions.map((transaction, index) => ({
    id: transaction.transaction_id,
    date: transaction.create_date,
    type: transaction.type ? 'Credit' : 'Debit',
    description: transaction.transaction_type,
    amount: parseFloat(transaction.amount),
    invoiceNumber: transaction.transaction_id,
    remark: transaction.remark,
    create_by: transaction.create_by,
    payment_details: transaction.payment_details,
    message_details: transaction.message_details,
    projectLabel: transaction.project_name || transaction.project?.name || projectNameById(transaction.project_id) || '',
    serialNumber: (currentPage - 1) * pageSize + index + 1
  }));

  // Generate PDF Invoice
  const generatePDF = async (transaction) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // --- ULTRA-FAST LOGO LOAD (0ms timeout – if not ready, skip) ---
    const getLogoFast = () => {
      return new Promise((resolve) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 0); // abort immediately if not cached
        const logoUrl = `${window.location.origin}/logo.png`;
        fetch(logoUrl, { signal: controller.signal, cache: 'force-cache' })
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          })
          .catch(() => resolve(null))
          .finally(() => clearTimeout(timeout));
      });
    };

    const logoBase64 = await getLogoFast();

    // --- HEADER: Logo on RIGHT (bigger), Title on LEFT ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text('1Chat Transaction Receipt', 15, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('WhatsApp Business API Platform', 15, 27);
    doc.text('support@1chat.com  |  www.1chat.com', 15, 32);

    if (logoBase64) {
      const logoWidth = 16;
      const logoHeight = 16;
      doc.addImage(logoBase64, 'PNG', 195 - logoWidth, 6, logoWidth, logoHeight);
    }

    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(15, 42, 195, 42);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text('TRANSACTION RECEIPT', 105, 52, { align: 'center' });

    const overviewRows = [
      ['Transaction ID:', transaction.id || 'N/A'],
      ['Date:', formatMoment(transaction.date, 'MMMM DD, YYYY HH:mm')],
      ['Type:', transaction.type],
      ['Transaction Type:', getTransactionTypeDisplay(transaction.description)]
    ];

    autoTable(doc, {
      startY: 62,
      body: overviewRows,
      theme: 'plain',
      styles: {
        fontSize: 10,
        cellPadding: 2.5,
        textColor: [31, 41, 55],
        fontStyle: 'normal',
        valign: 'middle'
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [107, 114, 128], cellWidth: 45, halign: 'left' },
        1: { cellWidth: 130, halign: 'left' }
      },
      margin: { left: 15, right: 15 },
      tableWidth: 'auto'
    });

    let finalY = doc.lastAutoTable.finalY + 12;

    if (transaction.message_details) {
      const md = transaction.message_details;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241);
      doc.text('Message Details', 15, finalY);

      doc.setDrawColor(209, 213, 219);
      doc.line(15, finalY + 2, 195, finalY + 2);

      const details = [
        ['Unique ID:', md.unique_id || md.message_details_id || 'N/A'],
        ['WAMID:', md.wamid || 'N/A'],
        ['Project ID:', md.project_id || 'N/A'],
        ['Message By:', md.message_by || 'N/A'],
        ['Number:', md.number || 'N/A'],
        ['Template Name:', md.template_name || 'N/A'],
        ['Language:', md.language_code || 'N/A'],
        ['Category:', md.category || 'N/A'],
        ['Message Date:', md.create_date ? formatMoment(md.create_date, 'MMMM DD, YYYY HH:mm') : 'N/A']
      ];

      autoTable(doc, {
        startY: finalY + 5,
        body: details,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          textColor: [31, 41, 55],
          valign: 'middle'
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [107, 114, 128], cellWidth: 35, halign: 'left' },
          1: { cellWidth: 140, halign: 'left' }
        },
        margin: { left: 15, right: 15 },
        tableWidth: 'auto'
      });
      finalY = doc.lastAutoTable.finalY + 12;
    }

    if (transaction.payment_details) {
      const pd = transaction.payment_details;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(99, 102, 241);
      doc.text('Payment Details', 15, finalY);

      doc.setDrawColor(209, 213, 219);
      doc.line(15, finalY + 2, 195, finalY + 2);

      const details = [
        ['Payment ID:', pd.payment_id || 'N/A'],
        ['UTR:', pd.utr || 'N/A'],
        ['Name:', pd.name || 'N/A'],
        ['Email:', pd.email || 'N/A'],
        ['Mobile:', pd.mobile || 'N/A'],
        ['Payment Date:', pd.create_date ? formatMoment(pd.create_date, 'MMMM DD, YYYY HH:mm') : 'N/A']
      ];

      autoTable(doc, {
        startY: finalY + 5,
        body: details,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          textColor: [31, 41, 55],
          valign: 'middle'
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [107, 114, 128], cellWidth: 35, halign: 'left' },
          1: { cellWidth: 140, halign: 'left' }
        },
        margin: { left: 15, right: 15 },
        tableWidth: 'auto'
      });
      finalY = doc.lastAutoTable.finalY + 12;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text('Transaction Details', 15, finalY);

    doc.setDrawColor(209, 213, 219);
    doc.line(15, finalY + 2, 195, finalY + 2);

    const lineData = [
      [
        getTransactionTypeDisplay(transaction.description),
        transaction.type,
        `₹${transaction.amount.toFixed(2)}`,
        transaction.remark || 'N/A'
      ]
    ];

    autoTable(doc, {
      startY: finalY + 5,
      head: [['Description', 'Type', 'Amount (₹)', 'Remark']],
      body: lineData,
      headStyles: {
        fillColor: [99, 102, 241],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center',
        valign: 'middle'
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
        halign: 'center',
        valign: 'middle',
        textColor: [31, 41, 55]
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' }
      },
      margin: { left: 15, right: 15 },
      tableWidth: 'auto'
    });

    finalY = doc.lastAutoTable.finalY + 12;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 41, 55);
    doc.text(`Total Amount: ₹${transaction.amount.toFixed(2)}`, 175, finalY, { align: 'right' });

    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text('support@1chat.com  |  www.1chat.com', 105, pageHeight - 15, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(156, 163, 175);
    doc.text('This is a system generated receipt and does not require a signature.', 105, pageHeight - 8, { align: 'center' });

    const fileName = `receipt_${transaction.id || 'transaction'}_${moment().format('YYYYMMDDHHmmss')}.pdf`;
    doc.save(fileName);
  };

  // Modal handlers
  const openDetailsModal = (transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeDetailsModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
    document.body.style.overflow = 'auto';
  };

  // Copy to clipboard function
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  const getTransactionTypeDisplay = (value) => {
    return (value || '').split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Visual identity per transaction type: icon tile + badge colour
  const typeVisual = (description, credit) => {
    const key = (description || '').toLowerCase();
    if (key.includes('topup') || key.includes('top-up')) return { Icon: FiArrowDownLeft, tile: 'bg-emerald-50 text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' };
    if (key.includes('template') || key.includes('send')) return { Icon: FiSend, tile: 'bg-brand-50 text-brand-700', badge: 'bg-brand-50 text-brand-800' };
    if (key.includes('renew')) return { Icon: FiRepeat, tile: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', badge: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' };
    if (key.includes('create')) return { Icon: FiPlusCircle, tile: 'bg-amber-50 text-amber-700', badge: 'bg-amber-50 text-amber-800' };
    return credit
      ? { Icon: FiArrowDownLeft, tile: 'bg-emerald-50 text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' }
      : { Icon: FiArrowUpRight, tile: 'bg-surface-soft text-ink-700', badge: 'bg-surface-soft text-ink-700' };
  };

  const detailLines = (transaction) => {
    const message = transaction.message_details;
    const payment = transaction.payment_details;
    if (message?.template_name || message?.number) {
      const extra = [message.category, message.number ? `To ${message.number}` : ''].filter(Boolean).join(' · ');
      return { title: message.template_name || transaction.remark || getTransactionTypeDisplay(transaction.description), sub: extra };
    }
    if (payment?.utr || payment?.payment_id) {
      return {
        title: transaction.remark || 'Razorpay payment',
        sub: payment.utr ? `UTR ${payment.utr}` : payment.payment_id
      };
    }
    if (transaction.remark) return { title: transaction.remark, sub: '' };
    return { title: getTransactionTypeDisplay(transaction.description), sub: '' };
  };

  // ---- Filter handlers: every change returns to page 1 (one fetch via the effect) ----
  const handleDateChange = ({ from, to }) => {
    setFromDate(from);
    setToDate(to);
    setCurrentPage(1);
  };
  const handleEntryType = (value) => {
    setEntryType(value);
    setCurrentPage(1);
  };
  const handleTransactionType = (value) => {
    setTransactionType(value);
    setCurrentPage(1);
  };
  const handleProjects = (ids) => {
    setSelectedProjects([...ids]);
    setCurrentPage(1);
  };

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const filtersDirty =
    fromDate !== defaultFrom() || toDate !== defaultTo() || transactionType !== 'all' || entryType !== 'all' || selectedProjects.length > 0;

  const handleResetFilters = () => {
    setFromDate(defaultFrom());
    setToDate(defaultTo());
    setTransactionType('all');
    setEntryType('all');
    setSelectedProjects([]);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => setCurrentPage(page);
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const netFlow = Number(totalCredit || 0) - Number(totalDebit || 0);
  const rangeLabel = formatRangeLabel(fromDate, toDate);
  const firstRow = totalRecords ? (currentPage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(currentPage * pageSize, totalRecords);

  // ---------- Loading skeletons ----------
  const DesktopTableSkeleton = () => (
    <tbody>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          <td className="oc-td"><div className="mx-auto h-3 w-5 rounded bg-surface-soft" /></td>
          <td className="oc-td"><div className="h-3 w-20 rounded bg-surface-soft" /><div className="mt-2 h-2.5 w-12 rounded bg-surface-soft" /></td>
          <td className="oc-td">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[10px] bg-surface-soft" />
              <div className="flex-1"><div className="h-3 w-40 rounded bg-surface-soft" /><div className="mt-2 h-2.5 w-24 rounded bg-surface-soft" /></div>
            </div>
          </td>
          <td className="oc-td"><div className="h-5 w-24 rounded-md bg-surface-soft" /></td>
          <td className="oc-td"><div className="h-3 w-24 rounded bg-surface-soft" /></td>
          <td className="oc-td"><div className="ml-auto h-3 w-20 rounded bg-surface-soft" /></td>
          <td className="oc-td"><div className="ml-auto h-8 w-16 rounded-lg bg-surface-soft" /></td>
        </tr>
      ))}
    </tbody>
  );

  const MobileCardsSkeleton = () => (
    <div className="divide-y divide-line-soft md:hidden">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex animate-pulse items-center gap-3 p-4">
          <div className="h-10 w-10 rounded-[10px] bg-surface-soft" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-surface-soft" />
            <div className="h-2.5 w-1/3 rounded bg-surface-soft" />
          </div>
          <div className="h-3 w-16 rounded bg-surface-soft" />
        </div>
      ))}
    </div>
  );

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <FiInbox size={24} />
      </span>
      <h3 className="text-base font-bold text-ink">No transactions in this view</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">
        Nothing matches {rangeLabel.toLowerCase() === 'all time' ? 'these filters' : <>the selected range <span className="font-semibold text-ink-700">{rangeLabel}</span></>}. Try widening the date range or clearing filters.
      </p>
      {filtersDirty && (
        <button type="button" onClick={handleResetFilters} className="oc-btn-ghost mt-5">
          <FiRotateCcw size={14} /> Reset filters
        </button>
      )}
    </div>
  );

  // ============= MODAL – VERTICAL LAYOUT, RECEIPT COLOR SCHEME, COPY BUTTONS =============
  const DetailRow = ({ label, children }) => (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[140px_1fr] sm:gap-4">
      <span className="text-[13px] font-medium text-ink-500">{label}</span>
      <div className="min-w-0 text-sm text-ink">{children}</div>
    </div>
  );

  const CopyChip = ({ value, field }) => (
    <button
      type="button"
      onClick={() => copyToClipboard(value, field)}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-100"
    >
      <FiCopy size={11} />
      {copiedField === field ? 'Copied' : 'Copy'}
    </button>
  );

  const TransactionDetailsModal = () => {
    if (!selectedTransaction) return null;
    const { payment_details, message_details, create_by, remark } = selectedTransaction;
    const credit = selectedTransaction.type === 'Credit';
    const visual = typeVisual(selectedTransaction.description, credit);

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="txn-modal-title">
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-[2px]" onClick={closeDetailsModal} />
        <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          {/* Summary header */}
          <div className="flex items-start gap-4 border-b border-line-soft px-6 py-5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${visual.tile}`}>
              <visual.Icon size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p id="txn-modal-title" className="text-xs font-bold uppercase tracking-wider text-ink-400">
                {getTransactionTypeDisplay(selectedTransaction.description) || 'Transaction'}
              </p>
              <p className={`mt-1 font-mono text-[26px] font-bold leading-none ${credit ? 'text-emerald-600' : 'text-ink'}`}>
                {credit ? '+' : '−'} {inr(selectedTransaction.amount)}
              </p>
              <p className="mt-1.5 text-xs text-ink-500">{formatMoment(selectedTransaction.date, 'DD MMM YYYY, hh:mm A')}</p>
            </div>
            <button type="button" onClick={closeDetailsModal} aria-label="Close" className="rounded-lg p-2 text-ink-400 hover:bg-surface-soft hover:text-ink">
              <FiX size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <h4 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-ink"><FiFileText size={14} className="text-brand-700" /> Overview</h4>
              <div className="divide-y divide-line-soft">
                <DetailRow label="Transaction ID">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-mono text-[13px]">{selectedTransaction.id}</span>
                    <CopyChip value={selectedTransaction.id} field="transactionId" />
                  </div>
                </DetailRow>
                <DetailRow label="Entry">
                  <span className={`oc-badge ${credit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>{selectedTransaction.type}</span>
                </DetailRow>
                <DetailRow label="Project">{selectedTransaction.projectLabel || '—'}</DetailRow>
              </div>
            </section>

            {payment_details && (
              <section>
                <h4 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-ink"><FiCreditCard size={14} className="text-brand-700" /> Payment</h4>
                <div className="divide-y divide-line-soft">
                  <DetailRow label="Payment ID">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-[13px]">{payment_details.payment_id || 'N/A'}</span>
                      {payment_details.payment_id && <CopyChip value={payment_details.payment_id} field="paymentId" />}
                    </div>
                  </DetailRow>
                  <DetailRow label="UTR">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-all font-mono text-[13px]">{payment_details.utr || 'N/A'}</span>
                      {payment_details.utr && <CopyChip value={payment_details.utr} field="utr" />}
                    </div>
                  </DetailRow>
                  <DetailRow label="Name">{payment_details.name || 'N/A'}</DetailRow>
                  <DetailRow label="Email"><span className="break-all">{payment_details.email || 'N/A'}</span></DetailRow>
                  <DetailRow label="Mobile">{payment_details.mobile || 'N/A'}</DetailRow>
                  <DetailRow label="Payment date">{payment_details.create_date ? formatMoment(payment_details.create_date, 'DD MMM YYYY, hh:mm A') : 'N/A'}</DetailRow>
                </div>
              </section>
            )}

            {message_details && (
              <section>
                <h4 className="mb-1 flex items-center gap-2 text-[13px] font-bold text-ink"><FiMessageSquare size={14} className="text-brand-700" /> Message</h4>
                <div className="divide-y divide-line-soft">
                  <DetailRow label="Template">{message_details.template_name || 'N/A'}</DetailRow>
                  <DetailRow label="Number">{message_details.number || 'N/A'}</DetailRow>
                  <DetailRow label="Category">{message_details.category || 'N/A'}</DetailRow>
                  <DetailRow label="Language">{message_details.language_code || 'N/A'}</DetailRow>
                  <DetailRow label="Message by">{message_details.message_by || 'N/A'}</DetailRow>
                  <DetailRow label="WAMID"><span className="break-all font-mono text-[12px]">{message_details.wamid || 'N/A'}</span></DetailRow>
                  <DetailRow label="Message date">{message_details.create_date ? formatMoment(message_details.create_date, 'DD MMM YYYY, hh:mm A') : 'N/A'}</DetailRow>
                </div>
              </section>
            )}

            {(remark || create_by) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {remark && (
                  <div className="rounded-xl border border-line-soft bg-surface-soft p-4">
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-400"><FiFileText size={11} /> Remark</span>
                    <p className="text-sm text-ink">{remark}</p>
                  </div>
                )}
                {create_by && (
                  <div className="rounded-xl border border-line-soft bg-surface-soft p-4">
                    <span className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-ink-400"><FiUser size={11} /> Created by</span>
                    <p className="text-sm font-semibold text-brand-800">{create_by.username || 'N/A'}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line-soft bg-surface-soft px-6 py-3.5">
            <button type="button" onClick={closeDetailsModal} className="oc-btn-ghost">Close</button>
            <button type="button" onClick={() => generatePDF(selectedTransaction)} className="oc-btn-primary">
              <FiDownload size={14} /> Download receipt
            </button>
          </div>
        </div>
      </div>
    );
  };

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

      <main className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
          {/* ---------- Page header ---------- */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.7)] sm:flex">
                <FiCreditCard size={22} />
              </span>
              <div>
                <h1 className="oc-page-title">Transactions</h1>
                <p className="oc-page-sub !mt-1">Every wallet credit and debit, with downloadable receipts.</p>
              </div>
            </div>
            <button type="button" onClick={handleRefresh} disabled={loading} className="oc-btn-ghost self-start sm:self-auto">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} size={15} />
              Refresh
            </button>
          </div>

          {/* ---------- KPI cards ---------- */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={FiArrowDownLeft} tone="emerald" label="Total credit" value={inr(totalCredit)} hint={rangeLabel} loading={loading && !error} />
            <StatCard icon={FiArrowUpRight} tone="rose" valueTone="brand" label="Total debit" value={inr(totalDebit)} hint={rangeLabel} loading={loading && !error} />
            <StatCard
              icon={FiTrendingUp}
              tone="brand"
              valueTone={netFlow >= 0 ? 'emerald' : 'rose'}
              label="Net flow"
              value={`${netFlow >= 0 ? '+' : '−'} ${inr(Math.abs(netFlow))}`}
              hint="Credit minus debit"
              loading={loading && !error}
            />
            <StatCard icon={FiList} tone="amber" label="Records" value={Number(totalRecords || 0).toLocaleString('en-IN')} hint="Matching current filters" loading={loading && !error} />
          </div>

          {/* ---------- Filter toolbar ---------- */}
          <div className="oc-card mb-4 p-3">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
              <div className="inline-flex h-[42px] shrink-0 self-start rounded-[10px] border border-line bg-surface-soft p-1" role="tablist" aria-label="Entry type">
                {ENTRY_OPTIONS.map((option) => {
                  const active = entryType === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handleEntryType(option.value)}
                      className={`inline-flex h-full items-center gap-1.5 rounded-[8px] px-3.5 text-[13px] font-semibold transition-all ${
                        active ? 'bg-white text-ink shadow-card ring-1 ring-line' : 'text-ink-500 hover:text-ink'
                      }`}
                    >
                      {Icon ? <Icon size={13} className={option.value === '1' ? 'text-emerald-600' : 'text-rose-600'} /> : null}
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_minmax(170px,1fr)_minmax(170px,1fr)_auto]">
                <DateRangeFilter from={fromDate} to={toDate} onChange={handleDateChange} disabled={!tokens} />
                <SearchableSelect
                  value={transactionType}
                  onChange={(e) => handleTransactionType(e.target.value)}
                  options={TYPE_OPTIONS}
                  className="oc-input w-full font-semibold"
                  searchable={false}
                />
                <ProjectFilter options={projectOptions} value={selectedProjects} onChange={handleProjects} align="right" />
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={!filtersDirty}
                  className="oc-btn-ghost h-[42px]"
                  title="Reset filters"
                >
                  <FiRotateCcw size={14} />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* ---------- Table card ---------- */}
          <section className="oc-card overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-line-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="text-[15px] font-bold text-ink">Transaction history</h2>
              <p className="text-xs text-ink-500">
                {loading ? 'Loading…' : totalRecords ? (
                  <>Showing <span className="font-semibold text-ink-700">{firstRow}–{lastRow}</span> of <span className="font-semibold text-ink-700">{Number(totalRecords).toLocaleString('en-IN')}</span> · {rangeLabel}</>
                ) : rangeLabel}
              </p>
            </div>

            {error ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><FiAlertCircle size={24} /></span>
                <h3 className="mb-1 text-base font-bold text-ink">Unable to load transactions</h3>
                <p className="mb-5 text-sm text-ink-500">{error}</p>
                <button type="button" onClick={handleRefresh} className="oc-btn-primary">Try again</button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] table-fixed">
                    <colgroup>
                      <col className="w-[52px]" />
                      <col className="w-[120px]" />
                      <col />
                      <col className="w-[150px]" />
                      <col className="w-[150px]" />
                      <col className="w-[140px]" />
                      <col className="w-[96px]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="oc-th text-center">#</th>
                        <th className="oc-th">Date</th>
                        <th className="oc-th">Transaction</th>
                        <th className="oc-th">Type</th>
                        <th className="oc-th">Project</th>
                        <th className="oc-th text-right">Amount</th>
                        <th className="oc-th text-right">Actions</th>
                      </tr>
                    </thead>
                    {loading ? (
                      <DesktopTableSkeleton />
                    ) : (
                      <tbody>
                        {transformedTransactions.length === 0 ? (
                          <tr><td colSpan="7"><EmptyState /></td></tr>
                        ) : transformedTransactions.map((transaction) => {
                          const detail = detailLines(transaction);
                          const credit = transaction.type === 'Credit';
                          const visual = typeVisual(transaction.description, credit);
                          return (
                            <tr key={transaction.id} className="group transition-colors hover:bg-surface-soft">
                              <td className="oc-td text-center text-xs text-ink-400 oc-num">{transaction.serialNumber}</td>
                              <td className="oc-td whitespace-nowrap">
                                <span className="block text-sm font-semibold text-ink">{formatMoment(transaction.date, 'DD MMM YYYY')}</span>
                                <span className="block text-xs text-ink-400">{formatMoment(transaction.date, 'hh:mm A')}</span>
                              </td>
                              <td className="oc-td">
                                <button type="button" onClick={() => openDetailsModal(transaction)} className="flex w-full min-w-0 items-center gap-3 text-left">
                                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${visual.tile}`}>
                                    <visual.Icon size={16} />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-800">{detail.title}</span>
                                    <span className="block truncate text-xs text-ink-500">{detail.sub || transaction.id}</span>
                                  </span>
                                </button>
                              </td>
                              <td className="oc-td">
                                <span className={`oc-badge max-w-full truncate ${visual.badge}`}>{getTransactionTypeDisplay(transaction.description) || transaction.type}</span>
                              </td>
                              <td className="oc-td">
                                <span className="block truncate text-sm text-ink-700" title={transaction.projectLabel}>{transaction.projectLabel || '—'}</span>
                              </td>
                              <td className="oc-td whitespace-nowrap text-right">
                                <span className={`font-mono text-sm font-bold ${credit ? 'text-emerald-600' : 'text-ink'}`}>
                                  {credit ? '+' : '−'} {inr(transaction.amount)}
                                </span>
                                <span className={`mt-0.5 block text-[11px] font-semibold ${credit ? 'text-emerald-600' : 'text-rose-600'}`}>{transaction.type}</span>
                              </td>
                              <td className="oc-td">
                                <div className="flex items-center justify-end gap-1">
                                  <button type="button" onClick={() => openDetailsModal(transaction)} title="View details" aria-label="View details" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-800">
                                    <FiEye size={15} />
                                  </button>
                                  <button type="button" onClick={() => generatePDF(transaction)} title="Download receipt" aria-label="Download receipt" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-800">
                                    <FiDownload size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    )}
                  </table>
                </div>

                {/* Mobile cards */}
                {loading ? (
                  <MobileCardsSkeleton />
                ) : (
                  <div className="divide-y divide-line-soft md:hidden">
                    {transformedTransactions.length === 0 ? (
                      <EmptyState />
                    ) : transformedTransactions.map((transaction) => {
                      const detail = detailLines(transaction);
                      const credit = transaction.type === 'Credit';
                      const visual = typeVisual(transaction.description, credit);
                      return (
                        <article key={transaction.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${visual.tile}`}>
                              <visual.Icon size={17} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-semibold text-ink">{detail.title}</p>
                                <p className={`shrink-0 font-mono text-sm font-bold ${credit ? 'text-emerald-600' : 'text-ink'}`}>
                                  {credit ? '+' : '−'} {inr(transaction.amount)}
                                </p>
                              </div>
                              {detail.sub ? <p className="mt-0.5 truncate text-xs text-ink-500">{detail.sub}</p> : null}
                              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-400">
                                <span className={`oc-badge ${visual.badge}`}>{getTransactionTypeDisplay(transaction.description) || transaction.type}</span>
                                <span>{formatMoment(transaction.date, 'DD MMM YYYY, hh:mm A')}</span>
                                {transaction.projectLabel ? <span>· {transaction.projectLabel}</span> : null}
                              </div>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => openDetailsModal(transaction)} className="oc-btn-ghost h-8 text-xs"><FiEye size={13} /> Details</button>
                                <button type="button" onClick={() => generatePDF(transaction)} className="oc-btn-ghost h-8 text-xs"><FiDownload size={13} /> Receipt</button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {!loading && !error && transactions.length > 0 && (
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalRecords={totalRecords}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={[10, 20, 50, 100]}
                  showPageSizeSelector={true}
                  showGoToPage={true}
                />
            )}
          </section>
        </div>
      </main>

      {/* Transaction Details Modal */}
      <AnimatedModal open={isModalOpen && !!selectedTransaction}>
        {isModalOpen && selectedTransaction ? TransactionDetailsModal() : null}
      </AnimatedModal>
    </div>
  );
};

export default Transactions;
