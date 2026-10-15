import React, { useState, useEffect } from 'react';
import {
  Phone, ShieldCheck, ArrowRight, X, Loader2,
} from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setAuthData, setSelectedProjectId } from '../store/authSlice';
import { loginUser, sendOtp } from '../api/auth';

const FEATURES = [
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

const BrandPanel = () => (
  <section aria-label="About OneChatting" className="hidden md:flex md:w-1/2 flex-col gap-10 bg-ink-900 text-white px-10 lg:px-14 py-12">
    <Logo dark />
    <div className="flex-1 flex flex-col justify-center gap-7 max-w-[520px]">
      <h1 className="text-[34px] lg:text-[40px] leading-[1.12] font-extrabold tracking-[-0.03em]">
        Set up your WhatsApp workspace in a few minutes.
      </h1>
      <ol className="flex flex-col gap-5">
        {FEATURES.map(({ step, title, desc }) => (
          <li key={step} className="flex gap-3.5 items-start">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#2A2450] text-[13px] font-bold text-[#C4BAFF]">
              {step}
            </span>
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
    <div className="oc-force-light min-h-screen w-full flex bg-white font-sans text-ink">
      <BrandPanel />
      <main className="w-full md:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] flex flex-col gap-7">
          <div className="md:hidden"><Logo /></div>
          <div>
            <h2 className="text-[28px] font-extrabold tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {step === 1
                ? "We'll send a one-time code to your business mobile number."
                : <>Enter the 6-digit code sent to <strong className="text-ink font-semibold">+91 {formData.mobile}</strong></>}
            </p>
          </div>

          {showGlobalError && errors.global && (
            <div role="alert" className="flex items-start justify-between gap-3 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <span>{errors.global}</span>
              <button type="button" onClick={dismissGlobalError} aria-label="Dismiss" className="text-red-700/70 hover:text-red-800"><X className="w-4 h-4" /></button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {step === 1 ? (
              <div key="mobile">
                <label htmlFor="mobile" className="oc-label">Business mobile number</label>
                <div className={`flex items-center h-[50px] rounded-[10px] border bg-white overflow-hidden transition-shadow focus-within:border-brand-600 focus-within:ring-[3px] focus-within:ring-brand-600/20 ${errors.mobile ? 'border-red-300' : 'border-line-strong'}`}>
                  <span className="flex items-center gap-1.5 h-full px-3.5 border-r border-[#ECEAF3] bg-surface-soft text-sm font-semibold text-ink-700">
                    <Phone className="w-4 h-4 text-ink-400" /> +91
                  </span>
                  <input
                    type="tel" id="mobile" name="mobile" autoFocus inputMode="numeric" autoComplete="tel-national"
                    value={formData.mobile} onChange={handleChange}
                    placeholder="98765 43210" maxLength={10}
                    aria-invalid={Boolean(errors.mobile)} aria-describedby={errors.mobile ? 'mobile-error' : undefined}
                    className="flex-1 h-full px-3.5 bg-transparent outline-none font-mono text-[15px] text-ink placeholder:text-ink-400"
                  />
                </div>
                {errors.mobile && <p id="mobile-error" className="mt-1.5 text-xs text-red-700">{errors.mobile}</p>}
              </div>
            ) : (
              <div key="otp">
                <label htmlFor="otp" className="oc-label">Verification code</label>
                <div className={`flex items-center h-[54px] rounded-[10px] border bg-white transition-shadow focus-within:border-brand-600 focus-within:ring-[3px] focus-within:ring-brand-600/20 ${errors.otp ? 'border-red-300' : 'border-line-strong'}`}>
                  <ShieldCheck className="ml-3.5 w-4 h-4 text-ink-400 flex-none" />
                  <input
                    type="text" id="otp" name="otp" autoFocus inputMode="numeric" autoComplete="one-time-code"
                    value={formData.otp} onChange={handleChange}
                    placeholder="000000" maxLength={6}
                    aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? 'otp-error' : undefined}
                    className="flex-1 h-full px-3 bg-transparent outline-none font-mono text-xl font-semibold tracking-[0.5em] text-ink placeholder:text-ink-400/60"
                  />
                </div>
                {errors.otp && <p id="otp-error" className="mt-1.5 text-xs text-red-700">{errors.otp}</p>}
                <div className="mt-2.5 flex justify-end">
                  <button type="button" onClick={() => setStep(1)} className="text-[13px] font-semibold text-brand-800 hover:text-brand-900">
                    Change number
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit" disabled={isLoading}
              className="h-[50px] w-full rounded-[10px] bg-brand-600 text-white text-[15px] font-bold flex items-center justify-center gap-2 transition-colors hover:bg-brand-700 disabled:opacity-80 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {step === 1 ? 'Sending code…' : 'Verifying…'}</>
              ) : (
                <>{step === 1 ? 'Send code' : 'Verify and sign in'} <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="h-px bg-[#ECEAF3]" />
          <p className="text-center text-sm text-ink-500">
            New to OneChatting?{' '}
            <Link to="/register" className="font-bold text-brand-800 hover:text-brand-900">Create an account</Link>
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
export default Login;
