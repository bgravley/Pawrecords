// src/App.jsx
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import Marketing from "./Marketing.jsx";
import YourPetPass from "./PawRecord.jsx";
import Admin from "./Admin.jsx";
import Emergency from "./Emergency.jsx";
import Travel from "./Travel.jsx";
import AffiliatePortal from "./AffiliatePortal.jsx";
import {
  clearPendingLegalAttestation,
  hasCurrentLegalAttestation,
  readPendingLegalAttestation,
} from "./lib/legalAttestation.js";

// Your admin email — only this account sees the admin dashboard
const ADMIN_EMAIL = "bgravley@rdmarketingllc.com";

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const inp = {
    width: '100%', padding: '13px 16px', borderRadius: 12, fontSize: 15,
    border: '1.5px solid #DCE8E0', background: '#FAFCFB', color: '#1A2E22',
    outline: 'none', fontFamily: "'Lora', serif", boxSizing: 'border-box',
  };

  const handleReset = async () => {
    if (!password || password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => onDone(), 2000);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFCFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px #0000000D', border: '1px solid #DCE8E0' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: '#2C4A38', marginBottom: 6, textAlign: 'center' }}>
          🐾 YourPetPass
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#1A2E22', marginBottom: 20, textAlign: 'center' }}>
          Set New Password
        </div>
        {success ? (
          <div style={{ background: '#2C4A3814', border: '1px solid #2C4A3844', borderRadius: 12, padding: 16, color: '#2C4A38', fontWeight: 600, textAlign: 'center' }}>
            ✓ Password updated! Redirecting...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5C7464', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={inp} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5C7464', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={inp} placeholder="Type it again" autoComplete="new-password" />
            </div>
            {error && <div style={{ background: '#A8583E14', border: '1px solid #A8583E44', borderRadius: 10, padding: '10px 14px', color: '#A8583E', fontSize: 14 }}>{error}</div>}
            <button onClick={handleReset} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700, background: '#2C4A38', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: "'Lora', serif" }}>
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


function LegalAttestationScreen({ onConfirm, onSignOut }) {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    if (!accepted || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e?.message || 'Could not save your confirmation. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#2C4A38', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Lora', serif" }}>
      <div style={{ width: '100%', maxWidth: 430, background: '#FAFCFB', borderRadius: 22, padding: 30, boxShadow: '0 14px 44px rgba(20,42,29,.28)' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#2C4A38', fontSize: 27, fontWeight: 700, lineHeight: 1.2, margin: '0 0 10px' }}>
          One quick account confirmation
        </h1>
        <p style={{ color: '#5C7464', fontSize: 13.5, lineHeight: 1.65, margin: '0 0 18px' }}>
          YourPetPass accounts are for adults. Confirm this once to continue to your pet's records.
        </p>
        <div style={{ background: '#EAF4EE', border: '1px solid #DCE8E0', borderRadius: 12, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input id="post-auth-adult-attestation" type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} aria-label="Confirm adult age and legal terms" style={{ marginTop: 3, width: 18, height: 18, accentColor: '#2C4A38', flexShrink: 0 }} />
          <div style={{ color: '#1A2E22', fontSize: 12.5, lineHeight: 1.6 }}>
            <label htmlFor="post-auth-adult-attestation" style={{ cursor: 'pointer' }}>
              I confirm I am at least 18 years old (or the age of majority where I live), and I agree to the
            </label>{' '}
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#2C4A38', fontWeight: 600 }}>Terms of Service</a>{' '}
            and acknowledge the{' '}
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#2C4A38', fontWeight: 600 }}>Privacy Policy</a>.
          </div>
        </div>
        {error && <div role="alert" style={{ marginTop: 12, color: '#A8583E', fontSize: 13 }}>{error}</div>}
        <button type="button" onClick={confirm} disabled={!accepted || saving} style={{ width: '100%', marginTop: 16, padding: 13, border: 'none', borderRadius: 12, background: '#2C4A38', color: '#fff', fontFamily: "'Lora', serif", fontSize: 14, fontWeight: 600, opacity: !accepted || saving ? .55 : 1, cursor: !accepted || saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving...' : 'Confirm & Continue'}
        </button>
        <button type="button" onClick={onSignOut} disabled={saving} style={{ width: '100%', marginTop: 10, padding: 9, border: 'none', background: 'transparent', color: '#5C7464', fontFamily: "'Lora', serif", fontSize: 12.5, cursor: saving ? 'not-allowed' : 'pointer' }}>
          Sign out instead
        </button>
      </div>
    </div>
  );
}
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTravel, setShowTravel] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [paymentToast, setPaymentToast] = useState(null); // 'success' | 'canceled' | null
  const [showAffiliatePortal, setShowAffiliatePortal] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [upgradeRequestKey, setUpgradeRequestKey] = useState(0);
  const [authEntryMode, setAuthEntryMode] = useState("signin");
  const [legalAttestationChecking, setLegalAttestationChecking] = useState(true);
  const [legalAttestationRequired, setLegalAttestationRequired] = useState(false);

  // Detect Stripe payment redirect (?payment=success or ?payment=canceled)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
      setPaymentToast('success');
      setTimeout(() => setPaymentToast(null), 6000);
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname);
      // Reload profile after a short delay so webhook has time to update the tier
      setTimeout(() => {
        if (session?.user?.id) loadProfile(session.user.id);
      }, 3000);
    } else if (payment === 'canceled') {
      setPaymentToast('canceled');
      setTimeout(() => setPaymentToast(null), 4000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [session]);

  // Capture referral code from URL (?ref=CODE) and store it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('ypref', ref.toUpperCase().trim());
      // Clean the URL so the code isn't visible after capture
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  // Apply a stored referral code to a user's profile (first login only)
  const applyReferral = async (userId) => {
    const code = localStorage.getItem('ypref');
    if (!code) return;
    try {
      // Only apply if the profile doesn't already have a referral recorded
      const { data: prof } = await supabase.from('profiles').select('referral_code_used').eq('id', userId).single();
      if (prof && !prof.referral_code_used) {
        await supabase.from('profiles').update({ referral_code_used: code }).eq('id', userId);
      }
      localStorage.removeItem('ypref');
    } catch (e) {
      console.error('Referral apply error:', e);
    }
  };

  const persistLegalAttestation = async (activeSession, method) => {
    const token = activeSession?.access_token;
    if (!token) throw new Error('Your session has expired — please sign in again.');
    const response = await fetch('/api/confirm-legal-attestation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ confirmed: true, method }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.confirmed !== true) {
      throw new Error(body?.error || 'Could not save your confirmation — please try again.');
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.session) throw new Error('Could not refresh your account confirmation — please sign in again.');
    setSession(refreshed.session);
    return refreshed.session;
  };

  const resolveLegalAttestation = async (activeSession) => {
    setLegalAttestationChecking(true);
    if (!activeSession?.user) {
      setLegalAttestationRequired(false);
      setLegalAttestationChecking(false);
      return;
    }
    if (hasCurrentLegalAttestation(activeSession.user)) {
      clearPendingLegalAttestation();
      setLegalAttestationRequired(false);
      setLegalAttestationChecking(false);
      return;
    }

    const pending = readPendingLegalAttestation();
    if (pending) {
      try {
        await persistLegalAttestation(activeSession, pending.method);
        clearPendingLegalAttestation();
        setLegalAttestationRequired(false);
        setLegalAttestationChecking(false);
        return;
      } catch (error) {
        console.error('Could not persist pending legal attestation:', error.message);
      }
    }

    setLegalAttestationRequired(true);
    setLegalAttestationChecking(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        applyReferral(session.user.id);
        loadProfile(session.user.id);
        resolveLegalAttestation(session);
      } else {
        setLegalAttestationChecking(false);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // When user clicks the reset link in their email, show the reset form first.
      if (_event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
        setSession(session);
        setLegalAttestationChecking(false);
        setLoading(false);
        return;
      }
      setSession(session);
      if (session) {
        applyReferral(session.user.id);
        loadProfile(session.user.id);
        resolveLegalAttestation(session);
      } else {
        setProfile(null);
        setLegalAttestationRequired(false);
        setLegalAttestationChecking(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) console.error("Failed to load profile:", error);
    setProfile(data);
    setLoading(false);
    // Check if this user is an affiliate (uses RLS — only returns their own record if exists).
    // .maybeSingle() (not .single()) so this can't silently become "not an
    // affiliate" if a duplicate row ever exists again for any reason — a DB
    // unique constraint now prevents that at the source, but this stays
    // resilient either way rather than trusting a single layer of defense.
    const { data: affData } = await supabase.from("affiliates").select("id").eq("user_id", userId).limit(1).maybeSingle();
    setIsAffiliate(!!affData);
  };

  const confirmLegalAttestation = async () => {
    const currentSession = session || (await supabase.auth.getSession()).data?.session;
    await persistLegalAttestation(currentSession, 'post_auth_gate');
    clearPendingLegalAttestation();
    setLegalAttestationRequired(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setShowAdmin(false);
    setShowTravel(false);
    setShowAuthScreen(false);
    setAuthEntryMode("signin");
    setLegalAttestationRequired(false);
    setLegalAttestationChecking(false);
  };

  // Check for emergency route - no login needed
  const path = window.location.pathname;
  const emergencyMatch = path.match(/^\/emergency\/([a-z0-9]+)$/i);
  if (emergencyMatch) {
    return <Emergency token={emergencyMatch[1]} />;
  }

  if (loading || legalAttestationChecking) return (
    <div style={{ minHeight: "100vh", background: "#FAFCFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 28, fontWeight: 900, color: "#2C4A38" }}>
        🐾 Loading...
      </div>
    </div>
  );

  // Password recovery — user clicked the reset link in their email
  if (showPasswordReset) {
    return <ResetPasswordScreen onDone={() => setShowPasswordReset(false)} />;
  }

  if (!session) {
    if (showAuthScreen) return <Auth initialMode={authEntryMode} />;
    return <Marketing
      onLogin={() => { setAuthEntryMode('signin'); setShowAuthScreen(true); }}
      onSignup={() => { setAuthEntryMode('signup'); setShowAuthScreen(true); }}
    />;
  }

  if (legalAttestationRequired) {
    return <LegalAttestationScreen onConfirm={confirmLegalAttestation} onSignOut={handleSignOut} />;
  }

  // Admin route - only for admin email
  const isAdmin = session.user.email === ADMIN_EMAIL || profile?.is_admin === true;

  if (showAdmin && isAdmin) {
    return <Admin onBack={() => setShowAdmin(false)} />;
  }

  if (showTravel) {
    return <Travel
      userId={session.user.id}
      tier={profile?.subscription_tier || 'free'}
      onUpgrade={() => {
        setShowTravel(false);
        setUpgradeRequestKey(key => key + 1);
      }}
      onBack={() => setShowTravel(false)}
    />;
  }

  return (
    <>
      {paymentToast==='success'&&(
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#2C4A38',color:'#fff',borderRadius:12,padding:'12px 24px',fontSize:15,fontWeight:700,zIndex:9999,boxShadow:'0 4px 20px #00000033',display:'flex',alignItems:'center',gap:10}}>
          🎉 Payment successful! Your account is being upgraded — this may take a moment.
        </div>
      )}
      {paymentToast==='canceled'&&(
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#5C7464',color:'#fff',borderRadius:12,padding:'12px 24px',fontSize:15,fontWeight:600,zIndex:9999,boxShadow:'0 4px 20px #00000033'}}>
          Checkout canceled — no charge was made.
        </div>
      )}
      {showAffiliatePortal ? (
        <AffiliatePortal
          userId={session.user.id}
          userEmail={session.user.email}
          onClose={() => setShowAffiliatePortal(false)}
        />
      ) : (
        <YourPetPass
          userId={session.user.id}
          profile={profile}
          onSignOut={handleSignOut}
          isAdmin={isAdmin}
          isAffiliate={isAffiliate}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenTravel={() => setShowTravel(true)}
          onOpenAffiliate={() => setShowAffiliatePortal(true)}
          upgradeRequestKey={upgradeRequestKey}
        />
      )}
    </>
  );
}
