'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import {
  Wallet,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
  User as UserIcon,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithOtp,
    enableDemoMode,
    isConfigured,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authMode, setAuthMode] = useState<'password' | 'signup' | 'magic-link'>('password');
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ message: string; tip?: string } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDetails(null);
    setSuccessMessage(null);

    if (!cleanEmail) {
      setErrorDetails({ message: 'Please enter a valid email address.' });
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'password') {
        const { error } = await signInWithEmail(cleanEmail, password);
        if (error) {
          const rawMsg = error.message;
          let tip = undefined;

          if (rawMsg.toLowerCase().includes('invalid login credentials')) {
            tip =
              'If you just created an account, Supabase may be waiting for email confirmation. Check your email inbox, or in your Supabase Dashboard go to Authentication -> Providers -> Email and turn off "Confirm email" for instant login.';
          } else if (rawMsg.toLowerCase().includes('email not confirmed')) {
            tip =
              'Your email is not confirmed yet. Check your inbox for the confirmation link from Supabase, or turn off "Confirm email" in Supabase Authentication settings.';
          }

          setErrorDetails({ message: rawMsg, tip });
          return;
        }

        // Successfully signed in!
        router.push('/');
        router.refresh();
      } else if (authMode === 'signup') {
        if (!password || password.length < 6) {
          setErrorDetails({ message: 'Password must be at least 6 characters long.' });
          return;
        }

        const { data, error } = await signUpWithEmail(
          cleanEmail,
          password,
          fullName.trim() || undefined
        );

        if (error) {
          const rawMsg = error.message;
          let tip = undefined;

          if (rawMsg.toLowerCase().includes('rate limit')) {
            tip =
              'Supabase free tier limits outgoing emails to 3 per hour. In your Supabase Dashboard -> Authentication -> Providers -> Email, disable "Confirm email" to enable instant password signups without email delays!';
          }

          setErrorDetails({ message: rawMsg, tip });
          return;
        }

        // Check if session was returned immediately (Confirm Email disabled)
        if (data?.session) {
          setSuccessMessage('Account created and logged in successfully! Redirecting...');
          setTimeout(() => {
            router.push('/');
            router.refresh();
          }, 1000);
        } else {
          // Email confirmation is enabled on Supabase project
          setSuccessMessage(
            `Account created! A confirmation email has been sent to ${cleanEmail}. Please click the link in your email to activate your account, then log in here.`
          );
        }
      } else if (authMode === 'magic-link') {
        const { error } = await signInWithOtp(cleanEmail);
        if (error) {
          const rawMsg = error.message;
          let tip = undefined;
          if (rawMsg.toLowerCase().includes('rate limit')) {
            tip =
              'Supabase outgoing email limit reached. Use the Password or Sign Up tabs instead, or turn off "Confirm email" in Supabase dashboard.';
          }
          setErrorDetails({ message: rawMsg, tip });
          return;
        }

        setSuccessMessage('Magic link sent! Check your email inbox to log in instantly.');
      }
    } catch (err: unknown) {
      setErrorDetails({
        message: err instanceof Error ? err.message : 'Authentication failed. Please check credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = () => {
    enableDemoMode();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-surface-bg dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Logo and Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-400 text-white flex items-center justify-center shadow-glow">
            <Wallet className="w-7 h-7 stroke-[2.2]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            SaveMoney
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Personal Spending Tracker for India (₹ INR) • Supabase Auth
          </p>
        </div>

        {/* Main Auth Card */}
        <Card className="p-6 sm:p-8">
          {/* Supabase status badge */}
          <div className="mb-5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              {authMode === 'password'
                ? 'Email & Password Login'
                : authMode === 'signup'
                ? 'Create New Account'
                : 'Passwordless Magic Link'}
            </span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5 text-brand-primary" />
              <span>{isConfigured ? 'Supabase Connected' : 'Local Demo Mode'}</span>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setErrorDetails(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 rounded-lg transition-all ${
                authMode === 'password'
                  ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm font-bold'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorDetails(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 rounded-lg transition-all ${
                authMode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm font-bold'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic-link');
                setErrorDetails(null);
                setSuccessMessage(null);
              }}
              className={`py-1.5 rounded-lg transition-all ${
                authMode === 'magic-link'
                  ? 'bg-white dark:bg-slate-900 text-brand-primary shadow-sm font-bold'
                  : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Error Message with Specific Guidance */}
          {errorDetails && (
            <div className="p-3.5 rounded-xl mb-4 text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 space-y-1.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="font-bold">{errorDetails.message}</span>
              </div>
              {errorDetails.tip && (
                <div className="pl-6 pt-1 text-[11px] text-rose-700 dark:text-rose-400 border-t border-rose-200/50 dark:border-rose-900/50 leading-relaxed">
                  <strong>Fix:</strong> {errorDetails.tip}
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3.5 rounded-xl mb-4 text-xs bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{successMessage}</span>
              </div>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'signup' && (
              <Input
                label="Full Name"
                type="text"
                placeholder="e.g. Aryan"
                prefix={<UserIcon className="w-4 h-4" />}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              prefix={<Mail className="w-4 h-4" />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {authMode !== 'magic-link' && (
              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                prefix={<Lock className="w-4 h-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full mt-2"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              {authMode === 'password'
                ? 'Sign In to SaveMoney'
                : authMode === 'signup'
                ? 'Create Personal Account'
                : 'Send Magic Link'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <span className="relative bg-white dark:bg-slate-900 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Or test immediately
            </span>
          </div>

          {/* Demo Mode Button */}
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            icon={<Sparkles className="w-4 h-4 text-amber-500" />}
            onClick={handleDemoMode}
          >
            Enter Demo Mode (Local Storage)
          </Button>

          {/* Supabase Dashboard Quick Tip */}
          <div className="mt-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-navy-900 dark:text-slate-200">Recommended Supabase setting:</span>
              <p className="mt-0.5 leading-relaxed">
                In Supabase Dashboard &rarr; <strong>Authentication &rarr; Providers &rarr; Email</strong>, toggle <strong>&quot;Confirm email&quot; to OFF</strong>. This lets you sign up and log in instantly without waiting for confirmation emails or hitting email rate limits.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
