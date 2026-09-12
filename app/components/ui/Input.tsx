"use client";

import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  endAdornment?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, endAdornment, id, className = "", ...rest },
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
      <div className="relative">
        <input id={inputId} ref={ref} className={`input ${error ? "!border-danger" : ""} ${endAdornment ? "pr-16" : ""} ${className}`} aria-invalid={!!error} {...rest} />
        {endAdornment && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-muted">
            {endAdornment}
          </span>
        )}
      </div>
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