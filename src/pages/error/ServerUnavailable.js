import React from 'react';

const ServerUnavailable = () => (
  <main className="oc-force-light min-h-screen bg-surface-ground flex items-center justify-center px-6">
    <section className="max-w-md text-center" role="alert">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-8 w-8">
          <path d="M5 18h14a3 3 0 0 0 .4-5.97A6.5 6.5 0 0 0 7 9.5c0 .17.01.34.02.5A4 4 0 0 0 5 18Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m9 13 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">Service unavailable</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">We'll be back soon</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-500">
        We’re having trouble reaching OneChatting right now. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="oc-btn-primary mt-6 h-10 px-5"
      >
        Try again
      </button>
    </section>
  </main>
);

export default ServerUnavailable;
