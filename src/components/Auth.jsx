// src/components/Auth.jsx
import { useState } from "react";
import { supabase } from "../lib/supabase";

const C = {
  forest: "#2C4A38",
  sage: "#7C9E87",
  lightSage: "#9DC4AA",
  mint: "#EAF4EE",
  warm: "#FAFCFB",
  gold: "#C9A84C",
  text: "#1A2E22",
  muted: "#617568",
  border: "#DCE8E0",
  danger: "#A64E3B",
};

const EmergencyAccessInfo = ({ onBack }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <button
      onClick={onBack}
      aria-label="Back to sign in"
      style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, alignSelf: "flex-start", lineHeight: 1, padding: 0 }}
    >
      ←
    </button>

    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>🐾</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: C.forest, marginBottom: 8 }}>
        Emergency Pet Record
      </div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
        Emergency records are private and cannot be searched or browsed by name.
      </div>
    </div>

    <div style={{ background: C.mint, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, color: C.text, fontSize: 14, lineHeight: 1.75 }}>
      <strong style={{ color: C.forest }}>To open a pet's emergency record:</strong>
      <ol style={{ margin: "10px 0 0", paddingLeft: 20 }}>
        <li>Scan the QR code on the pet's YourPetPass card or tag.</li>
        <li>Or open the emergency link the pet parent shared with you.</li>
      </ol>
    </div>

    <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.65, textAlign: "center" }}>
      This protects pet health information from being publicly listed while keeping the QR card available when it is actually needed.
    </div>
  </div>
);

