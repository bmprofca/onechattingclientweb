export function getCannedReplyQuery(messageInput) {
    if (typeof messageInput !== 'string' || !messageInput.startsWith('/') || messageInput.slice(1).includes(' ')) {
        return null;
    }
    return messageInput.slice(1).toLowerCase();
}

export function findCannedReplySuggestions(replies, messageInput, limit = 6) {
    const query = getCannedReplyQuery(messageInput);
    if (query === null) return [];
    return (Array.isArray(replies) ? replies : [])
        .filter((reply) => typeof reply?.shortcut === 'string' && reply.shortcut.toLowerCase().startsWith(query))
        .slice(0, limit);
}

export function expandContactName(text, contactName) {
    const name = typeof contactName === 'string' ? contactName : '';
    return String(text || '').replace(/\{\{\s*contact\.name\s*\}\}/gi, () => name);
}
