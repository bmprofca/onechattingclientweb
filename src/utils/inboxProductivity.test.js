import {
    expandContactName,
    findCannedReplySuggestions,
    getCannedReplyQuery
} from './inboxProductivity';

test('slash shortcuts offer matching replies until the query contains a space', () => {
    const replies = [
        { shortcut: 'greet', body: 'Hello {{contact.name}}' },
        { shortcut: 'goodbye', body: 'See you' }
    ];

    expect(getCannedReplyQuery('/gre')).toBe('gre');
    expect(findCannedReplySuggestions(replies, '/gre')).toEqual([replies[0]]);
    expect(getCannedReplyQuery('/greet more')).toBeNull();
    expect(findCannedReplySuggestions(replies, 'Hello')).toEqual([]);
});

test('contact-name expansion preserves replacement characters in names', () => {
    expect(expandContactName('Hello {{contact.name}} {{ CONTACT.NAME }}', '$& Sam'))
        .toBe('Hello $& Sam $& Sam');
});
