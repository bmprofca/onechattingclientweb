import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { uploadFile } from '../utils/uploadFile';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import { fetchProjectInfo } from '../store/projectSlice';
import { Encrypt } from './encryption/payload-encryption';
import {
    FiArrowLeft, FiShield, FiLock, FiEdit2, FiPlus, FiTrash2,
    FiChevronDown, FiChevronUp, FiMessageSquare, FiInfo, FiFileText, FiX, FiUpload,
    FiAlertTriangle, FiCheck, FiKey, FiExternalLink
} from 'react-icons/fi';
import toast from 'react-hot-toast';

/* ─── Helpers ─────────────────────────────────────────────── */

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const TABS = [
    {
        id: 'overview',
        label: 'Company Info',
        icon: FiShield,
        color: 'sky',
        description: 'Company overview and address information used for introductory answers.'
    },
    {
        id: 'qa',
        label: 'Q & A',
        icon: FiMessageSquare,
        color: 'emerald',
        description: 'Question and answer pairs to match user inquiries and FAQs.'
    },
    {
        id: 'info',
        label: 'Key-Value',
        icon: FiInfo,
        color: 'blue',
        description: 'Structured parameters, attributes, contact details, and specifications.'
    },
    {
        id: 'text',
        label: 'Free Text',
        icon: FiFileText,
        color: 'amber',
        description: 'Free-form contextual knowledge, policies, procedures, and terms.'
    },
    {
        id: 'docs',
        label: 'Documents',
        icon: FiUpload,
        color: 'purple',
        description: 'Uploaded reference documents (PDF, Excel, CSV) for deep context retrieval.'
    }
];

const SECTION_TYPES = [
    { value: 'qa', label: 'Q & A', icon: FiMessageSquare, color: 'emerald' },
    { value: 'info', label: 'Key-Value', icon: FiInfo, color: 'blue' },
    { value: 'text', label: 'Free Text', icon: FiFileText, color: 'amber' },
    { value: 'docs', label: 'Document', icon: FiUpload, color: 'purple' }
];

const TYPE_COLORS = {
    overview: {
        bg: 'bg-sky-50',
        activeBg: 'bg-sky-600',
        activeText: 'text-white',
        text: 'text-sky-600',
        border: 'border-sky-200',
        badge: 'bg-sky-100 text-sky-700'
    },
    qa: {
        bg: 'bg-emerald-50',
        activeBg: 'bg-emerald-600',
        activeText: 'text-white',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-700'
    },
    info: {
        bg: 'bg-blue-50',
        activeBg: 'bg-blue-600',
        activeText: 'text-white',
        text: 'text-blue-600',
        border: 'border-blue-200',
        badge: 'bg-blue-100 text-blue-700'
    },
    text: {
        bg: 'bg-amber-50',
        activeBg: 'bg-amber-600',
        activeText: 'text-white',
        text: 'text-amber-600',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-700'
    },
    docs: {
        bg: 'bg-purple-50',
        activeBg: 'bg-purple-600',
        activeText: 'text-white',
        text: 'text-purple-600',
        border: 'border-purple-200',
        badge: 'bg-purple-100 text-purple-700'
    }
};

const createEmptyItem = (type) => {
    const id = generateId();
    switch (type) {
        case 'qa': return { id, question: '', answer: '' };
        case 'info': return { id, label: '', value: '' };
        case 'text': return { id, content: '' };
        case 'docs': return { id, label: '', url: '', fileName: '', fileType: '' };
        default: return { id, question: '', answer: '' };
    }
};

const createEmptySection = (type = 'qa') => ({
    id: generateId(),
    title: '',
    type,
    items: [createEmptyItem(type)],
    collapsed: false
});

/** Parse a context string (JSON or legacy plain text) into { sections, companyOverview, companyAddress } */
const parseContextToSections = (contextStr) => {
    const result = { sections: [], companyOverview: '', companyAddress: '' };
    if (!contextStr) return result;
    try {
        const parsed = JSON.parse(contextStr);
        result.companyOverview = parsed?.companyOverview || '';
        result.companyAddress = parsed?.companyAddress || '';
        if (parsed && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
            result.sections = parsed.sections.map(s => ({ ...s, collapsed: false }));
            return result;
        }
    } catch (_) { }
    // Legacy plain text fallback
    if (!result.sections.length && contextStr) {
        try { JSON.parse(contextStr); } catch (_) {
            result.sections = [{
                id: generateId(),
                title: 'General Context',
                type: 'text',
                items: [{ id: generateId(), content: contextStr }],
                collapsed: false
            }];
        }
    }
    return result;
};

/** Serialize sections + fixed fields to a JSON string for storage */
const serializeSectionsToJSON = (sections, companyOverview = '', companyAddress = '') => {
    const clean = sections.map(({ collapsed, ...rest }) => rest);
    return JSON.stringify({ companyOverview, companyAddress, sections: clean });
};

