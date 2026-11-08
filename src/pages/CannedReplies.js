import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiBookmark, FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import { Encrypt } from './encryption/payload-encryption';

function getApiData(response) {
    const body = response?.data;
    if (body?.success === false || body?.error) {
        throw new Error(body?.message || body?.error?.message || body?.error || 'Request failed');
    }
    return body?.data ?? body;
}

function CannedReplies() {
    const navigate = useNavigate();
    const [tokens, setTokens] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('sidebarMinimized')) || false;
        } catch {
            return false;
        }
    });
    const [replies, setReplies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState('');
    const [editingId, setEditingId] = useState('');
    const [draft, setDraft] = useState({ shortcut: '', title: '', body: '' });

    useEffect(() => {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || 'null');
            setTokens(userData);
        } catch (error) {
            console.error('Failed to read user session:', error);
            toast.error('Could not read the current session.');
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    const projectId = tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '';
    const request = useCallback(async (endpoint, payload = {}) => {
        if (!tokens?.token || !tokens?.username || !projectId) {
            throw new Error('Select a project and sign in to manage canned replies.');
        }
        const { data, key } = Encrypt({ project_id: projectId, ...payload });
        const response = await axios.post(
            `${API_BASE_URL}/inbox/${endpoint}`,
            JSON.stringify({ data, key }),
            {
                headers: {
                    token: tokens.token,
                    username: tokens.username,
                    'Content-Type': 'application/json'
                }
            }
        );
        return getApiData(response);
    }, [projectId, tokens?.token, tokens?.username]);

    const loadReplies = useCallback(async () => {
        if (!tokens?.token || !projectId) return;
        setLoading(true);
        try {
            const result = await request('canned-replies-list');
            setReplies(Array.isArray(result) ? result : []);
        } catch (error) {
            toast.error(error.message || 'Could not load canned replies');
        } finally {
            setLoading(false);
        }
    }, [projectId, request, tokens?.token]);

    useEffect(() => {
        if (!tokens) return;
        if (tokens.token && projectId) {
            loadReplies();
        } else {
            setLoading(false);
        }
    }, [tokens, projectId, loadReplies]);

    const saveReply = async (event) => {
        event.preventDefault();
        if (saving) return;
        const payload = {
            shortcut: draft.shortcut.trim().replace(/^\/+/, ''),
            title: draft.title.trim(),
            body: draft.body.trim()
        };
        if (!payload.shortcut || !payload.title || !payload.body) {
            toast.error('Complete all canned reply fields.');
            return;
        }
        setSaving(true);
        try {
            const result = await request(
                editingId ? 'canned-replies-update' : 'canned-replies-create',
                editingId ? { ...payload, reply_id: editingId } : payload
            );
            const reply = result?.reply_id ? result : result?.data;
            if (reply?.reply_id) {
                setReplies((current) => [
                    ...current.filter((item) => item.reply_id !== reply.reply_id),
                    reply
                ].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
                setDraft({ shortcut: '', title: '', body: '' });
                setEditingId('');
                toast.success(editingId ? 'Canned reply updated.' : 'Canned reply created.');
            } else {
                throw new Error('The server did not return the saved canned reply. Please refresh and try again.');
            }
        } catch (error) {
            toast.error(error.message || 'Could not save canned reply');
        } finally {
            setSaving(false);
        }
    };

    const editReply = (reply) => {
        setEditingId(reply.reply_id);
        setDraft({ shortcut: reply.shortcut, title: reply.title, body: reply.body });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId('');
        setDraft({ shortcut: '', title: '', body: '' });
    };

    const deleteReply = async (replyId) => {
        if (deletingId) return;
        setDeletingId(replyId);
        try {
            await request('canned-replies-delete', { reply_id: replyId });
            setReplies((current) => current.filter((reply) => reply.reply_id !== replyId));
            if (editingId === replyId) cancelEdit();
            toast.success('Canned reply deleted.');
        } catch (error) {
            toast.error(error.message || 'Could not delete canned reply');
        } finally {
            setDeletingId('');
        }
    };

    return (
        <div className="min-h-screen bg-surface-ground">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <main className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="mx-auto w-full max-w-[1100px] px-4 py-7 sm:px-7">
                    <button
                        type="button"
                        onClick={() => navigate('/live-chat')}
                        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-brand-700"
                    >
                        <FiArrowLeft className="h-4 w-4" />
                        Back to inbox
                    </button>
                    <div className="mb-6 flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                            <FiBookmark className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="oc-page-title">Canned replies</h1>
                            <p className="oc-page-sub">Manage reusable replies for {tokens?.projects?.find((project) => project.project_id === projectId)?.project_name || 'this project'}. Use <code>/shortcut</code> in a conversation to insert one.</p>
                        </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                        <section className="oc-card p-5">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-ink">Saved replies</h2>
                                    <p className="mt-1 text-sm text-ink-500">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</p>
                                </div>
                            </div>
                            {loading ? (
                                <p className="py-8 text-center text-sm text-ink-500">Loading canned replies…</p>
                            ) : replies.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
                                    <FiBookmark className="mx-auto mb-3 h-7 w-7 text-ink-300" />
                                    <p className="text-sm font-semibold text-ink">No canned replies yet</p>
                                    <p className="mt-1 text-sm text-ink-500">Create a reply here and use its shortcut from any conversation.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {replies.map((reply) => (
                                        <article key={reply.reply_id} className="flex items-start gap-3 rounded-xl border border-line p-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-sm font-semibold text-ink">{reply.title}</h3>
                                                    <code className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">/{reply.shortcut}</code>
                                                </div>
                                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-500">{reply.body}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => editReply(reply)}
                                                aria-label={`Edit ${reply.title}`}
                                                className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-700"
                                            >
                                                <FiEdit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deleteReply(reply.reply_id)}
                                                disabled={deletingId === reply.reply_id}
                                                aria-label={`Delete ${reply.title}`}
                                                className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                            >
                                                <FiTrash2 className="h-4 w-4" />
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="oc-card h-fit p-5">
                            <div className="mb-4">
                                <div className="flex items-center justify-between gap-3">
                                    <h2 className="text-base font-bold text-ink">{editingId ? 'Edit canned reply' : 'Create a reply'}</h2>
                                    {editingId && (
                                        <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink">
                                            <FiX className="h-3.5 w-3.5" />
                                            Cancel
                                        </button>
                                    )}
                                </div>
                                <p className="mt-1 text-sm text-ink-500">Contact names are filled in when the reply is inserted in a conversation.</p>
                            </div>
                            <form onSubmit={saveReply} className="space-y-4">
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-ink">Shortcut</span>
                                    <div className="flex items-center rounded-xl border border-line bg-white px-3 focus-within:border-brand-500">
                                        <span className="text-sm text-ink-400">/</span>
                                        <input
                                            value={draft.shortcut}
                                            onChange={(event) => setDraft((current) => ({ ...current, shortcut: event.target.value.replace(/^\/+/, '') }))}
                                            maxLength={40}
                                            placeholder="greeting"
                                            className="w-full border-0 bg-transparent px-2 py-2.5 text-sm text-ink outline-none focus:ring-0"
                                            required
                                        />
                                    </div>
                                    <span className="mt-1 block text-xs text-ink-400">Letters, numbers, underscores, and hyphens.</span>
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-ink">Title</span>
                                    <input
                                        value={draft.title}
                                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                                        maxLength={80}
                                        placeholder="Welcome greeting"
                                        className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500"
                                        required
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-medium text-ink">Reply text</span>
                                    <textarea
                                        value={draft.body}
                                        onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                                        maxLength={5000}
                                        rows={6}
                                        placeholder="Hello {{contact.name}}, how can we help?"
                                        className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-500"
                                        required
                                    />
                                    <span className="mt-1 block text-xs text-ink-400">Use {'{{contact.name}}'} to insert the contact’s name.</span>
                                </label>
                                <button type="submit" disabled={saving} className="oc-btn-primary inline-flex w-full items-center justify-center gap-2 disabled:opacity-60">
                                    {editingId ? <FiEdit2 className="h-4 w-4" /> : <FiPlus className="h-4 w-4" />}
                                    {saving ? 'Saving…' : editingId ? 'Update canned reply' : 'Save canned reply'}
                                </button>
                            </form>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default CannedReplies;
