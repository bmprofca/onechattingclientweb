import React from 'react';
import { render, screen } from '@testing-library/react';
import Reports from './Reports';

jest.mock('../component/Menu', () => ({
  Header: () => <div data-testid="reports-header" />,
  Sidebar: () => <nav data-testid="reports-sidebar" />,
}));

jest.mock('../component/reports/CampaignMessageReport', () => function MockCampaignMessageReport({ projectId }) {
  return <div data-testid="campaign-message-report" data-project-id={projectId} />;
});

describe('Reports page', () => {
  beforeEach(() => {
    localStorage.setItem('userData', JSON.stringify({ selected_project_id: 'project-a' }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders as a dedicated page and scopes its report to the selected project', () => {
    render(<Reports />);

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByTestId('reports-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('campaign-message-report')).toHaveAttribute('data-project-id', 'project-a');
  });
});
