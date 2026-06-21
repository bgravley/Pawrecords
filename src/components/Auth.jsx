// src/components/Auth.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

// ── Emergency Lookup (unchanged functionality) ──────────────────────────────
const EmergencyLookup = ({ onBack }) => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("dogs")
      .select("id, name, breed, color, photo_url, emergency_token, pet_type")
      .not("emergency_token", "is", null)
      .order("name")
      .then(({ data }) => { setPets(data || []); setLoading(false); });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#8B7355", fontSize: 22, alignSelf: "flex-start", lineHeight: 1 }}>←</button>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🚨</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 22, color: "#2C2017", marginBottom: 4 }}>Emergency Pet Lookup</div>
        <div style={{ fontSize: 13, color: "#8B7355", lineHeight: 1.6 }}>Select the pet to view their health record.</div>
      </div>
      {loading
        ? <div style={{ textAlign: "center", padding: 20, color: "#8B7355" }}>Loading...</div>
        : pets.length === 0
          ? <div style={{ textAlign: "center", padding: 20, color: "#8B7355", fontSize: 14 }}>
              No pets found. Scan the QR code on the pet's tag to access their record.
            </div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pets.map(pet => (
                <button key={pet.id} onClick={() => window.location.href = `/emergency/${pet.emergency_token}`}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#FAF6F0", border: "1px solid #E8DDD0", borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
                  {pet.photo_url
                    ? <img src={pet.photo_url} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid #2D7D6F", flexShrink: 0 }} />
                    : <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#2D7D6F22", border: "2px solid #2D7D6F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, fontFamily: "'Lora', serif", fontWeight: 700, color: "#2D7D6F" }}>
                        {pet.name[0]}
                      </div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#2C2017", marginBottom: 2 }}>{pet.name}</div>
                    <div style={{ fontSize: 13, color: "#5A4535" }}>{pet.breed || "Dog"}{pet.color ? ` · ${pet.color}` : ""}</div>
                  </div>
                  <span style={{ fontSize: 18, color: "#8B7355" }}>›</span>
                </button>
              ))}
            </div>}
    </div>
  );
};

