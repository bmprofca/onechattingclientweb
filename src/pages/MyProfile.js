import React, { useState, useEffect } from 'react';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import { fetchUserProfile, updateUserProfile } from '../api/auth';
import toast from 'react-hot-toast';
import {
    FiUser,
    FiMail,
    FiPhone,
    FiSave,
    FiAlertCircle,
    FiX,
} from 'react-icons/fi';

const COUNTRY_CODES = [
    { code: '+91', label: 'India (+91)' },
    { code: '+1', label: 'United States / Canada (+1)' },
    { code: '+44', label: 'United Kingdom (+44)' },
    { code: '+971', label: 'UAE (+971)' },
    { code: '+966', label: 'Saudi Arabia (+966)' },
    { code: '+974', label: 'Qatar (+974)' },
    { code: '+973', label: 'Bahrain (+973)' },
    { code: '+968', label: 'Oman (+968)' },
    { code: '+65', label: 'Singapore (+65)' },
    { code: '+60', label: 'Malaysia (+60)' },
    { code: '+61', label: 'Australia (+61)' },
    { code: '+62', label: 'Indonesia (+62)' },
    { code: '+63', label: 'Philippines (+63)' },
    { code: '+81', label: 'Japan (+81)' },
    { code: '+86', label: 'China (+86)' },
    { code: '+49', label: 'Germany (+49)' },
    { code: '+33', label: 'France (+33)' },
    { code: '+92', label: 'Pakistan (+92)' },
    { code: '+880', label: 'Bangladesh (+880)' },
    { code: '+94', label: 'Sri Lanka (+94)' },
    { code: '+977', label: 'Nepal (+977)' },
    { code: '+27', label: 'South Africa (+27)' },
    { code: '+55', label: 'Brazil (+55)' },
];

const BUSINESS_TYPES = [
    'Retail',
    'E-commerce',
    'Professional Services',
    'Healthcare',
    'Education',
    'Real Estate',
    'Hospitality',
    'Manufacturing',
    'IT & Software',
    'Other',
];

const normalizeCountryCode = (code) => {
    if (!code) return '+91';
    return code.startsWith('+') ? code : `+${code}`;
};

const mapProfileFromApi = (profileData) => ({
    fullName: profileData.name || '',
    email: profileData.email || '',
    phone: profileData.mobile || '',
    countryCode: normalizeCountryCode(profileData.country_code),
    gender: profileData.gender || 'male',
    firmName: profileData.firm_name || '',
    businessName: profileData.business_name || '',
    businessType: profileData.business_type || '',
});

const SkeletonBar = ({ className = '' }) => (
    <div className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />
);

const ProfileFieldSkeleton = () => (
    <div className="space-y-2">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-9 w-full" />
    </div>
);

const ProfileSkeleton = () => (
    <>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 animate-pulse">
            <div className="flex items-center space-x-4">
                <SkeletonBar className="h-16 w-16 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                    <SkeletonBar className="h-5 w-40" />
                    <SkeletonBar className="h-4 w-28" />
                    <div className="flex flex-wrap gap-3 pt-1">
                        <SkeletonBar className="h-3 w-36" />
                        <SkeletonBar className="h-3 w-32" />
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6 animate-pulse">
                <div className="flex items-center space-x-2">
                    <SkeletonBar className="h-4 w-4 rounded" />
                    <SkeletonBar className="h-4 w-28" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <ProfileFieldSkeleton key={index} />
                    ))}
                </div>
                <div className="flex justify-end">
                    <SkeletonBar className="h-9 w-32 rounded-md" />
                </div>
            </div>

            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-5 animate-pulse">
                <div className="flex items-center space-x-2">
                    <SkeletonBar className="h-4 w-4 rounded" />
                    <SkeletonBar className="h-4 w-32" />
                </div>
                <SkeletonBar className="h-3 w-full" />
                {Array.from({ length: 3 }).map((_, index) => (
                    <ProfileFieldSkeleton key={index} />
                ))}
                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700 space-y-2">
                    <SkeletonBar className="h-3 w-16" />
                    <SkeletonBar className="h-3 w-full" />
                    <SkeletonBar className="h-3 w-2/3" />
                    <SkeletonBar className="h-3 w-3/4" />
                    <SkeletonBar className="h-1.5 w-full rounded-full mt-2" />
                </div>
                <SkeletonBar className="h-10 w-full rounded-md" />
            </div>
        </div>
    </>
);

