'use client';

import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { X, Copy, Check, ExternalLink, ShieldCheck, Database, Key } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseSetupModal({ isOpen, onClose }: SupabaseSetupModalProps) {
  const { isConfigured, isDemoMode, enableDemoMode, disableDemoMode } = useAuth();
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  const envSample = `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`;

  const copyToClipboard = (text: string, type: 'env' | 'sql') => {
    navigator.clipboard.writeText(text);
    if (type === 'env') {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    } else {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm animate-fadeIn">
      <Card className="max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-primary flex items-center justify-center">
            <Database className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-navy-900 dark:text-white">
              Supabase Configuration
            </h3>
            <p className="text-xs text-slate-500">
              PostgreSQL + Row Level Security (RLS) setup
            </p>
          </div>
        </div>

        {/* Current status banner */}
        <div
          className={`p-4 rounded-xl mb-5 flex items-start gap-3 border ${
            isConfigured
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
          }`}
        >
          {isConfigured ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Key className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div className="text-xs leading-relaxed">
            {isConfigured ? (
              <p className="font-semibold">
                Supabase is connected and ready! All data syncs securely with your personal database.
              </p>
            ) : (
              <div>
                <p className="font-bold">Currently running in Instant Demo / LocalStorage mode.</p>
                <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                  You can test all budget calculations, add fixed expenses, and navigate freely right now! When you are ready to persist to Supabase, follow the 3 quick steps below.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 3 Step Guide */}
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between font-bold text-navy-900 dark:text-slate-100 mb-1">
              <span>Step 1: Create a free Supabase Project</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-brand-primary flex items-center gap-1 hover:underline"
              >
                Open Supabase <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Log into Supabase and click &quot;New Project&quot;. Name it &quot;SaveMoney&quot; and select region &quot;South Asia (Mumbai)&quot; for best latency.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between font-bold text-navy-900 dark:text-slate-100 mb-1">
              <span>Step 2: Run the SQL Schema in Supabase</span>
              <button
                type="button"
                onClick={() => copyToClipboard('See file: supabase/schema.sql', 'sql')}
                className="text-brand-primary flex items-center gap-1 hover:underline"
              >
                {copiedSql ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>supabase/schema.sql</span>
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Open the <strong>SQL Editor</strong> tab in Supabase, paste the contents of <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">supabase/schema.sql</code>, and click <strong>Run</strong>. This creates all tables and Row-Level Security policies.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between font-bold text-navy-900 dark:text-slate-100 mb-1">
              <span>Step 3: Add API Keys to .env.local</span>
              <button
                type="button"
                onClick={() => copyToClipboard(envSample, 'env')}
                className="text-brand-primary flex items-center gap-1 hover:underline"
              >
                {copiedEnv ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>Copy sample</span>
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              Go to <strong>Project Settings -&gt; API</strong> in Supabase, copy your Project URL and Anon Public Key into your local <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">.env.local</code> file.
            </p>
            <pre className="p-2.5 rounded-lg bg-navy-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
              {envSample}
            </pre>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (isDemoMode) {
                disableDemoMode();
              } else {
                enableDemoMode();
              }
            }}
          >
            {isDemoMode ? 'Turn Off Demo Mode' : 'Force Local Demo Mode'}
          </Button>

          <Button type="button" size="sm" onClick={onClose}>
            Got it, continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
