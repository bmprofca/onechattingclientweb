import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDynamicSegmentContacts, listDynamicSegments } from '../../../../api/dynamicSegments';

export default function DynamicSegmentsSelector({ projectId, selectedSegmentId, setSelectedSegmentId }) {
  const [segments, setSegments] = useState([]);
  const [contacts, setContacts] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [contactsPage, setContactsPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const previewRequestId = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!projectId) return;
      setLoading(true);
      setError('');
      try {
        const result = await listDynamicSegments(projectId);
        if (result.error) throw new Error(result.error);
        if (active) setSegments(result.data || []);
      } catch (loadError) {
        if (active) setError(loadError?.response?.data?.error || loadError.message || 'Unable to load segments');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => () => {
    previewRequestId.current += 1;
  }, []);

  const loadContacts = async (page = 1) => {
    if (!selectedSegmentId) return;
    const requestId = ++previewRequestId.current;
    setPreviewLoading(true);
    setError('');
    try {
      const result = await getDynamicSegmentContacts(selectedSegmentId, projectId, page);
      if (result.error) throw new Error(result.error);
      if (requestId === previewRequestId.current) {
        setContacts(result.data.contacts || []);
        setPagination(result.data.pagination);
        setContactsPage(page);
      }
    } catch (previewError) {
      if (requestId === previewRequestId.current) {
        setError(previewError?.response?.data?.error || previewError.message || 'Unable to preview segment');
      }
    } finally {
      if (requestId === previewRequestId.current) setPreviewLoading(false);
    }
  };

  const hideRecipients = () => {
    previewRequestId.current += 1;
    setContacts(null);
    setPagination(null);
    setPreviewLoading(false);
    setError('');
  };

  const selected = segments.find((segment) => segment.segment_id === selectedSegmentId);
  const hasPreview = pagination !== null;

  return (
    <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <label className="block text-sm font-medium text-gray-800">
        Saved segment
        <select
          value={selectedSegmentId || ''}
          onChange={(event) => {
            previewRequestId.current += 1;
            setSelectedSegmentId(event.target.value);
            setContacts(null);
            setPagination(null);
            setContactsPage(1);
            setPreviewLoading(false);
            setError('');
          }}
          disabled={loading}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        >
          <option value="">Select a dynamic segment</option>
          {segments.map((segment) => <option key={segment.segment_id} value={segment.segment_id}>{segment.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={hasPreview ? hideRecipients : () => loadContacts(1)}
          disabled={!selectedSegmentId || loading || previewLoading}
          className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50"
        >
          {previewLoading ? 'Loading recipients…' : hasPreview ? 'Hide recipients' : 'Preview recipients'}
        </button>
        {!loading && segments.length === 0 && <button type="button" onClick={() => navigate('/dynamic-segments')} className="text-sm font-semibold text-indigo-600">Create a segment</button>}
      </div>
      {loading && <p className="text-xs text-gray-500">Loading segments…</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {pagination && (
        <div className="rounded-lg border border-indigo-100 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-gray-800">{pagination.total.toLocaleString()} matching contacts</p>
          {contacts?.length ? (
            <ul className="max-h-64 divide-y overflow-y-auto rounded border scrollbar-hide">
              {contacts.map((contact) => (
                <li key={contact.contact_id} className="px-3 py-2">
                  <p className="text-sm font-medium text-gray-800">{contact.name || 'Unnamed contact'}</p>
                  <p className="text-xs text-gray-600">{contact.number}{contact.email ? ` · ${contact.email}` : ''}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No contacts match this segment.</p>
          )}
          {pagination.total_pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => loadContacts(contactsPage - 1)}
                disabled={previewLoading || contactsPage <= 1}
                className="text-indigo-600 disabled:opacity-50"
              >Previous</button>
              <span>Page {contactsPage} of {pagination.total_pages}</span>
              <button
                type="button"
                onClick={() => loadContacts(contactsPage + 1)}
                disabled={previewLoading || contactsPage >= pagination.total_pages}
                className="text-indigo-600 disabled:opacity-50"
              >Next</button>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">This is a live preview; recipients are resolved again when the campaign dispatches.</p>
        </div>
      )}
      {selected && !pagination && <p className="text-xs text-gray-500">Recipients are resolved when the campaign dispatches.</p>}
    </div>
  );
}
