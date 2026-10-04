import React, { useState, useEffect } from 'react';
import { Phone, User, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { extractContacts } from '../../utils/excelParser';
import SearchableSelect from '../../../../component/SearchableSelect';

export default function GoogleSheet({ 
  sheetLink, 
  setSheetLink, 
  excelMapping, 
  setExcelMapping,
  onContactsExtracted,
  onHeadersExtracted,
  onDataExtracted
}) {
  const [headers, setHeaders] = useState([]);
  const [sheetData, setSheetData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Extract sheet ID from Google Sheets URL
  const extractSheetId = (url) => {
    if (!url) return null;
    
    // Handle different Google Sheets URL formats
    // Format 1: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
    // Format 2: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit#gid={GID}
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  };

  // Extract GID from URL if present
  const extractGid = (url) => {
    if (!url) return '0';
    const match = url.match(/[#&]gid=(\d+)/);
    return match ? match[1] : '0';
  };

  // Convert Google Sheets URL to CSV export URL
  const getCsvExportUrl = (url) => {
    const sheetId = extractSheetId(url);
    if (!sheetId) return null;
    
    const gid = extractGid(url);
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  };

  // Parse CSV data from Google Sheets
  const parseGoogleSheet = async (csvUrl) => {
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure it is publicly accessible.');
      }
      
      const csvText = await response.text();
      if (!csvText || csvText.trim().length === 0) {
        throw new Error('Google Sheet is empty');
      }

      // Parse CSV using XLSX library
      const workbook = XLSX.read(csvText, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) {
        throw new Error('Google Sheet is empty');
      }
      
      // First row contains headers
      const fileHeaders = jsonData[0].map(h => String(h || '').trim()).filter(h => h);
      
      if (fileHeaders.length === 0) {
        throw new Error('No headers found in the Google Sheet');
      }
      
      // Rest of the rows contain data
      const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));
      
      // Convert rows to objects with headers as keys
      const parsedData = rows.map(row => {
        const obj = {};
        fileHeaders.forEach((header, index) => {
          obj[header] = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : '';
        });
        return obj;
      });
      
      return { headers: fileHeaders, data: parsedData };
    } catch (err) {
      throw new Error(`Failed to parse Google Sheet: ${err.message}`);
    }
  };

  // Handle sheet link change
  const handleSheetLinkChange = async (url) => {
    setSheetLink(url);
    setError('');
    setSuccess('');
    setHeaders([]);
    setSheetData([]);
    
    if (!url || url.trim() === '') {
      return;
    }

    const csvUrl = getCsvExportUrl(url);
    if (!csvUrl) {
      setError('Invalid Google Sheets URL. Please use a valid Google Sheets link.');
      return;
    }

    setIsLoading(true);
    try {
      const { headers: fileHeaders, data } = await parseGoogleSheet(csvUrl);
      
      setHeaders(fileHeaders);
      setSheetData(data);
      setSuccess(`Google Sheet loaded successfully! Found ${data.length} rows.`);
      
      // Notify parent component about headers
      if (onHeadersExtracted) {
        onHeadersExtracted(fileHeaders);
      }
      
      // Notify parent component about data
      if (onDataExtracted) {
        onDataExtracted(data);
      }
      
      // Reset mapping if headers changed
      if (!fileHeaders.includes(excelMapping.phone) || !fileHeaders.includes(excelMapping.name)) {
        setExcelMapping({ phone: '', name: '' });
      }
    } catch (err) {
      setError(err.message || 'Failed to load Google Sheet');
      setHeaders([]);
      setSheetData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle column mapping change
  const handleColumnMappingChange = (field, value) => {
    const newMapping = { ...excelMapping, [field]: value };
    setExcelMapping(newMapping);
    
    // Extract contacts when both columns are selected
    if (newMapping.phone && newMapping.name && sheetData.length > 0) {
      const contacts = extractContacts(sheetData, newMapping.phone, newMapping.name);
      if (onContactsExtracted) {
        onContactsExtracted(contacts);
      }
      if (contacts.length > 0) {
        setSuccess(`Extracted ${contacts.length} contacts successfully!`);
        setError('');
      } else {
        setError('No valid contacts found with the selected columns');
        setSuccess('');
      }
    }
  };

  // Extract contacts when mapping changes
  useEffect(() => {
    if (excelMapping.phone && excelMapping.name && sheetData.length > 0) {
      const contacts = extractContacts(sheetData, excelMapping.phone, excelMapping.name);
      if (onContactsExtracted) {
        onContactsExtracted(contacts);
      }
    }
  }, [excelMapping, sheetData, onContactsExtracted]);

  // Update parent when data changes
  useEffect(() => {
    if (sheetData.length > 0 && onDataExtracted) {
      onDataExtracted(sheetData);
    }
  }, [sheetData, onDataExtracted]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Sheet Link
        </label>
        <div className="relative">
          <input
            type="url"
            value={sheetLink}
            onChange={(e) => handleSheetLinkChange(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Make sure the sheet is publicly accessible (Anyone with the link can view)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {headers.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-gray-700 mb-4">Map Your Columns</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number Column
              </label>
              <SearchableSelect
                value={excelMapping.phone}
                onChange={(e) => handleColumnMappingChange('phone', e.target.value)}
                options={[{ value: '', label: 'Select a column...' }, ...headers.map((header) => ({ value: header, label: header }))]}
                placeholder="Select a column..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Name Column
              </label>
              <SearchableSelect
                value={excelMapping.name}
                onChange={(e) => handleColumnMappingChange('name', e.target.value)}
                options={[{ value: '', label: 'Select a column...' }, ...headers.map((header) => ({ value: header, label: header }))]}
                placeholder="Select a column..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {excelMapping.phone && excelMapping.name && sheetData.length > 0 && (() => {
        const contacts = extractContacts(sheetData, excelMapping.phone, excelMapping.name);
        if (contacts.length > 0) {
          return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-700">
                ✓ Successfully mapped columns. {contacts.length} contact{contacts.length !== 1 ? 's' : ''} ready for campaign.
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

