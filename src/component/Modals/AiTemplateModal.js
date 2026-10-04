import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import { Encrypt } from '../../pages/encryption/payload-encryption';
import { uploadFile } from '../../utils/uploadFile';
import axios from 'axios';
import SearchableSelect from '../SearchableSelect';
import toast from 'react-hot-toast';
import {
  FiX,
  FiZap,
  FiCheck,
  FiRefreshCw,
  FiSliders,
  FiMessageSquare,
  FiInfo,
  FiLayers,
  FiCheckCircle,
  FiUploadCloud,
  FiTrash2,
  FiImage,
  FiAlertTriangle,
  FiKey,
  FiCreditCard
} from 'react-icons/fi';
import { RiSparklingFill } from 'react-icons/ri';
import { Link } from 'react-router-dom';

const QUICK_PROMPTS = [
  {
    label: '⚡ 50% Flash Sale',
    prompt: 'Create an exciting limited-time 50% discount announcement for a weekend fashion sale with coupon code and countdown.',
    category: 'MARKETING',
    tone: 'exciting and promotional',
    button_type: 'QUICK_REPLY'
  },
  {
    label: '📦 Order Shipping Update',
    prompt: 'Create an order shipped notification with customer name, order ID, courier name, tracking number, and tracking link button.',
    category: 'UTILITY',
    tone: 'informative and polite',
    button_type: 'URL'
  },
  {
    label: '💳 Payment Reminder',
    prompt: 'Polite reminder about pending invoice payment with customer name, invoice ID, due date, and pay now link button.',
    category: 'UTILITY',
    tone: 'polite and professional',
    button_type: 'URL'
  },
  {
    label: '🎉 Welcome Offer',
    prompt: 'Warm welcome message for new signups offering a 20% first purchase discount code and a link to browse the catalog.',
    category: 'MARKETING',
    tone: 'friendly and welcoming',
    button_type: 'URL'
  },
  {
    label: '📅 Service Appointment',
    prompt: 'Confirm booking/appointment with customer name, service name, date, time, and quick reply buttons to Confirm or Reschedule.',
    category: 'UTILITY',
    tone: 'clear and reassuring',
    button_type: 'QUICK_REPLY'
  }
];

