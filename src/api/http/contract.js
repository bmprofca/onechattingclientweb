/**
 * OneChatting API contract (client side).
 *
 * Requests send `Authorization: Bearer <token>` and a plain JSON body.
 * Responses:
 *   2xx     { success: true,  message, data, meta? }
 *   4xx/5xx { success: false, message, error: { code, message, details? } }
 *
 * `api` from src/api/client.js returns that envelope and throws ApiError on failure.
 *
 * Screens written against the older fields (`error`, `msg`, `meta.page_no`)
 * still receive those fields. The transport expands the envelope with
 * toScreenBody() / toScreenErrorBody() so those screens keep working.
 */

/** Marker used by Encrypt() so the transport can send plain JSON. */
export const PLAIN_PAYLOAD_KEY = '__plain_json__';

export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const isApiEnvelope = (body) =>
  isPlainObject(body) && typeof body.success === 'boolean' && ('data' in body || 'error' in body);

const STANDARD_META_KEYS = ['page', 'limit', 'total', 'total_pages', 'has_more', 'has_previous', 'last_id', 'first_id', 'next_cursor', 'prev_cursor', 'count'];

/** Pagination aliases screens already read (`page_no`, `total_page`, …). */
export function toScreenMeta(meta) {
  if (!isPlainObject(meta)) return meta;
  const screen = { ...meta };
  if (meta.page !== undefined) screen.page_no = meta.page;
  if (meta.total !== undefined) screen.total_records = meta.total;
  if (meta.total_pages !== undefined) screen.total_page = meta.total_pages;
  if (typeof meta.has_more === 'boolean') {
    screen.is_last_page = !meta.has_more;
    screen.has_more_next = meta.has_more;
  }
  if (typeof meta.has_previous === 'boolean') screen.has_more_previous = meta.has_previous;
  return screen;
}

/** Expand a success envelope into the fields existing screens read. */
export function toScreenBody(envelope) {
  const { data, message, meta } = envelope;
  const body = {};
  if (isPlainObject(data)) Object.assign(body, data);
  body.error = false;
  body.data = data;
  if (message !== null && message !== undefined) {
    body.msg = message;
    if (body.message === undefined) body.message = message;
  }
  if (isPlainObject(meta)) {
    const screenMeta = toScreenMeta(meta);
    body.meta = screenMeta;
    const topLevel = ['page_no', 'page', 'total_records', 'total_pages', 'has_more', 'last_id', 'first_id', 'count', 'has_more_next', 'has_more_previous'];
    topLevel.forEach((key) => {
      if (screenMeta[key] !== undefined && body[key] === undefined) body[key] = screenMeta[key];
    });
    Object.keys(meta).forEach((key) => {
      if (!STANDARD_META_KEYS.includes(key) && body[key] === undefined) body[key] = meta[key];
    });
  }
  return body;
}

/** Expand an error envelope into `{ error: "message" }` for existing screens. */
export function toScreenErrorBody(envelope) {
  const message = envelope?.error?.message || envelope?.message || 'Request failed';
  const details = isPlainObject(envelope?.error?.details) ? envelope.error.details : {};
  return { ...details, error: message, code: envelope?.error?.code };
}

export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message = 'Network error', details, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  get isValidation() { return this.status === 400 || this.status === 422; }
}

/** Build an ApiError from an axios error. */
export function toApiError(error) {
  if (error instanceof ApiError) return error;
  const response = error?.response;
  if (!response) {
    return new ApiError({ status: 0, code: 'NETWORK_ERROR', message: error?.message || 'Network error. Check your connection.' });
  }
  const body = response.data;
  const requestId = response.headers?.['x-request-id'];
  if (isApiEnvelope(body) && body.success === false) {
    return new ApiError({
      status: response.status,
      code: body.error?.code,
      message: body.error?.message || body.message,
      details: body.error?.details,
      requestId,
    });
  }
  return new ApiError({
    status: response.status,
    code: 'HTTP_' + response.status,
    message: (isPlainObject(body) && (typeof body.error === 'string' ? body.error : body.message)) || `Request failed (${response.status})`,
    requestId,
  });
}
