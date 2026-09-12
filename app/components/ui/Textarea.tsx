"use client";

import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className = "", ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        className={`min-h-[120px] w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm text-fg placeholder:text-fg-faint transition-colors focus:border-accent focus:outline-none ${error ? "!border-danger" : ""} ${className}`}
        aria-invalid={!!error}
        {...rest}
      />
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-danger" role="alert">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-fg-faint">{hint}</p>
      ) : null}
    </div>
  );
});