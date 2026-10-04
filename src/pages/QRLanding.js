import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiCheckCircle,
    FiAlertCircle,
    FiExternalLink,
    FiRefreshCw,
    FiShield,
    FiMessageSquare,
    FiCopy,
    FiCheck
} from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import { validateQRCode, processScanAction } from '../api/qrcode';

// WhatsApp Icon SVG component
const WhatsAppIcon = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
            fill="currentColor"
        />
    </svg>
);

const QRLanding = () => {
    const { qr_id } = useParams();
    const navigate = useNavigate();

    // Validation & Project state
    const [loadingProject, setLoadingProject] = useState(true);
    const [projectData, setProjectData] = useState(null);
    const [qrLabel, setQrLabel] = useState('');
    const [error, setError] = useState('');
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [copied, setCopied] = useState(false);
    const [redirectCountdown, setRedirectCountdown] = useState(2);

    useEffect(() => {
        if (!qr_id) {
            setError('Invalid QR code link');
            setLoadingProject(false);
            return;
        }

        const initScan = async () => {
            setLoadingProject(true);
            setError('');

            try {
                // Validate QR Code from backend
                const valRes = await validateQRCode(qr_id);

                if (valRes.error) {
                    setError(valRes.error);
                    setLoadingProject(false);
                    return;
                }

                setProjectData(valRes.project || {});
                setQrLabel(valRes.qr_label || valRes.label || '');

                // Extract Phone Number (from QR Code or Project details)
                const rawPhone =
                    valRes.phone_number ||
                    valRes.project?.phone_number ||
                    valRes.project?.display_phone_number ||
                    valRes.project?.waba_number ||
                    valRes.project?.mobile ||
                    valRes.qr_code?.phone_number ||
                    '';

                const cleanPhone = rawPhone.replace(/\D/g, '');
                setPhoneNumber(cleanPhone);

                // Extract or generate custom message
                const msg =
                    valRes.custom_message ||
                    valRes.qr_code?.custom_message ||
                    valRes.message ||
                    `Hi, I scanned your QR code to connect with ${valRes.project?.project_name || 'you'} [Ref: ${qr_id}]`;

                setCustomMessage(msg);

                // Build WhatsApp Deep Link URL
                if (cleanPhone) {
                    const waLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
                    setWhatsappUrl(waLink);

                    // Persist the scan/mapping for an already signed-in user before
                    // opening WhatsApp. Anonymous visitors can still continue via
                    // the public deep link and complete registration later.
                    let session = null;
                    try {
                        const stored = localStorage.getItem('userData');
                        session = stored ? JSON.parse(stored) : null;
                    } catch (sessionError) {
                        session = null;
                    }
                    processScanAction({
                        qr_id,
                        action: 'whatsapp_redirect',
                        token: session?.token,
                        username: session?.username,
                        name: session?.name,
                        mobile: session?.mobile,
                        email: session?.email,
                        firm_name: session?.firm_name,
                    }).catch(() => {});

                    // Auto-redirect to WhatsApp after brief animation
                    setTimeout(() => {
                        window.location.href = waLink;
                    }, 1200);
                } else {
                    // If no phone number assigned to project yet
                    setError('This project does not have a WhatsApp number assigned yet. Please contact support.');
                }
            } catch (err) {
                console.error('Scan init error:', err);
                setError('Failed to connect to QR service. Please try scanning again.');
            } finally {
                setLoadingProject(false);
            }
        };

        initScan();
    }, [qr_id]);

    const handleCopyMessage = async () => {
        if (!customMessage) return;
        try {
            await navigator.clipboard.writeText(customMessage);
            setCopied(true);
            toast.success('Message copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy');
        }
    };

    const handleManualOpenWhatsApp = () => {
        if (whatsappUrl) {
            window.location.href = whatsappUrl;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-between text-white selection:bg-emerald-500 selection:text-white p-4 sm:p-6 md:p-8">
            <Toaster position="top-center" />

            {/* Top Bar / Brand */}
            <header className="max-w-md mx-auto w-full flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="" className="w-8 h-8 rounded-xl object-cover shadow-lg" />
                    <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        OneChatting
                    </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-gray-300">
                    <FiShield className="text-emerald-400" size={12} />
                    <span>WhatsApp Direct Connect</span>
                </div>
            </header>

            {/* Main Card */}
            <main className="max-w-md mx-auto w-full my-auto py-4">
                <div className="relative bg-white/10 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl border border-white/15 dark:border-gray-800 shadow-2xl p-6 sm:p-8 overflow-hidden">
                    {/* Decorative Background Glows */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none -translate-y-16 translate-x-16" />
                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none translate-y-12 -translate-x-12" />

                    {/* Initial Loading */}
                    {loadingProject && (
                        <div className="py-16 text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center mx-auto animate-pulse">
                                <FiRefreshCw className="text-emerald-400 animate-spin" size={28} />
                            </div>
                            <h2 className="text-lg font-bold text-white">Connecting to WhatsApp...</h2>
                            <p className="text-xs text-gray-400 max-w-xs mx-auto">
                                Loading project details and preparing your chat. Please hold on.
                            </p>
                        </div>
                    )}

                    {/* Error State */}
                    {!loadingProject && error && (
                        <div className="py-10 text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
                                <FiAlertCircle size={32} />
                            </div>
                            <h2 className="text-lg font-bold text-white">QR Code Not Available</h2>
                            <p className="text-xs text-gray-300 max-w-xs mx-auto">{error}</p>
                            <div className="pt-4">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-indigo-500/30"
                                >
                                    Go to Dashboard
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* Active WhatsApp Redirection State */}
                    {!loadingProject && !error && projectData && whatsappUrl && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 text-center"
                        >
                            {/* Project Avatar & WhatsApp Indicator */}
                            <div className="relative inline-block mx-auto">
                                <div className="absolute inset-0 bg-emerald-500/30 rounded-3xl blur-xl animate-pulse" />
                                <div className="relative w-24 h-24 rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 border-2 border-white/30 flex items-center justify-center text-white text-3xl font-bold shadow-2xl mx-auto">
                                    {projectData.profile_picture ? (
                                        <img
                                            src={projectData.profile_picture}
                                            alt={projectData.project_name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <span>{projectData.project_name?.charAt(0) || 'P'}</span>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-[#25D366] text-white p-2 rounded-2xl border-2 border-slate-900 shadow-lg">
                                    <WhatsAppIcon size={20} />
                                </div>
                            </div>

                            {/* Project & QR Info */}
                            <div>
                                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                                    {projectData.project_name || 'Project Chat'}
                                </h1>
                                {qrLabel && (
                                    <span className="inline-block px-3 py-1 mt-2 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        {qrLabel}
                                    </span>
                                )}
                                {phoneNumber && (
                                    <p className="text-xs font-mono text-emerald-400 mt-2">
                                        +{phoneNumber}
                                    </p>
                                )}
                            </div>

                            {/* Auto-redirecting Alert */}
                            <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-1">
                                <div className="flex items-center justify-center gap-2 text-emerald-300 font-semibold text-xs">
                                    <FiRefreshCw className="animate-spin text-emerald-400" size={14} />
                                    <span>Opening WhatsApp Automatically...</span>
                                </div>
                                <p className="text-[11px] text-gray-400">
                                    You will be redirected to send a pre-filled message directly to this project.
                                </p>
                            </div>

                            {/* Pre-filled Message Preview Box */}
                            {customMessage && (
                                <div className="text-left bg-black/30 border border-white/10 rounded-2xl p-3.5 space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                                        <span className="flex items-center gap-1">
                                            <FiMessageSquare size={12} className="text-emerald-400" />
                                            Pre-filled Message
                                        </span>
                                        <button
                                            onClick={handleCopyMessage}
                                            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                                        >
                                            {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
                                            <span>{copied ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-200 font-sans italic bg-white/5 p-2.5 rounded-xl border border-white/5 line-clamp-3">
                                        "{customMessage}"
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="space-y-2 pt-2">
                                <button
                                    onClick={handleManualOpenWhatsApp}
                                    className="w-full py-3.5 px-6 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-2xl text-sm font-bold shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    <WhatsAppIcon size={20} />
                                    <span>Open in WhatsApp</span>
                                    <FiExternalLink size={16} className="ml-1 opacity-80" />
                                </button>
                                <p className="text-[11px] text-gray-400">
                                    If WhatsApp didn't launch, click the button above.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="max-w-md mx-auto w-full text-center py-2 text-[11px] text-gray-400">
                <span>Powered by </span>
                <span className="font-semibold text-gray-300">OneChatting WhatsApp Connect</span>
            </footer>
        </div>
    );
};

export default QRLanding;
