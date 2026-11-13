import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header, Sidebar } from '../component/Menu';
import {
  createDynamicSegment,
  deleteDynamicSegment,
  getDynamicSegmentContacts,
  listDynamicSegments,
  previewDynamicSegment,
  updateDynamicSegment,
} from '../api/dynamicSegments';

const INITIAL_DEFINITION = {
  operator: 'AND',
  children: [{ type: 'opt_in', value: true }],
};

export default function DynamicSegments() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebarMinimized') || 'false');
    } catch {
      return false;
    }
  });
  const [projectId, setProjectId] = useState('');
  const [segments, setSegments] = useState([]);
  const [segmentId, setSegmentId] = useState('');
  const [name, setName] = useState('');
  const [definitionText, setDefinitionText] = useState(JSON.stringify(INITIAL_DEFINITION, null, 2));
  const [previewCount, setPreviewCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewingSegmentId, setViewingSegmentId] = useState('');
  const [segmentContacts, setSegmentContacts] = useState(null);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const contactsRequestId = useRef(0);

  const loadSegments = useCallback(async (id) => {
    setLoading(true);
    setError('');
    try {
      const result = await listDynamicSegments(id);
      if (result.error) throw new Error(result.error);
      setSegments(result.data || []);
    } catch (loadError) {
      setError(loadError?.response?.data?.error || loadError.message || 'Unable to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('userData') || '{}');
      setProjectId(user.selected_project_id || user.projects?.[0]?.project_id || '');
    } catch {
      setError('Unable to read the selected project');
    }
  }, []);

  useEffect(() => {
    if (projectId) loadSegments(projectId);
  }, [projectId, loadSegments]);
  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  const resetForm = () => {
    setSegmentId('');
    setName('');
    setDefinitionText(JSON.stringify(INITIAL_DEFINITION, null, 2));
    setPreviewCount(null);
  };

  const parseDefinition = () => {
    try {
      return JSON.parse(definitionText);
    } catch {
      throw new Error('Filter definition must be valid JSON');
    }
  };

  const preview = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await previewDynamicSegment({
        project_id: projectId,
        ...(segmentId ? { segment_id: segmentId } : { definition: parseDefinition() }),
      });
      if (result.error) throw new Error(result.error);
      setPreviewCount(result.data.count);
    } catch (previewError) {
      setError(previewError?.response?.data?.error || previewError.message || 'Unable to preview segment');
    } finally {
      setBusy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { project_id: projectId, name, definition: parseDefinition() };
      const result = segmentId
        ? await updateDynamicSegment(segmentId, payload)
        : await createDynamicSegment(payload);
      if (result.error) throw new Error(result.error);
      resetForm();
      await loadSegments(projectId);
    } catch (saveError) {
      setError(saveError?.response?.data?.error || saveError.message || 'Unable to save segment');
    } finally {
      setBusy(false);
    }
  };

  const edit = (segment) => {
    setSegmentId(segment.segment_id);
    setName(segment.name);
    setDefinitionText(JSON.stringify(segment.definition, null, 2));
    setPreviewCount(null);
    setError('');
  };

  const remove = async (id) => {
    setBusy(true);
    setError('');
    try {
      const result = await deleteDynamicSegment(id, projectId);
      if (result.error) throw new Error(result.error);
      if (segmentId === id) resetForm();
      if (viewingSegmentId === id) {
        contactsRequestId.current += 1;
        setViewingSegmentId('');
        setSegmentContacts(null);
      }
      await loadSegments(projectId);
    } catch (removeError) {
      setError(removeError?.response?.data?.error || removeError.message || 'Unable to delete segment');
    } finally {
      setBusy(false);
    }
  };

  const loadSegmentContacts = async (id, page = 1) => {
    const requestId = ++contactsRequestId.current;
    setViewingSegmentId(id);
    setContactsPage(page);
    setContactsLoading(true);
    setContactsError('');
    try {
      const result = await getDynamicSegmentContacts(id, projectId, page);
      if (result.error) throw new Error(result.error);
      if (requestId === contactsRequestId.current) setSegmentContacts(result.data);
    } catch (contactsLoadError) {
      if (requestId === contactsRequestId.current) {
        setContactsError(contactsLoadError?.response?.data?.error || contactsLoadError.message || 'Unable to load contacts');
      }
    } finally {
      if (requestId === contactsRequestId.current) setContactsLoading(false);
    }
  };

  const toggleSegmentContacts = (id) => {
    if (viewingSegmentId === id) {
      contactsRequestId.current += 1;
      setViewingSegmentId('');
      setSegmentContacts(null);
      setContactsError('');
      setContactsLoading(false);
      return;
    }
    setSegmentContacts(null);
    loadSegmentContacts(id);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <main className={`pt-20 px-4 pb-8 transition-all ${isMinimized ? 'md:ml-20' : 'md:ml-[260px]'}`}>
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dynamic segments</h1>
          <p className="mt-1 text-sm text-gray-500">Build project-scoped audiences with validated AND/OR filter trees. Counts are previews; campaign recipients are resolved when the campaign dispatches.</p>

          {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <form onSubmit={save} className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">{segmentId ? 'Edit segment' : 'Create segment'}</h2>
              <label className="mt-4 block text-sm font-medium">
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Filter tree (JSON)
                <textarea value={definitionText} onChange={(event) => { setDefinitionText(event.target.value); setPreviewCount(null); }} rows={18} spellCheck={false} className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs" />
              </label>
              <details className="mt-3 text-xs text-gray-600">
                <summary className="cursor-pointer font-semibold">Supported filter types and example</summary>
                <p className="mt-2">Use groups with AND/OR and child filters. Types: attribute, tag, opt_in, last_inbound, campaign_status, case, origin. Built-in attribute fields are name, number, email, firm_name, website, remark, origin, and create_date; use field=&quot;custom&quot; with field_id for custom attributes. Origin values: manual, import, campaign, api, whatsapp, qr.</p>
                <p className="mt-1">Attribute operators: eq, not_eq, contains, not_contains, gt, gte, lt, lte, is_empty, is_not_empty. Tags use has/not_has; last_inbound uses has/never/within_days/older_than_days; cases use open/closed/has/none.</p>
                <pre className="mt-2 overflow-auto rounded bg-gray-50 p-3">{JSON.stringify({
                  operator: 'AND',
                  children: [
                    { type: 'attribute', field: 'name', operator: 'contains', value: 'Asha' },
                    { type: 'tag', tag_id: 'PROJECT_TAG_ID', operator: 'has' },
                    { type: 'last_inbound', operator: 'within_days', days: 30 },
                  ],
                }, null, 2)}</pre>
              </details>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={preview} disabled={busy || !projectId} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Preview count</button>
                <button type="submit" disabled={busy || !projectId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{segmentId ? 'Save changes' : 'Save segment'}</button>
                {segmentId && <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2 text-sm">Cancel edit</button>}
                {previewCount !== null && <span className="text-sm font-medium text-gray-700">{previewCount.toLocaleString()} matching contacts</span>}
              </div>
            </form>

            <section className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Saved segments</h2>
              {loading ? <p className="mt-4 text-sm text-gray-500">Loading segments…</p> : segments.length === 0 ? <p className="mt-4 text-sm text-gray-500">No segments saved for this project.</p> : (
                <ul className="mt-3 divide-y">
                  {segments.map((segment) => (
                    <li key={segment.segment_id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-medium">{segment.name}</p><p className="text-xs text-gray-500">{segment.segment_id}</p></div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => toggleSegmentContacts(segment.segment_id)} className="text-sm text-emerald-700">
                            {viewingSegmentId === segment.segment_id ? 'Hide contacts' : 'View contacts'}
                          </button>
                          <button type="button" onClick={() => edit(segment)} className="text-sm text-indigo-600">Edit</button>
                          <button type="button" onClick={() => remove(segment.segment_id)} disabled={busy} className="text-sm text-red-600 disabled:opacity-50">Delete</button>
                        </div>
                      </div>
                      {viewingSegmentId === segment.segment_id && (
                        <div className="mt-3 rounded-lg border bg-gray-50 p-3">
                          {contactsLoading && <p className="text-sm text-gray-500">Loading contacts…</p>}
                          {contactsError && <p role="alert" className="text-sm text-red-600">{contactsError}</p>}
                          {segmentContacts && (
                            <>
                              <p className="mb-2 text-sm font-medium">Matching contacts ({segmentContacts.pagination.total})</p>
                              {segmentContacts.contacts.length === 0 ? (
                                <p className="text-sm text-gray-500">No contacts match this segment.</p>
                              ) : (
                                <ul className="divide-y rounded border bg-white">
                                  {segmentContacts.contacts.map((contact) => (
                                    <li key={contact.contact_id} className="px-3 py-2">
                                      <p className="text-sm font-medium">{contact.name || 'Unnamed contact'}</p>
                                      <p className="text-xs text-gray-600">{contact.number}{contact.email ? ` · ${contact.email}` : ''}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {segmentContacts.pagination.total_pages > 1 && (
                                <div className="mt-3 flex items-center justify-between text-sm">
                                  <button
                                    type="button"
                                    onClick={() => loadSegmentContacts(segment.segment_id, contactsPage - 1)}
                                    disabled={contactsLoading || contactsPage <= 1}
                                    className="text-indigo-600 disabled:opacity-50"
                                  >Previous</button>
                                  <span>Page {contactsPage} of {segmentContacts.pagination.total_pages}</span>
                                  <button
                                    type="button"
                                    onClick={() => loadSegmentContacts(segment.segment_id, contactsPage + 1)}
                                    disabled={contactsLoading || contactsPage >= segmentContacts.pagination.total_pages}
                                    className="text-indigo-600 disabled:opacity-50"
                                  >Next</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
