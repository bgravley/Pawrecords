#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

# ── Auth: explicit signup attestation for both email and Google signup ──
auth_path = Path('src/components/Auth.jsx')
auth = auth_path.read_text(encoding='utf-8')
auth = replace_once(
    auth,
    'import { supabase } from "../lib/supabase";\n',
    'import { supabase } from "../lib/supabase";\nimport {\n  buildLegalAttestationMetadata,\n  clearPendingLegalAttestation,\n  markPendingLegalAttestation,\n} from "../lib/legalAttestation.js";\n',
    'Auth legal helper import',
)
auth = replace_once(
    auth,
    'export default function Auth() {',
    'export default function Auth({ initialMode = "signin" }) {',
    'Auth initial mode prop',
)
auth = replace_once(
    auth,
    '  const [authMode, setAuthMode] = useState("signin");',
    '  const [authMode, setAuthMode] = useState(initialMode === "signup" ? "signup" : "signin");',
    'Auth initial auth mode',
)
auth = replace_once(
    auth,
    '  const [showPassword, setShowPassword] = useState(false);',
    '  const [showPassword, setShowPassword] = useState(false);\n  const [legalAccepted, setLegalAccepted] = useState(false);',
    'Auth legal state',
)
old_google = '''  const signInWithGoogle = async () => {
    setLoading(true);
    clearAll();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { prompt: "select_account" },
        redirectTo: window.location.origin,
      },
    });
    if (oauthError) {
      setErr(oauthError);
      setLoading(false);
    }
  };'''
new_google = '''  const signInWithGoogle = async () => {
    if (authMode === "signup" && !legalAccepted) {
      return setErr("Please confirm the age and legal terms before creating your account.");
    }
    if (authMode === "signup") markPendingLegalAttestation();
    setLoading(true);
    clearAll();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { prompt: "select_account" },
        redirectTo: window.location.origin,
      },
    });
    if (oauthError) {
      if (authMode === "signup") clearPendingLegalAttestation();
      setErr(oauthError);
      setLoading(false);
    }
  };'''
auth = replace_once(auth, old_google, new_google, 'Google signup attestation')
old_email = '''  const signUpWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");

    setLoading(true);
    clearAll();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });'''
new_email = '''  const signUpWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    if (!legalAccepted) return setErr("Please confirm the age and legal terms before creating your account.");

    setLoading(true);
    clearAll();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: buildLegalAttestationMetadata('email_signup') },
    });'''
auth = replace_once(auth, old_email, new_email, 'Email signup attestation')
auth = replace_once(
    auth,
    '                  onClick={() => { setAuthMode(m); clearAll(); }}',
    '                  onClick={() => { setAuthMode(m); setLegalAccepted(false); clearAll(); }}',
    'Auth tab reset',
)
anchor = '''            </div>

            <button
              onClick={signInWithGoogle}'''
checkbox = '''            </div>

            {authMode === "signup" && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10, background: C.mint,
                border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 12px",
              }}>
                <input
                  id="adult-legal-attestation"
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => { setLegalAccepted(e.target.checked); clearAll(); }}
                  aria-label="Confirm adult age and legal terms"
                  style={{ marginTop: 3, width: 17, height: 17, accentColor: C.forest, flexShrink: 0 }}
                />
                <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.55 }}>
                  <label htmlFor="adult-legal-attestation" style={{ cursor: "pointer" }}>
                    I confirm I am at least 18 years old (or the age of majority where I live), and I agree to the
                  </label>{" "}
                  <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: C.forest, fontWeight: 600 }}>Terms of Service</a>{" "}
                  and acknowledge the{" "}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: C.forest, fontWeight: 600 }}>Privacy Policy</a>.
                </div>
              </div>
            )}

            <button
              onClick={signInWithGoogle}'''
auth = replace_once(auth, anchor, checkbox, 'Signup attestation UI')
auth = replace_once(
    auth,
    '              disabled={loading}\n              style={{\n                width: "100%", padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 600,\n                background: "#fff", color: C.text, border: `1.5px solid ${C.border}`,\n                cursor: loading ? "not-allowed" : "pointer", fontFamily: "\'Lora\', serif",',
    '              disabled={loading || (authMode === "signup" && !legalAccepted)}\n              style={{\n                width: "100%", padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 600,\n                background: "#fff", color: C.text, border: `1.5px solid ${C.border}`,\n                cursor: loading || (authMode === "signup" && !legalAccepted) ? "not-allowed" : "pointer", fontFamily: "\'Lora\', serif",\n                opacity: loading || (authMode === "signup" && !legalAccepted) ? 0.58 : 1,',
    'Google signup button disabled state',
)
auth = replace_once(
    auth,
    '                disabled={loading}\n                style={primaryBtn}',
    '                disabled={loading || (authMode === "signup" && !legalAccepted)}\n                style={{ ...primaryBtn, opacity: loading || (authMode === "signup" && !legalAccepted) ? 0.58 : 1, cursor: loading || (authMode === "signup" && !legalAccepted) ? "not-allowed" : "pointer" }}',
    'Email signup button disabled state',
)
auth_path.write_text(auth, encoding='utf-8')

