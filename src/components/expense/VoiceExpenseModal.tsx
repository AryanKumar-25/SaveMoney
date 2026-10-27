'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useExpenseModal } from '@/context/ExpenseModalContext';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import { Category, Account, VoiceSettings } from '@/lib/types';
import { parseExpenseText, ParsedVoiceExpense } from '@/lib/voiceParser';
import { calculateSpendableBudget, calculateSafeToSpendToday } from '@/lib/calculations';
import { formatINR } from '@/lib/formatters';
import { triggerAlertEvaluation } from '@/lib/alertClient';
import {
  Mic,
  MicOff,
  X,
  Check,
  AlertCircle,
  RotateCcw,
  Tag,
  Sparkles,
  Edit3,
} from 'lucide-react';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
        confidence: number;
      };
    };
  };
}

interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}

export function VoiceExpenseModal({ onSaved }: { onSaved?: () => void }) {
  const { isVoiceOpen, closeVoiceModal } = useExpenseModal();
  const { user } = useAuth();
  const userId = user?.id;

  // State phases: 'idle' | 'listening' | 'review' | 'manual_fallback'
  const [phase, setPhase] = useState<'idle' | 'listening' | 'review' | 'manual_fallback'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [fallbackText, setFallbackText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed Expense Form fields
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('Food');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [alwaysUseForPayee, setAlwaysUseForPayee] = useState(false);
  const [isPersonPayee, setIsPersonPayee] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedVoiceExpense | null>(null);

  // Auto-save countdown
  const [autoSaveSeconds, setAutoSaveSeconds] = useState<number | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // References and system data
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [merchantRules, setMerchantRules] = useState<Record<string, string>>({});
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    autoSaveConfident: false,
    saveVoiceNoteAsExpenseNote: true,
  });

  const [saving, setSaving] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Speech Recognition refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningRef = useRef(false);

  // Format local date for input (YYYY-MM-DD)
  const getLocalDateString = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check Web Speech API support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      setIsSupported(hasSpeech);
    }
  }, []);

  // Load app dependencies (categories, accounts, rules, voice settings)
  const loadDependencies = useCallback(async () => {
    try {
      const [cats, accs, rules, vSettings] = await Promise.all([
        StorageService.getCategories(userId),
        StorageService.getAccounts(userId),
        StorageService.getMerchantRules(),
        StorageService.getVoiceSettings(),
      ]);

      const { unique } = StorageService.deduplicateCategories(cats);
      setCategories(unique);
      setAccounts(accs);
      setMerchantRules(rules);
      setVoiceSettings(vSettings);

      // Pre-select last used account
      const lastAccId = typeof window !== 'undefined' ? localStorage.getItem('savemoney_last_account_id') : null;
      if (lastAccId && accs.some((a) => a.id === lastAccId)) {
        setSelectedAccountId(lastAccId);
      } else if (accs.length > 0) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err) {
      console.warn('Failed to load voice dependencies:', err);
    }
  }, [userId]);

  useEffect(() => {
    if (isVoiceOpen) {
      loadDependencies();
      setPhase('idle');
      setLiveTranscript('');
      setFallbackText('');
      setErrorMessage(null);
      setAmount('');
      setMerchant('');
      setCategory('Food');
      setDate(getLocalDateString());
      setNote('');
      setAlwaysUseForPayee(false);
      setIsPersonPayee(false);
      setParsedResult(null);
      setAutoSaveSeconds(null);

      // Start listening automatically on open if browser allows
      // Small timeout to allow modal mount
      const startTimer = setTimeout(() => {
        handleStartListening();
      }, 300);

      return () => {
        clearTimeout(startTimer);
        stopListening(false);
      };
    } else {
      stopListening(false);
      cancelAutoSave();
    }
  }, [isVoiceOpen, loadDependencies]);

  const cancelAutoSave = () => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setAutoSaveSeconds(null);
  };

  // Stop listening cleanup
  const stopListening = (shouldParse = true) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    if (shouldParse && liveTranscript.trim()) {
      processTranscript(liveTranscript.trim());
    }
  };

  // Process text using parseExpenseText
  const processTranscript = (textToParse: string) => {
    const parsed = parseExpenseText(textToParse, {
      merchantRules,
      categories: categories.map((c) => c.name),
      referenceDate: new Date(),
    });

    setParsedResult(parsed);
    setAmount(parsed.amount !== null ? String(parsed.amount) : '');
    setMerchant(parsed.merchant || '');
    setCategory(parsed.category || 'Food');
    setDate(parsed.date ? parsed.date.slice(0, 10) : getLocalDateString());
    setNote(parsed.note || textToParse);
    setIsPersonPayee(parsed.isPersonPayee);

    // If payee is unknown person without saved rule, check "Always use" by default to guide user
    if (parsed.isPersonPayee && !parsed.matchedRule) {
      setAlwaysUseForPayee(true);
    }

    setPhase('review');

    // Auto-save check: if all fields confident and setting enabled
    if (
      voiceSettings.autoSaveConfident &&
      parsed.amount !== null &&
      parsed.confidence.amount === 'high' &&
      parsed.confidence.category === 'high' &&
      parsed.confidence.merchant === 'high' &&
      parsed.confidence.date === 'high'
    ) {
      startAutoSaveCountdown(parsed);
    }
  };

  const startAutoSaveCountdown = (parsed: ParsedVoiceExpense) => {
    cancelAutoSave();
    let count = 3;
    setAutoSaveSeconds(count);

    autoSaveTimerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        cancelAutoSave();
        handleSave(parsed);
      } else {
        setAutoSaveSeconds(count);
      }
    }, 1000);
  };

  // Start Speech Capture
  const handleStartListening = () => {
    cancelAutoSave();
    setErrorMessage(null);

    // Detect iOS Standalone PWA environment where Web Speech API is frequently unreliable
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone =
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Boolean((window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches);

    if (isIOS && isStandalone && !('webkitSpeechRecognition' in window)) {
      setPhase('manual_fallback');
      setErrorMessage('Speech recognition is limited in iOS Home Screen apps. Use the keyboard dictation mic below:');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechClass) {
      setPhase('manual_fallback');
      setErrorMessage('Speech recognition is not supported in this browser. Please type or use your keyboard dictation:');
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechClass();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      let capturedText = '';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setPhase('listening');
        setLiveTranscript('');
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        const combined = (final + ' ' + interim).trim();
        capturedText = combined;
        setLiveTranscript(combined);

        // Reset silence timer on every speech event
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Auto-stop after 1.5 seconds of silence
        silenceTimerRef.current = setTimeout(() => {
          if (isListeningRef.current && capturedText.trim()) {
            stopListening(false);
            processTranscript(capturedText.trim());
          }
        }, 1500);
      };

      recognition.onerror = (event: SpeechRecognitionErrorLike) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          setPhase('manual_fallback');
          setErrorMessage('Microphone access was denied. Please allow microphone permissions or type below:');
        } else if (event.error === 'no-speech') {
          // If no speech detected yet, stay in listening or inform
          if (!capturedText.trim()) {
            setErrorMessage("Didn't hear anything. Tap to speak again or type below.");
          }
        } else {
          setPhase('manual_fallback');
          setErrorMessage(`Speech recognition error (${event.error}). Please type below:`);
        }
      };

      recognition.onend = () => {
        if (isListeningRef.current) {
          isListeningRef.current = false;
          if (capturedText.trim()) {
            processTranscript(capturedText.trim());
          } else {
            setPhase('idle');
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setPhase('manual_fallback');
      setErrorMessage('Could not access microphone. Please type or use keyboard dictation:');
    }
  };

  const handleManualFallbackSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!fallbackText.trim()) return;
    processTranscript(fallbackText.trim());
  };

  const handleSave = async (overrideParsed?: ParsedVoiceExpense) => {
    cancelAutoSave();
    const finalAmount = parseFloat(amount || (overrideParsed?.amount ? String(overrideParsed.amount) : '0'));

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setErrorMessage('Please provide an expense amount greater than 0.');
      return;
    }

    const finalMerchant = merchant.trim() || overrideParsed?.merchant || '';
    const finalCategory = category || overrideParsed?.category || 'Food';
    const finalDateStr = date || getLocalDateString();
    const isoDate = new Date(finalDateStr).toISOString();
    const finalNote = voiceSettings.saveVoiceNoteAsExpenseNote
      ? (note.trim() || overrideParsed?.note || liveTranscript.trim() || undefined)
      : undefined;

    setSaving(true);
    setErrorMessage(null);

    try {
      // 1. Save merchant rule if user checked "Always use this category for [payee]"
      if (alwaysUseForPayee && finalMerchant) {
        await StorageService.setMerchantRule(finalMerchant, finalCategory);
      }

      // 2. Remember last used account
      if (selectedAccountId && typeof window !== 'undefined') {
        localStorage.setItem('savemoney_last_account_id', selectedAccountId);
      }

      // 3. Add Expense
      await StorageService.addExpense(
        {
          account_id: selectedAccountId || null,
          amount: finalAmount,
          category: finalCategory,
          note: finalNote,
          merchant: finalMerchant || undefined,
          date: isoDate,
          source: 'manual',
        },
        userId
      );

      // 4. Calculate new safe-to-spend today for instant feedback toast
      const expenseMonth = isoDate.slice(0, 7);
      let safeToSpendNotice = '';
      try {
        const [budgetData, summary, transfers, adjustments] = await Promise.all([
          StorageService.getMonthlyBudget(expenseMonth, userId),
          StorageService.getMonthSpendingSummary(expenseMonth, userId),
          StorageService.getExtraMoneyTransfers(userId),
          StorageService.getBalanceAdjustments(userId),
        ]);

        if (budgetData.budget) {
          const fixedExpenses = await StorageService.getFixedExpenses(expenseMonth, userId);
          const totalFixed = fixedExpenses.reduce((s, f) => s + f.amount, 0);
          const totalTransfers = transfers
            .filter((t) => t.month === expenseMonth)
            .reduce((s, t) => s + t.amount, 0);
          const totalAdjustments = adjustments
            .filter((a) => a.month === expenseMonth)
            .reduce((s, a) => s + a.amount, 0);

          const spendable = calculateSpendableBudget(
            budgetData.budget.income,
            totalFixed,
            budgetData.budget.savings_target,
            totalTransfers,
            totalAdjustments
          );
          const safeResult = calculateSafeToSpendToday(
            spendable.spendableBudget,
            summary.spentSoFarThisMonth,
            summary.spentToday,
            new Date(isoDate)
          );
          safeToSpendNotice = ` Safe to spend today: ${formatINR(safeResult.safeToSpendRemainingToday)}`;
        }
      } catch (err) {
        console.warn('Could not compute safe to spend for toast:', err);
      }

      // 5. Trigger alert evaluation server-side
      await triggerAlertEvaluation({
        userId,
        month: expenseMonth,
        lastExpense: {
          amount: finalAmount,
          merchant: finalMerchant || undefined,
          category: finalCategory,
          note: finalNote,
          date: isoDate,
        },
        showToasts: true,
      });

      // 6. Surface success toast
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('savemoney-show-toast', {
            detail: {
              message: `Saved ${formatINR(finalAmount)} for ${finalMerchant || finalCategory}!${safeToSpendNotice}`,
              severity: 'info',
            },
          })
        );
        window.dispatchEvent(new Event('savemoney-expense-updated'));
      }

      onSaved?.();
      closeVoiceModal();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  if (!isVoiceOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy-900/60 backdrop-blur-sm animate-fadeIn p-0 sm:p-4"
      onClick={cancelAutoSave}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-slideUp sm:animate-scaleUp relative"
        onClick={(e) => {
          e.stopPropagation();
          cancelAutoSave();
        }}
      >
        {/* Mobile Swipe Handle Pill */}
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-400 text-white flex items-center justify-center shadow-sm">
              <Mic className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-navy-900 dark:text-white tracking-tight">
                Voice Expense Entry
              </h3>
              <p className="text-[11px] text-slate-400">
                Speak naturally in English, Hindi, or Hinglish
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeVoiceModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close voice modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auto-Save Countdown Banner (if enabled) */}
        {autoSaveSeconds !== null && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-inner animate-pulse">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Auto-saving in {autoSaveSeconds}s... Tap anywhere to edit</span>
            </div>
            <button
              type="button"
              onClick={cancelAutoSave}
              className="underline hover:text-amber-100 text-[11px]"
            >
              Pause
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* PHASE 1 & 2: LISTENING OR IDLE */}
          {(phase === 'listening' || phase === 'idle') && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
              {/* Pulsing Mic Button */}
              <div className="relative flex items-center justify-center">
                {phase === 'listening' && (
                  <>
                    <span className="absolute w-28 h-28 rounded-full bg-brand-primary/20 animate-ping" />
                    <span className="absolute w-36 h-36 rounded-full bg-brand-primary/10 animate-pulse" />
                  </>
                )}
                <button
                  type="button"
                  onClick={phase === 'listening' ? () => stopListening(true) : handleStartListening}
                  className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform active:scale-95 ${
                    phase === 'listening'
                      ? 'bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-400 shadow-brand-500/50'
                      : 'bg-slate-700 dark:bg-slate-800 hover:bg-brand-primary'
                  }`}
                  aria-label={phase === 'listening' ? 'Stop listening' : 'Start listening'}
                >
                  {phase === 'listening' ? (
                    <Mic className="w-10 h-10 animate-bounce" />
                  ) : (
                    <MicOff className="w-10 h-10 text-slate-300" />
                  )}
                </button>
              </div>

              {/* Status indicator */}
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      phase === 'listening' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{phase === 'listening' ? 'Listening...' : 'Tap mic to start speaking'}</span>
                </div>
                <h4 className="text-sm font-bold text-navy-900 dark:text-white">
                  {phase === 'listening' ? 'Speak clearly' : 'Ready when you are'}
                </h4>
              </div>

              {/* Live Transcript Display Box */}
              <div className="w-full min-h-[72px] p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium text-left flex items-center justify-center">
                {liveTranscript ? (
                  <p className="w-full italic text-brand-primary dark:text-brand-400">&ldquo;{liveTranscript}&rdquo;</p>
                ) : (
                  <p className="text-slate-400 text-center text-xs">
                    Try: &ldquo;Spent 200 on chai at tapri&rdquo;, &ldquo;Atul ko 500 diye&rdquo;, or &ldquo;Auto 60&rdquo;
                  </p>
                )}
              </div>

              {/* Action buttons during listening */}
              <div className="flex items-center gap-3 w-full pt-2">
                {phase === 'listening' ? (
                  <button
                    type="button"
                    onClick={() => stopListening(true)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-brand-primary hover:bg-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Done Speaking</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartListening}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-brand-primary hover:bg-brand-600 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Start Speaking</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    stopListening(false);
                    setPhase('manual_fallback');
                  }}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Type Instead</span>
                </button>
              </div>
            </div>
          )}

          {/* PHASE 3: MANUAL FALLBACK / TYPE INSTEAD */}
          {phase === 'manual_fallback' && (
            <form onSubmit={handleManualFallbackSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-navy-900 dark:text-white">
                  Type your expense or use keyboard dictation:
                </label>
                <textarea
                  rows={3}
                  value={fallbackText}
                  onChange={(e) => setFallbackText(e.target.value)}
                  placeholder="e.g. Spent 200 on food at canteen, or paid 350 to Rahul yesterday"
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="submit"
                  disabled={!fallbackText.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-brand-primary hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Parse & Review</span>
                </button>

                {isSupported && (
                  <button
                    type="button"
                    onClick={handleStartListening}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors flex items-center gap-1"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Try Mic</span>
                  </button>
                )}
              </div>
            </form>
          )}

          {/* PHASE 4: CONFIRMATION & REVIEW CARD */}
          {phase === 'review' && (
            <div className="space-y-4">
              {/* Original spoken note display */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2">
                <Mic className="w-3.5 h-3.5 text-brand-primary shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 italic flex-1">
                  &ldquo;{note || liveTranscript}&rdquo;
                </div>
                <button
                  type="button"
                  onClick={handleStartListening}
                  className="text-[11px] text-brand-primary hover:underline font-bold shrink-0 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Re-speak</span>
                </button>
              </div>

              {/* Confirmation Form */}
              <div className="space-y-3">
                {/* Amount Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Amount (₹) *
                    </label>
                    {parsedResult?.confidence.amount === 'low' && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Check amount
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-extrabold text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full text-lg font-black pl-8 pr-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 text-navy-900 dark:text-white ${
                        parsedResult?.confidence.amount === 'low'
                          ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                  {!amount && (
                    <p className="text-[11px] text-rose-500 font-semibold mt-1">
                      Amount is required. Please type or speak the amount.
                    </p>
                  )}
                </div>

                {/* Merchant / Payee */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Payee / Merchant
                    </label>
                    {parsedResult?.confidence.merchant === 'low' && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Verify payee
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Swiggy, Canteen, Atul, Metro"
                    className={`w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 text-navy-900 dark:text-white ${
                      parsedResult?.confidence.merchant === 'low'
                        ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/20'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Category
                    </label>
                    {(parsedResult?.confidence.category === 'low' || category === 'Needs review') && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Needs review
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`w-full text-xs sm:text-sm pl-3.5 pr-8 py-2 rounded-xl border appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 text-navy-900 dark:text-white font-medium ${
                        parsedResult?.confidence.category === 'low' || category === 'Needs review'
                          ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                      {/* Ensure 'Needs review' is available if inferred */}
                      {!categories.some((c) => c.name === 'Needs review') && (
                        <option value="Needs review">Needs review</option>
                      )}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      ▾
                    </div>
                  </div>
                </div>

                {/* Always use this category for payee checkbox */}
                {merchant.trim() && (
                  <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <input
                      type="checkbox"
                      checked={alwaysUseForPayee}
                      onChange={(e) => setAlwaysUseForPayee(e.target.checked)}
                      className="w-4 h-4 rounded text-brand-primary focus:ring-brand-500 border-slate-300 dark:border-slate-600"
                    />
                    <span>
                      Always use <strong>{category}</strong> for &ldquo;{merchant.trim()}&rdquo;
                    </span>
                  </label>
                )}

                {/* Paid With (Account) */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Paid With
                  </label>
                  <div className="relative">
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full text-xs sm:text-sm pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 text-navy-900 dark:text-white font-medium"
                    >
                      <option value="">Default / Cash / None</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.nickname} {acc.last_4_digits ? `(••${acc.last_4_digits})` : ''} - {acc.type}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      ▾
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Date
                    </label>
                    {parsedResult?.confidence.date === 'low' && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        Verify date
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-slate-800 text-navy-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Confirmation Actions */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving || !amount || parseFloat(amount) <= 0}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-primary to-amber-500 hover:from-brand-500 hover:to-amber-400 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-lg shadow-brand-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{saving ? 'Saving...' : 'Save Expense'}</span>
                </button>

                <button
                  type="button"
                  onClick={closeVoiceModal}
                  disabled={saving}
                  className="py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
