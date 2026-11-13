import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../../../../config/api';
import { Users, Check, Loader2, Eye, X } from 'lucide-react';
import axios from 'axios';
import { Encrypt } from '../../../encryption/payload-encryption';

// Color palette for group icons
const GROUP_COLORS = [
  'bg-purple-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
];

export default function GroupsSelector({ selectedGroups, setSelectedGroups }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewPage, setPreviewPage] = useState(1);
  const previewRequestId = useRef(0);
  const projectId = tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '';

  // Load auth tokens from storage
  useEffect(() => {
    const loadTokens = () => {
      try {
        if (typeof window === 'undefined') return;
        const storages = [localStorage, sessionStorage];
        for (const storage of storages) {
          try {
            const data = storage?.getItem('userData');
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed === 'object') {
                setTokens(parsed);
                return;
              }
            }
          } catch (storageError) {
            console.error('Failed to parse tokens from storage:', storageError);
          }
        }
        setTokens(null);
      } catch (e) {
        console.error('Failed to load tokens:', e);
      }
    };
    loadTokens();
  }, []);

  // Load groups from API
  useEffect(() => {
    if (!tokens?.token || !tokens?.username) return;

    const loadGroups = async () => {
      try {
        setLoading(true);
        console.log('🌐 Loading groups from API...');

        // Campaign needs all groups available; fetch pages until meta.has_more is false
        let page = 1;
        const allGroups = [];
        const maxPages = 50; // safety valve

        while (page <= maxPages) {
          const payload = {
            project_id: projectId,
            page_no: page
          };

          const { data, key } = Encrypt(payload);
          const data_pass = JSON.stringify({ data, key });

          const response = await axios.post(
            `${API_BASE_URL}/contact/group-list`,
            data_pass,
            {
              headers: {
                'token': tokens.token,
                'username': tokens.username,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response?.data?.error) {
            console.warn('⚠️ API returned error:', response?.data?.message);
            break;
          }

          const apiList = response?.data?.data || [];
          const meta = response?.data?.meta || null;
          allGroups.push(...apiList);

          const hasMore = meta?.has_more ?? false;
          if (!hasMore) break;
          page += 1;
        }

        console.log(`📥 Received ${allGroups.length} groups from API (paged)`);

        // Map API response to component format with colors
        const mappedGroups = allGroups.map((g, index) => ({
          id: g.group_id,
          name: g.name,
          count: g.contact_count || 0,
          color: GROUP_COLORS[index % GROUP_COLORS.length], // Cycle through colors
          remark: g.remark,
          createdOn: g.create_date
        }));

        setGroups(mappedGroups);
        console.log(`✅ Loaded ${mappedGroups.length} groups`);
      } catch (error) {
        console.error('❌ Error loading groups:', error);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [tokens?.token, tokens?.username, tokens?.selected_project_id, tokens?.projects]);

  const handleToggleGroup = (groupId) => {
    previewRequestId.current += 1;
    setPreviewOpen(false);
    setPreviewLoading(false);
    setPreviewData(null);
    setPreviewError('');
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const loadSelectedContacts = async (pageNo = 1) => {
    if (!tokens?.token || !tokens?.username || !projectId || selectedGroups.length === 0) return;
    const requestId = ++previewRequestId.current;
    try {
      setPreviewLoading(true);
      setPreviewError('');
      const payload = {
        project_id: projectId,
        group_ids: selectedGroups,
        page_no: pageNo,
        limit: 25,
      };
      const { data, key } = Encrypt(payload);
      const response = await axios.post(
        `${API_BASE_URL}/contact/group-campaign-preview`,
        JSON.stringify({ data, key }),
        {
          headers: {
            token: tokens.token,
            username: tokens.username,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response?.data?.error) {
        throw new Error(typeof response.data.error === 'string' ? response.data.error : 'Unable to preview selected contacts');
      }
      if (requestId === previewRequestId.current) {
        setPreviewData({
          contacts: response.data?.data || [],
          meta: response.data?.meta || { total_records: 0, total_pages: 0 },
        });
        setPreviewPage(pageNo);
      }
    } catch (error) {
      if (requestId === previewRequestId.current) {
        setPreviewError(error?.response?.data?.error || error.message || 'Unable to preview selected contacts');
      }
    } finally {
      if (requestId === previewRequestId.current) setPreviewLoading(false);
    }
  };

  const togglePreview = () => {
    if (previewOpen) {
      previewRequestId.current += 1;
      setPreviewOpen(false);
      setPreviewLoading(false);
      return;
    }
    setPreviewOpen(true);
    setPreviewData(null);
    loadSelectedContacts(1);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Select Groups ({selectedGroups.length} selected)</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          <span className="ml-2 text-gray-600">Loading groups...</span>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Select Groups ({selectedGroups.length} selected)</h3>
        </div>
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No groups available</p>
        </div>
      </div>
    );
  }

  const selectedGroupNames = selectedGroups
    .map(id => groups.find(group => group.id === id)?.name)
    .filter(Boolean);
  const selectedGroupSummary = selectedGroupNames.length > 2
    ? `${selectedGroupNames.slice(0, 2).join(', ')} + ${selectedGroupNames.length - 2} more`
    : selectedGroupNames.join(', ');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-700">Select Groups</h3>
          <p className="text-sm text-gray-500">Choose one or more groups for this campaign.</p>
        </div>
      </div>
      {selectedGroups.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-white p-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">{selectedGroups.length} groups selected</p>
            <p className="truncate text-xs text-gray-500" title={selectedGroupNames.join(', ')}>
              {selectedGroupSummary || 'Selected groups'}
            </p>
          </div>
          <button
            type="button"
            onClick={togglePreview}
            disabled={!projectId || previewLoading}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Eye size={16} />
            {previewOpen ? 'Hide preview' : 'Preview audience'}
          </button>
        </div>
      )}
      <div className="max-h-[65vh] space-y-3 overflow-y-auto overscroll-contain pr-1 scrollbar-hide">
        {groups.map(group => (
          <div
            key={group.id}
            onClick={() => handleToggleGroup(group.id)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedGroups.includes(group.id)
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${group.color} rounded-full flex items-center justify-center`}>
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-medium text-gray-800">{group.name}</div>
                  <div className="text-sm text-gray-500">{group.count} contacts</div>
                </div>
              </div>
              {selectedGroups.includes(group.id) && <Check className="w-6 h-6 text-indigo-600" />}
            </div>
          </div>
        ))}
      </div>
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) togglePreview();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="selected-group-preview-title"
            className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 id="selected-group-preview-title" className="text-lg font-semibold text-gray-900">Selected campaign audience</h3>
                <p className="mt-1 truncate text-sm text-gray-500" title={selectedGroupNames.join(', ')}>
                  {selectedGroupSummary}
                </p>
              </div>
              <button
                type="button"
                onClick={togglePreview}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close preview"
              >
                <X size={20} />
              </button>
            </div>
            {previewError && <p role="alert" className="mb-3 text-sm text-red-600">{previewError}</p>}
            {previewLoading && !previewData && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading selected contacts…
              </div>
            )}
            {previewData && (
              <>
                <p className="mb-3 text-sm font-medium text-gray-800">
                  {Number(previewData.meta.total_records || 0).toLocaleString()} unique contacts
                </p>
                {previewData.contacts.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">The selected groups have no contacts.</p>
                ) : (
                  <ul className="max-h-[55vh] divide-y overflow-y-auto rounded-lg border scrollbar-hide">
                    {previewData.contacts.map((contact) => (
                      <li key={contact.contact_id} className="px-3 py-2">
                        <p className="text-sm font-medium text-gray-800">{contact.name || 'Unnamed contact'}</p>
                        <p className="text-xs text-gray-600">{contact.number || 'No number'}{contact.email ? ` · ${contact.email}` : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {previewData.meta.total_pages > 1 && (
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => loadSelectedContacts(previewPage - 1)}
                      disabled={previewLoading || previewPage <= 1}
                      className="text-indigo-700 disabled:opacity-50"
                    >Previous</button>
                    <span>Page {previewPage} of {previewData.meta.total_pages}</span>
                    <button
                      type="button"
                      onClick={() => loadSelectedContacts(previewPage + 1)}
                      disabled={previewLoading || previewPage >= previewData.meta.total_pages}
                      className="text-indigo-700 disabled:opacity-50"
                    >Next</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

