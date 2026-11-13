import {
  buildCampaignReportCsv,
  campaignReportTotalsMatch,
  getDefaultReportRange,
  reportFilename,
} from './reportExport';

describe('report export helpers', () => {
  it('creates local-calendar default dates and date-specific filenames', () => {
    expect(getDefaultReportRange(new Date(2026, 2, 31))).toEqual({
      from: '2026-03-02',
      to: '2026-03-31',
    });
    expect(reportFilename('2026-03-01', '2026-03-31', 'csv')).toBe('campaign-report_2026-03-01_to_2026-03-31.csv');
  });

  it('exports report totals and safely quotes potentially unsafe CSV values', () => {
    const csv = buildCampaignReportCsv(
      { total: 1, sent: 1, delivered: 1, read: 0, pending: 0, failed: 0 },
      [{ campaign_name: '=SUM(A1:A2)', recipient: '123,"456', status: 'sent', template_name: 'Hello', create_date: '2026-03-01 10:00:00' }],
      { from: '2026-03-01', to: '2026-03-31' }
    );
    expect(csv).toContain('"Total","1"');
    expect(csv).toContain('"Date range","2026-03-01 to 2026-03-31"');
    expect(csv).toContain('"\'=SUM(A1:A2)"');
    expect(csv).toContain('"123,""456"');
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('refuses report totals that no longer reconcile with exported rows', () => {
    const rows = [
      { status: 'delivered' },
      { status: 'failed' },
    ];
    expect(campaignReportTotalsMatch({
      total: 2, sent: 1, delivered: 1, read: 0, pending: 0, failed: 1,
    }, rows)).toBe(true);
    expect(campaignReportTotalsMatch({
      total: 2, sent: 2, delivered: 1, read: 0, pending: 0, failed: 1,
    }, rows)).toBe(false);
  });
});
