/**
 * Validates if user can proceed to next step
 * @param {string} activeTab - Current active tab ('audience' or 'template')
 * @param {string} audienceType - Selected audience type
 * @param {Array} selectedContacts - Selected contact IDs
 * @param {Array} selectedGroups - Selected group IDs
 * @param {Object} excelMapping - Excel column mapping
 * @param {string} sheetLink - Google Sheet link
 * @param {Object} selectedTemplate - Selected template
 * @param {Object} variableValues - Template variable values
 * @returns {boolean} Whether user can proceed
 */
export const canProceed = (
  activeTab,
  audienceType,
  selectedContacts,
  selectedGroups,
  excelMapping,
  sheetLink,
  selectedTemplate,
  variableValues,
  options = {}
) => {
  const isSelectAllContacts = options?.isSelectAllContacts === true;

  if (activeTab === 'audience') {
    if (audienceType === 'contacts') return isSelectAllContacts || (selectedContacts?.length > 0);
    if (audienceType === 'excel') return excelMapping.name && excelMapping.phone;
    if (audienceType === 'sheet') return sheetLink.trim() !== '' && excelMapping.name && excelMapping.phone;
    if (audienceType === 'groups') return selectedGroups.length > 0;
    if (audienceType === 'segment') return Boolean(options?.selectedSegmentId);
    return false;
  }
  if (activeTab === 'template') {
    if (!selectedTemplate) return false;
    return selectedTemplate.variables.every(v => variableValues[v] && variableValues[v].trim() !== '');
  }
  return false;
};

/**
 * Gets audience summary text
 * @param {string} audienceType - Selected audience type
 * @param {Array} selectedContacts - Selected contact IDs
 * @param {Array} selectedGroups - Selected group IDs
 * @param {Object} excelMapping - Excel column mapping
 * @param {string} sheetLink - Google Sheet link
 * @returns {string} Summary text
 */
export const getAudienceSummary = (audienceType, selectedContacts, selectedGroups, excelMapping, sheetLink, options = {}) => {
  const isSelectAllContacts = options?.isSelectAllContacts === true;
  if (!audienceType) return 'Not selected';
  if (audienceType === 'contacts') return isSelectAllContacts ? 'All contacts' : `${selectedContacts.length} contacts`;
  if (audienceType === 'excel') return (excelMapping.phone && excelMapping.name ? 'Excel file mapped' : 'Mapping required');
  if (audienceType === 'sheet') return (sheetLink && excelMapping.phone && excelMapping.name ? 'Sheet connected' : 'Configuration required');
  if (audienceType === 'groups') return `${selectedGroups.length} groups`;
  if (audienceType === 'segment') return options?.selectedSegmentName || 'Dynamic segment';
  return 'Not selected';
};

