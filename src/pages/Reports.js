import React, { useEffect, useState } from 'react';
import { FiBarChart2 } from 'react-icons/fi';
import { Header, Sidebar } from '../component/Menu';
import CampaignMessageReport from '../component/reports/CampaignMessageReport';

function readUserData() {
  try {
    const stored = localStorage.getItem('userData');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to read report page user data:', error);
    return null;
  }
}

export default function Reports() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tokens, setTokens] = useState(readUserData);
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarMinimized');
      return saved ? JSON.parse(saved) : false;
    } catch (error) {
      console.error('Failed to read sidebar preference:', error);
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
  }, [isMinimized]);

  useEffect(() => {
    const refreshUserData = () => setTokens(readUserData());
    window.addEventListener('projects-updated', refreshUserData);
    return () => window.removeEventListener('projects-updated', refreshUserData);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mobileMenuOpen]);

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
      <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 py-7 sm:px-7">
          <header className="mb-1 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-600 text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.7)] sm:flex">
                <FiBarChart2 size={22} />
              </span>
              <div>
                <h1 className="oc-page-title">Reports</h1>
                <p className="oc-page-sub !mt-1">Understand campaign delivery and export message-level results.</p>
              </div>
            </div>
          </header>
          <CampaignMessageReport projectId={tokens?.selected_project_id} />
        </main>
      </div>
    </div>
  );
}