const MyProfile = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });

    const [profile, setProfile] = useState({
        fullName: '',
        email: '',
        phone: '',
        countryCode: '+91',
        gender: 'male',
        firmName: '',
        businessName: '',
        businessType: '',
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);


    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true);
                const response = await fetchUserProfile();
                if (response && !response.error && response.profile) {
                    setProfile(mapProfileFromApi(response.profile));
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

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

    const handleProfileChange = (field, value) => {
        setProfile((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const response = await updateUserProfile({
                name: profile.fullName,
                country_code: profile.countryCode,
                mobile: profile.phone,
                gender: profile.gender,
                firm_name: profile.firmName,
                business_name: profile.businessName,
                business_type: profile.businessType,
            });

            if (response && !response.error) {
                if (response.profile) {
                    setProfile(mapProfileFromApi(response.profile));
                }
                toast.success(response.msg || 'Profile updated successfully');
            } else {
                toast.error(response?.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Error updating profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const countryCodeOptions = [...COUNTRY_CODES];
    if (
        profile.countryCode &&
        !countryCodeOptions.some((item) => item.code === profile.countryCode)
    ) {
        countryCodeOptions.unshift({
            code: profile.countryCode,
            label: profile.countryCode,
        });
    }

    const businessTypeOptions = [...BUSINESS_TYPES];
    if (
        profile.businessType &&
        !businessTypeOptions.includes(profile.businessType)
    ) {
        businessTypeOptions.unshift(profile.businessType);
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            <Sidebar
                mobileMenuOpen={mobileMenuOpen}
                setMobileMenuOpen={setMobileMenuOpen}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />

            <div
                className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
                    isMinimized ? 'md:ml-20' : 'md:ml-[260px]'
                }`}
            >
                <Header
                    mobileMenuOpen={mobileMenuOpen}
                    setMobileMenuOpen={setMobileMenuOpen}
                    isMinimized={isMinimized}
                    setIsMinimized={setIsMinimized}
                />

                <main className="mt-16 flex-1 overflow-y-auto px-4 py-5">
                    <div className="w-full">
                        <div className="mb-6">
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                                My Profile
                            </h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Update your account details
                            </p>
                        </div>

                        {loading ? (
                            <ProfileSkeleton />
                        ) : (
                            <>
                                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                                    <div className="flex items-center space-x-4">
                                        <div className="h-16 w-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-semibold">
                                            {getInitials(profile.fullName)}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {profile.fullName || 'Your name'}
                                            </h2>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {profile.firmName || 'Your firm'}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="inline-flex items-center">
                                                    <FiMail className="mr-1 h-3 w-3" />
                                                    {profile.email || 'No email'}
                                                </span>
                                                <span className="inline-flex items-center">
                                                    <FiPhone className="mr-1 h-3 w-3" />
                                                    {profile.countryCode} {profile.phone || 'Add phone number'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    <div className="col-span-1">
                                        <form
                                            onSubmit={handleProfileSubmit}
                                            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6"
                                        >
                                            <div className="flex items-center space-x-2 mb-2">
                                                <FiUser className="text-indigo-500" />
                                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    Account details
                                                </h3>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Full name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={profile.fullName}
                                                        onChange={(e) =>
                                                            handleProfileChange('fullName', e.target.value)
                                                        }
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                        placeholder="Your full name"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Firm name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={profile.firmName}
                                                        onChange={(e) =>
                                                            handleProfileChange('firmName', e.target.value)
                                                        }
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                        placeholder="Your firm name"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Email address
                                                    </label>
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                                                            <FiMail className="h-4 w-4" />
                                                        </span>
                                                        <input
                                                            type="email"
                                                            value={profile.email}
                                                            readOnly
                                                            className="block w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 cursor-not-allowed"
                                                        />
                                                    </div>
                                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                        Email cannot be changed
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Country code
                                                    </label>
                                                    <SearchableSelect
                                                        value={profile.countryCode}
                                                        onChange={(e) =>
                                                            handleProfileChange('countryCode', e.target.value)
                                                        }
                                                        options={countryCodeOptions.map((item) => ({ value: item.code, label: item.label }))}
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Phone (WhatsApp)
                                                    </label>
                                                    <div className="relative">
                                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                                                            <FiPhone className="h-4 w-4" />
                                                        </span>
                                                        <input
                                                            type="tel"
                                                            value={profile.phone}
                                                            onChange={(e) =>
                                                                handleProfileChange('phone', e.target.value)
                                                            }
                                                            className="block w-full pl-9 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            placeholder="9876543210"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Gender
                                                    </label>
                                                    <SearchableSelect
                                                        value={profile.gender}
                                                        onChange={(e) =>
                                                            handleProfileChange('gender', e.target.value)
                                                        }
                                                        options={[
                                                            { value: 'male', label: 'Male' },
                                                            { value: 'female', label: 'Female' },
                                                            { value: 'others', label: 'Others' },
                                                        ]}
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Business name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={profile.businessName}
                                                        onChange={(e) =>
                                                            handleProfileChange('businessName', e.target.value)
                                                        }
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                        placeholder="Registered business name"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Business type
                                                    </label>
                                                    <SearchableSelect
                                                        value={profile.businessType}
                                                        onChange={(e) =>
                                                            handleProfileChange('businessType', e.target.value)
                                                        }
                                                        options={[{ value: '', label: 'Select business type' }, ...businessTypeOptions.map((type) => ({ value: type, label: type }))]}
                                                        placeholder="Select business type"
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end">
                                                <button
                                                    type="submit"
                                                    disabled={saving || loading}
                                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <FiSave className="mr-2 h-4 w-4" />
                                                    {saving ? 'Saving...' : 'Save changes'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MyProfile;
