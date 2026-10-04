import React, { useState } from 'react';
import {
  User, Phone, Mail, Building2, ShieldCheck, ArrowRight, ArrowLeft, X, Loader2,
  Radio, Users, Bot, Link2, Zap, LayoutTemplate, BarChart3,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { Encrypt } from './encryption/payload-encryption';
import axios from 'axios';
import { sendOtp } from '../api/auth';
import { websiteUrl } from '../config/website';

// ---- Design tokens (shared system with Login) ----------------------------
const C = {
  ink: '#120F26',
  panelFrom: '#1B1445',
  panelVia: '#2A1B63',
  panelTo: '#120F26',
  brand: '#6C5CE7',
  brandDark: '#5847D6',
  mint: '#2FE6B8',
  amber: '#FFB020',
  coral: '#FF6B6B',
  sky: '#5FB3F0',
  rose: '#F472B6',
  surfaceSoft: '#F7F6FC',
  text: '#171426',
  muted: '#6F6B85',
  border: '#E7E4F2',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
};

const ORBIT = [
  { label: 'Broadcast', icon: Radio, color: C.coral, top: 6, left: 50 },
  { label: 'Team Inbox', icon: Users, color: C.amber, top: 22.5, left: 84.4 },
  { label: 'Chatbots', icon: Bot, color: C.mint, top: 59.8, left: 92.9 },
  { label: 'Analytics', icon: BarChart3, color: C.sky, top: 89.6, left: 69.1 },
  { label: 'Templates', icon: LayoutTemplate, color: C.rose, top: 89.6, left: 30.9 },
  { label: 'Auto-Replies', icon: Zap, color: C.amber, top: 59.8, left: 7.1 },
  { label: 'CRM Sync', icon: Link2, color: C.mint, top: 22.5, left: 15.6 },
];

const Logo = () => (
  <div className="flex items-center gap-2">
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center relative shrink-0 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.mint})` }}
    >
      <img src="/logo.png" alt="OneChatting" className="h-full w-full object-cover" />
    </div>
    <span className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <span style={{ color: C.text }}>One</span>
      <span style={{ color: C.brand }}>Chatting</span>
    </span>
  </div>
);

const OrbitPanel = () => (
  <div className="hidden md:flex md:w-[56%] relative flex-col justify-between p-8 overflow-hidden"
    style={{ background: `linear-gradient(160deg, ${C.panelFrom} 0%, ${C.panelVia} 55%, ${C.panelTo} 100%)` }}>
    <style>{`
      @keyframes ringGrow { 0% { transform: scale(1); opacity:.55 } 100% { transform: scale(6.2); opacity:0 } }
    `}</style>

    <div className="relative flex-1 flex items-center justify-center">
      <div className="relative w-full max-w-[280px] aspect-square">
        <div className="absolute inset-[6%] rounded-full border border-white/10" />
        <div className="absolute inset-[22%] rounded-full border border-white/10 border-dashed" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-16 h-16 rounded-full border" style={{ borderColor: 'rgba(108,92,231,0.45)', animation: 'ringGrow 3.2s ease-out infinite' }} />
          <span className="absolute w-16 h-16 rounded-full border" style={{ borderColor: 'rgba(47,230,184,0.35)', animation: 'ringGrow 3.2s ease-out infinite 1.1s' }} />
          <div className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center" style={{ background: '#fff', boxShadow: '0 12px 30px -8px rgba(108,92,231,0.55)' }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.mint})` }}>
              <img src="/logo.png" alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
        {ORBIT.map(({ label, icon: Icon, color, top, left }) => (
          <div key={label}
            className="absolute flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-[11px] font-semibold text-white whitespace-nowrap"
            style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontFamily: "'Inter', sans-serif" }}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
              <Icon className="w-3 h-3 text-[#120F26]" strokeWidth={2.6} />
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const fieldStyle = (hasError, focused) => ({
  background: C.surfaceSoft,
  border: `1px solid ${hasError ? '#FCA5A5' : focused ? C.brand : C.border}`,
  boxShadow: focused ? `0 0 0 3px ${C.brand}22` : 'none',
  color: C.text,
});

const Register = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [focusField, setFocusField] = useState('');
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

  const F = (name) => ({
    onFocus: () => setFocusField(name),
    onBlur: () => setFocusField(''),
  });

  return (
    <div className="h-dvh w-screen overflow-hidden flex items-center justify-center p-3" style={{ background: C.surfaceSoft }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes stepIn { from { opacity:0; transform: translateX(10px) } to { opacity:1; transform: translateX(0) } }
        .step-in { animation: stepIn .25s ease-out both; }
      `}</style>

      <div
        className="w-full max-w-[1200px] h-[min(680px,calc(100dvh-1.5rem))] rounded-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 30px 80px -24px rgba(18,15,38,0.18)', fontFamily: "'Inter', sans-serif" }}
      >
        <OrbitPanel />

        <div className="w-full md:w-[44%] flex flex-col bg-white px-5 py-4 md:px-6 md:py-5 min-h-0 overflow-hidden">
          <div className="mb-3"><Logo /></div>

          <div className="flex gap-1.5 mb-3">
              {[1, 2].map((i) => (
              <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: C.border }}>
                <div className="h-full transition-all duration-300" style={{ width: step >= i ? '100%' : '0%', background: C.brand }} />
                </div>
              ))}
        </div>

          <div className="mb-3">
            <h1 className="text-lg font-bold" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Create your workspace
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: C.muted }}>
              {step === 1 ? 'Tell us a bit about your business' : `Enter the code sent to +91 ${formData.mobile}`}
            </p>
          </div>

            {showGlobalError && errors.global && (
            <div className="mb-3 flex items-center justify-between rounded-lg px-3.5 py-2 text-[13px] step-in"
              style={{ background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, color: C.danger }}>
                <span>{errors.global}</span>
              <button onClick={dismissGlobalError}><X className="w-4 h-4" /></button>
              </div>
          )}

          <form onSubmit={step === 2 ? handleSubmit : (e) => e.preventDefault()} className="flex flex-col flex-1 min-h-0 justify-between">
            <div>
              {step === 1 ? (
                <div key="s1" className="space-y-2 step-in">
                  <div>
                    <label htmlFor="name" className="block text-xs font-medium mb-1" style={{ color: C.text }}>Full name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                      <input type="text" id="name" name="name" autoFocus value={formData.name} onChange={handleChange} {...F('name')}
                        placeholder="Your full name" className="w-full pl-10 pr-3.5 py-2 rounded-lg text-sm focus:outline-none transition-all"
                        style={fieldStyle(errors.name, focusField === 'name')} />
                    </div>
                    {errors.name && <p className="text-xs mt-1" style={{ color: C.danger }}>{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="mobile" className="block text-xs font-medium mb-1" style={{ color: C.text }}>Phone number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                      <input type="tel" id="mobile" name="mobile" value={formData.mobile} onChange={handleChange} {...F('mobile')}
                        placeholder="10-digit mobile number" maxLength={10} className="w-full pl-10 pr-3.5 py-2 rounded-lg text-sm focus:outline-none transition-all"
                        style={fieldStyle(errors.mobile, focusField === 'mobile')} />
                    </div>
                    {errors.mobile && <p className="text-xs mt-1" style={{ color: C.danger }}>{errors.mobile}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs font-medium mb-1" style={{ color: C.text }}>Work email <span style={{ color: C.muted }}>(optional)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                      <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} {...F('email')}
                        placeholder="you@company.com" className="w-full pl-10 pr-3.5 py-2 rounded-lg text-sm focus:outline-none transition-all"
                        style={fieldStyle(errors.email, focusField === 'email')} />
                    </div>
                    {errors.email && <p className="text-xs mt-1" style={{ color: C.danger }}>{errors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="businessName" className="block text-xs font-medium mb-1" style={{ color: C.text }}>Business name <span style={{ color: C.muted }}>(optional)</span></label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                      <input type="text" id="businessName" name="businessName" value={formData.businessName} onChange={handleChange} {...F('businessName')}
                        placeholder="Your business name" className="w-full pl-10 pr-3.5 py-2 rounded-lg text-sm focus:outline-none transition-all"
                        style={fieldStyle(errors.businessName, focusField === 'businessName')} />
                    </div>
                    {errors.businessName && <p className="text-xs mt-1" style={{ color: C.danger }}>{errors.businessName}</p>}
                  </div>
                </div>
              ) : (
                <div key="s2" className="space-y-2 step-in">
                  <div>
                    <label htmlFor="otp" className="block text-xs font-medium mb-1" style={{ color: C.text }}>One-time code</label>
                    <div className="relative">
                      <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                      <input type="text" id="otp" name="otp" autoFocus inputMode="numeric" value={formData.otp} onChange={handleChange} {...F('otp')}
                        placeholder="000000" maxLength={6} className="w-full pl-10 pr-3.5 py-2 rounded-lg text-sm tracking-[0.4em] focus:outline-none transition-all"
                        style={{ ...fieldStyle(errors.otp, focusField === 'otp'), fontFamily: "'IBM Plex Mono', monospace" }} />
                    </div>
                    {errors.otp && <p className="text-xs mt-1" style={{ color: C.danger }}>{errors.otp}</p>}
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
                    By creating a workspace, you agree to our{' '}
                    <a href={websiteUrl('/terms')} target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: C.brand }}>Terms &amp; Conditions</a>{' '}
                    and{' '}
                    <a href={websiteUrl('/privacy-policy')} target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: C.brand }}>Privacy Policy</a>.
                  </p>
                    </div>
              )}
            </div>

            <div className="mt-3 flex justify-between items-center gap-3 shrink-0">
              {step > 1 ? (
                <button type="button" onClick={prevStep}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5"
                  style={{ color: C.muted }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              ) : <div />}

              {step < 2 ? (
                <button type="button" onClick={nextStep} disabled={isLoading}
                  className="flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                  style={{ background: isLoading ? C.brandDark : C.brand, opacity: isLoading ? 0.85 : 1 }}>
                  {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>) : (<>Continue <ArrowRight className="w-4 h-4" /></>)}
                </button>
              ) : (
                <button type="submit" disabled={isLoading}
                  className="flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                  style={{ background: isLoading ? C.brandDark : C.brand, opacity: isLoading ? 0.85 : 1 }}>
                  {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>) : (<>Create workspace <ArrowRight className="w-4 h-4" /></>)}
                </button>
              )}
            </div>
          </form>

          <div className="mt-2 text-center shrink-0">
            <p className="text-xs" style={{ color: C.muted }}>
              Already chatting with us?{' '}
              <Link to="/login" className="font-medium" style={{ color: C.brand }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg step-in" style={{ background: C.ink }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
};

export default Register;