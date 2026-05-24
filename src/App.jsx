import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import PawRecord from './PawRecord'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ minHeight:'100vh', background:'#07090f', display:'flex',
      alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, color:'#2dd4bf' }}>
        🐾 PawRecord
      </div>
    </div>
  )

  if (!session) return <Auth />

  return <PawRecord 
    userId={session.user.id} 
    onSignOut={() => supabase.auth.signOut()} 
  />
}
