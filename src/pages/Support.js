import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { Header, Sidebar } from '../component/Menu';
import axios from 'axios';
import {
    FiPhone,
    FiMail,
    FiMessageCircle,
    FiHelpCircle,
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

    const hours = supportData?.hours || supportData?.working_hours || supportData?.timing || supportData?.support_hours || '';

    return (
        <div className="min-h-screen bg-surface-ground">
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
                <div className="w-full max-w-[1100px] px-4 sm:px-7 py-7">
                    <div className="mb-5">
                        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-ink">Support</h1>
                        <p className="mt-1.5 text-sm text-ink-500">Call, message on WhatsApp, or email the OneChatting team.</p>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-52 animate-pulse rounded-[14px] border border-line bg-white" />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex items-start gap-3 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            <FiHelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    ) : supportData ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                {supportData.whatsapp?.length > 0 && (
                                    <SupportCard
                                        title="WhatsApp"
                                        description="Fastest. Send screenshots of the problem."
                                        icon={<FiMessageCircle className="h-5 w-5" />}
                                        items={supportData.whatsapp}
                                        type="whatsapp"
                                        actionLabel="Message us"
                                        primary
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        formatPhoneNumber={formatPhoneNumber}
                                        onActionClick={handleWhatsAppClick}
                                    />
                                )}
                                {supportData.phone?.length > 0 && (
                                    <SupportCard
                                        title="Call"
                                        description="For account, billing or urgent delivery issues."
                                        icon={<FiPhone className="h-5 w-5" />}
                                        items={supportData.phone}
                                        type="phone"
                                        actionLabel="Call now"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        formatPhoneNumber={formatPhoneNumber}
                                        onActionClick={handlePhoneClick}
                                    />
                                )}
                                {supportData.email?.length > 0 && (
                                    <SupportCard
                                        title="Email"
                                        description="For invoices, documents and detailed requests."
                                        icon={<FiMail className="h-5 w-5" />}
                                        items={supportData.email}
                                        type="email"
                                        actionLabel="Write an email"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        onActionClick={handleEmailClick}
                                    />
                                )}
                            </div>

                            <div className="flex flex-col gap-3 rounded-[14px] border border-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-bold text-ink">Support hours</p>
                                    <p className="mt-0.5 text-sm text-ink-500">{hours || 'Available 24/7'}</p>
                                </div>
                                <p className="max-w-md text-sm text-ink-500">
                                    Mention your project name and the WhatsApp number in your message so we can help faster.
                                </p>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const SupportCard = ({ title, description, icon, items, type, actionLabel, primary, onCopy, copiedItem, formatPhoneNumber, onActionClick }) => (
    <section className="flex flex-col rounded-[14px] border border-line bg-white p-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span>
        <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-500">{description}</p>
        <ul className="mt-4 flex-1 space-y-3">
            {items.map((item, index) => {
                const displayValue = type === 'email' ? item.email : formatPhoneNumber(item.number);
                const isCopied = copiedItem === `${type}-${index}`;
                return (
                    <li key={`${type}-${index}`}>
                        {item.type ? <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">{item.type}</p> : null}
                        <button type="button" onClick={() => onCopy(displayValue, type, index)} className="mt-0.5 break-all text-left text-sm font-semibold text-ink hover:text-brand-800">
                            {displayValue}
                            <span className="ml-2 text-xs font-medium text-ink-400">{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                    </li>
                );
            })}
        </ul>
        <button
            type="button"
            onClick={() => onActionClick(type === 'email' ? items[0].email : items[0].number)}
            className={`mt-5 h-10 w-full rounded-[9px] text-[13px] font-semibold ${primary ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-[#E1DFEC] bg-white text-ink hover:bg-surface-soft'}`}
        >
            {actionLabel}
        </button>
    </section>
);

export default Support;

