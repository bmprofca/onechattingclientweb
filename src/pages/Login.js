import React, { useState, useEffect } from 'react';
import {
  Phone, ShieldCheck, ArrowRight, X, Loader2,
  Radio, Users, Bot, Link2, Zap, LayoutTemplate, BarChart3,
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setAuthData, setSelectedProjectId } from '../store/authSlice';
import { loginUser, sendOtp } from '../api/auth';

// ---- Design tokens --------------------------------------------------------
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

const Logo = ({ dark }) => (
  <div className="flex items-center gap-2">
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center relative shrink-0 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.mint})` }}
    >
      <img src="/logo.png" alt="OneChatting" className="h-full w-full object-cover" />
    </div>
    <span className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <span style={{ color: dark ? '#fff' : C.text }}>1</span>
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
      <div className="relative w-full max-w-[300px] aspect-square">
        <div className="absolute inset-[6%] rounded-full border border-white/10" />
        <div className="absolute inset-[22%] rounded-full border border-white/10 border-dashed" />

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="absolute w-16 h-16 rounded-full border"
            style={{ borderColor: 'rgba(108,92,231,0.45)', animation: 'ringGrow 3.2s ease-out infinite' }}
          />
          <span
            className="absolute w-16 h-16 rounded-full border"
            style={{ borderColor: 'rgba(47,230,184,0.35)', animation: 'ringGrow 3.2s ease-out infinite 1.1s' }}
          />
          <div
            className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center shadow-lg"
            style={{ background: '#fff', boxShadow: '0 12px 30px -8px rgba(108,92,231,0.55)' }}
          >
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.mint})` }}>
              <img src="/logo.png" alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>

        {ORBIT.map(({ label, icon: Icon, color, top, left }) => (
          <div
            key={label}
            className="absolute flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-full text-[11px] font-semibold text-white whitespace-nowrap"
            style={{
              top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(2px)', fontFamily: "'Inter', sans-serif",
            }}
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

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ mobile: '', otp: '' });
  const [errors, setErrors] = useState({ mobile: '', otp: '', global: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [showGlobalError, setShowGlobalError] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileSiteKey = process.env.REACT_APP_TURNSTILE_SITE_KEY || '0x4AAAAAACuMb3QQyxLqxHpe';

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  };

  useEffect(() => {
    if (!location?.search) return;

    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get('token');
    const usernameFromUrl = params.get('username');

    if (tokenFromUrl && usernameFromUrl) {
      const userDataToStore = {
        token: tokenFromUrl,
        username: usernameFromUrl,
        is_impersonating: true,
        impersonated_at: new Date().toISOString(),
      };

      localStorage.setItem('userData', JSON.stringify(userDataToStore));
      localStorage.setItem('user_data', JSON.stringify(userDataToStore));
      dispatch(setAuthData(userDataToStore));
      showToast(`Logged in as @${usernameFromUrl} (Admin Impersonation)`);

      navigate('/', { replace: true });
      return;
    }

    const mobileFromUrl = params.get('mobile') || '';
    if (mobileFromUrl) {
      setFormData((prev) => ({ ...prev, mobile: mobileFromUrl || prev.mobile }));
      setErrors((prev) => ({ ...prev, mobile: '' }));
    }
  }, [location.search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const clean = name === 'mobile' ? value.replace(/\D/g, '').slice(0, 10) : value.replace(/\D/g, '').slice(0, 6);
    setFormData((prev) => ({ ...prev, [name]: clean }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    let valid = true;
    const newErrors = { mobile: '', otp: '' };

    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Enter your business phone number';
      valid = false;
    } else if (!/^\d{10}$/.test(formData.mobile)) {
      newErrors.mobile = 'Enter a valid 10-digit number';
      valid = false;
    }

    if (step === 2 && !formData.otp.trim()) {
      newErrors.otp = 'Enter the code we sent you';
      valid = false;
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      if (step === 1) {
        // ✅ FIX: Add purpose: 'login' here
        const data = await sendOtp({ 
          mobile: formData.mobile,
          purpose: 'login'  // ← THIS IS THE FIX
        });
        if (data.error === false) {
          setStep(2);
          showToast('Code sent to your phone');
        } else {
          throw new Error(data.error || 'Failed to send OTP');
        }
      } else {
        const data = await loginUser({
          mobile: formData.mobile,
          otp: formData.otp,
        });

        if (data.error === false) {
          const projects = Array.isArray(data.projects)
            ? data.projects
            : (Array.isArray(data.projects?.list) ? data.projects.list : []);
          const onlyProjectId = projects.length === 1 ? (projects[0]?.project_id || null) : null;
          const userDataToStore = { ...data, selected_project_id: onlyProjectId };

          localStorage.setItem('userData', JSON.stringify(userDataToStore));
          dispatch(setAuthData(userDataToStore));
          if (onlyProjectId) {
            dispatch(setSelectedProjectId(onlyProjectId));
            sessionStorage.removeItem('showProjectPicker');
          } else if (projects.length > 1) {
            sessionStorage.setItem('showProjectPicker', '1');
          } else {
            sessionStorage.removeItem('showProjectPicker');
          }

          navigate('/', { replace: true });
        } else {
          throw new Error(data.error || 'Something went wrong');
        }
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, global: error.message || 'An error occurred' }));
      setShowGlobalError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissGlobalError = () => {
    setShowGlobalError(false);
    setTimeout(() => setErrors((prev) => ({ ...prev, global: '' })), 250);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ background: C.surfaceSoft }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        @keyframes stepIn { from { opacity:0; transform: translateX(10px) } to { opacity:1; transform: translateX(0) } }
        .step-in { animation: stepIn .25s ease-out both; }
      `}</style>

      <div
        className="w-full max-w-[1200px] min-h-[600px] rounded-2xl overflow-hidden flex flex-col md:flex-row"
        style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 30px 80px -24px rgba(18,15,38,0.18)', fontFamily: "'Inter', sans-serif" }}
      >
        <OrbitPanel />

        {/* Form panel */}
        <div className="w-full md:w-[44%] flex flex-col justify-center p-6 md:p-10">
          <div className="mb-7"><Logo /></div>

          <h2 className="text-2xl font-bold" style={{ color: C.text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Good to see you again
          </h2>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {step === 1 ? "We'll text a one-time code to your business number." : `Enter the code sent to +91 ${formData.mobile}`}
          </p>

          {showGlobalError && errors.global && (
            <div
              className="mt-4 p-3 rounded-xl text-sm flex items-center justify-between step-in"
              style={{ background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, color: C.danger }}
            >
              <span>{errors.global}</span>
              <button onClick={dismissGlobalError} aria-label="Dismiss"><X className="w-4 h-4" /></button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {step === 1 ? (
              <div key="mobile" className="step-in">
                <label htmlFor="mobile" className="block text-sm font-medium mb-1.5" style={{ color: C.text }}>
                  Business phone number <span style={{ color: C.danger }}>*</span>
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-3.5 flex items-center gap-1.5 pr-2.5 text-sm"
                    style={{ color: C.muted, borderRight: `1px solid ${C.border}` }}
                  >
                    <Phone className="w-4 h-4" /> +91
                  </span>
                  <input
                    type="tel" id="mobile" name="mobile" autoFocus value={formData.mobile} onChange={handleChange}
                    placeholder="98765 43210" maxLength={10}
                    className="w-full pl-24 pr-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: C.surfaceSoft, border: `1px solid ${errors.mobile ? '#FCA5A5' : C.border}`,
                      color: C.text,
                    }}
                    onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${C.brand}22`, e.target.style.borderColor = C.brand)}
                    onBlur={(e) => (e.target.style.boxShadow = 'none', e.target.style.borderColor = errors.mobile ? '#FCA5A5' : C.border)}
                  />
                </div>
                {errors.mobile && <p className="text-xs mt-1.5" style={{ color: C.danger }}>{errors.mobile}</p>}
              </div>
            ) : (
              <div key="otp" className="step-in">
                <label htmlFor="otp" className="block text-sm font-medium mb-1.5" style={{ color: C.text }}>
                  Verification code <span style={{ color: C.danger }}>*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
                  <input
                    type="text" id="otp" name="otp" autoFocus inputMode="numeric" value={formData.otp} onChange={handleChange}
                    placeholder="000000" maxLength={6}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm tracking-[0.4em] focus:outline-none transition-all"
                    style={{
                      background: C.surfaceSoft, border: `1px solid ${errors.otp ? '#FCA5A5' : C.border}`,
                      color: C.text, fontFamily: "'IBM Plex Mono', monospace",
                    }}
                    onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${C.brand}22`, e.target.style.borderColor = C.brand)}
                    onBlur={(e) => (e.target.style.boxShadow = 'none', e.target.style.borderColor = errors.otp ? '#FCA5A5' : C.border)}
                  />
                </div>
                {errors.otp && <p className="text-xs mt-1.5" style={{ color: C.danger }}>{errors.otp}</p>}
                <button
                  type="button" onClick={() => setStep(1)}
                  className="text-sm font-medium mt-2"
                  style={{ color: C.brand }}
                >
                  ← Use a different number
                </button>
              </div>
            )}

            <button
              type="submit" disabled={isLoading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
              style={{ background: isLoading ? C.brandDark : C.brand, opacity: isLoading ? 0.85 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {step === 1 ? 'Sending code…' : 'Verifying…'}</>
              ) : (
                <>{step === 1 ? 'Send code' : 'Verify & sign in'} <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: C.muted }}>
            New to OneChatting?{' '}
            <Link to="/register" className="font-medium" style={{ color: C.brand }}>
              Register
            </Link>
          </p>
        </div>
      </div>

      {toastMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg step-in"
          style={{ background: C.ink }}
        >
          {toastMsg}
        </div>
      )}

    </div>
  );
};

export default Login;