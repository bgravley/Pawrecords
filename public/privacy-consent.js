(() => {
  const STORAGE_KEY = 'ypp_analytics_consent_v1';
  const EVENT_NAME = 'ypp-consent-change';
  const GA_ID = 'G-GLHNVC9XZV';
  const CLARITY_ID = 'xd47rh2htp';
  let analyticsLoaded = false;
  let banner = null;
  let choicesButton = null;

  const getStored = () => {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'granted' || value === 'denied' ? value : 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const hasGpc = () => typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
  const getStatus = () => hasGpc() ? 'denied' : getStored();

  const loadAnalytics = () => {
    if (analyticsLoaded || getStatus() !== 'granted') return;
    analyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });

    const ga = document.createElement('script');
    ga.async = true;
    ga.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    ga.dataset.yppAnalytics = 'ga4';
    document.head.appendChild(ga);

    window.clarity = window.clarity || function clarity(){
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    const clarity = document.createElement('script');
    clarity.async = true;
    clarity.src = `https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`;
    clarity.dataset.yppAnalytics = 'clarity';
    document.head.appendChild(clarity);
  };

  const removeBanner = () => {
    banner?.remove();
    banner = null;
  };

  const dispatch = (status) => {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { status } }));
  };

  const save = (status) => {
    if (hasGpc()) status = 'denied';
    try { localStorage.setItem(STORAGE_KEY, status); } catch { /* session-only */ }
    removeBanner();
    renderChoicesButton();
    if (status === 'granted') loadAnalytics();
    dispatch(status);
  };

  const buttonStyle = (primary = false) => [
    'border-radius:10px', 'padding:10px 14px', 'font:600 13px Lora,serif', 'cursor:pointer',
    primary ? 'background:#2C4A38;color:#fff;border:1px solid #2C4A38' : 'background:#FAFCFB;color:#2C4A38;border:1px solid #7C9E87'
  ].join(';');

  const renderChoicesButton = () => {
    if (choicesButton || !document.body) return;
    choicesButton = document.createElement('button');
    choicesButton.type = 'button';
    choicesButton.textContent = 'Privacy choices';
    choicesButton.setAttribute('aria-label', 'Open privacy choices');
    choicesButton.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:2147483645;background:#FAFCFB;color:#2C4A38;border:1px solid #7C9E87;border-radius:999px;padding:7px 11px;font:600 11px Lora,serif;box-shadow:0 3px 12px rgba(26,46,34,.16);cursor:pointer;';
    choicesButton.addEventListener('click', renderBanner);
    document.body.appendChild(choicesButton);
  };

  function renderBanner() {
    if (!document.body) return;
    removeBanner();
    choicesButton?.remove();
    choicesButton = null;

    banner = document.createElement('section');
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Analytics privacy choices');
    banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483646;max-width:720px;margin:auto;background:#FAFCFB;color:#1A2E22;border:1px solid #9DC4AA;border-radius:16px;padding:18px;box-shadow:0 12px 36px rgba(26,46,34,.24);font-family:Lora,serif;';

    const gpcCopy = hasGpc()
      ? '<p style="margin:8px 0 0;font-size:12px;color:#7C9E87;line-height:1.5"><strong>Browser privacy signal detected.</strong> Analytics remain off while Global Privacy Control is enabled.</p>'
      : '';

    banner.innerHTML = `
      <div style="font-family:Playfair Display,serif;font-weight:700;font-size:19px;color:#2C4A38">Your privacy choices</div>
      <p style="margin:7px 0 0;font-size:13px;line-height:1.55;color:#385744">YourPetPass uses optional analytics from Google Analytics, Microsoft Clarity, and Vercel to understand what works and improve the app. We do not need these tools for YourPetPass to function, and we do not send pet names, medical records, document contents, or travel details to product analytics.</p>
      ${gpcCopy}
      <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px;align-items:center">
        <button type="button" data-ypp-consent="deny" style="${buttonStyle(false)}">Essential only</button>
        ${hasGpc() ? '' : `<button type="button" data-ypp-consent="grant" style="${buttonStyle(true)}">Allow analytics</button>`}
        <a href="/privacy.html" style="font-size:12px;color:#2C4A38;margin-left:auto">Privacy Policy</a>
      </div>`;

    banner.querySelector('[data-ypp-consent="deny"]')?.addEventListener('click', () => save('denied'));
    banner.querySelector('[data-ypp-consent="grant"]')?.addEventListener('click', () => save('granted'));
    document.body.appendChild(banner);
  }

  window.YPPAnalyticsConsent = Object.freeze({
    getStatus,
    isGranted: () => getStatus() === 'granted',
    grant: () => save('granted'),
    deny: () => save('denied'),
    open: renderBanner,
    eventName: EVENT_NAME,
  });

  const init = () => {
    const status = getStatus();
    if (status === 'granted') {
      loadAnalytics();
      renderChoicesButton();
    } else if (status === 'denied') {
      renderChoicesButton();
    } else {
      renderBanner();
    }
    dispatch(status);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
