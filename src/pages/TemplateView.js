import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    FiArrowLeft,
    FiPaperclip
} from 'react-icons/fi';
import WhatsAppPreview from '../component/TemplateAdd/WhatsAppPreview';

function TemplateView() {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tokens, setTokens] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        language: '',
        components: {
            header: {
                type: 'HEADER',
                format: 'NONE',
                text: '',
                example: { header_handle: [] }
            },
            body: {
                type: 'BODY',
                text: '',
                example: { body_text: [] }
            },
            footer: {
                type: 'FOOTER',
                text: ''
            },
            buttons: {
                type: 'BUTTONS',
                buttons: []
            }
        }
    });
    const [bodyVariables, setBodyVariables] = useState([]);
    const [headerVariable, setHeaderVariable] = useState(null);
    const [authConfig, setAuthConfig] = useState(null);

    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    // Get user tokens from localStorage
    useEffect(() => {
        const userData = localStorage.getItem('userData');
        if (userData) {
            const parsedData = JSON.parse(userData);
            setTokens(parsedData);
        }
    }, []);

    // Language options
    const languages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'ru', name: 'Russian' },
        { code: 'ar', name: 'Arabic' },
        { code: 'hi', name: 'Hindi' },
        { code: 'zh', name: 'Chinese' }
    ];

    // Categories
    const categories = [
        { code: 'MARKETING', name: 'Marketing' },
        { code: 'UTILITY', name: 'Utility' },
        { code: 'AUTHENTICATION', name: 'Authentication' },
    ];

    // Header formats
    const headerFormats = [
        { code: 'NONE', name: 'None' },
        { code: 'TEXT', name: 'Text' },
        { code: 'IMAGE', name: 'Image' },
        { code: 'VIDEO', name: 'Video' },
        { code: 'DOCUMENT', name: 'Document' }
    ];

    // Fetch template data for viewing
    useEffect(() => {
        const fetchTemplate = async () => {
            if (!tokens?.token || !templateId) return;

            setLoading(true);
            try {
                // First try to get template data from localStorage (from Template.js)
                const templatesData = localStorage.getItem('templatesData');
                let templateFound = false;

                if (templatesData) {
                    const templates = JSON.parse(templatesData);
                    const template = templates.find(t => t.id === templateId);

                    if (template && template.template_data) {
                        console.log('Found template in localStorage:', template);
                        populateFormFromTemplate(template);
                        templateFound = true;
                    }
                }

                // If not found in localStorage, try to fetch from API
                if (!templateFound) {
                    console.log('Template not found in localStorage, fetching from API...');

                    try {
                        // Use the same API structure as Template.js for consistency
                        const { Encrypt } = await import('./encryption/payload-encryption');

                        const payload = {
                            project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
                            template_id: templateId
                        };

                        const { data, key } = Encrypt(payload);
                        const data_pass = JSON.stringify({ data, key });

                        const response = await axios.post(
                            `${API_BASE_URL}/template/template-details`,
                            data_pass,
                            {
                                headers: {
                                    'token': tokens.token,
                                    'username': tokens.username,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        if (!response?.data?.error) {
                            const templateData = response.data.data || {};
                            const templateObj = response.data.template || templateData.template || {};

                            const template = {
                                id: templateData.template_id,
                                name: templateData.template_name || templateObj.name || '',
                                language: templateObj.language || templateData.template?.language || 'en',
                                category: templateData.category || templateObj.category || '',
                                status: templateData.status,
                                template_data: templateObj
                            };

                            console.log('Fetched template from API:', template);
                            populateFormFromTemplate(template);
                            templateFound = true;
                        }
                    } catch (apiError) {
                        console.error('API fetch failed:', apiError);
                    }
                }

                // If still not found, show error and redirect
                if (!templateFound) {
                    console.error('Template not found:', templateId);
                    alert('Template not found. Redirecting to template list.');
                    navigate('/template');
                    return;
                }

            } catch (error) {
                console.error('Failed to fetch template:', error);
                alert('Failed to load template data');
                navigate('/template');
            } finally {
                setLoading(false);
            }
        };

        if (tokens) {
            fetchTemplate();
        }
    }, [tokens, templateId, navigate]);

    // Populate form from template data
    const populateFormFromTemplate = (template) => {
        console.log('Populating form with template:', template);
        const components = template.template_data?.components || [];

        // Initialize form data
        const newFormData = {
            name: template.name || '',
            category: template.category || '',
            language: template.language || 'en',
            components: {
                header: {
                    type: 'HEADER',
                    format: 'NONE',
                    text: '',
                    example: { header_handle: [] }
                },
                body: {
                    type: 'BODY',
                    text: '',
                    example: { body_text: [] }
                },
                footer: {
                    type: 'FOOTER',
                    text: ''
                },
                buttons: {
                    type: 'BUTTONS',
                    buttons: []
                }
            }
        };

        const newBodyVariables = [];
        let newHeaderVariable = null;

        // Process each component
        components.forEach(component => {
            switch (component.type) {
                case 'HEADER':
                    newFormData.components.header = {
                        type: 'HEADER',
                        format: component.format || 'TEXT',
                        text: component.text || '',
                        example: component.example || { header_handle: [] }
                    };

                    // Extract header variable if exists
                    if (component.text && component.text.includes('{{1}}')) {
                        newHeaderVariable = {
                            id: Date.now(),
                            name: 'var1',
                            sample: component.example?.header_text?.[0] || ''
                        };
                    }
                    break;

                case 'BODY':
                    newFormData.components.body = {
                        type: 'BODY',
                        text: component.text || '',
                        example: component.example || { body_text: [] }
                    };

                    if (component.text) {
                        const variableMatches = component.text.match(/\{\{(\d+)\}\}/g);
                        if (variableMatches) {
                            const uniqueNums = [...new Set(variableMatches.map((m) => parseInt(m.replace(/\D/g, ''), 10)))].sort((a, b) => a - b);
                            const samples = component.example?.body_text?.[0] || [];
                            uniqueNums.forEach((varNum, index) => {
                                newBodyVariables.push({
                                    id: Date.now() + index,
                                    name: `var${varNum}`,
                                    sample: samples[index] || ''
                                });
                            });
                        }
                    }
                    break;

                case 'FOOTER':
                    newFormData.components.footer = {
                        type: 'FOOTER',
                        text: component.text || ''
                    };
                    break;

                case 'BUTTONS':
                    newFormData.components.buttons = {
                        type: 'BUTTONS',
                        buttons: component.buttons?.map(btn => {
                            if (btn.type === 'OTP' || (btn.type === 'otp' && btn.otp_type)) {
                                return {
                                    type: 'COPY_CODE',
                                    text: btn.text || '',
                                };
                            }
                            if (btn.type === 'otp' && btn.otp_type === 'copy_code') {
                                return {
                                    type: 'COPY_CODE',
                                    text: btn.text || '',
                                    copy_code: btn.copy_code || ''
                                };
                            }
                            // Handle URL button - map to internal format
                            if (btn.type === 'URL') {
                                return {
                                    type: 'URL',
                                    text: btn.text || '',
                                    url: btn.url || '',
                                    example: btn.example || []
                                };
                            }
                            // Handle PHONE_NUMBER button
                            if (btn.type === 'PHONE_NUMBER') {
                                return {
                                    type: 'PHONE_NUMBER',
                                    text: btn.text || '',
                                    phone_number: btn.phone_number || ''
                                };
                            }
                            // Handle QUICK_REPLY button
                            if (btn.type === 'QUICK_REPLY') {
                                return {
                                    type: 'QUICK_REPLY',
                                    text: btn.text || ''
                                };
                            }
                            // Default: return as is
                            return btn;
                        }) || []
                    };
                    break;

                default:
                    break;
            }
        });

        setFormData(newFormData);
        setBodyVariables(newBodyVariables);
        setHeaderVariable(newHeaderVariable);

        if (newFormData.category === 'AUTHENTICATION') {
            const bodyComp = components.find((c) => c.type === 'BODY');
            const footerComp = components.find((c) => c.type === 'FOOTER');
            const otpBtn = components
                .find((c) => c.type === 'BUTTONS')
                ?.buttons?.find((b) => b.type === 'OTP' || b.type === 'otp' || b.otp_type);

            setAuthConfig({
                addSecurityRecommendation: Boolean(bodyComp?.add_security_recommendation),
                includeCodeExpiration: footerComp?.code_expiration_minutes != null,
                codeExpirationMinutes: footerComp?.code_expiration_minutes || 10,
                otpType: String(otpBtn?.otp_type || 'COPY_CODE').toUpperCase(),
                otpButtonText: otpBtn?.text || 'Copy code',
            });
        } else {
            setAuthConfig(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f4f6fb]">
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
                <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
                    }`}>
                    <div className="w-full px-4 py-5">
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <span className="ml-3 text-lg text-gray-600">Loading template...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f6fb]">
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
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'
                }`}>
                <div className="w-full px-4 py-5">
                    {/* Page header */}
                    <div className="mb-6">
                        <div className="flex items-center mb-4">
                            <button
                                onClick={() => navigate('/template')}
                                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                            >
                                <FiArrowLeft size={20} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">View WhatsApp Template</h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    View your WhatsApp message template - Template ID: {templateId}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* View section */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <div className="space-y-6">
                                {/* Template Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Template Name
                                    </label>
                                    <p className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                                        {formData.name}
                                    </p>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <p className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                                        {categories.find(c => c.code === formData.category)?.name || formData.category}
                                    </p>
                                </div>

                                {/* Language */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Language
                                    </label>
                                    <p className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                                        {languages.find(l => l.code === formData.language)?.name || formData.language}
                                    </p>
                                </div>

                                {/* Header Format */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Header Format
                                    </label>
                                    <p className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                                        {headerFormats.find(f => f.code === formData.components.header.format)?.name || formData.components.header.format}
                                    </p>
                                </div>

                                {/* Header Content */}
                                {formData.components.header.format !== 'NONE' && (
                                    <div className="p-4 bg-gray-50 rounded-md border border-gray-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Header Content
                                        </label>

                                        {formData.components.header.format === 'TEXT' ? (
                                            <div>
                                                <p className="text-gray-900 mb-2">{formData.components.header.text}</p>
                                                {headerVariable && (
                                                    <div className="text-sm text-gray-600">
                                                        <span className="font-medium">Variable sample:</span> {headerVariable.sample}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center">
                                                <FiPaperclip className="text-gray-500 mr-2" />
                                                <span className="text-sm truncate">
                                                    {formData.components.header.example.header_handle && formData.components.header.example.header_handle[0]
                                                        ? formData.components.header.example.header_handle[0].split('/').pop()
                                                        : 'No media attached'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Body Content */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {formData.category === 'AUTHENTICATION' ? 'Verification Message' : 'Body Content'}
                                    </label>
                                    {formData.components.body.text ? (
                                        <div className="p-4 bg-gray-50 rounded-md border border-gray-200 whitespace-pre-wrap">
                                            {formData.components.body.text}
                                        </div>
                                    ) : formData.category === 'AUTHENTICATION' ? (
                                        <div className="p-4 bg-indigo-50 rounded-md border border-indigo-200 text-sm text-indigo-800">
                                            Legacy Meta default OTP format
                                            {authConfig?.addSecurityRecommendation && ' (with security recommendation)'}
                                            {authConfig?.includeCodeExpiration && ` · expires in ${authConfig.codeExpirationMinutes} min`}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No body content</p>
                                    )}

                                    {/* Body Variables */}
                                    {bodyVariables.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Variables
                                            </label>
                                            {bodyVariables.map(variable => (
                                                <div key={variable.id} className="text-sm flex gap-2">
                                                    <span className="font-medium text-gray-700">{`{{${variable.name.replace('var', '')}}}`}:</span>
                                                    <span className="text-gray-600">{variable.sample}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                {formData.components.footer.text && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Footer Text
                                        </label>
                                        <p className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                                            {formData.components.footer.text}
                                        </p>
                                    </div>
                                )}

                                {/* Buttons */}
                                {formData.components.buttons.buttons.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Buttons
                                        </label>
                                        <div className="space-y-2">
                                            {formData.components.buttons.buttons.map((btn, index) => (
                                                <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-semibold text-gray-500 uppercase">
                                                            {btn.type.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-900 font-medium">{btn.text}</p>
                                                    {btn.type === 'PHONE_NUMBER' && (
                                                        <p className="text-sm text-gray-600 mt-1">Phone: {btn.phone_number}</p>
                                                    )}
                                                    {btn.type === 'URL' && (
                                                        <div className="mt-1">
                                                            <p className="text-sm text-gray-600">URL: {btn.url}</p>
                                                            {btn.example && btn.example.length > 0 && (
                                                                <p className="text-xs text-gray-500 mt-1">Example: {btn.example[0]}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {btn.type === 'COPY_CODE' && (
                                                        <p className="text-sm text-gray-600 mt-1">Code: {btn.copy_code}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/*WhatsApp Preview section */}
                        <div className="lg:col-span-1">
                            <div className="lg:sticky lg:top-24 lg:self-start">
                                <div className="bg-white shadow rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                            Preview
                                        </span>
                                    </div>
                                    <WhatsAppPreview
                                        formData={formData}
                                        bodyVariables={bodyVariables}
                                        authConfig={authConfig}
                                        darkMode={false}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TemplateView;
