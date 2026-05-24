import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const msg = (type, text) => setMessage({ type, text })
  const clearMsg = () => setMessage(null)

  const signInGoogle = async () => {
    setLoading(true); clearMsg()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) msg('error', error.message)
    setLoading(false)
  }

  const handleEmail = async (e) => {
    e.preventDefault(); setLoading(true); clearMsg()
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) msg('error', error.message)
    else if (isSignUp) msg('success', 'Account created! Check your email to confirm then sign in.')
    setLoading(false)
  }

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

  const inp = {
    background:'#0e1219', border:'1.5px solid #1c2438', borderRadius:10,
    padding:'12px 16px', color:'#eef2ff', fontSize:15, width:'100%', outline:'none',
    fontFamily:'Outfit, sans-serif', marginBottom:12
  }

  const btn = (bg, color, extra) => ({
    width:'100%', background:bg, color:color, border:'none',
    borderRadius:12, padding:'14px 20px', fontSize:16, fontWeight:600,
    cursor:'pointer', marginBottom:12, ...extra
  })

  return (
    <div style={{ minHeight:'100vh', background:'#07090f', display:'flex',
      alignItems:'center', justifyContent:'center', padding:20,
      fontFamily:"'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;600&display=swap')`}</style>
      <div style={{ width:'100%', maxWidth:400 }}>

        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>🐾</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, color:'#eef2ff' }}>PawRecord</div>
          <div style={{ color:'#7c8fac', fontSize:15, marginTop:6 }}>Your pet's health, always with you</div>
        </div>

        {message && (
          <div style={{ background: message.type==='error' ? '#f8717120' : '#2dd4bf20',
            border:`1px solid ${message.type==='error' ? '#f87171' : '#2dd4bf'}`,
            borderRadius:12, padding:'12px 16px', marginBottom:16,
            fontSize:14, color: message.type==='error' ? '#f87171' : '#2dd4bf' }}>
            {message.text}
          </div>
        )}

        <div style={{ background:'#0e1219', border:'1px solid #1c2438', borderRadius:20, padding:28 }}>

          {mode === 'choose' && <>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, marginBottom:6, color:'#eef2ff' }}>Welcome</h2>
            <p style={{ color:'#7c8fac', fontSize:14, marginBottom:24 }}>Sign in or create a free account to get started</p>

            <button onClick={() => { setMode('email'); setIsSignUp(true); clearMsg(); }} style={btn('#2dd4bf','#07090f')}>
              ✨ Create Free Account
            </button>

            <div style={{ textAlign:'center', color:'#7c8fac', fontSize:13, marginBottom:12 }}>— or sign in with —</div>

            <button onClick={signInGoogle} disabled={loading} style={btn('#ffffff','#1a1a1a',{display:'flex',alignItems:'center',justifyContent:'center',gap:10})}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
              Continue with Google
            </button>

            <button onClick={() => { setMode('email'); setIsSignUp(false); clearMsg(); }} style={btn('#141b27','#eef2ff',{border:'1px solid #1c2438'})}>
              ✉️ Sign In with Email
            </button>

            <button onClick={() => { setMode('phone'); clearMsg(); }} style={btn('#141b27','#eef2ff',{border:'1px solid #1c2438',marginBottom:0})}>
              📱 Sign In with Phone
            </button>
          </>}

          {mode === 'email' && (
            <form onSubmit={handleEmail}>
              <button type="button" onClick={() => { setMode('choose'); clearMsg(); }}
                style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer', marginBottom:16, fontSize:22 }}>←</button>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:20, color:'#eef2ff' }}>
                {isSignUp ? 'Create Free Account' : 'Sign In'}
              </h2>
              <input style={inp} type="email" placeholder="Email address"
                value={email} onChange={e=>setEmail(e.target.value)} required />
              <input style={inp} type="password" placeholder="Password (min 6 characters)"
                value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
              <button type="submit" disabled={loading} style={btn('#2dd4bf','#07090f',{marginBottom:12})}>
                {loading ? '...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); clearMsg(); }}
                style={{ width:'100%', background:'none', border:'none', color:'#7c8fac', fontSize:14, cursor:'pointer', padding:'8px 0' }}>
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up free"}
              </button>
            </form>
          )}

          {mode === 'phone' && (
            <form onSubmit={sendOTP}>
              <button type="button" onClick={() => { setMode('choose'); clearMsg(); }}
                style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer', marginBottom:16, fontSize:22 }}>←</button>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:8, color:'#eef2ff' }}>Phone Sign In</h2>
              <p style={{ color:'#7c8fac', fontSize:14, marginBottom:16 }}>We'll send a 6-digit code by SMS.</p>
              <input style={inp} type="tel" placeholder="Phone number (e.g. 5551234567)"
                value={phone} onChange={e=>setPhone(e.target.value)} required />
              <button type="submit" disabled={loading} style={btn('#2dd4bf','#07090f')}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          )}

          {mode === 'phone_verify' && (
            <form onSubmit={verifyOTP}>
              <button type="button" onClick={() => { setMode('phone'); clearMsg(); }}
                style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer', marginBottom:16, fontSize:22 }}>←</button>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:8, color:'#eef2ff' }}>Enter Code</h2>
              <p style={{ color:'#7c8fac', fontSize:14, marginBottom:16 }}>6-digit code sent to {phone}.</p>
              <input style={{ ...inp, fontSize:28, letterSpacing:'0.4em', textAlign:'center' }}
                type="text" placeholder="000000" value={otp}
                onChange={e=>setOtp(e.target.value)} maxLength={6} required />
              <button type="submit" disabled={loading} style={btn('#2dd4bf','#07090f')}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button type="button" onClick={sendOTP}
                style={{ width:'100%', background:'none', border:'none', color:'#7c8fac', fontSize:14, cursor:'pointer' }}>
                Resend code
              </button>
            </form>
          )}

        </div>

        <p style={{ textAlign:'center', color:'#7c8fac', fontSize:12, marginTop:20, lineHeight:1.6 }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
