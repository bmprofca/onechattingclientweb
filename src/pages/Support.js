import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import axios from 'axios';
import {
    FiPhone,
    FiMail,
    FiMessageCircle,
    FiHelpCircle,
    FiCopy,
    FiCheck,
    FiClock,
    FiGlobe
} from 'react-icons/fi';

const Support = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });
    const [supportData, setSupportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copiedItem, setCopiedItem] = useState(null);

    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [mobileMenuOpen]);

    useEffect(() => {
        const fetchSupportData = async () => {
            try {
                setLoading(true);
                setError(null);
                const response = await axios.get(`${API_BASE_URL}/company/support`);

                if (response?.data?.error === false && response?.data?.data) {
                    setSupportData(response.data.data);
                } else {
                    setError(response?.data?.message || 'Failed to fetch support information');
                }
            } catch (err) {
                console.error('Failed to fetch support data:', err);
                setError('Failed to fetch support information. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchSupportData();
    }, []);

    const handleCopy = (text, type, index) => {
        navigator.clipboard.writeText(text);
        const key = `${type}-${index}`;
        setCopiedItem(key);
        setTimeout(() => setCopiedItem(null), 2000);
    };

    const formatPhoneNumber = (number) => {
        if (!number) return '';
        // Remove country code if it starts with 91
        if (number.startsWith('91')) {
            return `+${number}`;
        }
        return number;
    };

    const handlePhoneClick = (number) => {
        window.location.href = `tel:${number}`;
    };

    const handleWhatsAppClick = (number) => {
        // Open WhatsApp with the number
        const whatsappUrl = `https://wa.me/${number}`;
        window.open(whatsappUrl, '_blank');
    };

    const handleEmailClick = (email) => {
        window.location.href = `mailto:${email}`;
    };

    return (
        <div className="min-h-screen bg-[#f4f6fb]">
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

            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full px-4 py-5">
                    <div className="mb-5">
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Support</h1>
                        <p className="mt-1 text-sm text-slate-500">Call, message on WhatsApp, or email the OneChatting team.</p>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    <div className="h-16 animate-pulse bg-slate-50" />
                                    <div className="space-y-3 p-5">
                                        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                                        <div className="h-6 w-full animate-pulse rounded bg-slate-100" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            <FiHelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    ) : supportData ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                {supportData.phone && supportData.phone.length > 0 && (
                                    <SupportCard
                                        title="Phone"
                                        description="Call a support number"
                                        icon={<FiPhone className="h-5 w-5" />}
                                        iconWrap="bg-sky-50 text-sky-600"
                                        items={supportData.phone}
                                        type="phone"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        formatPhoneNumber={formatPhoneNumber}
                                        onActionClick={handlePhoneClick}
                                    />
                                )}

                                {supportData.whatsapp && supportData.whatsapp.length > 0 && (
                                    <SupportCard
                                        title="WhatsApp"
                                        description="Message us on WhatsApp"
                                        icon={<FiMessageCircle className="h-5 w-5" />}
                                        iconWrap="bg-emerald-50 text-emerald-600"
                                        items={supportData.whatsapp}
                                        type="whatsapp"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        formatPhoneNumber={formatPhoneNumber}
                                        onActionClick={handleWhatsAppClick}
                                    />
                                )}

                                {supportData.email && supportData.email.length > 0 && (
                                    <SupportCard
                                        title="Email"
                                        description="Write to the support desk"
                                        icon={<FiMail className="h-5 w-5" />}
                                        iconWrap="bg-indigo-50 text-indigo-600"
                                        items={supportData.email}
                                        type="email"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        onActionClick={handleEmailClick}
                                    />
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
                                <span className="inline-flex items-center gap-2">
                                    <FiClock className="h-4 w-4 text-slate-400" />
                                    Available 24/7
                                </span>
                                <span className="inline-flex items-center gap-2">
                                    <FiGlobe className="h-4 w-4 text-slate-400" />
                                    Global support
                                </span>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

// Support Card Component
const SupportCard = ({ title, description, icon, iconWrap, items, type, onCopy, copiedItem, formatPhoneNumber, onActionClick }) => {
    const actionLabel = type === 'phone' ? 'Call' : type === 'whatsapp' ? 'WhatsApp' : 'Email';
    const actionClass = type === 'phone'
        ? 'bg-sky-600 hover:bg-sky-700'
        : type === 'whatsapp'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-indigo-600 hover:bg-indigo-700';

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${iconWrap}`}>
                    {icon}
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <p className="text-sm text-slate-500">{description}</p>
                </div>
            </div>

            <ul className="divide-y divide-slate-100">
                {items.map((item, index) => {
                    const displayValue = type === 'phone' || type === 'whatsapp'
                        ? formatPhoneNumber(item.number)
                        : item.email;
                    const isCopied = copiedItem === `${type}-${index}`;

                    return (
                        <li key={`${type}-${index}`} className="px-5 py-4">
                            {item.type ? (
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.type}</p>
                            ) : null}
                            <p className="mt-1 break-all text-base font-semibold leading-6 text-slate-900">
                                {displayValue}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => onCopy(displayValue, type, index)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                                >
                                    {isCopied ? <FiCheck className="h-4 w-4 text-emerald-600" /> : <FiCopy className="h-4 w-4" />}
                                    {isCopied ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onActionClick(type === 'email' ? item.email : item.number)}
                                    className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-white transition ${actionClass}`}
                                >
                                    {actionLabel}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default Support;

