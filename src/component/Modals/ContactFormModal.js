import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../../config/api';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Encrypt } from '../../pages/encryption/payload-encryption';
import SearchableSelect from '../SearchableSelect';
import {
    FiX,
    FiEdit2,
    FiCheck,
    FiPhone,
    FiUser,
    FiMail,
    FiHome,
    FiGlobe,
    FiFileText,
    FiCheckCircle,
    FiAlertCircle,
    FiUsers,
    FiPlus,
    FiTrash2
} from 'react-icons/fi';

// Country options for phone number input
const DEFAULT_COUNTRY = { iso2: 'IN', name: 'India', dialCode: '91' };
const COUNTRY_OPTIONS = [
    DEFAULT_COUNTRY,
    { iso2: 'US', name: 'United States', dialCode: '1' },
    { iso2: 'CA', name: 'Canada', dialCode: '1' },
    { iso2: 'GB', name: 'United Kingdom', dialCode: '44' },
    { iso2: 'AE', name: 'United Arab Emirates', dialCode: '971' },
    { iso2: 'SA', name: 'Saudi Arabia', dialCode: '966' },
    { iso2: 'SG', name: 'Singapore', dialCode: '65' },
    { iso2: 'AU', name: 'Australia', dialCode: '61' },
    { iso2: 'BD', name: 'Bangladesh', dialCode: '880' },
    { iso2: 'NP', name: 'Nepal', dialCode: '977' },
    { iso2: 'PK', name: 'Pakistan', dialCode: '92' }
];

// Validation functions
const validateLocalPhoneNumber10 = (phone) => {
    const cleaned = String(phone || '').replace(/\D/g, '');
    if (!cleaned) return 'Mobile number is required';
    if (!/^\d{10}$/.test(cleaned)) return 'Please enter a valid 10-digit mobile number';
    return '';
};

const validateName = (name) => {
    if (!name || name.trim() === '') {
        return 'Name is required';
    }
    if (name.trim().length < 2) {
        return 'Name must be at least 2 characters long';
    }
    if (name.trim().length > 100) {
        return 'Name must be less than 100 characters';
    }
    return '';
};

const validateEmail = (email) => {
    if (!email || email.trim() === '') {
        return '';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return 'Please enter a valid email address';
    }
    return '';
};

const validateWebsite = (website) => {
    if (!website || website.trim() === '') {
        return '';
    }
    const websiteRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;
    if (!websiteRegex.test(website.trim())) {
        return 'Please enter a valid website URL';
    }
    return '';
};

const validateRemark = (remark) => {
    if (remark && remark.length > 1000) {
        return 'Remark must be less than 1000 characters';
    }
    return '';
};

const getStoredTokens = () => {
    try {
        const sessionData = localStorage.getItem('userData');
        if (sessionData) {
            return JSON.parse(sessionData);
        }
    } catch (e) {
        console.error('Failed to parse userData:', e);
    }
    return null;
};

/**
 * ContactFormModal - Reusable modal for creating/updating contacts with 2-Tab Group Management
 */
