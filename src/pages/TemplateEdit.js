import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FiX,
  FiPlus,
  FiPaperclip,
  FiBold,
  FiItalic,
  FiUnderline,
  FiCode,
  FiChevronLeft,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';
import WhatsAppPreview from '../component/TemplateAdd/WhatsAppPreview';
import { uploadFile } from '../utils/uploadFile';

import AnimatedModal from '../component/Modals/AnimatedModal';
function TemplateEdit() {
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [templateStatus, setTemplateStatus] = useState(null);
  const textareaRef = useRef(null);

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
  ];

  const categoryHints = {
    MARKETING: 'Promotions, offers, and product updates you send to customers.',
    UTILITY: 'Order updates, reminders and account alerts for something the customer started.',
  };

  // Header formats
  const headerFormats = [
    { code: 'NONE', name: 'None' },
    { code: 'TEXT', name: 'Text' },
    { code: 'IMAGE', name: 'Image' },
    { code: 'VIDEO', name: 'Video' },
    { code: 'DOCUMENT', name: 'Document' }
  ];

  // Button types
  const buttonTypes = [
    { type: 'QUICK_REPLY', label: 'Quick reply' },
    { type: 'URL', label: 'URL' },
    { type: 'PHONE_NUMBER', label: 'Phone number' },
    { type: 'COPY_CODE', label: 'Copy code' },
  ];

  // Fetch template data for editing
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
            // Store template status for error handling
            setTemplateStatus(template.status);
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

            // Handle API response - check both response.data.data and response.data.template
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

              // Store template status for error handling
              setTemplateStatus(templateData.status);

              console.log('Fetched template from API:', template);
              populateFormFromTemplate(template);
              templateFound = true;
            }
          } catch (apiError) {
            console.error('API fetch failed:', apiError);
            // Fall back to sample data if API fails
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

          // Extract body variables
          if (component.text) {
            const variableMatches = component.text.match(/\{\{(\d+)\}\}/g);
            if (variableMatches) {
              const samples = component.example?.body_text?.[0] || [];
              variableMatches.forEach((match, index) => {
                const varNum = parseInt(match.replace(/[{}]/g, ''));
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
              // Handle OTP copy code button
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
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle header format change
  const handleHeaderFormatChange = (format) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        header: {
          ...prev.components.header,
          format: format,
          text: format === 'TEXT' ? prev.components.header.text : '',
          example: format === 'TEXT' ? { header_text: [] } : { header_handle: [] }
        }
      }
    }));
    if (format !== 'TEXT') {
      setHeaderVariable(null);
    }
  };

  // Handle header media upload
  const handleHeaderMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setIsUploading(true);
      try {
        const { link } = await uploadFile(file);

        setFormData(prev => ({
          ...prev,
          components: {
            ...prev.components,
            header: {
              ...prev.components.header,
              example: {
                header_handle: [link]
              }
            }
          }
        }));
      } catch (error) {
        console.error('Error uploading file:', error);
        alert(`Failed to upload file: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Handle header text change
  const handleHeaderTextChange = (text) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        header: {
          ...prev.components.header,
          text: text
        }
      }
    }));
  };

  // Add a variable to header (only one allowed)
  const addHeaderVariable = () => {
    if (headerVariable) {
      alert('Header can only have one variable');
      return;
    }

    const newVariable = {
      id: Date.now(),
      name: 'var1',
      sample: ''
    };

    setHeaderVariable(newVariable);
    handleHeaderTextChange(formData.components.header.text + ' {{1}}');
  };

  // Update header variable sample
  const updateHeaderVariable = (sample) => {
    if (headerVariable) {
      setHeaderVariable(prev => ({ ...prev, sample }));
    }
  };

  // Remove header variable
  const removeHeaderVariable = () => {
    if (headerVariable) {
      // Remove variable from header text
      const newHeaderText = formData.components.header.text.replace(/\{\{1\}\}/g, '');
      handleHeaderTextChange(newHeaderText);
      setHeaderVariable(null);
    }
  };

  // Handle body text change
  const handleBodyTextChange = (text) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        body: {
          ...prev.components.body,
          text: text
        }
      }
    }));
  };

  // Add a variable to body at cursor position
  const addBodyVariable = () => {
    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentText = formData.components.body.text;

    const newVariable = {
      id: Date.now(),
      name: `var${bodyVariables.length + 1}`,
      sample: ''
    };

    // Insert variable at cursor position
    const variableText = `{{${bodyVariables.length + 1}}}`;
    const newBodyText = currentText.slice(0, startPos) + variableText + currentText.slice(endPos);

    setBodyVariables(prev => [...prev, newVariable]);
    handleBodyTextChange(newBodyText);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(startPos + variableText.length, startPos + variableText.length);
    }, 0);
  };

  // Update body variable sample
  const updateBodyVariable = (id, sample) => {
    setBodyVariables(prev => prev.map(v =>
      v.id === id ? { ...v, sample } : v
    ));
  };

  // Remove body variable
  const removeBodyVariable = (id) => {
    const variable = bodyVariables.find(v => v.id === id);
    if (variable) {
      const varIndex = bodyVariables.findIndex(v => v.id === id);
      const varNumber = varIndex + 1;

      // Remove variable from body text
      const newBodyText = formData.components.body.text.replace(new RegExp(`\\{\\{${varNumber}\\}\\}`, 'g'), '');
      handleBodyTextChange(newBodyText);
      setBodyVariables(prev => prev.filter(v => v.id !== id));
    }
  };

  // Handle footer text change
  const handleFooterTextChange = (text) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        footer: {
          ...prev.components.footer,
          text: text
        }
      }
    }));
  };

  // Apply formatting to selected text
  const applyFormatting = (format) => {
    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    if (startPos === endPos) return;

    let formattedText = '';
    const selected = formData.components.body.text.slice(startPos, endPos);

    switch (format) {
      case 'bold':
        formattedText = `*${selected}*`;
        break;
      case 'italic':
        formattedText = `_${selected}_`;
        break;
      case 'underline':
        formattedText = `~${selected}~`;
        break;
      case 'code':
        formattedText = '```' + selected + '```';
        break;
      default:
        formattedText = selected;
    }

    const newBodyText = formData.components.body.text.slice(0, startPos) +
      formattedText +
      formData.components.body.text.slice(endPos);

    handleBodyTextChange(newBodyText);

    // Set cursor position after the formatted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(startPos, startPos + formattedText.length);
    }, 0);
  };

  // Add a button
  const addButton = (type) => {
    if (formData.components.buttons.buttons.length >= 3) {
      alert('Maximum 3 buttons allowed');
      return;
    }

    const newButton = {
      type: type,
      text: '',
      ...(type === 'PHONE_NUMBER' && { phone_number: '' }),
      ...(type === 'URL' && { url: '', example: [] }),
      ...(type === 'COPY_CODE' && { copy_code: '' })
    };

    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        buttons: {
          ...prev.components.buttons,
          buttons: [...prev.components.buttons.buttons, newButton]
        }
      }
    }));
  };

  // Remove a button
  const removeButton = (index) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        buttons: {
          ...prev.components.buttons,
          buttons: prev.components.buttons.buttons.filter((_, i) => i !== index)
        }
      }
    }));
  };

  // Update button data
  const updateButton = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        buttons: {
          ...prev.components.buttons,
          buttons: prev.components.buttons.buttons.map((btn, i) =>
            i === index ? { ...btn, [field]: value } : btn
          )
        }
      }
    }));
  };

  // Add URL example for button
  const addButtonUrlExample = (index) => {
    const currentExamples = formData.components.buttons.buttons[index]?.example || [];
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        buttons: {
          ...prev.components.buttons,
          buttons: prev.components.buttons.buttons.map((btn, i) =>
            i === index ? {
              ...btn,
              example: [...currentExamples, '']
            } : btn
          )
        }
      }
    }));
  };

  // Update URL example for button
  const updateButtonUrlExample = (buttonIndex, exampleIndex, value) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        buttons: {
          ...prev.components.buttons,
          buttons: prev.components.buttons.buttons.map((btn, i) =>
            i === buttonIndex ? {
              ...btn,
              example: btn.example.map((ex, j) => j === exampleIndex ? value : ex)
            } : btn
          )
        }
      }
    }));
  };

  // Remove URL example for button
  const removeButtonUrlExample = (buttonIndex, exampleIndex) => {
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        buttons: {
          ...prev.components.buttons,
          buttons: prev.components.buttons.buttons.map((btn, i) =>
            i === buttonIndex ? {
              ...btn,
              example: btn.example.filter((_, j) => j !== exampleIndex)
            } : btn
          )
        }
      }
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tokens?.token) {
      alert('Authentication required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare components array
      const components = [];

      // Add header if not NONE
      if (formData.components.header.format !== 'NONE') {
        const headerComponent = {
          type: 'HEADER',
          format: formData.components.header.format
        };

        if (formData.components.header.format === 'TEXT') {
          headerComponent.text = formData.components.header.text;
          if (headerVariable && headerVariable.sample) {
            headerComponent.example = {
              header_text: [headerVariable.sample]
            };
          }
        } else {
          headerComponent.example = formData.components.header.example;
        }

        components.push(headerComponent);
      }

      // Add body
      if (formData.components.body.text) {
        const bodyComponent = {
          type: 'BODY',
          text: formData.components.body.text
        };

        if (bodyVariables.length > 0) {
          const bodySamples = bodyVariables.map(v => v.sample || '');
          bodyComponent.example = {
            body_text: [bodySamples]
          };
        }

        components.push(bodyComponent);
      }

      // Add buttons if any
      if (formData.components.buttons.buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: formData.components.buttons.buttons.map(btn => {
            if (btn.type === 'COPY_CODE') {
              // Convert COPY_CODE to OTP format
              return {
                type: 'otp',
                otp_type: 'copy_code',
                text: btn.text
              };
            } else if (btn.type === 'PHONE_NUMBER') {
              return {
                type: btn.type,
                text: btn.text,
                phone_number: btn.phone_number
              };
            } else if (btn.type === 'URL') {
              const buttonData = {
                type: btn.type,
                text: btn.text,
                url: btn.url
              };
              if (btn.example && btn.example.length > 0) {
                buttonData.example = btn.example;
              }
              return buttonData;
            } else {
              return {
                type: btn.type,
                text: btn.text
              };
            }
          })
        });
      }

      // Add footer if exists
      if (formData.components.footer.text) {
        components.push({
          type: 'FOOTER',
          text: formData.components.footer.text
        });
      }

      // Prepare payload for template update
      const payload = {
        project_id: tokens.selected_project_id || tokens.projects?.[0]?.project_id,
        template_id: templateId,
        template: {
          category: formData.category,
          components: components
        }
      };

      console.log('Updating template payload:', JSON.stringify(payload, null, 2));

      // Encrypt the payload
      const { Encrypt } = await import('./encryption/payload-encryption');
      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });

      // Use the correct API endpoint for editing templates
      const response = await axios.post(
        `${API_BASE_URL}/template/template-edit`,
        data_pass,
        {
          headers: {
            'token': tokens.token,
            'username': tokens.username,
            'Content-Type': 'application/json'
          }
        }
      );

      // Check for successful response - only show success when !error
      // Exception: If template is REJECTED and error is about category update, allow it
      const errorMessage = response.data?.error;
      const isCategoryUpdateError = errorMessage &&
        (errorMessage.includes('cannot update') || errorMessage.includes('update an approved template category')) &&
        errorMessage.includes('category');

      if (!response.data?.error || (isCategoryUpdateError && templateStatus === 'REJECTED')) {
        // Set success data and show popup
        setSuccessData({
          template_name: formData.name,
          template_id: templateId,
          status: 'UPDATED',
          message: 'Template updated successfully!'
        });
        setShowSuccessPopup(true);

        // Clear localStorage to force refresh of template list
        localStorage.removeItem('templatesData');
      } else {
        throw new Error(response.data?.message || response.data?.error || 'Failed to update template');
      }

    } catch (error) {
      console.error('Error updating template:', error);
      setErrorMessage(error.response?.data?.message || error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle redirect to templates page
  const handleRedirectToTemplates = () => {
    navigate('/template');
  };

  // Close success popup
  const closeSuccessPopup = () => {
    setShowSuccessPopup(false);
    setSuccessData(null);
  };

  // Clear error message
  const clearErrorMessage = () => {
    setErrorMessage('');
  };

  // Generate preview text with variables replaced
  const generatePreviewText = (text, variables) => {
    let preview = text;
    variables.forEach((v, i) => {
      const varNumber = i + 1;
      preview = preview.replace(new RegExp(`\\{\\{${varNumber}\\}\\}`, 'g'), v.sample || `{{${varNumber}}}`);
    });
    return preview;
  };

  // Format text for WhatsApp preview
  const formatTextForPreview = (text) => {
    if (!text) return '';

    return text
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<s>$1</s>')
      .replace(/```(.*?)```/gs, '<code>$1</code>');
  };

  const fieldClass = 'h-[42px] w-full rounded-[9px] border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-400 focus:outline-none focus:border-brand-600';
  const readOnlyClass = 'h-[42px] w-full rounded-[9px] border border-line bg-[#F6F5FA] px-3 text-sm text-ink-500';
  const areaClass = 'min-h-[120px] w-full resize-y rounded-[9px] border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-400 focus:outline-none focus:border-brand-600';
  const labelClass = 'mb-1.5 block text-[13px] font-medium text-ink';

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-ground">
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
          <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
            <div className="mb-6 flex items-start gap-2">
              <button
                type="button"
                onClick={() => navigate('/template')}
                className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-ink-500 hover:bg-white hover:text-ink"
                aria-label="Back to templates"
              >
                <FiChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-[26px] font-extrabold tracking-tight text-ink leading-tight">Edit template</h1>
                <p className="mt-1 text-sm text-ink-500">Meta reviews every template before you can send it, usually within a few hours.</p>
              </div>
            </div>
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-600"></div>
              <span className="ml-3 text-sm text-ink-500">Loading template...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-ground">
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
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-2">
              <button
                type="button"
                onClick={() => navigate('/template')}
                className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-ink-500 hover:bg-white hover:text-ink"
                aria-label="Back to templates"
              >
                <FiChevronLeft size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-[26px] font-extrabold tracking-tight text-ink leading-tight">Edit template</h1>
                <p className="mt-1 max-w-xl text-sm text-ink-500">
                  Meta reviews every template before you can send it, usually within a few hours.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/template')}
                className="inline-flex h-[38px] items-center justify-center rounded-[9px] border border-line bg-white px-3.5 text-[13px] font-semibold text-ink hover:bg-[#FAFAFD]"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-template-form"
                disabled={isSubmitting}
                className="inline-flex h-[38px] items-center justify-center rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                    Updating...
                  </span>
                ) : (
                  'Update template'
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <form id="edit-template-form" onSubmit={handleSubmit} className="min-w-0 space-y-4">
              <section className="rounded-[14px] border border-line bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-ink text-[12px] font-bold text-white">1</span>
                  <h2 className="text-[15px] font-bold text-ink">Basics</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Template name</label>
                    <input
                      type="text"
                      value={formData.name}
                      className={readOnlyClass}
                      disabled
                      placeholder="Template name"
                    />
                    <p className="mt-1.5 text-xs text-ink-400">Template name cannot be changed after creation</p>
                  </div>
                  <div>
                    <label className={labelClass}>Language</label>
                    <input
                      type="text"
                      value={languages.find(lang => lang.code === formData.language)?.name || formData.language}
                      className={readOnlyClass}
                      disabled
                      placeholder="Language"
                    />
                    <p className="mt-1.5 text-xs text-ink-400">Language cannot be changed after creation</p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className={labelClass}>Category</label>
                  <SearchableSelect
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    options={[{ value: '', label: 'Select a category' }, ...categories.map((cat) => ({ value: cat.code, label: cat.name }))]}
                    placeholder="Select a category"
                    className={fieldClass}
                  />
                  {categoryHints[formData.category] && (
                    <p className="mt-2 text-xs text-ink-500">{categoryHints[formData.category]}</p>
                  )}
                </div>
              </section>

              <section className="rounded-[14px] border border-line bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-ink text-[12px] font-bold text-white">2</span>
                  <h2 className="text-[15px] font-bold text-ink">Message</h2>
                </div>

                <div>
                  <label className={labelClass}>Header</label>
                  <div className="flex flex-wrap gap-1.5">
                    {headerFormats.map(format => (
                      <button
                        key={format.code}
                        type="button"
                        onClick={() => handleHeaderFormatChange(format.code)}
                        className={`h-8 rounded-[8px] px-3 text-[13px] font-medium ${formData.components.header.format === format.code
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-500 hover:bg-[#F6F5FA] hover:text-ink'
                          }`}
                      >
                        {format.name}
                      </button>
                    ))}
                  </div>
                </div>

                {formData.components.header.format === 'TEXT' && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="text-[13px] font-medium text-ink">Header text</label>
                      {!headerVariable && (
                        <button
                          type="button"
                          onClick={addHeaderVariable}
                          className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink"
                        >
                          <FiPlus size={13} />
                          Add variable
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.components.header.text}
                      onChange={(e) => handleHeaderTextChange(e.target.value)}
                      className={fieldClass}
                      placeholder="Header text"
                      maxLength={60}
                    />
                    <p className="mt-1.5 text-xs text-ink-400">
                      {formData.components.header.text.length}/60 characters
                    </p>

                    {headerVariable && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="w-12 shrink-0 font-mono text-[13px] text-ink-500">{'{{1}}'}</span>
                        <input
                          type="text"
                          placeholder="Sample value"
                          className={fieldClass}
                          value={headerVariable.sample}
                          onChange={e => updateHeaderVariable(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={removeHeaderVariable}
                          className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] border border-line text-ink-400 hover:text-ink"
                          title="Remove header variable"
                        >
                          <FiX size={16} />
                        </button>
                      </div>
                    )}
                    {headerVariable && (
                      <p className="mt-1.5 text-xs text-ink-400">Header can only have one variable.</p>
                    )}
                  </div>
                )}

                {(formData.components.header.format === 'IMAGE' || formData.components.header.format === 'VIDEO' || formData.components.header.format === 'DOCUMENT') && (
                  <div className="mt-4">
                    <label className={labelClass}>Header {formData.components.header.format.toLowerCase()}</label>
                    {formData.components.header.example.header_handle && formData.components.header.example.header_handle.length > 0 ? (
                      <div className="flex h-[42px] items-center justify-between rounded-[9px] border border-line bg-white px-3">
                        <div className="flex min-w-0 items-center">
                          <FiPaperclip className="mr-2 shrink-0 text-ink-400" />
                          <span className="truncate text-sm text-ink">
                            {formData.components.header.example.header_handle[0].split('/').pop()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleHeaderFormatChange('NONE')}
                          className="text-ink-400 hover:text-ink"
                          aria-label="Remove header media"
                        >
                          <FiX />
                        </button>
                      </div>
                    ) : (
                      <label className={`flex h-28 w-full flex-col items-center justify-center rounded-[9px] border border-dashed border-line bg-[#FAFAFD] ${isUploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand-300'}`}>
                        <div className="flex flex-col items-center justify-center">
                          {isUploading ? (
                            <>
                              <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-600"></div>
                              <p className="text-sm text-ink-500">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <FiPaperclip className="mb-2 h-5 w-5 text-ink-400" />
                              <p className="text-sm text-ink-500">Click to upload {formData.components.header.format.toLowerCase()}</p>
                              <p className="text-xs text-ink-400">MAX. 5MB</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleHeaderMediaUpload}
                          disabled={isUploading}
                          accept={
                            formData.components.header.format === 'IMAGE' ? 'image/*' :
                              formData.components.header.format === 'VIDEO' ? 'video/*' :
                                '*'
                          }
                        />
                      </label>
                    )}
                  </div>
                )}

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label className="text-[13px] font-medium text-ink">Body</label>
                    <button
                      type="button"
                      onClick={addBodyVariable}
                      className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink"
                    >
                      <FiPlus size={13} />
                      Add variable
                    </button>
                  </div>
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    className={areaClass}
                    placeholder="Enter your message content here. Use {{1}} for variables."
                    value={formData.components.body.text}
                    onChange={(e) => handleBodyTextChange(e.target.value)}
                    required
                  ></textarea>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-400">{formData.components.body.text.length}/1024 characters</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => applyFormatting('bold')} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-line text-ink-500 hover:bg-[#F6F5FA] hover:text-ink" title="Bold">
                        <FiBold size={14} />
                      </button>
                      <button type="button" onClick={() => applyFormatting('italic')} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-line text-ink-500 hover:bg-[#F6F5FA] hover:text-ink" title="Italic">
                        <FiItalic size={14} />
                      </button>
                      <button type="button" onClick={() => applyFormatting('underline')} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-line text-ink-500 hover:bg-[#F6F5FA] hover:text-ink" title="Strikethrough">
                        <FiUnderline size={14} />
                      </button>
                      <button type="button" onClick={() => applyFormatting('code')} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-line text-ink-500 hover:bg-[#F6F5FA] hover:text-ink" title="Monospace">
                        <FiCode size={14} />
                      </button>
                    </div>
                  </div>

                  {bodyVariables.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {bodyVariables.map((variable, index) => (
                        <div key={variable.id} className="flex items-center gap-2">
                          <span className="w-12 shrink-0 font-mono text-[13px] text-ink-500">{`{{${index + 1}}}`}</span>
                          <input
                            type="text"
                            placeholder="Sample value"
                            className={fieldClass}
                            value={variable.sample}
                            onChange={e => updateBodyVariable(variable.id, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeBodyVariable(variable.id)}
                            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] border border-line text-ink-400 hover:text-ink"
                            title="Remove variable"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className={labelClass}>Footer (optional)</label>
                  <input
                    type="text"
                    value={formData.components.footer.text}
                    onChange={(e) => handleFooterTextChange(e.target.value)}
                    className={fieldClass}
                    placeholder="Footer text"
                    maxLength={60}
                  />
                  <p className="mt-1.5 text-xs text-ink-400">
                    {formData.components.footer.text.length}/60 characters
                  </p>
                </div>
              </section>

              <section className="rounded-[14px] border border-line bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-ink text-[12px] font-bold text-white">3</span>
                  <h2 className="text-[15px] font-bold text-ink">Buttons</h2>
                  <span className="text-[13px] font-normal text-ink-400">optional, up to 3</span>
                </div>

                <div className="space-y-3">
                  {formData.components.buttons.buttons.map((btn, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <span className="inline-flex h-[42px] w-full shrink-0 items-center rounded-[9px] border border-line bg-white px-3 text-[13px] text-ink sm:w-[140px]">
                          {buttonTypes.find(b => b.type === btn.type)?.label}
                        </span>
                        <input
                          type="text"
                          placeholder="Button text"
                          className={fieldClass}
                          value={btn.text}
                          onChange={e => updateButton(index, 'text', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeButton(index)}
                          className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] border border-line text-ink-400 hover:text-ink"
                          aria-label="Remove button"
                        >
                          <FiX size={16} />
                        </button>
                      </div>

                      {btn.type === 'PHONE_NUMBER' && (
                        <input
                          type="tel"
                          placeholder="Phone number (e.g., 917089379345)"
                          className={fieldClass}
                          value={btn.phone_number}
                          onChange={e => updateButton(index, 'phone_number', e.target.value)}
                        />
                      )}

                      {btn.type === 'URL' && (
                        <div className="space-y-2">
                          <input
                            type="url"
                            placeholder="URL (e.g., https://example.com/{{1}})"
                            className={fieldClass}
                            value={btn.url}
                            onChange={e => updateButton(index, 'url', e.target.value)}
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-ink-400">URL examples</span>
                            <button
                              type="button"
                              onClick={() => addButtonUrlExample(index)}
                              className="text-[13px] font-semibold text-brand-700 hover:text-brand-800"
                            >
                              + Add example
                            </button>
                          </div>
                          {btn.example?.map((example, exIndex) => (
                            <div key={exIndex} className="flex gap-2">
                              <input
                                type="url"
                                placeholder="Example URL"
                                className={fieldClass}
                                value={example}
                                onChange={e => updateButtonUrlExample(index, exIndex, e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => removeButtonUrlExample(index, exIndex)}
                                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[9px] border border-line text-ink-400 hover:text-ink"
                                aria-label="Remove example"
                              >
                                <FiX size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {btn.type === 'COPY_CODE' && (
                        <div className="space-y-2">
                          <p className="text-xs text-ink-400">
                            This button will be converted to OTP format with type &quot;otp&quot; and otp_type &quot;copy_code&quot;
                          </p>
                          <input
                            type="text"
                            placeholder="Code to copy"
                            className={fieldClass}
                            value={btn.copy_code}
                            onChange={e => updateButton(index, 'copy_code', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {buttonTypes.map(btn => (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => addButton(btn.type)}
                      disabled={formData.components.buttons.buttons.length >= 3}
                      className="inline-flex h-8 items-center gap-1 rounded-[9px] border border-line bg-white px-2.5 text-[13px] font-medium text-ink-500 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FiPlus size={12} />
                      {btn.label}
                    </button>
                  ))}
                </div>
              </section>
            </form>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-[14px] border border-line bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-ink">Preview</h3>
                  {formData.category && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      {categories.find((cat) => cat.code === formData.category)?.name || formData.category}
                    </span>
                  )}
                </div>
                <WhatsAppPreview
                  formData={formData}
                  bodyVariables={bodyVariables}
                  darkMode={false}
                />
              </div>
              <div className="rounded-[14px] border border-line bg-white p-4">
                <p className="text-[13px] leading-relaxed text-ink-500">
                  <span className="font-semibold text-ink">Before you submit:</span> give every variable a sample value, and avoid starting or ending the body with a variable. Meta rejects templates that do.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Success Popup Modal */}
      <AnimatedModal open={showSuccessPopup}>
        {showSuccessPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-center mb-4">
                <FiCheckCircle className="text-green-500 text-4xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Template Updated Successfully!
              </h3>
              {successData && (
                <div className="bg-gray-50 rounded-md p-4 mb-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Template Name:</span>
                      <span className="font-medium">{successData.template_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Template ID:</span>
                      <span className="font-medium text-xs">{successData.template_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium">{successData.status}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex space-x-3">
                <button
                  onClick={closeSuccessPopup}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Stay Here
                </button>
                <button
                  onClick={handleRedirectToTemplates}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Go to Templates
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>

      {/* Error Message Modal */}
      <AnimatedModal open={errorMessage}>
        {errorMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-center mb-4">
                <FiAlertCircle className="text-red-500 text-4xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Template Update Failed
              </h3>
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={clearErrorMessage}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}

export default TemplateEdit;
