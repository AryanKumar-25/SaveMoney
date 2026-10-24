'use client';

import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { User, Session, AuthError, AuthResponse } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/types';

const GUEST_PROFILE: UserProfile = {
  id: 'guest',
  email: '',
  full_name: 'Guest User',
  currency: 'INR',
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isDemoMode: boolean;
  signInWithEmail: (email: string, password?: string) => Promise<{ data?: AuthResponse['data'] | null; error: AuthError | Error | null }>;
  signUpWithEmail: (email: string, password?: string, fullName?: string) => Promise<{ data?: AuthResponse['data'] | null; error: AuthError | Error | null }>;
  signInWithOtp: (email: string) => Promise<{ error: AuthError | Error | null }>;
  signOut: () => Promise<void>;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const configured = isSupabaseConfigured();

  // Load profile helper
  const loadProfile = useCallback(async (userId: string, email?: string) => {
    if (!configured) return;
    const supabase = createClient();
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data && !error) {
        setProfile({
          id: data.id,
          email: data.email || email || '',
          full_name: data.full_name || (email ? email.split('@')[0] : 'Saver'),
          currency: data.currency || 'INR',
          avatar_url: data.avatar_url,
        });
      } else {
        const fallbackName = email ? email.split('@')[0] : 'Saver';
        const fallbackProfile: UserProfile = {
          id: userId,
          email: email || '',
          full_name: fallbackName,
          currency: 'INR',
        };
        setProfile(fallbackProfile);
        // Non-blocking upsert to ensure profiles table has the row
        supabase.from('profiles').upsert(fallbackProfile).then(() => {});
      }
    } catch {
      setProfile({
        id: userId,
        email: email || '',
        full_name: email ? email.split('@')[0] : 'Saver',
        currency: 'INR',
      });
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) {
      setIsDemoMode(true);
      setProfile(GUEST_PROFILE);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Check active session from Supabase
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Supabase getSession error:', error);
      }
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        setIsDemoMode(false);
        loadProfile(session.user.id, session.user.email);
      } else {
        // If not logged in, check if user explicitly requested demo mode
        const demoFlag = typeof window !== 'undefined' ? localStorage.getItem('savemoney_demo_active') : null;
        if (demoFlag === 'true') {
          setIsDemoMode(true);
          setProfile(GUEST_PROFILE);
        } else {
          setIsDemoMode(false);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsDemoMode(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('savemoney_demo_active');
        }
        await loadProfile(session.user.id, session.user.email);
      } else {
        const demoFlag = typeof window !== 'undefined' ? localStorage.getItem('savemoney_demo_active') : null;
        if (demoFlag === 'true') {
          setIsDemoMode(true);
          setProfile(GUEST_PROFILE);
        } else {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configured, loadProfile]);

  const signInWithEmail = async (email: string, password?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!configured) {
      console.warn('Supabase not configured. Using local demo mode.');
      enableDemoMode();
      return { data: null, error: null };
    }

    const supabase = createClient();

    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data?.user) {
        setUser(data.user);
        setSession(data.session);
        setIsDemoMode(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('savemoney_demo_active');
        }
        await loadProfile(data.user.id, data.user.email);
      }

      return { data, error };
    } else {
      const { error } = await signInWithOtp(cleanEmail);
      return { data: null, error };
    }
  };

  const signUpWithEmail = async (email: string, password?: string, fullName?: string) => {
    const cleanEmail = email.trim().toLowerCase();

    if (!configured) {
      console.warn('Supabase not configured. Using local demo mode.');
      enableDemoMode();
      return { data: null, error: null };
    }

    const supabase = createClient();

    if (!password) {
      const { error } = await signInWithOtp(cleanEmail);
      return { data: null, error };
    }

    const resolvedName = fullName?.trim() || cleanEmail.split('@')[0];

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: resolvedName },
      },
    });

    // If confirmation is disabled in Supabase, session is active immediately!
    if (!error && data?.user && data.session) {
      setUser(data.user);
      setSession(data.session);
      setIsDemoMode(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('savemoney_demo_active');
      }
      await loadProfile(data.user.id, data.user.email);
    }

    return { data, error };
  };

  const signInWithOtp = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();

    if (!configured) {
      enableDemoMode();
      return { error: null };
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
      },
    });

    return { error };
  };

  const signOut = async () => {
    if (configured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('savemoney_demo_active');
    }
    setIsDemoMode(false);
    setProfile(null);
  };

  const enableDemoMode = () => {
    setIsDemoMode(true);
    setProfile(GUEST_PROFILE);
    if (typeof window !== 'undefined') {
      localStorage.setItem('savemoney_demo_active', 'true');
    }
  };

  const disableDemoMode = () => {
    setIsDemoMode(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('savemoney_demo_active');
    }
    if (!user) {
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isConfigured: configured,
        isDemoMode,
        signInWithEmail,
        signUpWithEmail,
        signInWithOtp,
        signOut,
        enableDemoMode,
        disableDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
