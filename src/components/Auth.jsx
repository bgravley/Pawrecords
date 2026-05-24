import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  // screens: landing | signup | signin | email | phone | phone_verify
  const [screen, setScreen] = useState('landing')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const msg = (type, text) => setMessage({ type, text })
  const clearMsg = () => setMessage(null)

  const goSignUp = () => { setIsSignUp(true); setScreen('signup'); clearMsg(); }
  const goSignIn = () => { setIsSignUp(false); setScreen('signin'); clearMsg(); }
  const goBack = () => { setScreen(isSignUp ? 'signup' : 'signin'); clearMsg(); }
  const goLanding = () => { setScreen('landing'); clearMsg(); }

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
    else if (isSignUp) msg('success', 'Account created! Check your email to confirm, then sign in.')
    setLoading(false)
  }

  const sendOTP = async (e) => {
    e.preventDefault(); setLoading(true); clearMsg()
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g,'')}`
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) msg('error', error.message)
    else { msg('success', `Code sent to ${formatted}`); setScreen('phone_verify') }
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
    fontFamily:'Outfit, sans-serif', marginBottom:12, display:'block'
  }

  const PrimaryBtn = ({ children, onClick, type='button', disabled }) => (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ width:'100%', background:'#2dd4bf', color:'#07090f', border:'none',
        borderRadius:12, padding:'14px 20px', fontSize:16, fontWeight:700,
        cursor:'pointer', marginBottom:12, opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  )

  const SecondaryBtn = ({ children, onClick }) => (
    <button type="button" onClick={onClick}
      style={{ width:'100%', background:'#141b27', color:'#eef2ff',
        border:'1px solid #1c2438', borderRadius:12, padding:'14px 20px',
        fontSize:16, fontWeight:600, cursor:'pointer', marginBottom:12 }}>
      {children}
    </button>
  )

  const GoogleBtn = ({ label }) => (
    <button type="button" onClick={signInGoogle} disabled={loading}
      style={{ width:'100%', background:'#fff', color:'#1a1a1a', border:'none',
        borderRadius:12, padding:'14px 20px', fontSize:16, fontWeight:600,
        cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center',
        justifyContent:'center', gap:10, opacity: loading ? 0.6 : 1 }}>
      <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.9 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
      </svg>
      {label}
    </button>
  )

  const BackBtn = ({ to }) => (
    <button type="button" onClick={() => setScreen(to)}
      style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer',
        marginBottom:16, fontSize:22, padding:0 }}>←</button>
  )

  const Divider = () => (
    <div style={{ textAlign:'center', color:'#7c8fac', fontSize:13, margin:'4px 0 12px' }}>— or —</div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#07090f', display:'flex',
      alignItems:'center', justifyContent:'center', padding:20,
      fontFamily:"'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;600;700&display=swap')`}</style>
      <div style={{ width:'100%', maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>🐾</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, color:'#eef2ff' }}>PawRecord</div>
          <div style={{ color:'#7c8fac', fontSize:15, marginTop:6 }}>Your pet's health, always with you</div>
        </div>

        {/* Message */}
        {message && (
          <div style={{ background: message.type==='error' ? '#f8717120' : '#2dd4bf20',
            border:`1px solid ${message.type==='error' ? '#f87171' : '#2dd4bf'}`,
            borderRadius:12, padding:'12px 16px', marginBottom:16,
            fontSize:14, color: message.type==='error' ? '#f87171' : '#2dd4bf' }}>
            {message.text}
          </div>
        )}

        <div style={{ background:'#0e1219', border:'1px solid #1c2438', borderRadius:20, padding:28 }}>

          {/* LANDING — first screen */}
          {screen === 'landing' && <>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, marginBottom:6, color:'#eef2ff' }}>Get Started</h2>
            <p style={{ color:'#7c8fac', fontSize:14, marginBottom:24 }}>Free to join. Keep your pet's health records organized forever.</p>
            <PrimaryBtn onClick={goSignUp}>✨ Create Free Account</PrimaryBtn>
            <SecondaryBtn onClick={goSignIn}>Sign In</SecondaryBtn>
          </>}

          {/* SIGN UP — choose method */}
          {screen === 'signup' && <>
            <BackBtn to="landing"/>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, marginBottom:6, color:'#eef2ff' }}>Create Account</h2>
            <p style={{ color:'#7c8fac', fontSize:14, marginBottom:24 }}>Choose how you'd like to sign up</p>
            <GoogleBtn label="Sign up with Google"/>
            <Divider/>
            <SecondaryBtn onClick={() => { setScreen('email'); clearMsg(); }}>✉️ Sign up with Email</SecondaryBtn>
            <SecondaryBtn onClick={() => { setScreen('phone'); clearMsg(); }}>📱 Sign up with Phone</SecondaryBtn>
            <div style={{ textAlign:'center', marginTop:8 }}>
              <button type="button" onClick={goSignIn}
                style={{ background:'none', border:'none', color:'#7c8fac', fontSize:14, cursor:'pointer' }}>
                Already have an account? Sign in
              </button>
            </div>
          </>}

          {/* SIGN IN — choose method */}
          {screen === 'signin' && <>
            <BackBtn to="landing"/>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, marginBottom:6, color:'#eef2ff' }}>Sign In</h2>
            <p style={{ color:'#7c8fac', fontSize:14, marginBottom:24 }}>Welcome back</p>
            <GoogleBtn label="Sign in with Google"/>
            <Divider/>
            <SecondaryBtn onClick={() => { setScreen('email'); clearMsg(); }}>✉️ Sign in with Email</SecondaryBtn>
            <SecondaryBtn onClick={() => { setScreen('phone'); clearMsg(); }}>📱 Sign in with Phone</SecondaryBtn>
            <div style={{ textAlign:'center', marginTop:8 }}>
              <button type="button" onClick={goSignUp}
                style={{ background:'none', border:'none', color:'#7c8fac', fontSize:14, cursor:'pointer' }}>
                Don't have an account? Sign up free
              </button>
            </div>
          </>}

          {/* EMAIL */}
          {screen === 'email' && (
            <form onSubmit={handleEmail}>
              <BackBtn to={isSignUp ? 'signup' : 'signin'}/>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:20, color:'#eef2ff' }}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
              <input style={inp} type="email" placeholder="Email address"
                value={email} onChange={e=>setEmail(e.target.value)} required />
              <input style={inp} type="password" placeholder="Password (min 6 characters)"
                value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
              <PrimaryBtn type="submit" disabled={loading}>
                {loading ? '...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </PrimaryBtn>
            </form>
          )}

          {/* PHONE */}
          {screen === 'phone' && (
            <form onSubmit={sendOTP}>
              <BackBtn to={isSignUp ? 'signup' : 'signin'}/>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:8, color:'#eef2ff' }}>
                {isSignUp ? 'Sign Up with Phone' : 'Sign In with Phone'}
              </h2>
              <p style={{ color:'#7c8fac', fontSize:14, marginBottom:16 }}>We'll send a 6-digit code by SMS.</p>
              <input style={inp} type="tel" placeholder="Phone number (e.g. 5551234567)"
                value={phone} onChange={e=>setPhone(e.target.value)} required />
              <PrimaryBtn type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Code'}
              </PrimaryBtn>
            </form>
          )}

          {/* PHONE VERIFY */}
          {screen === 'phone_verify' && (
            <form onSubmit={verifyOTP}>
              <BackBtn to="phone"/>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:8, color:'#eef2ff' }}>Enter Code</h2>
              <p style={{ color:'#7c8fac', fontSize:14, marginBottom:16 }}>6-digit code sent to {phone}</p>
              <input style={{ ...inp, fontSize:28, letterSpacing:'0.4em', textAlign:'center' }}
                type="text" placeholder="000000" value={otp}
                onChange={e=>setOtp(e.target.value)} maxLength={6} required />
              <PrimaryBtn type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </PrimaryBtn>
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
