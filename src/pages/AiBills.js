import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import moment from 'moment';
import { FiCalendar, FiDollarSign, FiEye, FiFileText, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import { parseServerDate } from '../utils/dateTime';

const formatDate = (value, format) => {
  const date = parseServerDate(value);
  return date ? moment(date).format(format) : 'N/A';
};

const AiBills = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => JSON.parse(localStorage.getItem('sidebarMinimized') || 'false'));
  const [tokens, setTokens] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [fromDate, setFromDate] = useState(() => moment().subtract(30, 'days').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(() => moment().format('YYYY-MM-DD'));
  const [currentPage, setCurrentPage] = useState(1);
  const [detailBill, setDetailBill] = useState(null);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ total_bills: 0, total_amount: 0 });

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || 'null');
      setTokens(userData);
      // Start with the active project while still allowing users to clear the filter.
      setProjectId(userData?.selected_project_id || '');
    } catch {
      setError('Failed to load authentication data.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [mobileMenuOpen]);

  const fetchBills = useCallback(async (page = currentPage, limit = pageSize) => {
    if (!tokens?.token || !tokens?.username) return;
    try {
      setLoading(true);
      setError('');
      const params = { page, limit };
      if (projectId.trim()) params.project_id = projectId.trim();
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await axios.get(`${API_BASE_URL}/account/ai-bills`, {
        params,
        headers: { token: tokens.token, username: tokens.username }
      });
      const responseData = response.data || {};
      if (responseData.error) {
        setError(responseData.message || 'Failed to fetch AI bills.');
        return;
      }
      const pagination = responseData.pagination || {};
      setBills(Array.isArray(responseData.data) ? responseData.data : []);
      setSummary(responseData.summary || { total_bills: 0, total_amount: 0 });
      setCurrentPage(Number(pagination.page) || page);
      setPageSize(Number(pagination.limit) || limit);
      setTotalRecords(Number(pagination.total_records) || 0);
      setTotalPages(Number(pagination.total_pages) || 1);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to fetch AI bills. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tokens, projectId, fromDate, toDate, currentPage, pageSize]);

  useEffect(() => {
    if (tokens?.token && tokens?.username) fetchBills(1, pageSize);
    // Filter application is intentional; page changes are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, fromDate, toDate]);

  const applyFilters = (event) => {
    event.preventDefault();
    setCurrentPage(1);
    fetchBills(1, pageSize);
  };

  const changePage = (page) => {
    setCurrentPage(page);
    fetchBills(page, pageSize);
  };

  const changePageSize = (limit) => {
    setPageSize(limit);
    setCurrentPage(1);
    fetchBills(1, limit);
  };

  const currency = (amount) => `₹${(Number(amount) || 0).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <main className={`pt-16 transition-all duration-300 ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">AI Bills</h1>
              <p className="mt-1 text-gray-600">Review AI auto-reply usage charges across your projects.</p>
            </div>
            <button onClick={() => fetchBills(currentPage, pageSize)} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <span className="p-3 rounded-lg bg-indigo-50 text-indigo-600"><FiFileText size={22} /></span>
              <div><p className="text-sm text-gray-500">Total bills</p><p className="text-2xl font-bold text-gray-900">{summary.total_bills || 0}</p></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <span className="p-3 rounded-lg bg-rose-50 text-rose-600"><FiDollarSign size={22} /></span>
              <div><p className="text-sm text-gray-500">Total amount</p><p className="text-2xl font-bold text-gray-900">{currency(summary.total_amount)}</p></div>
            </div>
          </div>

          <form onSubmit={applyFilters} className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">Project ID</span><input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="All projects" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
            <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">From date</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate || undefined} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
            <label className="block"><span className="block text-sm font-medium text-gray-700 mb-1.5">To date</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate || undefined} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" /></label>
            <button type="submit" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"><FiSearch size={16} /> Apply filters</button>
          </form>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <table className="w-full">
                <thead className="bg-gray-50"><tr>{['#', 'Date', 'Project ID', 'Transaction type', 'Amount', ''].map((label) => <th key={label || 'actions'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</th>)}</tr></thead>
                <tbody><TableSkeletonRows rows={8} cells={['index', 'text', 'text', 'badge', 'short', 'action']} /></tbody>
              </table>
            ) : error ? <div className="p-12 text-center"><p className="text-red-600 mb-4">{error}</p><button onClick={() => fetchBills(currentPage, pageSize)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Try again</button></div>
                : <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{['#', 'Date', 'Project ID', 'Transaction type', 'Amount', ''].map((label) => <th key={label || 'actions'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-gray-100">{bills.length ? bills.map((bill, index) => <tr key={bill.transaction_id || index} className="hover:bg-gray-50"><td className="px-5 py-4 text-center text-sm text-gray-500">{(currentPage - 1) * pageSize + index + 1}</td><td className="px-5 py-4 whitespace-nowrap"><p className="text-sm font-medium text-gray-900">{formatDate(bill.create_date, 'MMM DD, YYYY')}</p><p className="text-xs text-gray-500">{formatDate(bill.create_date, 'hh:mm A')}</p></td><td className="px-5 py-4 text-sm font-mono text-gray-700 break-all">{bill.project_id || '—'}</td><td className="px-5 py-4"><span className="inline-flex px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">{bill.transaction_type || 'AI bill'}</span></td><td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">{currency(bill.amount)}</td><td className="px-3 py-4 text-right"><RowActionMenu items={[{ label: 'Details', icon: <FiEye size={15} />, onClick: () => setDetailBill(bill) }]} /></td></tr>) : <tr><td colSpan="6" className="px-5 py-12 text-center text-gray-500">No AI bills found for the selected filters.</td></tr>}</tbody>
                    </table>
                  </div>
                  <div className="md:hidden divide-y divide-gray-100">{bills.length ? bills.map((bill, index) => <article key={bill.transaction_id || index} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold text-gray-900">{bill.transaction_type || 'AI bill'}</p><p className="mt-1 text-xs text-gray-500 flex items-center gap-1"><FiCalendar size={12} />{formatDate(bill.create_date, 'MMM DD, YYYY hh:mm A')}</p></div><p className="font-bold text-rose-600">{currency(bill.amount)}</p></div><p className="mt-3 text-sm text-gray-600">{bill.remark || 'No remark provided.'}</p><p className="mt-2 text-xs font-mono text-gray-500">Project: {bill.project_id || '—'}</p></article>) : <div className="p-10 text-center text-gray-500">No AI bills found for the selected filters.</div>}</div>
                </>}
          </section>
          {!loading && !error && totalRecords > 0 && <Pagination currentPage={currentPage} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize} onPageChange={changePage} onPageSizeChange={changePageSize} pageSizeOptions={[10, 20, 50, 100]} />}
          <RecordDetailsModal
            isOpen={Boolean(detailBill)}
            onClose={() => setDetailBill(null)}
            title={detailBill?.transaction_type || 'AI bill'}
            subtitle={detailBill ? currency(detailBill.amount) : ''}
            fields={detailBill ? [
              { label: 'Date', value: formatDate(detailBill.create_date, 'MMM DD, YYYY hh:mm A') },
              { label: 'Project ID', value: detailBill.project_id },
              { label: 'Transaction ID', value: detailBill.transaction_id },
              { label: 'Remark', value: detailBill.remark },
              { label: 'Amount', value: currency(detailBill.amount) },
            ] : []}
          />
        </div>
      </main>
    </div>
  );
};

export default AiBills;
