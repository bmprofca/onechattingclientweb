import { API_BASE_URL } from '../../config/api';
import { isUnavailableApiError } from './availability';

describe('API availability error classification', () => {
  const apiConfig = { url: '/health', baseURL: API_BASE_URL };

  test('shows the unavailable page for API 5xx and network failures', () => {
    expect(isUnavailableApiError({ config: apiConfig, response: { status: 503 } })).toBe(true);
    expect(isUnavailableApiError({ config: apiConfig })).toBe(true);
  });

  test('does not classify client errors, cancellations, or non-API errors as outages', () => {
    expect(isUnavailableApiError({ config: apiConfig, response: { status: 404 } })).toBe(false);
    expect(isUnavailableApiError({ config: { url: '/health' }, response: { status: 503 } })).toBe(false);
    expect(isUnavailableApiError({ config: apiConfig, code: 'ERR_CANCELED' })).toBe(false);
  });
});
