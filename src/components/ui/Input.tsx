import React, { forwardRef } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, suffix, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 font-semibold text-sm">
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-xl border bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 text-sm font-medium transition-all duration-150 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-primary disabled:opacity-50 disabled:bg-slate-50 ${
              prefix ? 'pl-9' : 'pl-3.5'
            } ${suffix ? 'pr-10' : 'pr-3.5'} py-2.5 ${
              error
                ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
                : 'border-slate-200 dark:border-slate-800'
            } ${className}`}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3.5 flex items-center text-slate-400 dark:text-slate-500 text-sm">
              {suffix}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
        {hint && !error && (
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
