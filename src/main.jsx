import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PurchaseAnalyticsBridge from './PurchaseAnalyticsBridge'
import { Analytics } from '@vercel/analytics/react'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <PurchaseAnalyticsBridge />
    <Analytics />
  </React.StrictMode>
)

// Register service worker for PWA install support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
