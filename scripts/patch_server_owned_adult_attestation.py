#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

# Auth: keep the explicit checkbox, but use only short-lived sessionStorage as
# a pre-auth handoff. Durable confirmation is written server-side after auth.
p = Path('src/components/Auth.jsx')
t = p.read_text(encoding='utf-8')
t = replace_once(t,
'''import {
  buildLegalAttestationMetadata,
  clearPendingLegalAttestation,
  markPendingLegalAttestation,
} from "../lib/legalAttestation.js";''',
'''import {
  clearPendingLegalAttestation,
  markPendingLegalAttestation,
} from "../lib/legalAttestation.js";''',
'Auth imports')
t = replace_once(t, "if (authMode === \"signup\") markPendingLegalAttestation();", "if (authMode === \"signup\") markPendingLegalAttestation('google_signup');", 'Google pending method')
old_signup = '''    setLoading(true);
    clearAll();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: buildLegalAttestationMetadata('email_signup') },
    });

    if (signUpError) {
      setErr(signUpError);
    } else if (data?.user && data.user.identities?.length === 0) {
      setErr("An account with this email already exists. Try signing in instead.");
    } else {
      setSuccess("Account created. Check your email to confirm your address, then sign in.");
    }'''
new_signup = '''    markPendingLegalAttestation('email_signup');
    setLoading(true);
    clearAll();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      clearPendingLegalAttestation();
      setErr(signUpError);
    } else if (data?.user && data.user.identities?.length === 0) {
      clearPendingLegalAttestation();
      setErr("An account with this email already exists. Try signing in instead.");
    } else {
      setSuccess("Account created. Check your email to confirm your address, then sign in.");
    }'''
t = replace_once(t, old_signup, new_signup, 'Email signup pending handoff')
p.write_text(t, encoding='utf-8')

# App: write/refresh the durable attestation only through the authenticated
# server route, whose service role writes protected app_metadata.
p = Path('src/App.jsx')
t = p.read_text(encoding='utf-8')
t = replace_once(t,
'''import {
  buildLegalAttestationMetadata,
  clearPendingLegalAttestation,
  hasCurrentLegalAttestation,
  readPendingLegalAttestation,
} from "./lib/legalAttestation.js";''',
'''import {
  clearPendingLegalAttestation,
  hasCurrentLegalAttestation,
  readPendingLegalAttestation,
} from "./lib/legalAttestation.js";''',
'App imports')
t = replace_once(t,
'''        <img src="/logo_horizontal_cream_transparent.png" alt="YourPetPass" style={{ display: 'none' }} />
        <div style={{ fontFamily: "'Playfair Display', serif", color: '#2C4A38', fontSize: 27, fontWeight: 700, lineHeight: 1.2, marginBottom: 10 }}>
          One quick account confirmation
        </div>''',
'''        <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#2C4A38', fontSize: 27, fontWeight: 700, lineHeight: 1.2, margin: '0 0 10px' }}>
          One quick account confirmation
        </h1>''',
'Attestation heading semantics')
resolve_anchor = '''  const resolveLegalAttestation = async (activeSession) => {'''
persist_fn = '''  const persistLegalAttestation = async (activeSession, method) => {
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

  const resolveLegalAttestation = async (activeSession) => {'''
t = replace_once(t, resolve_anchor, persist_fn, 'Server attestation persistence helper')
old_pending = '''    const pending = readPendingLegalAttestation();
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

    setLegalAttestationRequired(true);'''
new_pending = '''    const pending = readPendingLegalAttestation();
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

    setLegalAttestationRequired(true);'''
t = replace_once(t, old_pending, new_pending, 'Pending confirmation server write')
old_confirm = '''  const confirmLegalAttestation = async () => {
    const { data, error } = await supabase.auth.updateUser({
      data: buildLegalAttestationMetadata('post_auth_gate'),
    });
    if (error) throw error;
    if (!data?.user) throw new Error('Could not save your confirmation. Please try again.');
    clearPendingLegalAttestation();
    setSession(prev => prev ? { ...prev, user: data.user } : prev);
    setLegalAttestationRequired(false);
  };'''
