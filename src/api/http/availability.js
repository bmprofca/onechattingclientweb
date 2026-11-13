import { API_BASE_URL } from '../../config/api';

export const API_UNAVAILABLE_EVENT = 'onechatting:api-unavailable';
let apiUnavailable = false;

export const isApiRequest = (config) => {
  const url = String(config?.url || '');
  const base = String(config?.baseURL || '');
  return url.startsWith(API_BASE_URL) || (!/^https?:\/\//i.test(url) && base.startsWith(API_BASE_URL));
};

export function isApiUnavailable() {
  return apiUnavailable;
}

export function markApiUnavailable() {
  apiUnavailable = true;
}

export function isUnavailableApiError(error) {
  if (error?.code === 'ERR_CANCELED' || error?.__CANCEL__ || !isApiRequest(error?.config)) return false;
  return !error.response || error.response.status >= 500;
}
