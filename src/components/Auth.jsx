// src/components/Auth.jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bg:"#07090f", surface:"#0e1219", card:"#141b27", border:"#1c2438",
  accent:"#2dd4bf", text:"#eef2ff", sub:"#7c8fac", danger:"#f87171",
}

export default function Auth() {
  const [mode, setMode] = useState('choose')   // choose | email | phone | phone_verify
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)  // { type: 'success'|'error', text }

  const msg = (type, text) => setMessage({ type, text })
  const clearMsg = () => setMessage(null)

  // ── Google ──────────────────────────────────────────────
  const signInGoogle = async () => {
    setLoading(true); clearMsg()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) msg('error', error.message)
    setLoading(false)
  }

  // ── Email ────────────────────────────────────────────────
  const handleEmail = async (e) => {
    e.preventDefault(); setLoading(true); clearMsg()
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) msg('error', error.message)
    else if (isSignUp) msg('success', 'Check your email to confirm your account.')
    setLoading(false)
  }

  // ── Phone ────────────────────────────────────────────────
  const sendOTP = async (e) => {
    e.preventDefault(); setLoading(true); clearMsg()
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g,'')}`
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) msg('error', error.message)
    else { msg('success', `Code sent to ${formatted}`); setMode('phone_verify') }
    setLoading(false)
  }

  const verifyOTP = async (e) => {
    e.preventDefault(); setLoading(true); clearMsg()
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g,'')}`
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
    if (error) msg('error', error.message)
    setLoading(false)
  }

  const inp = { background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10,
    padding: '12px 16px', color: C.text, fontSize: 15, width: '100%', outline: 'none',
    fontFamily: 'Outfit, sans-serif' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🐾</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, color: C.text }}>PawRecord</div>
          <div style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>Your pet's health, always with you</div>
        </div>

        {/* Message */}
        {message && (
          <div style={{ background: message.type==='error' ? '#f8717120' : '#2dd4bf20',
            border: `1px solid ${message.type==='error' ? '#f87171' : C.accent}44`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14,
            color: message.type==='error' ? C.danger : C.accent }}>
            {message.text}
          </div>
        )}

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28 }}>

          {/* CHOOSE */}
          {mode === 'choose' && (<>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, marginBottom: 6 }}>Sign In</h2>
            <p style={{ color: C.sub, fontSize: 14, marginBottom: 24 }}>Choose how you'd like to continue</p>

            <button onClick={signInGoogle} disabled={loading} style={{ width: '100%', background: '#fff',
              color: '#1a1a1a', border: 'none', borderRadius: 12, padding: '13px 20px',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Continue with Google
            </button>

            <button onClick={() => { setMode('email'); clearMsg(); }} style={{ width: '100%', background: C.card,
              color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 20px',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              ✉️ Continue with Email
            </button>

            <button onClick={() => { setMode('phone'); clearMsg(); }} style={{ width: '100%', background: C.card,
              color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 20px',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              📱 Continue with Phone
            </button>
          </>)}

          {/* EMAIL */}
          {mode === 'email' && (
            <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <button type="button" onClick={() => setMode('choose')} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 20 }}>←</button>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
              </div>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required/>
              <input style={inp} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
              <button type="submit" disabled={loading} style={{ background: C.accent, color: '#07090f', border: 'none',
                borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {loading ? '...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none',
                color: C.sub, fontSize: 14, cursor: 'pointer' }}>
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </form>
          )}

          {/* PHONE */}
          {mode === 'phone' && (
            <form onSubmit={sendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <button type="button" onClick={() => setMode('choose')} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 20 }}>←</button>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>Phone Sign In</h2>
              </div>
              <p style={{ color: C.sub, fontSize: 14 }}>We'll send a verification code by SMS.</p>
              <input style={inp} type="tel" placeholder="Phone number (e.g. 5551234567)" value={phone} onChange={e=>setPhone(e.target.value)} required/>
              <button type="submit" disabled={loading} style={{ background: C.accent, color: '#07090f', border: 'none',
                borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          )}

          {/* PHONE VERIFY */}
          {mode === 'phone_verify' && (
            <form onSubmit={verifyOTP} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <button type="button" onClick={() => setMode('phone')} style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 20 }}>←</button>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>Enter Code</h2>
              </div>
              <p style={{ color: C.sub, fontSize: 14 }}>Enter the 6-digit code sent to {phone}.</p>
              <input style={{ ...inp, fontSize: 24, letterSpacing: '0.3em', textAlign: 'center' }}
                type="text" placeholder="000000" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={6} required/>
              <button type="submit" disabled={loading} style={{ background: C.accent, color: '#07090f', border: 'none',
                borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button type="button" onClick={sendOTP} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 14, cursor: 'pointer' }}>
                Resend code
              </button>
            </form>
          )}

        </div>

        <p style={{ textAlign: 'center', color: C.sub, fontSize: 12, marginTop: 20, lineHeight: 1.6 }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
