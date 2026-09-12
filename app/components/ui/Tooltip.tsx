"use client";

import { useState, useRef, type ReactNode } from "react";

interface TooltipProps {
  content: string;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timer = useRef<number | null>(null);

  const open = () => {
    timer.current = window.setTimeout(() => setShow(true), 300);
  };
  const close = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setShow(false);
  };

  return (
    <span className="relative inline-flex" tabIndex={0} onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close}>
      {children}
      {show && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-bg-elevated px-2.5 py-1 text-xs text-fg shadow-pop"
        >
          {content}
        </span>
      )}
    </span>
  );
}