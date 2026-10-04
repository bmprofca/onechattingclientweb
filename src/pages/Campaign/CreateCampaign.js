import React, { useState, useEffect } from 'react';
import { Header, Sidebar } from '../../component/Menu';
import CampaignHeader from './components/CampaignHeader';
import AudienceSelector from './components/AudienceSelector';
import TemplateSelector from './components/TemplateSelector';
import WhatsAppPreview from './components/WhatsAppPreview';
import CampaignSummary from './components/CampaignSummary';

export default function CampaignBuilder() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('audience');
  const [audienceType, setAudienceType] = useState(null);
  const [excelMapping, setExcelMapping] = useState({ name: '', phone: '' });
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectedContactDetails, setSelectedContactDetails] = useState([]);
  const [isSelectAllContacts, setIsSelectAllContacts] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableValues, setVariableValues] = useState({});
  const [variableSources, setVariableSources] = useState({});
  const [sheetLink, setSheetLink] = useState('');
  const [excelContacts, setExcelContacts] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [excelFileUrl, setExcelFileUrl] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [tokens, setTokens] = useState(null);

  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('sidebarMinimized');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }
  }, [isMinimized]);

  // Load tokens from storage
  useEffect(() => {
    const loadTokens = () => {
      try {
        if (typeof window === 'undefined') return;
        const storages = [localStorage, sessionStorage];
        for (const storage of storages) {
          try {
            const data = storage?.getItem('userData');
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed === 'object') {
                setTokens(parsed);
                return;
              }
            }
          } catch (storageError) {
            console.error('Failed to parse tokens from storage:', storageError);
          }
        }
        setTokens(null);
      } catch (e) {
        console.error('Failed to load tokens:', e);
      }
    };
    loadTokens();
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        isMinimized={isMinimized}
        setIsMinimized={setIsMinimized}
      />

      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'md:ml-20' : 'md:ml-[260px]'}`}>
        <Header
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          isMinimized={isMinimized}
          setIsMinimized={setIsMinimized}
        />

        <main className="mt-16 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-8xl mx-auto">
            <CampaignHeader activeTab={activeTab} />

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {activeTab === 'audience' && (
                  <AudienceSelector
                    audienceType={audienceType}
                    setAudienceType={(t) => {
                      setAudienceType(t);
                      if (t !== 'contacts') setIsSelectAllContacts(false);
                    }}
                    selectedContacts={selectedContacts}
                    setSelectedContacts={setSelectedContacts}
                    setSelectedContactDetails={setSelectedContactDetails}
                    isSelectAllContacts={isSelectAllContacts}
                    setIsSelectAllContacts={setIsSelectAllContacts}
                    selectedGroups={selectedGroups}
                    setSelectedGroups={setSelectedGroups}
                    excelMapping={excelMapping}
                    setExcelMapping={setExcelMapping}
                    sheetLink={sheetLink}
                    setSheetLink={setSheetLink}
                    excelContacts={excelContacts}
                    setExcelContacts={setExcelContacts}
                    excelHeaders={excelHeaders}
                    setExcelHeaders={setExcelHeaders}
                    excelFile={excelFile}
                    setExcelFile={setExcelFile}
                    excelData={excelData}
                    setExcelData={setExcelData}
                    onExcelFileUploaded={setExcelFileUrl}
                    tokens={tokens}
                  />
                )}

                {activeTab === 'template' && (
                  <TemplateSelector
                    selectedTemplate={selectedTemplate}
                    setSelectedTemplate={setSelectedTemplate}
                    variableValues={variableValues}
                    setVariableValues={setVariableValues}
                    variableSources={variableSources}
                    setVariableSources={setVariableSources}
                    excelHeaders={excelHeaders}
                    selectedContactDetails={selectedContactDetails}
                    audienceType={audienceType}
                    headerMediaUrl={headerMediaUrl}
                    setHeaderMediaUrl={setHeaderMediaUrl}
                    tokens={tokens}
                  />
                )}
              </div>

              {/* Right Sidebar */}
              <div className="space-y-6">
                {activeTab === 'template' && selectedTemplate && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="font-semibold text-gray-800 mb-4">WhatsApp Preview</h3>
                    <WhatsAppPreview
                      selectedTemplate={selectedTemplate}
                      variableValues={variableValues}
                      variableSources={variableSources}
                      headerMediaUrl={headerMediaUrl}
                    />
                  </div>
                )}

                <CampaignSummary
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  audienceType={audienceType}
                  selectedContacts={selectedContacts}
                  isSelectAllContacts={isSelectAllContacts}
                  selectedGroups={selectedGroups}
                  excelMapping={excelMapping}
                  sheetLink={sheetLink}
                  selectedTemplate={selectedTemplate}
                  variableValues={variableValues}
                  variableSources={variableSources}
                  campaignName={campaignName}
                  setCampaignName={setCampaignName}
                  scheduleDate={scheduleDate}
                  setScheduleDate={setScheduleDate}
                  excelFile={excelFile}
                  excelData={excelData}
                  excelHeaders={excelHeaders}
                  excelFileUrl={excelFileUrl}
                  selectedContactDetails={selectedContactDetails}
                  headerMediaUrl={headerMediaUrl}
                  tokens={tokens}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

