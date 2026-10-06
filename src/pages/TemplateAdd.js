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
  FiLink,
  FiPhone,
  FiMessageSquare,
  FiCopy,
  FiMapPin,
  FiBold,
  FiItalic,
  FiUnderline,
  FiCode,
  FiTrash2,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';
import WhatsAppPreview from '../component/TemplateAdd/WhatsAppPreview';
import AiTemplateModal from '../component/Modals/AiTemplateModal';
import { RiSparklingFill } from 'react-icons/ri';
import { useLocation } from 'react-router-dom';
import { uploadFile } from '../utils/uploadFile';

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
    { type: 'QUICK_REPLY', label: 'Quick Reply', icon: <FiMessageSquare /> },
    { type: 'PHONE_NUMBER', label: 'Phone Number', icon: <FiPhone /> },
    { type: 'URL', label: 'URL', icon: <FiLink /> },
    // { type: 'COPY_CODE', label: 'Copy Code', icon: <FiCopy /> }
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
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Create New WhatsApp Template</h2>
            <p className="mt-1 text-sm text-gray-600">
              Create a new WhatsApp message template following Aisensy API structure
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form section */}
            <div className="bg-white shadow rounded-lg p-6">
              <form onSubmit={handleSubmit}>
                {/* AI Assistant Banner */}
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-indigo-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-amber-300 shadow-sm flex-shrink-0">
                      <RiSparklingFill className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">AI Template Assistant</h4>
                      <p className="text-xs text-indigo-800/80">Need ideas? Describe your campaign and AI will build the template.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiModalOpen(true)}
                    className="text-xs font-bold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    Open AI
                  </button>
                </div>
                {/* Template Name */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${formData.name.trim() ? 'border-green-400' : 'border-gray-300'
                      }`}
                    required
                    placeholder="e.g., welcome_message"
                  />
                  <p className="mt-1 text-xs text-indigo-600 font-medium">
                    ✓ Automatically converted to lowercase (use underscores for spaces)
                  </p>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    options={[{ value: '', label: 'Select a category' }, ...categories.map((cat) => ({ value: cat.code, label: cat.name }))]}
                    placeholder="Select a category"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${formData.category ? 'border-green-400' : 'border-gray-300'}`}
                  />
                </div>

                {/* Language */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                    options={[{ value: '', label: 'Select a language' }, ...languages.map((lang) => ({ value: lang.code, label: lang.name }))]}
                    placeholder="Select a language"
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${formData.language ? 'border-green-400' : 'border-gray-300'}`}
                  />
                </div>

                {isAuthentication && (
                  <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-indigo-900">Authentication Template Settings</h3>
                      <p className="mt-1 text-xs text-indigo-700">
                        Meta uses a fixed OTP message format. The verification code is supplied as {'{{1}}'} when you send the message.
                      </p>
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={authConfig.addSecurityRecommendation}
                        onChange={(e) => handleAuthConfigChange('addSecurityRecommendation', e.target.checked)}
                      />
                      <span className="text-sm text-gray-700">
                        Add security recommendation
                        <span className="block text-xs text-gray-500">Appends &quot;For your security, do not share this code.&quot;</span>
                      </span>
                    </label>

                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={authConfig.includeCodeExpiration}
                          onChange={(e) => handleAuthConfigChange('includeCodeExpiration', e.target.checked)}
                        />
                        <span className="text-sm text-gray-700">Include code expiration footer</span>
                      </label>
                      {authConfig.includeCodeExpiration && (
                        <div className="ml-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Expiration (minutes, 1–90)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={authConfig.codeExpirationMinutes}
                            onChange={(e) => handleAuthConfigChange('codeExpirationMinutes', e.target.value)}
                            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        OTP Button Type
                      </label>
                      <SearchableSelect
                        value={authConfig.otpType}
                        onChange={(e) => handleAuthConfigChange('otpType', e.target.value)}
                        options={[{ value: 'COPY_CODE', label: 'Copy Code' }]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        ONE_TAP and ZERO_TAP require Android app package configuration in Meta Business Manager.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Copy Code Button Label <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={authConfig.otpButtonText}
                        onChange={(e) => handleAuthConfigChange('otpButtonText', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${authConfig.otpButtonText.trim() ? 'border-green-400' : 'border-gray-300'}`}
                        placeholder="e.g., Copy code"
                        maxLength={25}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Header Format */}
                {!isAuthentication && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Header Format
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {headerFormats.map(format => (
                        <button
                          key={format.code}
                          type="button"
                          onClick={() => handleHeaderFormatChange(format.code)}
                          className={`p-2 border rounded-md text-sm text-center ${formData.components.header.format === format.code
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                          {format.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Header Content based on format */}
                {!isAuthentication && formData.components.header.format !== 'NONE' && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Header Content ({formData.components.header.format})
                    </label>

                    {formData.components.header.format === 'TEXT' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Header Text</span>
                        </div>
                        <textarea
                          rows={2}
                          value={formData.components.header.text}
                          onChange={(e) => handleHeaderTextChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="Enter header text (no variables allowed)"
                          maxLength={60}
                        />
                        <p className="text-xs text-gray-500">
                          {formData.components.header.text.length}/60 characters. Variables are not allowed in header text.
                        </p>
                      </div>
                    )}

                    {(formData.components.header.format === 'IMAGE' || formData.components.header.format === 'VIDEO' || formData.components.header.format === 'DOCUMENT') && (
                      <div>
                        {formData.components.header.example.header_handle && formData.components.header.example.header_handle.length > 0 ? (
                          <div className="flex items-center justify-between p-2 bg-white border rounded-md">
                            <div className="flex items-center">
                              <FiPaperclip className="text-gray-500 mr-2" />
                              <span className="text-sm truncate">
                                {formData.components.header.example.header_handle[0].split('/').pop()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleHeaderFormatChange('NONE')}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <FiX />
                            </button>
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-md ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-gray-400'}`}>
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              {isUploading ? (
                                <>
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                                  <p className="text-sm text-gray-500">Uploading...</p>
                                </>
                              ) : (
                                <>
                                  <FiPaperclip className="w-8 h-8 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500">Click to upload {formData.components.header.format.toLowerCase()}</p>
                                  <p className="text-xs text-gray-400">MAX. 5MB</p>
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
                  </div>
                )}

                {/* Body Content */}
                {!isAuthentication && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        Body Content <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={addBodyVariable}
                        className="flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-200 transition-colors font-medium"
                        title={`Add variable {{${getNextVariableNumber()}}}`}
                      >
                        <FiPlus size={12} />
                        Add Variable {`{{${getNextVariableNumber()}}}`}
                      </button>
                    </div>
                    <textarea
                      ref={textareaRef}
                      rows={4}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${formData.components.body.text.trim() ? 'border-green-400' : 'border-gray-300'
                        }`}
                      placeholder="Enter your message content here. Use {{1}} for variables."
                      value={formData.components.body.text}
                      onChange={handleBodyInputChange}
                      onKeyDown={handleBodyKeyDown}
                      required
                    ></textarea>

                    {/* Text formatting toolbar */}
                    <div className="mt-2 flex space-x-2">
                      <button
                        type="button"
                        onClick={() => applyFormatting('bold')}
                        className="p-1.5 rounded border border-gray-300 hover:bg-gray-100"
                        title="Bold"
                      >
                        <FiBold size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('italic')}
                        className="p-1.5 rounded border border-gray-300 hover:bg-gray-100"
                        title="Italic"
                      >
                        <FiItalic size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('underline')}
                        className="p-1.5 rounded border border-gray-300 hover:bg-gray-100"
                        title="Strikethrough"
                      >
                        <FiUnderline size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyFormatting('code')}
                        className="p-1.5 rounded border border-gray-300 hover:bg-gray-100"
                        title="Monospace"
                      >
                        <FiCode size={16} />
                      </button>
                    </div>


                    {/* Body Variables */}
                    {bodyVariables.length > 0 && (
                      <div className="mt-3 space-y-3">
                        {bodyVariables.map((variable, index) => (
                          <div key={variable.id} className="p-3 bg-gray-50 border border-gray-200 rounded-md hover:border-indigo-300 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">
                                  {`{{${index + 1}}}`}
                                </span>
                                <span className="text-sm font-medium text-gray-700">
                                  {variable.name}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeBodyVariable(variable.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                title="Remove variable"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder={`Sample value for {{${index + 1}}}`}
                              className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${variable.sample && variable.sample.trim() !== ''
                                ? 'border-green-400 bg-green-50'
                                : 'border-gray-300 bg-white'
                                }`}
                              value={variable.sample}
                              onChange={e => updateBodyVariable(variable.id, e.target.value)}
                              required
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              This value will replace <span className="font-mono text-indigo-600">{`{{${index + 1}}}`}</span> in the message preview
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                {!isAuthentication && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Footer Text
                    </label>
                    <input
                      type="text"
                      value={formData.components.footer.text}
                      onChange={(e) => handleFooterTextChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Optional footer text"
                      maxLength={60}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.components.footer.text.length}/60 characters
                    </p>
                  </div>
                )}

                {/* Buttons */}
                {!isAuthentication && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Buttons
                      </label>
                      <span className="text-sm text-gray-500">
                        {formData.components.buttons.buttons.length}/3 added
                      </span>
                    </div>

                    {/* Button selection */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {buttonTypes.map(btn => (
                        <button
                          key={btn.type}
                          type="button"
                          onClick={() => addButton(btn.type)}
                          disabled={formData.components.buttons.buttons.length >= 3}
                          className="flex items-center justify-center p-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="mr-1">{btn.icon}</span>
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* Added buttons */}
                    <div className="space-y-3">
                      {formData.components.buttons.buttons.map((btn, index) => (
                        <div key={index} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              {buttonTypes.find(b => b.type === btn.type)?.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeButton(index)}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <FiX size={16} />
                            </button>
                          </div>

                          {/* Button Text */}
                          <input
                            type="text"
                            placeholder="Button text"
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2"
                            value={btn.text}
                            onChange={e => updateButton(index, 'text', e.target.value)}
                          />

                          {/* Phone Number Button */}
                          {btn.type === 'PHONE_NUMBER' && (
                            <input
                              type="tel"
                              placeholder="Phone number (e.g., 917089379345)"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={btn.phone_number}
                              onChange={e => updateButton(index, 'phone_number', e.target.value)}
                            />
                          )}

                          {/* URL Button */}
                          {btn.type === 'URL' && (
                            <div className="space-y-2">
                              <input
                                type="url"
                                placeholder="URL (e.g., https://example.com/{{1}})"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={btn.url}
                                onChange={e => updateButton(index, 'url', e.target.value)}
                              />
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">URL Examples:</span>
                                <button
                                  type="button"
                                  onClick={() => addButtonUrlExample(index)}
                                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                >
                                  + Add Example
                                </button>
                              </div>
                              {btn.example?.map((example, exIndex) => (
                                <div key={exIndex} className="flex gap-2">
                                  <input
                                    type="url"
                                    placeholder="Example URL"
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    value={example}
                                    onChange={e => updateButtonUrlExample(index, exIndex, e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeButtonUrlExample(index, exIndex)}
                                    className="px-2 text-red-500 hover:text-red-700"
                                  >
                                    <FiX size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Copy Code Button */}
                          {/* {btn.type === 'COPY_CODE' && (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-600 mb-1">
                              This button will be converted to OTP format with type "otp" and otp_type "copy_code"
                            </p>
                            <input
                              type="text"
                              placeholder="Code to copy"
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={btn.copy_code}
                              onChange={e => updateButton(index, 'copy_code', e.target.value)}
                            />
                          </div>
                        )} */}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={isSubmitting || !isFormValid()}
                    className={`w-full py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:cursor-not-allowed ${isFormValid() && !isSubmitting
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </span>
                    ) : (
                      'Submit Template for Approval'
                    )}
                  </button>
                  {!isFormValid() && (
                    <p className="mt-2 text-sm text-red-600 text-center">
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
              </form>
            </div>

            {/*WhatsApp Preview section */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Template Preview</h3>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      Live
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

      {/* Success Popup Modal */}
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
    </div>
  );
}

export default TemplateAdd;
