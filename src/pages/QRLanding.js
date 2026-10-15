import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    FiAlertCircle,
    FiRefreshCw,
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
                    setRedirectCountdown(3);
                    setTimeout(() => {
                        window.location.href = waLink;
                    }, 3000);
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

    const projectName = projectData?.project_name || projectData?.name || 'Business';
    const about = projectData?.about || projectData?.description || projectData?.business_description || qrLabel || '';
    const initials = projectName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'P';

    return (
        <div className="oc-force-light min-h-screen bg-surface-ground flex items-center justify-center px-4 py-10">
            <Toaster position="top-center" />
            <div className="w-full max-w-[420px] rounded-[18px] border border-line bg-white px-6 py-8 text-center shadow-card">
                {loadingProject && (
                    <div className="py-10">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                            <FiRefreshCw className="animate-spin" size={22} />
                        </div>
                        <h1 className="mt-5 text-lg font-extrabold text-ink">Opening the chat</h1>
                        <p className="mt-2 text-sm text-ink-500">Loading this business and preparing WhatsApp.</p>
                    </div>
                )}

                {!loadingProject && error && (
                    <div className="py-6">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                            <FiAlertCircle size={26} />
                        </div>
                        <h1 className="mt-5 text-lg font-extrabold text-ink">This QR code is not available</h1>
                        <p className="mt-2 text-sm text-ink-500">{error}</p>
                        <Link to="/login" className="oc-btn-primary mt-6 h-10 px-4">Go to dashboard</Link>
                    </div>
                )}

                {!loadingProject && !error && projectData && whatsappUrl && (
                    <div>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-ink text-lg font-bold text-white">
                            {projectData.profile_picture ? (
                                <img src={projectData.profile_picture} alt="" className="h-full w-full object-cover" />
                            ) : initials}
                        </div>
                        <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">{projectName}</h1>
                        {about ? <p className="mt-1 text-sm text-ink-500">{about}</p> : null}

                        <div className="mt-5 flex items-center justify-center gap-2 rounded-[10px] bg-surface-soft px-3 py-2.5 text-sm text-ink-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Opening WhatsApp in {redirectCountdown} second{redirectCountdown === 1 ? '' : 's'}…
                        </div>

                        <button
                            type="button"
                            onClick={handleManualOpenWhatsApp}
                            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#128C7E] text-sm font-bold text-white hover:bg-[#0E7A6E]"
                        >
                            <WhatsAppIcon size={18} />
                            Open in WhatsApp
                        </button>
                        <p className="mt-4 text-xs leading-relaxed text-ink-500">
                            Your message goes straight to the business. They will see your WhatsApp name and number.
                        </p>
                        {customMessage ? (
                            <button type="button" onClick={handleCopyMessage} className="mt-3 text-xs font-semibold text-brand-800">
                                {copied ? 'Message copied' : 'Copy the message'}
                            </button>
                        ) : null}
                        <div className="mt-5 border-t border-line-soft pt-4 text-xs text-ink-400">
                            Powered by <span className="font-semibold text-brand-800">OneChatting</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRLanding;
