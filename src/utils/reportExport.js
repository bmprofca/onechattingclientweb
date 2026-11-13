export function getDefaultReportRange(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 29);
  const toYMD = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: toYMD(start), to: toYMD(end) };
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCampaignReportCsv(summary, rows, range = {}) {
  const lines = [
    ['Campaign message report'],
    ['Date range', range.from && range.to ? `${range.from} to ${range.to}` : 'All time'],
    ['Total', summary.total],
    ['Sent (including delivered and read)', summary.sent],
    ['Delivered (including read)', summary.delivered],
    ['Read', summary.read],
    ['Pending', summary.pending],
    ['Failed', summary.failed],
    [],
    ['Campaign', 'Recipient', 'Status', 'Template', 'Created'],
    ...rows.map((row) => [
      row.campaign_name,
      row.recipient,
      row.status,
      row.template_name,
      row.create_date,
    ]),
  ];
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`;
}

export function campaignReportTotalsMatch(summary, rows) {
  const totals = rows.reduce((result, row) => {
    const status = String(row.status || '').toLowerCase();
    result.total += 1;
    if (['sent', 'delivered', 'read'].includes(status)) result.sent += 1;
    if (['delivered', 'read'].includes(status)) result.delivered += 1;
    if (status === 'read') result.read += 1;
    if (status === 'pending') result.pending += 1;
    if (status === 'failed') result.failed += 1;
    return result;
  }, { total: 0, sent: 0, delivered: 0, read: 0, pending: 0, failed: 0 });

  return Object.keys(totals).every((key) => Number(summary[key] || 0) === totals[key]);
}

export function reportFilename(from, to, extension) {
  const range = from && to ? `${from}_to_${to}` : 'all_time';
  return `campaign-report_${range}.${extension}`;
}

export function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
