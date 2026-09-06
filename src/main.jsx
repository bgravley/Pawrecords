import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import PurchaseAnalyticsBridge from './PurchaseAnalyticsBridge'
import { installGlobalErrorReporting } from './lib/clientErrorReporter'
import { isAnalyticsExcluded } from './lib/analytics'
import { Analytics } from '@vercel/analytics/react'

const analyticsExcluded = isAnalyticsExcluded()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
    <PurchaseAnalyticsBridge />
    {!analyticsExcluded && <Analytics />}
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