export default function Auth() {
  // mode: "main" | "forgot" | "emergency"
  const [mode, setMode] = useState("main");
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const setErr = (e) => {
    if (!e) return setError(null);
    if (typeof e === "string") return setError(e);
    setError(e.message || e.error_description || e.msg || "Something went wrong — please try again.");
  };

  const clearAll = () => {
    setError(null);
    setSuccess(null);
  };

  const inp = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    fontSize: 15,
    border: `1.5px solid ${C.border}`,
    background: C.warm,
    color: C.text,
    outline: "none",
    fontFamily: "'Lora', serif",
    boxSizing: "border-box",
  };

  const primaryBtn = {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    background: C.forest,
    color: "#fff",
    border: "none",
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "'Lora', serif",
    opacity: loading ? 0.7 : 1,
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    clearAll();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { queryParams: { prompt: "select_account" }, redirectTo: window.location.origin },
    });
    if (error) {
      setErr(error);
      setLoading(false);
    }
  };

  const signInWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    setLoading(true);
    clearAll();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error);
    setLoading(false);
  };

  const signUpWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    setLoading(true);
    clearAll();

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErr(error);
    } else if (data?.user && data.user.identities?.length === 0) {
      setErr("An account with this email already exists. Try signing in instead.");
    } else {
      setSuccess("Account created! Check your email to confirm, then sign in.");
    }
    setLoading(false);
  };

  const sendReset = async () => {
    if (!email) return setErr("Enter your email address.");
    setLoading(true);
    clearAll();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setErr(error);
    else setSuccess("Reset link sent — check your inbox.");
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") authMode === "signin" ? signInWithEmail() : signUpWithEmail();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.forest, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Lora', serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Playfair+Display:wght@700;800&display=swap'); * { box-sizing: border-box; }`}</style>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img src="/logo_horizontal_cream_transparent.png" alt="YourPetPass" style={{ height: 48, maxWidth: "min(320px, 78vw)", objectFit: "contain" }} />
        <div style={{ color: C.lightSage, fontSize: 13.5, marginTop: 8, letterSpacing: ".02em" }}>
          Health Records &amp; Travel, Simplified.
        </div>
      </div>

      <div style={{ background: C.warm, borderRadius: 24, padding: 30, width: "100%", maxWidth: 410, boxShadow: "0 12px 44px rgba(18,39,28,0.28)", border: `1px solid ${C.border}` }}>
        {error && (
          <div style={{ background: "#FFF5F2", border: "1px solid #E8BEB4", borderRadius: 12, padding: "11px 14px", marginBottom: 16, fontSize: 14, color: C.danger, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <span>{error}</span>
            <button onClick={clearAll} aria-label="Dismiss error" style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        )}

        {success && (
          <div style={{ background: C.mint, border: `1px solid ${C.lightSage}`, borderRadius: 12, padding: "11px 14px", marginBottom: 16, fontSize: 14, color: C.forest }}>
            {success}
          </div>
        )}

        {mode === "main" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ textAlign: "center", marginBottom: 2 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 25, color: C.forest }}>
                {authMode === "signin" ? "Welcome back" : "Create your account"}
              </div>
            </div>

            <div style={{ display: "flex", background: C.mint, borderRadius: 12, padding: 3, marginBottom: 4 }}>
              {["signin", "signup"].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setAuthMode(m);
                    clearAll();
                  }}
                  style={{
                    flex: 1,
                    padding: "9px 0",
                    borderRadius: 10,
                    border: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "'Lora', serif",
                    transition: "all .15s",
                    background: authMode === m ? C.forest : "transparent",
                    color: authMode === m ? "#fff" : C.muted,
                    boxShadow: authMode === m ? "0 2px 8px rgba(44,74,56,.18)" : "none",
                  }}
                >
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <button
              onClick={signInWithGoogle}
              disabled={loading}
              style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 15, fontWeight: 600, background: "#fff", color: C.text, border: `1.5px solid ${C.border}`, cursor: "pointer", fontFamily: "'Lora', serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z" />
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.1-17.7 10.7z" />
                <path fill="#FBBC05" d="M24 45c5.9 0 10.9-2 14.5-5.4l-6.7-5.5C29.9 35.9 27.1 37 24 37c-6.1 0-11.2-4.1-13-9.6l-7 5.4C7.7 40.6 15.3 45 24 45z" />
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.8-4.9 6.3l6.7 5.5C42 37.1 45 31 45 24c0-1.4-.2-2.7-.5-4z" />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 12, color: C.muted }}>or with email</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <input
              style={inp}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
            />

            <div style={{ position: "relative" }}>
              <input
                style={{ ...inp, paddingRight: 48 }}
                type={showPassword ? "text" : "password"}
                placeholder={authMode === "signup" ? "Password (min 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              />
              <button
                onClick={() => setShowPassword((p) => !p)}
                type="button"
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, fontFamily: "'Lora', serif" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {!success && (
              <button onClick={authMode === "signin" ? signInWithEmail : signUpWithEmail} disabled={loading} style={primaryBtn}>
                {loading ? (authMode === "signin" ? "Signing in..." : "Creating account...") : authMode === "signin" ? "Sign In" : "Create Account"}
              </button>
            )}

            {authMode === "signin" && (
              <button
                onClick={() => {
                  setMode("forgot");
                  clearAll();
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.forest, fontSize: 13, fontFamily: "'Lora', serif", padding: 0, textAlign: "center" }}
              >
                Forgot your password?
              </button>
            )}

            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.7 }}>
              By continuing you agree to our{" "}
              <a href="/terms.html" style={{ color: C.forest }}>Terms of Service</a> and{" "}
              <a href="/privacy.html" style={{ color: C.forest }}>Privacy Policy</a>.
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, textAlign: "center" }}>
              <button
                onClick={() => {
                  setMode("emergency");
                  clearAll();
                }}
                style={{ background: "none", border: "none", cursor: "pointer", color: C.forest, fontSize: 13, fontWeight: 600, fontFamily: "'Lora', serif" }}
              >
                Have a pet's emergency QR code?
              </button>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Learn how to open the protected emergency record.</div>
            </div>
          </div>
        )}

        {mode === "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              onClick={() => {
                setMode("main");
                clearAll();
              }}
              aria-label="Back to sign in"
              style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, alignSelf: "flex-start", lineHeight: 1, padding: 0 }}
            >
              ←
            </button>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: C.forest, marginBottom: 5 }}>Reset Password</div>
              <div style={{ fontSize: 14, color: C.muted }}>Enter your email and we'll send a reset link.</div>
            </div>
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            {!success && (
              <button onClick={sendReset} disabled={loading} style={primaryBtn}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            )}
          </div>
        )}

        {mode === "emergency" && (
          <EmergencyAccessInfo
            onBack={() => {
              setMode("main");
              clearAll();
            }}
          />
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 12, color: C.lightSage, textAlign: "center" }}>
        Your pet's health history belongs with you.
      </div>
    </div>
  );
}
