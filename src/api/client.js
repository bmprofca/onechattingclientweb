import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { applyApiRequest } from './http/transport';
import { toApiError, ApiError } from './http/contract';
import { UNAUTHORIZED_EVENT } from './http/session';

/**
 * API client. Resolves with { success, message, data, meta }.
 *
 *   const { data, meta, message } = await api.post('/contact/contact-list', { project_id, page_no: 1 });
 *
 * Rejects with ApiError { status, code, message, details } on any failure.
 */
const instance = axios.create({ baseURL: API_BASE_URL, timeout: 60000 });

instance.interceptors.request.use((config) => applyApiRequest({ ...config, apiNative: true }));
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(toApiError(error));
  }
);

const unwrap = (promise) => promise.then((response) => response.data);

export const api = {
  get: (path, params, config = {}) => unwrap(instance.get(path, { ...config, params })),
  post: (path, body = {}, config = {}) => unwrap(instance.post(path, body, config)),
  put: (path, body = {}, config = {}) => unwrap(instance.put(path, body, config)),
  patch: (path, body = {}, config = {}) => unwrap(instance.patch(path, body, config)),
  delete: (path, config = {}) => unwrap(instance.delete(path, config)),
  /** Multipart upload; `onProgress(percent)` is optional. */
  upload: (path, formData, { onProgress, ...config } = {}) =>
    unwrap(instance.post(path, formData, {
      ...config,
      onUploadProgress: onProgress
        ? (event) => onProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0)
        : undefined,
    })),
};

export { ApiError };
export default api;
