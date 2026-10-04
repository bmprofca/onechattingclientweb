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
    FiGlobe,
    FiHeadphones
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
        <div className="min-h-screen bg-gray-50">
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
                <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-8">
                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-indigo-100 rounded-xl">
                                <FiHeadphones className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Support Center</h1>
                                <p className="text-gray-500 mt-1">Get help from our support team</p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-xl shadow p-6 animate-pulse">
                                    <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                                    <div className="space-y-3">
                                        <div className="h-20 bg-gray-200 rounded"></div>
                                        <div className="h-20 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                            <div className="flex items-center gap-3">
                                <FiHelpCircle className="w-5 h-5 text-red-600" />
                                <p className="text-red-600">{error}</p>
                            </div>
                        </div>
                    ) : supportData ? (
                        <div className="space-y-6">
                            {/* Support Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Phone Support */}
                                {supportData.phone && supportData.phone.length > 0 && (
                                    <SupportCard
                                        title="Phone Support"
                                        icon={<FiPhone className="w-6 h-6" />}
                                        iconBg="bg-blue-100"
                                        iconColor="text-blue-600"
                                        items={supportData.phone}
                                        type="phone"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        formatPhoneNumber={formatPhoneNumber}
                                        onActionClick={handlePhoneClick}
                                    />
                                )}

                                {/* WhatsApp Support */}
                                {supportData.whatsapp && supportData.whatsapp.length > 0 && (
                                    <SupportCard
                                        title="WhatsApp Support"
                                        icon={<FiMessageCircle className="w-6 h-6" />}
                                        iconBg="bg-green-100"
                                        iconColor="text-green-600"
                                        items={supportData.whatsapp}
                                        type="whatsapp"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        formatPhoneNumber={formatPhoneNumber}
                                        onActionClick={handleWhatsAppClick}
                                    />
                                )}

                                {/* Email Support */}
                                {supportData.email && supportData.email.length > 0 && (
                                    <SupportCard
                                        title="Email Support"
                                        icon={<FiMail className="w-6 h-6" />}
                                        iconBg="bg-purple-100"
                                        iconColor="text-purple-600"
                                        items={supportData.email}
                                        type="email"
                                        onCopy={handleCopy}
                                        copiedItem={copiedItem}
                                        onActionClick={handleEmailClick}
                                    />
                                )}
                            </div>

                            {/* Additional Help Section */}
                            <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl shadow-lg p-6 border border-indigo-100">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-indigo-100 rounded-lg">
                                        <FiHelpCircle className="w-6 h-6 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Need More Help?</h3>
                                        <p className="text-gray-600 mb-4">
                                            Our support team is available to assist you. Choose the contact method that works best for you.
                                        </p>
                                        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <FiClock className="w-4 h-4" />
                                                <span>Available 24/7</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FiGlobe className="w-4 h-4" />
                                                <span>Global Support</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

// Support Card Component
const SupportCard = ({ title, icon, iconBg, iconColor, items, type, onCopy, copiedItem, formatPhoneNumber, onActionClick }) => {
    return (
        <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden border border-gray-100">
            {/* Card Header */}
            <div className={`${iconBg} p-6`}>
                <div className="flex items-center gap-3">
                    <div className={`p-3 ${iconBg} rounded-lg`}>
                        <div className={iconColor}>{icon}</div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                </div>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-4">
                {items.map((item, index) => {
                    const displayValue = type === 'phone' || type === 'whatsapp'
                        ? formatPhoneNumber(item.number)
                        : item.email;
                    const itemKey = `${type}-${index}`;
                    const isCopied = copiedItem === itemKey;

                    return (
                        <div
                            key={index}
                            className="group p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-200"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                            {item.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-semibold text-gray-900 truncate">
                                            {displayValue}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => onCopy(displayValue, type, index)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                                        title="Copy"
                                    >
                                        {isCopied ? (
                                            <FiCheck className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <FiCopy className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (type === 'phone' || type === 'whatsapp') {
                                                onActionClick(item.number);
                                            } else {
                                                onActionClick(item.email);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${type === 'phone'
                                            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                                            : type === 'whatsapp'
                                                ? 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                                                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
                                            }`}
                                    >
                                        {type === 'phone' ? 'Call' : type === 'whatsapp' ? 'Chat' : 'Email'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Support;

