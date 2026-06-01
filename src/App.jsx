import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import PawRecord from './PawRecord'
import TravelModule from './Travel'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('health')
  const [dogs, setDogs] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id)
        loadDogs(session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id)
        loadDogs(session.user.id)
      } else {
        setProfile(null)
        setDogs([])
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
  }

  const loadDogs = async (userId) => {
    const { data } = await supabase.from('dogs').select('*').eq('user_id', userId)
    setDogs(data || [])
  }

  if (session === undefined) return (
    <div style={{ minHeight: '100vh', background: '#1E5C52', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 28, color: '#F5C45E', fontStyle: 'italic' }}>
        🐾 YourPetPass
      </div>
    </div>
  )

  if (!session) return <Auth />

  const userId = session.user.id
  const tier = profile?.subscription_tier || 'premium'
  const userEmail = session.user.email || ''
  const workerUrl = import.meta.env.VITE_AI_WORKER_URL

  return (
    <div style={{ minHeight: '100vh', background: '#FAF6F0' }}>

      {/* Health Records tab */}
      <div style={{ display: activeTab === 'health' ? 'block' : 'none' }}>
        <PawRecord
          userId={userId}
          profile={profile}
          tier={tier}
          userEmail={userEmail}
          onSignOut={() => supabase.auth.signOut()}
          onDogsChange={updated => {
            setDogs(updated)
            loadDogs(userId)
          }}
        />
      </div>

      {/* Travel tab */}
      <div style={{ display: activeTab === 'travel' ? 'block' : 'none' }}>
        <TravelModule
          userId={userId}
          dogs={dogs}
          workerUrl={workerUrl}
        />
      </div>

      {/* Bottom tab bar — only show on home screens, not inside pet detail */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#FFFFFF', borderTop: '1px solid #E8DDD0',
        display: 'flex', height: 64,
        boxShadow: '0 -2px 12px rgba(44,32,23,0.06)',
        fontFamily: "'Nunito', sans-serif"
      }}>
        <button onClick={() => setActiveTab('health')} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 3, background: 'none', border: 'none',
          color: activeTab === 'health' ? '#2D7D6F' : '#8B7355',
          fontSize: 11, fontWeight: activeTab === 'health' ? 800 : 600,
          fontFamily: "'Nunito', sans-serif", cursor: 'pointer'
        }}>
          <span style={{ fontSize: 22 }}>📋</span>
          Health Records
        </button>
        <button onClick={() => setActiveTab('travel')} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 3, background: 'none', border: 'none',
          color: activeTab === 'travel' ? '#E8A838' : '#8B7355',
          fontSize: 11, fontWeight: activeTab === 'travel' ? 800 : 600,
          fontFamily: "'Nunito', sans-serif", cursor: 'pointer'
        }}>
          <span style={{ fontSize: 22 }}>🛂</span>
          Travel
        </button>
      </nav>
    </div>
  )
}
