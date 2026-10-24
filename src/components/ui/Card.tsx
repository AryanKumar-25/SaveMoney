import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'flat' | 'dashed' | 'active';
  padded?: boolean;
}

export function Card({
  children,
  className = '',
  variant = 'default',
  padded = true,
  ...props
}: CardProps) {
  const baseClasses = 'rounded-2xl transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-card hover:shadow-card-hover',
    flat: 'bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800',
    dashed: 'bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-primary/60 hover:bg-brand-50/20 cursor-pointer',
    active: 'bg-white dark:bg-slate-900 border-2 border-brand-primary shadow-glow',
  };

  const paddingClass = padded ? 'p-5 sm:p-6' : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div>
        <h3 className="text-base sm:text-lg font-bold text-navy-900 dark:text-slate-100 tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