# ── App: one-time gate covers OAuth-created users and existing accounts ──
app_path = Path('src/App.jsx')
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    'import AffiliatePortal from "./AffiliatePortal.jsx";\n',
    'import AffiliatePortal from "./AffiliatePortal.jsx";\nimport {\n  buildLegalAttestationMetadata,\n  clearPendingLegalAttestation,\n  hasCurrentLegalAttestation,\n  readPendingLegalAttestation,\n} from "./lib/legalAttestation.js";\n',
    'App legal helper import',
)
marker = '\nexport default function App() {'
legal_component = r'''

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
        <img src="/logo_horizontal_cream_transparent.png" alt="YourPetPass" style={{ display: 'none' }} />
        <div style={{ fontFamily: "'Playfair Display', serif", color: '#2C4A38', fontSize: 27, fontWeight: 700, lineHeight: 1.2, marginBottom: 10 }}>
          One quick account confirmation
        </div>
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
}'''
app = replace_once(app, marker, legal_component + marker, 'Legal attestation screen')
app = replace_once(
    app,
    '  const [upgradeRequestKey, setUpgradeRequestKey] = useState(0);',
    '  const [upgradeRequestKey, setUpgradeRequestKey] = useState(0);\n  const [authEntryMode, setAuthEntryMode] = useState("signin");\n  const [legalAttestationChecking, setLegalAttestationChecking] = useState(true);\n  const [legalAttestationRequired, setLegalAttestationRequired] = useState(false);',
    'App legal state',
)
old_auth_effect = '''  useEffect(() => {
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
  }, []);'''
new_auth_effect = '''  const resolveLegalAttestation = async (activeSession) => {
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
      const { data, error } = await supabase.auth.updateUser({ data: pending });
      if (!error && data?.user) {
        clearPendingLegalAttestation();
        setSession(prev => prev ? { ...prev, user: data.user } : { ...activeSession, user: data.user });
        setLegalAttestationRequired(false);
        setLegalAttestationChecking(false);
        return;
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
  }, []);'''
app = replace_once(app, old_auth_effect, new_auth_effect, 'App auth attestation resolution')
app = replace_once(
    app,
    '  const handleSignOut = async () => {',
    '''  const confirmLegalAttestation = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: buildLegalAttestationMetadata('post_auth_gate'),
    });
    if (error) throw error;
    if (!data?.user) throw new Error('Could not save your confirmation. Please try again.');
    clearPendingLegalAttestation();
    setSession(prev => prev ? { ...prev, user: data.user } : prev);
    setLegalAttestationRequired(false);
  };

  const handleSignOut = async () => {''',
    'App confirm function',
)
app = replace_once(
    app,
    '    setShowAuthScreen(false);\n  };',
    '    setShowAuthScreen(false);\n    setAuthEntryMode("signin");\n    setLegalAttestationRequired(false);\n    setLegalAttestationChecking(false);\n  };',
    'Signout legal reset',
)
app = replace_once(
    app,
    '  if (loading) return (',
    '  if (loading || legalAttestationChecking) return (',
    'Loading gate',
)
old_unauth = '''  if (!session) {
    if (showAuthScreen) return <Auth />;
    return <Marketing onLogin={() => setShowAuthScreen(true)} onSignup={() => setShowAuthScreen(true)} />;
  }

  // Admin route - only for admin email'''
new_unauth = '''  if (!session) {
    if (showAuthScreen) return <Auth initialMode={authEntryMode} />;
    return <Marketing
      onLogin={() => { setAuthEntryMode('signin'); setShowAuthScreen(true); }}
      onSignup={() => { setAuthEntryMode('signup'); setShowAuthScreen(true); }}
    />;
  }

  if (legalAttestationRequired) {
    return <LegalAttestationScreen onConfirm={confirmLegalAttestation} onSignOut={handleSignOut} />;
  }

  // Admin route - only for admin email'''
app = replace_once(app, old_unauth, new_unauth, 'App auth entry and gate placement')
app_path.write_text(app, encoding='utf-8')

# ── Synthetic production E2E users bypass no customer rule; they carry an
# explicit synthetic marker plus the current version so smoke tests exercise
# the app rather than being trapped by a human-only confirmation screen. ──
e2e_path = Path('api/e2e-login.js')
e2e = e2e_path.read_text(encoding='utf-8')
e2e = replace_once(
    e2e,
    "const TEST_ACCOUNTS = Object.freeze({",
    "const LEGAL_ATTESTATION_VERSION = '2026-09-07';\n\nconst TEST_ACCOUNTS = Object.freeze({",
    'E2E legal version',
)
e2e_anchor = '''    const userId = data?.user?.id || data?.properties?.user?.id;
    const actionLink = actionLinkFrom(data);
    if (!userId || !actionLink) throw new Error('Supabase did not return a usable E2E login link');

    if (req.body?.reset === true) await resetTestData(supabase, userId);'''
e2e_replacement = '''    const userId = data?.user?.id || data?.properties?.user?.id;
    const actionLink = actionLinkFrom(data);
    if (!userId || !actionLink) throw new Error('Supabase did not return a usable E2E login link');

    const { error: legalMetadataError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(data?.user?.user_metadata || {}),
        ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
        ypp_adult_attested_at: new Date().toISOString(),
        ypp_legal_attestation_method: 'synthetic_e2e',
      },
    });
    if (legalMetadataError) throw new Error('Could not prepare E2E legal metadata');

    if (req.body?.reset === true) await resetTestData(supabase, userId);'''
e2e = replace_once(e2e, e2e_anchor, e2e_replacement, 'E2E legal metadata')
e2e_path.write_text(e2e, encoding='utf-8')

print('Applied adult signup attestation and post-auth OAuth gate.')
