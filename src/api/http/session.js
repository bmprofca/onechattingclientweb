/** Read the signed-in session saved by the login flow. */
export function getStoredSession() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem('userData') : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return getStoredSession()?.token || '';
}

export const UNAUTHORIZED_EVENT = 'onechatting:unauthorized';