// ── Main Auth Component ─────────────────────────────────────────────────────
export default function Auth() {
  // mode: "main" | "forgot" | "emergency"
  const [mode, setMode]           = useState("main");
  const [authMode, setAuthMode]   = useState("signin"); // "signin" | "signup"
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const setErr = (e) => {
    // Handle all error types safely — never show {} or [object Object]
    if (!e) return setError(null);
    if (typeof e === "string") return setError(e);
    setError(e.message || e.error_description || e.msg || "Something went wrong — please try again.");
  };
  const clearAll = () => { setError(null); setSuccess(null); };

  const inp = {
    width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: 15,
    border: "1.5px solid #E8DDD0", background: "#FAF6F0", color: "#2C2017",
    outline: "none", fontFamily: "'Nunito', sans-serif", boxSizing: "border-box",
  };

  const primaryBtn = {
    width: "100%", padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700,
    background: "#2D7D6F", color: "#fff", border: "none", cursor: "pointer",
    fontFamily: "'Nunito', sans-serif", opacity: loading ? 0.7 : 1,
  };

  // ── Google sign-in ────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    setLoading(true); clearAll();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { queryParams: { prompt: "select_account", access_type: "offline" }, redirectTo: window.location.origin },
    });
    if (error) { setErr(error); setLoading(false); }
  };

  // ── Email sign-in ─────────────────────────────────────────────────────────
  const signInWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    setLoading(true); clearAll();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error);
    setLoading(false);
  };

  // ── Email sign-up ─────────────────────────────────────────────────────────
  const signUpWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");
    setLoading(true); clearAll();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErr(error);
    } else if (data?.user && data.user.identities?.length === 0) {
      // Supabase silently returns a user with no identities when email already exists
      setErr("An account with this email already exists. Try signing in instead.");
    } else {
      setSuccess("Account created! Check your email to confirm, then sign in.");
    }
    setLoading(false);
  };

  // ── Password reset ────────────────────────────────────────────────────────
  const sendReset = async () => {
    if (!email) return setErr("Enter your email address.");
    setLoading(true); clearAll();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setErr(error);
    else setSuccess("Reset link sent — check your inbox.");
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") authMode === "signin" ? signInWithEmail() : signUpWithEmail();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1E5C52", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,600;1,400;1,600&display=swap'); * { box-sizing: border-box; }`}</style>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 36, color: "#FFFFFF", marginBottom: 2 }}>
          🐾 <span style={{ fontWeight: 700 }}>Your</span><span style={{ color: "#F5C45E", fontWeight: 700 }}>Pet</span><span style={{ fontWeight: 700 }}>Pass</span>
        </div>
        <div style={{ color: "#F5C45E", fontSize: 14, fontStyle: "italic", fontFamily: "'Lora', serif" }}>
          Your pet's health passport
        </div>
      </div>

      {/* Card */}
      <div style={{ background: "#FFFFFF", borderRadius: 24, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>

        {/* Error */}
        {error && (
          <div style={{ background: "#C4714A10", border: "1px solid #C4714A55", borderRadius: 12, padding: "11px 14px", marginBottom: 16, fontSize: 14, color: "#C4714A", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <span>{error}</span>
            <button onClick={clearAll} style={{ background: "none", border: "none", color: "#C4714A", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ background: "#2D7D6F10", border: "1px solid #2D7D6F55", borderRadius: 12, padding: "11px 14px", marginBottom: 16, fontSize: 14, color: "#2D7D6F" }}>
            {success}
          </div>
        )}

        {/* ── MAIN: Sign In / Create Account ── */}
        {mode === "main" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Toggle */}
            <div style={{ display: "flex", background: "#FAF6F0", borderRadius: 12, padding: 3, marginBottom: 4 }}>
              {["signin", "signup"].map(m => (
                <button key={m} onClick={() => { setAuthMode(m); clearAll(); }}
                  style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Nunito', sans-serif", transition: "all .15s",
                    background: authMode === m ? "#2D7D6F" : "transparent",
                    color: authMode === m ? "#fff" : "#8B7355",
                    boxShadow: authMode === m ? "0 2px 8px #2D7D6F33" : "none",
                  }}>
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            {/* Google */}
            <button onClick={signInWithGoogle} disabled={loading}
              style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 15, fontWeight: 700, background: "#fff", color: "#2C2017", border: "1.5px solid #E8DDD0", cursor: "pointer", fontFamily: "'Nunito', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/>
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.1-17.7 10.7z"/>
                <path fill="#FBBC05" d="M24 45c5.9 0 10.9-2 14.5-5.4l-6.7-5.5C29.9 35.9 27.1 37 24 37c-6.1 0-11.2-4.1-13-9.6l-7 5.4C7.7 40.6 15.3 45 24 45z"/>
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.8-4.9 6.3l6.7 5.5C42 37.1 45 31 45 24c0-1.4-.2-2.7-.5-4z"/>
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: "#E8DDD0" }} />
              <span style={{ fontSize: 12, color: "#8B7355" }}>or with email</span>
              <div style={{ flex: 1, height: 1, background: "#E8DDD0" }} />
            </div>

            {/* Email + Password */}
            <input style={inp} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} autoComplete="email"/>
            <div style={{ position: "relative" }}>
              <input style={{ ...inp, paddingRight: 48 }} type={showPassword ? "text" : "password"}
                placeholder={authMode === "signup" ? "Password (min 6 characters)" : "Password"}
                value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKeyDown}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}/>
              <button onClick={() => setShowPassword(p => !p)}
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8B7355", fontSize: 13, fontFamily: "'Nunito', sans-serif" }}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {/* Primary action */}
            {!success && (
              <button onClick={authMode === "signin" ? signInWithEmail : signUpWithEmail} disabled={loading} style={primaryBtn}>
                {loading ? (authMode === "signin" ? "Signing in..." : "Creating account...") : (authMode === "signin" ? "Sign In" : "Create Account")}
              </button>
            )}

            {/* Forgot password — only on sign in */}
            {authMode === "signin" && (
              <button onClick={() => { setMode("forgot"); clearAll(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#2D7D6F", fontSize: 13, fontFamily: "'Nunito', sans-serif", padding: 0, textAlign: "center" }}>
                Forgot your password?
              </button>
            )}

            {/* Legal */}
            <div style={{ fontSize: 11, color: "#8B7355", textAlign: "center", lineHeight: 1.7 }}>
              By continuing you agree to our{" "}
              <a href="/terms.html" style={{ color: "#2D7D6F" }}>Terms of Service</a> and{" "}
              <a href="/privacy.html" style={{ color: "#2D7D6F" }}>Privacy Policy</a>.
            </div>

            {/* Emergency lookup — subtle link at bottom */}
            <div style={{ borderTop: "1px solid #F0E8DC", paddingTop: 14, textAlign: "center" }}>
              <button onClick={() => { setMode("emergency"); clearAll(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#C4714A", fontSize: 13, fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>
                🚨 Emergency Pet Lookup
              </button>
              <div style={{ fontSize: 11, color: "#8B7355", marginTop: 3 }}>Found a lost pet? Access their health record.</div>
            </div>
          </div>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button onClick={() => { setMode("main"); clearAll(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#8B7355", fontSize: 22, alignSelf: "flex-start", lineHeight: 1 }}>←</button>
            <div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 22, color: "#2C2017", marginBottom: 4 }}>Reset Password</div>
              <div style={{ fontSize: 14, color: "#8B7355" }}>Enter your email and we'll send a reset link.</div>
            </div>
            <input style={inp} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
            {!success && (
              <button onClick={sendReset} disabled={loading} style={primaryBtn}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            )}
          </div>
        )}

        {/* ── EMERGENCY LOOKUP ── */}
        {mode === "emergency" && (
          <EmergencyLookup onBack={() => { setMode("main"); clearAll(); }} />
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
        YourPetPass · Secure pet health records for travelers
      </div>
    </div>
  );
}
