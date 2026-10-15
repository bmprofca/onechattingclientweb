import axios, { AxiosHeaders } from 'axios';
import { API_BASE_URL } from '../../config/api';
import {
  PLAIN_PAYLOAD_KEY,
  isPlainObject,
  isApiEnvelope,
  toScreenBody,
  toScreenErrorBody,
} from './contract';
import { getAuthToken, UNAUTHORIZED_EVENT } from './session';

const isApiRequest = (config) => {
  const url = String(config?.url || '');
  const base = String(config?.baseURL || '');
  return url.startsWith(API_BASE_URL) || (!/^https?:\/\//i.test(url) && base.startsWith(API_BASE_URL));
};

/** Unwrap the Encrypt() marker so the body is sent as plain JSON. */
function toPlainBody(data) {
  if (typeof FormData !== 'undefined' && data instanceof FormData) return data;
  let parsed = data;
  if (typeof data === 'string') {
    try { parsed = JSON.parse(data); } catch { return data; }
  }
  if (isPlainObject(parsed) && parsed.key === PLAIN_PAYLOAD_KEY) {
    return parsed.data ?? {};
  }
  return data;
}

/** Request side of the API contract: Bearer auth and a plain JSON body. */
export function applyApiRequest(config) {
  if (!isApiRequest(config)) return config;
  const headers = AxiosHeaders.from(config.headers || {});

  const legacyToken = headers.get('token');
  const token = (typeof legacyToken === 'string' && legacyToken) || getAuthToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  headers.delete('token');
  headers.delete('username');

  if (config.data !== undefined) {
    const body = toPlainBody(config.data);
    config.data = body;
    if (isPlainObject(body) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  config.headers = headers;
  return config;
}

function notifyUnauthorized(status) {
  if (status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

/**
 * Install the API transport on an axios instance.
 * Requests flagged `apiNative: true` (src/api/client.js) receive the envelope.
 * Other API requests get the expanded body existing screens already read.
 */
export function installTransport(instance = axios) {
  instance.interceptors.request.use(applyApiRequest);
  instance.interceptors.response.use(
    (response) => {
      if (!isApiRequest(response.config) || response.config?.apiNative) return response;
      if (isApiEnvelope(response.data) && response.data.success === true) {
        response.apiEnvelope = response.data;
        response.data = toScreenBody(response.data);
      }
      return response;
    },
    (error) => {
      const response = error?.response;
      notifyUnauthorized(response?.status);
      if (!response || !isApiRequest(error.config) || error.config?.apiNative) return Promise.reject(error);
      if (isApiEnvelope(response.data) && response.data.success === false) {
        // Existing screens read HTTP 200 with { error: "message" }.
        return {
          ...response,
          status: 200,
          apiStatus: response.status,
          apiEnvelope: response.data,
          data: toScreenErrorBody(response.data),
        };
      }
      return Promise.reject(error);
    }
  );
  return instance;
}

let installed = false;
/** Install once on the shared default axios instance used across the app. */
export function installDefaultTransport() {
  if (installed) return;
  installed = true;
  installTransport(axios);
}
