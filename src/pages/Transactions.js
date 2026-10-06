import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import {
  FiDownload, FiFileText, FiCalendar, FiDollarSign,
  FiRefreshCw, FiX, FiUser, FiCreditCard, FiHash,
  FiMail, FiPhone, FiCalendar as FiCalendarIcon,
  FiMessageSquare, FiCopy
} from 'react-icons/fi';
import moment from 'moment';
import { parseServerDate } from '../utils/dateTime';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import axios from 'axios';
import { Encrypt } from './encryption/payload-encryption';
import Pagination from '../component/Pagination';
import RowActionMenu from '../component/table/RowActionMenu';
import DateRangePicker from '../component/DateRangePicker';
import MultiSelect from '../component/MultiSelect';
const formatMoment = (value, format) => {
  const date = parseServerDate(value);
  return date ? moment(date).format(format) : 'N/A';
};

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
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  // Copy feedback state
  const [copiedField, setCopiedField] = useState(null);

  // Server-side filters (payload options)
  const [fromDate, setFromDate] = useState(() => moment().subtract(30, 'days').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(() => moment().format('YYYY-MM-DD'));
  const [transactionType, setTransactionType] = useState('all'); // template send | wallet topup | project renewal | project create | all
  const [entryType, setEntryType] = useState('all'); // Credit=1, Debit=0, all
  const [selectedProjects, setSelectedProjects] = useState([]); // Array of project_ids, empty array = all projects

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mobileMenuOpen]);

  // Load auth tokens
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const sessionData = localStorage.getItem('userData');
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          if (parsed && typeof parsed === 'object') {
            setTokens(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load tokens:', e);
        setError('Failed to load authentication data');
      }
    };

    loadTokens();
  }, []);

  // Fetch transactions from API
  const fetchTransactions = async (page = currentPage, limit = pageSize, overrides = {}) => {
    if (!tokens?.token || !tokens?.username) return;

    try {
      setLoading(true);
      setError('');

      const effectiveFromDate = overrides.fromDate ?? fromDate;
      const effectiveToDate = overrides.toDate ?? toDate;
      const effectiveTransactionType = overrides.transactionType ?? transactionType;
      const effectiveEntryType = overrides.entryType ?? entryType;
      const effectiveSelectedProjects = overrides.selectedProjects ?? selectedProjects;

      // When "All" is selected, pass empty array (no project_id); backend treats [] as all projects
      const projectIds = effectiveSelectedProjects;

      const payload = {
        page_no: page,
        limit: limit,
        project_ids: projectIds,
        ...(effectiveFromDate ? { from_date: effectiveFromDate } : {}),
        ...(effectiveToDate ? { to_date: effectiveToDate } : {}),
        ...(effectiveTransactionType !== 'all' ? { transaction_type: effectiveTransactionType } : {}),
        ...(effectiveEntryType !== 'all' ? { type: effectiveEntryType } : {})
      };

      console.log('📤 Fetching transactions:', payload);

      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      const response = await axios.post(
        `${API_BASE_URL}/payment/transaction-history`,
        data_pass,
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('📥 Transaction response:', response.data);

      if (response?.data?.error) {
        setError(response?.data?.message || 'Failed to fetch transactions');
        return;
      }

      const responseData = response.data;
      const newTransactions = responseData.data || [];

      setTransactions(newTransactions);

      // Totals from API
      setTotalCredit(parseFloat(responseData.total_credit || 0));
      setTotalDebit(parseFloat(responseData.total_debit || 0));

      // Extract pagination metadata
      if (responseData.meta) {
        setCurrentPage(responseData.meta.page_no || page);
        setPageSize(responseData.meta.limit || limit);
        setTotalPages(responseData.meta.total_pages || 1);
        setTotalRecords(responseData.meta.total_records || 0);
      } else {
        // Fallback if meta is not available
        setTotalRecords(newTransactions.length);
        setTotalPages(1);
      }

    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      setError('Failed to fetch transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load transactions when tokens are available
  useEffect(() => {
    if (tokens?.token && tokens?.username) {
      fetchTransactions(1, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  // Auto-apply: Fetch transactions when filters change (EXCLUDING selectedProjects)
  useEffect(() => {
    if (tokens?.token && tokens?.username) {
      setCurrentPage(1); // Reset to first page when filters change
      fetchTransactions(1, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, transactionType, entryType]); // selectedProjects removed from here

  // Fetch transactions when page or page size changes
  useEffect(() => {
    if (tokens?.token && tokens?.username) {
      fetchTransactions(currentPage, pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

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

  const getTransactionTypeDisplay = (transactionType) => {
    return (transactionType || '').split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getTypeColor = (type) => {
    return type === 'Credit'
      ? 'text-green-600 font-semibold'
      : 'text-red-600 font-semibold';
  };

  // Refresh transactions
  const handleRefresh = () => {
    if (tokens?.token && tokens?.username) {
      setCurrentPage(1);
      fetchTransactions(1, pageSize);
    }
  };

  const handleResetFilters = () => {
    const resetFromDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const resetToDate = moment().format('YYYY-MM-DD');

    setFromDate(resetFromDate);
    setToDate(resetToDate);
    setTransactionType('all');
    setEntryType('all');
    setSelectedProjects([]);

    // Fetch with reset filters
    setCurrentPage(1);
    fetchTransactions(1, pageSize, {
      fromDate: resetFromDate,
      toDate: resetToDate,
      transactionType: 'all',
      entryType: 'all',
      selectedProjects: []
    });
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  // Skeleton Loading Component for Desktop Table
  const DesktopTableSkeleton = () => (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {[1, 2, 3, 4, 5, 6].map((col) => (
              <th key={col} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: pageSize }).map((_, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {Array.from({ length: 6 }).map((_, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                  <div className={`h-4 bg-gray-100 rounded animate-pulse ${colIndex === 5 ? 'w-3/4' : 'w-full'
                    }`}></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Skeleton Loading Component for Mobile Cards
  const MobileCardsSkeleton = () => (
    <div className="md:hidden divide-y divide-gray-200">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2"></div>
              <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3"></div>
            </div>
            <div className="h-6 bg-gray-100 rounded animate-pulse w-20"></div>
          </div>
          <div className="space-y-2 mb-3">
            <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3"></div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse"></div>
            <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  );

  // Skeleton Loading Component for Summary Cards
  const SummaryCardsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-gray-100 rounded animate-pulse w-24"></div>
              <div className="h-8 bg-gray-100 rounded animate-pulse w-20"></div>
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ============= MODAL – VERTICAL LAYOUT, RECEIPT COLOR SCHEME, COPY BUTTONS =============
  const TransactionDetailsModal = () => {
    if (!selectedTransaction) return null;

    const { payment_details, message_details, create_by, remark } = selectedTransaction;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={closeDetailsModal}></div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
          <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full">
            {/* Header – indigo gradient (matches receipt header line) */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FiFileText className="w-5 h-5" />
                Transaction Details
              </h3>
              <button
                onClick={closeDetailsModal}
                className="text-white/80 hover:text-white transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Body – clean, vertical layout with receipt color accents */}
            <div className="px-6 py-5 max-h-[70vh] overflow-y-auto bg-white">

              {/* ----- BASIC INFO – LINE BY LINE (like receipt overview) ----- */}
              <div className="mb-6">
                <h4 className="text-md font-semibold text-indigo-600 mb-3 flex items-center gap-2 border-b border-indigo-200 pb-2">
                  <FiFileText className="w-4 h-4" />
                  Transaction Overview
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  {/* Transaction ID with copy */}
                  <div className="flex flex-col sm:flex-row sm:items-start group">
                    <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Transaction ID:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono text-gray-900 break-all">{selectedTransaction.id}</span>
                      <button
                        onClick={() => copyToClipboard(selectedTransaction.id, 'transactionId')}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                      >
                        <FiCopy className="w-3.5 h-3.5" />
                        {copiedField === 'transactionId' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start">
                    <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Date & Time:</span>
                    <span className="text-sm text-gray-900">{formatMoment(selectedTransaction.date, 'MMMM DD, YYYY hh:mm A')}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start">
                    <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Type:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedTransaction.type === 'Credit'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                      {selectedTransaction.type}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start">
                    <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Amount:</span>
                    <span className={`text-sm font-semibold ${selectedTransaction.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                      {selectedTransaction.type === 'Credit' ? '+' : '-'}₹{selectedTransaction.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start">
                    <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Transaction Type:</span>
                    <span className="text-sm text-gray-900">{getTransactionTypeDisplay(selectedTransaction.description)}</span>
                  </div>
                </div>
              </div>

              {/* ----- PAYMENT DETAILS – if available ----- */}
              {payment_details && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-indigo-600 mb-3 flex items-center gap-2 border-b border-indigo-200 pb-2">
                    <FiCreditCard className="w-4 h-4" />
                    Payment Details
                  </h4>
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-2">
                    {/* Payment ID with copy */}
                    <div className="flex flex-col sm:flex-row sm:items-start group">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Payment ID:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-gray-800 break-all">
                          {payment_details.payment_id || 'N/A'}
                        </span>
                        {payment_details.payment_id && (
                          <button
                            onClick={() => copyToClipboard(payment_details.payment_id, 'paymentId')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                            {copiedField === 'paymentId' ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* UTR with copy */}
                    <div className="flex flex-col sm:flex-row sm:items-start group">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">UTR:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-gray-800 break-all">
                          {payment_details.utr || 'N/A'}
                        </span>
                        {payment_details.utr && (
                          <button
                            onClick={() => copyToClipboard(payment_details.utr, 'utr')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                            {copiedField === 'utr' ? 'Copied!' : 'Copy'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Name:</span>
                      <span className="text-sm text-gray-900">{payment_details.name || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Email:</span>
                      <span className="text-sm text-gray-900 break-all">{payment_details.email || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Mobile:</span>
                      <span className="text-sm text-gray-900">{payment_details.mobile || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Payment Date:</span>
                      <span className="text-sm text-gray-900">
                        {payment_details.create_date ? formatMoment(payment_details.create_date, 'MMMM DD, YYYY hh:mm A') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ----- MESSAGE DETAILS – if available ----- */}
              {message_details && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-indigo-600 mb-3 flex items-center gap-2 border-b border-indigo-200 pb-2">
                    <FiMessageSquare className="w-4 h-4" />
                    Message Details
                  </h4>
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Template Name:</span>
                      <span className="text-sm text-gray-900">{message_details.template_name || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Number:</span>
                      <span className="text-sm text-gray-900">{message_details.number || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Category:</span>
                      <span className="text-sm text-gray-900">{message_details.category || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Language:</span>
                      <span className="text-sm text-gray-900">{message_details.language_code || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Message By:</span>
                      <span className="text-sm text-gray-900">{message_details.message_by || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">WAMID:</span>
                      <span className="text-sm font-mono bg-white px-2 py-0.5 rounded border border-purple-200 text-gray-800 break-all">{message_details.wamid || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start">
                      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Message Date:</span>
                      <span className="text-sm text-gray-900">
                        {message_details.create_date ? formatMoment(message_details.create_date, 'MMMM DD, YYYY hh:mm A') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ----- REMARK & CREATED BY – side by side on large screens, stacked on mobile ----- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {remark && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <FiFileText className="w-3 h-3" />
                      Remark
                    </span>
                    <p className="text-sm text-gray-900">{remark}</p>
                  </div>
                )}
                {create_by && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <FiUser className="w-3 h-3" />
                      Created By
                    </span>
                    <p className="text-sm font-medium text-indigo-600">{create_by.username || 'N/A'}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end border-t border-gray-100">
              <button
                onClick={closeDetailsModal}
                className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
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

      {/* Main content */}
      <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="w-full px-4 py-5">
          {/* Header Section */}
          <div className="mb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Transactions</h1>
              <p className="mt-1 text-sm text-slate-500">View and download receipts for all your transactions</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
            {error && (
              <div className="mt-2 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Summary Cards - Show skeleton when loading */}
          {loading ? (
            <SummaryCardsSkeleton />
          ) : !error ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Records</p>
                    <p className="text-2xl font-bold text-gray-900">{totalRecords || transformedTransactions.length}</p>
                  </div>
                  <div className="bg-indigo-100 rounded-lg p-3">
                    <FiFileText className="text-indigo-600" size={24} />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Credit</p>
                    <p className="text-2xl font-bold text-green-600">₹{Number(totalCredit || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-green-100 rounded-lg p-3">
                    <FiDollarSign className="text-green-600" size={24} />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Debit</p>
                    <p className="text-2xl font-bold text-red-600">₹{Number(totalDebit || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3">
                    <FiCalendar className="text-blue-600" size={24} />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Filters - Show only when not loading or has error */}
          {!loading && !error && (
            <div className="bg-white rounded-xl shadow p-4 md:p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                <button
                  onClick={handleResetFilters}
                  disabled={loading}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reset All
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Unified Date Range Picker */}
                {/* Unified Date Range Picker */}
                <DateRangePicker
                  startDate={fromDate}
                  endDate={toDate}
                  onStartDateChange={setFromDate}
                  onEndDateChange={setToDate}
                  maxDate={moment().format('YYYY-MM-DD')}
                />

                {/* Transaction Type Dropdown - with Project Create */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                  <SearchableSelect
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'template send', label: 'Template Send' },
                      { value: 'wallet topup', label: 'Wallet Topup' },
                      { value: 'project renewal', label: 'Project Renewal' },
                      { value: 'project create', label: 'Project Create' },
                    ]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-800 font-medium"
                  />
                </div>

                {/* Entry Type Dropdown - Premium */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type</label>
                  <SearchableSelect
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value)}
                    options={[
                      { value: 'all', label: 'All' },
                      { value: '1', label: 'Credit' },
                      { value: '0', label: 'Debit' },
                    ]}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-800 font-medium"
                  />
                </div>

                {/* Multi-Select Projects */}
                <div>
                  <MultiSelect
                    options={(tokens?.projects || []).map(project => ({
                      value: project.project_id,
                      label: project.name
                    }))}
                    selectedValues={selectedProjects}
                    onChange={(newSelectedProjects) => {
                      setSelectedProjects([...newSelectedProjects]);
                    }}
                    onSearch={(selectedProjectIds) => {
                      console.log('Searching with projects:', selectedProjectIds);
                      setCurrentPage(1);
                      fetchTransactions(1, pageSize, {
                        selectedProjects: selectedProjectIds
                      });
                    }}
                    label="Projects"
                    placeholder="Select projects"
                    allOptionLabel="All Projects"
                    showSearchButton={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Transactions Table with Skeleton Loading */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <>
                <DesktopTableSkeleton />
                <MobileCardsSkeleton />
              </>
            ) : error ? (
              <div className="p-8">
                <div className="text-center">
                  <div className="text-red-500 mb-4">
                    <FiFileText size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Transactions</h3>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
                  <table className="w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                      <tr>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200/50">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="text-gray-400">#</div>
                            <div>S.No</div>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200/50">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <div>Date</div>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200/50">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>Transaction Type</div>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200/50">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>Type</div>
                          </div>
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200/50">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>Amount</div>
                          </div>
                        </th>
                        <th className="w-16 px-3 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {transformedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                              </svg>
                              <div>
                                <p className="text-gray-500 font-medium">No transactions found</p>
                                <p className="text-gray-400 text-sm mt-1">Transactions will appear here once available</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        transformedTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50/80 transition-all duration-150 group">
                            <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 text-center align-middle">
                              <div className="flex items-center justify-center">
                                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
                                  {transaction.serialNumber}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 text-center align-middle">
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {formatMoment(transaction.date, 'MMM DD, YYYY')}
                                </div>
                                <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md inline-flex items-center justify-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatMoment(transaction.date, 'hh:mm A')}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 border-r border-gray-100 text-center align-middle">
                              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium justify-center">
                                {getTransactionTypeDisplay(transaction.description)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 text-center align-middle">
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold justify-center ${transaction.type === 'Credit' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                                {transaction.type === 'Credit' ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                  </svg>
                                )}
                                {transaction.type}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap border-r border-gray-100 text-center align-middle">
                              <div className={`flex items-center justify-center gap-2 text-lg font-semibold ${transaction.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {transaction.type === 'Credit' ? (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                  </svg>
                                )}
                                <span>{transaction.type === 'Credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-4 text-right align-middle">
                              <RowActionMenu
                                items={[
                                  { label: 'Details', icon: <FiFileText size={15} />, onClick: () => openDetailsModal(transaction) },
                                  { label: 'Receipt', icon: <FiDownload size={15} />, onClick: () => generatePDF(transaction) },
                                ]}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {transformedTransactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No transactions found
                    </div>
                  ) : (
                    transformedTransactions.map((transaction) => (
                      <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-gray-500">#{transaction.serialNumber}</span>
                              <span className="text-sm font-semibold text-gray-900">{transaction.id}</span>
                            </div>
                            <p className="text-xs text-gray-500">{transaction.invoiceNumber}</p>
                          </div>
                          <span className={getTypeColor(transaction.type)}>
                            {transaction.type === 'Credit' ? '+' : '-'}₹{transaction.amount.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{getTransactionTypeDisplay(transaction.description)}</p>

                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                          <span>{formatMoment(transaction.date, 'MMM DD, YYYY hh:mm A')}</span>
                          <span>•</span>
                          <span className={getTypeColor(transaction.type)}>{transaction.type}</span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => generatePDF(transaction)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                          >
                            <FiDownload size={16} />
                            <span>Receipt</span>
                          </button>
                          <button
                            onClick={() => openDetailsModal(transaction)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Details
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
          </div>
        </div>
      </div>

      {/* Transaction Details Modal */}
      {isModalOpen && <TransactionDetailsModal />}
    </div>
  );
};

export default Transactions;
