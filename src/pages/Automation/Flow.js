import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Header, Sidebar } from '../../component/Menu';
import SearchableSelect from '../../component/SearchableSelect';
import { FiGitBranch, FiMessageSquare, FiType, FiGitMerge, FiFlag, FiStopCircle, FiSave, FiUploadCloud, FiPower, FiPlus, FiTrash2, FiMove, FiCornerUpLeft, FiCornerUpRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { createFlow, getFlow, getFlowStatus, listFlows, publishFlow, toggleFlow, updateFlowDraft, validateFlow } from '../../api/flowBuilder';

const palette = [
  { type: 'message', label: 'Message', icon: FiMessageSquare, defaults: { text: 'Thanks for contacting us.', interactive: false, interactiveType: 'list', items: [{ id: 'option_1', title: 'Yes' }, { id: 'option_2', title: 'No' }] } },
  { type: 'keyword', label: 'Keyword', icon: FiType, defaults: { value: 'hello', match: 'contains' } },
  { type: 'condition', label: 'Condition', icon: FiGitMerge, defaults: { value: 'yes' } },
  { type: 'end', label: 'End', icon: FiFlag, defaults: {} },
  { type: 'stop', label: 'Stop', icon: FiStopCircle, defaults: {} },
];

const emptyGraph = () => ({ version: 1, nodes: [{ id: 'start', type: 'start', position: { x: 80, y: 80 }, data: {} }], edges: [] });
const labelFor = (node) => node.type === 'message' ? node.data?.text || 'Message' : node.type === 'keyword' ? `Keyword: ${node.data?.value || ''}` : node.type[0].toUpperCase() + node.type.slice(1);

export default function Flow() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => JSON.parse(localStorage.getItem('sidebarMinimized') || 'false'));
  const [projectId, setProjectId] = useState('');
  const [flowId, setFlowId] = useState(null);
  const [flowName, setFlowName] = useState('Customer Support Flow');
  const [graph, setGraph] = useState(emptyGraph);
  const [selectedId, setSelectedId] = useState('start');
  const [connectFrom, setConnectFrom] = useState(null);
  const [connectionDrag, setConnectionDrag] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [flows, setFlows] = useState([]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const graphRef = useRef(graph);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  const commitGraph = (nextGraph) => {
    const current = graphRef.current;
    const next = typeof nextGraph === 'function' ? nextGraph(current) : nextGraph;
    if (next === current) return;
    setPast((items) => [...items, current].slice(-50));
    setFuture([]);
    graphRef.current = next;
    setGraph(next);
  };
  const resetGraphHistory = (nextGraph) => {
    graphRef.current = nextGraph;
    setGraph(nextGraph);
    setPast([]);
    setFuture([]);
  };
  const undo = () => {
    setPast((items) => {
      if (!items.length) return items;
      const previous = items[items.length - 1];
      setFuture((redoItems) => [graphRef.current, ...redoItems].slice(0, 50));
      graphRef.current = previous;
      setGraph(previous);
      return items.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((items) => {
      if (!items.length) return items;
      const next = items[0];
      setPast((undoItems) => [...undoItems, graphRef.current].slice(-50));
      graphRef.current = next;
      setGraph(next);
      return items.slice(1);
    });
  };
  useEffect(() => {
    const handleHistoryShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  });

  useEffect(() => localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized)), [isMinimized]);
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('userData') || '{}');
    setProjectId(user.selected_project_id || user.projects?.[0]?.project_id || '');
  }, []);
  useEffect(() => { if (projectId) loadFlows(); }, [projectId]);

  const openFlow = async (id) => {
    const result = await getFlow(projectId, id);
    if (result.error) throw new Error(result.error);
    setFlowId(id); setFlowName(result.data.name); resetGraphHistory(result.data.draft || emptyGraph()); setSelectedId(null); setConnectFrom(null);
  };
  const loadFlows = async () => {
    try {
      const result = await listFlows(projectId); const items = result.data || []; setFlows(items);
      const status = await getFlowStatus(projectId); setEnabled(Boolean(status.flow_builder_enabled));
      const requested = localStorage.getItem('flowBuilderOpenId');
      if (requested) { localStorage.removeItem('flowBuilderOpenId'); await openFlow(requested); }
      else if (status.active_flow?.flow_id) await openFlow(status.active_flow.flow_id); else if (items[0]) await openFlow(items[0].flow_id);
    } catch (error) { toast.error(error?.response?.data?.error || 'Unable to load flows'); }
  };
  const addNode = (item, position = { x: 260, y: 120 }) => {
    const id = `${item.type}-${Date.now()}`;
    commitGraph((current) => ({ ...current, nodes: [...current.nodes, { id, type: item.type, position, data: { ...item.defaults } }] }));
    setSelectedId(id);
  };
  const dropNode = (event) => {
    event.preventDefault(); const item = palette.find((entry) => entry.type === event.dataTransfer.getData('flow-node')); if (!item) return;
    const rect = event.currentTarget.getBoundingClientRect(); addNode(item, { x: Math.max(20, (event.clientX - rect.left + event.currentTarget.scrollLeft) / zoom - 90), y: Math.max(20, (event.clientY - rect.top + event.currentTarget.scrollTop) / zoom - 35) });
  };
  const zoomCanvas = (event) => {
    // Normal wheel/two-finger gestures remain available for X/Y scrolling.
    // Ctrl/Cmd + wheel is the standard browser gesture for zooming, including trackpad pinch.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    // Use a small, delta-based step so both mouse wheels and trackpads zoom smoothly.
    const amount = Math.max(-0.04, Math.min(0.04, -event.deltaY / 450));
    setZoom((value) => Math.min(2, Math.max(0.5, Number((value + amount).toFixed(3)))));
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    canvas.style.zoom = zoom;
    canvas.addEventListener('wheel', zoomCanvas, { passive: false });
    return () => {
      canvas.style.zoom = 1;
      canvas.removeEventListener('wheel', zoomCanvas);
    };
  }, [zoom]);
  const connectNode = (id) => {
    if (!connectFrom) { setConnectFrom(id); setSelectedId(id); return; }
    if (connectFrom !== id) {
      commitGraph((current) => current.edges.some((edge) => edge.source === connectFrom && edge.target === id)
        ? current
        : ({ ...current, edges: [...current.edges, { id: `edge-${Date.now()}`, source: connectFrom, target: id }] }));
    }
    setConnectFrom(null); setSelectedId(id);
  };
  const finishConnection = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    commitGraph((current) => current.edges.some((edge) => edge.source === sourceId && edge.target === targetId)
      ? current
      : ({ ...current, edges: [...current.edges, { id: `edge-${Date.now()}`, source: sourceId, target: targetId }] }));
    setSelectedId(targetId);
  };
  useEffect(() => {
    if (!connectionDrag) return undefined;
    const move = (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setConnectionDrag((current) => current ? { ...current, x: (event.clientX - rect.left + canvas.scrollLeft) / zoom, y: (event.clientY - rect.top + canvas.scrollTop) / zoom } : current);
    };
    const end = (event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-flow-node]');
      finishConnection(connectionDrag.source, target?.getAttribute('data-flow-node'));
      setConnectionDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  }, [connectionDrag, zoom]);
  const selectNode = (id) => { setSelectedId(id); if (connectFrom) connectNode(id); };
  const moveNode = (id, clientX, clientY) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const next = { ...graphRef.current, nodes: graphRef.current.nodes.map((node) => node.id === id ? { ...node, position: { x: Math.max(12, (clientX - rect.left + canvas.scrollLeft) / zoom - dragRef.current.offsetX), y: Math.max(12, (clientY - rect.top + canvas.scrollTop) / zoom - dragRef.current.offsetY) } } : node) };
    graphRef.current = next;
    setGraph(next);
  };
  useEffect(() => {
    const move = (event) => { if (dragRef.current) { dragRef.current.moved = true; moveNode(dragRef.current.id, event.clientX, event.clientY); } };
    const end = () => {
      const drag = dragRef.current;
      if (drag?.moved && drag.before) {
        setPast((items) => [...items, drag.before].slice(-50));
        setFuture([]);
      }
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
  });
  const startNodeDrag = (event, node) => {
    if (event.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    dragRef.current = { id: node.id, moved: false, before: graphRef.current, offsetX: (event.clientX - rect.left + (canvasRef.current?.scrollLeft || 0)) / zoom - node.position.x, offsetY: (event.clientY - rect.top + (canvasRef.current?.scrollTop || 0)) / zoom - node.position.y };
    setSelectedId(node.id);
  };
  const updateNode = (field, value) => commitGraph((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === selectedId ? { ...node, data: { ...node.data, [field]: value } } : node) }));
  const deleteNode = () => {
    if (!selectedId || selectedId === 'start') return;
    commitGraph((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== selectedId), edges: current.edges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId) }));
    setSelectedId(null);
  };
  const save = async () => {
    if (!projectId) return toast.error('Select a project first');
    setBusy(true);
    try {
      let id = flowId;
      if (!id) { const result = await createFlow({ project_id: projectId, name: flowName, graph }); if (result.error || !result.data?.flow_id) throw new Error(result.error || 'Flow was not created'); id = result.data.flow_id; setFlowId(id); }
      else { const result = await updateFlowDraft({ project_id: projectId, flow_id: id, name: flowName, graph }); if (result.error) throw new Error(result.error); }
      toast.success('Draft saved'); await loadFlows();
    } catch (error) { toast.error(error?.response?.data?.error || 'Failed to save draft'); } finally { setBusy(false); }
  };
  const publish = async () => {
    if (!flowId) return toast.error('Save the flow before publishing');
    setBusy(true);
    try {
      const result = await validateFlow({ project_id: projectId, graph });
      if (!result.valid) return toast.error((result.errors || []).join(', '));
      const saved = await updateFlowDraft({ project_id: projectId, flow_id: flowId, name: flowName, graph }); if (saved.error) throw new Error(saved.error); const published = await publishFlow({ project_id: projectId, flow_id: flowId }); if (published.error) throw new Error(published.error); toast.success('Flow published');
    } catch (error) { toast.error(error?.response?.data?.error || 'Failed to publish'); } finally { setBusy(false); }
  };
  const toggle = async () => {
    try { const result = await toggleFlow({ project_id: projectId, flow_id: flowId, enabled: !enabled }); if (result.error) return toast.error(result.error); setEnabled(!enabled); toast.success(`Flow Builder turned ${!enabled ? 'on' : 'off'}`); } catch { toast.error('Failed to update Flow Builder'); }
  };
  const selectedNode = useMemo(() => graph.nodes.find((node) => node.id === selectedId), [graph.nodes, selectedId]);
  const canvasSize = useMemo(() => {
    const maxX = graph.nodes.reduce((value, node) => Math.max(value, Number(node.position?.x) || 20), 900);
    const maxY = graph.nodes.reduce((value, node) => Math.max(value, Number(node.position?.y) || 20), 620);
    return { width: maxX + 240, height: maxY + 180 };
  }, [graph.nodes]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
      <main className={`pt-16 transition-all ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="p-4 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5"><div><h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><FiGitBranch className="text-indigo-600" /> Flow Builder</h1><p className="text-sm text-slate-500 mt-1">Click a node to edit it. Drag from the library or use Add, then use Connect to link steps.</p></div><div className="flex gap-2"><button onClick={save} disabled={busy} className="btn-primary"><FiSave /> Save draft</button><button onClick={publish} disabled={busy} className="btn-secondary"><FiUploadCloud /> Publish</button><button onClick={toggle} disabled={!flowId} className="btn-secondary"><FiPower /> {enabled ? 'Enabled' : 'Enable'}</button></div></div>
          <div className="flex gap-3 mb-4 overflow-x-auto">{flows.map((flow) => <button key={flow.flow_id} onClick={() => openFlow(flow.flow_id)} className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${flow.flow_id === flowId ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border'}`}>{flow.name}</button>)}<button onClick={() => { setFlowId(null); setFlowName('New Flow'); resetGraphHistory(emptyGraph()); setSelectedId('start'); setConnectFrom(null); }} className="px-3 py-2 rounded-lg border border-dashed text-indigo-600 whitespace-nowrap"><FiPlus className="inline" /> New flow</button></div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b"><div className="flex items-center gap-3"><input value={flowName} onChange={(event) => setFlowName(event.target.value)} className="font-semibold bg-transparent outline-none px-2 py-1" /><span className="text-xs text-slate-400">{enabled ? 'Live' : 'Draft mode'}</span></div><div className="flex items-center gap-1"><span className="mr-2 text-[10px] text-slate-400">Edit history</span><button type="button" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo" onClick={undo} disabled={!past.length} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"><FiCornerUpLeft /></button><button type="button" title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo" onClick={redo} disabled={!future.length} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"><FiCornerUpRight /></button></div></div>
            <div className="flow-builder-layout grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_300px] min-h-[620px]">
              <aside className="order-2 lg:order-1 border-b lg:border-b-0 lg:border-r bg-slate-50/90 p-4"><div className="flex items-center justify-between mb-1"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Add tools</p><span className="text-[10px] text-slate-400">Drag or click</span></div><p className="text-xs text-slate-400 leading-5 mb-4">Build your conversation by adding steps to the canvas.</p>{palette.map((item) => { const Icon = item.icon; return <button key={item.type} type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('flow-node', item.type); }} onClick={() => addNode(item)} className="w-full flex items-center gap-3 p-3 mb-2 bg-white border border-slate-200 rounded-xl cursor-grab text-left hover:border-indigo-400 hover:shadow-sm transition"><span className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><Icon /></span><span><span className="block text-sm font-semibold text-slate-700">{item.label}</span><span className="block text-[10px] text-slate-400">Click to add</span></span></button>; })}<div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3 text-xs text-slate-500"><strong className="text-slate-700">Tip:</strong> Select a node, then choose <span className="font-semibold text-indigo-600">Connect from here</span>.</div></aside>
              <section ref={canvasRef} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={dropNode} className="order-1 lg:order-2 relative min-h-[620px] overflow-auto bg-[radial-gradient(#dbe3f0_1px,transparent_1px)] [background-size:18px_18px] p-5"><svg style={{ width: canvasSize.width, height: canvasSize.height }} className="absolute inset-0 pointer-events-none">{graph.edges.map((edge) => { const source = graph.nodes.find((node) => node.id === edge.source); const target = graph.nodes.find((node) => node.id === edge.target); if (!source || !target) return null; return <line key={edge.id} x1={(source.position?.x || 20) + 88} y1={(source.position?.y || 20) + 76} x2={(target.position?.x || 20) + 88} y2={(target.position?.y || 20) + 20} stroke="#6366f1" strokeWidth="2.5" markerEnd="url(#arrow)" />; })}{connectionDrag && graph.nodes.find((node) => node.id === connectionDrag.source) && <line x1={(graph.nodes.find((node) => node.id === connectionDrag.source).position?.x || 20) + 88} y1={(graph.nodes.find((node) => node.id === connectionDrag.source).position?.y || 20) + 76} x2={connectionDrag.x} y2={connectionDrag.y} stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" markerEnd="url(#connection-arrow)" /> }<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#6366f1" /></marker><marker id="connection-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#f59e0b" /></marker></defs></svg>{graph.nodes.map((node) => <div key={node.id} data-flow-node={node.id} onPointerDown={(event) => startNodeDrag(event, node)} onClick={() => selectNode(node.id)} style={{ left: node.position?.x || 20, top: node.position?.y || 20 }} className={`absolute w-44 rounded-xl border-2 bg-white shadow-sm cursor-move select-none touch-none ${selectedId === node.id ? 'border-indigo-500 ring-4 ring-indigo-100' : connectionDrag?.source === node.id ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200'}`}><div className="px-3 py-2 border-b text-xs font-bold flex items-center justify-between"><span>{node.type}</span><FiMove className="text-slate-400" /></div><div className="p-3 text-sm text-slate-600 break-words">{labelFor(node)}</div><div className="relative mx-3 mb-2"><button type="button" title="Drag to connect to another node" aria-label={`Drag from ${node.type} to connect`} onPointerDown={(event) => { event.stopPropagation(); const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return; const canvas = canvasRef.current; setConnectionDrag({ source: node.id, x: event.clientX - rect.left + canvas.scrollLeft, y: event.clientY - rect.top + canvas.scrollTop }); }} className="w-full rounded-lg border border-dashed border-indigo-300 bg-indigo-50 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-100">Drag from here →</button><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); connectNode(node.id); }} className="mt-1 w-full rounded-lg py-1 text-[10px] text-slate-400 hover:bg-slate-50">{connectFrom === node.id ? 'Click target node' : 'Use click connect'}</button></div></div>)}</section>
              <aside className="order-3 p-4 border-t lg:border-t-0 lg:border-l bg-white dark:bg-gray-800 min-h-[220px]"><p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Node settings</p>{selectedNode ? <div className="space-y-3"><div className="text-sm font-semibold">{selectedNode.type}</div>{selectedNode.type === 'message' && <><label className="text-xs text-slate-500">Message<textarea value={selectedNode.data?.text || ''} onChange={(event) => updateNode('text', event.target.value)} rows={5} className="field mt-1" /></label><label className="flex gap-2 text-xs"><input type="checkbox" checked={Boolean(selectedNode.data?.interactive)} onChange={(event) => updateNode('interactive', event.target.checked)} /> Interactive message</label>{Boolean(selectedNode.data?.interactive) && <><label className="text-xs text-slate-500">Interactive type<SearchableSelect value={selectedNode.data?.interactiveType || 'list'} onChange={(event) => updateNode('interactiveType', event.target.value)} options={[{ value: 'button', label: 'Reply buttons' }, { value: 'list', label: 'List menu' }]} className="field mt-1" /></label><label className="text-xs text-slate-500">Options JSON<textarea value={JSON.stringify(selectedNode.data?.items || [], null, 2)} onChange={(event) => { try { const items = JSON.parse(event.target.value); if (Array.isArray(items)) updateNode('items', items); } catch { /* keep editing until valid JSON */ } }} rows={5} className="field mt-1 font-mono text-[11px]" /><span className="block text-[10px] text-slate-400">Use objects with id, title, and optional description. List messages may also use sections.</span></label></>}</>}{['keyword', 'condition'].includes(selectedNode.type) && <label className="text-xs text-slate-500">Match value<input value={selectedNode.data?.value || ''} onChange={(event) => updateNode('value', event.target.value)} className="field mt-1" /></label>}{selectedNode.type !== 'start' && <button onClick={deleteNode} className="text-sm text-rose-600 flex items-center gap-2"><FiTrash2 /> Delete node</button>}</div> : <p className="text-sm text-slate-400">Select a node to edit it.</p>}</aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
