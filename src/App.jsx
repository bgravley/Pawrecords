import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import PawRecord from './PawRecord'
import TravelModule from './Travel'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [tab, setTab] = useState('health')
  const [dogs, setDogs] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadDogs()
  }, [session])

  const loadDogs = async () => {
    const { data } = await supabase.from('dogs').select('*').eq('user_id', session.user.id)
    setDogs(data || [])
  }

  if (session === undefined) return (
    <div style={{ minHeight:'100vh', background:'#FAF6F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily:"'Lora',serif", fontSize:28, color:'#2D7D6F' }}>🐾 YourPetPass</div>
    </div>
  )

  if (!session) return <Auth />

  const workerUrl = import.meta.env.VITE_AI_WORKER_URL

  return (
    <div style={{ minHeight:'100vh', background:'#FAF6F0' }}>
      {/* Main content */}
      <div style={{ paddingBottom: 70 }}>
        {tab === 'health' && (
          <PawRecord
            userId={session.user.id}
            onSignOut={() => supabase.auth.signOut()}
            onDogsChange={setDogs}
          />
        )}
        {tab === 'travel' && (
          <TravelModule
            userId={session.user.id}
            dogs={dogs}
            workerUrl={workerUrl}
          />
        )}
      </div>

      {/* Bottom tab bar */}
      <nav style={{
        position:'fixed', bottom:0, left:0, right:0, zIndex:300,
        background:'#FFFFFF', borderTop:'1px solid #E8DDD0',
        display:'flex', height:64, boxShadow:'0 -2px 12px rgba(44,32,23,0.06)'
      }}>
        <button onClick={() => setTab('health')} style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:3, background:'none', border:'none',
          color: tab==='health' ? '#2D7D6F' : '#8B7355',
          fontSize:11, fontWeight: tab==='health' ? 800 : 600,
          fontFamily:"'Nunito',sans-serif", cursor:'pointer'
        }}>
          <span style={{ fontSize:22 }}>📋</span>
          Health Records
        </button>
        <button onClick={() => setTab('travel')} style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:3, background:'none', border:'none',
          color: tab==='travel' ? '#E8A838' : '#8B7355',
          fontSize:11, fontWeight: tab==='travel' ? 800 : 600,
          fontFamily:"'Nunito',sans-serif", cursor:'pointer'
        }}>
          <span style={{ fontSize:22 }}>🛂</span>
          Travel
        </button>
      </nav>
    </div>
  )
}
