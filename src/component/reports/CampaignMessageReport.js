import React, { useEffect, useState } from 'react';
import {
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiEye,
  FiFileText,
  FiMessageSquare,
  FiSend,
  FiXCircle,
} from 'react-icons/fi';
import DateRangeFilter from '../DateRangeFilter';
import StatCard from '../StatCard';
import { fetchCampaignReport } from '../../api/reports';
import {
  buildCampaignReportCsv,
  campaignReportTotalsMatch,
  downloadTextFile,
  getDefaultReportRange,
  reportFilename,
} from '../../utils/reportExport';

function formatRangeLabel(from, to) {
  const parseYMD = (value) => {
    if (!value || typeof value !== 'string') return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const formatShort = (date, withYear = true) => {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]}${withYear ? ` ${date.getFullYear()}` : ''}`;
  };

  const start = parseYMD(from);
  const end = parseYMD(to);

  if (start && end) {
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate()) {
      return formatShort(start);
    }
    const sameYear = start.getFullYear() === end.getFullYear();
    return `${formatShort(start, !sameYear)} – ${formatShort(end)}`;
  }

  if (start) return `From ${formatShort(start)}`;
  if (end) return `Until ${formatShort(end)}`;
  return 'All time';
}

const REPORT_PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 100;

const METRICS = [
  { key: 'total', label: 'Campaign messages', hint: 'In selected period', icon: FiMessageSquare, tone: 'brand' },
  { key: 'sent', label: 'Sent', hint: 'Includes delivered and read', icon: FiSend, tone: 'ink' },
  { key: 'delivered', label: 'Delivered', hint: 'Includes read messages', icon: FiCheckCircle, tone: 'emerald' },
  { key: 'read', label: 'Read', hint: 'Read by recipient', icon: FiEye, tone: 'brand' },
  { key: 'pending', label: 'Pending', hint: 'Awaiting delivery status', icon: FiClock, tone: 'amber' },
  { key: 'failed', label: 'Failed', hint: 'Not delivered', icon: FiXCircle, tone: 'rose' },
];

function formatCreatedAt(value) {
  if (!value) return '—';
  return String(value).replace('T', ' ').replace(/\.\d+Z?$/, '');
}

export default function CampaignMessageReport({ projectId }) {
  const [range, setRange] = useState(() => getDefaultReportRange());
  const [page, setPage] = useState(1);
  const [cursorStack, setCursorStack] = useState([null]);
  const [snapshotId, setSnapshotId] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [exporting, setExporting] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setReport(null);
      setError('Select a project to view reports.');
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setReport(null);
    setError('');

    fetchCampaignReport({
      projectId,
      ...range,
      page,
      limit: REPORT_PAGE_SIZE,
      cursor: cursorStack[page - 1],
      snapshotId: page > 1 ? snapshotId : null,
      signal: controller.signal,
    }).then((result) => {
      if (!active) return;
      setReport(result);
    }).catch((requestError) => {
      if (!active || requestError?.name === 'CanceledError' || requestError?.code === 'ERR_CANCELED') return;
      setError(requestError?.message || 'Failed to load report. Please try again.');
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [projectId, range, page, cursorStack, snapshotId, retryKey]);

  const handleRangeChange = (nextRange) => {
    setRange(nextRange);
    setPage(1);
    setCursorStack([null]);
    setSnapshotId(null);
    setReport(null);
  };

  const exportReport = async (format) => {
    if (!report || !projectId) return;
    setExporting(format);
    setExportProgress(0);
    setExportError('');

    try {
      const firstPage = await fetchCampaignReport({
        projectId,
        ...range,
        page: 1,
        limit: EXPORT_PAGE_SIZE,
      });
      const summary = firstPage.data.summary;
      const rows = [...firstPage.data.rows];
      const exportSnapshot = firstPage.meta.snapshot_id || null;
      let nextCursor = firstPage.meta.next_cursor;
      let exportPage = 1;
      setExportProgress(summary.total ? Math.min(99, Math.round((rows.length / summary.total) * 100)) : 100);

      while (nextCursor) {
        exportPage += 1;
        const next = await fetchCampaignReport({
          projectId,
          ...range,
          page: exportPage,
          limit: EXPORT_PAGE_SIZE,
          cursor: nextCursor,
          snapshotId: exportSnapshot,
        });
        rows.push(...next.data.rows);
        nextCursor = next.meta.next_cursor;
        setExportProgress(summary.total ? Math.min(99, Math.round((rows.length / summary.total) * 100)) : 100);
      }

      if (rows.length !== summary.total) {
        throw new Error(`Export incomplete: received ${rows.length} of ${summary.total} report rows. Please retry.`);
      }
      if (!campaignReportTotalsMatch(summary, rows)) {
        throw new Error('Report statuses changed during export. Please retry so the totals and rows match.');
      }

      const filename = reportFilename(range.from, range.to, format);
      if (format === 'csv') {
        downloadTextFile(buildCampaignReportCsv(summary, rows, range), filename, 'text/csv;charset=utf-8');
      } else {
        const [{ jsPDF }, { default: autoTable }] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable'),
        ]);
        const pdf = new jsPDF({ orientation: 'landscape' });
        pdf.setFontSize(16);
        pdf.text('Campaign message report', 14, 16);
        pdf.setFontSize(9);
        pdf.text(`Date range: ${range.from && range.to ? `${range.from} to ${range.to}` : 'All time'}`, 14, 23);
        pdf.text(
          `Total ${summary.total} · Sent ${summary.sent} · Delivered ${summary.delivered} · Read ${summary.read} · Pending ${summary.pending} · Failed ${summary.failed}`,
          14,
          29
        );
        autoTable(pdf, {
          startY: 35,
          head: [['Campaign', 'Recipient', 'Status', 'Template', 'Created']],
          body: rows.map((row) => [
            row.campaign_name || '—',
            row.recipient || '—',
            row.status || '—',
            row.template_name || '—',
            formatCreatedAt(row.create_date),
          ]),
          styles: { fontSize: 8, overflow: 'linebreak' },
        });
        pdf.save(filename);
      }
      setExportProgress(100);
    } catch (exportRequestError) {
      setExportError(exportRequestError?.message || `Failed to export ${format.toUpperCase()}. Please try again.`);
    } finally {
      setExporting('');
    }
  };

  const summary = report?.data?.summary;
  const meta = report?.meta;
  const canGoNext = Boolean(meta?.has_more && meta?.next_cursor);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="oc-card p-4 sm:p-5" aria-labelledby="campaign-message-report-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-50 text-brand-700">
              <FiBarChart2 size={19} />
            </span>
            <div>
              <h2 id="campaign-message-report-title" className="text-base font-bold text-ink">Campaign performance</h2>
              <p className="mt-1 text-[13px] text-ink-500">Delivery totals and message-level details for the selected project.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="min-w-0 flex-1 sm:w-[290px] sm:flex-none">
              <DateRangeFilter from={range.from} to={range.to} onChange={handleRangeChange} align="right" />
            </div>
            <button
              type="button"
              aria-pressed={!range.from && !range.to}
              onClick={() => handleRangeChange({ from: '', to: '' })}
              className={!range.from && !range.to ? 'oc-btn-primary h-[42px] shrink-0' : 'oc-btn-ghost h-[42px] shrink-0'}
            >
              All time
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Campaign message summary">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Delivery summary</h2>
          <span className="text-xs text-ink-500">{formatRangeLabel(range.from, range.to)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
          {METRICS.map((metric) => (
            <StatCard
              key={metric.key}
              icon={metric.icon}
              tone={metric.tone}
              label={metric.label}
              hint={metric.hint}
              value={Number(summary?.[metric.key] || 0).toLocaleString('en-IN')}
              loading={loading && !summary}
            />
          ))}
        </div>
      </section>

      <section className="oc-card overflow-hidden" aria-labelledby="campaign-message-details-title">
        <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="campaign-message-details-title" className="text-[15px] font-bold text-ink">Campaign message details</h2>
            <p className="mt-1 text-xs text-ink-500">
              {summary ? `${Number(summary.total || 0).toLocaleString('en-IN')} messages · ${formatRangeLabel(range.from, range.to)}` : 'Loading report data'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => exportReport('csv')} disabled={Boolean(exporting) || loading || !summary?.total} className="oc-btn-ghost">
              <FiDownload size={15} /> Export CSV
            </button>
            <button type="button" onClick={() => exportReport('pdf')} disabled={Boolean(exporting) || loading || !summary?.total} className="oc-btn-primary">
              <FiFileText size={15} /> Export PDF
            </button>
          </div>
        </div>

        {exporting && (
          <div className="border-b border-line-soft px-4 py-3 sm:px-5" role="status" aria-live="polite">
            <div className="mb-1.5 flex justify-between text-xs text-ink-500">
              <span>Preparing {exporting.toUpperCase()} export</span><span>{exportProgress}%</span>
            </div>
            <progress className="h-2 w-full accent-brand-600" max="100" value={exportProgress} />
          </div>
        )}
        {exportError && <div role="alert" className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 sm:mx-5">{exportError}</div>}

        {error ? (
          <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><FiXCircle size={22} /></span>
            <h3 className="text-base font-bold text-ink">Unable to load report</h3>
            <p className="mt-1 max-w-md text-sm text-ink-500">{error}</p>
            {projectId && <button type="button" className="oc-btn-primary mt-4" onClick={() => setRetryKey((current) => current + 1)}>Retry</button>}
          </div>
        ) : loading && !report ? (
          <div className="flex flex-col items-center px-6 py-12 text-center text-sm text-ink-500">
            <span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden="true" />
            Loading campaign report…
          </div>
        ) : report && summary.total === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-soft text-ink-400"><FiBarChart2 size={22} /></span>
            <h3 className="text-base font-bold text-ink">No campaign messages found</h3>
            <p className="mt-1 max-w-md text-sm text-ink-500">There are no campaign messages for {formatRangeLabel(range.from, range.to).toLowerCase()}.</p>
          </div>
        ) : report ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed">
                <colgroup>
                  <col />
                  <col className="w-[190px]" />
                  <col className="w-[130px]" />
                  <col />
                  <col className="w-[170px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="oc-th">Campaign</th>
                    <th className="oc-th">Recipient</th>
                    <th className="oc-th">Status</th>
                    <th className="oc-th">Template</th>
                    <th className="oc-th">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.rows.map((row, index) => (
                    <tr key={`${row.recipient}-${row.create_date}-${index}`} className="transition-colors hover:bg-surface-soft">
                      <td className="oc-td max-w-[220px] truncate font-medium text-ink" title={row.campaign_name}>{row.campaign_name || '—'}</td>
                      <td className="oc-td font-mono text-xs text-ink-700">{row.recipient || '—'}</td>
                      <td className="oc-td">
                        <span className={`oc-badge capitalize ${
                          row.status === 'failed' ? 'bg-rose-50 text-rose-700'
                            : row.status === 'delivered' || row.status === 'read' ? 'bg-emerald-50 text-emerald-700'
                              : row.status === 'pending' ? 'bg-amber-50 text-amber-700'
                                : 'bg-brand-50 text-brand-700'
                        }`}>{row.status || 'Unknown'}</span>
                      </td>
                      <td className="oc-td max-w-[200px] truncate text-ink-700" title={row.template_name}>{row.template_name || '—'}</td>
                      <td className="oc-td whitespace-nowrap text-xs text-ink-500">{formatCreatedAt(row.create_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summary.total > 0 && (
              <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <span className="text-xs text-ink-500">
                  Page {page} of {Math.max(1, Math.ceil(summary.total / REPORT_PAGE_SIZE))} · {Number(summary.total).toLocaleString('en-IN')} messages
                </span>
                <div className="flex gap-2">
                  <button type="button" className="oc-btn-ghost h-8" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
                  <button
                    type="button"
                    className="oc-btn-ghost h-8"
                    disabled={!canGoNext || loading}
                    onClick={() => {
                      setCursorStack((current) => [...current.slice(0, page), meta.next_cursor]);
                      setSnapshotId(meta.snapshot_id || null);
                      setPage((current) => current + 1);
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
