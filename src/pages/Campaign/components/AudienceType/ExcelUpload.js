import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../../../../config/api';
import { Upload, Phone, User, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import Pagination from '../../../../component/Pagination';
import axios from 'axios';
import { parseExcelFile, extractContacts } from '../../utils/excelParser';
import { uploadFile } from '../../../../utils/uploadFile';
import SearchableSelect from '../../../../component/SearchableSelect';

export default function ExcelUpload({
  excelMapping,
  setExcelMapping,
  onContactsExtracted,
  onHeadersExtracted,
  onDataExtracted,
  onFileUploaded,
  tokens
}) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [excelData, setExcelData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const fileInputRef = useRef(null);

  const uploadFileToServer = async (fileToUpload) => {
    if (!fileToUpload || !tokens?.token || !tokens?.username) {
      throw new Error('File or authentication tokens missing');
    }

    setIsUploading(true);
    try {
      const { link: fileUrl } = await uploadFile(fileToUpload);
      setUploadedFileUrl(fileUrl);

      if (onFileUploaded) {
        onFileUploaded(fileUrl);
      }

      return fileUrl;
    } catch (err) {
      console.error('File upload failed:', err);
      throw new Error(err?.response?.data?.message || err?.message || 'Failed to upload file to server');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0] || e.dataTransfer?.files?.[0];

    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
      setError('Please upload a valid Excel file (.xlsx, .xls, or .csv)');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setUploadedFileUrl(''); // Reset previous URL

    try {
      // First, parse the file locally to extract headers and data
      const { headers: fileHeaders, data } = await parseExcelFile(selectedFile);

      if (fileHeaders.length === 0) {
        throw new Error('No headers found in the Excel file');
      }

      setHeaders(fileHeaders);
      setExcelData(data);

      // Notify parent component about data
      if (onDataExtracted) {
        onDataExtracted(data);
      }

      // Then upload the file to the server
      try {
        await uploadFileToServer(selectedFile);
        setSuccess(`File uploaded successfully! Found ${data.length} rows.`);
      } catch (uploadErr) {
        setError(`File parsed but upload failed: ${uploadErr.message}`);
        // Still allow user to proceed with local data, but warn about upload failure
      }

      // Notify parent component about headers
      if (onHeadersExtracted) {
        onHeadersExtracted(fileHeaders);
      }

      // Reset mapping if headers changed
      if (!fileHeaders.includes(excelMapping.phone) || !fileHeaders.includes(excelMapping.name)) {
        setExcelMapping({ phone: '', name: '' });
      }
    } catch (err) {
      setError(err.message || 'Failed to parse Excel file');
      setFile(null);
      setFileName('');
      setHeaders([]);
      setExcelData([]);
      setUploadedFileUrl('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleColumnMappingChange = (field, value) => {
    const newMapping = { ...excelMapping, [field]: value };
    setExcelMapping(newMapping);

    // Reset to first page when mapping changes
    setCurrentPage(1);

    // Extract contacts when both columns are selected
    if (newMapping.phone && newMapping.name && excelData.length > 0) {
      const contacts = extractContacts(excelData, newMapping.phone, newMapping.name);
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


  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isLoading
            ? 'border-indigo-400 bg-indigo-50'
            : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-indigo-400'
          }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {(isLoading || isUploading) ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-3"></div>
            <div className="font-medium text-gray-700 mb-1">
              {isUploading ? 'Uploading file to server...' : 'Processing file...'}
            </div>
          </>
        ) : file ? (
          <>
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <div className="font-medium text-gray-700 mb-1 flex items-center justify-center gap-2">
              <FileText className="w-5 h-5" />
              {fileName}
            </div>
            <div className="text-sm text-gray-500">Click to upload a different file</div>
          </>
        ) : (
          <>
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <div className="font-medium text-gray-700 mb-1">Upload Excel File</div>
            <div className="text-sm text-gray-500">Click to browse or drag and drop</div>
            <div className="text-xs text-gray-400 mt-2">Supported: .xlsx, .xls, .csv</div>
          </>
        )}
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

      {(() => {
        if (!excelMapping.phone || !excelMapping.name || excelData.length === 0) return null;

        const contacts = extractContacts(excelData, excelMapping.phone, excelMapping.name);
        if (contacts.length === 0) return null;

        // Calculate pagination
        const totalPages = Math.ceil(contacts.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentContacts = contacts.slice(startIndex, endIndex);

        return (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-800">Extracted Contacts</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {contacts.length} contact{contacts.length !== 1 ? 's' : ''} extracted from Excel file
                </p>
              </div>

            </div>

            {/* Table */}
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentContacts.map((contact, index) => (
                      <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {contact.name || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {contact.phone || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            {contact.status || 'active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {contacts.length > 0 ? (
                <Pagination
                  currentPage={Math.min(currentPage, totalPages)}
                  totalPages={totalPages}
                  totalRecords={contacts.length}
                  pageSize={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              ) : null}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

