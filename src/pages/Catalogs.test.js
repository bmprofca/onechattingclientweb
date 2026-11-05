import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Catalogs from './Catalogs';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

jest.mock('../component/Menu', () => ({
  Header: () => null,
  Sidebar: () => null,
}));

describe('Catalogs connection flow', () => {
  let popup;

  beforeEach(() => {
    localStorage.setItem('userData', JSON.stringify({
      token: 'test-token',
      username: 'test-user',
      selected_project_id: 'project-1',
    }));
    axios.post.mockReset();
    popup = { location: { href: 'about:blank' }, close: jest.fn() };
    jest.spyOn(window, 'open').mockReturnValue(popup);
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('shows Connect catalog and opens the generated connect link when not connected', async () => {
    axios.post
      .mockResolvedValueOnce({
        data: {
          error: 'Connect a Meta catalog to this WhatsApp project to view product catalogs.',
          code: 'CATALOG_NOT_CONNECTED',
        },
      })
      .mockResolvedValueOnce({
        data: { data: { url: 'https://example.com/connect-catalog' } },
      });

    render(<Catalogs />);

    const connectButtons = await screen.findAllByRole('button', { name: /connect catalog/i });
    expect(connectButtons.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Connect a Meta catalog to this WhatsApp project to view product catalogs\./i)).not.toBeInTheDocument();

    fireEvent.click(connectButtons[0]);

    await waitFor(() => {
      expect(axios.post).toHaveBeenLastCalledWith(
        expect.stringMatching(/\/catalog\/connect-link$/),
        expect.any(String),
        expect.any(Object),
      );
    });
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(popup.location.href).toBe('https://example.com/connect-catalog');
  });
});
