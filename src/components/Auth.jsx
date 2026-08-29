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
  border: "#DCE8E0",
  danger: "#A8583E",
};

const EmergencyAccessHelp = ({ onBack }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <button
      onClick={onBack}
      aria-label="Back to sign in"
      style={{
        alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer",
        color: C.sage, fontSize: 24, lineHeight: 1, padding: 0,
      }}
    >
      ←
    </button>

    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>🐾</div>
      <h2 style={{
        fontFamily: "'Playfair Display', serif", fontSize: 25, color: C.forest,
        lineHeight: 1.2, margin: "0 0 8px", fontWeight: 700,
      }}>
        Emergency Pet Record
      </h2>
      <p style={{ fontSize: 14, color: C.sage, lineHeight: 1.7, margin: 0 }}>
        YourPetPass emergency records are private-by-design. To open a pet's emergency record,
        scan the QR code on that pet's YourPetPass tag or use the secure link shared by the pet parent.
      </p>
    </div>

    <div style={{
      background: C.mint, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 18, color: C.text, fontSize: 13.5, lineHeight: 1.7,
    }}>
      <strong style={{ color: C.forest }}>Found a lost pet?</strong><br />
      Look for the YourPetPass QR code on the pet's tag or travel card. Scanning it opens only the
      emergency information the pet parent has chosen to make available. There is no public directory
      of pets or medical records.
    </div>

    <button
      onClick={onBack}
      style={{
        width: "100%", padding: 13, borderRadius: 12, border: `1.5px solid ${C.forest}`,
        background: "transparent", color: C.forest, cursor: "pointer", fontSize: 14,
        fontWeight: 600, fontFamily: "'Lora', serif",
      }}
    >
      Back to Sign In
    </button>
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

  const setErr = (value) => {
    if (!value) return setError(null);
    if (typeof value === "string") return setError(value);
    setError(value.message || value.error_description || value.msg || "Something went wrong — please try again.");
  };

  const clearAll = () => {
    setError(null);
    setSuccess(null);
  };

  const inp = {
    width: "100%",
    padding: "13px 15px",
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
  };

  const signInWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    setLoading(true);
    clearAll();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setErr(signInError);
    setLoading(false);
  };

  const signUpWithEmail = async () => {
    if (!email || !password) return setErr("Please enter your email and password.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");

    setLoading(true);
    clearAll();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setErr(signUpError);
    } else if (data?.user && data.user.identities?.length === 0) {
      setErr("An account with this email already exists. Try signing in instead.");
    } else {
      setSuccess("Account created. Check your email to confirm your address, then sign in.");
    }
    setLoading(false);
  };

  const sendReset = async () => {
    if (!email) return setErr("Enter your email address.");

    setLoading(true);
    clearAll();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });

    if (resetError) setErr(resetError);
    else setSuccess("Reset link sent — check your inbox.");
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (mode === "forgot") sendReset();
    else if (authMode === "signin") signInWithEmail();
    else signUpWithEmail();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: C.forest,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "'Lora', serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Lora:wght@400;600&display=swap'); * { box-sizing: border-box; }`}</style>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img
          src="/logo_horizontal_cream_transparent.png"
          alt="YourPetPass"
          style={{ height: 48, maxWidth: "80vw", objectFit: "contain", display: "block", margin: "0 auto 8px" }}
        />
        <div style={{ color: C.lightSage, fontSize: 13.5, letterSpacing: ".01em" }}>
          Health Records &amp; Travel, Simplified.
        </div>
      </div>

      <div style={{
        background: C.warm,
        borderRadius: 22,
        padding: 28,
        width: "100%",
        maxWidth: 410,
        boxShadow: "0 14px 44px rgba(20, 42, 29, 0.28)",
        border: "1px solid rgba(255,255,255,.45)",
      }}>
        {error && (
          <div style={{
            background: "#FFF5F2", border: "1px solid #E8C6BB", borderRadius: 12,
            padding: "11px 14px", marginBottom: 16, fontSize: 13.5, color: C.danger,
            display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
          }}>
            <span>{error}</span>
            <button onClick={clearAll} aria-label="Dismiss error" style={{
              background: "none", border: "none", color: C.danger, cursor: "pointer",
              fontSize: 18, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        )}

        {success && (
          <div style={{
            background: C.mint, border: `1px solid ${C.lightSage}`, borderRadius: 12,
            padding: "11px 14px", marginBottom: 16, fontSize: 13.5, color: C.forest,
            lineHeight: 1.6,
          }}>
            {success}
          </div>
        )}

        {mode === "main" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ textAlign: "center", marginBottom: 2 }}>
              <h1 style={{
                fontFamily: "'Playfair Display', serif", fontSize: 27, lineHeight: 1.2,
                color: C.forest, margin: "0 0 6px", fontWeight: 700,
              }}>
                Your pet's records belong with you.
              </h1>
              <div style={{ fontSize: 13.5, color: C.sage, lineHeight: 1.6 }}>
                Sign in to your health records and travel plans, or create your free account.
              </div>
            </div>

            <div style={{ display: "flex", background: C.mint, borderRadius: 12, padding: 3 }}>
              {["signin", "signup"].map((m) => (
                <button
                  key={m}
                  onClick={() => { setAuthMode(m); clearAll(); }}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                    fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "'Lora', serif",
                    transition: "all .15s", background: authMode === m ? C.forest : "transparent",
                    color: authMode === m ? "#fff" : C.sage,
                    boxShadow: authMode === m ? "0 2px 8px rgba(44,74,56,.16)" : "none",
                  }}
                >
                  {m === "signin" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>

            <button
              onClick={signInWithGoogle}
              disabled={loading}
              style={{
                width: "100%", padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 600,
                background: "#fff", color: C.text, border: `1.5px solid ${C.border}`,
                cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Lora', serif",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/>
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.1-17.7 10.7z"/>
                <path fill="#FBBC05" d="M24 45c5.9 0 10.9-2 14.5-5.4l-6.7-5.5C29.9 35.9 27.1 37 24 37c-6.1 0-11.2-4.1-13-9.6l-7 5.4C7.7 40.6 15.3 45 24 45z"/>
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.8-4.9 6.3l6.7 5.5C42 37.1 45 31 45 24c0-1.4-.2-2.7-.5-4z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 11.5, color: C.sage }}>or with email</span>
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
              aria-label="Email address"
            />

            <div style={{ position: "relative" }}>
              <input
                style={{ ...inp, paddingRight: 50 }}
                type={showPassword ? "text" : "password"}
                placeholder={authMode === "signup" ? "Password (min 6 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                aria-label="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                style={{
                  position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.sage,
                  fontSize: 12.5, fontFamily: "'Lora', serif", padding: 2,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {!success && (
              <button
                onClick={authMode === "signin" ? signInWithEmail : signUpWithEmail}
                disabled={loading}
                style={primaryBtn}
              >
                {loading
                  ? (authMode === "signin" ? "Signing in..." : "Creating account...")
                  : (authMode === "signin" ? "Sign In" : "Create Account")}
              </button>
            )}

            {authMode === "signin" && (
              <button
                onClick={() => { setMode("forgot"); clearAll(); }}
                style={{
                  background: "none", border: "none", cursor: "pointer", color: C.forest,
                  fontSize: 12.5, fontFamily: "'Lora', serif", padding: 0, textAlign: "center",
                }}
              >
                Forgot your password?
              </button>
            )}

            <div style={{ fontSize: 10.5, color: C.sage, textAlign: "center", lineHeight: 1.7 }}>
              By continuing you agree to our{" "}
              <a href="/terms.html" style={{ color: C.forest }}>Terms of Service</a> and{" "}
              <a href="/privacy.html" style={{ color: C.forest }}>Privacy Policy</a>.
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, textAlign: "center" }}>
              <button
                onClick={() => { setMode("emergency"); clearAll(); }}
                style={{
                  background: "none", border: "none", cursor: "pointer", color: C.forest,
                  fontSize: 12.5, fontWeight: 600, fontFamily: "'Lora', serif",
                }}
              >
                Have an emergency QR code?
              </button>
              <div style={{ fontSize: 10.5, color: C.sage, marginTop: 3 }}>
                Learn how to open a pet's secure emergency record.
              </div>
            </div>
          </div>
        )}

        {mode === "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button
              onClick={() => { setMode("main"); clearAll(); }}
              aria-label="Back to sign in"
              style={{
                alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer",
                color: C.sage, fontSize: 24, lineHeight: 1, padding: 0,
              }}
            >
              ←
            </button>

            <div style={{ textAlign: "center", marginBottom: 2 }}>
              <h2 style={{
                fontFamily: "'Playfair Display', serif", fontSize: 25, color: C.forest,
                lineHeight: 1.2, margin: "0 0 7px", fontWeight: 700,
              }}>
                Reset your password
              </h2>
              <p style={{ fontSize: 13.5, color: C.sage, lineHeight: 1.6, margin: 0 }}>
                Enter your email and we'll send you a secure reset link.
              </p>
            </div>

            <input
              style={inp}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
              aria-label="Email address"
            />

            {!success && (
              <button onClick={sendReset} disabled={loading} style={primaryBtn}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            )}
          </div>
        )}

        {mode === "emergency" && (
          <EmergencyAccessHelp onBack={() => { setMode("main"); clearAll(); }} />
        )}
      </div>

      <div style={{ marginTop: 18, fontSize: 11.5, color: "rgba(234,244,238,.62)", textAlign: "center" }}>
        YourPetPass · Your pet's health history belongs with you.
      </div>
    </div>
  );
}
