'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { StorageService } from '@/lib/storage';
import {
  Account,
  Expense,
  Category,
  BankStatementMapping,
  BankStatementRow,
} from '@/lib/types';
import { parseCSVStatement } from '@/lib/safeguardCalculations';
import { formatINR } from '@/lib/formatters';
import { triggerAlertEvaluation } from '@/lib/alertClient';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  Building2,
  CreditCard,
  ChevronRight,
  Filter,
  Check,
  X,
  FileCheck,
  Sparkles,
  Info,
} from 'lucide-react';

export default function StatementImportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingExpenses, setExistingExpenses] = useState<Expense[]>([]);
  const [savedMappings, setSavedMappings] = useState<BankStatementMapping[]>([]);
  const [loading, setLoading] = useState(true);

  // Workflow states
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard-csv');

  // Mapping state
  const [mapping, setMapping] = useState<BankStatementMapping>({
    id: 'custom',
    bankName: 'Custom',
    dateCol: '',
    descCol: '',
    debitCol: '',
    creditCol: '',
  });
  const [saveMappingForBank, setSaveMappingForBank] = useState(false);
  const [customBankName, setCustomBankName] = useState('');

  // Preview & parsed rows
  const [parsedRows, setParsedRows] = useState<BankStatementRow[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [creditCount, setCreditCount] = useState(0);
  const [totalDebits, setTotalDebits] = useState(0);

  // Filter in preview
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'duplicate'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // Submission state
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedTotal, setImportedTotal] = useState(0);

  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        const [accs, cats, exps, maps] = await Promise.all([
          StorageService.getAccounts(userId),
          StorageService.getCategories(userId),
          StorageService.getAllExpenses(userId),
          StorageService.getStatementMappings(),
        ]);
        setAccounts(accs);
        setCategories(cats);
        setExistingExpenses(exps);
        setSavedMappings(maps);

        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }

        if (maps.length > 0) {
          setSelectedPresetId(maps[0].id);
          setMapping(maps[0]);
        }
      } catch (err) {
        console.warn('Failed to load import setup data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, [userId]);

  // Handle Preset change
  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = savedMappings.find((m) => m.id === presetId);
    if (found) {
      setMapping({ ...found });
      setCustomBankName(found.bankName);
    }
  };

  // Handle CSV file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // Read file entirely in memory using client-side FileReader
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvContent(text);
        extractHeaders(text);
      }
      // Never persist the File object
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Extract column headers from first non-empty line
  const extractHeaders = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    // Simple split respecting basic quotes
    const headerLine = lines[0];
    const headers = headerLine
      .split(',')
      .map((h) => h.replace(/^["']|["']$/g, '').trim())
      .filter((h) => h.length > 0);

    setCsvHeaders(headers);

    // Auto-detect matches for mapping
    const detectCol = (candidates: string[]) => {
      return (
        headers.find((h) =>
          candidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))
        ) || ''
      );
    };

    const autoDate = detectCol(['date', 'txn date', 'transaction date', 'value date']);
    const autoDesc = detectCol(['narration', 'description', 'particulars', 'remarks', 'details']);
    const autoDebit = detectCol(['debit', 'withdrawal', 'dr', 'amount (dr)']);
    const autoCredit = detectCol(['credit', 'deposit', 'cr', 'amount (cr)']);

    setMapping((prev) => ({
      ...prev,
      dateCol: prev.dateCol && headers.includes(prev.dateCol) ? prev.dateCol : autoDate || headers[0] || '',
      descCol: prev.descCol && headers.includes(prev.descCol) ? prev.descCol : autoDesc || headers[1] || '',
      debitCol: prev.debitCol && headers.includes(prev.debitCol) ? prev.debitCol : autoDebit || headers[2] || '',
      creditCol: prev.creditCol && headers.includes(prev.creditCol) ? prev.creditCol : autoCredit || '',
    }));
  };

  // Parse whenever CSV, mapping, or existingExpenses change
  useEffect(() => {
    if (!csvContent || !mapping.dateCol || !mapping.descCol || !mapping.debitCol) {
      setParsedRows([]);
      return;
    }

    const result = parseCSVStatement({
      csvText: csvContent,
      mapping,
      existingExpenses,
      categories,
    });

    setParsedRows(result.rows);
    setNewCount(result.newCount);
    setDuplicateCount(result.duplicateCount);
    setCreditCount(result.creditCount);
    setTotalDebits(result.totalDebits);
  }, [csvContent, mapping, existingExpenses, categories]);

  // Toggle selection for a row
  const handleToggleRow = (rowId: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, selected: !r.selected } : r))
    );
  };

  // Bulk selection
  const handleSelectAll = (select: boolean) => {
    setParsedRows((prev) => prev.map((r) => ({ ...r, selected: select })));
  };

  // Update row category
  const handleCategoryChange = (rowId: string, newCat: string) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, suggestedCategory: newCat } : r))
    );
  };

  // Filtered rows for the preview table
  const displayedRows = useMemo(() => {
    return parsedRows.filter((r) => {
      if (previewFilter === 'new' && r.isDuplicate) return false;
      if (previewFilter === 'duplicate' && !r.isDuplicate) return false;
      if (searchFilter.trim().length > 0) {
        const q = searchFilter.toLowerCase();
        return (
          r.description.toLowerCase().includes(q) ||
          r.suggestedCategory.toLowerCase().includes(q) ||
          r.debitAmount.toString().includes(q)
        );
      }
      return true;
    });
  }, [parsedRows, previewFilter, searchFilter]);

  const selectedRows = useMemo(() => parsedRows.filter((r) => r.selected), [parsedRows]);
  const selectedTotalAmount = useMemo(
    () => selectedRows.reduce((sum, r) => sum + r.debitAmount, 0),
    [selectedRows]
  );

  // Execute import
  const handleConfirmImport = async () => {
    if (selectedRows.length === 0) return;

    try {
      setIsImporting(true);

      // 1. Optionally save mapping for future statements
      if (saveMappingForBank && customBankName.trim().length > 0) {
        await StorageService.saveStatementMapping({
          id: `custom-${Date.now()}`,
          bankName: customBankName.trim(),
          dateCol: mapping.dateCol,
          descCol: mapping.descCol,
          debitCol: mapping.debitCol,
          creditCol: mapping.creditCol,
        });
      }

      // 2. Import each selected row as an expense
      const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
      const accountNickname = selectedAccount?.nickname || 'Bank Statement';

      for (const row of selectedRows) {
        await StorageService.addExpense(
          {
            amount: row.debitAmount,
            category: row.suggestedCategory,
            date: row.date,
            merchant: row.description,
            note: `Statement: ${accountNickname}`,
            account_id: selectedAccountId || null,
            source: 'import',
          },
          userId
        );
      }

      // Re-evaluate alerts after statement import
      if (selectedRows.length > 0) {
        const last = selectedRows[selectedRows.length - 1];
        await triggerAlertEvaluation({
          userId,
          month: last.date.slice(0, 7),
          lastExpense: {
            amount: last.debitAmount,
            merchant: last.description,
            category: last.suggestedCategory,
            date: last.date,
          },
          showToasts: true,
        });
      }

      setImportedTotal(selectedRows.length);
      setImportSuccess(true);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('savemoney-expense-updated'));
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import expenses. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Reset to import another file
  const handleReset = () => {
    setCsvContent(null);
    setFileName('');
    setCsvHeaders([]);
    setParsedRows([]);
    setImportSuccess(false);
  };

  if (importSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <Card className="p-8 space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 stroke-[2.2]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-navy-900 dark:text-white">
              Import Completed!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Successfully imported <strong className="text-navy-900 dark:text-white">{importedTotal} debits</strong> totaling{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(selectedTotalAmount)}</strong> into your expenses.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleReset}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Import Another Statement
            </Button>
            <Button
              variant="primary"
              onClick={() => router.push('/expenses')}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              View Expenses
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-brand-light text-brand-primary dark:bg-brand-primary/20">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Data Safeguards
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 dark:text-white tracking-tight">
            Import Bank Statement
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Upload a CSV statement to detect debits, auto-skip duplicates, and classify expenses.
          </p>
        </div>

        <Link href="/expenses">
          <Button size="sm" variant="outline">
            Back to Expenses
          </Button>
        </Link>
      </div>

      {/* Zero Storage Privacy Notice */}
      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold">Strict Client-Side Processing: </span>
          Your CSV file is read entirely in memory in your browser. It is never uploaded, saved, or retained on any server.
        </div>
      </div>

      {/* Step 1: Destination Account & File Upload */}
      {!csvContent ? (
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Account Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Select Account to Import Into
              </label>
              {accounts.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500">
                  No accounts found. Please create an account in Accounts first.
                </div>
              ) : (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full text-sm font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname} ({acc.type}) {acc.last_4_digits ? `•••• ${acc.last_4_digits}` : ''}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-slate-400">
                All imported transactions will be tagged with this payment method.
              </p>
            </div>

            {/* Bank Preset Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Bank Column Preset
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full text-sm font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {savedMappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.bankName}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Auto-configures column names for HDFC, ICICI, SBI, or standard statements.
              </p>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="mt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              3. Upload Statement CSV
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-primary dark:hover:border-brand-primary rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-900/50 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary mx-auto flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Upload className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h3 className="text-base font-extrabold text-navy-900 dark:text-white">
                Choose a CSV file or drag & drop here
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Standard bank statements (.csv) exported from netbanking or mobile app
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </Card>
      ) : (
        /* Step 2 & 3: Column Mapping & Preview */
        <div className="space-y-6">
          {/* File & Mapping Header Card */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-primary">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-navy-900 dark:text-white">
                    {fileName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Target account:{' '}
                    <strong className="text-navy-900 dark:text-white">
                      {accounts.find((a) => a.id === selectedAccountId)?.nickname || 'Selected Account'}
                    </strong>
                  </p>
                </div>
              </div>

              <Button size="sm" variant="ghost" onClick={handleReset} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Upload Different File
              </Button>
            </div>

            {/* Column Mapping Selectors */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verify Column Mapping
                </h4>
                <span className="text-[11px] text-brand-primary font-semibold">
                  {csvHeaders.length} columns detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Date Column */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Date Column *
                  </label>
                  <select
                    value={mapping.dateCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, dateCol: e.target.value }))}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description Column */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Description / Narration *
                  </label>
                  <select
                    value={mapping.descCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, descCol: e.target.value }))}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Debit Column */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Debit / Withdrawal *
                  </label>
                  <select
                    value={mapping.debitCol}
                    onChange={(e) => setMapping((prev) => ({ ...prev, debitCol: e.target.value }))}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Credit Column (to skip deposits) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Credit / Deposit (Skipped)
                  </label>
                  <select
                    value={mapping.creditCol || ''}
                    onChange={(e) => setMapping((prev) => ({ ...prev, creditCol: e.target.value }))}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100"
                  >
                    <option value="">(None - debits only)</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save Mapping Option */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={saveMappingForBank}
                    onChange={(e) => setSaveMappingForBank(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-primary focus:ring-brand-500"
                  />
                  <span>Save this mapping for this bank</span>
                </label>

                {saveMappingForBank && (
                  <input
                    type="text"
                    placeholder="Bank name (e.g. Axis Bank)"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-navy-900 dark:text-slate-100 max-w-xs"
                  />
                )}
              </div>
            </div>
          </Card>

          {/* Deduplication & Summary Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                New Expenses
              </span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {newCount}
              </p>
              <span className="text-[11px] text-slate-400">Ready to import</span>
            </Card>

            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Duplicates Skipped
              </span>
              <p className="text-xl font-black text-amber-500 mt-1">
                {duplicateCount}
              </p>
              <span className="text-[11px] text-slate-400">Match existing entries</span>
            </Card>

            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Credits Skipped
              </span>
              <p className="text-xl font-black text-blue-500 mt-1">
                {creditCount}
              </p>
              <span className="text-[11px] text-slate-400">Deposits / Income</span>
            </Card>

            <Card className="p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Selected for Import
              </span>
              <p className="text-xl font-black text-brand-primary mt-1">
                {selectedRows.length}
              </p>
              <span className="text-[11px] text-slate-400 font-bold">
                {formatINR(selectedTotalAmount)}
              </span>
            </Card>
          </div>

          {/* Interactive Preview Table */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-navy-900 dark:text-white">
                  Preview Transactions
                </h3>
                <p className="text-xs text-slate-400">
                  Untick rows you do not want to import. Edit categories if needed.
                </p>
              </div>

              {/* Filter and Selection buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      previewFilter === 'all'
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                    }`}
                  >
                    All ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('new')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      previewFilter === 'new'
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                    }`}
                  >
                    New ({newCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('duplicate')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      previewFilter === 'duplicate'
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                    }`}
                  >
                    Duplicates ({duplicateCount})
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSelectAll(true)}
                  className="text-xs"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleSelectAll(false)}
                  className="text-xs"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Table */}
            {displayedRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No transactions match current filter.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                      <th className="py-2.5 px-3 w-10">Import</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Debit Amount</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {displayedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors ${
                          row.isDuplicate ? 'opacity-70 bg-amber-500/5' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => handleToggleRow(row.id)}
                            className="w-4 h-4 rounded text-brand-primary focus:ring-brand-500 cursor-pointer"
                          />
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {new Date(row.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-3">
                          <p className="font-bold text-navy-900 dark:text-white max-w-xs truncate" title={row.description}>
                            {row.description}
                          </p>
                        </td>

                        {/* Category selector */}
                        <td className="py-3 px-3">
                          <select
                            value={row.suggestedCategory}
                            onChange={(e) => handleCategoryChange(row.id, e.target.value)}
                            className={`text-xs font-semibold py-1 px-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-brand-500 ${
                              row.suggestedCategory === 'Needs review'
                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-navy-900 dark:text-white'
                            }`}
                          >
                            <option value="Needs review">Needs review</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Debit Amount */}
                        <td className="py-3 px-3 text-right font-black text-navy-900 dark:text-white whitespace-nowrap">
                          {formatINR(row.debitAmount)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {row.isDuplicate ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              <Check className="w-3 h-3" />
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Confirm Action Bar */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                Ready to import <strong className="text-navy-900 dark:text-white">{selectedRows.length}</strong> transactions totaling{' '}
                <strong className="text-brand-primary">{formatINR(selectedTotalAmount)}</strong>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedRows.length === 0}
                  loading={isImporting}
                  onClick={handleConfirmImport}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Confirm Import ({selectedRows.length})
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