export default function AiTemplateModal({
  isOpen,
  onClose,
  onApplyTemplate,
  onSavedDirectly,
  projectId,
  tokens
}) {
  const [prompt, setPrompt] = useState('');
  const [headerPrompt, setHeaderPrompt] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en');
  const [tone, setTone] = useState('friendly and persuasive');
  const [headerType, setHeaderType] = useState('NONE');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [buttonType, setButtonType] = useState('QUICK_REPLY');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [savingDirectly, setSavingDirectly] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);

  // AI & Wallet status
  const [aiStatus, setAiStatus] = useState({
    loading: true,
    is_eligible: true,
    is_personal_key: false,
    balance: 0,
    source: 'none',
  });

  const selectedProjectId = projectId || tokens?.selected_project_id || tokens?.projects?.[0]?.project_id;

  useEffect(() => {
    if (!isOpen || !selectedProjectId) return;

    let isMounted = true;
    const fetchAiStatus = async () => {
      try {
        const { data, key } = Encrypt({ project_id: selectedProjectId });
        const res = await axios.post(
          `${API_BASE_URL}/template/get-ai-status`,
          JSON.stringify({ data, key }),
          {
            headers: {
              token: tokens?.token,
              username: tokens?.username,
              'Content-Type': 'application/json'
            }
          }
        );

        if (isMounted && res.data?.data) {
          setAiStatus({
            loading: false,
            is_eligible: res.data.data.is_eligible,
            is_personal_key: res.data.data.is_personal_key,
            balance: res.data.data.balance,
            source: res.data.data.source,
          });
        }
      } catch (e) {
        if (isMounted) {
          setAiStatus((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    fetchAiStatus();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedProjectId, tokens]);

  if (!isOpen) return null;

  const handleSelectQuickPrompt = (item) => {
    setPrompt(item.prompt);
    if (item.category) setCategory(item.category);
    if (item.tone) setTone(item.tone);
    if (item.button_type) setButtonType(item.button_type);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, WebP)');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const { link, url } = await uploadFile(file);
      const uploadedUrl = link || url;
      setReferenceImageUrl(uploadedUrl);
      toast.success('Logo / Reference image uploaded successfully');
    } catch (err) {
      console.error('Logo upload error:', err);
      toast.error(err.message || 'Failed to upload logo/reference image');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();

    if (!aiStatus.is_eligible && !aiStatus.is_personal_key) {
      toast.error('AI generation requires a wallet balance > ₹100 or your own Personal API Key.');
      return;
    }

    if (!prompt.trim()) {
      toast.error('Please enter a description or use-case for the template');
      return;
    }

    if (!selectedProjectId) {
      toast.error('Project ID not found. Please select a project first.');
      return;
    }

    setLoading(true);
    setGeneratedData(null);

    try {
      const payload = {
        project_id: selectedProjectId,
        prompt: prompt.trim(),
        header_prompt: headerType !== 'NONE' ? headerPrompt.trim() : '',
        reference_image_url: headerType === 'IMAGE' ? referenceImageUrl : '',
        category,
        language,
        tone,
        header_type: headerType,
        button_type: buttonType,
        custom_instructions: customInstructions.trim()
      };

      const { data, key } = Encrypt(payload);
      const res = await axios.post(
        `${API_BASE_URL}/template/generate-ai-template`,
        JSON.stringify({ data, key }),
        {
          headers: {
            token: tokens?.token,
            username: tokens?.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (res.data?.error) {
        toast.error(res.data.error || 'Failed to generate template');
      } else if (res.data?.data?.template) {
        let result = res.data.data;
        const generatedHeader = result.template.components?.find(c => String(c.type).toUpperCase() === 'HEADER');
        if (generatedHeader && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(generatedHeader.format).toUpperCase())) {
          try {
            const mediaPayload = {
              project_id: selectedProjectId,
              format: String(generatedHeader.format).toUpperCase(),
              prompt: prompt.trim(),
              header_prompt: headerType !== 'NONE' ? headerPrompt.trim() : '',
              reference_image_url: headerType === 'IMAGE' ? referenceImageUrl : '',
              body: result.template.components?.find(c => String(c.type).toUpperCase() === 'BODY')?.text || '',
              header_text: generatedHeader.text || ''
            };
            const mediaRes = await axios.post(`${API_BASE_URL}/template/generate-ai-header-media`, JSON.stringify(Encrypt(mediaPayload)), {
              headers: { token: tokens?.token, username: tokens?.username, 'Content-Type': 'application/json' }
            });
            if (mediaRes.data?.data?.url) {
              result = { ...result, template: { ...result.template, components: result.template.components.map(component => String(component.type).toUpperCase() === 'HEADER' ? { ...component, example: { header_handle: [mediaRes.data.data.url] } } : component) } };
            } else if (mediaRes.data?.error) toast.error(mediaRes.data.error);
          } catch (mediaError) {
            toast.error(mediaError.response?.data?.error || 'Header format created, but media generation failed');
          }
        }
        setGeneratedData(result);
        toast.success('WhatsApp Template generated with AI!');
      } else {
        toast.error('Unexpected response from AI generator');
      }
    } catch (err) {
      console.error('AI Gen Error:', err);
      toast.error(err.response?.data?.error || err.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedData) return;
    if (onApplyTemplate) {
      onApplyTemplate(generatedData);
    }
    toast.success('Template applied to editor');
    onClose();
  };

  const handleSaveDirectly = async () => {
    if (!generatedData?.template) return;
    setSavingDirectly(true);

    try {
      const payload = {
        project_id: selectedProjectId,
        template: generatedData.template
      };

      const { data, key } = Encrypt(payload);
      const res = await axios.post(
        `${API_BASE_URL}/template/create-template`,
        JSON.stringify({ data, key }),
        {
          headers: {
            token: tokens?.token,
            username: tokens?.username,
            'Content-Type': 'application/json'
          }
        }
      );

      if (res.data?.error) {
        toast.error(res.data.error || 'Failed to save template to WhatsApp');
      } else {
        toast.success('Template submitted and saved successfully!');
        if (onSavedDirectly) {
          onSavedDirectly(res.data);
        }
        onClose();
      }
    } catch (err) {
      console.error('Direct Save Error:', err);
      toast.error(err.response?.data?.error || err.message || 'Failed to save template');
    } finally {
      setSavingDirectly(false);
    }
  };

  const bodyComp = generatedData?.template?.components?.find(c => String(c.type).toUpperCase() === 'BODY');
  const headerComp = generatedData?.template?.components?.find(c => String(c.type).toUpperCase() === 'HEADER');
  const footerComp = generatedData?.template?.components?.find(c => String(c.type).toUpperCase() === 'FOOTER');
  const buttonsComp = generatedData?.template?.components?.find(c => String(c.type).toUpperCase() === 'BUTTONS');

  const isBlocked = !aiStatus.loading && !aiStatus.is_eligible && !aiStatus.is_personal_key;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-indigo-100 max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-5 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center text-amber-300 shadow-inner">
              <RiSparklingFill className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                AI WhatsApp Template Generator
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-indigo-100 uppercase tracking-wider">
                  AI Powered
                </span>
              </h2>
              <p className="text-xs text-indigo-100/90 mt-0.5">
                Describe your message and AI will build a WhatsApp Cloud API compliant template instantly.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Caution Alert Banner if Low Balance & using Platform Key */}
          {isBlocked && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Low Wallet Balance (₹{Number(aiStatus.balance).toFixed(2)})
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    AI generation with OneChat Platform Key requires a minimum balance of <strong>₹100</strong>. Alternatively, you can use your own Personal AI API Key with zero balance minimum.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to="/recharge"
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FiCreditCard className="w-3.5 h-3.5" />
                  <span>Recharge</span>
                </Link>
                <Link
                  to="/project-setting"
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <FiKey className="w-3.5 h-3.5" />
                  <span>Add Personal Key</span>
                </Link>
              </div>
            </div>
          )}

          {/* Quick Prompts */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block flex items-center gap-1.5">
              <FiZap className="text-amber-500" /> Quick Starters / Examples
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectQuickPrompt(item)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 font-medium transition-all hover:scale-[1.02] active:scale-95 text-left cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Form */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-800 mb-1 flex items-center justify-between">
                <span>Describe your message / purpose *</span>
                <span className="text-xs text-gray-400 font-normal">Be specific for best results</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Send a 30% weekend discount alert to loyalty customers with code WEEKEND30, valid till Sunday, and add a link to shop now..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm text-gray-800 placeholder-gray-400 shadow-sm transition-all"
              />
            </div>

            {/* Basic Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Category</label>
                <SearchableSelect
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={[
                    { value: 'MARKETING', label: 'Marketing (Promotions, Offers)' },
                    { value: 'UTILITY', label: 'Utility (Updates, Orders, Alerts)' },
                    { value: 'AUTHENTICATION', label: 'Authentication (OTP, Verification)' },
                  ]}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Language</label>
                <SearchableSelect
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  options={[
                    { value: 'en', label: 'English (en)' },
                    { value: 'hi', label: 'Hindi (hi)' },
                    { value: 'es', label: 'Spanish (es)' },
                    { value: 'pt_BR', label: 'Portuguese (pt_BR)' },
                    { value: 'ar', label: 'Arabic (ar)' },
                    { value: 'fr', label: 'French (fr)' },
                    { value: 'de', label: 'German (de)' },
                    { value: 'it', label: 'Italian (it)' },
                  ]}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Tone / Style</label>
                <SearchableSelect
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  options={[
                    { value: 'friendly and persuasive', label: 'Friendly & Persuasive' },
                    { value: 'exciting and promotional', label: 'Exciting & Urgent' },
                    { value: 'polite and professional', label: 'Polite & Professional' },
                    { value: 'concise and direct', label: 'Concise & Direct' },
                  ]}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
                />
              </div>
            </div>

            {/* Toggle Advanced */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <FiSliders className="w-3.5 h-3.5" />
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options (Header, Logo / Reference Image, Buttons)'}
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Header Type</label>
                    <SearchableSelect
                      value={headerType}
                      onChange={(e) => {
                        setHeaderType(e.target.value);
                        if (e.target.value !== 'IMAGE') {
                          setReferenceImageUrl('');
                        }
                      }}
                      options={[
                        { value: 'NONE', label: 'None' },
                        { value: 'TEXT', label: 'Text Header' },
                        { value: 'IMAGE', label: 'Image Header' },
                        { value: 'VIDEO', label: 'Video Header' },
                        { value: 'DOCUMENT', label: 'Document Header' },
                      ]}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-800 focus:border-indigo-500 outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Buttons Preference</label>
                    <SearchableSelect
                      value={buttonType}
                      onChange={(e) => setButtonType(e.target.value)}
                      options={[
                        { value: 'NONE', label: 'None' },
                        { value: 'QUICK_REPLY', label: 'Quick Reply Buttons' },
                        { value: 'URL', label: 'Call to Action (Website URL)' },
                        { value: 'PHONE_NUMBER', label: 'Call Phone Number' },
                      ]}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-800 focus:border-indigo-500 outline-none shadow-sm"
                    />
                  </div>

                  {/* Separate Header Prompt: Visible when headerType !== 'NONE' */}
                  {headerType !== 'NONE' && (
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700 mb-1 block flex items-center justify-between">
                        <span>Header Visual / Text Prompt (Separate from Description)</span>
                        <span className="text-[11px] text-gray-400 font-normal">Specifies header graphics or title</span>
                      </label>
                      <input
                        type="text"
                        value={headerPrompt}
                        onChange={(e) => setHeaderPrompt(e.target.value)}
                        placeholder={headerType === 'IMAGE' ? 'e.g. Modern minimalist banner with luxury gold theme...' : 'e.g. Special Weekend Announcement'}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 focus:border-indigo-500 outline-none shadow-sm"
                      />
                    </div>
                  )}

                  {/* Logo / Reference Image Upload: ONLY enabled when headerType === 'IMAGE' */}
                  {headerType === 'IMAGE' && (
                    <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-indigo-100 shadow-sm space-y-2">
                      <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <FiImage className="text-indigo-600" />
                        <span>Upload Logo or Reference Image (Optional for Header Visual)</span>
                      </label>
                      <p className="text-[11px] text-gray-500">
                        Upload your brand logo or sample visual to guide the AI in generating the header image.
                      </p>

                      {referenceImageUrl ? (
                        <div className="flex items-center gap-3 p-2 bg-indigo-50/50 rounded-lg border border-indigo-200">
                          <img
                            src={referenceImageUrl}
                            alt="Reference logo"
                            className="w-16 h-12 object-contain bg-white rounded-md border border-gray-200 p-1"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">Logo / Reference Attached</p>
                            <p className="text-[10px] text-gray-500 truncate">{referenceImageUrl}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReferenceImageUrl('')}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove reference image"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-indigo-200 rounded-lg bg-indigo-50/30 hover:bg-indigo-50/70 transition-all ${isUploadingLogo ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                          {isUploadingLogo ? (
                            <>
                              <FiRefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
                              <span className="text-xs font-medium text-indigo-700">Uploading logo / image...</span>
                            </>
                          ) : (
                            <>
                              <FiUploadCloud className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-medium text-indigo-700">Click to upload logo / reference image (PNG, JPG, WebP)</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploadingLogo}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Additional Custom Instructions (optional)</label>
                    <input
                      type="text"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="E.g., include an opt-out line in footer, use 2 variables only..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 focus:border-indigo-500 outline-none shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Generate Action Button */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">
                {isBlocked && (
                  <span className="text-amber-600 font-semibold flex items-center gap-1">
                    <FiAlertTriangle className="w-3.5 h-3.5" /> Minimum ₹100 wallet balance or personal key needed
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || isBlocked}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating with AI...</span>
                  </>
                ) : (
                  <>
                    <RiSparklingFill className="w-4 h-4 text-amber-300" />
                    <span>Generate Template</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result Preview Area */}
          {generatedData && generatedData.template && (
            <div className="border-t border-indigo-100 pt-6 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
                  <h3 className="text-sm font-bold text-gray-900">Generated Template Result</h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono">
                    {generatedData.template.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200">
                    {generatedData.template.category}
                  </span>
                </div>
              </div>

              {/* Chat Bubble & Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Simulated WhatsApp Phone Bubble */}
                <div className="bg-[#E5DDD5] p-4 rounded-2xl border border-gray-300 shadow-inner flex flex-col justify-center">
                  <div className="bg-white rounded-xl p-3.5 shadow-sm space-y-2 border border-black/5 max-w-sm mx-auto w-full">
                    {headerComp && (
                      <div className="text-xs font-bold text-gray-900 pb-1 border-b border-gray-100">
                        {headerComp.format === 'TEXT' ? (
                          headerComp.text
                        ) : (
                          (() => {
                            const mediaUrl = headerComp.example?.header_handle?.[0];
                            if (mediaUrl && headerComp.format === 'IMAGE') return <img src={mediaUrl} alt="AI generated header" className="w-full h-24 object-cover rounded-lg" />;
                            if (mediaUrl && headerComp.format === 'VIDEO') return <video src={mediaUrl} controls className="w-full h-24 object-cover rounded-lg" />;
                            return <a href={mediaUrl || '#'} target="_blank" rel="noreferrer" className="h-20 bg-gray-100 rounded-lg flex items-center justify-center text-indigo-600 text-xs font-medium uppercase tracking-wider">{mediaUrl ? `Open ${headerComp.format} file` : `[${headerComp.format} media unavailable]`}</a>;
                          })()
                        )}
                      </div>
                    )}

                    <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {bodyComp?.text || ''}
                    </div>

                    {footerComp && (
                      <div className="text-[11px] text-gray-500 pt-1">
                        {footerComp.text}
                      </div>
                    )}

                    {buttonsComp && Array.isArray(buttonsComp.buttons) && (
                      <div className="pt-2 border-t border-gray-100 space-y-1.5">
                        {buttonsComp.buttons.map((btn, bIdx) => (
                          <div
                            key={bIdx}
                            className="text-xs font-semibold text-[#00a884] bg-gray-50 py-1.5 px-3 rounded-lg text-center border border-gray-200 flex items-center justify-center gap-1.5"
                          >
                            <FiMessageSquare className="w-3 h-3" />
                            <span>{btn.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Variable Mappings & AI Notes */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5 flex items-center gap-1">
                        <FiLayers className="text-indigo-600" /> Sample Variables Detected:
                      </h4>
                      {generatedData.sample_variables && Object.keys(generatedData.sample_variables).length > 0 ? (
                        <div className="space-y-1.5">
                          {Object.entries(generatedData.sample_variables).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded-lg border border-gray-200">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-mono font-bold text-[11px]">
                                {'{{' + k + '}}'}
                              </span>
                              <span className="text-gray-700 font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No variable placeholders used in this template.</p>
                      )}
                    </div>

                    {generatedData.explanation && (
                      <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-xl text-xs text-indigo-900">
                        <span className="font-bold flex items-center gap-1 mb-0.5 text-indigo-800">
                          <FiInfo className="w-3.5 h-3.5" /> AI Strategy Note:
                        </span>
                        {generatedData.explanation}
                      </div>
                    )}
                  </div>

                  {/* Action Choices */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={handleApply}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                      <FiCheck className="w-4 h-4" />
                      <span>Apply to Editor & Customize</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveDirectly}
                      disabled={savingDirectly}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {savingDirectly ? (
                        <>
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="w-4 h-4" />
                          <span>Save & Submit to WhatsApp</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3.5 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            {aiStatus.is_personal_key ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-emerald-700 font-semibold">Personal API Key Active (Free / No Wallet Min)</span>
              </>
            ) : (
              <>
                <span className={`w-2 h-2 rounded-full ${aiStatus.is_eligible ? 'bg-indigo-500' : 'bg-amber-500'}`}></span>
                <span>Platform AI Key Active (Wallet: ₹{Number(aiStatus.balance).toFixed(2)})</span>
              </>
            )}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
