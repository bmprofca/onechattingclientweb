import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Header, Sidebar } from '../component/Menu';
import toast from 'react-hot-toast';
import { fetchProjectInfo } from '../store/projectSlice';
import { createPaymentOrder, checkPaymentStatus } from '../api/auth';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.getElementById('razorpay-checkout-script');
    if (existing) {
      if (window.Razorpay) resolve();
      else existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-script';
    script.type = 'text/javascript';
    script.src = RAZORPAY_SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.head.appendChild(script);
  });
};

const getUserPrefill = () => {
  try {
    const userData = localStorage.getItem('userData');
    if (userData) {
      const parsed = JSON.parse(userData);
      const profile = parsed.profile || {};
      return {
        name: profile.name || parsed.name || '',
        email: profile.email || parsed.username || parsed.email || '',
        contact: profile.mobile || parsed.mobile || ''
      };
    }
  } catch (error) {
    console.error('Error getting user prefill:', error);
  }
  return { name: '', email: '', contact: '' };
};

// Registered app URL for payment return redirects (Cashfree, Razorpay callbacks).
// CRA loads .env.development on `npm start` and .env.production on `npm run build`.
const getPaymentBaseUrl = () => {
  if (typeof window !== 'undefined' && isLocalDevHost()) {
    return window.location.origin;
  }

  const configured = process.env.REACT_APP_PUBLIC_URL?.trim().replace(/\/$/, '');
  return configured || window.location.origin;
};

const getWalletReturnUrl = () => `${getPaymentBaseUrl()}/wallet`;

const isLocalDevHost = (hostname = window.location.hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');

const isRazorpayLiveKey = (keyId) =>
  typeof keyId === 'string' && keyId.startsWith('rzp_live_');

const isRazorpayDomainMismatchError = (error) => {
  if (!error) return false;
  const description = (error.description || error.message || '').toLowerCase();
  return (
    error.reason === 'payment_risk_check_failed' ||
    description.includes('does not match registered website')
  );
};

const getRazorpayDomainMismatchMessage = () => {
  const currentOrigin = window.location.origin;
  const registeredUrl = process.env.REACT_APP_PUBLIC_URL?.trim().replace(/\/$/, '');
  let message =
    `Razorpay blocked payment because "${currentOrigin}" is not registered. ` +
    'Add this exact URL in Razorpay Dashboard → Account & Settings → Business website details.';
  if (registeredUrl && registeredUrl !== currentOrigin) {
    message += ` Open the app at your registered URL: ${registeredUrl}`;
  }
  return message;
};

const validateRazorpayLiveEnvironment = (keyId) => {
  if (!isRazorpayLiveKey(keyId)) return null;

  if (isLocalDevHost()) {
    return 'Live Razorpay payments only work on your registered production domain, not localhost. Use test keys locally or deploy to the registered site.';
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname)) {
    return 'Live Razorpay payments cannot run on an IP address. Use your registered domain (HTTPS).';
  }

  const registeredUrl = process.env.REACT_APP_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (registeredUrl && registeredUrl !== window.location.origin) {
    return `Open this app at ${registeredUrl} — your Razorpay-registered domain. You are currently on ${window.location.origin}.`;
  }

  return null;
};

