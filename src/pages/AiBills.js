import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import moment from 'moment';
import {
  FiRefreshCw, FiCpu, FiDollarSign, FiHash, FiActivity, FiCalendar,
  FiEye, FiRotateCcw, FiInbox, FiAlertCircle, FiZap
} from 'react-icons/fi';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import ProjectFilter from '../component/ProjectFilter';
import DateRangeFilter, { formatRangeLabel, parseYMD } from '../component/DateRangeFilter';
import StatCard from '../component/StatCard';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { parseServerDate } from '../utils/dateTime';

const formatDate = (value, format) => {
  const date = parseServerDate(value);
  return date ? moment(date).format(format) : 'N/A';
};

const currency = (amount, digits = 2) =>
  `INR ${(Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const isOwnedProject = (project) => project?.owned === true || project?.type === 'admin';

const defaultFrom = () => moment().subtract(29, 'days').format('YYYY-MM-DD');
const defaultTo = () => moment().format('YYYY-MM-DD');

const AiBills = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => JSON.parse(localStorage.getItem('sidebarMinimized') || 'false'));
  const [tokens, setTokens] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailBill, setDetailBill] = useState(null);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ total_bills: 0, total_amount: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('userData') || 'null');
      setTokens(userData);
      if (!userData?.token) {
        setError('Your session has expired. Please sign in again.');
        setLoading(false);
      }
    } catch {
      setError('Failed to load authentication data.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [mobileMenuOpen]);

  const fetchBills = useCallback(async () => {
    if (!tokens?.token || !tokens?.username) return;
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError('');
      const params = { page: currentPage, limit: pageSize };
      if (selectedProjects.length) params.project_ids = selectedProjects.join(',');
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await axios.get(`${API_BASE_URL}/account/ai-bills`, {
        params,
        headers: { token: tokens.token, username: tokens.username }
      });
      if (requestId !== requestIdRef.current) return;
      const responseData = response.data || {};
      if (responseData.error) {
        setError(responseData.message || 'Failed to fetch AI bills.');
        return;
      }
      const pagination = responseData.pagination || {};
      setBills(Array.isArray(responseData.data) ? responseData.data : []);
      setSummary(responseData.summary || { total_bills: 0, total_amount: 0 });
      setTotalRecords(Number(pagination.total_records) || 0);
      setTotalPages(Number(pagination.total_pages) || 1);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setError(requestError?.response?.data?.message || requestError?.response?.data?.error || 'Failed to fetch AI bills. Please try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [tokens, selectedProjects, fromDate, toDate, currentPage, pageSize]);

  // One fetch per filter / paging change
  useEffect(() => {
    fetchBills();
  }, [fetchBills, refreshKey]);

  const projectOptions = useMemo(() => {
    const list = (tokens?.projects || [])
      .filter(isOwnedProject)
      .map((project) => ({ value: String(project.project_id), label: project.name || String(project.project_id) }));
    return list;
  }, [tokens]);

  const handleDateChange = ({ from, to }) => {
    setFromDate(from);
    setToDate(to);
    setCurrentPage(1);
  };

  const handleProjects = (next) => {
    setSelectedProjects(next);
    setCurrentPage(1);
  };

  const filtersDirty = selectedProjects.length > 0 || fromDate !== defaultFrom() || toDate !== defaultTo();

  const resetFilters = () => {
    setSelectedProjects([]);
    setFromDate(defaultFrom());
    setToDate(defaultTo());
    setCurrentPage(1);
  };

  const projectLabel = (bill) => {
    if (bill?.project_name) return bill.project_name;
    const id = bill?.project_id;
    if (!id) return '';
    const match = (tokens?.projects || []).find((project) => String(project.project_id) === String(id));
    return match?.name || id;
  };

  const changePage = (page) => setCurrentPage(page);
  const changePageSize = (limit) => {
    setPageSize(limit);
    setCurrentPage(1);
  };

  // ---- Derived KPIs (all from the API summary for the selected filters) ----
  const totalAmount = Number(summary.total_amount) || 0;
  const totalBills = Number(summary.total_bills) || 0;
  const average = totalBills > 0 ? totalAmount / totalBills : 0;
  const rangeStart = parseYMD(fromDate);
  const rangeEnd = parseYMD(toDate);
  const rangeDays = rangeStart && rangeEnd ? Math.round((rangeEnd - rangeStart) / 86400000) + 1 : 0;
  const dailyAverage = rangeDays > 0 ? totalAmount / rangeDays : 0;
  const rangeLabel = formatRangeLabel(fromDate, toDate);
  const firstRow = totalRecords ? (currentPage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(currentPage * pageSize, totalRecords);
  const kpiLoading = loading && !error;

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <FiInbox size={24} />
      </span>
      <h3 className="text-base font-bold text-ink">No AI bills in this view</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">
        No AI auto-reply charges for <span className="font-semibold text-ink-700">{rangeLabel}</span>
        {selectedProjects.length ? ' in the selected projects' : ''}. Try a wider date range or another project.
      </p>
      {filtersDirty && (
        <button type="button" onClick={resetFilters} className="oc-btn-ghost mt-5">
          <FiRotateCcw size={14} /> Reset filters
        </button>
      )}
    </div>
  );

  const SkeletonRows = () => (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="oc-td"><div className="mx-auto h-3 w-5 rounded bg-surface-soft" /></td>
          <td className="oc-td"><div className="h-3 w-20 rounded bg-surface-soft" /><div className="mt-2 h-2.5 w-12 rounded bg-surface-soft" /></td>
          <td className="oc-td">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-[10px] bg-surface-soft" />
              <div className="flex-1"><div className="h-3 w-40 rounded bg-surface-soft" /><div className="mt-2 h-2.5 w-28 rounded bg-surface-soft" /></div>
            </div>
          </td>
          <td className="oc-td"><div className="h-3 w-24 rounded bg-surface-soft" /></td>
          <td className="oc-td"><div className="ml-auto h-3 w-16 rounded bg-surface-soft" /></td>
          <td className="oc-td"><div className="ml-auto h-8 w-8 rounded-lg bg-surface-soft" /></td>
        </tr>
      ))}
    </tbody>
  );

  return (
    <div className="min-h-screen bg-surface-ground">
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <main className={`pt-16 transition-all duration-300 ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
          {/* ---------- Page header ---------- */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.7)] sm:flex">
                <FiCpu size={22} />
              </span>
              <div>
                <h1 className="oc-page-title">AI bills</h1>
                <p className="oc-page-sub !mt-1">Charges for AI auto-replies across your projects.</p>
              </div>
            </div>
            <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} className="oc-btn-ghost self-start sm:self-auto">
              <FiRefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {/* ---------- KPI cards ---------- */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={FiDollarSign} tone="brand" label="Total spend" value={currency(totalAmount)} hint={rangeLabel} loading={kpiLoading} />
            <StatCard icon={FiHash} tone="amber" label="AI replies billed" value={totalBills.toLocaleString('en-IN')} hint="Bills in range" loading={kpiLoading} />
            <StatCard icon={FiActivity} tone="emerald" valueTone="brand" label="Avg per reply" value={totalBills ? currency(average, average < 1 ? 4 : 2) : '—'} hint="Total ÷ bills" loading={kpiLoading} />
            <StatCard
              icon={FiCalendar}
              tone="ink"
              label="Daily average"
              value={rangeDays ? currency(dailyAverage) : '—'}
              hint={rangeDays ? `Over ${rangeDays} day${rangeDays === 1 ? '' : 's'}` : 'Pick a date range'}
              loading={kpiLoading}
            />
          </div>

          {/* ---------- Filter toolbar ---------- */}
          <div className="oc-card mb-4 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(260px,320px)_minmax(200px,260px)_auto] lg:justify-start">
              <DateRangeFilter from={fromDate} to={toDate} onChange={handleDateChange} disabled={!tokens} />
              <ProjectFilter options={projectOptions} value={selectedProjects} onChange={handleProjects} />
              <button type="button" onClick={resetFilters} disabled={!filtersDirty} className="oc-btn-ghost h-[42px] sm:col-span-2 lg:col-span-1">
                <FiRotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* ---------- Table card ---------- */}
          <section className="oc-card overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-line-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="text-[15px] font-bold text-ink">Billing history</h2>
              <p className="text-xs text-ink-500">
                {loading ? 'Loading…' : totalRecords ? (
                  <>Showing <span className="font-semibold text-ink-700">{firstRow}–{lastRow}</span> of <span className="font-semibold text-ink-700">{totalRecords.toLocaleString('en-IN')}</span> · {rangeLabel}</>
                ) : rangeLabel}
              </p>
            </div>

            {error ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><FiAlertCircle size={24} /></span>
                <h3 className="mb-1 text-base font-bold text-ink">Unable to load AI bills</h3>
                <p className="mb-5 text-sm text-ink-500">{error}</p>
                <button type="button" onClick={() => setRefreshKey((k) => k + 1)} className="oc-btn-primary">Try again</button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] table-fixed">
                    <colgroup>
                      <col className="w-[52px]" />
                      <col className="w-[130px]" />
                      <col />
                      <col className="w-[180px]" />
                      <col className="w-[130px]" />
                      <col className="w-[72px]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="oc-th text-center">#</th>
                        <th className="oc-th">Date</th>
                        <th className="oc-th">Bill</th>
                        <th className="oc-th">Project</th>
                        <th className="oc-th text-right">Amount</th>
                        <th className="oc-th text-right"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    {loading ? (
                      <SkeletonRows />
                    ) : (
                      <tbody>
                        {bills.length ? bills.map((bill, index) => (
                          <tr key={bill.transaction_id || index} className="group transition-colors hover:bg-surface-soft">
                            <td className="oc-td text-center text-xs text-ink-400 oc-num">{(currentPage - 1) * pageSize + index + 1}</td>
                            <td className="oc-td whitespace-nowrap">
                              <span className="block text-sm font-semibold text-ink">{formatDate(bill.create_date, 'DD MMM YYYY')}</span>
                              <span className="block text-xs text-ink-400">{formatDate(bill.create_date, 'hh:mm A')}</span>
                            </td>
                            <td className="oc-td">
                              <button type="button" onClick={() => setDetailBill(bill)} className="flex w-full min-w-0 items-center gap-3 text-left">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                                  <FiZap size={16} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-ink group-hover:text-brand-800">{bill.remark || bill.transaction_type || 'AI auto-reply'}</span>
                                  <span className="block truncate font-mono text-[11px] text-ink-400">{bill.transaction_id || '—'}</span>
                                </span>
                              </button>
                            </td>
                            <td className="oc-td">
                              <span className="block truncate text-sm text-ink-700" title={String(projectLabel(bill) || '')}>{projectLabel(bill) || '—'}</span>
                            </td>
                            <td className="oc-td whitespace-nowrap text-right font-mono text-sm font-bold text-ink">{currency(bill.amount)}</td>
                            <td className="oc-td">
                              <div className="flex justify-end">
                                <button type="button" onClick={() => setDetailBill(bill)} title="View details" aria-label="View details" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-brand-50 hover:text-brand-800">
                                  <FiEye size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="6"><EmptyState /></td></tr>
                        )}
                      </tbody>
                    )}
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="divide-y divide-line-soft dark:divide-[#2E2A44] md:hidden">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex animate-pulse items-center gap-3 p-4">
                        <div className="h-10 w-10 rounded-[10px] bg-surface-soft" />
                        <div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-surface-soft" /><div className="h-2.5 w-1/3 rounded bg-surface-soft" /></div>
                        <div className="h-3 w-14 rounded bg-surface-soft" />
                      </div>
                    ))
                  ) : bills.length ? bills.map((bill, index) => (
                    <button
                      type="button"
                      key={bill.transaction_id || index}
                      onClick={() => setDetailBill(bill)}
                      className="flex w-full items-start gap-3 p-4 text-left active:bg-surface-soft"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                        <FiZap size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-semibold text-ink">{bill.remark || bill.transaction_type || 'AI auto-reply'}</span>
                          <span className="shrink-0 font-mono text-sm font-bold text-ink">{currency(bill.amount)}</span>
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-400">{bill.transaction_id || '—'}</span>
                        <span className="mt-1.5 block text-xs text-ink-500">
                          {formatDate(bill.create_date, 'DD MMM YYYY, hh:mm A')}
                          {projectLabel(bill) ? ` · ${projectLabel(bill)}` : ''}
                        </span>
                      </span>
                    </button>
                  )) : <EmptyState />}
                </div>
              </>
            )}

            {!loading && !error && totalRecords > 0 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} totalRecords={totalRecords} pageSize={pageSize} onPageChange={changePage} onPageSizeChange={changePageSize} pageSizeOptions={[10, 20, 50, 100]} />
            )}
          </section>

          <RecordDetailsModal
            isOpen={Boolean(detailBill)}
            onClose={() => setDetailBill(null)}
            title={detailBill?.transaction_type || 'AI bill'}
            subtitle={detailBill ? currency(detailBill.amount) : ''}
            fields={detailBill ? [
              { label: 'Date', value: formatDate(detailBill.create_date, 'DD MMM YYYY, hh:mm A') },
              { label: 'Project', value: projectLabel(detailBill) },
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
