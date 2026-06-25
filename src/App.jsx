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
    border: '1.5px solid #E8DDD0', background: '#FAF6F0', color: '#2C2017',
    outline: 'none', fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box',
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
    <div style={{ minHeight: '100vh', background: '#FAF6F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 4px 24px #0000000D', border: '1px solid #E8DDD0' }}>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: '#1E5C52', marginBottom: 6, textAlign: 'center' }}>
          🐾 YourPetPass
        </div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: '#2C2017', marginBottom: 20, textAlign: 'center' }}>
          Set New Password
        </div>
        {success ? (
          <div style={{ background: '#2D7D6F14', border: '1px solid #2D7D6F44', borderRadius: 12, padding: 16, color: '#2D7D6F', fontWeight: 600, textAlign: 'center' }}>
            ✓ Password updated! Redirecting...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5A4535', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                style={inp} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#5A4535', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={inp} placeholder="Type it again" autoComplete="new-password" />
            </div>
            {error && <div style={{ background: '#C4714A14', border: '1px solid #C4714A44', borderRadius: 10, padding: '10px 14px', color: '#C4714A', fontSize: 14 }}>{error}</div>}
            <button onClick={handleReset} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700, background: '#2D7D6F', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: "'Nunito', sans-serif" }}>
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </div>
        )}
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        applyReferral(session.user.id);
        loadProfile(session.user.id);
      } else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // When user clicks the reset link in their email, show the reset form
      if (_event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
        setSession(session);
        setLoading(false);
        return;
      }
      setSession(session);
      if (session) {
        applyReferral(session.user.id);
        loadProfile(session.user.id);
      } else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (error) console.error("Failed to load profile:", error);
    setProfile(data);
    setLoading(false);
    // Check if this user is an affiliate (uses RLS — only returns their own record if exists)
    const { data: affData } = await supabase.from("affiliates").select("id").eq("user_id", userId).single();
    setIsAffiliate(!!affData);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setShowAdmin(false);
    setShowTravel(false);
    setShowAuthScreen(false);
  };

  // Check for emergency route - no login needed
  const path = window.location.pathname;
  const emergencyMatch = path.match(/^\/emergency\/([a-z0-9]+)$/i);
  if (emergencyMatch) {
    return <Emergency token={emergencyMatch[1]} />;
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 900, color: "#2D7D6F" }}>
        🐾 Loading...
      </div>
    </div>
  );

  // Password recovery — user clicked the reset link in their email
  if (showPasswordReset) {
    return <ResetPasswordScreen onDone={() => setShowPasswordReset(false)} />;
  }

  if (!session) {
    if (showAuthScreen) return <Auth />;
    return <Marketing onLogin={() => setShowAuthScreen(true)} onSignup={() => setShowAuthScreen(true)} />;
  }

  // Admin route - only for admin email
  const isAdmin = session.user.email === ADMIN_EMAIL || profile?.is_admin === true;

  if (showAdmin && isAdmin) {
    return <Admin onBack={() => setShowAdmin(false)} />;
  }

  if (showTravel) {
    return <Travel userId={session.user.id} onBack={() => setShowTravel(false)} />;
  }

  return (
    <>
      {paymentToast==='success'&&(
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#2D7D6F',color:'#fff',borderRadius:12,padding:'12px 24px',fontSize:15,fontWeight:700,zIndex:9999,boxShadow:'0 4px 20px #00000033',display:'flex',alignItems:'center',gap:10}}>
          🎉 Payment successful! Your account is being upgraded — this may take a moment.
        </div>
      )}
      {paymentToast==='canceled'&&(
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',background:'#5A4535',color:'#fff',borderRadius:12,padding:'12px 24px',fontSize:15,fontWeight:600,zIndex:9999,boxShadow:'0 4px 20px #00000033'}}>
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
        />
      )}
    </>
  );
}
