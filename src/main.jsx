import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import PurchaseAnalyticsBridge from './PurchaseAnalyticsBridge'
import { installGlobalErrorReporting } from './lib/clientErrorReporter'
import { Analytics } from '@vercel/analytics/react'

function ConsentAnalytics() {
  const allowedNow = () => window.YPPAnalyticsConsent?.isGranted?.() === true
  const [allowed, setAllowed] = useState(allowedNow)

  useEffect(() => {
    const eventName = window.YPPAnalyticsConsent?.eventName || 'ypp-consent-change'
    const onConsentChange = () => setAllowed(allowedNow())
    window.addEventListener(eventName, onConsentChange)
    onConsentChange()
    return () => window.removeEventListener(eventName, onConsentChange)
  }, [])

  return allowed ? <Analytics /> : null
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <React.Suspense fallback={
        <div style={{ minHeight: '100vh', background: '#FAFCFB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C4A38', fontFamily: "'Lora', serif", fontWeight: 700 }}>
          🐾 Loading YourPetPass...
        </div>
      }>
        <App />
      </React.Suspense>
    </AppErrorBoundary>
    <PurchaseAnalyticsBridge />
    <ConsentAnalytics />
  </React.StrictMode>
)

installGlobalErrorReporting()

// Register service worker for PWA install support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
