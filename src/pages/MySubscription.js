import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiCreditCard, FiX, FiDollarSign } from 'react-icons/fi';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Header, Sidebar } from '../component/Menu';
import Pagination from '../component/Pagination';
import toast from 'react-hot-toast';
import { getSubscriptionPacks, purchasePlan } from '../api/auth';

// Custom animated checkbox: checked, indeterminate, onChange
function AnimatedCheckbox({ checked, indeterminate, onChange, 'aria-label': ariaLabel }) {
    const inputRef = useRef(null);
    useEffect(() => {
        if (inputRef.current) inputRef.current.indeterminate = !!indeterminate;
    }, [indeterminate]);
    const isFilled = checked || indeterminate;
    return (
        <label className="relative inline-flex items-center justify-center cursor-pointer select-none group">
            <input
                ref={inputRef}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                aria-label={ariaLabel}
                className="sr-only peer"
            />
            <span
                role="presentation"
                className={`relative w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-offset-gray-900 ${isFilled
                    ? 'border-indigo-600 bg-indigo-600 dark:border-indigo-500 dark:bg-indigo-500'
                    : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700 group-hover:border-indigo-400 dark:group-hover:border-indigo-500'
                    }`}
            >
                {indeterminate && !checked && (
                    <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.15 }}
                        className="absolute w-2.5 h-0.5 rounded-full bg-white"
                    />
                )}
                {checked && (
                    <motion.svg
                        viewBox="0 0 12 12"
                        className="w-3 h-3 text-white relative flex-shrink-0"
                        initial={false}
                        animate={{ opacity: 1 }}
                    >
                        <motion.path
                            d="M2 6l3 3 5-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        />
                    </motion.svg>
                )}
            </span>
        </label>
    );
}

