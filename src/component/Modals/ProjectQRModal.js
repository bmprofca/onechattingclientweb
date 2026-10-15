import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiX,
    FiDownload,
    FiCopy,
    FiCheck,
    FiPrinter,
    FiRefreshCw,
    FiInfo,
    FiMessageSquare
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { getProjectQRCodes } from '../../api/qrcode';

// WhatsApp Icon SVG component
const WhatsAppIcon = ({ size = 16, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
            fill="currentColor"
        />
    </svg>
);

const ProjectQRModal = ({ isOpen, onClose, projectId, projectName }) => {
    const [qrList, setQrList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [selectedQrIndex, setSelectedQrIndex] = useState(0);

    useEffect(() => {
        if (isOpen && projectId) {
            const fetchQRs = async () => {
                setLoading(true);
                try {
                    const res = await getProjectQRCodes({ project_id: projectId });
                    if (!res.error && res.qr_codes) {
                        setQrList(res.qr_codes);
                        setSelectedQrIndex(0);
                    } else {
                        setQrList([]);
                    }
                } catch (err) {
                    console.error('Failed to load project QR codes:', err);
                    setQrList([]);
                } finally {
                    setLoading(false);
                }
            };
            fetchQRs();
        }
    }, [isOpen, projectId]);

    const currentQr = qrList[selectedQrIndex] || null;
    const portalUrl = (
        process.env.REACT_APP_WEB_PUBLIC_URL ||
        process.env.REACT_APP_PUBLIC_URL ||
        window.location.origin
    ).replace(/\/$/, '');
    const scanUrl = currentQr ? `${portalUrl}/qr/${currentQr.qr_id}` : '';

    const handleCopyUrl = async () => {
        if (!scanUrl) return;
        try {
            await navigator.clipboard.writeText(scanUrl);
            setCopied(true);
            toast.success('QR Scan link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const handleWhatsAppShare = () => {
        if (!scanUrl) return;
        const text = encodeURIComponent(
            `👋 Scan this QR code or tap the link to start chatting with ${projectName || 'us'} on WhatsApp: ${scanUrl}`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    };

    const handleDownloadPng = () => {
        if (!currentQr) return;
        const canvas = document.getElementById(`client-qr-canvas-${currentQr.qr_id}`);
        if (!canvas) {
            toast.error('Canvas not ready');
            return;
        }

        const exportCanvas = document.createElement('canvas');
        const size = 600;
        const padding = 60;
        const headerHeight = 130;
        const footerHeight = 80;

        exportCanvas.width = size + padding * 2;
        exportCanvas.height = size + padding * 2 + headerHeight + footerHeight;

        const ctx = exportCanvas.getContext('2d');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

        // Header bar (WhatsApp Emerald gradient)
        const gradient = ctx.createLinearGradient(0, 0, exportCanvas.width, 0);
        gradient.addColorStop(0, '#25D366');
        gradient.addColorStop(1, '#128C7E');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, exportCanvas.width, 12);

        // Title
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(projectName || 'WhatsApp Chat', exportCanvas.width / 2, 65);

        // Subtitle
        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('💬 Scan with Camera to Chat on WhatsApp', exportCanvas.width / 2, 102);

        // QR Canvas
        ctx.drawImage(canvas, padding, headerHeight + padding / 2, size, size);

        // Footer
        ctx.fillStyle = '#64748b';
        ctx.font = '15px monospace';
        ctx.fillText(`Scan ID: ${currentQr.qr_id}`, exportCanvas.width / 2, exportCanvas.height - 42);
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Powered by OneChatting', exportCanvas.width / 2, exportCanvas.height - 18);

        const link = document.createElement('a');
        const fileNameSafe = (projectName || 'project').toLowerCase().replace(/[^a-z0-9]/g, '_');
        link.download = `whatsapp_qr_${fileNameSafe}_${currentQr.qr_id}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
        toast.success('WhatsApp QR image downloaded!');
    };

    const handlePrint = () => {
        if (!currentQr) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Popup blocked. Please allow popups to print.');
            return;
        }

        const canvas = document.getElementById(`client-qr-canvas-${currentQr.qr_id}`);
        const dataUrl = canvas ? canvas.toDataURL('image/png') : '';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp QR - ${projectName || 'OneChatting'}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background: #f8fafc;
                        color: #0f172a;
                    }
                    .card {
                        background: #ffffff;
                        border: 2px solid #e2e8f0;
                        border-radius: 28px;
                        padding: 40px;
                        text-align: center;
                        max-width: 420px;
                        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                    }
                    .wa-header {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        background: #dcfce7;
                        color: #15803d;
                        padding: 6px 16px;
                        border-radius: 9999px;
                        font-size: 13px;
                        font-weight: 700;
                        margin-bottom: 14px;
                    }
                    h1 {
                        font-size: 26px;
                        margin: 0 0 8px 0;
                        color: #1e293b;
                    }
                    p.label {
                        font-size: 15px;
                        color: #059669;
                        font-weight: 600;
                        margin: 0 0 18px 0;
                    }
                    .qr-container {
                        background: #ffffff;
                        padding: 16px;
                        border-radius: 20px;
                        border: 2px solid #22c55e;
                        display: inline-block;
                        margin-bottom: 18px;
                    }
                    .instruction {
                        font-size: 14px;
                        color: #475569;
                        margin: 0 0 16px 0;
                        line-height: 1.5;
                        font-weight: 500;
                    }
                    .badge {
                        display: inline-block;
                        background: #f1f5f9;
                        color: #475569;
                        font-family: monospace;
                        font-size: 12px;
                        padding: 4px 12px;
                        border-radius: 9999px;
                    }
                    @media print {
                        body { background: white; }
                        .card { border: none; box-shadow: none; padding: 20px; }
                    }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="wa-header">💬 WhatsApp Direct Connect</div>
                    <h1>${projectName || 'Project Chat'}</h1>
                    <div class="qr-container">
                        <img src="${dataUrl}" width="260" height="260" alt="QR Code" />
                    </div>
                    <p class="instruction">
                        Scan this QR code with any smartphone camera to instantly start a conversation with us on WhatsApp.
                    </p>
                    <div class="badge">Scan ID: ${currentQr.qr_id}</div>
                </div>
                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <AnimatePresence>
            {isOpen && (
            <motion.div
                key="project-qr-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                                <WhatsAppIcon size={18} />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                                    WhatsApp Project QR
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {projectName || 'Scan to chat on WhatsApp'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <FiX size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col items-center text-center">
                        {loading ? (
                            <div className="py-16 text-center text-xs text-gray-500 dark:text-gray-400">
                                <FiRefreshCw className="animate-spin inline-block mr-2" size={16} />
                                Loading QR code...
                            </div>
                        ) : qrList.length === 0 ? (
                            <div className="py-10 space-y-3">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center mx-auto">
                                    <FiInfo size={28} />
                                </div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                    No QR Code Generated Yet
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                                    Your system administrator has not generated an official QR code for this project yet. Please contact admin to assign a QR scan point.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Multiple QR Selector if any */}
                                {qrList.length > 1 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto max-w-full pb-1">
                                        {qrList.map((qr, idx) => (
                                            <button
                                                key={qr.qr_id}
                                                onClick={() => setSelectedQrIndex(idx)}
                                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                                                    selectedQrIndex === idx
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                }`}
                                            >
                                                {`QR #${idx + 1}`}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="p-4 bg-white rounded-2xl shadow-md border-2 border-emerald-500/30 inline-block mb-3">
                                    <QRCodeCanvas
                                        id={`client-qr-canvas-${currentQr.qr_id}`}
                                        value={scanUrl}
                                        size={210}
                                        level="H"
                                        includeMargin={true}
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-3">
                                    <WhatsAppIcon size={14} />
                                    <span>Scans automatically open WhatsApp chat</span>
                                </div>

                                {/* URL Copy Input */}
                                <div className="w-full flex items-center bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2 border border-gray-200 dark:border-gray-600 mb-4">
                                    <input
                                        type="text"
                                        readOnly
                                        value={scanUrl}
                                        className="bg-transparent text-xs text-gray-700 dark:text-gray-300 flex-1 px-2 outline-none select-all font-mono truncate"
                                    />
                                    <button
                                        onClick={handleCopyUrl}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                                    >
                                        {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-3 gap-2 w-full">
                                    <button
                                        onClick={handleWhatsAppShare}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                                        title="Share on WhatsApp"
                                    >
                                        <WhatsAppIcon size={15} />
                                        <span>WhatsApp</span>
                                    </button>
                                    <button
                                        onClick={handleDownloadPng}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                                        title="Download PNG"
                                    >
                                        <FiDownload size={14} />
                                        <span>Download</span>
                                    </button>
                                    <button
                                        onClick={handlePrint}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-xl text-xs font-semibold transition-all"
                                        title="Print Stand Card"
                                    >
                                        <FiPrinter size={14} />
                                        <span>Print</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ProjectQRModal;
