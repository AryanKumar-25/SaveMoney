import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load your data. Please check your connection and try again.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <Card className={`py-10 px-6 text-center space-y-3 border-rose-200/60 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 ${className}`}>
      <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 stroke-[2]" />
      </div>
      <h3 className="text-base font-bold text-navy-900 dark:text-white">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            className="hover:border-rose-400 text-rose-600 dark:text-rose-400"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        </div>
      )}
    </Card>
  );
}