new_confirm = '''  const confirmLegalAttestation = async () => {
    const currentSession = session || (await supabase.auth.getSession()).data?.session;
    await persistLegalAttestation(currentSession, 'post_auth_gate');
    clearPendingLegalAttestation();
    setLegalAttestationRequired(false);
  };'''
t = replace_once(t, old_confirm, new_confirm, 'Post-auth confirmation server write')
p.write_text(t, encoding='utf-8')

# Synthetic E2E accounts use protected app_metadata too; this remains inside
# the fixed-account, OIDC-gated test bootstrap only.
p = Path('api/e2e-login.js')
t = p.read_text(encoding='utf-8')
t = replace_once(t,
'''    const { error: legalMetadataError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(data?.user?.user_metadata || {}),
        ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
        ypp_adult_attested_at: new Date().toISOString(),
        ypp_legal_attestation_method: 'synthetic_e2e',
      },
    });''',
'''    const { error: legalMetadataError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(data?.user?.app_metadata || {}),
        ypp_legal_attestation_version: LEGAL_ATTESTATION_VERSION,
        ypp_adult_attested_at: new Date().toISOString(),
        ypp_legal_attestation_method: 'synthetic_e2e',
      },
    });''',
'E2E protected legal metadata')
p.write_text(t, encoding='utf-8')

# Production smoke: prove the public signup checkbox gates both create-account
# buttons without creating a real customer, and prove the server endpoint
# rejects anonymous writes. The existing authenticated smoke proves the fixed
# synthetic session can still reach the app with protected E2E metadata.
p = Path('scripts/live_smoke.mjs')
t = p.read_text(encoding='utf-8')
old_auth_smoke = '''  await publicPage.getByRole('button', { name: 'Create Account' }).click();
  await publicPage.getByPlaceholder(/Password \\(min \\d+ characters\\)/).waitFor({ state: 'visible' });
  await publicPage.getByRole('button', { name: 'Have an emergency QR code?' }).click();'''
new_auth_smoke = '''  await publicPage.getByRole('button', { name: 'Create Account' }).click();
  await publicPage.getByPlaceholder(/Password \\(min \\d+ characters\\)/).waitFor({ state: 'visible' });
  const legalCheckbox = publicPage.getByRole('checkbox', { name: 'Confirm adult age and legal terms', exact: true });
  await legalCheckbox.waitFor({ state: 'visible', timeout: 10000 });
  const googleSignup = publicPage.getByRole('button', { name: 'Continue with Google', exact: true });
  const emailSignup = publicPage.getByRole('button', { name: 'Create Account', exact: true }).last();
  if (!(await googleSignup.isDisabled()) || !(await emailSignup.isDisabled())) throw new Error('Signup actions were enabled before adult/legal confirmation');
  await legalCheckbox.check();
  if (await googleSignup.isDisabled() || await emailSignup.isDisabled()) throw new Error('Signup actions stayed disabled after adult/legal confirmation');
  await expectVisibleText(publicPage, 'at least 18 years old');
  await publicPage.getByRole('button', { name: 'Have an emergency QR code?' }).click();'''
t = replace_once(t, old_auth_smoke, new_auth_smoke, 'Public signup smoke')
anon_anchor = '''await check('Private Storage gateway rejects anonymous access', async () => {
  const response = await publicContext.request.get(`${BASE}/api/storage-file?path=live-smoke/no-file.pdf`);
  if (response.status() !== 401) throw new Error(`Expected 401, got ${response.status()}`);
});
'''
anon_new = anon_anchor + '''
await check('Adult attestation endpoint rejects anonymous writes', async () => {
  const response = await publicContext.request.post(`${BASE}/api/confirm-legal-attestation`, {
    data: { confirmed: true, method: 'post_auth_gate' },
  });
  if (response.status() !== 401) throw new Error(`Expected 401, got ${response.status()}`);
});
'''
t = replace_once(t, anon_anchor, anon_new, 'Anonymous attestation endpoint smoke')
p.write_text(t, encoding='utf-8')

print('Converted adult attestation to server-owned app metadata and expanded production smoke.')
