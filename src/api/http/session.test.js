import { isExplicitlyUnauthorized } from './session';

describe('session-check error classification', () => {
  test('only an explicit HTTP 401 invalidates the session', () => {
    expect(isExplicitlyUnauthorized({ response: { status: 401 } })).toBe(true);
    expect(isExplicitlyUnauthorized({ response: { status: 403 } })).toBe(false);
    expect(isExplicitlyUnauthorized({ response: { status: 500 } })).toBe(false);
    expect(isExplicitlyUnauthorized({ message: 'Network Error' })).toBe(false);
    expect(isExplicitlyUnauthorized({ code: 'ECONNABORTED' })).toBe(false);
  });
});