const WalletRecharge = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [surchargePercent, setSurchargePercent] = useState(0);
  const [surchargeFlat, setSurchargeFlat] = useState(0);

  const navigate = useNavigate();
  const { amount: amountParam } = useParams();
  const dispatch = useDispatch();
  const projectInfo = useSelector((state) => state.project.info);
  const projectCharges =
    projectInfo?.project?.charges ||
    projectInfo?.charges ||
    projectInfo?.data?.charges ||
    null;

  // Get project_id from localStorage
  const getProjectId = () => {
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const parsed = JSON.parse(userData);
        return parsed.selected_project_id || null;
      }
    } catch (error) {
      console.error('Error getting project_id:', error);
    }
    return null;
  };

  // Pre-fill amount from URL (e.g. /wallet-recharge/500)
  useEffect(() => {
    if (amountParam != null && amountParam !== '') {
      const parsed = parseFloat(amountParam);
      if (!isNaN(parsed) && parsed > 0) {
        setCustomAmount(String(parsed));
        setSelectedAmount(null);
      }
    }
  }, [amountParam]);

  useEffect(() => {
    setIsPolling(false);
  }, [selectedAmount, customAmount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/payment/wallet-surcharge`);
        if (cancelled || response.data?.error) return;
        setSurchargePercent(Number(response.data.percent) || 0);
        setSurchargeFlat(Number(response.data.flat) || 0);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!projectInfo) {
      dispatch(fetchProjectInfo());
    }
  }, [dispatch, projectInfo]);

  // Poll payment status every 5 seconds when we have an order_id
  useEffect(() => {
    if (!isPolling || !currentOrderId) return;

    const project_id = getProjectId();
    if (!project_id) {
      setIsPolling(false);
      return;
    }

    const POLL_INTERVAL_MS = 2000;
    let pollInterval;
    let pollTimeout;

    const checkStatus = async () => {
      try {
        const response = await checkPaymentStatus({
          project_id,
          order_id: currentOrderId
        });

        if (response.error) {
          console.error('Payment status check error:', response.msg);
          return;
        }

        const status = response.status?.toUpperCase();

        if (status === 'SUCCESS') {
          // Stop polling
          setIsPolling(false);

          // Refresh wallet balance
          dispatch(fetchProjectInfo());

          // Show success message
          toast.success('Payment successful! Wallet updated.');

          // Clear pending payment
          sessionStorage.removeItem('pending_payment');
          sessionStorage.removeItem('pending_wallet_order_id');

          // Redirect to payment status page with order_id in path
          const orderId = response.order_id || currentOrderId;
          if (orderId) {
            navigate(`/payment-status/${orderId}`, {
              state: {
                paymentStatus: 'success',
                orderId: response.order_id,
                paymentId: response.payment_id,
                amount: response.amount
              }
            });
          }
        } else if (status === 'FAILED') {
          // Stop polling
          setIsPolling(false);

          // Show error message
          toast.error('Payment failed. Please try again.');

          // Clear pending payment
          sessionStorage.removeItem('pending_payment');
          sessionStorage.removeItem('pending_wallet_order_id');

          // Redirect to payment status page with order_id in path
          const orderId = response.order_id || currentOrderId;
          if (orderId) {
            navigate(`/payment-status/${orderId}`);
          }
        }
        // If PENDING, continue polling
      } catch (error) {
        console.error('Error checking payment status:', error);
        // Continue polling on error (might be network issue)
      }
    };

    checkStatus();
    pollInterval = setInterval(checkStatus, POLL_INTERVAL_MS);

    // Stop polling after 5 minutes (300 seconds) to avoid infinite polling
    pollTimeout = setTimeout(() => {
      setIsPolling(false);
      clearInterval(pollInterval);
      toast.error('Payment status check timeout. Please check manually.');
    }, 300000);

    // Cleanup on unmount or when polling stops
    return () => {
      clearInterval(pollInterval);
      clearTimeout(pollTimeout);
    };
  }, [isPolling, currentOrderId, dispatch, navigate]);

  // Predefined amount options
  const amountOptions = [
    { value: 100, label: '₹100', bonus: 0 },
    { value: 500, label: '₹500', bonus: 25, popular: false },
    { value: 1000, label: '₹1,000', bonus: 75, popular: true },
    { value: 2000, label: '₹2,000', bonus: 200, popular: false },
    { value: 5000, label: '₹5,000', bonus: 600, popular: false },
    { value: 10000, label: '₹10,000', bonus: 1500, popular: false }
  ];

  const getActiveAmount = () => {
    if (customAmount && !isNaN(parseFloat(customAmount))) {
      return parseFloat(customAmount);
    }
    return selectedAmount;
  };



  const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  const getTotalAmount = () => {
    const amount = getActiveAmount();
    if (!amount) return 0;
    const discountAmount = promoApplied ? (amount * discount / 100) : 0;
    return roundMoney(amount - discountAmount);
  };

  const getSurchargeAmount = () => {
    const credit = getTotalAmount();
    if (!credit) return 0;
    const percentFee = roundMoney((credit * surchargePercent) / 100);
    return roundMoney(percentFee + surchargeFlat);
  };

  const getPayableAmount = () => roundMoney(getTotalAmount() + getSurchargeAmount());

  const surchargeLabel = () => {
    const parts = [];
    if (surchargePercent > 0) parts.push(`${surchargePercent}%`);
    if (surchargeFlat > 0) parts.push(`₹${surchargeFlat}`);
    return parts.length ? `Platform fee (${parts.join(' + ')})` : 'Platform fee';
  };

  const activeAmount = getActiveAmount();
  const templateStats = useMemo(() => {
    if (!projectCharges || !activeAmount) return [];

    const templateOrder = ['marketing', 'utility', 'authentication'];
    const formatted = [];

    templateOrder.forEach((key) => {
      if (projectCharges?.[key] != null) {
        const charge = Number(projectCharges[key]);
        formatted.push({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          charge,
          count: charge > 0 ? Math.floor(activeAmount / charge) : 0
        });
      }
    });

    Object.keys(projectCharges).forEach((key) => {
      if (!templateOrder.includes(key)) {
        const charge = Number(projectCharges[key]);
        formatted.push({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          charge,
          count: charge > 0 ? Math.floor(activeAmount / charge) : 0
        });
      }
    });

    return formatted;
  }, [projectCharges, activeAmount]);

  const handleAmountSelect = (value) => {
    setSelectedAmount(value);
    setCustomAmount(value.toString());
  };

  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value);
      setSelectedAmount(null);
    }
  };

  // const applyPromoCode = async () => {
  //   try {
  //     // Call API to validate promo code
  //     const response = await validatePromoCode(promoCode);
  //     
  //     if (response.success && response.data) {
  //       setDiscount(response.data.discount_percentage);
  //       setPromoApplied(true);
  //       toast.success(`Promo code applied! ${response.data.discount_percentage}% discount`);
  //     } else {
  //       toast.error('Invalid promo code');
  //     }
  //   } catch (error) {
  //     // Fallback to mock validation for testing
  //     const validPromoCodes = {
  //       'FIRST10': 10,
  //       'SAVE20': 20,
  //       'WELCOME15': 15
  //     };

  //     if (validPromoCodes[promoCode.toUpperCase()]) {
  //       setDiscount(validPromoCodes[promoCode.toUpperCase()]);
  //       setPromoApplied(true);
  //       toast.success(`Promo code applied! ${validPromoCodes[promoCode.toUpperCase()]}% discount`);
  //     } else {
  //       toast.error('Invalid promo code');
  //     }
  //   }
  // };

  // const removePromoCode = () => {
  //   setPromoCode('');
  //   setPromoApplied(false);
  //   setDiscount(0);
  // };

  const openRazorpayCheckout = async (topupResponse) => {
    await loadRazorpayScript();
    if (!window.Razorpay) {
      throw new Error('Razorpay checkout not available');
    }

    const prefill = getUserPrefill();
    const paymentBaseUrl = getPaymentBaseUrl();
    const paymentStatusUrl = `${paymentBaseUrl}/payment-status/${topupResponse.order_id}`;

    const liveEnvError = validateRazorpayLiveEnvironment(topupResponse.key_id);
    if (liveEnvError) {
      throw new Error(liveEnvError);
    }

    const options = {
      key: topupResponse.key_id,
      amount: topupResponse.amount,
      currency: topupResponse.currency || 'INR',
      name: 'OneChatting',
      description: 'Wallet Topup',
      order_id: topupResponse.token_id,
      callback_url: paymentStatusUrl,
      prefill: {
        name: prefill.name,
        email: prefill.email,
        contact: prefill.contact
      },
      // Ensure UPI (incl. desktop QR) stays visible when dashboard blocks are customized
      config: {
        display: {
          preferences: {
            show_default_blocks: true
          }
        }
      },
      handler: () => {
        setIsPolling(true);
      },
      modal: {
        ondismiss: () => {
          setIsPolling(true);
        },
        confirm_close: true,
        escape: true
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (paymentResponse) => {
      console.error('Razorpay payment failed:', paymentResponse.error);
      const error = paymentResponse.error;
      if (isRazorpayDomainMismatchError(error)) {
        toast.error(getRazorpayDomainMismatchMessage(), { duration: 10000 });
        setIsPolling(false);
        setProcessing(false);
        return;
      }
      toast.error(error?.description || 'Payment failed');
      setIsPolling(true);
      window.location.href = paymentStatusUrl;
    });
    rzp.open();
  };

  // Resume polling if the user returns with an order id in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderIdFromUrl = params.get('order_id');
    const orderId =
      orderIdFromUrl ||
      sessionStorage.getItem('pending_wallet_order_id') ||
      (() => {
        try {
          const pending = sessionStorage.getItem('pending_payment');
          return pending ? JSON.parse(pending).order_id : null;
        } catch {
          return null;
        }
      })();

    if (!orderId) return;

    setCurrentOrderId(orderId);
    setIsPolling(true);

    if (orderIdFromUrl) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Proceed to payment: create order → open gateway checkout → poll status
  const initializePayment = async () => {
    const amount = getActiveAmount();
    if (!amount || amount < 1) {
      toast.error('Please enter a valid amount (minimum ₹1)');
      return;
    }

    setProcessing(true);
    const paymentBaseUrl = getPaymentBaseUrl();
    const walletReturnUrl = getWalletReturnUrl();

    try {
      const response = await createPaymentOrder({
        amount: getTotalAmount(),
        redirect_url: walletReturnUrl,
        origin: paymentBaseUrl
      });

      if (response.error === true || response.error === 1 || response.error === 'true') {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : (response.msg || 'Failed to create payment order')
        );
      }

      const orderId = response.order_id;
      if (!orderId) {
        throw new Error('Invalid response: missing order_id');
      }

      setCurrentOrderId(orderId);
      sessionStorage.setItem('pending_payment', JSON.stringify({
        order_id: orderId,
        amount: getActiveAmount(),
        discount: promoApplied ? discount : 0
      }));

      setProcessing(false);
      setIsPolling(true);
      if (!response.token_id || !response.key_id) {
        throw new Error('Invalid Razorpay response: missing token_id or key_id');
      }
      await openRazorpayCheckout(response);
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast.error(error.message || 'Failed to initialize payment');
      setProcessing(false);
      setIsPolling(false);
    }
  };

  // Check for payment callback on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('status');

    if (paymentStatus === 'success') {
      toast.success('Payment successful! Wallet updated.');

      // Clear pending payment
      sessionStorage.removeItem('pending_payment');

      // Refresh wallet balance
      dispatch(fetchProjectInfo());

      // Clean URL and redirect after delay
      setTimeout(() => {
        window.history.replaceState({}, '', '/wallet-recharge');
        navigate('/transactions');
      }, 2000);
    } else if (paymentStatus === 'failed') {
      toast.error('Payment failed. Please try again.');

      // Clear pending payment
      sessionStorage.removeItem('pending_payment');

      // Clean URL
      window.history.replaceState({}, '', '/wallet-recharge');
    }
  }, [dispatch, navigate]);

  let accountBalance = null;
  try {
    const storedUser = JSON.parse(localStorage.getItem('userData') || 'null');
    if (storedUser && storedUser.balance != null && storedUser.balance !== '') {
      const parsedBalance = Number(storedUser.balance);
      accountBalance = Number.isFinite(parsedBalance) ? parsedBalance : null;
    }
  } catch (_) {}
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const coverageNote = templateStats
    .filter((item) => item.charge > 0)
    .map((item) => `${item.count.toLocaleString('en-IN')} ${item.label.toLowerCase()}`)
    .join(', ');

  return (
    <div className="min-h-screen bg-surface-ground overflow-x-hidden">
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

      <div className={`pt-16 transition-all duration-300 ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
        <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
            <div className="mb-6">
              <h1 className="oc-page-title">Recharge wallet</h1>
              <p className="oc-page-sub">Template messages, renewals and AI replies are paid from your wallet.</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
                <section className="oc-card p-5 space-y-4">
                  {accountBalance != null && (
                    <div className="rounded-[14px] bg-ink text-white px-5 py-4 flex items-center justify-between">
                      <span className="text-sm text-white/70">Current balance</span>
                      <span className="text-[26px] leading-none font-semibold font-mono">{money(accountBalance)}</span>
                    </div>
                  )}
                  <div>
                    <label className="oc-label" htmlFor="recharge-amount">Recharge amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 font-semibold">₹</span>
                      <input
                        id="recharge-amount"
                        type="text"
                        value={customAmount}
                        onChange={handleCustomAmountChange}
                        placeholder="Enter amount"
                        className="oc-input pl-8 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {amountOptions.map((option) => {
                      const selected = Number(customAmount) === option.value || selectedAmount === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleAmountSelect(option.value)}
                          className={`h-11 rounded-[10px] border text-sm font-semibold transition-colors ${selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink hover:border-[#D5D2E4]'}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  {coverageNote && (
                    <p className="text-xs text-ink-500">At your current rates this covers about {coverageNote} messages.</p>
                  )}
                  {isPolling && (
                    <p className="text-xs font-semibold text-brand-800">Checking payment status…</p>
                  )}
                </section>
                <aside className="oc-card p-5">
                  <h2 className="text-[15px] font-bold text-ink">Payment summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-500">Wallet credit</dt>
                      <dd className="oc-num text-ink">{money(getActiveAmount() || 0)}</dd>
                    </div>
                    {promoApplied && (
                      <div className="flex items-center justify-between gap-3 text-emerald-700">
                        <dt>Discount ({discount}%)</dt>
                        <dd className="oc-num">-₹{((getActiveAmount() || 0) * discount / 100).toFixed(2)}</dd>
                      </div>
                    )}
                    {getSurchargeAmount() > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-500">{surchargeLabel()}</dt>
                        <dd className="oc-num text-ink">{money(getSurchargeAmount())}</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                      <dt className="font-semibold text-ink">You pay</dt>
                      <dd className="oc-num text-ink">{money(getPayableAmount())}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={initializePayment}
                    disabled={!getActiveAmount() || processing}
                    className="oc-btn-primary w-full mt-4"
                  >
                    {processing ? 'Processing...' : 'Proceed to pay'}
                  </button>
                  <p className="mt-3 text-center text-[11px] text-ink-400">Secure payment by Razorpay. UPI, cards and netbanking.</p>
                </aside>
              </div>
          </div>
        </div>

    </div>
  );
};

export default WalletRecharge;

