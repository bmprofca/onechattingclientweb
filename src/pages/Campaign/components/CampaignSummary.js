import React, { useState } from 'react';
import { API_BASE_URL } from '../../../config/api';
import axios from 'axios';
import { Encrypt } from '../../encryption/payload-encryption';
import { Send, ChevronRight, Calendar, Clock } from 'lucide-react';
import { canProceed, getAudienceSummary } from '../utils/campaignHelpers';
import DateTimePicker from './DateTimePicker';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function CampaignSummary({
  activeTab,
  setActiveTab,
  audienceType,
  selectedContacts,
  isSelectAllContacts = false,
  selectedGroups,
  selectedSegmentId = '',
  excelMapping,
  sheetLink,
  selectedTemplate,
  variableValues,
  variableSources = {},
  campaignName,
  setCampaignName,
  scheduleDate,
  setScheduleDate,
  excelHeaders = [],
  excelData = [],
  excelFileUrl = '',
  selectedContactDetails = [],
  headerMediaUrl = '',
  tokens
}) {
  const [isScheduled, setIsScheduled] = useState(false);
  const navigate = useNavigate();

  const handleProceed = () => {
    if (activeTab === 'audience') {
      setActiveTab('template');
    }
  };

  // Helper function to format datetime for backend (YYYY-MM-DD HH:mm:ss)
  const formatScheduleDate = (dateTimeLocal) => {
    if (!dateTimeLocal) return null;
    // dateTimeLocal is in format: "2026-01-15T18:30"
    // Convert to: "2026-01-15 18:30:00"
    const [date, time] = dateTimeLocal.split('T');
    return `${date} ${time}:00`;
  };

  // Helper function to get minimum datetime (current time + 5 minutes)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const campaignCreateUrl = `${API_BASE_URL}/campaign/create`;

  /**
   * Build complete component array for campaign API (header + body).
   * Passes full template structure - header (media or text), body.
   * Uses headerMediaUrl for media header, or template's default example link.
   */
  const buildFormattedComponents = (getParamText) => {
    const formattedComponents = [];
    const templateComponents = selectedTemplate?.template_data?.components || [];

    // HEADER component
    const headerComponent = templateComponents.find((c) => c.type === 'HEADER');
    if (headerComponent) {
      const headerFormat = (headerComponent.format || 'NONE').toUpperCase();
      if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
        const link = headerMediaUrl || headerComponent?.example?.header_handle?.[0] || '';
        if (link) {
          const mediaType = headerFormat.toLowerCase();
          formattedComponents.push({
            type: 'header',
            parameters: [{ type: mediaType, [mediaType]: { link } }]
          });
        }
      } else if (headerFormat === 'TEXT' && headerComponent.text) {
        const variableMatches = headerComponent.text.match(/\{\{\d+\}\}/g) || [];
        if (variableMatches.length > 0) {
          const parameters = variableMatches.map((match) => {
            const varNum = match.match(/\d+/)?.[0];
            const varName = `var_${varNum}`;
            const source = variableSources[varName];
            const text = getParamText(varName, source);
            return { type: 'text', text };
          });
          formattedComponents.push({ type: 'header', parameters });
        }
      }
    }

    // BODY component - always include
    const bodyComponent = templateComponents.find((c) => c.type === 'BODY');
    if (bodyComponent?.text) {
      const variableMatches = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
      const parameters = variableMatches.map((match) => {
        const varNum = match.match(/\d+/)?.[0];
        const varName = `var_${varNum}`;
        const source = variableSources[varName];
        const text = getParamText(varName, source);
        return { type: 'text', text };
      });
      formattedComponents.push({ type: 'body', parameters });
    }

    return formattedComponents;
  };

  const handleLaunchCampaign = async () => {
    if (!tokens?.token || !tokens?.username) {
      alert('You must be signed in to launch a campaign.');
      return;
    }
    if (!selectedTemplate?.id) {
      alert('Please select a template.');
      return;
    }
    if (!campaignName || campaignName.trim() === '') {
      alert('Please enter a campaign name.');
      return;
    }

    const headerComponent = selectedTemplate?.template_data?.components?.find((c) => c.type === 'HEADER');
    const requiresHeaderMedia = headerComponent && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComponent?.format);
    const headerLink = headerMediaUrl || headerComponent?.example?.header_handle?.[0];
    if (requiresHeaderMedia && !headerLink) {
      alert('Please upload header media or ensure the template has a default media link.');
      return;
    }

    // Handle Contact campaigns
    if (audienceType === 'contacts') {
      try {
        let phoneNumbers = [];

        if (!isSelectAllContacts) {
          if (!selectedContacts || selectedContacts.length === 0) {
            alert('Please select at least one contact.');
            return;
          }

          if (!selectedContactDetails || selectedContactDetails.length === 0) {
            alert('Contact details are missing. Please reselect your contacts.');
            return;
          }

          // Extract phone numbers from selected contacts
          phoneNumbers = selectedContactDetails
            .map(contact => contact?.number || contact?.phone)
            .filter(phone => phone && phone.trim() !== '');

          if (phoneNumbers.length === 0) {
            alert('No valid phone numbers found in selected contacts.');
            return;
          }
        }

        const getContactVariableName = (varName, source) => {
          if (source?.type === 'contact') {
            const keyMap = {
              'contact.name': 'name', 'contact.number': 'number', 'contact.firm_name': 'firm_name',
              'contact.website': 'website', 'contact.email': 'email',
              'contact.current_date': 'current_date', 'contact.current_time': 'current_time', 'contact.current_day': 'current_day'
            };
            return keyMap[source.key] || null;
          }
          const manualValue = variableValues[varName] || '';
          if (manualValue.trim() === '') return null;
          const lowerValue = manualValue.toLowerCase();
          if (lowerValue.includes('current_date') || lowerValue.includes('date')) return 'current_date';
          if (lowerValue.includes('current_time') || lowerValue.includes('time')) return 'current_time';
          if (lowerValue.includes('current_day') || lowerValue.includes('day')) return 'current_day';
          return null;
        };

        const getParamText = (varName, source) => {
          const contactVarName = getContactVariableName(varName, source);
          if (contactVarName) return `{{${contactVarName}}}`;
          return variableValues[varName] || '';
        };

        const formattedComponents = buildFormattedComponents(getParamText);

        const payload = {
          numbers: phoneNumbers,
          is_select_all: isSelectAllContacts === true,
          name: campaignName,
          template_id: selectedTemplate.id,
          project_id: tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '',
          component: formattedComponents
        };

        // Add schedule_date if scheduled
        if (isScheduled && scheduleDate) {
          payload.schedule_date = formatScheduleDate(scheduleDate);
        }

        console.log('Contact Campaign Payload (before encryption):', payload);

        // Encrypt payload before sending
        const { data, key } = Encrypt(payload);
        const data_pass = JSON.stringify({ data, key });

        const endpoint = `${campaignCreateUrl}/contact`;

        const response = await axios.post(
          endpoint,
          data_pass,
          {
            headers: {
              token: tokens.token,
              username: tokens.username,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response?.data?.error) {
          throw new Error(response?.data?.message || 'Failed to create contact campaign');
        }

        toast.success(`Contact campaign "${campaignName}" created successfully!`, {
          duration: 4000,
          icon: '🎉',
          style: {
            background: '#10b981',
            color: 'white',
            fontWeight: '600'
          }
        });

        // Redirect to campaign list after a short delay
        setTimeout(() => {
          navigate('/campaigns');
        }, 2000);
      } catch (err) {
        console.error('Failed to create contact campaign:', err);
        alert(err?.message || 'Failed to create contact campaign');
      }
      return;
    }

    // Handle Group campaigns
    if (audienceType === 'groups') {
      try {
        if (!selectedGroups || selectedGroups.length === 0) {
          alert('Please select at least one group.');
          return;
        }

        const groupIds = selectedGroups;

        const getContactVariableName = (varName, source) => {
          if (source?.type === 'contact') {
            const keyMap = {
              'contact.name': 'name', 'contact.number': 'number', 'contact.firm_name': 'firm_name',
              'contact.website': 'website', 'contact.email': 'email',
              'contact.current_date': 'current_date', 'contact.current_time': 'current_time', 'contact.current_day': 'current_day'
            };
            return keyMap[source.key] || null;
          }
          const manualValue = variableValues[varName] || '';
          if (manualValue.trim() === '') return null;
          const lowerValue = manualValue.toLowerCase();
          if (lowerValue.includes('current_date') || lowerValue.includes('date')) return 'current_date';
          if (lowerValue.includes('current_time') || lowerValue.includes('time')) return 'current_time';
          if (lowerValue.includes('current_day') || lowerValue.includes('day')) return 'current_day';
          return null;
        };

        const getParamText = (varName, source) => {
          const contactVarName = getContactVariableName(varName, source);
          if (contactVarName) return `{{${contactVarName}}}`;
          return variableValues[varName] || '';
        };

        const formattedComponents = buildFormattedComponents(getParamText);

        const payload = {
          group_ids: groupIds,
          name: campaignName,
          template_id: selectedTemplate.id,
          project_id: tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '',
          component: formattedComponents
        };

        // Add schedule_date if scheduled
        if (isScheduled && scheduleDate) {
          payload.schedule_date = formatScheduleDate(scheduleDate);
        }

        console.log('Group Campaign Payload (before encryption):', payload);

        const { data, key } = Encrypt(payload);
        const data_pass = JSON.stringify({ data, key })
        const endpoint = `${campaignCreateUrl}/group`;

        const response = await axios.post(
          endpoint,
          data_pass,
          {
            headers: {
              token: tokens.token,
              username: tokens.username,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response?.data?.error) {
          throw new Error(response?.data?.message || 'Failed to create group campaign');
        }

        toast.success(`Group campaign "${campaignName}" created successfully!`, {
          duration: 4000,
          icon: '🎉',
          style: {
            background: '#10b981',
            color: 'white',
            fontWeight: '600'
          }
        });

        // Redirect to campaign list after a short delay
        setTimeout(() => {
          navigate('/campaigns');
        }, 2000);
      } catch (err) {
        console.error('Failed to create group campaign:', err);
        alert(err?.message || 'Failed to create group campaign');
      }
      return;
    }

    if (audienceType === 'segment') {
      try {
        if (!selectedSegmentId) {
          alert('Please select a dynamic segment.');
          return;
        }
        const formattedComponents = buildFormattedComponents((varName, source) => {
          if (source?.type === 'contact' && source.key) {
            return `{{${String(source.key).replace(/^contact\./, '')}}}`;
          }
          return variableValues[varName] || '';
        });
        const payload = {
          segment_id: selectedSegmentId,
          name: campaignName,
          template_id: selectedTemplate.id,
          project_id: tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '',
          component: formattedComponents,
          ...(isScheduled && scheduleDate ? { schedule_date: formatScheduleDate(scheduleDate) } : {}),
        };
        const { data, key } = Encrypt(payload);
        const response = await axios.post(
          `${campaignCreateUrl}/segment`,
          JSON.stringify({ data, key }),
          { headers: { token: tokens.token, username: tokens.username, 'Content-Type': 'application/json' } }
        );
        if (response?.data?.error) throw new Error(response.data.message || response.data.error);
        toast.success(`Segment campaign "${campaignName}" created successfully!`);
        setTimeout(() => navigate('/campaigns'), 2000);
      } catch (error) {
        console.error('Failed to create dynamic-segment campaign:', error);
        alert(error?.response?.data?.error || error?.message || 'Failed to create segment campaign');
      }
      return;
    }

    // Handle Excel and Google Sheet campaigns (same logic, different endpoints)
    if (audienceType === 'excel' || audienceType === 'sheet') {
      try {
        // Derive phone column index (1-based) from selected mapping
        const phoneIndex =
          excelMapping?.phone && Array.isArray(excelHeaders)
            ? excelHeaders.indexOf(excelMapping.phone)
            : 0;

        if (!phoneIndex || phoneIndex < 1) {
          const sourceType = audienceType === 'excel' ? 'Excel' : 'Google Sheet';
          alert(`Please map the phone number column in your ${sourceType}.`);
          return;
        }

        // Determine URL and validate based on audience type
        let fileUrl;
        if (audienceType === 'excel') {
          fileUrl = excelFileUrl || sheetLink;
          if (!fileUrl || !fileUrl.startsWith('http')) {
            alert('Please upload an Excel file first. The file needs to be uploaded to the server before creating a campaign.');
            return;
          }
        } else {
          // Google Sheet
          if (!sheetLink || !sheetLink.trim()) {
            alert('Please provide a Google Sheet link.');
            return;
          }
          fileUrl = sheetLink.trim();
        }

        // Compute start/end rows (1-based indexing)
        // startRow = 1 (first data row after header)
        // endRow = last data row index (1-based)
        // Example: 4 data rows means rows 1, 2, 3, 4 -> endRow = 4
        const startRow = 1;
        const endRow = Array.isArray(excelData) && excelData.length > 0 ? excelData.length : 1;

        const getParamText = (varName, source) => {
          if (source?.type === 'excel' && source?.key) {
            const excelColumnIndex = excelHeaders.indexOf(source.key);
            if (excelColumnIndex >= 0) return `{{${excelColumnIndex}}}`;
            return '';
          }
          return variableValues[varName] || '';
        };

        const formattedComponents = buildFormattedComponents(getParamText);

        const payload = {
          url: fileUrl,
          phone_index: phoneIndex.toString(),
          start_row: startRow.toString(),
          end_row: endRow.toString(),
          component: formattedComponents,
          name: campaignName,
          template_id: selectedTemplate.id,
          project_id: tokens?.selected_project_id || tokens?.projects?.[0]?.project_id || '',
          source: 'excel'
        };

        // Add schedule_date if scheduled
        if (isScheduled && scheduleDate) {
          payload.schedule_date = formatScheduleDate(scheduleDate);
        }

        console.log(`${audienceType === 'excel' ? 'Excel' : 'Google Sheet'} Campaign Payload (before encryption):`, payload);

        // TEMPORARY: Send unencrypted data for testing (backend has Decrypt commented out)
        // TODO: Remove this and uncomment the encrypted version once backend Decrypt is fixed
        //const data_pass = JSON.stringify(payload);

        // ORIGINAL ENCRYPTED VERSION (commented out temporarily):
        const { data, key } = Encrypt(payload);
        const data_pass = JSON.stringify({ data, key });
        // console.log('Encrypted data being sent:', { data: data.substring(0, 50) + '...', key: key.substring(0, 50) + '...' });

        // Determine endpoint based on audience type
        const endpoint = `${campaignCreateUrl}/${audienceType === 'excel' ? 'excel' : 'excel'}`;
        const sourceType = audienceType === 'excel' ? 'Excel' : 'Google Sheet';

        const response = await axios.post(
          endpoint,
          data_pass,
          {
            headers: {
              token: tokens.token,
              username: tokens.username,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response?.data?.error) {
          throw new Error(response?.data?.message || `Failed to create ${sourceType} campaign`);
        }

        toast.success(`${sourceType} campaign "${campaignName}" created successfully!`, {
          duration: 4000,
          icon: '🎉',
          style: {
            background: '#10b981',
            color: 'white',
            fontWeight: '600'
          }
        });

        // Redirect to campaign list after a short delay
        setTimeout(() => {
          navigate('/campaigns');
        }, 2000);
      } catch (err) {
        const sourceType = audienceType === 'excel' ? 'Excel' : 'Google Sheet';
        console.error(`Failed to create ${sourceType} campaign:`, err);
        alert(err?.message || `Failed to create ${sourceType} campaign`);
      }
      return;
    }

    // Fallback for other audience types (not implemented yet)
    console.log('Launching campaign (non-excel)...', {
      audienceType,
      selectedContacts,
      selectedGroups,
      selectedTemplate,
      campaignName
    });
  };

  const proceedEnabled = canProceed(
    activeTab,
    audienceType,
    selectedContacts,
    selectedGroups,
    excelMapping,
    sheetLink,
    selectedTemplate,
    variableValues,
    { isSelectAllContacts, selectedSegmentId }
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-6">
      <h3 className="font-semibold text-gray-800 mb-4">Campaign Summary</h3>

      <div className="space-y-4">
        <div>
          <div className="text-sm text-gray-500">Audience</div>
          <div className="font-medium text-gray-800">
            {getAudienceSummary(audienceType, selectedContacts, selectedGroups, excelMapping, sheetLink, { isSelectAllContacts, selectedSegmentId })}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500">Template</div>
          <div className="font-medium text-gray-800">
            {selectedTemplate ? selectedTemplate.name : 'Not selected'}
          </div>
        </div>

        {activeTab === 'template' && (
          <>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Campaign Name</label>
              <input
                type="text"
                value={campaignName || ''}
                onChange={(e) => setCampaignName?.(e.target.value)}
                placeholder="Enter a campaign name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Schedule Campaign Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <label className="text-sm font-medium text-gray-700">Schedule Campaign</label>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => {
                      setIsScheduled(e.target.checked);
                      if (!e.target.checked) {
                        setScheduleDate?.('');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Campaign will be automatically sent at the scheduled time in your local timezone.</span>
                  </div>
                  <DateTimePicker
                    selectedDate={scheduleDate}
                    onChange={(date) => setScheduleDate?.(date)}
                    minDate={getMinDateTime()}
                    placeholder="Select launch date and time"
                  />
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t pt-4">
          {activeTab === 'audience' && (
            <button
              onClick={handleProceed}
              disabled={!proceedEnabled}
              className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${proceedEnabled
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-500 text-white hover:from-indigo-600 hover:to-indigo-600 shadow-lg hover:shadow-xl'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              Next: Choose Template
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {activeTab === 'template' && (
            <div className="space-y-3">
              <button
                onClick={() => setActiveTab('audience')}
                className="w-full py-3 rounded-lg font-semibold border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
              >
                Back to Audience
              </button>
              <button
                onClick={handleLaunchCampaign}
                disabled={!proceedEnabled || !campaignName || campaignName.trim() === '' || (isScheduled && !scheduleDate)}
                className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${proceedEnabled && campaignName && campaignName.trim() !== '' && (!isScheduled || scheduleDate)
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-500 text-white hover:from-indigo-600 hover:to-indigo-600 shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {isScheduled ? (
                  <>
                    <Calendar className="w-5 h-5" />
                    Schedule Campaign
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Launch Campaign
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}