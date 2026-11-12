import { unwrapQRCodeResponse } from '../utils/qrcode';

test('unwraps successful API envelopes and preserves legacy QR responses', () => {
    const data = { project: { project_id: 'p1' }, phone_number: '15551234567' };
    expect(unwrapQRCodeResponse({ success: true, data })).toEqual(data);
    expect(unwrapQRCodeResponse({ error: false, qr_codes: [] })).toEqual({ error: false, qr_codes: [] });
});

test('converts failed API envelopes into QR-compatible error responses', () => {
    expect(unwrapQRCodeResponse({
        success: false,
        message: 'Unavailable',
        error: { code: 'NOT_FOUND', message: 'QR code not found' },
    })).toEqual({ error: 'QR code not found' });
});
