"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** When false, backdrop click / Esc are disabled. */
  dismissible?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Small delay to let the DOM render
      requestAnimationFrame(() => panelRef.current?.focus());
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose, dismissible],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby={title ? "modal-title" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        style={{
          /* Reduced motion: skip the background fade */
          animationDuration: "var(--motion-long, 250ms)",
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md border border-line bg-bg-elevated p-6 shadow-modal animate-slide-up outline-none"
      >
        <div className="flex items-center justify-between gap-4">
          {title && (
            <h2 id="modal-title" className="text-base font-semibold text-fg">
              {title}
            </h2>
          )}
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost ml-auto h-8 w-8 !px-0"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}