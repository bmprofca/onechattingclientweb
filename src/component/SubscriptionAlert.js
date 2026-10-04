import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiX } from 'react-icons/fi';

const daysUntil = (endDate) => {
    const match = String(endDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((end.getTime() - today.getTime()) / 86400000);
};

const dismissKey = (projectId, endDate) => `subscription-warning-dismissed:${projectId}:${endDate}`;

export default function SubscriptionAlert({ isMinimized, isFullScreen }) {
    const navigate = useNavigate();
    const status = useSelector((state) => state.project?.status);
    const owned = useSelector((state) => state.project?.owned);
    const endDate = useSelector((state) => state.project?.subscriptionEndDate);
    const projectId = useSelector((state) => state.project?.projectId);
    const projectName = useSelector((state) => state.project?.projectName);
    const [dismissed, setDismissed] = useState(false);

    const daysLeft = daysUntil(endDate);
    const noPlan = !endDate;
    const expired = noPlan || (daysLeft !== null && daysLeft < 0);
    const expiringSoon = !noPlan && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
    const isAdmin = owned === true;
    const visible = status === 'succeeded' && projectId && !isFullScreen && (
        expired || (expiringSoon && isAdmin && !dismissed)
    );

    useEffect(() => {
        if (!projectId || !endDate) {
            setDismissed(false);
            return;
        }
        setDismissed(sessionStorage.getItem(dismissKey(projectId, endDate)) === '1');
    }, [projectId, endDate]);

    useEffect(() => {
        const root = document.documentElement;
        if (!visible) {
            document.body.classList.remove('subscription-alert-open');
            root.style.setProperty('--subscription-alert-height', '0px');
            return undefined;
        }
        document.body.classList.add('subscription-alert-open');
        let frame = 0;
        const applyHeight = () => {
            const height = document.getElementById('subscription-alert')?.offsetHeight || 0;
            root.style.setProperty('--subscription-alert-height', `${height}px`);
        };
        frame = window.requestAnimationFrame(applyHeight);
        window.addEventListener('resize', applyHeight);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', applyHeight);
            document.body.classList.remove('subscription-alert-open');
            root.style.setProperty('--subscription-alert-height', '0px');
        };
    }, [visible, expired, isAdmin]);

    const dismiss = () => {
        if (projectId && endDate) {
            sessionStorage.setItem(dismissKey(projectId, endDate), '1');
        }
        setDismissed(true);
    };

    const projectLabel = `${projectName || 'Selected'} project`;
    const warningText = daysLeft === 0
        ? `${projectLabel} subscription expires today.`
        : `${projectLabel} subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    id="subscription-alert"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className={`absolute top-16 z-30 left-0 right-0 px-3 pt-2 sm:px-5 ${isMinimized ? 'md:left-20' : 'md:left-[260px]'}`}
                >
                    {expired ? (
                        <div className="flex h-9 items-center gap-2 rounded-lg border border-red-200/80 bg-gradient-to-r from-red-50 to-rose-50 px-2.5 text-red-700 shadow-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-100">
                                <FiAlertTriangle className="h-3.5 w-3.5" />
                            </span>
                            <p className="min-w-0 flex-1 truncate text-xs font-medium">
                                {isAdmin
                                    ? `${projectLabel} subscription has expired.`
                                    : `${projectLabel} subscription has expired. Contact the admin to renew it.`}
                            </p>
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => navigate('/my-subscription')}
                                    className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                                >
                                    Subscription
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex h-9 items-center gap-2 rounded-lg border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 text-amber-800 shadow-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-100">
                                <FiAlertTriangle className="h-3.5 w-3.5" />
                            </span>
                            <p className="min-w-0 flex-1 truncate text-xs font-medium">{warningText}</p>
                            <button
                                type="button"
                                onClick={dismiss}
                                className="shrink-0 rounded-md p-1 text-amber-700 transition hover:bg-amber-100"
                                aria-label="Dismiss subscription warning"
                            >
                                <FiX className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
