const cleanParam = (value, maxLength) =>
    String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);

export function buildWhatsAppMessage(defaultMessage, params) {
    const baseMessage = cleanParam(params.get("message"), 500) || cleanParam(defaultMessage, 500);
    const campaign = cleanParam(params.get("campaign"), 100);
    const source = cleanParam(params.get("source"), 100);
    const attribution = [
        campaign && `Campaign: ${campaign}`,
        source && `Source: ${source}`,
    ].filter(Boolean);

    return attribution.length
        ? `${baseMessage}\n\n${attribution.join(" | ")}`
        : baseMessage;
}

export function unwrapQRCodeResponse(body) {
    if (body?.success === false) {
        return { error: body.error?.message || body.message || "QR code request failed." };
    }
    return body?.data ?? body;
}
