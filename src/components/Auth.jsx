import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [screen, setScreen] = useState('landing')
  const [resetEmail, setResetEmail] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
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

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setLoading(true); clearMsg()
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '?reset=true'
    })
    if (error) msg('error', error.message)
    else msg('success', 'Password reset email sent! Check your inbox.')
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
    background: '#FAF6F0', border: '1.5px solid #E8DDD0', borderRadius: 10,
    padding: '12px 16px', color: '#2C2017', fontSize: 15, width: '100%',
    outline: 'none', fontFamily: 'Nunito, sans-serif', marginBottom: 12, display: 'block'
  }

  const PrimaryBtn = ({ children, onClick, type = 'button', disabled }) => (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      width: '100%', background: '#2D7D6F', color: '#fff', border: 'none',
      borderRadius: 12, padding: '14px 20px', fontSize: 16, fontWeight: 700,
      cursor: 'pointer', marginBottom: 12, opacity: disabled ? 0.6 : 1,
      fontFamily: 'Nunito, sans-serif'
    }}>{children}</button>
  )

  const AmberBtn = ({ children, onClick }) => (
    <button type="button" onClick={onClick} style={{
      width: '100%', background: '#E8A838', color: '#2C2017', border: 'none',
      borderRadius: 12, padding: '14px 20px', fontSize: 16, fontWeight: 700,
      cursor: 'pointer', marginBottom: 12, fontFamily: 'Nunito, sans-serif'
    }}>{children}</button>
  )

  const SecondaryBtn = ({ children, onClick }) => (
    <button type="button" onClick={onClick} style={{
      width: '100%', background: '#fff', color: '#2C2017',
      border: '1.5px solid #E8DDD0', borderRadius: 12, padding: '14px 20px',
      fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
      fontFamily: 'Nunito, sans-serif'
    }}>{children}</button>
  )

  const GoogleBtn = ({ label }) => (
    <button type="button" onClick={signInGoogle} disabled={loading} style={{
      width: '100%', background: '#fff', color: '#2C2017',
      border: '1.5px solid #E8DDD0', borderRadius: 12, padding: '14px 20px',
      fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      opacity: loading ? 0.6 : 1, fontFamily: 'Nunito, sans-serif'
    }}>
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
    <button type="button" onClick={() => { setScreen(to); clearMsg(); }}
      style={{ background: 'none', border: 'none', color: '#8B7355', cursor: 'pointer', marginBottom: 16, fontSize: 22, padding: 0 }}>←</button>
  )

  const Divider = () => (
    <div style={{ textAlign: 'center', color: '#8B7355', fontSize: 13, margin: '4px 0 12px' }}>— or —</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#1E5C52', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap')`}</style>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🐾</div>
          <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 36, fontWeight: 900, color: '#fff' }}>
            <span style={{ color: '#fff' }}>Your</span>
            <span style={{ color: '#F5C45E' }}>Pet</span>
            <span style={{ color: '#fff' }}>Pass</span>
          </div>
          <div style={{ color: '#F5C45E', fontSize: 15, marginTop: 6, fontFamily: "'Lora', serif", fontStyle: 'italic' }}>
            Your pet's health passport
          </div>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            background: message.type === 'error' ? '#fee2e2' : '#d1fae5',
            border: `1px solid ${message.type === 'error' ? '#C4714A' : '#2D7D6F'}`,
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            fontSize: 14, color: message.type === 'error' ? '#C4714A' : '#2D7D6F',
            fontFamily: 'Nunito, sans-serif'
          }}>
            {message.text}
          </div>
        )}

        <div style={{ background: '#FAF6F0', border: '1px solid #E8DDD0', borderRadius: 20, padding: 28, boxShadow: '0 8px 40px rgba(44,32,23,0.2)' }}>

          {/* LANDING */}
          {screen === 'landing' && <>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 26, marginBottom: 6, color: '#2C2017', fontStyle: 'italic' }}>Welcome</h2>
            <p style={{ color: '#8B7355', fontSize: 14, marginBottom: 24, fontFamily: 'Nunito, sans-serif' }}>
              Free to join. Keep your pet's health records and travel documents organized.
            </p>
            <AmberBtn onClick={() => { setIsSignUp(true); setScreen('signup'); clearMsg(); }}>✨ Create Free Account</AmberBtn>
            <SecondaryBtn onClick={() => { setIsSignUp(false); setScreen('signin'); clearMsg(); }}>Sign In</SecondaryBtn>
          </>}

          {/* SIGN UP */}
          {screen === 'signup' && <>
            <BackBtn to="landing"/>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 24, marginBottom: 6, color: '#2C2017', fontStyle: 'italic' }}>Create Account</h2>
            <p style={{ color: '#8B7355', fontSize: 14, marginBottom: 20, fontFamily: 'Nunito, sans-serif' }}>Choose how you'd like to sign up</p>
            <GoogleBtn label="Sign up with Google"/>
            <Divider/>
            <SecondaryBtn onClick={() => { setScreen('email'); clearMsg(); }}>✉️ Sign up with Email</SecondaryBtn>
            <SecondaryBtn onClick={() => { setScreen('phone'); clearMsg(); }}>📱 Sign up with Phone</SecondaryBtn>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button type="button" onClick={() => { setIsSignUp(false); setScreen('signin'); clearMsg(); }}
                style={{ background: 'none', border: 'none', color: '#8B7355', fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                Already have an account? Sign in
              </button>
            </div>
          </>}

          {/* SIGN IN */}
          {screen === 'signin' && <>
            <BackBtn to="landing"/>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 24, marginBottom: 6, color: '#2C2017', fontStyle: 'italic' }}>Welcome Back</h2>
            <p style={{ color: '#8B7355', fontSize: 14, marginBottom: 20, fontFamily: 'Nunito, sans-serif' }}>Sign in to your account</p>
            <GoogleBtn label="Sign in with Google"/>
            <Divider/>
            <SecondaryBtn onClick={() => { setScreen('email'); clearMsg(); }}>✉️ Sign in with Email</SecondaryBtn>
            <SecondaryBtn onClick={() => { setScreen('phone'); clearMsg(); }}>📱 Sign in with Phone</SecondaryBtn>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button type="button" onClick={() => { setIsSignUp(true); setScreen('signup'); clearMsg(); }}
                style={{ background: 'none', border: 'none', color: '#8B7355', fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                Don't have an account? Sign up free
              </button>
            </div>
          </>}

          {/* EMAIL */}
          {screen === 'email' && (
            <form onSubmit={handleEmail}>
              <BackBtn to={isSignUp ? 'signup' : 'signin'}/>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, marginBottom: 20, color: '#2C2017', fontStyle: 'italic' }}>
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required/>
              <input style={inp} type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}/>
              <PrimaryBtn type="submit" disabled={loading}>{loading ? '...' : (isSignUp ? 'Create Account' : 'Sign In')}</PrimaryBtn>
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); clearMsg(); }}
                style={{ width: '100%', background: 'none', border: 'none', color: '#8B7355', fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up free"}
              </button>
              {!isSignUp && (
                <button type="button" onClick={() => { setResetEmail(email); setScreen('forgot'); clearMsg(); }}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#2D7D6F', fontSize: 13, cursor: 'pointer', marginTop: 4, fontFamily: 'Nunito, sans-serif' }}>
                  Forgot your password?
                </button>
              )}
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {screen === 'forgot' && (
            <form onSubmit={handleForgotPassword}>
              <BackBtn to="email"/>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, marginBottom: 8, color: '#2C2017', fontStyle: 'italic' }}>Reset Password</h2>
              <p style={{ color: '#8B7355', fontSize: 14, marginBottom: 16, fontFamily: 'Nunito, sans-serif' }}>Enter your email and we'll send you a reset link.</p>
              <input style={inp} type="email" placeholder="Email address" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required/>
              <PrimaryBtn type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</PrimaryBtn>
              <button type="button" onClick={() => { setScreen('email'); clearMsg(); }}
                style={{ width: '100%', background: 'none', border: 'none', color: '#8B7355', fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                Back to sign in
              </button>
            </form>
          )}

          {/* PHONE */}
          {screen === 'phone' && (
            <form onSubmit={sendOTP}>
              <BackBtn to={isSignUp ? 'signup' : 'signin'}/>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, marginBottom: 8, color: '#2C2017', fontStyle: 'italic' }}>
                {isSignUp ? 'Sign Up with Phone' : 'Sign In with Phone'}
              </h2>
              <p style={{ color: '#8B7355', fontSize: 14, marginBottom: 16, fontFamily: 'Nunito, sans-serif' }}>We'll send a 6-digit code by SMS.</p>
              <input style={inp} type="tel" placeholder="Phone number (e.g. 5551234567)" value={phone} onChange={e => setPhone(e.target.value)} required/>
              <PrimaryBtn type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send Code'}</PrimaryBtn>
            </form>
          )}

          {/* PHONE VERIFY */}
          {screen === 'phone_verify' && (
            <form onSubmit={verifyOTP}>
              <BackBtn to="phone"/>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: 22, marginBottom: 8, color: '#2C2017', fontStyle: 'italic' }}>Enter Code</h2>
              <p style={{ color: '#8B7355', fontSize: 14, marginBottom: 16, fontFamily: 'Nunito, sans-serif' }}>6-digit code sent to {phone}</p>
              <input style={{ ...inp, fontSize: 28, letterSpacing: '0.4em', textAlign: 'center' }}
                type="text" placeholder="000000" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} required/>
              <PrimaryBtn type="submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify & Sign In'}</PrimaryBtn>
              <button type="button" onClick={sendOTP}
                style={{ width: '100%', background: 'none', border: 'none', color: '#8B7355', fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}>
                Resend code
              </button>
            </form>
          )}

        </div>

        <p style={{ textAlign: 'center', color: '#F5C45E', fontSize: 12, marginTop: 20, lineHeight: 1.6, fontFamily: 'Nunito, sans-serif' }}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
