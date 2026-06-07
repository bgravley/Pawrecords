// src/Admin.jsx — YourPetPass Admin Dashboard
// Only accessible to users with is_admin = true in profiles table
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

// Fetch admin data through server-side endpoint (bypasses RLS)
const adminFetch = async (type, extra = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch('/api/admin-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ type, ...extra }),
  });
  return res.json();
};

const C = {
  bg: "#0F1117", card: "#1A1D27", border: "#2A2D3A",
  accent: "#2D7D6F", warn: "#E8A838", danger: "#C4714A",
  text: "#F0F0F0", sub: "#8B8FA8", green: "#10B981",
};

const fmt = d => { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const fmtTime = d => { if (!d) return "—"; return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
const fmtCost = n => n ? `$${Number(n).toFixed(4)}` : "$0.0000";
const fmtNum = n => n ? Number(n).toLocaleString() : "0";

const Stat = ({ label, value, sub, color }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
    <div style={{ fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color || C.text, marginBottom: 4 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.sub }}>{sub}</div>}
  </div>
);

const Tab = ({ id, label, active, onClick, alert }) => (
  <button onClick={onClick} style={{
    position:"relative", padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
    background: active ? C.accent : "transparent", color: active ? "#fff" : alert ? "#C4714A" : C.sub, transition: "all .15s"
  }}>
    {label}
    {alert && !active && <span style={{position:"absolute",top:4,right:4,width:8,height:8,background:"#C4714A",borderRadius:"50%"}}/>}
  </button>
);

export default function Admin({ onBack }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [affiliateCommissions, setAffiliateCommissions] = useState([]);
  const [showCreateAffiliate, setShowCreateAffiliate] = useState(false);
  const [newAffiliate, setNewAffiliate] = useState({ userId: '', commissionRate: 20, notes: '' });
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPets, setUserPets] = useState([]);
  const [petsLoading, setPetsLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadUserPets = async (user) => {
    setSelectedUser(user);
    setPetsLoading(true);
    const res = await adminFetch('user_pets', { userId: user.id });
    setUserPets(res.data || []);
    setPetsLoading(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, aiRes, actRes, errRes, affRes, commRes] = await Promise.all([
        adminFetch('users'),
        adminFetch('ai_logs'),
        adminFetch('activity'),
        adminFetch('errors'),
        adminFetch('affiliates'),
        adminFetch('affiliate_commissions'),
      ]);
      setUsers(usersRes.data || []);
      setAiLogs(aiRes.data || []);
      setActivityLogs(actRes.data || []);
      setErrorLogs(errRes.data || []);
      setAffiliates(affRes.data || []);
      setAffiliateCommissions(commRes.data || []);
    } catch(e) {
      console.error('Admin load error:', e);
    }
    setLoading(false);
  };

  const updateUser = async (userId, updates) => {
    await adminFetch('update_user', { targetUserId: userId, updates });
    setUsers(p => p.map(u => u.id === userId ? { ...u, ...updates } : u));
    setEditUser(null);
  };

  // Stats
  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u.subscription_tier === "premium" || u.subscription_tier === "lifetime").length;
  const totalCost = aiLogs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0);
  const totalTokens = aiLogs.reduce((s, l) => s + Number(l.total_tokens || 0), 0);
  const todayLogs = aiLogs.filter(l => new Date(l.created_at) > new Date(Date.now() - 86400000));
  const todayCost = todayLogs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0);
  const scanLogs = aiLogs.filter(l => l.feature === "document_scan");
  const travelLogs = aiLogs.filter(l => l.feature === "travel_checklist");

  const filteredUsers = users.filter(u =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: C.accent, fontSize: 18, fontWeight: 600 }}>Loading admin data...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "16px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", color: C.sub, cursor: "pointer", fontSize: 13 }}>← Back to App</button>
            <div style={{ fontSize: 20, fontWeight: 800 }}>🐾 YourPetPass <span style={{ color: C.accent }}>Admin</span></div>
          </div>
          <button onClick={loadData} style={{ background: C.accent, border: "none", borderRadius: 8, padding: "7px 16px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, background: C.card, borderRadius: 10, padding: 4, width: "fit-content", border: `1px solid ${C.border}` }}>
          {[
          { id: "overview", label: "Overview" },
          { id: "users", label: `Users (${totalUsers})` },
          { id: "ai", label: `AI Usage (${aiLogs.length})` },
          { id: "activity", label: `Activity (${activityLogs.length})` },
          { id: "errors", label: `Errors (${errorLogs.filter(e=>!e.reviewed).length})`, alert: errorLogs.filter(e=>!e.reviewed).length > 0 },
          { id: "affiliates", label: `Affiliates (${affiliates.length})` },
        ].map(t => (
            <Tab key={t.id} id={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            <Stat label="Total Users" value={totalUsers} sub={`${premiumUsers} premium`} color={C.text} />
            <Stat label="Premium Users" value={premiumUsers} sub={`${Math.round(premiumUsers / totalUsers * 100) || 0}% conversion`} color={C.accent} />
            <Stat label="Total AI Cost" value={`$${totalCost.toFixed(2)}`} sub={`${fmtNum(totalTokens)} total tokens`} color={C.warn} />
            <Stat label="Today's AI Cost" value={`$${todayCost.toFixed(4)}`} sub={`${todayLogs.length} requests today`} color={todayCost > 1 ? C.danger : C.green} />
            <Stat label="Doc Scans" value={scanLogs.length} sub={`$${scanLogs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0).toFixed(4)} total`} />
            <Stat label="Travel Checklists" value={travelLogs.length} sub={`$${travelLogs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0).toFixed(4)} total`} />
          </div>

          {/* Recent AI activity */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent AI Activity</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.sub, textAlign: "left" }}>
                  {["Time", "User", "Feature", "Model", "Tokens", "Cost", "Status"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiLogs.slice(0, 20).map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                    <td style={{ padding: "8px 12px", color: C.sub }}>{fmtTime(log.created_at)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 12 }}>{log.user_email || users.find(u => u.id === log.user_id)?.email || (log.user_id ? log.user_id.slice(0,8)+'...' : "—")}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: log.feature === "document_scan" ? "#2D7D6F22" : "#E8A83822", color: log.feature === "document_scan" ? C.accent : C.warn, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {log.feature === "document_scan" ? "📷 Scan" : "✈️ Travel"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: C.sub, fontSize: 11 }}>{log.model || "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{fmtNum(log.total_tokens)}</td>
                    <td style={{ padding: "8px 12px", color: C.warn }}>{fmtCost(log.estimated_cost_usd)}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ color: log.success ? C.green : C.danger, fontWeight: 600 }}>{log.success ? "✓" : "✗"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* USERS TAB */}
        {tab === "users" && <>
          <div style={{ marginBottom: 16 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name..."
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px", color: C.text, fontSize: 14, width: "100%", maxWidth: 400, outline: "none" }} />
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.sub, textAlign: "left", background: "#0F1117" }}>
                  {["Email", "Name", "Plan", "Joined", "AI Calls", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const userLogs = aiLogs.filter(l => l.user_id === user.id);
                  const tierColor = user.subscription_tier === "lifetime" ? C.warn : user.subscription_tier === "premium" ? C.accent : C.sub;
                  return (
                    <tr key={user.id} style={{ borderTop: `1px solid ${C.border}20` }}>
                      <td style={{ padding: "12px 16px" }}>{user.email || "—"}</td>
                      <td style={{ padding: "12px 16px", color: C.sub }}>{user.full_name || "—"}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ background: tierColor + "22", color: tierColor, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                          {(user.subscription_tier || "free").toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.sub }}>{fmt(user.created_at)}</td>
                      <td style={{ padding: "12px 16px" }}>{userLogs.length}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => loadUserPets(user)}
                            style={{ background: "#2D7D6F22", color: "#2D7D6F", border: "1px solid #2D7D6F44", borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            Pets
                          </button>
                          <button onClick={() => setEditUser(user)}
                            style={{ background: C.accent + "22", color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* AI USAGE TAB */}
        {tab === "ai" && <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Cost by Feature</div>
              {[
                { label: "📷 Document Scan (gpt-4o)", logs: scanLogs, color: C.accent },
                { label: "✈️ Travel Checklist (gpt-4o-mini)", logs: travelLogs, color: C.warn },
              ].map(({ label, logs, color }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                    <span>{label}</span>
                    <span style={{ color, fontWeight: 700 }}>${logs.reduce((s, l) => s + Number(l.estimated_cost_usd || 0), 0).toFixed(4)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.sub }}>{logs.length} requests · {fmtNum(logs.reduce((s, l) => s + Number(l.total_tokens || 0), 0))} tokens</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12 }}>Top Users by AI Usage</div>
              {Object.entries(
                aiLogs.reduce((acc, l) => {
                  const key = l.user_email || "unknown";
                  acc[key] = (acc[key] || 0) + Number(l.estimated_cost_usd || 0);
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([email, cost]) => (
                <div key={email} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}33`, fontSize: 13 }}>
                  <span style={{ color: C.sub }}>{email}</span>
                  <span style={{ color: C.warn, fontWeight: 600 }}>{fmtCost(cost)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Full AI Log</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: C.sub, textAlign: "left" }}>
                  {["Time", "User", "Feature", "Pet", "Destination", "In Tokens", "Out Tokens", "Cost", "OK"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aiLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}15` }}>
                    <td style={{ padding: "7px 10px", color: C.sub, whiteSpace: "nowrap" }}>{fmtTime(log.created_at)}</td>
                    <td style={{ padding: "7px 10px" }}>{(log.user_email || users.find(u => u.id === log.user_id)?.email || "")?.split("@")[0] || "—"}</td>
                    <td style={{ padding: "7px 10px" }}>{log.feature === "document_scan" ? "📷" : "✈️"}</td>
                    <td style={{ padding: "7px 10px", color: C.sub }}>{log.pet_name || "—"}</td>
                    <td style={{ padding: "7px 10px", color: C.sub }}>{log.trip_destination || "—"}</td>
                    <td style={{ padding: "7px 10px" }}>{fmtNum(log.input_tokens)}</td>
                    <td style={{ padding: "7px 10px" }}>{fmtNum(log.output_tokens)}</td>
                    <td style={{ padding: "7px 10px", color: C.warn }}>{fmtCost(log.estimated_cost_usd)}</td>
                    <td style={{ padding: "7px 10px", color: log.success ? C.green : C.danger }}>{log.success ? "✓" : "✗"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </div>

        {/* ACTIVITY TAB */}
        {tab === "activity" && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>User Activity Log</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: C.sub, textAlign: "left" }}>
                  {["Time", "User", "Action", "Details"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activityLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}15` }}>
                    <td style={{ padding: "7px 10px", color: C.sub, whiteSpace: "nowrap" }}>{fmtTime(log.created_at)}</td>
                    <td style={{ padding: "7px 10px", fontSize: 12 }}>
                      {log.user_email || users.find(u => u.id === log.user_id)?.email || log.user_id?.slice(0,8) || "—"}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ background: "#2D7D6F22", color: "#2D7D6F", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px", color: C.sub, fontSize: 11 }}>
                      {log.details ? Object.entries(log.details).map(([k,v]) => `${k}: ${v}`).join(" · ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ERRORS TAB */}
        {tab === "errors" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Error Log</div>
              <div style={{ fontSize: 13, color: C.sub }}>{errorLogs.filter(e=>!e.reviewed).length} unreviewed</div>
            </div>
            {errorLogs.length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: "center", color: C.sub }}>No errors logged 🎉</div>
              : errorLogs.map(err => (
                <div key={err.id} style={{ background: C.card, border: `1px solid ${err.reviewed ? C.border : "#C4714A44"}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {!err.reviewed && <span style={{ background: "#C4714A22", color: "#C4714A", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>NEW</span>}
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{err.context}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: C.sub }}>{fmtTime(err.created_at)}</span>
                      {!err.reviewed && (
                        <button onClick={async () => {
                          await adminFetch('mark_error_reviewed', { errorId: err.id });
                          setErrorLogs(p => p.map(e => e.id === err.id ? { ...e, reviewed: true } : e));
                        }} style={{ background: "#2D7D6F22", color: "#2D7D6F", border: "1px solid #2D7D6F44", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Mark Reviewed
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}>User: {err.user_email || users.find(u => u.id === err.user_id)?.email || err.user_id?.slice(0,8) || "unknown"}</div>
                  <div style={{ background: "#0F1117", borderRadius: 8, padding: 10, fontSize: 12, color: "#FF6B6B", fontFamily: "monospace" }}>
                    {err.error_message}
                  </div>
                </div>
              ))}
          </div>
        )}

      {/* User Pets Panel */}
      {selectedUser && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => e.target === e.currentTarget && setSelectedUser(null)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 560, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedUser.email}</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                  {selectedUser.subscription_tier?.toUpperCase() || 'FREE'} · Joined {new Date(selectedUser.created_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px", color: C.sub, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🐾 Pets</div>
            {petsLoading
              ? <div style={{ textAlign: "center", padding: 24, color: C.sub }}>Loading pets...</div>
              : userPets.length === 0
                ? <div style={{ textAlign: "center", padding: 24, color: C.sub, border: `1px dashed ${C.border}`, borderRadius: 12 }}>No pets added yet</div>
                : userPets.map(pet => (
                  <div key={pet.id} style={{ background: "#0F1117", border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{pet.name}</div>
                        <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{pet.breed || "—"} · {pet.gender || "—"}{pet.neutered ? " · Fixed" : ""}</div>
                        {pet.pet_type && pet.pet_type !== 'pet' && (
                          <div style={{ marginTop: 4 }}>
                            <span style={{ background: "#2D7D6F22", color: "#2D7D6F", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                              {pet.pet_type === 'service_animal' ? 'Service Animal' : 'ESA'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: C.sub }}>
                        {pet.weight && <div>{pet.weight} lbs</div>}
                        {pet.microchip && <div>Chip: {pet.microchip}</div>}
                        <div>Added {new Date(pet.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    {pet.emergency_contact && (
                      <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>
                        🚨 {pet.emergency_contact} {pet.emergency_phone_code} {pet.emergency_phone}
                      </div>
                    )}
                  </div>
                ))}
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button onClick={() => { setEditUser(selectedUser); setSelectedUser(null); }}
                style={{ flex: 1, background: C.accent, border: "none", borderRadius: 8, padding: "10px", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                Edit User
              </button>
              <button onClick={() => setSelectedUser(null)}
                style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: C.sub, cursor: "pointer", fontWeight: 600 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AFFILIATES TAB */}
      {tab === "affiliates" && (() => {
        const genCode = (email) => {
          const prefix = (email||'').split('@')[0].slice(0,4).toUpperCase().replace(/[^A-Z0-9]/g,'');
          const rand = Math.random().toString(36).slice(2,6).toUpperCase();
          return `${prefix}${rand}`;
        };
        const createAffiliate = async () => {
          if (!newAffiliate.userId) return;
          const user = users.find(u => u.id === newAffiliate.userId);
          const code = genCode(user?.email || '');
          const res = await adminFetch('create_affiliate', {
            userId: newAffiliate.userId,
            referralCode: code,
            commissionRate: parseFloat(newAffiliate.commissionRate) || 20,
            notes: newAffiliate.notes,
          });
          if (res.data) {
            setAffiliates(p => [res.data, ...p]);
            setShowCreateAffiliate(false);
            setNewAffiliate({ userId: '', commissionRate: 20, notes: '' });
          }
        };
        const toggleStatus = async (aff) => {
          const newStatus = aff.status === 'active' ? 'paused' : 'active';
          await adminFetch('update_affiliate', { affiliateId: aff.id, updates: { status: newStatus } });
          setAffiliates(p => p.map(a => a.id === aff.id ? { ...a, status: newStatus } : a));
        };
        const totalOwed = affiliateCommissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission_amount_cents || 0), 0);
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Affiliate Partners</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                  Total commissions pending: <span style={{ color: C.warn, fontWeight: 700 }}>${(totalOwed / 100).toFixed(2)}</span>
                </div>
              </div>
              <button onClick={() => setShowCreateAffiliate(true)}
                style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                + Add Affiliate
              </button>
            </div>

            {/* Affiliate list */}
            {affiliates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: C.sub }}>No affiliates yet. Add one above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {affiliates.map(aff => {
                  const user = users.find(u => u.id === aff.user_id);
                  const referred = users.filter(u => u.referral_code_used === aff.referral_code).length;
                  const owed = affiliateCommissions.filter(c => c.affiliate_id === aff.id && c.status === 'pending').reduce((s, c) => s + (c.commission_amount_cents || 0), 0);
                  const paid = affiliateCommissions.filter(c => c.affiliate_id === aff.id && c.status === 'paid').reduce((s, c) => s + (c.commission_amount_cents || 0), 0);
                  const referralUrl = `https://yourpetpass.com?ref=${aff.referral_code}`;
                  return (
                    <div key={aff.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{user?.email || aff.user_id?.slice(0,8)}</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                            <span style={{ background: '#2D7D6F22', color: C.accent, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                              {aff.referral_code}
                            </span>
                            <span style={{ background: aff.status === 'active' ? '#10B98122' : '#E8A83822', color: aff.status === 'active' ? C.green : C.warn, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                              {aff.status.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 12, color: C.sub }}>{aff.commission_rate}% commission</span>
                          </div>
                          {aff.notes && <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>{aff.notes}</div>}
                          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                            <span style={{ color: C.text }}><b>{referred}</b> <span style={{ color: C.sub }}>referred</span></span>
                            <span style={{ color: C.warn }}><b>${(owed/100).toFixed(2)}</b> <span style={{ color: C.sub }}>owed</span></span>
                            <span style={{ color: C.green }}><b>${(paid/100).toFixed(2)}</b> <span style={{ color: C.sub }}>paid</span></span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => { navigator.clipboard.writeText(referralUrl); }}
                            style={{ background: '#2D7D6F22', color: C.accent, border: `1px solid #2D7D6F44`, borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            Copy Link
                          </button>
                          <button onClick={() => toggleStatus(aff)}
                            style={{ background: aff.status === 'active' ? '#E8A83822' : '#10B98122', color: aff.status === 'active' ? C.warn : C.green, border: '1px solid transparent', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {aff.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                        </div>
                      </div>
                      {/* Referral link */}
                      <div style={{ marginTop: 10, background: C.bg, borderRadius: 8, padding: '7px 12px', fontSize: 11, color: C.sub, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {referralUrl}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Commission ledger */}
            {affiliateCommissions.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Commission Ledger</div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ color: C.sub }}>
                        {['Date', 'Affiliate', 'Referred User', 'Payment', 'Rate', 'Commission', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {affiliateCommissions.map(c => {
                        const aff = affiliates.find(a => a.id === c.affiliate_id);
                        const affUser = users.find(u => u.id === aff?.user_id);
                        const refUser = users.find(u => u.id === c.referred_user_id);
                        const statusColor = c.status === 'paid' ? C.green : c.status === 'pending' ? C.warn : C.sub;
                        return (
                          <tr key={c.id} style={{ borderTop: `1px solid ${C.border}20` }}>
                            <td style={{ padding: '8px 12px', color: C.sub }}>{fmt(c.created_at)}</td>
                            <td style={{ padding: '8px 12px' }}>{affUser?.email?.split('@')[0] || '—'}</td>
                            <td style={{ padding: '8px 12px', color: C.sub }}>{refUser?.email?.split('@')[0] || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>${((c.payment_amount_cents||0)/100).toFixed(2)}</td>
                            <td style={{ padding: '8px 12px', color: C.sub }}>{c.commission_rate}%</td>
                            <td style={{ padding: '8px 12px', color: C.warn, fontWeight: 700 }}>${((c.commission_amount_cents||0)/100).toFixed(2)}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ background: statusColor+'22', color: statusColor, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                                {c.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Create Affiliate Modal */}
            {showCreateAffiliate && (
              <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                onClick={e => e.target === e.currentTarget && setShowCreateAffiliate(false)}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Add Affiliate</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>User Account</label>
                      <select value={newAffiliate.userId} onChange={e => setNewAffiliate(p => ({ ...p, userId: e.target.value }))}
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%' }}>
                        <option value="">— Select a user —</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Commission Rate (%)</label>
                      <input type="number" min="1" max="100" value={newAffiliate.commissionRate}
                        onChange={e => setNewAffiliate(p => ({ ...p, commissionRate: e.target.value }))}
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>20% is the standard. Go up to 25–30% for high-value influencer deals.</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                      <input value={newAffiliate.notes} onChange={e => setNewAffiliate(p => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Instagram @handle, deal terms"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
                      A unique referral code will be auto-generated from the user's email. Their link will be:<br/>
                      <span style={{ fontFamily: 'monospace', color: C.accent }}>yourpetpass.com?ref=THEIRCODE</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => setShowCreateAffiliate(false)}
                        style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, color: C.sub, cursor: 'pointer', fontWeight: 600 }}>
                        Cancel
                      </button>
                      <button onClick={createAffiliate}
                        style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 8, padding: 10, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                        Create Affiliate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Edit User Modal */}
      {editUser && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => e.target === e.currentTarget && setEditUser(null)}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 440 }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20 }}>Edit User — {editUser.email}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Subscription Tier</label>
                <select defaultValue={editUser.subscription_tier || "free"}
                  id="tier-select"
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, width: "100%" }}>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Full Name</label>
                <input id="name-input" defaultValue={editUser.full_name || ''}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                    AI Scan Limit / Month
                    <span style={{ color: C.warn, marginLeft: 4, fontWeight: 400, textTransform: 'none' }}>(default: 20)</span>
                  </label>
                  <input id="scan-limit-input" type="number" min="0" max="999"
                    defaultValue={editUser.ai_scan_limit_override !== null && editUser.ai_scan_limit_override !== undefined ? editUser.ai_scan_limit_override : ''}
                    placeholder="20 (default)"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                    Travel Limit / Month
                    <span style={{ color: C.warn, marginLeft: 4, fontWeight: 400, textTransform: 'none' }}>(default: 8)</span>
                  </label>
                  <input id="travel-limit-input" type="number" min="0" max="999"
                    defaultValue={editUser.ai_travel_limit_override !== null && editUser.ai_travel_limit_override !== undefined ? editUser.ai_travel_limit_override : ''}
                    placeholder="8 (default)"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: -6 }}>
                Leave blank to use the default. Set to a high number (e.g. 999) to give unlimited access to testers or affiliates.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setEditUser(null)}
                  style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: C.sub, cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={() => {
                  const scanVal = document.getElementById('scan-limit-input').value;
                  const travelVal = document.getElementById('travel-limit-input').value;
                  updateUser(editUser.id, {
                    subscription_tier: document.getElementById('tier-select').value,
                    full_name: document.getElementById('name-input').value,
                    ai_scan_limit_override: scanVal !== '' ? parseInt(scanVal) : null,
                    ai_travel_limit_override: travelVal !== '' ? parseInt(travelVal) : null,
                  });
                }}
                  style={{ flex: 1, background: C.accent, border: "none", borderRadius: 8, padding: "10px", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  Save Changes
                </button>
              </div>
              <div style={{ fontSize: 12, color: C.sub, textAlign: "center" }}>
                User ID: {editUser.id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
