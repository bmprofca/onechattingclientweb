import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  FiCreditCard,
  FiShield,
  FiLock,
  FiRefreshCw,
  FiZap
} from 'react-icons/fi';
import { Header, Sidebar } from '../component/Menu';
import toast from 'react-hot-toast';
import { fetchProjectInfo } from '../store/projectSlice';
import { createPaymentOrder, checkPaymentStatus } from '../api/auth';

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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

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

  // Track window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setIsPolling(false);
  }, [selectedAmount, customAmount]);

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



  const getTotalAmount = () => {
    const amount = getActiveAmount();
    if (!amount) return 0;
    const discountAmount = promoApplied ? (amount * discount / 100) : 0;
    return amount - discountAmount;
  };

  const getPayableAmount = () => {
    const amount = getActiveAmount();
    if (!amount) return 0;
    const discountAmount = promoApplied ? (amount * discount / 100) : 0;
    return amount - discountAmount;
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
        amount: getPayableAmount(),
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

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
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

      <div
        className={`transition-all duration-300 mt-16 w-full ${isMinimized ? 'md:ml-20' : 'md:ml-[260px]'
          }`}
        style={{
          width: windowWidth >= 768 ? (isMinimized ? 'calc(100% - 80px)' : 'calc(100% - 260px)') : '100%'
        }}
      >
        <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-8 w-full">
          <div className="w-full">
            {/* Header */}
            {/* <div className="mb-4 sm:mb-6 lg:mb-8">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center text-gray-600 hover:text-indigo-600 transition-colors mb-3 sm:mb-4 text-sm sm:text-base"
              >
                <FiArrowLeft className="mr-2" size={18} />
                Back
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Recharge Wallet</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">Add money to your WICHAT wallet</p>
                </div>

              </div>
            </div> */}

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {/* Left Column - Amount Selection */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Amount Options */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6"
                >
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
                    ₹
                    Select Amount
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    {amountOptions.map((option) => (
                      <motion.button
                        key={option.value}
                        onClick={() => handleAmountSelect(option.value)}
                        className={`relative p-2 sm:px-3 sm:py-4 rounded-lg sm:rounded-xl border-2 transition-all ${selectedAmount === option.value
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300 bg-white active:border-indigo-400'
                          }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {option.popular && (
                          <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-semibold flex items-center">
                            <FiZap size={10} className="mr-0.5 sm:mr-1" />
                            Popular
                          </div>
                        )}
                        <div className="text-sm sm:text-sm font-bold text-gray-900">{option.label}</div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                      Or enter custom amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-base sm:text-lg">₹</span>
                      <input
                        type="text"
                        value={customAmount}
                        onChange={handleCustomAmountChange}
                        placeholder="Enter amount "
                        className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:border-indigo-600 focus:ring-0 text-base sm:text-lg"
                      />
                    </div>
                  </div>

                  {projectCharges && (
                    <div className="mt-4 sm:mt-6 border border-indigo-100 bg-indigo-50/40 rounded-xl p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Template preview</p>
                          <p className="text-xs text-gray-500">Based on live project charges</p>
                        </div>
                        <span className="text-xs font-medium text-indigo-600">
                          ₹{activeAmount ? activeAmount.toFixed(2) : '0.00'}
                        </span>
                      </div>

                      {activeAmount ? (
                        templateStats.length ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                            {templateStats.map((item) => (
                              <div key={item.key} className="rounded-lg bg-white border border-indigo-100 px-3 py-2.5">
                                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                                  {item.label}
                                </p>
                                <p className="text-sm font-bold text-gray-900">{item.count}</p>
                                <p className="text-[11px] text-gray-500">₹{item.charge}/template</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">
                            We could not find per-template charges for this project.
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-gray-500">
                          Enter an amount to estimate how many templates you can send.
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>

              </div>

              {/* Right Column - Summary */}
              <div className="lg:col-span-1">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:sticky lg:top-24"
                >
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Payment Summary</h2>

                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    <div className="flex justify-between text-gray-700 text-sm sm:text-base">
                      <span>Recharge Amount</span>
                      <span className="font-semibold">₹{getActiveAmount() || 0}</span>
                    </div>

                    {promoApplied && (
                      <div className="flex justify-between text-green-600 text-sm sm:text-base">
                        <span>Discount ({discount}%)</span>
                        <span className="font-semibold">-₹{(getActiveAmount() * discount / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 sm:pt-4">
                      <div className="flex justify-between text-gray-700 mb-2 text-sm sm:text-base">
                        <span>You Pay</span>
                        <span className="font-semibold">₹{getPayableAmount().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-base sm:text-lg font-bold text-indigo-600">
                        <span>Total Credit</span>
                        <span>₹{getTotalAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={initializePayment}
                    disabled={!getActiveAmount() || processing}
                    className="w-full py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-bold text-base sm:text-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center"
                  >
                    {processing ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="mr-2"
                        >
                          <FiRefreshCw size={18} />
                        </motion.div>
                        <span className="text-sm sm:text-base">Processing...</span>
                      </>
                    ) : (
                      <>
                        <FiLock className="mr-2" size={18} />
                        <span className="text-sm sm:text-base">Proceed to Pay</span>
                      </>
                    )}
                  </button>

                  {/* Security Badges */}
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
                    <div className="flex items-center justify-center text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">
                      <FiShield className="mr-2 text-green-600" size={16} />
                      <span>100% Secure Payment</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 opacity-60">
                      <img src="https://razorpay.com/assets/razorpay-glyph.svg" alt="Razorpay" className="h-5 sm:h-6 mx-auto grayscale" />
                      <img src="https://www.logo.wine/a/logo/Unified_Payments_Interface/Unified_Payments_Interface-Logo.wine.svg" alt="UPI" className="h-5 sm:h-6 mx-auto grayscale" />
                      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-5 sm:h-6 mx-auto grayscale" />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg sm:rounded-xl">
                    <h3 className="font-semibold text-blue-900 mb-1.5 sm:mb-2 text-xs sm:text-sm">Why recharge?</h3>
                    <ul className="text-[10px] sm:text-xs text-blue-700 space-y-0.5 sm:space-y-1">
                      <li>✓ Send unlimited messages</li>
                      <li>✓ Create campaigns</li>
                      <li>✓ Access premium features</li>
                      <li>✓ Get bonus credits</li>
                    </ul>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default WalletRecharge;

