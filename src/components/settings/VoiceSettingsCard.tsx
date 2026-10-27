'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { StorageService } from '@/lib/storage';
import { VoiceSettings } from '@/lib/types';
import {
  ShieldCheck,
  Sparkles,
  Trash2,
  FileText,
  Tag,
  Check,
} from 'lucide-react';

export function VoiceSettingsCard() {
  const [settings, setSettings] = useState<VoiceSettings>({
    autoSaveConfident: false,
    saveVoiceNoteAsExpenseNote: true,
  });
  const [merchantRules, setMerchantRules] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [vSettings, rules] = await Promise.all([
        StorageService.getVoiceSettings(),
        StorageService.getMerchantRules(),
      ]);
      setSettings(vSettings);
      setMerchantRules(rules);
    } catch (err) {
      console.warn('Failed to load voice settings:', err);
    }
  };

  useEffect(() => {
    loadData();

    const handleRulesUpdate = () => loadData();
    if (typeof window !== 'undefined') {
      window.addEventListener('savemoney-merchant-rules-updated', handleRulesUpdate);
      window.addEventListener('savemoney-voice-settings-updated', handleRulesUpdate);
      return () => {
        window.removeEventListener('savemoney-merchant-rules-updated', handleRulesUpdate);
        window.removeEventListener('savemoney-voice-settings-updated', handleRulesUpdate);
      };
    }
  }, []);

  const handleToggleAutoSave = async () => {
    const updated = await StorageService.saveVoiceSettings({
      autoSaveConfident: !settings.autoSaveConfident,
    });
    setSettings(updated);
    showNotice(updated.autoSaveConfident ? 'Auto-save enabled' : 'Auto-save disabled');
  };

  const handleToggleSaveNote = async () => {
    const updated = await StorageService.saveVoiceSettings({
      saveVoiceNoteAsExpenseNote: !settings.saveVoiceNoteAsExpenseNote,
    });
    setSettings(updated);
    showNotice(
      updated.saveVoiceNoteAsExpenseNote
        ? 'Spoken sentence will be saved as note'
        : 'Spoken sentence will not be saved as note'
    );
  };

  const handleDeleteRule = async (merchant: string) => {
    await StorageService.deleteMerchantRule(merchant);
    const updated = await StorageService.getMerchantRules();
    setMerchantRules(updated);
    showNotice(`Removed rule for "${merchant}"`);
  };

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const ruleEntries = Object.entries(merchantRules);

  return (
    <Card className="p-6">
      <CardHeader
        title="Voice & Speech Settings"
        subtitle="Configure voice expense entry, smart rules, and privacy options"
      />

      {feedback && (
        <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2 mb-6">
        <div className="flex items-center gap-2 text-xs font-bold text-navy-900 dark:text-white">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Privacy & Audio Processing</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Voice recognition in Chrome sends audio to Google to convert speech to text. SaveMoney does not store your audio.
          Only the transcribed text is parsed into expense fields.
        </p>
      </div>

      {/* Voice Preferences Switches */}
      <div className="space-y-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Voice Automation Preferences
        </h4>

        {/* Auto-save Switch */}
        <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs sm:text-sm font-bold text-navy-900 dark:text-white">
                Auto-save confident voice expenses
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Auto-saves in 3 seconds if amount, category, payee, and date are recognized with high confidence. You can tap anytime to pause. Default is off.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoSaveConfident}
            onClick={handleToggleAutoSave}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              settings.autoSaveConfident ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.autoSaveConfident ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Spoken sentence as note switch */}
        <div className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-primary" />
              <span className="text-xs sm:text-sm font-bold text-navy-900 dark:text-white">
                Save spoken sentence as expense note
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saves the original transcript (e.g. &ldquo;Spent 200 on chai at tapri&rdquo;) in the note field for reference.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.saveVoiceNoteAsExpenseNote}
            onClick={handleToggleSaveNote}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              settings.saveVoiceNoteAsExpenseNote ? 'bg-brand-primary' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.saveVoiceNoteAsExpenseNote ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Saved Merchant / Payee Rules */}
      <div className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Saved Payee & Merchant Rules
            </h4>
            <p className="text-xs text-slate-400">
              When you check &ldquo;Always use this category for [payee]&rdquo;, SaveMoney remembers it here.
            </p>
          </div>
          <span className="text-xs font-bold text-brand-primary px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/40">
            {ruleEntries.length} {ruleEntries.length === 1 ? 'Rule' : 'Rules'}
          </span>
        </div>

        {ruleEntries.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200/60 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              No merchant rules saved yet. Voice entry will prompt you to save rules when names or merchants are recognized.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            {ruleEntries.map(([mName, catName]) => (
              <div
                key={mName}
                className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-navy-900 dark:text-white capitalize">
                    {mName}
                  </span>
                  <span className="text-slate-400 text-xs">&rarr;</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary bg-brand-50 dark:bg-brand-950/40 px-2 py-0.5 rounded-md">
                    <Tag className="w-3 h-3" />
                    <span>{catName}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(mName)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  title={`Delete rule for ${mName}`}
                  aria-label={`Delete rule for ${mName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
