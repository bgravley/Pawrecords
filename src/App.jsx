// src/App.jsx
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./components/Auth.jsx";
import YourPetPass from "./PawRecord.jsx";
import Admin from "./Admin.jsx";

// Your admin email — only this account sees the admin dashboard
const ADMIN_EMAIL = "bgravley@rdmarketingllc.com";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setShowAdmin(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 28, fontWeight: 900, color: "#2D7D6F" }}>
        🐾 Loading...
      </div>
    </div>
  );

  if (!session) return <Auth />;

  // Admin route - only for admin email
  const isAdmin = session.user.email === ADMIN_EMAIL || profile?.is_admin === true;

  if (showAdmin && isAdmin) {
    return <Admin onBack={() => setShowAdmin(false)} />;
  }

  return (
    <>
      <YourPetPass
        userId={session.user.id}
        profile={profile}
        onSignOut={handleSignOut}
        isAdmin={isAdmin}
        onOpenAdmin={() => setShowAdmin(true)}
      />
    </>
  );
}
