// src/components/Auth.jsx
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const EmergencyLookup = ({ onBack }) => {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Only fetch pets that have a QR code generated (emergency_token is set)
      const { data } = await supabase
        .from("dogs")
        .select("id, name, breed, color, photo_url, emergency_token, pet_type")
        .not("emergency_token", "is", null)
        .order("name");
      setPets(data || []);
      setLoading(false);
    };
    load();
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
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#FAF6F0", border: "1px solid #E8DDD0", borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#2D7D6F"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#E8DDD0"}>
                  {pet.photo_url
                    ? <img src={pet.photo_url} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "2px solid #2D7D6F", flexShrink: 0 }} />
                    : <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#2D7D6F25", border: "2px solid #2D7D6F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, fontFamily: "'Lora', serif", fontWeight: 700, color: "#2D7D6F" }}>
                        {pet.name[0]}
                      </div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#2C2017", marginBottom: 2 }}>{pet.name}</div>
                    <div style={{ fontSize: 13, color: "#5A4535" }}>{pet.breed || "Dog"}{pet.color ? ` · ${pet.color}` : ""}</div>
                    {pet.pet_type && pet.pet_type !== "pet" && (
                      <div style={{ fontSize: 11, color: "#2D7D6F", fontWeight: 700, marginTop: 2 }}>
                        {pet.pet_type === "service_animal" ? "🦺 Service Animal" : "💙 ESA"}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 20, color: "#8B7355" }}>›</div>
                </button>
              ))}
            </div>}
    </div>
  );
};

const C = {
  bg: "#1E5C52",
  card: "#FFFFFF",
  accent: "#2D7D6F",
  gold: "#F5C45E",
  text: "#2C2017",
  sub: "#5A4535",
  muted: "#8B7355",
  border: "#E8DDD0",
  danger: "#C4714A",
};

