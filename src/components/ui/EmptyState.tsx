import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <Card className={`py-12 px-6 text-center space-y-3 ${className}`}>
      <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary flex items-center justify-center shadow-xs">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-navy-900 dark:text-white">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {(actionText || secondaryActionText) && (
        <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
          {actionText && onAction && (
            <Button
              size="sm"
              variant="primary"
              icon={actionIcon}
              onClick={onAction}
            >
              {actionText}
            </Button>
          )}

          {secondaryActionText && onSecondaryAction && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSecondaryAction}
            >
              {secondaryActionText}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