const ContactFormModal = ({
    isOpen,
    onClose,
    onSubmit,
    initialData = {},
    isExisting = false,
    loading = false,
    submitting = false,
    error = '',
    darkMode = false,
    groups = []
}) => {
    const [activeTab, setActiveTab] = useState('details'); // 'details' | 'groups'
    const [country, setCountry] = useState(DEFAULT_COUNTRY);
    const [formData, setFormData] = useState({
        number: '',
        name: '',
        email: '',
        firm_name: '',
        website: '',
        remark: '',
        group_id: ''
    });
    const [errors, setErrors] = useState({
        number: '',
        name: '',
        email: '',
        website: '',
        remark: ''
    });
    const [originalNumber, setOriginalNumber] = useState('');
    const [numberChanged, setNumberChanged] = useState(false);

    // Assigned groups management state
    const [assignedGroups, setAssignedGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [selectedAddGroupId, setSelectedAddGroupId] = useState('');
    const [addingGroupLoading, setAddingGroupLoading] = useState(false);
    const [removingGroupId, setRemovingGroupId] = useState(null);

    // Fetch assigned groups for this contact
    const fetchContactGroups = async (contactId) => {
        if (!contactId) return;
        const tokens = getStoredTokens();
        if (!tokens?.token || !tokens?.username) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';
        if (!projectId) return;

        setLoadingGroups(true);
        try {
            const payload = { project_id: projectId, contact_id: contactId };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/contact/contact-groups-by-contact`,
                JSON.stringify({ data, key }),
                { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } }
            );
            if (response?.data?.data && Array.isArray(response.data.data)) {
                setAssignedGroups(response.data.data);
            }
        } catch (e) {
            console.error('Failed to load contact groups:', e);
        } finally {
            setLoadingGroups(false);
        }
    };

    // Extract local 10-digit number from full number if editing
    useEffect(() => {
        setActiveTab('details');
        setSelectedAddGroupId('');

        if (initialData.number || initialData.mobile) {
            const rawNum = String(initialData.number || initialData.mobile || '');
            const fullNumber = rawNum.replace(/\D/g, '');
            let localNumber = rawNum;
            let foundCountry = DEFAULT_COUNTRY;

            for (const c of COUNTRY_OPTIONS) {
                const dialCode = String(c.dialCode).replace(/\D/g, '');
                if (fullNumber.startsWith(dialCode)) {
                    localNumber = fullNumber.substring(dialCode.length);
                    foundCountry = c;
                    break;
                }
            }

            setCountry(foundCountry);
            setOriginalNumber(localNumber);
            setNumberChanged(false);
            setFormData({
                number: localNumber,
                name: initialData.name || '',
                email: initialData.email || '',
                firm_name: initialData.firm_name || '',
                website: initialData.website || '',
                remark: initialData.remark || '',
                group_id: initialData.group_id || ''
            });

            // Populate initial groups from contact data if present
            const initGroups = [];
            if (Array.isArray(initialData.groups)) {
                initialData.groups.forEach((g) => {
                    initGroups.push(typeof g === 'object' ? g : { id: g, group_id: g, name: `Group ${g}` });
                });
            }
            setAssignedGroups(initGroups);

            // Fetch live assigned groups from API
            const contactId = initialData.contact_id || initialData.id;
            if (isExisting && contactId) {
                fetchContactGroups(contactId);
            }
        } else {
            // Reset for new contact
            setCountry(DEFAULT_COUNTRY);
            setOriginalNumber('');
            setNumberChanged(false);
            setFormData({
                number: '',
                name: initialData.name || '',
                email: initialData.email || '',
                firm_name: initialData.firm_name || '',
                website: initialData.website || '',
                remark: initialData.remark || '',
                group_id: initialData.group_id || ''
            });
            setAssignedGroups([]);
        }

        setErrors({
            number: '',
            name: '',
            email: '',
            website: '',
            remark: ''
        });
    }, [initialData, isOpen, isExisting]);

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
        if (field === 'number' && isExisting && originalNumber) {
            setNumberChanged(value !== originalNumber);
        }
    };

    const handleFieldBlur = (field) => {
        let error = '';
        switch (field) {
            case 'number':
                error = validateLocalPhoneNumber10(formData.number);
                break;
            case 'name':
                error = validateName(formData.name);
                break;
            case 'email':
                error = validateEmail(formData.email);
                break;
            case 'website':
                error = validateWebsite(formData.website);
                break;
            case 'remark':
                error = validateRemark(formData.remark);
                break;
            default:
                break;
        }
        setErrors(prev => ({ ...prev, [field]: error }));
    };

    const validateForm = () => {
        const newErrors = {
            number: validateLocalPhoneNumber10(formData.number),
            name: validateName(formData.name),
            email: validateEmail(formData.email),
            website: validateWebsite(formData.website),
            remark: validateRemark(formData.remark)
        };
        setErrors(newErrors);
        return !Object.values(newErrors).some(error => error !== '');
    };

    const handleSubmit = () => {
        if (!validateForm()) {
            return;
        }

        const localNumber10 = String(formData.number || '').replace(/\D/g, '').slice(0, 10);
        const fullNumber = `${String(country?.dialCode || '91').replace(/\D/g, '')}${localNumber10}`;

        onSubmit({
            ...formData,
            number: fullNumber
        }, fullNumber, country);
    };

    // Add contact to selected group directly without calling update-contact
    const handleAddGroupToContact = async () => {
        if (!selectedAddGroupId) {
            toast.error('Please select a group');
            return;
        }
        const contactId = initialData.contact_id || initialData.id;
        const tokens = getStoredTokens();
        if (!tokens?.token || !tokens?.username || !contactId) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';

        setAddingGroupLoading(true);
        try {
            const payload = {
                project_id: projectId,
                group_id: selectedAddGroupId,
                contact_id: contactId
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/contact/group-contact-add`,
                JSON.stringify({ data, key }),
                { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } }
            );

            if (response?.data?.error === false || !response?.data?.error) {
                const targetG = groups.find(g => String(g.id || g.group_id) === String(selectedAddGroupId));
                const newGroupObj = {
                    id: selectedAddGroupId,
                    group_id: selectedAddGroupId,
                    name: targetG ? targetG.name : 'Group',
                    remark: targetG ? targetG.remark : ''
                };
                setAssignedGroups(prev => [...prev, newGroupObj]);
                setSelectedAddGroupId('');
                toast.success(response?.data?.msg || 'Assigned to group successfully');
            } else {
                toast.error(response?.data?.error || response?.data?.msg || 'Failed to assign group');
            }
        } catch (e) {
            console.error('Failed to assign group:', e);
            toast.error('Failed to assign group');
        } finally {
            setAddingGroupLoading(false);
        }
    };

    // Remove contact from group directly without calling update-contact
    const handleRemoveGroupFromContact = async (group) => {
        const gid = String(group.group_id || group.id);
        const contactId = initialData.contact_id || initialData.id;
        const tokens = getStoredTokens();
        if (!tokens?.token || !tokens?.username || !contactId || !gid) return;
        const projectId = tokens.selected_project_id || tokens.projects?.[0]?.project_id || '';

        setRemovingGroupId(gid);
        try {
            const payload = {
                project_id: projectId,
                group_id: gid,
                contact_ids: [contactId],
                unique_ids: group.unique_id ? [group.unique_id] : [],
                all_contact_delete: false
            };
            const { data, key } = Encrypt(payload);
            const response = await axios.post(
                `${API_BASE_URL}/contact/group-contact-delete`,
                JSON.stringify({ data, key }),
                { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } }
            );

            if (response?.data?.error === false || !response?.data?.error) {
                setAssignedGroups(prev => prev.filter(g => String(g.group_id || g.id) !== gid));
                toast.success(`Removed from ${group.name || 'group'}`);
            } else {
                toast.error(response?.data?.error || response?.data?.msg || 'Failed to remove from group');
            }
        } catch (e) {
            console.error('Failed to remove from group:', e);
            toast.error('Failed to remove from group');
        } finally {
            setRemovingGroupId(null);
        }
    };

    // Filter unassigned groups for the dropdown in Tab 2
    const assignedGroupIds = new Set(assignedGroups.map(g => String(g.group_id || g.id)));
    const unassignedGroups = groups.filter(g => !assignedGroupIds.has(String(g.id || g.group_id)));

    if (!isOpen) return null;

    const isFormValid = formData.name.trim() && formData.number.length === 10 &&
        !Object.values(errors).some(error => error !== '');

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${darkMode ? 'bg-black bg-opacity-40' : 'bg-gray-600 bg-opacity-50'
                        }`}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.25 }}
                        className={`flex h-[85vh] max-h-[90vh] w-full max-w-lg flex-col rounded-2xl shadow-xl overflow-hidden ${darkMode
                                ? 'bg-gray-800'
                                : 'bg-white'
                            }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`flex items-center justify-between border-b px-3 py-3 sm:px-5 sm:py-4 flex-shrink-0 ${darkMode
                                ? 'border-gray-700'
                                : 'border-gray-200'
                            }`}>
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${darkMode
                                        ? 'bg-blue-900/40'
                                        : 'bg-blue-100'
                                    }`}>
                                    <FiEdit2 className={`h-4 w-4 ${darkMode ? 'text-blue-300' : 'text-blue-600'
                                        }`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className={`text-sm sm:text-base font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'
                                        }`}>
                                        {isExisting ? 'Edit Contact' : 'Create New Contact'}
                                    </h3>
                                    {isExisting && initialData.name && (
                                        <p className="text-xs text-gray-500 truncate">
                                            {initialData.name} ({initialData.mobile || initialData.number || ''})
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                disabled={submitting}
                                className={`rounded-full p-1 transition-colors flex-shrink-0 ml-2 ${darkMode
                                        ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                                    } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                aria-label="Close contact modal"
                            >
                                <FiX className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Two Tabs when isExisting === true */}
                        {isExisting && (
                            <div className={`flex border-b px-4 bg-gray-50/70 ${darkMode ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200'}`}>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('details')}
                                    className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                                        activeTab === 'details'
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <FiUser className="h-4 w-4" />
                                    Profile Details
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('groups')}
                                    className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                                        activeTab === 'groups'
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <FiUsers className="h-4 w-4" />
                                    Manage Groups
                                    <span className={`ml-1.5 px-2 py-0.5 text-xs rounded-full font-semibold ${
                                        activeTab === 'groups'
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}>
                                        {assignedGroups.length}
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Form Body */}
                        <div className="flex-1 overflow-y-auto">
                            {/* TAB 1: PROFILE DETAILS */}
                            {activeTab === 'details' && (
                                <div className="space-y-4 px-3 py-4 sm:px-5">
                                    {error && (
                                        <div className={`rounded-lg border px-3 py-2 text-sm ${darkMode
                                                ? 'border-red-500/30 bg-red-900/30 text-red-200'
                                                : 'border-red-200 bg-red-50 text-red-600'
                                            }`}>
                                            {error}
                                        </div>
                                    )}

                                    {loading && (
                                        <div className={`flex items-center space-x-2 rounded-lg border px-3 py-2 text-sm ${darkMode
                                                ? 'border-blue-500/30 bg-blue-900/30 text-blue-200'
                                                : 'border-blue-100 bg-blue-50 text-blue-600'
                                            }`}>
                                            <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-r-transparent border-blue-400`} />
                                            <span>Loading contact details…</span>
                                        </div>
                                    )}

                                    {/* Mobile Number Field */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            <FiPhone className="inline h-4 w-4 mr-1" />
                                            Mobile Number *
                                        </label>
                                        <div className="flex gap-2">
                                            <SearchableSelect
                                                value={country.iso2}
                                                onChange={(e) => {
                                                    const next = COUNTRY_OPTIONS.find((c) => c.iso2 === e.target.value) || DEFAULT_COUNTRY;
                                                    setCountry(next);
                                                    if (formData.number) {
                                                        handleFieldBlur('number');
                                                    }
                                                    if (isExisting && originalNumber && formData.number) {
                                                        setNumberChanged(true);
                                                    }
                                                }}
                                                disabled={loading || submitting}
                                                options={COUNTRY_OPTIONS.map((c) => ({ value: c.iso2, label: `${c.name} (${c.dialCode})` }))}
                                                className={`w-5/12 px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${darkMode
                                                        ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                        : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                    }`}
                                            />

                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                maxLength={10}
                                                value={formData.number}
                                                onChange={(e) => {
                                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                    handleFieldChange('number', digits);
                                                }}
                                                onBlur={() => handleFieldBlur('number')}
                                                disabled={loading || submitting}
                                                className={`w-8/12 px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${errors.number
                                                        ? 'border-red-500 focus:ring-red-500'
                                                        : darkMode
                                                            ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                            : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                    } ${(loading || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                placeholder="Enter 10-digit number"
                                                required
                                            />
                                        </div>

                                        {!errors.number && /^\d{10}$/.test(formData.number) && !numberChanged && (
                                            <p className={`mt-1 text-sm inline-flex items-center ${darkMode ? 'text-green-400' : 'text-green-600'
                                                }`}>
                                                <FiCheckCircle className="h-4 w-4 mr-1" />
                                                Valid number (will be saved as {String(country?.dialCode || '91').replace(/\D/g, '')}
                                                {formData.number})
                                            </p>
                                        )}
                                        {numberChanged && !errors.number && /^\d{10}$/.test(formData.number) && (
                                            <p className={`mt-1 text-sm inline-flex items-center ${darkMode ? 'text-yellow-400' : 'text-yellow-600'
                                                }`}>
                                                <FiAlertCircle className="h-4 w-4 mr-1" />
                                                Changing the number will not retrieve previous chats.
                                            </p>
                                        )}
                                        {errors.number && (
                                            <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                                {errors.number}
                                            </p>
                                        )}
                                    </div>

                                    {/* Name Field */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            <FiUser className="inline h-4 w-4 mr-1" />
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => handleFieldChange('name', e.target.value)}
                                            onBlur={() => handleFieldBlur('name')}
                                            disabled={loading || submitting}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${errors.name
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : darkMode
                                                        ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                        : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                } ${(loading || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder="Enter full name"
                                            required
                                        />
                                        {errors.name && (
                                            <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                                {errors.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Group selection for NEW contacts only */}
                                    {!isExisting && (
                                        <div>
                                            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                                <FiUsers className="inline h-4 w-4 mr-1" />
                                                Assign to Group <span className="text-xs font-normal text-gray-400">(optional)</span>
                                            </label>
                                            <SearchableSelect
                                                value={formData.group_id}
                                                onChange={(e) => handleFieldChange('group_id', e.target.value)}
                                                disabled={loading || submitting}
                                                options={[{ value: '', label: 'No group' }, ...groups.map((group) => ({ value: group.id, label: group.name }))]}
                                                placeholder="No group"
                                                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${darkMode
                                                    ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                    : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                    }`}
                                            />
                                        </div>
                                    )}

                                    {/* Email Field */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            <FiMail className="inline h-4 w-4 mr-1" />
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleFieldChange('email', e.target.value)}
                                            onBlur={() => handleFieldBlur('email')}
                                            disabled={loading || submitting}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${errors.email
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : darkMode
                                                        ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                        : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                } ${(loading || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder="Enter email address"
                                        />
                                        {errors.email && (
                                            <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>

                                    {/* Company Field */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            <FiHome className="inline h-4 w-4 mr-1" />
                                            Company / Firm
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.firm_name}
                                            onChange={(e) => handleFieldChange('firm_name', e.target.value)}
                                            disabled={loading || submitting}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${darkMode
                                                    ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                    : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                } ${(loading || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder="Enter company name"
                                        />
                                    </div>

                                    {/* Website Field */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            <FiGlobe className="inline h-4 w-4 mr-1" />
                                            Website
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.website}
                                            onChange={(e) => handleFieldChange('website', e.target.value)}
                                            onBlur={() => handleFieldBlur('website')}
                                            disabled={loading || submitting}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${errors.website
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : darkMode
                                                        ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                        : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                } ${(loading || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder="Enter website URL (e.g., example.com)"
                                        />
                                        {errors.website && (
                                            <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                                {errors.website}
                                            </p>
                                        )}
                                    </div>

                                    {/* Remark Field */}
                                    <div>
                                        <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                                            }`}>
                                            <FiFileText className="inline h-4 w-4 mr-1" />
                                            Remark
                                        </label>
                                        <textarea
                                            value={formData.remark}
                                            onChange={(e) => handleFieldChange('remark', e.target.value)}
                                            onBlur={() => handleFieldBlur('remark')}
                                            disabled={loading || submitting}
                                            rows={3}
                                            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition focus:ring-2 ${errors.remark
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : darkMode
                                                        ? 'border-gray-600 bg-gray-900 text-white focus:border-blue-400 focus:ring-blue-800'
                                                        : 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200'
                                                } ${(loading || submitting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            placeholder="Enter any remarks"
                                        />
                                        {errors.remark && (
                                            <p className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                                                {errors.remark}
                                            </p>
                                        )}
                                        <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                                            {formData.remark.length}/1000 characters
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: MANAGE GROUPS */}
                            {activeTab === 'groups' && isExisting && (
                                <div className="space-y-5 px-3 py-4 sm:px-5">
                                    {/* Assign to Group Section */}
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                                            Assign New Group
                                        </label>
                                        <div className="flex gap-2">
                                            <SearchableSelect
                                                value={selectedAddGroupId}
                                                onChange={(e) => setSelectedAddGroupId(e.target.value)}
                                                disabled={addingGroupLoading}
                                                options={[
                                                    { value: '', label: 'Choose an unassigned group...' },
                                                    ...unassignedGroups.map((g) => ({
                                                        value: g.id || g.group_id,
                                                        label: `${g.name}${g.remark ? ` (${g.remark})` : ''}`,
                                                    })),
                                                ]}
                                                placeholder="Choose an unassigned group..."
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddGroupToContact}
                                                disabled={!selectedAddGroupId || addingGroupLoading}
                                                className={`inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium transition ${
                                                    !selectedAddGroupId || addingGroupLoading
                                                        ? 'opacity-50 cursor-not-allowed'
                                                        : 'hover:bg-indigo-700'
                                                }`}
                                            >
                                                {addingGroupLoading ? (
                                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                                                ) : (
                                                    <>
                                                        <FiPlus className="h-4 w-4" />
                                                        <span>Assign</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        {unassignedGroups.length === 0 && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                All available groups in this project are already assigned to this contact.
                                            </p>
                                        )}
                                    </div>

                                    {/* Assigned Groups List */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                Currently Assigned Groups ({assignedGroups.length})
                                            </h4>
                                            {loadingGroups && (
                                                <span className="inline-flex items-center text-xs text-indigo-600">
                                                    <span className="animate-spin h-3 w-3 border-2 border-indigo-600 border-r-transparent rounded-full mr-1" />
                                                    Syncing...
                                                </span>
                                            )}
                                        </div>

                                        {assignedGroups.length > 0 ? (
                                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                {assignedGroups.map((grp) => {
                                                    const gid = String(grp.group_id || grp.id);
                                                    const isRemoving = removingGroupId === gid;

                                                    return (
                                                        <div
                                                            key={gid}
                                                            className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors shadow-sm"
                                                        >
                                                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                                <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                                                    <FiUsers className="h-4 w-4" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                                        {grp.name || `Group ${gid}`}
                                                                    </p>
                                                                    {grp.remark ? (
                                                                        <p className="text-xs text-gray-500 truncate">
                                                                            {grp.remark}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveGroupFromContact(grp)}
                                                                disabled={isRemoving}
                                                                title="Remove contact from this group"
                                                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-2"
                                                            >
                                                                {isRemoving ? (
                                                                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-r-transparent" />
                                                                ) : (
                                                                    <FiTrash2 className="h-4 w-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50">
                                                <FiUsers className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                                <p className="text-sm font-medium text-gray-700">No Groups Assigned</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Select a group above to link this contact.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer (Only for Profile Details tab or New Contact) */}
                        {activeTab === 'details' && (
                            <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t px-3 py-3 sm:px-5 sm:py-4 flex-shrink-0 ${darkMode
                                    ? 'border-gray-700 bg-gray-900/60'
                                    : 'border-gray-200 bg-gray-50'
                                }`}>
                                <div className={`text-xs text-center sm:text-left ${darkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || submitting || !isFormValid}
                                    className={`inline-flex items-center justify-center space-x-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition w-full sm:w-auto ${loading || submitting || !isFormValid
                                            ? darkMode
                                                ? 'cursor-not-allowed bg-blue-700'
                                                : 'cursor-not-allowed bg-blue-300'
                                            : darkMode
                                                ? 'bg-blue-500 hover:bg-blue-600'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                >
                                    {submitting ? (
                                        <span className="flex items-center space-x-2">
                                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                                            <span>Saving…</span>
                                        </span>
                                    ) : (
                                        <>
                                            <FiCheck className="h-4 w-4" />
                                            <span>{isExisting ? 'Save Profile Details' : 'Save Contact'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                        {activeTab === 'groups' && isExisting && (
                            <div className="flex justify-end border-t px-4 py-3 bg-gray-50">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ContactFormModal;
export { DEFAULT_COUNTRY, COUNTRY_OPTIONS };
