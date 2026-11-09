import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { checkSession } from '../api/auth';
import ProtectedRoute from './ProtectedRoute';

jest.mock('../api/auth', () => ({
  checkSession: jest.fn(),
}));

describe('ProtectedRoute session validation', () => {
  beforeEach(() => {
    localStorage.clear();
    checkSession.mockReset();
  });

  test('keeps the stored session when session validation fails temporarily', async () => {
    const storedSession = { token: 'network-failure-token', username: 'test-user' };
    localStorage.setItem('userData', JSON.stringify(storedSession));
    checkSession.mockRejectedValue(new Error('Network Error'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/private" element={<ProtectedRoute><div>Private page</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Private page')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('userData'))).toEqual(storedSession);
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  test('clears and redirects only when the server explicitly rejects the session', async () => {
    localStorage.setItem('userData', JSON.stringify({
      token: 'expired-session-token',
      username: 'test-user',
    }));
    checkSession.mockResolvedValue({ error: 'session expired' });

    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/private" element={<ProtectedRoute><div>Private page</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(localStorage.getItem('userData')).toBeNull();
  });
});
