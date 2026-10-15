import { PLAIN_PAYLOAD_KEY } from '../../api/http/contract';

/**
 * Historical helper kept so existing call sites compile unchanged.
 *
 * Payloads are no longer AES-wrapped (that scheme sent the key with the
 * ciphertext, so it gave no protection; HTTPS does). This returns a marker
 * object that the API transport (src/api/http/transport.js) unwraps, so the
 * request body goes out as plain JSON.
 *
 * New code should call `api.post(path, payload)` from src/api/client.js instead.
 */
export function Encrypt(payload) {
  return { data: payload ?? {}, key: PLAIN_PAYLOAD_KEY };
}
