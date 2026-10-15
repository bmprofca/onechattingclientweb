import React, { useEffect, useRef, useState } from 'react';

export const MODAL_EXIT_MS = 180;

/**
 * Adds enter + exit animation to an existing modal without changing its markup.
 *
 * Usage — keep the original condition inside so closed-state data is never read:
 *   <AnimatedModal open={showX}>
 *     {showX && (<div className="fixed inset-0 ...">...</div>)}
 *   </AnimatedModal>
 *
 * While closing, the last rendered children stay mounted for MODAL_EXIT_MS so the
 * CSS exit animation (.oc-modal.is-closing in index.css) can play.
 */
export default function AnimatedModal({ open, children }) {
    const isOpen = Boolean(open);
    const lastChildren = useRef(null);
    const [mounted, setMounted] = useState(isOpen);
    const [closing, setClosing] = useState(false);

    if (isOpen && children) lastChildren.current = children;

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            setClosing(false);
            return undefined;
        }
        if (!mounted) return undefined;
        setClosing(true);
        const timer = setTimeout(() => {
            setMounted(false);
            setClosing(false);
            lastChildren.current = null;
        }, MODAL_EXIT_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen && !mounted) return null;
    const content = isOpen ? children : lastChildren.current;
    if (!content) return null;

    return <div className={`oc-modal${closing && !isOpen ? ' is-closing' : ''}`}>{content}</div>;
}