export default function Auth() {
  const [mode, setMode] = useState("landing"); // landing | email-signin | email-signup | phone | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const clearErr = () => setError(null);

  // Force Google account picker every time by adding prompt=select_account
  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: {
          prompt: "select_account", // forces account picker every time
          access_type: "offline",
        },
        redirectTo: window.location.origin,
      },
    });
    if (error) { setError(error.message); setLoading(false); }
  };

  const signInWithEmail = async () => {
    if (!email || !password) return setError("Please enter email and password.");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  const signUpWithEmail = async () => {
    if (!email || !password) return setError("Please enter email and password.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
    else setSuccess("Account created! Check your email to confirm, then sign in.");
    setLoading(false);
  };

  const sendOtp = async () => {
    if (!phone) return setError("Please enter your phone number.");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) setError(error.message);
    else setOtpSent(true);
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp) return setError("Please enter the code.");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    if (error) setError(error.message);
    setLoading(false);
  };

  const resetPassword = async () => {
    if (!email) return setError("Enter your email address.");
    setLoading(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setSuccess("Password reset email sent. Check your inbox.");
    setLoading(false);
  };

  const inp = {
    width: "100%", padding: "13px 16px", borderRadius: 12, fontSize: 15,
    border: `1.5px solid ${C.border}`, background: "#FAF6F0", color: C.text,
    outline: "none", fontFamily: "'Nunito', sans-serif", boxSizing: "border-box",
  };

  const btn = (bg, color = "#fff") => ({
    width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
    background: bg, color, border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif",
    opacity: loading ? 0.7 : 1, transition: "opacity .15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,600;1,400;1,600&display=swap');`}</style>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 38, color: "#FFFFFF", marginBottom: 4 }}>
          🐾 <span style={{ fontWeight: 700 }}>Your</span><span style={{ color: C.gold, fontWeight: 700 }}>Pet</span><span style={{ fontWeight: 700 }}>Pass</span>
        </div>
        <div style={{ color: C.gold, fontSize: 15, fontStyle: "italic", fontFamily: "'Lora', serif" }}>
          Your pet's health passport
        </div>
      </div>

      {/* Card */}
      <div style={{ background: C.card, borderRadius: 24, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>

        {/* Error / Success */}
        {error && (
          <div style={{ background: "#C4714A14", border: "1px solid #C4714A44", borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: C.danger, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {error}
            <button onClick={clearErr} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )}
        {success && (
          <div style={{ background: "#2D7D6F14", border: "1px solid #2D7D6F44", borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: C.accent }}>
            {success}
          </div>
        )}

        {/* LANDING */}
        {mode === "landing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 24, color: C.text, marginBottom: 4 }}>Welcome</div>
              <div style={{ fontSize: 14, color: C.muted }}>Sign in or create your account</div>
            </div>

            {/* Google */}
            <button onClick={signInWithGoogle} disabled={loading} style={{ ...btn("#FFFFFF", C.text), border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/>
                <path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.1-17.7 10.7z"/>
                <path fill="#FBBC05" d="M24 45c5.9 0 10.9-2 14.5-5.4l-6.7-5.5C29.9 35.9 27.1 37 24 37c-6.1 0-11.2-4.1-13-9.6l-7 5.4C7.7 40.6 15.3 45 24 45z"/>
                <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.8-4.9 6.3l6.7 5.5C42 37.1 45 31 45 24c0-1.4-.2-2.7-.5-4z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 13, color: C.muted }}>or</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            <button onClick={() => { setMode("email-signin"); clearErr(); }} style={btn(C.accent)}>
              Sign in with Email
            </button>
            <button onClick={() => { setMode("email-signup"); clearErr(); }} style={{ ...btn("transparent", C.accent), border: `1.5px solid ${C.accent}` }}>
              Create Account with Email
            </button>
            <button onClick={() => { setMode("phone"); clearErr(); }} style={{ ...btn("transparent", C.muted), border: `1.5px solid ${C.border}` }}>
              Sign in with Phone / SMS
            </button>

            <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              By continuing you agree to our{" "}
              <a href="/terms" style={{ color: C.accent }}>Terms of Service</a> and{" "}
              <a href="/privacy" style={{ color: C.accent }}>Privacy Policy</a>.
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
              <button onClick={() => { setMode("emergency"); clearErr(); }}
                style={{ width: "100%", padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "#C4714A14", color: "#C4714A", border: "1px solid #C4714A44", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}>
                🚨 Emergency Pet Lookup
              </button>
              <div style={{ textAlign: "center", fontSize: 11, color: C.muted, marginTop: 6 }}>
                Found a lost pet? Access their health record here.
              </div>
            </div>
          </div>
        )}

        {/* EMAIL SIGN IN */}
        {mode === "email-signin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => { setMode("landing"); clearErr(); setSuccess(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, alignSelf: "flex-start", lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 24, color: C.text, marginBottom: 4 }}>Sign In</div>
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
            <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/>
            <button onClick={signInWithEmail} disabled={loading} style={btn(C.accent)}>{loading ? "Signing in..." : "Sign In"}</button>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <button onClick={() => { setMode("forgot"); clearErr(); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent }}>Forgot password?</button>
              <button onClick={() => { setMode("email-signup"); clearErr(); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent }}>Create account</button>
            </div>
          </div>
        )}

        {/* EMAIL SIGN UP */}
        {mode === "email-signup" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => { setMode("landing"); clearErr(); setSuccess(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, alignSelf: "flex-start", lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 24, color: C.text, marginBottom: 4 }}>Create Account</div>
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
            <input style={inp} type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/>
            {success
              ? <div style={{ textAlign: "center", fontSize: 14, color: C.accent, padding: "8px 0" }}>{success}</div>
              : <button onClick={signUpWithEmail} disabled={loading} style={btn(C.accent)}>{loading ? "Creating..." : "Create Account"}</button>}
            <div style={{ textAlign: "center", fontSize: 13 }}>
              <button onClick={() => { setMode("email-signin"); clearErr(); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent }}>Already have an account? Sign in</button>
            </div>
          </div>
        )}

        {/* PHONE */}
        {mode === "phone" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => { setMode("landing"); clearErr(); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, alignSelf: "flex-start", lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 24, color: C.text, marginBottom: 4 }}>Phone Sign In</div>
            {!otpSent ? (<>
              <input style={inp} type="tel" placeholder="+1 555-0100" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel"/>
              <button onClick={sendOtp} disabled={loading} style={btn(C.accent)}>{loading ? "Sending..." : "Send Code"}</button>
            </>) : (<>
              <div style={{ fontSize: 14, color: C.muted }}>Code sent to {phone}</div>
              <input style={inp} type="text" placeholder="6-digit code" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} inputMode="numeric"/>
              <button onClick={verifyOtp} disabled={loading} style={btn(C.accent)}>{loading ? "Verifying..." : "Verify Code"}</button>
              <button onClick={() => setOtpSent(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: 13 }}>Use different number</button>
            </>)}
          </div>
        )}

        {/* EMERGENCY LOOKUP */}
        {mode === "emergency" && <EmergencyLookup onBack={() => { setMode("landing"); clearErr(); }} />}

        {/* FORGOT PASSWORD */}
        {mode === "forgot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={() => { setMode("email-signin"); clearErr(); setSuccess(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22, alignSelf: "flex-start", lineHeight: 1 }}>←</button>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 24, color: C.text, marginBottom: 4 }}>Reset Password</div>
            <div style={{ fontSize: 14, color: C.muted }}>Enter your email and we'll send a reset link.</div>
            <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
            {success
              ? <div style={{ textAlign: "center", fontSize: 14, color: C.accent, padding: "8px 0" }}>{success}</div>
              : <button onClick={resetPassword} disabled={loading} style={btn(C.accent)}>{loading ? "Sending..." : "Send Reset Link"}</button>}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        YourPetPass · Secure pet health records for travelers
      </div>
    </div>
  );
}
