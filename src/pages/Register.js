import React, { useState } from 'react';
import { ArrowLeft, X, Loader2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { Encrypt } from './encryption/payload-encryption';
import axios from 'axios';
import { sendOtp } from '../api/auth';
import { websiteUrl } from '../config/website';

const STEPS = [
  { step: '1', title: 'Create your account', desc: 'Name, business and mobile number' },
  { step: '2', title: 'Connect your WhatsApp number', desc: "Through Meta's official sign-up" },
  { step: '3', title: 'Invite your team and start chatting', desc: 'Shared inbox, templates and campaigns' },
];

const Logo = ({ dark }) => (
  <div className="flex items-center gap-2.5">
    <img src="/logo.png" alt="" className="h-9 w-9 rounded-[10px] object-cover shrink-0" />
    <span className={`text-lg font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>OneChatting</span>
  </div>
);

const Register = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', mobile: '', email: '', businessName: '', otp: '' });
  const [errors, setErrors] = useState({ name: '', mobile: '', email: '', businessName: '', otp: '', global: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showGlobalError, setShowGlobalError] = useState(false);
  const [toastMsg, setToastMsg] = useState('');


  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
  };

  const validateStep = (s) => {
    const next = { ...errors };
    let ok = true;
    if (s === 1) {
      if (!formData.name.trim()) { next.name = 'Enter your full name'; ok = false; } else next.name = '';
      if (!formData.mobile.trim()) { next.mobile = 'Enter a phone number'; ok = false; }
      else if (!/^\d{10}$/.test(formData.mobile)) { next.mobile = 'Enter a valid 10-digit number'; ok = false; }
      else next.mobile = '';
      const email = formData.email.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { next.email = 'Enter a valid email'; ok = false; }
      else next.email = '';
      next.businessName = '';
    } else {
      if (!formData.otp.trim()) { next.otp = 'Enter the code we sent you'; ok = false; } else next.otp = '';
    }
    setErrors(next);
    return ok;
  };

  const nextStep = async () => {
    if (!validateStep(1)) return;

    setIsLoading(true);
    try {
      const data = await sendOtp({
        mobile: formData.mobile,
        purpose: 'signup'  // ✅ EXPLICITLY SET TO 'signup'
      });
      if (data.error === false) {
        setStep(2);
        showToast('Code sent to your phone');
      } else {
        throw new Error(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, global: error.message || 'Failed to send OTP' }));
      setShowGlobalError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const prevStep = () => setStep(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateStep(2)) return;

      setIsLoading(true);

      const payload = {
        email: formData.email,
      otp: formData.otp,
        name: formData.name,
      firm_name: formData.businessName,
        mobile: formData.mobile,
        country_code: '+91',
      };

      const { data, key } = Encrypt(payload);
    const data_pass = JSON.stringify({ data, key });

    const config = {
        method: 'post',
        maxBodyLength: Infinity,
      url: `${API_BASE_URL}/account/register`,
      headers: { 'Content-Type': 'application/json' },
      data: data_pass,
      };

      axios.request(config)
        .then((response) => {
        const resData = response.data;
        if (resData.error === false) {
          localStorage.setItem('userData', JSON.stringify(resData));
          showToast('Workspace created — redirecting…');
          setTimeout(() => navigate('/'), 1200);
          } else {
          throw new Error(resData.error || 'Something went wrong');
          }
        })
        .catch((error) => {
        setErrors((prev) => ({ ...prev, global: error.message || 'An error occurred during registration' }));
          setShowGlobalError(true);
        })
      .finally(() => setIsLoading(false));
  };

  const dismissGlobalError = () => {
    setShowGlobalError(false);
    setTimeout(() => setErrors((p) => ({ ...p, global: '' })), 250);
  };

  const fieldClass = (invalid) =>
    `oc-input h-[46px] ${invalid ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`;

  return (
    <div className="oc-force-light min-h-screen w-full flex bg-white font-sans text-ink">
      <section aria-label="About OneChatting" className="hidden md:flex md:w-1/2 flex-col gap-10 bg-ink-900 text-white px-10 lg:px-14 py-12">
        <Logo dark />
        <div className="flex-1 flex flex-col justify-center gap-7 max-w-[520px]">
          <h1 className="text-[34px] lg:text-[40px] leading-[1.12] font-extrabold tracking-[-0.03em]">
            Set up your WhatsApp workspace in a few minutes.
          </h1>
          <ol className="flex flex-col gap-5">
            {STEPS.map(({ step: n, title, desc }) => (
              <li key={n} className="flex gap-3.5 items-start">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#2A2450] text-[13px] font-bold text-[#C4BAFF]">{n}</span>
                <span>
                  <span className="block text-sm font-bold">{title}</span>
                  <span className="block text-[13px] text-[#A9A4C2] mt-0.5">{desc}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-[#8F8AAB]">Built on the official WhatsApp Business Platform (Cloud API)</p>
      </section>

      <main className="w-full md:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] flex flex-col gap-6">
          <div className="md:hidden"><Logo /></div>
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${step === 1 ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-800'}`}>1</span>
            <span className={`text-sm font-semibold ${step === 1 ? 'text-ink' : 'text-ink-400'}`}>Details</span>
            <span className="h-px flex-1 bg-line" />
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold ${step === 2 ? 'bg-brand-600 text-white' : 'bg-[#F3F2FA] text-ink-400'}`}>2</span>
            <span className={`text-sm font-semibold ${step === 2 ? 'text-ink' : 'text-ink-400'}`}>Verify</span>
          </div>

          <div>
            <h2 className="text-[28px] font-extrabold tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {step === 1
                ? 'We will verify your mobile number with a one-time code.'
                : <>Enter the code sent to <strong className="text-ink font-semibold">+91 {formData.mobile}</strong></>}
            </p>
          </div>

          {showGlobalError && errors.global && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <span>{errors.global}</span>
              <button type="button" onClick={dismissGlobalError} aria-label="Dismiss"><X className="w-4 h-4" /></button>
            </div>
          )}

          <form onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()} className="flex flex-col gap-4" noValidate>
            {step === 1 ? (
              <>
                <div>
                  <label htmlFor="name" className="oc-label">Full name</label>
                  <input id="name" name="name" autoFocus value={formData.name} onChange={handleChange} placeholder="Mubarak Ali" className={fieldClass(errors.name)} />
                  {errors.name && <p className="mt-1.5 text-xs text-red-700">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="businessName" className="oc-label">Business name</label>
                  <input id="businessName" name="businessName" value={formData.businessName} onChange={handleChange} placeholder="Northeast Traders" className={fieldClass(errors.businessName)} />
                  {errors.businessName && <p className="mt-1.5 text-xs text-red-700">{errors.businessName}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="oc-label">Work email (optional)</label>
                  <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@company.com" className={fieldClass(errors.email)} />
                  {errors.email && <p className="mt-1.5 text-xs text-red-700">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="mobile" className="oc-label">Mobile number</label>
                  <div className={`flex items-center h-[46px] rounded-[9px] border bg-white overflow-hidden focus-within:border-brand-600 focus-within:ring-[3px] focus-within:ring-brand-600/20 ${errors.mobile ? 'border-red-300' : 'border-line-strong'}`}>
                    <span className="flex items-center h-full px-3.5 border-r border-[#ECEAF3] bg-surface-soft text-sm font-semibold text-ink-700">+91</span>
                    <input id="mobile" name="mobile" type="tel" inputMode="numeric" value={formData.mobile} onChange={handleChange} placeholder="98765 43210" maxLength={10} className="flex-1 h-full px-3.5 bg-transparent outline-none font-mono text-[15px] text-ink placeholder:text-ink-400" />
                  </div>
                  {errors.mobile && <p className="mt-1.5 text-xs text-red-700">{errors.mobile}</p>}
                </div>
                <button type="button" onClick={nextStep} disabled={isLoading} className="mt-1 h-[50px] w-full rounded-[10px] bg-brand-600 text-white text-[15px] font-bold hover:bg-brand-700 disabled:opacity-80">
                  {isLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending…</span> : 'Continue'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="otp" className="oc-label">One-time code</label>
                  <input id="otp" name="otp" autoFocus inputMode="numeric" value={formData.otp} onChange={handleChange} placeholder="000000" maxLength={6} className={`${fieldClass(errors.otp)} font-mono tracking-[0.4em]`} />
                  {errors.otp && <p className="mt-1.5 text-xs text-red-700">{errors.otp}</p>}
                </div>
                <p className="text-xs leading-relaxed text-ink-500">
                  By creating an account, you agree to our{' '}
                  <a href={websiteUrl('/terms')} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-800">Terms</a>
                  {' '}and{' '}
                  <a href={websiteUrl('/privacy-policy')} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-800">Privacy Policy</a>.
                </p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={prevStep} className="oc-btn-ghost h-[50px] px-4">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button type="submit" disabled={isLoading} className="h-[50px] flex-1 rounded-[10px] bg-brand-600 text-white text-[15px] font-bold hover:bg-brand-700 disabled:opacity-80">
                    {isLoading ? <span className="inline-flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Creating…</span> : 'Create account'}
                  </button>
                </div>
              </>
            )}
          </form>

          <p className="text-center text-sm text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-brand-800">Sign in</Link>
          </p>
        </div>
      </main>

      {toastMsg && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-white bg-ink shadow-pop">
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default Register;