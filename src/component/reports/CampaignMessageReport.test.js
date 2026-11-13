import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CampaignMessageReport from './CampaignMessageReport';
import { fetchCampaignReport } from '../../api/reports';
import { downloadTextFile } from '../../utils/reportExport';

jest.mock('../../api/reports', () => ({
  fetchCampaignReport: jest.fn(),
}));

jest.mock('../../utils/reportExport', () => ({
  ...jest.requireActual('../../utils/reportExport'),
  downloadTextFile: jest.fn(),
}));

jest.mock('../DateRangeFilter', () => function MockDateRangeFilter({ onChange }) {
  return <button type="button" onClick={() => onChange({ from: '2026-03-01', to: '2026-03-31' })}>Change report dates</button>;
});

const makeReport = (overrides = {}) => ({
  error: false,
  data: {
    summary: { total: 1, sent: 1, delivered: 1, read: 0, pending: 0, failed: 0 },
    rows: [{
      campaign_name: 'March launch',
      recipient: '15551234567',
      status: 'delivered',
      template_name: 'hello_world',
      create_date: '2026-03-10 10:00:00',
    }],
  },
  meta: { page: 1, limit: 25, total: 1, total_pages: 1, has_more: false, next_cursor: null, snapshot_id: 42 },
  ...overrides,
});

describe('CampaignMessageReport', () => {
  beforeEach(() => {
    fetchCampaignReport.mockReset();
  });

  it('loads project-scoped report totals and message drill-down rows', async () => {
    fetchCampaignReport.mockResolvedValue(makeReport());

    render(<CampaignMessageReport projectId="project-a" />);

    expect(await screen.findByText('March launch')).toBeInTheDocument();
    expect(screen.getByText('15551234567')).toBeInTheDocument();
    expect(screen.getByText('Campaign messages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toHaveClass('oc-btn-ghost');
    expect(screen.getByRole('button', { name: /Export PDF/ })).toHaveClass('oc-btn-primary');
    expect(fetchCampaignReport).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-a',
      from: expect.any(String),
      to: expect.any(String),
      page: 1,
      limit: 25,
    }));
  });

  it('applies selected dates and displays the filtered empty state', async () => {
    fetchCampaignReport
      .mockResolvedValueOnce(makeReport())
      .mockResolvedValueOnce(makeReport({
        data: {
          summary: { total: 0, sent: 0, delivered: 0, read: 0, pending: 0, failed: 0 },
          rows: [],
        },
        meta: { page: 1, limit: 25, total: 0, total_pages: 0, has_more: false, next_cursor: null, snapshot_id: null },
      }));

    render(<CampaignMessageReport projectId="project-a" />);
    await screen.findByText('March launch');
    fireEvent.click(screen.getByRole('button', { name: 'Change report dates' }));

    expect(await screen.findByText('No campaign messages found')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchCampaignReport).toHaveBeenLastCalledWith(expect.objectContaining({
        projectId: 'project-a',
        from: '2026-03-01',
        to: '2026-03-31',
        page: 1,
      }));
    });
  });

  it('surfaces report loading failures instead of showing an empty success state', async () => {
    fetchCampaignReport
      .mockRejectedValueOnce(new Error('Report service unavailable'))
      .mockResolvedValueOnce(makeReport());

    render(<CampaignMessageReport projectId="project-a" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Report service unavailable');
    expect(screen.queryByText('No campaign messages found')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('March launch')).toBeInTheDocument();
  });

  it('uses the report snapshot and next cursor for drill-down pagination', async () => {
    fetchCampaignReport
      .mockResolvedValueOnce(makeReport({
        data: {
          summary: { total: 26, sent: 26, delivered: 26, read: 0, pending: 0, failed: 0 },
          rows: [{ campaign_name: 'First page', recipient: '100', status: 'delivered' }],
        },
        meta: { page: 1, limit: 25, total: 26, total_pages: 2, has_more: true, next_cursor: 100, snapshot_id: 200 },
      }))
      .mockResolvedValueOnce(makeReport({
        data: {
          summary: { total: 26, sent: 26, delivered: 26, read: 0, pending: 0, failed: 0 },
          rows: [{ campaign_name: 'Second page', recipient: '101', status: 'delivered' }],
        },
        meta: { page: 2, limit: 25, total: 26, total_pages: 2, has_more: false, next_cursor: null, snapshot_id: 200 },
      }));

    render(<CampaignMessageReport projectId="project-a" />);
    expect(await screen.findByText('First page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Second page')).toBeInTheDocument();
    expect(fetchCampaignReport).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 2,
      cursor: 100,
      snapshotId: 200,
    }));
  });

  it('shows progress while a large export is fetching later pages', async () => {
    const pendingRows = Array.from({ length: 100 }, (_, index) => ({
      campaign_name: `Campaign ${index}`,
      recipient: String(index),
      status: 'pending',
      template_name: 'hello_world',
      create_date: '2026-03-10 10:00:00',
    }));
    const summary = { total: 101, sent: 0, delivered: 0, read: 0, pending: 101, failed: 0 };
    let finishSecondPage;
    const secondPage = new Promise((resolve) => { finishSecondPage = resolve; });
    fetchCampaignReport
      .mockResolvedValueOnce(makeReport({
        data: { summary, rows: pendingRows.slice(0, 25) },
        meta: { page: 1, limit: 25, total: 101, total_pages: 5, has_more: true, next_cursor: 75, snapshot_id: 101 },
      }))
      .mockResolvedValueOnce({
        data: { summary, rows: pendingRows },
        meta: { page: 1, limit: 100, total: 101, total_pages: 2, has_more: true, next_cursor: 1, snapshot_id: 101 },
      })
      .mockReturnValueOnce(secondPage);

    render(<CampaignMessageReport projectId="project-a" />);
    await screen.findByText('Campaign 0');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText('Preparing CSV export')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('value', '99'));
    finishSecondPage({
      data: { summary, rows: [pendingRows[0]] },
      meta: { page: 2, limit: 100, total: 101, total_pages: 2, has_more: false, next_cursor: null, snapshot_id: 101 },
    });
    await waitFor(() => expect(downloadTextFile).toHaveBeenCalled());
  });
});
