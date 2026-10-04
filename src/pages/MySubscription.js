import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiCreditCard, FiX, FiDollarSign, FiEye } from 'react-icons/fi';
import RowActionMenu from '../component/table/RowActionMenu';
import RecordDetailsModal from '../component/table/RecordDetailsModal';
import { TableSkeletonRows } from '../component/table/TableSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Header, Sidebar } from '../component/Menu';
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
    // Selected projects for renewal: { [project_id]: 'monthly' | 'yearly' }
    const [selectedForRenewal, setSelectedForRenewal] = useState({});
    const [loading, setLoading] = useState(true);
    const [projectDetail, setProjectDetail] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showWalletRechargeModal, setShowWalletRechargeModal] = useState(false);
    const [walletRechargeAmount, setWalletRechargeAmount] = useState(0);

    const navigate = useNavigate();
    const paymentSectionRef = useRef(null);

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
                packageRecord.reduce((acc, r) => ({ ...acc, [r.project_id]: 'monthly' }), {})
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

            {/* Main content */}
            <div className={`pt-16 transition-all duration-300 ease-in-out ${isMinimized ? 'md:pl-20' : 'md:pl-[260px]'}`}>
                <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                    {/* Page header */}
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">My Subscription</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Plans are per project. View package pricing and project validity below.</p>
                    </div>

                    {loading ? (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
                                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-24 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                                    <div className="h-24 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            {['#', '', 'Project', 'Billing', 'Cost', 'Status', 'Valid until', ''].map((label, index) => (
                                                <th key={`${label}-${index}`} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <TableSkeletonRows rows={5} cells={['index', 'short', 'text', 'short', 'short', 'badge', 'short', 'action']} />
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Package pricing - no tab, show both */}
                            {subscriptionPackage && (
                                <div className="mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Subscription Package</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select projects below and choose Monthly or Yearly per project.</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monthly</div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                ₹{subscriptionPackage.monthly?.amount ? Number(subscriptionPackage.monthly.amount).toLocaleString() : '0'}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">per project</div>
                                        </div>
                                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Yearly</div>
                                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                                ₹{subscriptionPackage.yearly?.amount ? Number(subscriptionPackage.yearly.amount).toLocaleString() : '0'}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">per project</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Project subscription status (package_record) - with checkbox and per-project billing */}
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Select projects for renewal</h2>
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[640px]">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60">
                                                    <th className="w-12 pl-5 pr-2 py-3.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">#</th>
                                                    <th className="w-14 pl-5 pr-3 py-3.5 text-left">
                                                        <div className="flex items-center gap-2">
                                                            <AnimatedCheckbox
                                                                checked={allSelected}
                                                                indeterminate={someSelected && !allSelected}
                                                                onChange={(checked) => {
                                                                    if (checked) setSelectedForRenewal(packageRecord.reduce((acc, r) => ({ ...acc, [r.project_id]: 'monthly' }), {}));
                                                                    else setSelectedForRenewal({});
                                                                }}
                                                                aria-label="All projects"
                                                            />
                                                        </div>
                                                    </th>
                                                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Project</th>
                                                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Billing</th>
                                                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Renewal cost</th>
                                                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                    <th className="text-left px-4 py-3.5 pr-5 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Valid until</th>
                                                    <th className="w-16 px-3 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {packageRecord.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                                                            No projects found
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    packageRecord.map((record, index) => {
                                                        const isSelected = !!selectedForRenewal[record.project_id];
                                                        const cycle = selectedForRenewal[record.project_id] || 'monthly';
                                                        const renewalAmount = getAmountForCycle(cycle);
                                                        const expired = record.has_package_record && record.end_date && isValidityExpired(record.end_date);
                                                        return (
                                                            <tr
                                                                key={record.project_id}
                                                                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                                                            >
                                                                <td className="pl-5 pr-2 py-3 text-center text-sm text-gray-500 dark:text-gray-400">{index + 1}</td>
                                                                <td className="pl-5 pr-3 py-3 align-middle">
                                                                    <AnimatedCheckbox
                                                                        checked={isSelected}
                                                                        indeterminate={false}
                                                                        onChange={(checked) => {
                                                                            if (checked) setSelectedForRenewal((prev) => ({ ...prev, [record.project_id]: 'monthly' }));
                                                                            else setSelectedForRenewal((prev) => {
                                                                                const next = { ...prev };
                                                                                delete next[record.project_id];
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        aria-label={`Select ${record.project_name || record.project_id}`}
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{record.project_name || record.project_id}</td>
                                                                <td className="px-4 py-3">
                                                                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-gray-700/50">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => isSelected && setProjectBillingCycle(record.project_id, 'monthly')}
                                                                            disabled={!isSelected}
                                                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cycle === 'monthly'
                                                                                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-gray-600'
                                                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:hover:text-gray-600'
                                                                                }`}
                                                                        >
                                                                            Monthly
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => isSelected && setProjectBillingCycle(record.project_id, 'yearly')}
                                                                            disabled={!isSelected}
                                                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cycle === 'yearly'
                                                                                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200 dark:border-gray-600'
                                                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:hover:text-gray-600'
                                                                                }`}
                                                                        >
                                                                            Yearly
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                                    {isSelected ? (
                                                                        <span className="text-indigo-600 dark:text-indigo-400">₹{renewalAmount.toLocaleString()}</span>
                                                                    ) : (
                                                                        <span className="text-gray-400 dark:text-gray-500">—</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {record.has_package_record ? (
                                                                        expired ? (
                                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                                                                Expired
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                                                                <FiCheck className="w-3 h-3" />
                                                                                Active
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                                                            No plan
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 pr-5 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                                    {formatValidity(record)}
                                                                </td>
                                                                <td className="px-3 py-3 text-right">
                                                                    <RowActionMenu
                                                                        items={[{
                                                                            label: 'Details',
                                                                            icon: <FiEye className="w-4 h-4" />,
                                                                            onClick: () => setProjectDetail(record),
                                                                        }]}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Payment CTA */}
                            {subscriptionPackage && (
                                <div ref={paymentSectionRef} className="fixed sm:static bottom-0 left-0 right-0 bg-gray-50 dark:bg-gray-800/80 border-t sm:border sm:border-gray-200 dark:border-gray-700 sm:rounded-xl p-4 sm:p-6 shadow-lg sm:shadow-none z-10">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {getSelectedSummary().length === 0
                                                    ? 'Select projects for renewal'
                                                    : `${getSelectedSummary().length} project(s) selected — ₹${getTotalAmount().toLocaleString()} total`}
                                            </h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                Choose projects above and set Monthly or Yearly per project.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowPaymentModal(true)}
                                            disabled={getTotalAmount() < 1}
                                            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            <FiCreditCard className="mr-2 w-4 h-4" />
                                            Continue to Payment
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
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