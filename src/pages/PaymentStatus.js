import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams, Link } from 'react-router-dom';
import {
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiRefreshCw,
  FiDownload
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { checkPaymentStatus } from '../api/auth';
import { fetchProjectInfo } from '../store/projectSlice';
import { useDispatch } from 'react-redux';
import moment from 'moment';
import { parseServerDate } from '../utils/dateTime';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PaymentStatus = () => {
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { order_id: orderIdFromPath } = useParams();
  const dispatch = useDispatch();

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

  // Get order_id from path first, then fallbacks
  const orderId =
    orderIdFromPath ||
    location.state?.orderId ||
    searchParams.get('order_id') ||
    sessionStorage.getItem('pending_wallet_order_id') ||
    (() => {
      try {
        const pending = sessionStorage.getItem('pending_payment');
        return pending ? JSON.parse(pending).order_id : null;
      } catch {
        return null;
      }
    })();

  // Poll payment status every 5 seconds when pending; stop when not pending
  useEffect(() => {
    if (!orderId) {
      setError('Order ID not found');
      setLoading(false);
      return;
    }

    const project_id = getProjectId();
    if (!project_id) {
      setError('Project ID not found');
      setLoading(false);
      return;
    }

    const POLL_INTERVAL_MS = 5000;
    let intervalId = null;

    const fetchPaymentStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await checkPaymentStatus({
          project_id,
          order_id: orderId
        });

        if (response.error) {
          setError(response.msg || 'Failed to fetch payment status');
          setLoading(false);
          return false;
        }

        setPaymentData(response);

        // Refresh wallet balance if payment is successful
        if (response.status?.toUpperCase() === 'SUCCESS') {
          dispatch(fetchProjectInfo());
        }

        setLoading(false);

        const isPending = (response.status || '').toUpperCase() === 'PENDING';
        return isPending;
      } catch (err) {
        console.error('Error fetching payment status:', err);
        setError(err.message || 'Failed to fetch payment status');
        setLoading(false);
        return false;
      }
    };

    const runPoll = async () => {
      const shouldContinue = await fetchPaymentStatus();
      if (!shouldContinue && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return shouldContinue;
    };

    runPoll().then((isPending) => {
      if (isPending) {
        intervalId = setInterval(runPoll, POLL_INTERVAL_MS);
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [orderId, dispatch]);

  const getStatusConfig = (status) => {
    const statusUpper = status?.toUpperCase();
    switch (statusUpper) {
      case 'SUCCESS':
        return {
          icon: <FiCheckCircle size={22} />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-700',
          badgeColor: 'bg-green-100 text-green-800',
          title: 'Payment successful',
          description: 'Your wallet has been credited. The new balance shows in the top bar.'
        };
      case 'FAILED':
        return {
          icon: <FiXCircle size={22} />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700',
          badgeColor: 'bg-red-100 text-red-800',
          title: 'Payment failed',
          description: 'This payment did not go through. Your wallet was not charged.'
        };
      case 'PENDING':
        return {
          icon: <FiClock size={22} />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-700',
          badgeColor: 'bg-yellow-100 text-yellow-800',
          title: 'Payment pending',
          description: 'We are still confirming this payment with the bank.'
        };
      default:
        return {
          icon: <FiClock size={22} />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-700',
          badgeColor: 'bg-gray-100 text-gray-800',
          title: 'Payment Status',
          description: 'Checking payment status'
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = parseServerDate(dateString);
      return date ? moment(date).format('DD MMM YYYY, hh:mm A') : dateString;
    } catch {
      return dateString;
    }
  };

  const handleDownloadInvoice = () => {
    if (!paymentData) return;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Payment Invoice', 20, 20);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Order ID: ${paymentData?.order_id || 'N/A'}`, 20, 32);
    doc.text(`Status: ${paymentData?.status || 'N/A'}`, 20, 38);
    doc.text(`Date: ${formatDate(paymentData?.create_date)}`, 20, 44);
    doc.text(`Amount paid: ₹${Number(paymentData?.payable ?? paymentData?.amount ?? 0).toFixed(2)}`, 20, 50);
    doc.text(`Payment Type: ${paymentData?.type || 'N/A'}`, 20, 56);
    if (paymentData?.utr) doc.text(`UTR: ${paymentData.utr}`, 20, 62);

    const tableData = [
      ['Field', 'Value'],
      ['Order ID', paymentData?.order_id || 'N/A'],
      ['Status', paymentData?.status || 'N/A'],
      ['Amount paid (₹)', Number(paymentData?.payable ?? paymentData?.amount ?? 0).toFixed(2)],
      ...(Number(paymentData?.surcharge) > 0 ? [
        ['Wallet credit (₹)', Number(paymentData?.amount || 0).toFixed(2)],
        ['Platform fee (₹)', Number(paymentData.surcharge).toFixed(2)],
      ] : []),
      ['Date', formatDate(paymentData?.create_date)],
      ['Payment Type', paymentData?.type || 'N/A']
    ];
    if (paymentData?.utr) tableData.push(['UTR', paymentData.utr]);

    autoTable(doc, {
      startY: 72,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 }
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const pageHeight = doc.internal.pageSize.height;
    doc.text('Thank you for your payment.', 20, pageHeight - 15);
    doc.text('This is a computer-generated invoice.', 20, pageHeight - 10);

    doc.save(`Payment-Invoice-${paymentData?.order_id || 'invoice'}.pdf`);
    toast.success('Invoice downloaded');
  };

  if (loading) {
    return (
      <div className="oc-force-light min-h-screen bg-surface-ground flex flex-col items-center justify-center px-4">
        <img src="/logo.png" alt="" className="h-9 w-9 rounded-[10px] object-cover" />
        <p className="mt-3 text-sm font-extrabold tracking-tight text-ink">OneChatting</p>
        <div className="mt-8 w-full max-w-[440px] rounded-[18px] border border-line bg-white px-6 py-12 text-center shadow-card">
          <FiRefreshCw size={28} className="mx-auto animate-spin text-brand-600" />
          <p className="mt-4 text-sm text-ink-500">Checking this payment…</p>
        </div>
      </div>
    );
  }

  if (error && !paymentData) {
    return (
      <div className="oc-force-light min-h-screen bg-surface-ground flex flex-col items-center px-4 py-16">
        <div className="mb-6 flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-[10px] object-cover" />
          <span className="text-lg font-extrabold tracking-tight text-ink">OneChatting</span>
        </div>
        <div className="w-full max-w-[440px] rounded-[18px] border border-line bg-white px-6 py-8 text-center shadow-card">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <FiXCircle size={22} />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">Payment failed</h1>
          <p className="mt-2 text-sm text-ink-500">{error}</p>
          <button type="button" onClick={() => navigate('/wallet-recharge')} className="oc-btn-primary mt-6 h-10 px-4">
            Back to recharge
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(paymentData?.status);
  const paid = Number(paymentData?.payable ?? paymentData?.amount ?? 0);
  const amount = paid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fee = Number(paymentData?.surcharge || 0);
  const rows = [
    ['Order ID', paymentData?.order_id],
    ...(fee > 0 ? [
      ['Wallet credit', `₹${Number(paymentData?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ['Platform fee', `₹${fee.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
    ] : []),
    ['UTR', paymentData?.utr],
    ['Payment type', paymentData?.type],
    ['Date', paymentData?.create_date ? formatDate(paymentData.create_date) : null],
    ['Paid by', paymentData?.name],
  ].filter(([, value]) => value);

  return (
    <div className="oc-force-light min-h-screen bg-surface-ground flex flex-col items-center px-4 py-12">
      <div className="mb-6 flex items-center gap-2.5">
        <img src="/logo.png" alt="" className="h-9 w-9 rounded-[10px] object-cover" />
        <span className="text-lg font-extrabold tracking-tight text-ink">OneChatting</span>
      </div>
      <div className="w-full max-w-[440px] rounded-[18px] border border-line bg-white px-6 py-8 text-center shadow-card">
        <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${statusConfig.badgeColor}`}>
          {statusConfig.icon}
        </span>
        <h1 className="mt-4 text-[22px] font-extrabold tracking-tight text-ink">{statusConfig.title}</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-500">{statusConfig.description}</p>
        <p className="mt-5 font-mono text-[32px] font-semibold tracking-tight text-ink">₹{amount}</p>
        <dl className="mt-6 text-left">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 border-t border-[#F3F2F8] py-3 text-sm">
              <dt className="text-ink-500">{label}</dt>
              <dd className="text-right font-semibold text-ink break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => navigate('/transactions')} className="oc-btn-ghost h-11 flex-1">View transactions</button>
          <button type="button" onClick={() => navigate('/')} className="oc-btn-primary h-11 flex-1">Back to dashboard</button>
        </div>
        <button type="button" onClick={handleDownloadInvoice} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink">
          <FiDownload size={14} /> Download receipt
        </button>
      </div>
      <p className="mt-5 text-sm text-ink-500">
        Something wrong? <Link to="/support" className="font-semibold text-brand-800">Contact support</Link>
      </p>
    </div>
  );
};

export default PaymentStatus;
