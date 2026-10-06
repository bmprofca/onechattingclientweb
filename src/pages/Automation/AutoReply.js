import React, { useState, useEffect } from 'react';
import { Header, Sidebar } from '../../component/Menu';
import SearchableSelect from '../../component/SearchableSelect';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiPlus,
    FiEdit,
    FiTrash2,
    FiPower,
    FiSearch,
    FiClock,
    FiMessageSquare,
    FiKey,
    FiCheckCircle,
    FiXCircle,
    FiEye,
    FiFilter,
    FiRefreshCw,
    FiX,
    FiSave,
    FiCalendar,
    FiBarChart2,
    FiZap,
    FiSettings,
    FiLayers
} from 'react-icons/fi';
import moment from 'moment';

const AutoReply = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });
    const [autoReplyEnabled, setAutoReplyEnabled] = useState(() => {
        const saved = localStorage.getItem('autoReplyEnabled');
        return saved ? JSON.parse(saved) : false;
    });
    const [rules, setRules] = useState(() => {
        const saved = localStorage.getItem('autoReplyRules');
        return saved ? JSON.parse(saved) : [];
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [formData, setFormData] = useState({
        name: '',
        keywords: '',
        response: '',
        matchType: 'contains', // contains, exact, startsWith, endsWith
        enabled: true,
        businessHours: false,
        startTime: '09:00',
        endTime: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        priority: 1,
        multiSteps: [] // additional automated follow-up messages
    });

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        localStorage.setItem('autoReplyEnabled', JSON.stringify(autoReplyEnabled));
    }, [autoReplyEnabled]);

    useEffect(() => {
        localStorage.setItem('autoReplyRules', JSON.stringify(rules));
    }, [rules]);

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [mobileMenuOpen]);

    const handleToggleAutoReply = () => {
        setAutoReplyEnabled(!autoReplyEnabled);
    };

    const handleCreateRule = () => {
        setEditingRule(null);
        setFormData({
            name: '',
            keywords: '',
            response: '',
            matchType: 'contains',
            enabled: true,
            businessHours: false,
            startTime: '09:00',
            endTime: '17:00',
            daysOfWeek: [1, 2, 3, 4, 5],
            priority: rules.length + 1,
            multiSteps: []
        });
        setShowCreateModal(true);
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            keywords: rule.keywords.join(', '),
            response: rule.response,
            matchType: rule.matchType,
            enabled: rule.enabled,
            businessHours: rule.businessHours || false,
            startTime: rule.startTime || '09:00',
            endTime: rule.endTime || '17:00',
            daysOfWeek: rule.daysOfWeek || [1, 2, 3, 4, 5],
            priority: rule.priority,
            multiSteps: rule.multiSteps || []
        });
        setShowCreateModal(true);
    };

    // Multi-level (follow-up) steps helpers
    const handleAddMultiStep = () => {
        setFormData((prev) => ({
            ...prev,
            multiSteps: [
                ...prev.multiSteps,
                {
                    id: Date.now().toString() + '-' + prev.multiSteps.length,
                    label: `Step ${prev.multiSteps.length + 1}`,
                    delaySeconds: 30,
                    message: ''
                }
            ]
        }));
    };

    const handleUpdateMultiStep = (index, field, value) => {
        setFormData((prev) => {
            const updated = [...prev.multiSteps];
            updated[index] = {
                ...updated[index],
                [field]: field === 'delaySeconds' ? (parseInt(value, 10) || 0) : value
            };
            return { ...prev, multiSteps: updated };
        });
    };

    const handleRemoveMultiStep = (index) => {
        setFormData((prev) => ({
            ...prev,
            multiSteps: prev.multiSteps.filter((_, i) => i !== index)
        }));
    };

    const handleDeleteRule = (ruleId) => {
        if (window.confirm('Are you sure you want to delete this auto-reply rule?')) {
            setRules(rules.filter(rule => rule.id !== ruleId));
        }
    };

    const handleToggleRule = (ruleId) => {
        setRules(rules.map(rule =>
            rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
        ));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const keywordsArray = formData.keywords.split(',').map(k => k.trim()).filter(k => k);

        if (keywordsArray.length === 0) {
            alert('Please enter at least one keyword');
            return;
        }

        if (!formData.response.trim()) {
            alert('Please enter a response message');
            return;
        }

        const ruleData = {
            id: editingRule ? editingRule.id : Date.now().toString(),
            name: formData.name || `Rule ${rules.length + 1}`,
            keywords: keywordsArray,
            response: formData.response,
            matchType: formData.matchType,
            enabled: formData.enabled,
            businessHours: formData.businessHours,
            startTime: formData.businessHours ? formData.startTime : null,
            endTime: formData.businessHours ? formData.endTime : null,
            daysOfWeek: formData.businessHours ? formData.daysOfWeek : null,
            priority: formData.priority,
            multiSteps: (formData.multiSteps || []).map((step, idx) => ({
                id: step.id || `${Date.now().toString()}-${idx}`,
                label: step.label || `Step ${idx + 1}`,
                delaySeconds: typeof step.delaySeconds === 'number'
                    ? step.delaySeconds
                    : parseInt(step.delaySeconds, 10) || 0,
                message: step.message || ''
            })),
            createdAt: editingRule ? editingRule.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: editingRule ? editingRule.stats : {
                triggered: 0,
                lastTriggered: null
            }
        };

        if (editingRule) {
            setRules(rules.map(rule => rule.id === editingRule.id ? ruleData : rule));
        } else {
            setRules([...rules, ruleData]);
        }

        setShowCreateModal(false);
        setEditingRule(null);
    };

    const handleDayToggle = (day) => {
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(day)
                ? prev.daysOfWeek.filter(d => d !== day)
                : [...prev.daysOfWeek, day].sort()
        }));
    };

    const filteredRules = rules.filter(rule => {
        const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            rule.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase())) ||
            rule.response.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'enabled' && rule.enabled) ||
            (filterStatus === 'disabled' && !rule.enabled);
        return matchesSearch && matchesStatus;
    });

    // Sort rules by priority
    const sortedRules = [...filteredRules].sort((a, b) => a.priority - b.priority);

    const stats = {
        total: rules.length,
        enabled: rules.filter(r => r.enabled).length,
        disabled: rules.filter(r => !r.enabled).length,
        totalTriggered: rules.reduce((sum, r) => sum + (r.stats?.triggered || 0), 0)
    };

    const daysOfWeek = [
        { value: 0, label: 'Sun' },
        { value: 1, label: 'Mon' },
        { value: 2, label: 'Tue' },
        { value: 3, label: 'Wed' },
        { value: 4, label: 'Thu' },
        { value: 5, label: 'Fri' },
        { value: 6, label: 'Sat' }
    ];

    return (
        <div className="min-h-screen bg-[#f4f6fb] dark:bg-gray-900">
            <Header
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />
            <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full px-4 py-5">
                    {/* Page Header */}
                    <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Auto Reply</h1>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Automate responses to incoming WhatsApp messages
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleToggleAutoReply}
                                    className={`inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium transition-colors ${autoReplyEnabled
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    {autoReplyEnabled ? (
                                        <>
                                            <FiPower className="mr-2" size={18} />
                                            Enabled
                                        </>
                                    ) : (
                                        <>
                                            <FiBarChart2 className="mr-2" size={18} />
                                            Disabled
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleCreateRule}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                >
                                    <FiPlus className="mr-2" size={18} />
                                    Create Rule
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Rules</div>
                                    <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                                </div>
                                <div className="p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                                    <FiZap className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Rules</div>
                                    <div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">{stats.enabled}</div>
                                </div>
                                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                                    <FiCheckCircle className="w-6 h-6 text-green-600 dark:text-green-300" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Inactive Rules</div>
                                    <div className="mt-2 text-2xl font-bold text-gray-600 dark:text-gray-400">{stats.disabled}</div>
                                </div>
                                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                    <FiXCircle className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Triggered</div>
                                    <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalTriggered}</div>
                                </div>
                                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                    <FiBarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filter Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <FiSearch className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Search rules by name, keywords, or response..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    />
                                </div>
                            </div>
                            <div className="sm:w-48">
                                <SearchableSelect
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    options={[
                                        { value: 'all', label: 'All Status' },
                                        { value: 'enabled', label: 'Enabled' },
                                        { value: 'disabled', label: 'Disabled' },
                                    ]}
                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rules List */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        {sortedRules.length === 0 ? (
                            <div className="p-12 text-center">
                                <FiMessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No auto-reply rules</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    {searchTerm || filterStatus !== 'all'
                                        ? 'No rules match your search criteria.'
                                        : 'Create your first auto-reply rule to get started.'}
                                </p>
                                {!searchTerm && filterStatus === 'all' && (
                                    <button
                                        onClick={handleCreateRule}
                                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        <FiPlus className="mr-2" />
                                        Create Rule
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sortedRules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                                        {rule.name}
                                                    </h3>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rule.enabled
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                                        }`}>
                                                        {rule.enabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                                        Priority: {rule.priority}
                                                    </span>
                                                </div>

                                                <div className="mt-3 space-y-2">
                                                    <div className="flex items-start">
                                                        <FiKey className="mt-1 mr-2 text-gray-400 flex-shrink-0" size={16} />
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Keywords:</span>
                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                {rule.keywords.map((keyword, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                                                    >
                                                                        {keyword}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <span className="text-xs text-gray-400 ml-2">({rule.matchType})</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start">
                                                        <FiMessageSquare className="mt-1 mr-2 text-gray-400 flex-shrink-0" size={16} />
                                                        <div className="flex-1">
                                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Response:</span>
                                                            <p className="mt-1 text-sm text-gray-900 dark:text-white">{rule.response}</p>
                                                        </div>
                                                    </div>

                                                    {Array.isArray(rule.multiSteps) && rule.multiSteps.length > 0 && (
                                                        <div className="flex items-start">
                                                            <FiLayers className="mt-1 mr-2 text-gray-400 flex-shrink-0" size={16} />
                                                            <div>
                                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                                    Multi-level follow-ups:
                                                                </span>
                                                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                                                    {rule.multiSteps.length} step{rule.multiSteps.length > 1 ? 's' : ''} configured
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {rule.businessHours && (
                                                        <div className="flex items-start">
                                                            <FiClock className="mt-1 mr-2 text-gray-400 flex-shrink-0" size={16} />
                                                            <div>
                                                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Business Hours:</span>
                                                                <p className="mt-1 text-sm text-gray-900 dark:text-white">
                                                                    {rule.startTime} - {rule.endTime} ({rule.daysOfWeek.map(d => daysOfWeek[d].label).join(', ')})
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-3">
                                                        <span>Triggered: {rule.stats?.triggered || 0} times</span>
                                                        {rule.stats?.lastTriggered && (
                                                            <span>Last: {moment(rule.stats.lastTriggered).fromNow()}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2 ml-4">
                                                <button
                                                    onClick={() => handleToggleRule(rule.id)}
                                                    className={`p-2 rounded-md transition-colors ${rule.enabled
                                                            ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900'
                                                            : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                        }`}
                                                    title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                                >
                                                    {rule.enabled ? <FiPower size={18} /> : <FiBarChart2 size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => handleEditRule(rule)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-md transition-colors"
                                                    title="Edit rule"
                                                >
                                                    <FiEdit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRule(rule.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-md transition-colors"
                                                    title="Delete rule"
                                                >
                                                    <FiTrash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create/Edit Rule Modal */}
            <AnimatePresence>
                {showCreateModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4"
                        onClick={() => setShowCreateModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full my-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <FiZap className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {editingRule ? 'Edit Auto-Reply Rule' : 'Create Auto-Reply Rule'}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none transition-colors"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSubmit} className="p-6">
                                <div className="space-y-6">
                                    {/* Rule Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Rule Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g., Greeting Response"
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Keywords */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Keywords <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.keywords}
                                            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                                            placeholder="Enter keywords separated by commas (e.g., hello, hi, hey)"
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            required
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Separate multiple keywords with commas
                                        </p>
                                    </div>

                                    {/* Match Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Match Type
                                        </label>
                                        <SearchableSelect
                                            value={formData.matchType}
                                            onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
                                            options={[
                                                { value: 'contains', label: 'Contains' },
                                                { value: 'exact', label: 'Exact Match' },
                                                { value: 'startsWith', label: 'Starts With' },
                                                { value: 'endsWith', label: 'Ends With' },
                                            ]}
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    {/* Response Message */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Response Message <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            value={formData.response}
                                            onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                                            rows={4}
                                            placeholder="Enter the auto-reply message..."
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            required
                                        />
                                    </div>

                                    {/* Multi-level (Follow-up) Responses */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Multi-level follow-up messages
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleAddMultiStep}
                                                className="inline-flex items-center px-2.5 py-1.5 border border-indigo-600 text-xs font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-indigo-300"
                                            >
                                                <FiPlus className="mr-1" size={14} />
                                                Add step
                                            </button>
                                        </div>
                                        {(!formData.multiSteps || formData.multiSteps.length === 0) && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Optionally send additional automated messages after the first response
                                                (e.g., follow-ups after a delay). This is your simple multi-level auto-reply.
                                            </p>
                                        )}
                                        {Array.isArray(formData.multiSteps) && formData.multiSteps.length > 0 && (
                                            <div className="space-y-4">
                                                {formData.multiSteps.map((step, index) => (
                                                    <div
                                                        key={step.id || index}
                                                        className="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-800/60"
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center space-x-2">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                                                    Step {index + 1}
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    value={step.label || ''}
                                                                    onChange={(e) => handleUpdateMultiStep(index, 'label', e.target.value)}
                                                                    placeholder="Short label (optional)"
                                                                    className="block w-40 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMultiStep(index)}
                                                                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                                            <div className="sm:col-span-2">
                                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                    Delay (seconds)
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={step.delaySeconds}
                                                                    onChange={(e) => handleUpdateMultiStep(index, 'delaySeconds', e.target.value)}
                                                                    className="block w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                />
                                                                <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                                                    How long after the previous reply this message should be sent.
                                                                </p>
                                                            </div>
                                                            <div className="sm:col-span-3">
                                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                    Follow-up message
                                                                </label>
                                                                <textarea
                                                                    rows={2}
                                                                    value={step.message}
                                                                    onChange={(e) => handleUpdateMultiStep(index, 'message', e.target.value)}
                                                                    placeholder="Enter the follow-up message..."
                                                                    className="block w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Priority
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Lower numbers have higher priority (1 = highest)
                                        </p>
                                    </div>

                                    {/* Business Hours Toggle */}
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="businessHours"
                                            checked={formData.businessHours}
                                            onChange={(e) => setFormData({ ...formData, businessHours: e.target.checked })}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="businessHours" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                            Enable Business Hours
                                        </label>
                                    </div>

                                    {/* Business Hours Settings */}
                                    {formData.businessHours && (
                                        <div className="pl-6 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        Start Time
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={formData.startTime}
                                                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                        End Time
                                                    </label>
                                                    <input
                                                        type="time"
                                                        value={formData.endTime}
                                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Days of Week
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {daysOfWeek.map((day) => (
                                                        <button
                                                            key={day.value}
                                                            type="button"
                                                            onClick={() => handleDayToggle(day.value)}
                                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${formData.daysOfWeek.includes(day.value)
                                                                    ? 'bg-indigo-600 text-white'
                                                                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                                                }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Enabled Toggle */}
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="enabled"
                                            checked={formData.enabled}
                                            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                            Enable this rule
                                        </label>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="mt-6 flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        <FiSave className="mr-2" size={16} />
                                        {editingRule ? 'Update Rule' : 'Create Rule'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AutoReply;