function MySubscription() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        const saved = localStorage.getItem('sidebarMinimized');
        return saved ? JSON.parse(saved) : false;
    });
    const [subscriptionPackage, setSubscriptionPackage] = useState(null); // { monthly: { amount, package_id }, yearly: { amount, package_id } }
    const [packageRecord, setPackageRecord] = useState([]); // [{ project_id, project_name, has_package_record, end_date? }]
    const [projectPage, setProjectPage] = useState(1);
    const [projectPageSize, setProjectPageSize] = useState(20);
    // Selected projects for renewal: { [project_id]: 'monthly' | 'yearly' }
    const [selectedForRenewal, setSelectedForRenewal] = useState({});
    const [billingDefault, setBillingDefault] = useState('monthly');
    const [loading, setLoading] = useState(true);
    const [projectDetail, setProjectDetail] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showWalletRechargeModal, setShowWalletRechargeModal] = useState(false);
    const [walletRechargeAmount, setWalletRechargeAmount] = useState(0);

    const navigate = useNavigate();
    const paymentSectionRef = useRef(null);

    const projectPageCount = Math.max(1, Math.ceil(packageRecord.length / projectPageSize) || 1);
    const safeProjectPage = Math.min(projectPage, projectPageCount);
    const pagedProjects = packageRecord.slice(
        (safeProjectPage - 1) * projectPageSize,
        safeProjectPage * projectPageSize
    );

    // Persist sidebar minimized state
    useEffect(() => {
        localStorage.setItem('sidebarMinimized', JSON.stringify(isMinimized));
    }, [isMinimized]);

    // Lock body scroll when mobile sidebar is open
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

    // Lock body scroll when modals are open
    useEffect(() => {
        if (showPaymentModal || showWalletRechargeModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showPaymentModal, showWalletRechargeModal]);

    // Fetch package pricing and project subscription records
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await getSubscriptionPacks();
                if (response.error) {
                    throw new Error(response.msg || 'Failed to fetch subscription data');
                }
                const data = response.data || {};
                setSubscriptionPackage(data.package || null);
                setPackageRecord(Array.isArray(data.package_record) ? data.package_record : []);
            } catch (error) {
                console.error('Failed to fetch subscription:', error);
                toast.error(error.message || 'Failed to load plan');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Amount for a billing cycle from package
    const getAmountForCycle = (cycle) => {
        if (!subscriptionPackage || !subscriptionPackage[cycle]) return 0;
        const amt = subscriptionPackage[cycle].amount;
        return parseFloat(String(amt), 10) || 0;
    };

    // Selected projects with cycle and amount for summary
    const getSelectedSummary = () => {
        if (!subscriptionPackage) return [];
        return packageRecord
            .filter((r) => selectedForRenewal[r.project_id])
            .map((r) => {
                const cycle = selectedForRenewal[r.project_id];
                return {
                    project_id: r.project_id,
                    project_name: r.project_name || r.project_id,
                    billingCycle: cycle,
                    amount: getAmountForCycle(cycle)
                };
            });
    };

    // Total amount for all selected projects
    const getTotalAmount = () => getSelectedSummary().reduce((sum, item) => sum + item.amount, 0);

    const toggleProjectSelection = (projectId, defaultCycle = 'monthly') => {
        setSelectedForRenewal((prev) => {
            const next = { ...prev };
            if (next[projectId]) {
                delete next[projectId];
            } else {
                next[projectId] = defaultCycle;
            }
            return next;
        });
    };

    const setProjectBillingCycle = (projectId, cycle) => {
        setSelectedForRenewal((prev) => (prev[projectId] ? { ...prev, [projectId]: cycle } : prev));
    };

    // Select all / deselect all
    const allSelected = packageRecord.length > 0 && packageRecord.every((r) => selectedForRenewal[r.project_id]);
    const someSelected = packageRecord.some((r) => selectedForRenewal[r.project_id]);
    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedForRenewal({});
        } else {
            setSelectedForRenewal(
                packageRecord.reduce((acc, r) => ({ ...acc, [r.project_id]: billingDefault }), {})
            );
        }
    };

    // Confirm purchase - call /plan/purchase
    const handleConfirmPurchase = async () => {
        const summary = getSelectedSummary();
        if (!summary.length || !subscriptionPackage) {
            toast.error('Select at least one project for renewal');
            return;
        }
        const project = summary.map((item) => ({
            project_id: item.project_id,
            package_id: subscriptionPackage[item.billingCycle]?.package_id || (item.billingCycle === 'yearly' ? 'PROJECT_1Y' : 'PROJECT_1M')
        }));
        setProcessing(true);
        try {
            const response = await purchasePlan({ project });
            if (response.error) {
                const errMsg = typeof response.error === 'string' ? response.error : response.msg || 'Purchase failed';
                toast.error(errMsg);
                return;
            }
            toast.success(response.msg || 'Plan purchased successfully');
            setShowPaymentModal(false);
            setSelectedForRenewal({});
            // Refresh subscription data
            const refresh = await getSubscriptionPacks();
            if (!refresh.error && refresh.data) {
                setSubscriptionPackage(refresh.data.package || null);
                setPackageRecord(Array.isArray(refresh.data.package_record) ? refresh.data.package_record : []);
            }
        } catch (error) {
            console.error('Purchase error:', error);
            if (error.response?.status === 402) {
                setWalletRechargeAmount(getTotalAmount());
                setShowPaymentModal(false);
                setShowWalletRechargeModal(true);
            } else {
                toast.error(error.response?.data?.error || error.message || 'Failed to purchase plan');
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleWalletRechargeNavigate = () => {
        setShowWalletRechargeModal(false);
        navigate(`/wallet-recharge/${walletRechargeAmount}`);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return '—';
        }
    };

    // Days left from today to end_date (negative if expired)
    const getDaysLeft = (endDateStr) => {
        if (!endDateStr) return null;
        try {
            const end = new Date(endDateStr);
            end.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor((end - today) / (24 * 60 * 60 * 1000));
        } catch (e) {
            return null;
        }
    };

    const isValidityExpired = (endDateStr) => {
        const days = getDaysLeft(endDateStr);
        return days !== null && days < 0;
    };

    const formatValidity = (record) => {
        if (!record.has_package_record || !record.end_date) return '—';
        const days = getDaysLeft(record.end_date);
        if (days === null) return formatDate(record.end_date);
        const dateStr = formatDate(record.end_date);
        if (days < 0) return dateStr; // Status column already shows "Expired"
        return (
            <span>
                {dateStr}
                <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">({days} {days === 1 ? 'day' : 'days'} left)</span>
            </span>
        );
    };

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

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="w-full max-w-[1320px] px-4 sm:px-7 py-7">
                    <div className="mb-6">
                        <h1 className="oc-page-title">My subscription</h1>
                        <p className="oc-page-sub">Renew projects from your wallet balance.</p>
                    </div>
                    <div>
                    {loading ? (
                        <div className="oc-card p-6 animate-pulse space-y-3">
                            <div className="h-5 bg-[#F0EEF6] rounded w-1/3" />
                            <div className="h-16 bg-[#F0EEF6] rounded-[12px]" />
                            <div className="h-16 bg-[#F0EEF6] rounded-[12px]" />
                        </div>
                    ) : (
                        <>
                            {(() => {
                                const summary = getSelectedSummary();
                                const selectedCount = summary.length;
                                const total = getTotalAmount();
                                const cycles = [...new Set(summary.map((item) => item.billingCycle))];
                                const uniformCycle = cycles.length === 1 ? cycles[0] : null;
                                const billingLabel = uniformCycle === 'yearly' ? 'Yearly' : uniformCycle === 'monthly' ? 'Monthly' : (cycles.length > 1 ? 'Mixed' : (billingDefault === 'yearly' ? 'Yearly' : 'Monthly'));
                                const amounts = [...new Set(summary.map((item) => item.amount))];
                                const unitAmount = selectedCount === 0
                                    ? getAmountForCycle(billingDefault)
                                    : (amounts.length === 1 ? amounts[0] : null);
                                let walletBalance = null;
                                try {
                                    const stored = JSON.parse(localStorage.getItem('userData') || 'null');
                                    if (stored && stored.balance != null && stored.balance !== '') {
                                        const parsedBalance = Number(stored.balance);
                                        walletBalance = Number.isFinite(parsedBalance) ? parsedBalance : null;
                                    }
                                } catch (_) {}
                                const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                const applyCycle = (cycle) => {
                                    setBillingDefault(cycle);
                                    setSelectedForRenewal((prev) => {
                                        const next = { ...prev };
                                        Object.keys(next).forEach((id) => { next[id] = cycle; });
                                        return next;
                                    });
                                };
                                const statusFor = (record) => {
                                    if (!record.has_package_record) return { label: 'No plan', className: 'bg-[#F3F2FA] text-ink-500' };
                                    const days = getDaysLeft(record.end_date);
                                    if (days != null && days < 0) return { label: 'Expired', className: 'bg-red-50 text-red-600' };
                                    if (days != null && days <= 30) return { label: 'Expires soon', className: 'bg-amber-50 text-amber-700' };
                                    return { label: 'Active', className: 'bg-emerald-50 text-emerald-700' };
                                };
                                return (
                                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
                                        <section className="oc-card p-4 sm:p-5">
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <h2 className="text-[15px] font-bold text-ink">Select projects to renew</h2>
                                                <div className="inline-flex rounded-[9px] border border-line bg-[#F6F5FA] p-0.5">
                                                    {['monthly', 'yearly'].map((cycle) => (
                                                        <button
                                                            key={cycle}
                                                            type="button"
                                                            onClick={() => applyCycle(cycle)}
                                                            className={`h-7 px-3 rounded-[7px] text-xs font-semibold ${uniformCycle === cycle || (selectedCount === 0 && billingDefault === cycle) ? 'bg-white text-ink shadow-sm' : 'text-ink-500'}`}
                                                        >
                                                            {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {packageRecord.length > 0 && (
                                                <div className="mb-3 flex items-center gap-2">
                                                    <AnimatedCheckbox
                                                        checked={allSelected}
                                                        indeterminate={someSelected && !allSelected}
                                                        onChange={() => handleSelectAll()}
                                                        aria-label="All projects"
                                                    />
                                                    <span className="text-sm text-ink-500">All projects</span>
                                                </div>
                                            )}
                                            <div className="space-y-2.5">
                                                {packageRecord.length === 0 ? (
                                                    <p className="py-8 text-center text-sm text-ink-500">No projects found</p>
                                                ) : pagedProjects.map((record) => {
                                                    const isSelected = !!selectedForRenewal[record.project_id];
                                                    const cycle = selectedForRenewal[record.project_id] || billingDefault;
                                                    const status = statusFor(record);
                                                    const validLabel = record.has_package_record && record.end_date ? formatDate(record.end_date) : '';
                                                    return (
                                                        <div key={record.project_id} className={`rounded-[12px] border p-3.5 ${isSelected ? 'border-brand-600 bg-brand-50' : 'border-line bg-white'}`}>
                                                            <div className="flex items-start gap-3">
                                                                <AnimatedCheckbox
                                                                    checked={isSelected}
                                                                    indeterminate={false}
                                                                    onChange={() => toggleProjectSelection(record.project_id, billingDefault)}
                                                                    aria-label={`Select ${record.project_name || record.project_id}`}
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="text-sm font-semibold text-ink truncate">{record.project_name || record.project_id}</p>
                                                                            {validLabel && validLabel !== '—' && (
                                                                                <p className="mt-0.5 text-xs text-ink-500">Valid until {validLabel}</p>
                                                                            )}
                                                                        </div>
                                                                        <span className={`oc-badge ${status.className}`}>{status.label}</span>
                                                                    </div>
                                                                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                                                                        <div className="inline-flex rounded-[9px] border border-line bg-white p-0.5">
                                                                            {['monthly', 'yearly'].map((option) => (
                                                                                <button
                                                                                    key={option}
                                                                                    type="button"
                                                                                    onClick={() => isSelected && setProjectBillingCycle(record.project_id, option)}
                                                                                    disabled={!isSelected}
                                                                                    className={`h-7 px-2.5 rounded-[7px] text-xs font-semibold disabled:cursor-not-allowed ${cycle === option ? 'bg-brand-50 text-brand-800' : 'text-ink-500'}`}
                                                                                >
                                                                                    {option === 'monthly' ? 'Monthly' : 'Yearly'}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            {isSelected && (
                                                                                <span className="oc-num text-sm text-ink">{money(getAmountForCycle(cycle))}</span>
                                                                            )}
                                                                            <button type="button" onClick={() => setProjectDetail(record)} className="text-xs font-semibold text-ink-500 hover:text-ink">
                                                                                Details
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {packageRecord.length > 0 ? (
                                                <Pagination
                                                    currentPage={safeProjectPage}
                                                    totalPages={projectPageCount}
                                                    totalRecords={packageRecord.length}
                                                    pageSize={projectPageSize}
                                                    onPageChange={setProjectPage}
                                                    onPageSizeChange={(size) => {
                                                        setProjectPageSize(size);
                                                        setProjectPage(1);
                                                    }}
                                                    pageSizeOptions={[10, 20, 50, 100]}
                                                />
                                            ) : null}
                                        </section>
                                        {subscriptionPackage && (
                                            <aside ref={paymentSectionRef} className="oc-card p-5 xl:sticky xl:top-24">
                                                <h2 className="text-[15px] font-bold text-ink">Order summary</h2>
                                                <dl className="mt-4 space-y-3 text-sm">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <dt className="text-ink-500">Projects selected</dt>
                                                        <dd className="font-semibold text-ink">{selectedCount}</dd>
                                                    </div>
                                                    {billingLabel && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <dt className="text-ink-500">Billing</dt>
                                                            <dd className="font-semibold text-ink">{billingLabel}</dd>
                                                        </div>
                                                    )}
                                                    {unitAmount != null && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <dt className="text-ink-500">Renewal cost per project</dt>
                                                            <dd className="oc-num text-ink">{money(unitAmount)}</dd>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
                                                        <dt className="font-semibold text-ink">Total</dt>
                                                        <dd className="oc-num text-ink">{money(total)}</dd>
                                                    </div>
                                                    {walletBalance != null && (
                                                        <div className="flex items-center justify-between gap-3">
                                                            <dt className="text-ink-500">Wallet balance</dt>
                                                            <dd className="oc-num text-ink">{money(walletBalance)}</dd>
                                                        </div>
                                                    )}
                                                </dl>
                                                {walletBalance != null && total > walletBalance && (
                                                    <div className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                                                        If your wallet balance is lower than the total, recharge first.{' '}
                                                        <button type="button" onClick={() => navigate('/wallet-recharge')} className="font-semibold text-brand-800 underline">
                                                            Recharge wallet
                                                        </button>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPaymentModal(true)}
                                                    disabled={total < 1}
                                                    className="oc-btn-primary w-full mt-4"
                                                >
                                                    {selectedCount > 0 ? `Renew ${selectedCount} project${selectedCount === 1 ? '' : 's'}` : 'Renew projects'}
                                                </button>
                                            </aside>
                                        )}
                                    </div>
                                );
                            })()}
                        </>
                    )}
                    </div>
                </div>
            </div>

            {/* Billing Summary Confirm Modal */}
            <AnimatePresence>
                {showPaymentModal && (
                    <motion.div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => !processing && setShowPaymentModal(false)}
                    >
                        <motion.div
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 px-6 py-4 flex items-center justify-between z-10">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Billing Summary</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Confirm your selection</p>
                                </div>
                                <button
                                    onClick={() => !processing && setShowPaymentModal(false)}
                                    disabled={processing}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
                                >
                                    <FiX size={24} />
                                </button>
                            </div>

                            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-600">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Order Summary</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {getSelectedSummary().map((item) => (
                                        <div key={item.project_id} className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400 truncate pr-2">
                                                {item.project_name} <span className="text-gray-400 dark:text-gray-500">({item.billingCycle})</span>
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white flex-shrink-0">
                                                ₹{item.amount.toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex items-center justify-between">
                                        <span className="text-base font-semibold text-gray-900 dark:text-white">Total</span>
                                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                            ₹{getTotalAmount().toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col sm:flex-row gap-3 justify-end">
                                <button
                                    onClick={() => setShowPaymentModal(false)}
                                    disabled={processing}
                                    className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmPurchase}
                                    disabled={processing}
                                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {processing ? (
                                        <>
                                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <FiCheck className="mr-2 w-4 h-4" />
                                            Confirm
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Wallet Recharge Modal (402 - insufficient balance) */}
            <AnimatePresence>
                {showWalletRechargeModal && (
                    <motion.div
                        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowWalletRechargeModal(false)}
                    >
                        <motion.div
                            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-6 text-center">
                                <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                                    <FiDollarSign className="w-7 h-7 text-amber-600 dark:text-amber-400" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Insufficient wallet balance</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Your wallet balance is not enough to complete this purchase. Please recharge your wallet to continue.
                                </p>
                                <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 mb-6">
                                    Amount due: ₹{Number(walletRechargeAmount).toLocaleString()}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button
                                        onClick={() => setShowWalletRechargeModal(false)}
                                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleWalletRechargeNavigate}
                                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        <FiCreditCard className="mr-2 w-4 h-4" />
                                        Recharge wallet
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <RecordDetailsModal
                isOpen={Boolean(projectDetail)}
                onClose={() => setProjectDetail(null)}
                title={projectDetail?.project_name || projectDetail?.project_id || 'Project'}
                fields={projectDetail ? [
                    { label: 'Project ID', value: projectDetail.project_id },
                    { label: 'Status', value: projectDetail.has_package_record ? (projectDetail.end_date && isValidityExpired(projectDetail.end_date) ? 'Expired' : 'Active') : 'No plan' },
                    { label: 'Valid until', value: formatValidity(projectDetail) },
                    { label: 'End date', value: projectDetail.end_date },
                ] : []}
            />
        </div>
    );
}

export default MySubscription;