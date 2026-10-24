'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AlertSeverity } from '@/lib/types';
import { Info, AlertTriangle, AlertCircle, X } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  severity: AlertSeverity;
}

interface ToastContextValue {
  showToast: (message: string, severity?: AlertSeverity) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, severity: AlertSeverity = 'info') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, severity }]);

      setTimeout(() => {
        removeToast(id);
      }, 5000);
    },
    [removeToast]
  );

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.message) {
        showToast(detail.message, detail.severity || 'info');
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-show-toast', handleCustomToast);
      return () => {
        window.removeEventListener('savemoney-show-toast', handleCustomToast);
      };
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Overlay Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3">
        {toasts.map((toast) => {
          let bgClass = 'bg-slate-900 text-white border-slate-700';
          let icon = <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;

          if (toast.severity === 'warning') {
            bgClass = 'bg-amber-900/90 text-amber-100 border-amber-600 shadow-amber-900/30';
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
          } else if (toast.severity === 'danger') {
            bgClass = 'bg-rose-950/90 text-rose-100 border-rose-600 shadow-rose-900/40';
            icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
          } else {
            bgClass = 'bg-emerald-950/90 text-emerald-100 border-emerald-600 shadow-emerald-900/30';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl flex items-start gap-2.5 backdrop-blur-md animate-slide-in transition-all text-xs font-medium leading-relaxed ${bgClass}`}
            >
              {icon}
              <div className="flex-1 pr-1">{toast.message}</div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (message: string, severity?: AlertSeverity) => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('savemoney-show-toast', {
              detail: { message, severity },
            })
          );
        }
      },
    };
  }
  return context;
}
