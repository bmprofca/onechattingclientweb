import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import { Encrypt } from './encryption/payload-encryption';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
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
import AiTemplateModal from '../component/Modals/AiTemplateModal';
import { RiSparklingFill } from 'react-icons/ri';
import { useLocation } from 'react-router-dom';
import { uploadFile } from '../utils/uploadFile';

import AnimatedModal from '../component/Modals/AnimatedModal';
function TemplateAdd() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const location = useLocation();

  const handleApplyAiTemplate = (aiData) => {
    if (!aiData?.template) return;
    const { template, sample_variables } = aiData;
    const comps = template.components || [];

    const headerC = comps.find(c => String(c.type).toUpperCase() === 'HEADER');
    const bodyC = comps.find(c => String(c.type).toUpperCase() === 'BODY');
    const footerC = comps.find(c => String(c.type).toUpperCase() === 'FOOTER');
    const buttonsC = comps.find(c => String(c.type).toUpperCase() === 'BUTTONS');

    const headerFormat = String(headerC?.format || 'NONE').toUpperCase();
    const isMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);
    const headerExample = headerC?.example || {};

    setFormData({
      name: template.name || '',
      category: template.category || 'MARKETING',
      language: template.language || 'en',
      components: {
        header: {
          type: 'HEADER',
          format: ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) ? headerFormat : 'NONE',
          text: headerC?.text || '',
          // AI defines the default format. Media can be replaced with a real
          // upload in the editor because AI cannot create a WhatsApp media handle.
          example: isMediaHeader
            ? { header_handle: Array.isArray(headerExample.header_handle) ? headerExample.header_handle : [] }
            : { header_text: Array.isArray(headerExample.header_text) ? headerExample.header_text : [] }
        },
        body: {
          type: 'BODY',
          text: bodyC?.text || '',
          example: bodyC?.example || { body_text: [] }
        },
        footer: {
          type: 'FOOTER',
          text: footerC?.text || ''
        },
        buttons: {
          type: 'BUTTONS',
          buttons: buttonsC?.buttons || []
        }
      }
    });

    // Parse variables from body text
    const varRegex = /\{\{(\d+)\}\}/g;
    const varsFound = [];
    const varSet = new Set();
    let m;
    const bodyText = bodyC?.text || '';
    while ((m = varRegex.exec(bodyText)) !== null) {
      const num = parseInt(m[1]);
      if (!varSet.has(num)) {
        varSet.add(num);
        varsFound.push(num);
      }
    }

    const newVars = varsFound.sort((a, b) => a - b).map((num, idx) => {
      let sampleVal = sample_variables?.[String(num)] || bodyC?.example?.body_text?.[0]?.[num - 1] || '';
      return {
        id: idx + 1,
        sample: String(sampleVal)
      };
    });

    setBodyVariables(newVars);
  };

  useEffect(() => {
    if (location.state?.aiTemplateData) {
      handleApplyAiTemplate(location.state.aiTemplateData);
    }
  }, [location.state]);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    language: 'en',
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('sidebarMinimized');
    return saved ? JSON.parse(saved) : false;
  });


  const textareaRef = useRef(null);

  const DEFAULT_AUTH_CONFIG = {
    addSecurityRecommendation: true,
    includeCodeExpiration: true,
    codeExpirationMinutes: 10,
    otpType: 'COPY_CODE',
    otpButtonText: 'Copy code',
  };

  const [authConfig, setAuthConfig] = useState({ ...DEFAULT_AUTH_CONFIG });
  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

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

  const categoryHints = {
    MARKETING: 'Promotions, offers, and product updates you send to customers.',
    UTILITY: 'Order updates, reminders and account alerts for something the customer started.',
    AUTHENTICATION: 'One-time passwords customers use to verify their identity.',
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
  ];

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const processedValue = name === 'name' ? value.toLowerCase().replace(/\s+/g, '_') : value;

    if (name === 'category' && processedValue === 'AUTHENTICATION') {
      setFormData(prev => ({
        ...prev,
        category: processedValue,
        components: {
          ...prev.components,
          header: {
            type: 'HEADER',
            format: 'NONE',
            text: '',
            example: { header_handle: [] },
          },
          body: {
            type: 'BODY',
            text: '',
            example: { body_text: [] },
          },
          footer: {
            type: 'FOOTER',
            text: '',
          },
          buttons: {
            type: 'BUTTONS',
            buttons: [],
          },
        },
      }));
      setBodyVariables([]);
      setAuthConfig({ ...DEFAULT_AUTH_CONFIG });
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleAuthConfigChange = (field, value) => {
    setAuthConfig(prev => ({ ...prev, [field]: value }));
  };

  const buildAuthenticationComponents = () => {
    const components = [];
    const bodyComponent = { type: 'BODY' };
    if (authConfig.addSecurityRecommendation) {
      bodyComponent.add_security_recommendation = true;
    }
    components.push(bodyComponent);

    if (authConfig.includeCodeExpiration) {
      const minutes = Math.min(90, Math.max(1, Number(authConfig.codeExpirationMinutes) || 10));
      components.push({
        type: 'FOOTER',
        code_expiration_minutes: minutes,
      });
    }

    components.push({
      type: 'BUTTONS',
      buttons: [{
        type: 'OTP',
        otp_type: authConfig.otpType,
        text: authConfig.otpButtonText.trim(),
      }],
    });

    return components;
  };

  const isAuthentication = formData.category === 'AUTHENTICATION';

  // Check if all mandatory fields are filled
  const isFormValid = () => {
    if (isAuthentication) {
      const minutes = Number(authConfig.codeExpirationMinutes);
      const expirationValid = !authConfig.includeCodeExpiration ||
        (Number.isFinite(minutes) && minutes >= 1 && minutes <= 90);

      return (
        formData.name.trim() !== '' &&
        formData.category !== '' &&
        formData.language !== '' &&
        authConfig.otpButtonText.trim() !== '' &&
        expirationValid
      );
    }

    const basicFieldsValid = (
      formData.name.trim() !== '' &&
      formData.category !== '' &&
      formData.language !== '' &&
      formData.components.body.text.trim() !== ''
    );

    const allVariablesHaveSamples = bodyVariables.length === 0 ||
      bodyVariables.every(v => v.sample && v.sample.trim() !== '');

    return basicFieldsValid && allVariablesHaveSamples;
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


  // Get the next variable number based on current body text
  const getNextVariableNumber = () => {
    const regex = /\{\{(\d+)\}\}/g;
    const existingVars = new Set();
    let match;

    while ((match = regex.exec(formData.components.body.text)) !== null) {
      existingVars.add(parseInt(match[1]));
    }

    // Next number is always count + 1 (sequential)
    return existingVars.size + 1;
  };

  // Handle body text change with cursor position preservation
  const handleBodyTextChange = (text, cursorPosition = null) => {
    const textarea = textareaRef.current;
    const originalCursor = cursorPosition ?? textarea?.selectionStart ?? text.length;

    // Extract all variable numbers from the body text in order of appearance
    const variableRegex = /\{\{(\d+)\}\}/g;
    const foundVariables = [];
    const variableMap = new Map();
    let match;

    while ((match = variableRegex.exec(text)) !== null) {
      const varNum = parseInt(match[1]);
      if (!variableMap.has(varNum)) {
        variableMap.set(varNum, match.index);
        foundVariables.push(varNum);
      }
    }

    // Check if variables are sequential
    let needsRenumbering = false;
    if (foundVariables.length > 0) {
      for (let i = 0; i < foundVariables.length; i++) {
        if (foundVariables[i] !== i + 1) {
          needsRenumbering = true;
          break;
        }
      }
    }

    // Create mapping from old numbers to new numbers for sample value preservation
    const oldToNewMap = new Map();
    foundVariables.forEach((oldNum, index) => {
      oldToNewMap.set(oldNum, index + 1);
    });

    // Renumber variables if needed
    let finalText = text;
    let cursorOffset = 0;

    if (needsRenumbering && foundVariables.length > 0) {
      const sortedOldNums = [...foundVariables].sort((a, b) => b - a);

      sortedOldNums.forEach(oldNum => {
        const newNum = oldToNewMap.get(oldNum);
        if (oldNum !== newNum) {
          finalText = finalText.replace(
            new RegExp(`\\{\\{${oldNum}\\}\\}`, 'g'),
            `{{TEMP_${newNum}}}`
          );
        }
      });

      finalText = finalText.replace(/\{\{TEMP_(\d+)\}\}/g, '{{$1}}');

      // Calculate cursor offset from renumbering
      cursorOffset = finalText.length - text.length;
    }

    // Update form data
    setFormData(prev => ({
      ...prev,
      components: {
        ...prev.components,
        body: {
          ...prev.components.body,
          text: finalText
        }
      }
    }));

    // Sync variables with proper sample value preservation
    setBodyVariables(prevVars => {
      // Create a map of old variable number -> sample value
      const oldSampleMap = new Map();
      prevVars.forEach((v, index) => {
        oldSampleMap.set(index + 1, v.sample);
      });

      // Count final variables in the text
      const finalVarRegex = /\{\{(\d+)\}\}/g;
      const finalVars = new Set();
      let finalMatch;
      while ((finalMatch = finalVarRegex.exec(finalText)) !== null) {
        finalVars.add(parseInt(finalMatch[1]));
      }

      const sortedFinalVars = Array.from(finalVars).sort((a, b) => a - b);

      if (sortedFinalVars.length === 0) {
        return [];
      }

      // Create new variables array
      const newVars = [];

      sortedFinalVars.forEach((newVarNum, index) => {
        // Find the OLD variable number that became this new number
        let oldVarNum = null;
        for (const [oldNum, mappedNewNum] of oldToNewMap.entries()) {
          if (mappedNewNum === newVarNum) {
            oldVarNum = oldNum;
            break;
          }
        }

        // Get the sample value from the old variable
        const sampleValue = oldVarNum !== null ? (oldSampleMap.get(oldVarNum) || '') : '';

        newVars.push({
          id: Date.now() + index,
          name: `var${newVarNum}`,
          sample: sampleValue
        });
      });

      return newVars;
    });

    // Restore cursor position
    if (textarea && cursorPosition !== null) {
      const newCursorPos = Math.max(0, Math.min(originalCursor + cursorOffset, finalText.length));
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Handle keydown for atomic variable deletion
  const handleBodyKeyDown = (e) => {
    const textarea = e.target;
    const text = formData.components.body.text;
    const cursorPos = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;

    // Only handle backspace and delete keys when no selection
    if ((e.key === 'Backspace' || e.key === 'Delete') && cursorPos === selectionEnd) {
      // Find all variables and their positions
      const varRegex = /\{\{(\d+)\}\}/g;
      let match;

      while ((match = varRegex.exec(text)) !== null) {
        const varStart = match.index;
        const varEnd = varStart + match[0].length;

        // Check if cursor is inside or at the edge of a variable
        if (e.key === 'Backspace') {
          // Backspace: check if cursor is inside or right after variable
          if (cursorPos > varStart && cursorPos <= varEnd) {
            e.preventDefault();
            // Remove the entire variable
            const newText = text.slice(0, varStart) + text.slice(varEnd);
            handleBodyTextChange(newText, varStart);
            return;
          }
        } else if (e.key === 'Delete') {
          // Delete: check if cursor is inside or right before variable
          if (cursorPos >= varStart && cursorPos < varEnd) {
            e.preventDefault();
            // Remove the entire variable
            const newText = text.slice(0, varStart) + text.slice(varEnd);
            handleBodyTextChange(newText, varStart);
            return;
          }
        }
      }
    }
  };

  // Handle textarea input change
  const handleBodyInputChange = (e) => {
    const textarea = e.target;
    const newText = e.target.value;
    const cursorPos = textarea.selectionStart;

    // Handle the change with cursor position
    handleBodyTextChange(newText, cursorPos);
  };

  // Add a variable to body at cursor position
  const addBodyVariable = () => {
    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const currentText = formData.components.body.text;

    // Count existing unique variables
    const variableRegex = /\{\{(\d+)\}\}/g;
    const existingVars = new Set();
    let match;

    while ((match = variableRegex.exec(currentText)) !== null) {
      existingVars.add(parseInt(match[1]));
    }

    // Next variable number is count + 1 (always sequential)
    const nextVarNum = existingVars.size + 1;

    // Insert variable at cursor position
    const variableText = `{{${nextVarNum}}}`;
    const newBodyText = currentText.slice(0, startPos) + variableText + currentText.slice(endPos);

    // handleBodyTextChange will automatically sync and renumber if needed
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
    const varIndex = bodyVariables.findIndex(v => v.id === id);
    if (varIndex === -1) return;

    const varNumber = varIndex + 1;

    // Remove all instances of this variable from body text
    const newBodyText = formData.components.body.text.replace(new RegExp(`\\{\\{${varNumber}\\}\\}`, 'g'), '');

    // handleBodyTextChange will automatically renumber and sync the variables
    handleBodyTextChange(newBodyText);
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
    setIsSubmitting(true);

    try {
      const components = isAuthentication
        ? buildAuthenticationComponents()
        : (() => {
          const built = [];

          if (formData.components.header.format !== 'NONE') {
            const headerComponent = {
              type: 'HEADER',
              format: formData.components.header.format
            };

            if (formData.components.header.format === 'TEXT') {
              headerComponent.text = formData.components.header.text;
            } else {
              headerComponent.example = formData.components.header.example;
            }

            built.push(headerComponent);
          }

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

            built.push(bodyComponent);
          }

          if (formData.components.footer.text) {
            built.push({
              type: 'FOOTER',
              text: formData.components.footer.text
            });
          }

          if (formData.components.buttons.buttons.length > 0) {
            built.push({
              type: 'BUTTONS',
              buttons: formData.components.buttons.buttons.map(btn => {
                if (btn.type === 'COPY_CODE') {
                  return {
                    type: 'OTP',
                    otp_type: 'COPY_CODE',
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

          return built;
        })();

      // Get user data from localStorage
      const userData = JSON.parse(localStorage.getItem('userData') || '{}');

      // Prepare payload with project_id (matching working API pattern)
      const selectedProjectId = userData.selected_project_id || userData.projects?.[0]?.project_id;

      const payload = {
        project_id: selectedProjectId,
        template: {
          name: formData.name,
          category: formData.category,
          language: formData.language,
          components: components
        }
      };

      console.log('Submitting template payload:', JSON.stringify(payload, null, 2));

      // Encrypt the payload (matching working API pattern)
      const { data, key } = Encrypt(payload);
      const data_pass = JSON.stringify({ data, key });
      console.log('Encrypted payload:', data_pass);

      // Submit to the API endpoint using axios (matching working API pattern)
      const response = await axios.post(
        `${API_BASE_URL}/template/create-template`,
        data_pass,
        {
          headers: {
            'token': userData.token || '',
            'username': userData.username || '',
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Full API response:', response);
      console.log('Response data:', response?.data);
      console.log('Response status:', response?.status);

      if (!response?.data?.error) {
        const result = response.data;
        console.log('Submission successful:', result);

        // Set success data and show popup
        setSuccessData(result);
        setShowSuccessPopup(true);

        // Reset form after successful submission
        setFormData({
          name: '',
          category: '',
          language: 'en',
          components: {
            header: {
              type: 'HEADER',
              format: 'NONE',
              text: '',
              example: { header_text: [] }
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
        setBodyVariables([]);
        setAuthConfig({ ...DEFAULT_AUTH_CONFIG });
      } else {
        // Handle specific error messages
        const errorMsg = response?.data?.error || response?.data?.message || 'Unknown error';
        setErrorMessage(errorMsg);
        throw new Error(`API Error: ${errorMsg}`);
      }

    } catch (error) {
      console.error('Error submitting template:', error);
      setErrorMessage(error.message);
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
  const areaClass = 'min-h-[120px] w-full resize-y rounded-[9px] border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-400 focus:outline-none focus:border-brand-600';
  const labelClass = 'mb-1.5 block text-[13px] font-medium text-ink';

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
          <div className="mb-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                  <h1 className="text-[26px] font-extrabold tracking-tight text-ink leading-tight">New template</h1>
                  <p className="mt-1 max-w-xl text-sm text-ink-500">
                    Meta reviews every template before you can send it, usually within a few hours.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded-[9px] border border-line bg-white px-3.5 text-[13px] font-semibold text-ink hover:bg-[#FAFAFD]"
                >
                  <RiSparklingFill className="text-brand-600" size={14} />
                  Draft with AI
                </button>
                <button
                  type="submit"
                  form="new-template-form"
                  disabled={isSubmitting || !isFormValid()}
                  className="inline-flex h-[38px] items-center justify-center rounded-[9px] bg-brand-600 px-3.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    'Submit for review'
                  )}
                </button>
              </div>
            </div>
            {!isFormValid() && (
              <p className="mt-3 text-xs text-rose-600 lg:text-right">
                {isAuthentication
                  ? 'Please fill in Template Name, Category, Language, and Copy Code button label'
                  : 'Please fill in all mandatory fields: Template Name, Category, Language, Body Content'}
                {!isAuthentication && bodyVariables.length > 0 && bodyVariables.some(v => !v.sample || v.sample.trim() === '') &&
                  ', and all variable sample values'}
                {isAuthentication && authConfig.includeCodeExpiration &&
                  (Number(authConfig.codeExpirationMinutes) < 1 || Number(authConfig.codeExpirationMinutes) > 90) &&
                  '. Code expiration must be between 1 and 90 minutes'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <form id="new-template-form" onSubmit={handleSubmit} className="min-w-0 space-y-4">
              <section className="rounded-[14px] border border-line bg-white p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-[7px] bg-ink text-[12px] font-bold text-white">1</span>
                  <h2 className="text-[15px] font-bold text-ink">Basics</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor="template-name">Template name</label>
                    <input
                      id="template-name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={fieldClass}
                      required
                      placeholder="e.g. order_update"
                    />
                    <p className="mt-1.5 text-xs text-ink-400">Lowercase letters, numbers and underscores only.</p>
                  </div>
                  <div>
                    <label className={labelClass}>Language</label>
                    <SearchableSelect
                      name="language"
                      value={formData.language}
                      onChange={handleInputChange}
                      options={[{ value: '', label: 'Select a language' }, ...languages.map((lang) => ({ value: lang.code, label: lang.name }))]}
                      placeholder="Select a language"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className={labelClass}>Category</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {categories.map((cat) => {
                      const selected = formData.category === cat.code;
                      return (
                        <button
                          key={cat.code}
                          type="button"
                          onClick={() => handleInputChange({ target: { name: 'category', value: cat.code } })}
                          className={`h-[42px] rounded-[9px] border text-[13px] font-semibold ${selected ? 'border-line bg-[#F3F2FA] text-ink' : 'border-line bg-white text-ink-500 hover:text-ink'}`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                  {categoryHints[formData.category] && (
                    <p className="mt-2 text-xs text-ink-500">{categoryHints[formData.category]}</p>
                  )}
                </div>

                {isAuthentication && (
                  <div className="mt-5 space-y-4 border-t border-line pt-5">
                    <div>
                      <h3 className="text-[13px] font-semibold text-ink">Authentication template</h3>
                      <p className="mt-1 text-xs text-ink-500">
                        Meta uses a fixed OTP message format. The verification code is supplied as {'{{1}}'} when you send the message.
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-line text-brand-600 focus:ring-brand-600"
                        checked={authConfig.addSecurityRecommendation}
                        onChange={(e) => handleAuthConfigChange('addSecurityRecommendation', e.target.checked)}
                      />
                      <span className="text-sm text-ink">
                        Add security recommendation
                        <span className="block text-xs text-ink-400">Appends &quot;For your security, do not share this code.&quot;</span>
                      </span>
                    </label>

                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-line text-brand-600 focus:ring-brand-600"
                          checked={authConfig.includeCodeExpiration}
                          onChange={(e) => handleAuthConfigChange('includeCodeExpiration', e.target.checked)}
                        />
                        <span className="text-sm text-ink">Include code expiration footer</span>
                      </label>
                      {authConfig.includeCodeExpiration && (
                        <div className="ml-6">
                          <label className="mb-1.5 block text-xs font-medium text-ink-500">
                            Expiration (minutes, 1–90)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={authConfig.codeExpirationMinutes}
                            onChange={(e) => handleAuthConfigChange('codeExpirationMinutes', e.target.value)}
                            className={`${fieldClass} w-32`}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>OTP button type</label>
                      <SearchableSelect
                        value={authConfig.otpType}
                        onChange={(e) => handleAuthConfigChange('otpType', e.target.value)}
                        options={[{ value: 'COPY_CODE', label: 'Copy Code' }]}
                        className={fieldClass}
                      />
                      <p className="mt-1.5 text-xs text-ink-400">
                        ONE_TAP and ZERO_TAP require Android app package configuration in Meta Business Manager.
                      </p>
                    </div>

                    <div>
                      <label className={labelClass}>
                        Copy code button label <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={authConfig.otpButtonText}
                        onChange={(e) => handleAuthConfigChange('otpButtonText', e.target.value)}
                        className={fieldClass}
                        placeholder="e.g. Copy code"
                        maxLength={25}
                        required
                      />
                    </div>
                  </div>
                )}
              </section>

              {!isAuthentication && (
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
                      <label className={labelClass}>Header text</label>
                      <input
                        type="text"
                        value={formData.components.header.text}
                        onChange={(e) => handleHeaderTextChange(e.target.value)}
                        className={fieldClass}
                        placeholder="Header text"
                        maxLength={60}
                      />
                      <p className="mt-1.5 text-xs text-ink-400">
                        {formData.components.header.text.length}/60 characters. Variables are not allowed in header text.
                      </p>
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
                        title={`Add variable {{${getNextVariableNumber()}}}`}
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
                      onChange={handleBodyInputChange}
                      onKeyDown={handleBodyKeyDown}
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
                              required
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
              )}

              {!isAuthentication && (
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
              )}
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
                  authConfig={authConfig}
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
                Template Created Successfully!
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
                    <div className="flex justify-between">
                      <span className="text-gray-600">Language:</span>
                      <span className="font-medium">{successData.language_code}</span>
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

      {/* AI Template Modal */}
      <AiTemplateModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onApplyTemplate={handleApplyAiTemplate}
        projectId={(() => {
          const ud = JSON.parse(localStorage.getItem('userData') || '{}');
          return ud.selected_project_id || ud.projects?.[0]?.project_id;
        })()}
        tokens={JSON.parse(localStorage.getItem('userData') || '{}')}
      />

      {/* Error Message Modal */}
      <AnimatedModal open={errorMessage}>
        {errorMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-center mb-4">
                <FiAlertCircle className="text-red-500 text-4xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Template Creation Failed
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

export default TemplateAdd;
