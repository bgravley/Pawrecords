import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('choose')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const msg = (type, text) => setMessage({ type, text })

  const signInGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) msg('error', error.message)
    setLoading(false)
  }

  const handleEmail = async (e) => {
    e.preventDefault(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) msg('error', error.message)
    setLoading(false)
  }

  const sendOTP = async (e) => {
    e.preventDefault(); setLoading(true)
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g,'')}`
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) msg('error', error.message)
    else { msg('success', `Code sent to ${formatted}`); setMode('phone_verify') }
    setLoading(false)
  }

  const verifyOTP = async (e) => {
    e.preventDefault(); setLoading(true)
    const formatted = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g,'')}`
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
    if (error) msg('error', error.message)
    setLoading(false)
  }

  const inp = { background:'#0e1219', border:'1.5px solid #1c2438', borderRadius:10,
    padding:'12px 16px', color:'#eef2ff', fontSize:15, width:'100%', outline:'none',
    fontFamily:'Outfit, sans-serif', marginBottom:12 }

  return (
    <div style={{ minHeight:'100vh', background:'#07090f', display:'flex',
      alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🐾</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, color:'#eef2ff' }}>PawRecord</div>
          <div style={{ color:'#7c8fac', fontSize:14, marginTop:4 }}>Your pet's health, always with you</div>
        </div>

        {message && (
          <div style={{ background: message.type==='error' ? '#f8717120' : '#2dd4bf20',
            border:`1px solid ${message.type==='error' ? '#f87171' : '#2dd4bf'}44`,
            borderRadius:12, padding:'12px 16px', marginBottom:16,
            fontSize:14, color: message.type==='error' ? '#f87171' : '#2dd4bf' }}>
            {message.text}
          </div>
        )}

        <div style={{ background:'#0e1219', border:'1px solid #1c2438', borderRadius:20, padding:28 }}>

          {mode==='choose' && <>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, marginBottom:6, color:'#eef2ff' }}>Sign In</h2>
            <p style={{ color:'#7c8fac', fontSize:14, marginBottom:24 }}>Choose how you'd like to continue</p>
            <button onClick={signInGoogle} disabled={loading}
              style={{ width:'100%', background:'#fff', color:'#1a1a1a', border:'none',
                borderRadius:12, padding:'13px 20px', fontSize:15, fontWeight:600,
                cursor:'pointer', display:'flex', alignItems:'center',
                justifyContent:'center', gap:10, marginBottom:12 }}>
              🌐 Continue with Google
            </button>
            <button onClick={()=>setMode('email')}
              style={{ width:'100%', background:'#141b27', color:'#eef2ff',
                border:'1px solid #1c2438', borderRadius:12, padding:'13px 20px',
                fontSize:15, fontWeight:600, cursor:'pointer', marginBottom:12 }}>
              ✉️ Continue with Email
            </button>
            <button onClick={()=>setMode('phone')}
              style={{ width:'100%', background:'#141b27', color:'#eef2ff',
                border:'1px solid #1c2438', borderRadius:12, padding:'13px 20px',
                fontSize:15, fontWeight:600, cursor:'pointer' }}>
              📱 Continue with Phone
            </button>
          </>}

          {mode==='email' && (
            <form onSubmit={handleEmail}>
              <button type="button" onClick={()=>setMode('choose')}
                style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer', marginBottom:16, fontSize:20 }}>←</button>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, marginBottom:20, color:'#eef2ff' }}>Sign In with Email</h2>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required />
              <input style={inp} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
              <button type="submit" disabled={loading}
                style={{ width:'100%', background:'#2dd4bf', color:'#07090f', border:'none',
                  borderRadius:12, padding:13, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                {loading ? '...' : 'Sign In'}
              </button>
            </form>
          )}

          {mode==='phone' && (
            <form onSubmit={sendOTP}>
              <button type="button" onClick={()=>setMode('choose')}
                style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer', marginBottom:16, fontSize:20 }}>←</button>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, marginBottom:8, color:'#eef2ff' }}>Sign In with Phone</h2>
              <p style={{ color:'#7c8fac', fontSize:14, marginBottom:16 }}>We'll send a verification code by SMS.</p>
              <input style={inp} type="tel" placeholder="Phone number (e.g. 5551234567)" value={phone} onChange={e=>setPhone(e.target.value)} required />
              <button type="submit" disabled={loading}
                style={{ width:'100%', background:'#2dd4bf', color:'#07090f', border:'none',
                  borderRadius:12, padding:13, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                {loading ? 'Sending...' : 'Send Code'}
              </button>
            </form>
          )}

          {mode==='phone_verify' && (
            <form onSubmit={verifyOTP}>
              <button type="button" onClick={()=>setMode('phone')}
                style={{ background:'none', border:'none', color:'#7c8fac', cursor:'pointer', marginBottom:16, fontSize:20 }}>←</button>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, marginBottom:8, color:'#eef2ff' }}>Enter Code</h2>
              <p style={{ color:'#7c8fac', fontSize:14, marginBottom:16 }}>Enter the 6-digit code sent to {phone}.</p>
              <input style={{ ...inp, fontSize:24, letterSpacing:'0.3em', textAlign:'center' }}
                type="text" placeholder="000000" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={6} required />
              <button type="submit" disabled={loading}
                style={{ width:'100%', background:'#2dd4bf', color:'#07090f', border:'none',
                  borderRadius:12, padding:13, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
