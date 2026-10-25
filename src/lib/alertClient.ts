import { AlertItem } from './types';
import { getCurrentMonthKey } from './formatters';

export interface TriggerAlertEvaluationParams {
  userId?: string;
  month?: string;
  lastExpense?: {
    amount: number;
    merchant?: string;
    category?: string;
    note?: string;
    date?: string;
  } | null;
  showToasts?: boolean;
}

/**
 * Client helper to trigger server-side alert evaluation and surface any newly generated alerts.
 * Always awaited so errors or alerts are handled immediately.
 */
export async function triggerAlertEvaluation(
  params: TriggerAlertEvaluationParams
): Promise<AlertItem[]> {
  const { userId, month, lastExpense, showToasts = true } = params;
  if (!userId) return [];

  const targetMonth =
    month ||
    (lastExpense?.date ? lastExpense.date.slice(0, 7) : getCurrentMonthKey());

  try {
    const res = await fetch('/api/alerts/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        month: targetMonth,
        lastExpense: lastExpense || null,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('[AlertClient] Alert evaluation returned non-200:', errData);
      return [];
    }

    const data = await res.json();
    const newAlerts: AlertItem[] = data.newAlerts || [];

    if (typeof window !== 'undefined') {
      if (showToasts && newAlerts.length > 0) {
        newAlerts.forEach((alert) => {
          window.dispatchEvent(
            new CustomEvent('savemoney-show-toast', {
              detail: {
                message: alert.message,
                severity: alert.severity,
              },
            })
          );
        });
      }
      window.dispatchEvent(new Event('savemoney-alerts-updated'));
    }

    return newAlerts;
  } catch (err) {
    console.warn('[AlertClient] Failed to trigger alert evaluation:', err);
    return [];
  }
}