const PROJECT_CONFIG_STORAGE_KEY = (projectId) => `project_config_${projectId}`;

const getStoredConfig = (projectId) => {
    try {
        const raw = localStorage.getItem(PROJECT_CONFIG_STORAGE_KEY(projectId));
        if (!raw) return { companyContext: '', agentUsePersonalKey: false };
        const parsed = JSON.parse(raw);
        return {
            companyContext: parsed?.companyContext || '',
            agentUsePersonalKey: Boolean(parsed?.agentUsePersonalKey ?? false)
        };
    } catch { return { companyContext: '', agentUsePersonalKey: false }; }
};

const updateStoredConfig = (projectId, partialConfig) => {
    if (!projectId) return;
    try {
        const raw = localStorage.getItem(PROJECT_CONFIG_STORAGE_KEY(projectId));
        const prev = raw ? JSON.parse(raw) : {};
        localStorage.setItem(PROJECT_CONFIG_STORAGE_KEY(projectId), JSON.stringify({ ...prev, ...partialConfig }));
    } catch (e) {
        console.warn('Failed to save project config', e);
    }
};

/* ─── Component ───────────────────────────────────────────── */

function ContextConfig() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isOwner = useSelector((state) => state.project?.owned ?? false);
    const projectInfo = useSelector((state) => state.project?.info);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    const [projectId, setProjectId] = useState(null);
    const [usePersonalKey, setUsePersonalKey] = useState(false);
    const [sections, setSections] = useState([]);
    const [originalSections, setOriginalSections] = useState([]);
    const [companyOverview, setCompanyOverview] = useState('');
    const [companyAddress, setCompanyAddress] = useState('');
    const [originalCompanyOverview, setOriginalCompanyOverview] = useState('');
    const [originalCompanyAddress, setOriginalCompanyAddress] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadingDocId, setUploadingDocId] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        if (projectInfo === null && dispatch) {
            dispatch(fetchProjectInfo());
        }
    }, [dispatch, projectInfo]);

    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (!userData) { setIsLoading(false); return; }
        try {
            const parsed = JSON.parse(userData);
            const id = parsed?.selected_project_id || parsed?.projects?.list?.[0]?.project_id || '';
            setProjectId(id);
            if (id) {
                const stored = getStoredConfig(id);
                const parsed2 = parseContextToSections(stored.companyContext);
                setSections(parsed2.sections);
                setOriginalSections(JSON.parse(JSON.stringify(parsed2.sections)));
                setCompanyOverview(parsed2.companyOverview);
                setCompanyAddress(parsed2.companyAddress);
                setOriginalCompanyOverview(parsed2.companyOverview);
                setOriginalCompanyAddress(parsed2.companyAddress);
                setUsePersonalKey(Boolean(stored.agentUsePersonalKey));
            }
        } catch (_) { }
        setIsLoading(false);
    }, []);

    // Fetch context and API key settings from server
    useEffect(() => {
        if (!projectId || !isOwner) { setIsLoading(false); return; }
        let cancelled = false;
        const fetchSettings = async () => {
            const userDataRaw = localStorage.getItem('userData');
            let token = '', username = '';
            try {
                const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
                token = parsed?.token || '';
                username = parsed?.username || '';
            } catch (_) { }
            if (!token || !username) { setIsLoading(false); return; }
            try {
                const payload = { project_id: projectId };
                const { data, key } = Encrypt(payload);

                // 1. Fetch context settings
                const response = await axios.post(
                    `${API_BASE_URL}/bot-reply/get-settings`,
                    JSON.stringify({ data, key }),
                    { headers: { token, username, 'Content-Type': 'application/json' } }
                );
                if (cancelled) return;
                if (response?.data?.error) {
                    const stored = getStoredConfig(projectId);
                    const p = parseContextToSections(stored.companyContext);
                    setSections(p.sections);
                    setOriginalSections(JSON.parse(JSON.stringify(p.sections)));
                    setCompanyOverview(p.companyOverview);
                    setCompanyAddress(p.companyAddress);
                    setOriginalCompanyOverview(p.companyOverview);
                    setOriginalCompanyAddress(p.companyAddress);
                } else {
                    const ctx = response?.data?.data?.context || '';
                    const p = parseContextToSections(ctx);
                    setSections(p.sections);
                    setOriginalSections(JSON.parse(JSON.stringify(p.sections)));
                    setCompanyOverview(p.companyOverview);
                    setCompanyAddress(p.companyAddress);
                    setOriginalCompanyOverview(p.companyOverview);
                    setOriginalCompanyAddress(p.companyAddress);
                    updateStoredConfig(projectId, { companyContext: ctx });
                }

                // 2. Fetch API key settings
                try {
                    const keyResponse = await axios.post(
                        `${API_BASE_URL}/bot-reply/list-api-keys`,
                        JSON.stringify({ data, key }),
                        { headers: { token, username, 'Content-Type': 'application/json' } }
                    );
                    if (!cancelled && !keyResponse?.data?.error && keyResponse?.data?.data) {
                        const isPersonal = Boolean(keyResponse.data.data.agent_use_personal_key);
                        const keys = keyResponse.data.data.keys || [];
                        const personalActive = isPersonal && keys.length > 0;
                        setUsePersonalKey(personalActive);
                        updateStoredConfig(projectId, { agentUsePersonalKey: personalActive });
                    }
                } catch (_) {
                    if (!cancelled) setUsePersonalKey(false);
                }
            } catch (_) {
                if (!cancelled) {
                    const stored = getStoredConfig(projectId);
                    const p = parseContextToSections(stored.companyContext);
                    setSections(p.sections);
                    setOriginalSections(JSON.parse(JSON.stringify(p.sections)));
                    setCompanyOverview(p.companyOverview);
                    setCompanyAddress(p.companyAddress);
                    setOriginalCompanyOverview(p.companyOverview);
                    setOriginalCompanyAddress(p.companyAddress);
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchSettings();
        return () => { cancelled = true; };
    }, [projectId, isOwner]);

    /* ─── Counts per Tab ──────────────────────────────── */

    const tabCounts = useMemo(() => {
        let overviewCount = 0;
        if (companyOverview && companyOverview.trim()) overviewCount++;
        if (companyAddress && companyAddress.trim()) overviewCount++;

        const counts = { overview: overviewCount, qa: 0, info: 0, text: 0, docs: 0 };

        sections.forEach(s => {
            const count = s.items?.filter(i => {
                if (s.type === 'qa') return Boolean(i.question?.trim() || i.answer?.trim());
                if (s.type === 'info') return Boolean(i.label?.trim() || i.value?.trim());
                if (s.type === 'text') return Boolean(i.content?.trim());
                if (s.type === 'docs') return Boolean(i.label?.trim() || i.url);
                return true;
            }).length || 0;

            if (counts[s.type] !== undefined) {
                counts[s.type] += (count > 0 ? count : (s.items?.length || 1));
            }
        });

        return counts;
    }, [sections, companyOverview, companyAddress]);

    /* ─── Section & Item CRUD ─────────────────────────── */

    const addSection = useCallback((type = 'qa') => {
        if (type === 'docs' && !usePersonalKey) {
            toast.error('Document context can only be added when using a Personal API Key for AI auto reply.');
            return;
        }
        const newSec = createEmptySection(type);
        setSections(prev => [...prev, newSec]);
        setActiveTab(type);
    }, [usePersonalKey]);

    const removeSection = useCallback((sectionId) => {
        setSections(prev => prev.filter(s => s.id !== sectionId));
    }, []);

    const updateSectionField = useCallback((sectionId, field, value) => {
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, [field]: value } : s));
    }, []);

    const changeSectionType = useCallback((sectionId, newType) => {
        if (newType === 'docs' && !usePersonalKey) {
            toast.error('Document context can only be selected when using a Personal API Key for AI auto reply.');
            return;
        }
        setSections(prev => prev.map(s => {
            if (s.id !== sectionId) return s;
            return { ...s, type: newType, items: [createEmptyItem(newType)] };
        }));
        setActiveTab(newType);
    }, [usePersonalKey]);

    const toggleSectionCollapse = useCallback((sectionId) => {
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s));
    }, []);

    const addItem = useCallback((sectionId, type) => {
        setSections(prev => prev.map(s => {
            if (s.id !== sectionId) return s;
            return { ...s, items: [...s.items, createEmptyItem(type)] };
        }));
    }, []);

    const removeItem = useCallback((sectionId, itemId) => {
        setSections(prev => prev.map(s => {
            if (s.id !== sectionId) return s;
            const filtered = s.items.filter(i => i.id !== itemId);
            return { ...s, items: filtered.length > 0 ? filtered : [createEmptyItem(s.type)] };
        }));
    }, []);

    const updateItemField = useCallback((sectionId, itemId, field, value) => {
        setSections(prev => prev.map(s => {
            if (s.id !== sectionId) return s;
            return {
                ...s,
                items: s.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
            };
        }));
    }, []);

    const handleFileUpload = async (sectionId, itemId, file) => {
        if (!file || !projectId) return;

        if (!usePersonalKey) {
            toast.error('Document upload is disabled. Personal API Key is required for document context.');
            return;
        }

        setUploadingDocId(itemId);
        try {
            const uploadResult = await uploadFile(file);
            const fileUrl = uploadResult.url;
            const ext = file.name.split('.').pop().toLowerCase();

            setSections(prev => prev.map(s => {
                if (s.id !== sectionId) return s;
                return {
                    ...s,
                    items: s.items.map(i => i.id === itemId ? {
                        ...i,
                        label: i.label || file.name,
                        url: fileUrl,
                        fileName: file.name,
                        fileType: ext
                    } : i)
                };
            }));
            toast.success('Document uploaded successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error || error?.message || 'Failed to upload document');
        } finally {
            setUploadingDocId(null);
        }
    };

    /* ─── Save / Cancel ───────────────────────────────── */

    const handleSave = async () => {
        if (!projectId) return;
        const userDataRaw = localStorage.getItem('userData');
        let token = '', username = '';
        try {
            const parsed = userDataRaw ? JSON.parse(userDataRaw) : null;
            token = parsed?.token || '';
            username = parsed?.username || '';
        } catch (_) { }
        if (!token || !username) {
            toast.error('Session expired. Please log in again.');
            return;
        }
        setIsSaving(true);
        try {
            const contextJSON = serializeSectionsToJSON(sections, companyOverview, companyAddress);
            const payload = { project_id: projectId, context: contextJSON };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/bot-reply/update-context`,
                JSON.stringify({ data, key }),
                { headers: { token, username, 'Content-Type': 'application/json' } }
            );
            if (response?.data?.error) {
                const errMsg = typeof response.data.error === 'string' ? response.data.error : 'Failed to update company context';
                toast.error(errMsg);
                return;
            }
            updateStoredConfig(projectId, { companyContext: contextJSON });
            setOriginalSections(JSON.parse(JSON.stringify(sections)));
            setOriginalCompanyOverview(companyOverview);
            setOriginalCompanyAddress(companyAddress);
            setIsEditing(false);
            toast.success(response?.data?.msg ?? 'Company context updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.error ?? 'Failed to update company context. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setSections(JSON.parse(JSON.stringify(originalSections)));
        setCompanyOverview(originalCompanyOverview);
        setCompanyAddress(originalCompanyAddress);
        setIsEditing(false);
    };

    const handleStartEdit = (targetTab) => {
        setOriginalSections(JSON.parse(JSON.stringify(sections)));
        setOriginalCompanyOverview(companyOverview);
        setOriginalCompanyAddress(companyAddress);
        if (targetTab) {
            setActiveTab(targetTab);
            const count = sections.filter(s => s.type === targetTab).length;
            if (count === 0 && targetTab !== 'overview') {
                setSections(prev => [...prev, createEmptySection(targetTab)]);
            }
        }
        setIsEditing(true);
    };

    const activeSections = useMemo(() => {
        return sections.filter(s => s.type === activeTab);
    }, [sections, activeTab]);

    /* ─── Render View Section ─────────────────────────── */

    const renderViewSection = (section) => {
        const typeConf = SECTION_TYPES.find(t => t.value === section.type) || SECTION_TYPES[0];
        const colors = TYPE_COLORS[section.type] || TYPE_COLORS.qa;
        const TypeIcon = typeConf.icon;

        return (
            <div key={section.id} className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden transition-all hover:border-slate-300">
                {/* Section header */}
                <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl ${colors.bg} ${colors.text} flex-shrink-0`}>
                            <TypeIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-slate-800 truncate text-sm sm:text-base">{section.title || 'Untitled Section'}</h3>
                            <p className="text-xs text-slate-400 font-medium">{typeConf.label} &middot; {section.items?.length || 0} {section.items?.length === 1 ? 'item' : 'items'}</p>
                        </div>
                    </div>
                </div>

                {/* Section body */}
                <div className="p-5 space-y-3">
                    {section.type === 'qa' && (
                        <div className="space-y-3">
                            {section.items?.map((item, idx) => (
                                <div key={item.id || idx} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-2.5">
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200/90 px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0">Q</span>
                                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{item.question || <span className="italic text-slate-400 font-normal">No question specified</span>}</p>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <span className="text-[11px] font-bold text-sky-800 bg-sky-200/90 px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0">A</span>
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{item.answer || <span className="italic text-slate-400 font-normal">No answer specified</span>}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {section.type === 'info' && (
                        <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                            {section.items?.map((item, idx) => (
                                <div key={item.id || idx} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 px-4 py-3 bg-white hover:bg-slate-50/60 transition">
                                    <span className="text-xs sm:text-sm font-semibold text-slate-500 sm:w-44 flex-shrink-0">{item.label || <span className="italic text-slate-400 font-normal">Label</span>}</span>
                                    <span className="text-sm text-slate-800 font-medium break-words flex-1">{item.value || <span className="italic text-slate-400 font-normal">—</span>}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {section.type === 'text' && (
                        <div className="space-y-3">
                            {section.items?.map((item, idx) => (
                                <div key={item.id || idx} className="p-4 rounded-xl border border-amber-100 bg-amber-50/20">
                                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                                        {item.content || <span className="italic text-slate-400">No text content provided</span>}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    )}
                    {section.type === 'docs' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {section.items?.map((item, idx) => (
                                <div key={item.id || idx} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-purple-300 transition-all flex flex-col justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 flex-shrink-0">
                                            <FiFileText className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-semibold text-slate-800 truncate">{item.label || item.fileName || 'Unnamed Document'}</h4>
                                            {item.fileName && item.fileName !== item.label && (
                                                <p className="text-xs text-slate-500 truncate mt-0.5">{item.fileName}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-purple-700 uppercase bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                            {item.fileType || 'DOC'}
                                        </span>
                                        {item.url ? (
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                                            >
                                                Open Document <FiExternalLink className="w-3 h-3 ml-0.5" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">No file uploaded</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    /* ─── Render Edit Section ─────────────────────────── */

    const renderEditSection = (section, sectionIdx) => {
        const typeConf = SECTION_TYPES.find(t => t.value === section.type) || SECTION_TYPES[0];
        const colors = TYPE_COLORS[section.type] || TYPE_COLORS.qa;
        const TypeIcon = typeConf.icon;

        return (
            <div key={section.id} className={`rounded-2xl border ${colors.border} bg-white shadow-xs overflow-hidden transition-all mb-5`}>
                {/* Section header (edit) */}
                <div className={`px-5 py-3.5 ${colors.bg} border-b ${colors.border} flex items-center gap-3 flex-wrap sm:flex-nowrap`}>
                    <div className={`p-2 rounded-xl bg-white ${colors.text} shadow-2xs flex-shrink-0`}>
                        <TypeIcon className="w-4 h-4" />
                    </div>
                    <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSectionField(section.id, 'title', e.target.value)}
                        placeholder={`Section title (e.g. ${section.type === 'qa' ? 'FAQ, Return Policy' : section.type === 'info' ? 'Contact Details, Office Hours' : section.type === 'docs' ? 'Product Catalog' : 'Company Policies'})...`}
                        className="flex-1 min-w-[200px] bg-white border border-slate-200 rounded-xl px-3.5 py-1.5 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                    />
                    <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                        <SearchableSelect
                            value={section.type}
                            onChange={(e) => changeSectionType(section.id, e.target.value)}
                            options={SECTION_TYPES.map((t) => ({
                                value: t.value,
                                label: `${t.label}${t.value === 'docs' && !usePersonalKey ? ' (Personal Key Req.)' : ''}`,
                                disabled: t.value === 'docs' && !usePersonalKey,
                            }))}
                            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 min-w-[160px]"
                        />
                        <button
                            type="button"
                            onClick={() => toggleSectionCollapse(section.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition"
                            title={section.collapsed ? 'Expand' : 'Collapse'}
                        >
                            {section.collapsed ? <FiChevronDown className="w-4 h-4" /> : <FiChevronUp className="w-4 h-4" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => removeSection(section.id)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete section"
                        >
                            <FiTrash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Section items (collapsible) */}
                {!section.collapsed && (
                    <div className="p-5 space-y-4">
                        {section.items.map((item, itemIdx) => (
                            <div key={item.id} className="relative group">
                                {section.items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(section.id, item.id)}
                                        className="absolute -top-2.5 -right-2.5 z-10 p-1.5 rounded-full bg-white border border-slate-200 text-red-400 hover:text-red-600 hover:border-red-300 shadow-sm transition"
                                        title="Remove item"
                                    >
                                        <FiX className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                {/* Q&A item */}
                                {section.type === 'qa' && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded-full mt-2 flex-shrink-0">Q</span>
                                            <input
                                                type="text"
                                                value={item.question}
                                                onChange={(e) => updateItemField(section.id, item.id, 'question', e.target.value)}
                                                placeholder="Enter question (e.g. What are your operating hours?)..."
                                                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                                            />
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-[11px] font-bold text-sky-800 bg-sky-200 px-2 py-0.5 rounded-full mt-2 flex-shrink-0">A</span>
                                            <textarea
                                                value={item.answer}
                                                onChange={(e) => updateItemField(section.id, item.id, 'answer', e.target.value)}
                                                placeholder="Enter answer (e.g. We are open Mon-Fri from 9 AM to 6 PM EST)..."
                                                rows={2}
                                                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 resize-y"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Info item */}
                                {section.type === 'info' && (
                                    <div className="flex flex-col sm:flex-row items-start gap-3">
                                        <input
                                            type="text"
                                            value={item.label}
                                            onChange={(e) => updateItemField(section.id, item.id, 'label', e.target.value)}
                                            placeholder="Label (e.g. Support Email)"
                                            className="w-full sm:w-1/3 min-w-[150px] bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        />
                                        <input
                                            type="text"
                                            value={item.value}
                                            onChange={(e) => updateItemField(section.id, item.id, 'value', e.target.value)}
                                            placeholder="Value (e.g. support@company.com)"
                                            className="w-full sm:flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                                        />
                                    </div>
                                )}

                                {/* Text item */}
                                {section.type === 'text' && (
                                    <textarea
                                        value={item.content}
                                        onChange={(e) => updateItemField(section.id, item.id, 'content', e.target.value)}
                                        placeholder="Enter detailed context, policies, or background knowledge..."
                                        rows={4}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-y"
                                    />
                                )}

                                {/* Docs item */}
                                {section.type === 'docs' && (
                                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                                        <input
                                            type="text"
                                            value={item.label}
                                            onChange={(e) => updateItemField(section.id, item.id, 'label', e.target.value)}
                                            placeholder="Document Label (e.g. 2026 Price List, Return Policy PDF)"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                                        />
                                        {item.url ? (
                                            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                                        <FiFileText className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-700 truncate">{item.fileName || 'Uploaded Document'}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateItemField(section.id, item.id, 'url', '');
                                                        updateItemField(section.id, item.id, 'fileName', '');
                                                    }}
                                                    className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline flex-shrink-0 ml-3"
                                                >
                                                    Remove File
                                                </button>
                                            </div>
                                        ) : !usePersonalKey ? (
                                            <div className="flex items-center justify-center w-full">
                                                <div className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-200 border-dashed rounded-xl bg-slate-100/70 text-center px-4 cursor-not-allowed">
                                                    <FiLock className="w-5 h-5 mb-1 text-slate-400" />
                                                    <p className="text-xs font-semibold text-slate-600">Upload Disabled (Personal API Key Required)</p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">Please switch to your personal API key in AI Agent settings to upload documents.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center w-full">
                                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-white hover:bg-slate-50 transition-colors">
                                                    <div className="flex flex-col items-center justify-center pt-3 pb-3">
                                                        {uploadingDocId === item.id ? (
                                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                                <span className="inline-block h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                                                                Uploading document...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <FiUpload className="w-5 h-5 mb-1 text-purple-500" />
                                                                <p className="text-xs text-slate-600 font-medium"><span className="text-purple-600 font-semibold hover:underline">Click to upload</span> or drag and drop</p>
                                                                <p className="text-[10px] text-slate-400 mt-0.5">PDF, Excel, or CSV (MAX. 10MB)</p>
                                                            </>
                                                        )}
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,.xlsx,.xls,.csv"
                                                        disabled={uploadingDocId === item.id}
                                                        onChange={(e) => handleFileUpload(section.id, item.id, e.target.files[0])}
                                                    />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Add item button */}
                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => addItem(section.id, section.type)}
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${colors.text} hover:underline transition`}
                            >
                                <FiPlus className="w-3.5 h-3.5" />
                                Add {section.type === 'qa' ? 'another Q&A pair' : section.type === 'info' ? 'another field' : section.type === 'docs' ? 'another document' : 'another text block'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    /* ─── Access denied ────────────────────────────────── */

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-slate-50">
                <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
                <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                    <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-8">
                        <div className="max-w-2xl mx-auto mt-12 rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center">
                            <FiLock className="w-14 h-14 mx-auto text-slate-300 mb-4" />
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Access denied</h2>
                            <p className="text-slate-600 mb-6">Only the project admin can access project configuration.</p>
                            <button
                                type="button"
                                onClick={() => navigate('/project-config')}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                            >
                                Back to Project Config
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ─── Main render ──────────────────────────────────── */

    const currentTabConf = TABS.find(t => t.id === activeTab) || TABS[0];
    const currentColors = TYPE_COLORS[activeTab] || TYPE_COLORS.overview;
    const CurrentIcon = currentTabConf.icon;

    return (
        <div className="min-h-screen bg-slate-50/60 pb-24">
            <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full px-4 sm:px-6 md:px-8 py-8">
                    
                    {/* Header bar */}
                    <div className="mb-6">
                        <button
                            type="button"
                            onClick={() => navigate('/project-config')}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-3"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                            Back to Project Config
                        </button>
                        
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3.5">
                                <div className="p-3 bg-sky-600 text-white rounded-2xl shadow-xs">
                                    <FiShield className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-slate-900">Company Context</h1>
                                    <p className="text-sm text-slate-500">
                                        Manage structured knowledge base sections used by the AI bot for accurate responses.
                                    </p>
                                </div>
                            </div>

                            {/* Top Action Buttons */}
                            <div className="flex items-center gap-3">
                                {isEditing ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700 transition shadow-xs disabled:cursor-not-allowed disabled:bg-slate-300"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <FiCheck className="w-4 h-4" />
                                                    Save Changes
                                                </>
                                            )}
                                        </button>
                                    </>
                                ) : !isLoading && (
                                    <button
                                        type="button"
                                        onClick={() => handleStartEdit(activeTab)}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 shadow-xs"
                                    >
                                        <FiEdit2 className="w-4 h-4" />
                                        Edit Context
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Integrated Tab Navigation Card */}
                    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden mb-6">
                        <div className="flex items-center border-b border-slate-200/80 overflow-x-auto overflow-y-hidden no-scrollbar px-2 pt-1.5 bg-slate-50/50">
                            {TABS.map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                const count = tabCounts[tab.id] || 0;
                                const colors = TYPE_COLORS[tab.id];

                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`group relative flex items-center gap-2.5 px-4 sm:px-5 py-2.5 text-sm font-semibold transition-all whitespace-nowrap border-b-2 ${
                                            isActive
                                                ? `border-sky-600 text-sky-700 bg-white rounded-t-xl shadow-2xs`
                                                : `border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-t-xl`
                                        }`}
                                    >
                                        <Icon className={`w-4 h-4 transition ${isActive ? 'text-sky-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                        <span>{tab.label}</span>
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition ${
                                            isActive
                                                ? 'bg-sky-100 text-sky-700'
                                                : count > 0
                                                    ? 'bg-slate-200/80 text-slate-700'
                                                    : 'bg-slate-100 text-slate-400'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Tab Sub-Header & Controls */}
                        <div className="px-6 py-4 bg-white flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${currentColors.bg} ${currentColors.text}`}>
                                    <CurrentIcon className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-800">{currentTabConf.label}</h2>
                                    <p className="text-xs text-slate-500">{currentTabConf.description}</p>
                                </div>
                            </div>

                            {/* Quick Add Section Button if in Edit Mode */}
                            {isEditing && activeTab !== 'overview' && (
                                <button
                                    type="button"
                                    onClick={() => addSection(activeTab)}
                                    disabled={activeTab === 'docs' && !usePersonalKey}
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs ${
                                        activeTab === 'docs' && !usePersonalKey
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : `${currentColors.bg} ${currentColors.text} hover:opacity-90`
                                    }`}
                                >
                                    <FiPlus className="w-3.5 h-3.5" />
                                    Add {currentTabConf.label} Section
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Loading State */}
                    {isLoading ? (
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-16 flex flex-col items-center justify-center">
                            <span className="inline-block h-7 w-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
                            <span className="text-sm font-medium text-slate-600">Loading context configurations...</span>
                        </div>
                    ) : (
                        /* ─── TAB CONTENT PANELS ─── */
                        <div className="space-y-5">
                            {/* TAB 1: Company Info */}
                            {activeTab === 'overview' && (
                                <div>
                                    {isEditing ? (
                                        <div className="space-y-5">
                                            {/* Company Overview Input */}
                                            <div className="rounded-2xl border border-sky-200 bg-white shadow-xs overflow-hidden">
                                                <div className="px-5 py-3.5 bg-gradient-to-r from-sky-50 to-white border-b border-sky-100 flex items-center gap-3">
                                                    <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                                                        <FiShield className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-800 text-sm">Company Overview</h3>
                                                        <p className="text-xs text-slate-500">Brief summary of your company, mission, or key offerings</p>
                                                    </div>
                                                </div>
                                                <div className="p-5">
                                                    <textarea
                                                        value={companyOverview}
                                                        onChange={(e) => setCompanyOverview(e.target.value)}
                                                        placeholder="e.g. We are a leading company providing automated customer support and AI chat solutions..."
                                                        rows={4}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400 resize-y"
                                                    />
                                                </div>
                                            </div>

                                            {/* Company Address Input */}
                                            <div className="rounded-2xl border border-sky-200 bg-white shadow-xs overflow-hidden">
                                                <div className="px-5 py-3.5 bg-gradient-to-r from-sky-50 to-white border-b border-sky-100 flex items-center gap-3">
                                                    <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                                                        <FiInfo className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-slate-800 text-sm">Company Address</h3>
                                                        <p className="text-xs text-slate-500">Physical office or headquarters location</p>
                                                    </div>
                                                </div>
                                                <div className="p-5">
                                                    <input
                                                        type="text"
                                                        value={companyAddress}
                                                        onChange={(e) => setCompanyAddress(e.target.value)}
                                                        placeholder="e.g. 123 Main Street, Suite 400, San Francisco, CA 94105"
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            {companyOverview || companyAddress ? (
                                                <>
                                                    {companyOverview && (
                                                        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                                                            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-3">
                                                                <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                                                                    <FiShield className="w-4 h-4" />
                                                                </div>
                                                                <h3 className="font-semibold text-slate-800 text-sm">Company Overview</h3>
                                                            </div>
                                                            <div className="p-5">
                                                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{companyOverview}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {companyAddress && (
                                                        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
                                                            <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center gap-3">
                                                                <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                                                                    <FiInfo className="w-4 h-4" />
                                                                </div>
                                                                <h3 className="font-semibold text-slate-800 text-sm">Company Address</h3>
                                                            </div>
                                                            <div className="p-5">
                                                                <p className="text-sm text-slate-700 leading-relaxed">{companyAddress}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                                                    <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-500 mx-auto flex items-center justify-center mb-3">
                                                        <FiShield className="w-6 h-6" />
                                                    </div>
                                                    <h3 className="text-base font-semibold text-slate-800">No Company Information Set</h3>
                                                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                                                        Provide your company overview and address so the bot can introduce your business accurately to visitors.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEdit('overview')}
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold hover:bg-sky-700 transition shadow-xs"
                                                    >
                                                        <FiPlus className="w-3.5 h-3.5" />
                                                        Add Company Info
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2, 3, 4, 5: Dynamic Section Types (qa, info, text, docs) */}
                            {activeTab !== 'overview' && (
                                <div className="space-y-5">
                                    {/* Consolidated Document alerts */}
                                    {activeTab === 'docs' && (
                                        <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-r from-purple-50/70 via-white to-amber-50/40 p-5 shadow-xs space-y-3">
                                            <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 rounded-xl bg-purple-100 text-purple-700 flex-shrink-0 mt-0.5">
                                                        <FiUpload className="w-5 h-5" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <h4 className="text-sm font-bold text-slate-800">Document-Based Knowledge Retrieval</h4>
                                                            {!usePersonalKey ? (
                                                                <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <FiLock className="w-3 h-3" /> Personal Key Required
                                                                </span>
                                                            ) : (
                                                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                    <FiCheck className="w-3 h-3" /> Personal Key Active
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-600 leading-relaxed">
                                                            Uploaded files (PDF, Excel, CSV) are parsed into the AI context for rich answers.
                                                            <span className="text-amber-800 font-medium"> Note: Large documents consume more tokens on your personal API key.</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                {!usePersonalKey && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate('/agent-config')}
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition shadow-xs whitespace-nowrap flex-shrink-0 self-start"
                                                    >
                                                        <FiKey className="w-3.5 h-3.5" />
                                                        Configure Personal Key &rarr;
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Active sections list */}
                                    {activeSections.length > 0 ? (
                                        <div className="space-y-4">
                                            {isEditing ? (
                                                <>
                                                    {activeSections.map((section, idx) => renderEditSection(section, idx))}

                                                    <button
                                                        type="button"
                                                        onClick={() => addSection(activeTab)}
                                                        disabled={activeTab === 'docs' && !usePersonalKey}
                                                        className={`w-full py-3.5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-semibold transition ${
                                                            activeTab === 'docs' && !usePersonalKey
                                                                ? 'border-slate-200 bg-slate-100/60 text-slate-400 cursor-not-allowed'
                                                                : `${currentColors.border} ${currentColors.bg} ${currentColors.text} hover:opacity-90`
                                                        }`}
                                                    >
                                                        <FiPlus className="w-4 h-4" />
                                                        Add Another {currentTabConf.label} Section
                                                    </button>
                                                </>
                                            ) : (
                                                activeSections.map(renderViewSection)
                                            )}
                                        </div>
                                    ) : (
                                        /* Clean, polished Empty state */
                                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                                            <div className={`w-12 h-12 rounded-2xl ${currentColors.bg} ${currentColors.text} mx-auto flex items-center justify-center mb-3`}>
                                                <CurrentIcon className="w-6 h-6" />
                                            </div>
                                            <h3 className="text-base font-semibold text-slate-800">No {currentTabConf.label} Sections Added</h3>
                                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                                                {currentTabConf.description}
                                            </p>

                                            {activeTab === 'docs' && !usePersonalKey ? (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/agent-config')}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition shadow-xs"
                                                >
                                                    <FiKey className="w-3.5 h-3.5" />
                                                    Enable Personal API Key to Add Documents
                                                </button>
                                            ) : isEditing ? (
                                                <button
                                                    type="button"
                                                    onClick={() => addSection(activeTab)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition shadow-xs"
                                                >
                                                    <FiPlus className="w-3.5 h-3.5" />
                                                    Create {currentTabConf.label} Section
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartEdit(activeTab)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition shadow-xs"
                                                >
                                                    <FiPlus className="w-3.5 h-3.5" />
                                                    Add {currentTabConf.label}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Floating / Sticky Save Bar when Editing */}
                            {isEditing && (
                                <div className="sticky bottom-6 mt-10 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-md text-white shadow-xl border border-slate-800 flex items-center justify-between gap-4 flex-wrap z-20">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                                        <span className="text-xs sm:text-sm font-medium text-slate-200">
                                            Editing Mode &middot; Remember to save all changes
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleCancel}
                                            disabled={isSaving}
                                            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                                        >
                                            Discard Changes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-xs sm:text-sm font-semibold text-white transition shadow-md disabled:bg-slate-600"
                                        >
                                            {isSaving ? 'Saving Changes...' : 'Save Context'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ContextConfig;
