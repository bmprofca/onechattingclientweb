import React, { useState, useEffect } from 'react';
import { Header, Sidebar } from '../component/Menu';
import SearchableSelect from '../component/SearchableSelect';
import { fetchUserProfile, removeEmailWithOtp, sendEmailRemoveOtp, updateUserProfile } from '../api/auth';
import toast from 'react-hot-toast';

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
        <div className="bg-white dark:bg-gray-800 rounded-card border border-line dark:border-gray-700 p-6 mb-6 animate-pulse">
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
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-card border border-line dark:border-gray-700 p-6 space-y-6 animate-pulse">
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

            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-card border border-line dark:border-gray-700 p-6 space-y-5 animate-pulse">
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

const memberSinceLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

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

    const [savedProfile, setSavedProfile] = useState(null);
    const [profileMeta, setProfileMeta] = useState({ projectCount: null, memberSince: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [removeOpen, setRemoveOpen] = useState(false);
    const [removeOtp, setRemoveOtp] = useState('');
    const [otpHint, setOtpHint] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [removingEmail, setRemovingEmail] = useState(false);


    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                setLoading(true);
                const response = await fetchUserProfile();
                if (response && !response.error && response.profile) {
                    const mapped = mapProfileFromApi(response.profile);
                    setProfile(mapped);
                    setSavedProfile(mapped);
                    const since = response.profile.member_since || response.profile.created_at || response.profile.create_date || response.profile.joined_at || response.profile.created_date || '';
                    setProfileMeta({
                        projectCount: response.projects?.project_count == null ? null : Number(response.projects.project_count),
                        memberSince: memberSinceLabel(since),
                    });
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
        const email = profile.email.trim();
        if (savedProfile?.email && !email) {
            toast.error('To remove your email, confirm the code sent to your mobile.');
            setRemoveOpen(true);
            return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            toast.error('Enter a valid email');
            return;
        }
        try {
            setSaving(true);
            const response = await updateUserProfile({
                name: profile.fullName,
                country_code: profile.countryCode,
                mobile: profile.phone,
                ...(email ? { email } : {}),
                gender: profile.gender,
                firm_name: profile.firmName,
                business_name: profile.businessName,
                business_type: profile.businessType,
            });

            if (response && !response.error) {
                if (response.profile) {
                    const mapped = mapProfileFromApi(response.profile);
                    setProfile(mapped);
                    setSavedProfile(mapped);
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

    const handleCancel = () => {
        if (savedProfile) setProfile({ ...savedProfile });
        setRemoveOpen(false);
        setRemoveOtp('');
        setOtpHint('');
    };

    const rememberProfile = (nextProfile) => {
        const mapped = mapProfileFromApi(nextProfile);
        setProfile(mapped);
        setSavedProfile(mapped);
        try {
            const stored = JSON.parse(localStorage.getItem('userData') || 'null');
            if (stored) {
                localStorage.setItem('userData', JSON.stringify({ ...stored, profile: nextProfile }));
            }
        } catch (_) {}
    };

    const handleSendRemoveOtp = async () => {
        try {
            setSendingOtp(true);
            const response = await sendEmailRemoveOtp();
            if (response?.error) {
                toast.error(typeof response.error === 'string' ? response.error : 'Failed to send OTP');
                return;
            }
            const hint = [response.country_code, response.mobile_hint].filter(Boolean).join(' ');
            setOtpHint(hint);
            setRemoveOpen(true);
            toast.success(hint ? `Code sent to ${hint}` : 'Code sent to your mobile');
        } catch (error) {
            toast.error(error?.message || 'Failed to send OTP');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleConfirmRemoveEmail = async () => {
        if (!removeOtp.trim()) {
            toast.error('Enter the code sent to your mobile');
            return;
        }
        try {
            setRemovingEmail(true);
            const response = await removeEmailWithOtp({ otp: removeOtp.trim() });
            if (response?.error) {
                toast.error(typeof response.error === 'string' ? response.error : 'Failed to remove email');
                return;
            }
            if (response.profile) rememberProfile(response.profile);
            setRemoveOpen(false);
            setRemoveOtp('');
            setOtpHint('');
            toast.success(response.msg || 'Email removed');
        } catch (error) {
            toast.error(error?.message || 'Failed to remove email');
        } finally {
            setRemovingEmail(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const businessTypeOptions = [...BUSINESS_TYPES];
    if (
        profile.businessType &&
        !businessTypeOptions.includes(profile.businessType)
    ) {
        businessTypeOptions.unshift(profile.businessType);
    }

    const headerFacts = [
        profileMeta.projectCount != null
            ? `Owner of ${profileMeta.projectCount} project${profileMeta.projectCount === 1 ? '' : 's'}`
            : '',
        profileMeta.memberSince ? `member since ${profileMeta.memberSince}` : '',
    ].filter(Boolean);

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

            <div className={`pt-16 transition-all duration-300 ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <main className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-6">
                        <h1 className="oc-page-title">My profile</h1>
                        <p className="oc-page-sub">Your name, contact and business details.</p>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            <ProfileSkeleton />
                        ) : (
                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <div className="oc-card p-5 flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-full bg-brand-600 flex items-center justify-center text-white text-lg font-bold">
                                        {getInitials(profile.fullName)}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold text-ink truncate">{profile.fullName || 'Your name'}</h2>
                                        <p className="text-sm text-ink-500 truncate">
                                            {headerFacts.length ? headerFacts.join(' · ') : (profile.email || '')}
                                        </p>
                                    </div>
                                </div>

                                <section className="oc-card p-5">
                                    <h3 className="text-[15px] font-bold text-ink mb-4">Personal details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="oc-label" htmlFor="profile-name">Full name</label>
                                            <input
                                                id="profile-name"
                                                type="text"
                                                value={profile.fullName}
                                                onChange={(e) => handleProfileChange('fullName', e.target.value)}
                                                className="oc-input"
                                                placeholder="Your full name"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="oc-label" htmlFor="profile-email">Email</label>
                                            <input
                                                id="profile-email"
                                                type="email"
                                                value={profile.email}
                                                onChange={(e) => handleProfileChange('email', e.target.value)}
                                                className="oc-input"
                                                placeholder="name@company.com"
                                            />
                                            <p className="mt-1 text-xs text-ink-400">Add or change your email. Removing it needs a code sent to your mobile.</p>
                                            {savedProfile?.email ? (
                                                <div className="mt-3">
                                                    {!removeOpen ? (
                                                        <button
                                                            type="button"
                                                            onClick={handleSendRemoveOtp}
                                                            disabled={sendingOtp}
                                                            className="text-sm font-semibold text-red-600 hover:text-red-700"
                                                        >
                                                            {sendingOtp ? 'Sending code...' : 'Remove email'}
                                                        </button>
                                                    ) : (
                                                        <div className="rounded-[12px] border border-line bg-surface-soft p-3 space-y-2">
                                                            <p className="text-xs text-ink-500">
                                                                {otpHint ? `Enter the code sent to ${otpHint}.` : 'Enter the code sent to your mobile.'}
                                                            </p>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                autoComplete="one-time-code"
                                                                value={removeOtp}
                                                                onChange={(e) => setRemoveOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                                className="oc-input"
                                                                placeholder="6-digit code"
                                                            />
                                                            <div className="flex flex-wrap gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleConfirmRemoveEmail}
                                                                    disabled={removingEmail}
                                                                    className="oc-btn-primary h-9 px-3 text-sm"
                                                                >
                                                                    {removingEmail ? 'Removing...' : 'Confirm removal'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSendRemoveOtp}
                                                                    disabled={sendingOtp}
                                                                    className="oc-btn-ghost h-9 px-3 text-sm"
                                                                >
                                                                    {sendingOtp ? 'Sending...' : 'Resend code'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setRemoveOpen(false); setRemoveOtp(''); }}
                                                                    className="oc-btn-ghost h-9 px-3 text-sm"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div>
                                            <label className="oc-label" htmlFor="profile-phone">Mobile</label>
                                            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                                                <input
                                                    id="profile-country"
                                                    value={profile.countryCode}
                                                    readOnly
                                                    className="oc-input bg-surface-soft text-ink-500 cursor-not-allowed"
                                                />
                                                <input
                                                    id="profile-phone"
                                                    type="tel"
                                                    value={profile.phone}
                                                    readOnly
                                                    className="oc-input bg-surface-soft text-ink-500 cursor-not-allowed"
                                                />
                                            </div>
                                            <p className="mt-1 text-xs text-ink-400">Mobile number cannot be changed</p>
                                        </div>
                                        <div>
                                            <label className="oc-label" htmlFor="profile-gender">Gender</label>
                                            <SearchableSelect
                                                id="profile-gender"
                                                value={profile.gender}
                                                onChange={(e) => handleProfileChange('gender', e.target.value)}
                                                options={[
                                                    { value: 'male', label: 'Male' },
                                                    { value: 'female', label: 'Female' },
                                                    { value: 'others', label: 'Others' },
                                                ]}
                                                className="oc-input"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="oc-card p-5">
                                    <h3 className="text-[15px] font-bold text-ink mb-4">Business details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="oc-label" htmlFor="profile-firm">Firm name</label>
                                            <input
                                                id="profile-firm"
                                                type="text"
                                                value={profile.firmName}
                                                onChange={(e) => handleProfileChange('firmName', e.target.value)}
                                                className="oc-input"
                                                placeholder="Your firm name"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="oc-label" htmlFor="profile-type">Business type</label>
                                            <SearchableSelect
                                                id="profile-type"
                                                value={profile.businessType}
                                                onChange={(e) => handleProfileChange('businessType', e.target.value)}
                                                options={[{ value: '', label: 'Select business type' }, ...businessTypeOptions.map((type) => ({ value: type, label: type }))]}
                                                placeholder="Select business type"
                                                className="oc-input"
                                            />
                                        </div>
                                        <div>
                                            <label className="oc-label" htmlFor="profile-business">Registered business name</label>
                                            <input
                                                id="profile-business"
                                                type="text"
                                                value={profile.businessName}
                                                onChange={(e) => handleProfileChange('businessName', e.target.value)}
                                                className="oc-input"
                                                placeholder="Registered business name"
                                                required
                                            />
                                        </div>
                                    </div>
                                </section>

                                <div className="flex items-center justify-end gap-2">
                                    <button type="button" onClick={handleCancel} disabled={saving} className="oc-btn-ghost">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={saving || loading} className="oc-btn-primary">
                                        {saving ? 'Saving...' : 'Save changes'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MyProfile;
