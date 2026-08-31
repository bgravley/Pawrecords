import { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { PRODUCT_EVENTS, trackProductEvent } from './lib/analytics';

const PENDING_KEY = 'ypp_pending_purchase_confirmation';
const trackedKey = sessionId => `ypp_purchase_tracked_${sessionId}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export default function PurchaseAnalyticsBridge() {
  useEffect(() => {
    let cancelled = false;

    async function confirmPurchase() {
      const params = new URLSearchParams(window.location.search);
      const urlSessionId = params.get('session_id');
      const pendingSessionId = localStorage.getItem(PENDING_KEY);
      const sessionId = urlSessionId || pendingSessionId || '';
      if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 255) return;

      // Keep a pending reference after App.jsx cleans Stripe query parameters.
      // This value is never sent to analytics; it is sent only to the
      // authenticated same-origin confirmation endpoint.
      localStorage.setItem(PENDING_KEY, sessionId);
      if (localStorage.getItem(trackedKey(sessionId)) === '1') {
        localStorage.removeItem(PENDING_KEY);
        return;
      }

      for (let attempt = 0; attempt < 8 && !cancelled; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          await sleep(750);
          continue;
        }

        try {
          const response = await fetch('/api/confirm-purchase', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ sessionId }),
          });
          if (response.ok) {
            const result = await response.json();
            if (result?.confirmed === true) {
              trackProductEvent(PRODUCT_EVENTS.PURCHASE_COMPLETED);
              localStorage.setItem(trackedKey(sessionId), '1');
              localStorage.removeItem(PENDING_KEY);
              return;
            }
          }
        } catch {
          // Analytics confirmation is best effort and must not affect the app.
        }
        await sleep(1500);
      }
    }

    confirmPurchase();
    return () => { cancelled = true; };
  }, []);

  return null;
}
