import React from 'react';
import { useNavigate } from 'react-router-dom';

const Error_404 = () => {
  const navigate = useNavigate();

  return (
    <div className="oc-force-light min-h-screen bg-surface-ground flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[88px] leading-none font-extrabold tracking-tight text-brand-200 select-none">404</p>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-ink">This page does not exist</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          The link may be old, or the page was moved. Your chats and contacts are safe.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={() => navigate('/')} className="oc-btn-primary h-10 px-4">
            Go to dashboard
          </button>
          <button type="button" onClick={() => navigate('/support')} className="oc-btn-ghost h-10 px-4">
            Contact support
          </button>
        </div>
      </div>
    </div>
  );
};

export default Error_404;
