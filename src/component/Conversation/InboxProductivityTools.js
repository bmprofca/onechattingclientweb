import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiBookmark, FiMessageSquare, FiTag, FiX } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { Encrypt } from '../../pages/encryption/payload-encryption';
import { expandContactName, findCannedReplySuggestions, getCannedReplyQuery } from '../../utils/inboxProductivity';

function readEnvelope(response) {
    const body = response?.data;
    if (body?.success === false || body?.error) {
        throw new Error(body?.message || body?.error?.message || body?.error || 'Request failed');
    }
    return body?.data ?? body;
}

function InboxProductivityTools({
    tokens,
    number,
    contactName,
    messageInput,
    onMessageInputChange,
    slashKeyHandlerRef
}) {
    const [activePanel, setActivePanel] = useState('');
    const [labels, setLabels] = useState([]);
    const [notes, setNotes] = useState([]);
    const [replies, setReplies] = useState([]);
    const [repliesLoaded, setRepliesLoaded] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [loadingPanel, setLoadingPanel] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const toolsContainerRef = useRef(null);

    const projectId = tokens?.selected_project_id || '';
    const currentProjectRef = useRef(projectId);
    const currentConversationRef = useRef(`${projectId}:${number}`);
    currentProjectRef.current = projectId;
    currentConversationRef.current = `${projectId}:${number}`;
    const request = useCallback(async (endpoint, payload) => {
        const { data, key } = Encrypt({ project_id: projectId, number, ...payload });
        const response = await axios.post(
            `${API_BASE_URL}/inbox/${endpoint}`,
            JSON.stringify({ data, key }),
            {
                headers: {
                    token: tokens?.token,
                    username: tokens?.username,
                    'Content-Type': 'application/json'
                }
            }
        );
        return readEnvelope(response);
    }, [projectId, number, tokens?.token, tokens?.username]);

    const loadReplies = useCallback(async () => {
        if (!projectId || !tokens?.token) return;
        const result = await request('canned-replies-list', {});
        if (currentProjectRef.current !== projectId) return;
        setReplies(Array.isArray(result) ? result : []);
        setRepliesLoaded(true);
    }, [projectId, request, tokens?.token]);

    const loadPanel = async (panel) => {
        if (!projectId || !tokens?.token || !number) return;
        const requestKey = `${projectId}:${number}`;
        setLoadingPanel(panel);
        try {
            if (panel === 'labels') {
                const result = await request('conversation-labels', {});
                if (currentConversationRef.current !== requestKey) return;
                setLabels(Array.isArray(result) ? result : []);
            } else if (panel === 'notes') {
                const result = await request('conversation-notes-list', {});
                if (currentConversationRef.current !== requestKey) return;
                setNotes(Array.isArray(result) ? result : []);
            } else if (panel === 'replies') {
                await loadReplies();
            }
        } catch (error) {
            if (currentConversationRef.current === requestKey) {
                toast.error(error.message || 'Could not load inbox tools');
            }
        } finally {
            if (currentConversationRef.current === requestKey) setLoadingPanel('');
        }
    };

    useEffect(() => {
        setLabels([]);
        setNotes([]);
        setReplies([]);
        setRepliesLoaded(false);
        setNoteText('');
        setSavingNote(false);
        setActivePanel('');
    }, [projectId, number]);

    useEffect(() => {
        if (!activePanel) return undefined;
        const handlePointerDown = (event) => {
            if (toolsContainerRef.current && !toolsContainerRef.current.contains(event.target)) {
                setActivePanel('');
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setActivePanel('');
        };
        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [activePanel]);

    useEffect(() => {
        if (getCannedReplyQuery(messageInput) === null || !projectId || !tokens?.token) return;
        if (repliesLoaded) return;
        const requestProjectId = projectId;
        loadReplies().catch((error) => {
            if (currentProjectRef.current === requestProjectId) {
                toast.error(error.message || 'Could not load canned replies');
            }
        });
    }, [messageInput, projectId, tokens?.token, repliesLoaded, loadReplies]);

    const slashQuery = getCannedReplyQuery(messageInput);
    const matchingReplies = useMemo(
        () => findCannedReplySuggestions(replies, messageInput),
        [replies, messageInput]
    );

    const selectReply = useCallback((reply) => {
        onMessageInputChange(expandContactName(reply.body, contactName));
    }, [contactName, onMessageInputChange]);

    useEffect(() => {
        if (!slashKeyHandlerRef) return undefined;
        slashKeyHandlerRef.current = () => {
            if (slashQuery === null || matchingReplies.length === 0) return false;
            const exact = matchingReplies.find((reply) => reply.shortcut.toLowerCase() === slashQuery);
            if (!exact) return false;
            selectReply(exact);
            return true;
        };
        return () => {
            slashKeyHandlerRef.current = null;
        };
    }, [slashKeyHandlerRef, slashQuery, matchingReplies, selectReply]);

    const updateLabel = async (label) => {
        const action = Number(label.assigned) === 1 ? 'remove' : 'add';
        const requestKey = `${projectId}:${number}`;
        try {
            await request('conversation-label-update', { tag_id: label.tag_id, action });
            if (currentConversationRef.current === requestKey) {
                setLabels((current) => current.map((item) => item.tag_id === label.tag_id
                    ? { ...item, assigned: action === 'add' ? 1 : 0 }
                    : item));
            }
            window.dispatchEvent(new Event('conversation_labels_updated'));
        } catch (error) {
            if (currentConversationRef.current === requestKey) {
                toast.error(error.message || 'Could not update conversation label');
            }
        }
    };

    const createNote = async (event) => {
        event.preventDefault();
        const text = noteText.trim();
        if (!text || savingNote) return;
        const requestKey = `${projectId}:${number}`;
        setSavingNote(true);
        try {
            const result = await request('conversation-note-create', { note_text: text });
            const note = result?.note_id ? result : result?.data;
            if (currentConversationRef.current === requestKey) {
                if (note?.note_id) setNotes((current) => [note, ...current]);
                setNoteText('');
            }
            toast.success('Internal note saved');
        } catch (error) {
            if (currentConversationRef.current === requestKey) {
                toast.error(error.message || 'Could not save internal note');
            }
        } finally {
            setSavingNote(false);
        }
    };

    const tabButton = (key, label, icon) => (
        <button
            key={key}
            type="button"
            onClick={() => {
                const nextPanel = activePanel === key ? '' : key;
                setActivePanel(nextPanel);
                if (nextPanel) loadPanel(nextPanel);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                activePanel === key
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
            aria-expanded={activePanel === key}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <div ref={toolsContainerRef} className="relative mb-2">
            <div className="flex items-center gap-1">
                {tabButton('notes', 'Internal notes', <FiMessageSquare className="h-3.5 w-3.5" />)}
                {tabButton('labels', 'Conversation labels', <FiTag className="h-3.5 w-3.5" />)}
                {tabButton('replies', 'Canned replies', <FiBookmark className="h-3.5 w-3.5" />)}
            </div>

            {slashQuery !== null && matchingReplies.length > 0 && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-60 w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    {matchingReplies.map((reply) => (
                        <button
                            key={reply.reply_id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectReply(reply)}
                            className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{reply.title}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">/{reply.shortcut}</span>
                        </button>
                    ))}
                </div>
            )}

            {activePanel && (
                <section className="absolute bottom-full left-0 z-20 mb-2 max-h-[min(60vh,420px)] w-full max-w-xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {activePanel === 'notes' ? 'Internal notes' : activePanel === 'labels' ? 'Conversation labels' : 'Canned replies'}
                            </h3>
                            {activePanel === 'replies' && (
                                <Link to="/canned-replies" className="mt-0.5 inline-block text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                                    Manage canned replies
                                </Link>
                            )}
                            {activePanel === 'labels' && (
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Uses CRM tag names and colors, but applies to this conversation only. Contact tags remain separate.</p>
                            )}
                            {activePanel === 'notes' && (
                                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Visible to project agents only. Never sent to WhatsApp.</p>
                            )}
                        </div>
                        <button type="button" onClick={() => setActivePanel('')} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close inbox tools">
                            <FiX className="h-4 w-4" />
                        </button>
                    </div>

                    {loadingPanel === activePanel ? (
                        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                    ) : activePanel === 'notes' ? (
                        <div className="space-y-3 p-4">
                            <form onSubmit={createNote} className="space-y-2">
                                <textarea
                                    value={noteText}
                                    onChange={(event) => setNoteText(event.target.value)}
                                    maxLength={5000}
                                    rows={3}
                                    placeholder="Write an internal note…"
                                    className="w-full resize-y rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                                />
                                <div className="flex justify-end">
                                    <button type="submit" disabled={!noteText.trim() || savingNote} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                                        {savingNote ? 'Saving…' : 'Add internal note'}
                                    </button>
                                </div>
                            </form>
                            {notes.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No internal notes yet.</p>
                            ) : notes.map((note) => (
                                <article key={note.note_id} className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 dark:bg-amber-950/30">
                                    <p className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">{note.note_text}</p>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note.create_by} · {note.create_date}</p>
                                </article>
                            ))}
                        </div>
                    ) : activePanel === 'labels' ? (
                        <div className="space-y-2 p-4">
                            {labels.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No project labels available. Create tags in CRM settings first.</p>
                            ) : labels.map((label) => (
                                <label key={label.tag_id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <input
                                        type="checkbox"
                                        checked={Number(label.assigned) === 1}
                                        onChange={() => updateLabel(label)}
                                    />
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color || '#6366f1' }} />
                                    <span className="text-sm text-gray-800 dark:text-gray-100">{label.name}</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4 p-4">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Type /shortcut in the message box to use a reply. {'{{contact.name}}'} is replaced with this contact’s name.</p>
                            <div className="space-y-2">
                                {replies.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">No canned replies yet.</p>
                                ) : replies.map((reply) => (
                                    <div key={reply.reply_id} className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
                                        <button type="button" onClick={() => selectReply(reply)} className="w-full min-w-0 text-left">
                                            <span className="block text-sm font-medium text-gray-900 dark:text-white">{reply.title} <span className="font-normal text-gray-500">/{reply.shortcut}</span></span>
                                            <span className="mt-1 block whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">{reply.body}</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

export default InboxProductivityTools;
