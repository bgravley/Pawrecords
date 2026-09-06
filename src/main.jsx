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
      <App />
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
