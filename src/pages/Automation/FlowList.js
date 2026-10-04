import React, { useEffect, useMemo, useState } from 'react';
import { Header, Sidebar } from '../../component/Menu';
import { FiGitBranch, FiPlus, FiEdit3, FiPower, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getFlowStatus, listFlows, deleteFlows } from '../../api/flowBuilder';

export default function FlowList() {
  const [minimized, setMinimized] = useState(() => JSON.parse(localStorage.getItem('sidebarMinimized') || 'false'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [flows, setFlows] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // { mode: 'single'|'bulk', ids: [], label }

  const load = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('userData') || '{}');
      const id = user.selected_project_id || user.projects?.[0]?.project_id || '';
      setProjectId(id);
      if (!id) return;
      const [list, status] = await Promise.all([listFlows(id), getFlowStatus(id)]);
      if (list.error) throw new Error(list.error);
      setFlows(list.data || []);
      setActiveId(status.active_flow?.flow_id || null);
      setSelected(new Set());
    } catch (error) {
      toast.error(error?.message || 'Could not load flows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { localStorage.setItem('sidebarMinimized', JSON.stringify(minimized)); load(); }, []);

  const groups = useMemo(() => ({
    published: flows.filter((f) => f.status === 'published'),
    draft: flows.filter((f) => f.status === 'draft'),
    archived: flows.filter((f) => f.status === 'archived'),
  }), [flows]);

  const openBuilder = (id) => { if (id) localStorage.setItem('flowBuilderOpenId', id); window.location.href = '/flow'; };

  const toggleSelect = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const requestDelete = (mode, ids, label) => setConfirmTarget({ mode, ids, label });

  const runDelete = async () => {
    if (!confirmTarget) return;
    const { ids } = confirmTarget;
    setDeleting(true);
    try {
      const result = await deleteFlows(projectId, ids);
      if (result.error) throw new Error(result.error);
      toast.success(ids.length > 1 ? `${ids.length} flows deleted` : 'Flow deleted');
      setConfirmTarget(null);
      await load();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to delete flow(s)');
    } finally {
      setDeleting(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={minimized} setIsMinimized={setMinimized} />
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={minimized} setIsMinimized={setMinimized} />
      <main className={`pt-16 transition-all ${minimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="p-4 md:p-8 max-w-8xl mx-auto">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FiGitBranch className="text-indigo-600" /> Flow Library</h1>
              <p className="text-sm text-slate-500 mt-1">All conversation flows for the selected project.</p>
            </div>
            <div className="flex gap-2">
              {selectedCount > 0 && (
                <button
                  onClick={() => requestDelete('bulk', Array.from(selected), `${selectedCount} selected flow${selectedCount > 1 ? 's' : ''}`)}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100"
                >
                  <FiTrash2 /> Delete ({selectedCount})
                </button>
              )}
              <button onClick={load} className="btn-secondary"><FiRefreshCw /> Refresh</button>
              <button onClick={() => openBuilder(null)} className="btn-primary"><FiPlus /> New flow</button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading flows...</div>
          ) : (
            <div className="space-y-6">
              {[['published', 'Published', groups.published], ['draft', 'Drafts', groups.draft], ['archived', 'Archived', groups.archived]].map(([key, label, items]) => (
                <section key={key}>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">{label} ({items.length})</h2>
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-400">No {label.toLowerCase()} flows.</div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {items.map((flow) => (
                        <div
                          key={flow.flow_id}
                          className={`bg-white rounded-xl border p-5 shadow-sm transition-colors ${selected.has(flow.flow_id) ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}
                        >
                          <div className="flex justify-between gap-3">
                            <div className="flex gap-3">
                              <input
                                type="checkbox"
                                checked={selected.has(flow.flow_id)}
                                onChange={() => toggleSelect(flow.flow_id)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <h3 className="font-semibold text-slate-800">{flow.name}</h3>
                                <p className="text-xs text-slate-500 mt-1">Version {flow.version} · Updated {flow.modify_date || '—'}</p>
                              </div>
                            </div>
                            {activeId === flow.flow_id && <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 shrink-0"><FiPower /> Active</span>}
                          </div>
                          <div className="mt-4 flex gap-2">
                            <button onClick={() => openBuilder(flow.flow_id)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"><FiEdit3 /> Open builder</button>
                            <button
                              onClick={() => requestDelete('single', [flow.flow_id], flow.name)}
                              className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100"
                            >
                              <FiTrash2 /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Delete {confirmTarget.mode === 'bulk' ? 'flows' : 'flow'}?</h3>
              <button onClick={() => setConfirmTarget(null)} className="text-slate-400 hover:text-slate-600"><FiX /></button>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              {confirmTarget.mode === 'bulk'
                ? `This will permanently delete ${confirmTarget.label}. This action cannot be undone.`
                : `This will permanently delete "${confirmTarget.label}". This action cannot be undone.`}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmTarget(null)} disabled={deleting} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button onClick={runDelete} disabled={deleting} className="px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}