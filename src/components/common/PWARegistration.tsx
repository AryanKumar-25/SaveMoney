'use client';

import { useEffect } from 'react';
import { ensureServiceWorkerRegistered } from '@/lib/pushClient';

export function PWARegistration() {
  useEffect(() => {
    // Explicitly register /sw.js on the client in both dev and production
    ensureServiceWorkerRegistered().then((reg) => {
      if (reg) {
        console.log('[SaveMoney PWA] Service worker active with scope:', reg.scope);
      }
    });
  }, []);

  return null;
}
