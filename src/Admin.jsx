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
  const [prewarmStatus, setPrewarmStatus] = useState(null);
  const [prewarmRoutes, setPrewarmRoutes] = useState([]);
  const [prewarmSuggestions, setPrewarmSuggestions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [errorLogs, setErrorLogs] = useState([]);
  const [bugReports, setBugReports] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState([]);
  const [affiliateCommissions, setAffiliateCommissions] = useState([]);
  const [showCreateAffiliate, setShowCreateAffiliate] = useState(false);
  const [newAffiliate, setNewAffiliate] = useState({ userId: '', referralCode: '', commissionRate: 25, notes: '' });
  const [affiliateError, setAffiliateError] = useState('');
  const [creatingAffiliate, setCreatingAffiliate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [deleteUserConfirmText, setDeleteUserConfirmText] = useState('');
  const [deletingUser, setDeletingUser] = useState(false);
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
      const [usersRes, aiRes, actRes, errRes, affRes, commRes, bugRes, payoutRes, prewarmRoutesRes, prewarmSuggRes] = await Promise.all([
        adminFetch('users'),
        adminFetch('ai_logs'),
        adminFetch('activity'),
        adminFetch('errors'),
        adminFetch('affiliates'),
        adminFetch('affiliate_commissions'),
        adminFetch('bug_reports'),
        adminFetch('payout_summary'),
        adminFetch('prewarm_routes'),
        adminFetch('prewarm_route_suggestions'),
      ]);
      setUsers(usersRes.data || []);
      setAiLogs(aiRes.data || []);
      setActivityLogs(actRes.data || []);
      setErrorLogs(errRes.data || []);
      setAffiliates(affRes.data || []);
      setAffiliateCommissions(commRes.data || []);
      setBugReports(bugRes.data || []);
      setPayoutSummary(payoutRes.data || []);
      setPrewarmRoutes(prewarmRoutesRes.data || []);
      setPrewarmSuggestions(prewarmSuggRes.data || []);
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

  // Group cost/tokens by provider, inferred from the model string
  const providerOf = (model) => {
    if (!model) return "Unknown";
    if (model.startsWith("claude")) return "Anthropic (Claude)";
    if (model.startsWith("gpt")) return "OpenAI (GPT)";
    return model;
  };
  const byProvider = aiLogs.reduce((acc, l) => {
    const p = providerOf(l.model);
    if (!acc[p]) acc[p] = { cost: 0, tokens: 0, requests: 0, models: {} };
    acc[p].cost += Number(l.estimated_cost_usd || 0);
    acc[p].tokens += Number(l.total_tokens || 0);
    acc[p].requests += 1;
    acc[p].models[l.model] = (acc[p].models[l.model] || 0) + 1;
    return acc;
  }, {});

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
            <img src="/logo_horizontal_cream_transparent.png" alt="YourPetPass" style={{ height: 30, display: "block" }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>Admin</div>
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
          { id: "bugs", label: `Bug Reports (${bugReports.filter(b=>b.status==='pending').length})`, alert: bugReports.filter(b=>b.status==='pending').length > 0 },
          { id: "affiliates", label: `Affiliates (${affiliates.length})` },
          { id: "payouts", label: `Payouts (${payoutSummary.length})`, alert: payoutSummary.length > 0 },
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

          {/* Pre-warm route cache */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Pre-warm Route Cache</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Runs automatically every Monday on {prewarmRoutes.filter(r => r.active).length} routes. Use this to trigger it on demand.</div>
              </div>
              <button onClick={async () => {
                setPrewarmStatus('running');
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const r = await fetch('/api/prewarm-cache', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                    body: JSON.stringify({}),
                  });
                  const data = await r.json();
                  setPrewarmStatus(data.summary ? `Done — ${data.summary.newlyWarmed} generated, ${data.summary.alreadyCached} already cached, ${data.summary.failed} failed` : (data.error || 'Failed'));
                } catch (e) {
                  setPrewarmStatus('Failed: ' + e.message);
                }
              }} disabled={prewarmStatus === 'running'} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                {prewarmStatus === 'running' ? 'Running (this can take a minute)...' : '🔥 Run Pre-warm Now'}
              </button>
              {prewarmStatus && prewarmStatus !== 'running' && (
                <div style={{ fontSize: 12, color: C.sub, width: "100%" }}>{prewarmStatus}</div>
              )}
            </div>

            {prewarmSuggestions.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Suggested additions — real routes people have researched, not yet on the proactive list
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {prewarmSuggestions.map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
                      <div style={{ fontSize: 13 }}>{s.originCountry} → {s.destinationCountry} <span style={{ color: C.sub }}>({s.transportationMode})</span></div>
                      <button onClick={async () => {
                        const res = await adminFetch('prewarm_route_add', { originCountry: s.originCountry, destinationCountry: s.destinationCountry, transportationMode: s.transportationMode, source: 'auto-detected' });
                        if (res.data) {
                          setPrewarmRoutes(p => [res.data, ...p]);
                          setPrewarmSuggestions(p => p.filter((_, idx) => idx !== i));
                        } else {
                          alert(res.error || 'Could not add route.');
                        }
                      }} style={{ background: C.accent, border: "none", borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        + Add to list
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <details style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              <summary style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>View full list ({prewarmRoutes.length})</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {prewarmRoutes.map(r => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <div>{r.origin_country} → {r.destination_country} <span style={{ color: C.sub }}>({r.transportation_mode}, {r.source})</span></div>
                    <button onClick={async () => {
                      if (!window.confirm(`Remove ${r.origin_country} → ${r.destination_country} from the proactive list?`)) return;
                      await adminFetch('prewarm_route_remove', { routeId: r.id });
                      setPrewarmRoutes(p => p.filter(x => x.id !== r.id));
                    }} style={{ background: "transparent", border: "none", color: C.danger, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Remove</button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Cost breakdown by provider */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>AI Cost by Provider</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {Object.entries(byProvider).map(([provider, d]) => (
                <div key={provider} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: provider.includes("Claude") ? "#D97757" : provider.includes("GPT") ? "#74AA9C" : C.text }}>{provider}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.warn, marginBottom: 4 }}>${d.cost.toFixed(4)}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>{d.requests} requests · {d.tokens.toLocaleString()} tokens</div>
                  <div style={{ fontSize: 11, color: C.sub, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                    {Object.entries(d.models).map(([m, count]) => (
                      <div key={m} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <span>{m}</span><span>{count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
            <input maxLength={150} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name..."
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
                      <button onClick={async () => {
                        const newState = !err.reviewed;
                        await adminFetch('mark_error_reviewed', { errorId: err.id, reviewed: newState });
                        setErrorLogs(p => p.map(e => e.id === err.id ? { ...e, reviewed: newState } : e));
                      }} style={{ background: err.reviewed ? "#8B735522" : "#2D7D6F22", color: err.reviewed ? "#8B7355" : "#2D7D6F", border: `1px solid ${err.reviewed ? "#8B735544" : "#2D7D6F44"}`, borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {err.reviewed ? "Mark Unreviewed" : "Mark Reviewed"}
                      </button>
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

        {tab === "bugs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Bug Reports</div>
              <div style={{ fontSize: 13, color: C.sub }}>{bugReports.filter(b=>b.status==='pending').length} pending review</div>
            </div>
            {bugReports.length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: "center", color: C.sub }}>No bug reports yet</div>
              : bugReports.map(report => (
                <div key={report.id} style={{ background: C.card, border: `1px solid ${report.status === 'pending' ? "#E8A83844" : C.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        background: report.status === 'pending' ? "#E8A83822" : report.status === 'approved' ? "#2D7D6F22" : "#8B735522",
                        color: report.status === 'pending' ? "#E8A838" : report.status === 'approved' ? "#2D7D6F" : "#8B7355",
                        borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                      }}>{report.status}</span>
                      <span style={{ fontSize: 13, color: C.sub }}>{report.user_email || "unknown"}</span>
                    </div>
                    <span style={{ fontSize: 12, color: C.sub }}>{fmtTime(report.created_at)}</span>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: 12, fontSize: 13, color: C.text, marginBottom: (report.status === 'pending' || report.screenshot_url) ? 12 : (report.reward_type ? 8 : 0), whiteSpace: "pre-wrap" }}>
                    {report.description}
                  </div>
                  {report.screenshot_url && (
                    <a href={report.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: report.status === 'pending' ? 12 : (report.reward_type ? 8 : 0) }}>
                      <img src={report.screenshot_url} alt="Bug screenshot" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: `1px solid ${C.border}` }} />
                    </a>
                  )}
                  {report.reward_type && (
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 0 }}>
                      Reward: <strong style={{ color: C.text }}>{report.reward_type.replace(/_/g, ' ')}</strong>
                    </div>
                  )}
                  {report.status === 'pending' && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={async () => {
                        const res = await adminFetch('approve_bug_report', { reportId: report.id });
                        setBugReports(p => p.map(b => b.id === report.id ? { ...b, status: 'approved', reward_type: res?.data?.rewardType } : b));
                      }} style={{ flex: 1, background: "#2D7D6F", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        ✓ Approve & Reward
                      </button>
                      <button onClick={async () => {
                        await adminFetch('reject_bug_report', { reportId: report.id });
                        setBugReports(p => p.map(b => b.id === report.id ? { ...b, status: 'rejected' } : b));
                      }} style={{ flex: 1, background: "transparent", color: C.sub, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 0", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                        ✗ Reject
                      </button>
                    </div>
                  )}
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
          if (!newAffiliate.userId || creatingAffiliate) return;
          setCreatingAffiliate(true);
          setAffiliateError('');
          try {
          const user = users.find(u => u.id === newAffiliate.userId);
          const typed = (newAffiliate.referralCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const code = typed || genCode(user?.email || '');
          const rate = parseFloat(newAffiliate.commissionRate) || 25;
          const res = await adminFetch('create_affiliate', {
            userId: newAffiliate.userId,
            referralCode: code,
            commissionRate: rate,
            notes: newAffiliate.notes,
          });
          if (res.data) {
            setAffiliates(p => [res.data, ...p]);
            setShowCreateAffiliate(false);
            setNewAffiliate({ userId: '', referralCode: '', commissionRate: 25, notes: '' });
            // Send welcome email to the new affiliate
            try {
              await fetch('/api/notify-affiliate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  affiliateEmail: user?.email || '',
                  affiliateName: user?.full_name || '',
                  referralCode: code,
                  commissionRate: rate,
                  notes: newAffiliate.notes || '',
                }),
              });
            } catch (e) {
              console.error('Affiliate welcome email failed (non-critical):', e.message);
            }
          } else {
            // Two things are now unique at the DB level: referral_code, and
            // (as of July 2026) user_id itself -- so a 409 here means either
            // the code is taken, or this person is already an affiliate.
            setAffiliateError(
              (res.error || '').includes('409') || (res.error || '').toLowerCase().includes('duplicate')
                ? `Either "${code}" is already taken, or ${user?.email || 'this person'} is already an affiliate — check the list below.`
                : (res.error || 'Could not create affiliate. Please try again.')
            );
          }
          } finally {
            setCreatingAffiliate(false);
          }
        };
        const toggleStatus = async (aff) => {
          const newStatus = aff.status === 'active' ? 'paused' : 'active';
          await adminFetch('update_affiliate', { affiliateId: aff.id, updates: { status: newStatus } });
          setAffiliates(p => p.map(a => a.id === aff.id ? { ...a, status: newStatus } : a));
        };
        const totalOwed = affiliateCommissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission_amount_cents || 0), 0);

        // Monthly summary — current month only
        const thisMonth = new Date().toISOString().slice(0, 7);
        const thisMonthOwed = affiliateCommissions.filter(c => c.status === 'pending' && (c.period_month || '').startsWith(thisMonth)).reduce((s, c) => s + (c.commission_amount_cents || 0), 0);

        const markPaid = async (commissionId, method) => {
          await adminFetch('update_commission', { commissionId, updates: { status: 'paid', payout_method: method, paid_at: new Date().toISOString() } });
          setAffiliateCommissions(p => p.map(c => c.id === commissionId ? { ...c, status: 'paid', payout_method: method } : c));
        };

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>Affiliate Partners</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
                  Total pending: <span style={{ color: C.warn, fontWeight: 700 }}>${(totalOwed / 100).toFixed(2)}</span>
                  &nbsp;&nbsp;·&nbsp;&nbsp;
                  This month: <span style={{ color: C.warn, fontWeight: 700 }}>${(thisMonthOwed / 100).toFixed(2)}</span>
                </div>
              </div>
              <button onClick={() => { setAffiliateError(''); setShowCreateAffiliate(true); }}
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
                          <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 8 }}>
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
                              {c.status === 'pending' ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => markPaid(c.id, 'paypal')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #003087', background: '#003087', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Pay PayPal</button>
                                  <button onClick={() => markPaid(c.id, 'stripe')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #6772E5', background: '#6772E5', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Pay Stripe</button>
                                </div>
                              ) : (
                                <span style={{ background: statusColor+'22', color: statusColor, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                                  PAID via {c.payout_method?.toUpperCase() || 'N/A'}
                                </span>
                              )}
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
                onClick={e => e.target === e.currentTarget && (setAffiliateError(''), setShowCreateAffiliate(false))}>
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
                      <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Referral Code</label>
                      <input maxLength={20} value={newAffiliate.referralCode}
                        onChange={e => setNewAffiliate(p => ({ ...p, referralCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                        placeholder={(() => {
                          const u = users.find(x => x.id === newAffiliate.userId);
                          return u ? genCode(u.email) + ' (auto)' : 'Pick a user first, or type a custom code';
                        })()}
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none', fontFamily: 'monospace' }} />
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Leave blank to auto-generate, or type something memorable (e.g. SADIE25) — this works as both the link code and a typed-in promo code.</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Commission Rate (%)</label>
                      <input type="number" min="1" max="100" value={newAffiliate.commissionRate}
                        onChange={e => setNewAffiliate(p => ({ ...p, commissionRate: e.target.value }))}
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>25% is the standard (calculated on what you actually receive after Stripe fees). Go higher for special deals.</div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>Notes (optional)</label>
                      <input maxLength={150} value={newAffiliate.notes} onChange={e => setNewAffiliate(p => ({ ...p, notes: e.target.value }))}
                        placeholder="e.g. Instagram @handle, deal terms"
                        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                    </div>
                    {affiliateError && (
                      <div style={{ fontSize: 12, color: C.danger, background: '#C4714A14', border: `1px solid ${C.danger}44`, borderRadius: 8, padding: '10px 12px' }}>
                        {affiliateError}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: C.sub, background: C.bg, borderRadius: 8, padding: '10px 12px' }}>
                      Their link and typed promo code will both be:<br/>
                      <span style={{ fontFamily: 'monospace', color: C.accent }}>yourpetpass.com?ref={newAffiliate.referralCode || 'THEIRCODE'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { setAffiliateError(''); setShowCreateAffiliate(false); }}
                        style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, color: C.sub, cursor: 'pointer', fontWeight: 600 }}>
                        Cancel
                      </button>
                      <button onClick={createAffiliate} disabled={creatingAffiliate}
                        style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 8, padding: 10, color: '#fff', cursor: creatingAffiliate ? 'default' : 'pointer', fontWeight: 600, opacity: creatingAffiliate ? 0.6 : 1 }}>
                        {creatingAffiliate ? 'Creating...' : 'Create Affiliate'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* PAYOUTS TAB */}
      {tab === "payouts" && (() => {
        const markPaid = async (p) => {
          if (!window.confirm(`Mark $${(p.pendingCents/100).toFixed(2)} as paid to ${p.name || p.email || p.referralCode}? Only do this after you've actually sent the money.`)) return;
          const res = await adminFetch('mark_commissions_paid', { affiliateId: p.affiliateId, payoutMethod: null });
          if (res.data?.marked) {
            setPayoutSummary(prev => prev.filter(x => x.affiliateId !== p.affiliateId));
          } else {
            alert(res.error || 'Could not mark as paid — please try again.');
          }
        };
        const totalOwed = payoutSummary.reduce((sum, p) => sum + p.pendingCents, 0);
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Affiliate Payouts</div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>Unpaid commission balances. Send payment yourself (PayPal/Stripe/etc), then mark it paid here.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.warn }}>${(totalOwed/100).toFixed(2)}</div>
                <div style={{ fontSize: 12, color: C.sub }}>total owed</div>
              </div>
            </div>
            {payoutSummary.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: C.sub }}>Nothing owed right now.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {payoutSummary.map(p => (
                  <div key={p.affiliateId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name || p.email || p.referralCode}</div>
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 2, fontFamily: 'monospace' }}>{p.referralCode}</div>
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
                        {p.email ? `Contact: ${p.email}` : 'No contact email on file'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>${(p.pendingCents/100).toFixed(2)}</div>
                      <button onClick={() => markPaid(p)}
                        style={{ background: C.accent, border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        Mark Paid
                      </button>
                    </div>
                  </div>
                ))}
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
                <input maxLength={150} id="name-input" defaultValue={editUser.full_name || ''}
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
                    <span style={{ color: C.warn, marginLeft: 4, fontWeight: 400, textTransform: 'none' }}>(default: 3)</span>
                  </label>
                  <input id="travel-limit-input" type="number" min="0" max="999"
                    defaultValue={editUser.ai_travel_limit_override !== null && editUser.ai_travel_limit_override !== undefined ? editUser.ai_travel_limit_override : ''}
                    placeholder="3 (default)"
                    style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 6 }}>
                  Travel Credit Balance
                  <span style={{ color: C.warn, marginLeft: 4, fontWeight: 400, textTransform: 'none' }}>(purchased checklists, separate from monthly limit)</span>
                </label>
                <input id="credits-balance-input" type="number" min="0" max="999"
                  defaultValue={editUser.travel_credits_balance ?? 0}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 14, width: '100%', outline: 'none' }} />
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: -6 }}>
                Leave the limit fields blank to use the default. Set to a high number (e.g. 999) to give unlimited access to testers or affiliates.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setEditUser(null)}
                  style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: C.sub, cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={() => {
                  const scanVal = document.getElementById('scan-limit-input').value;
                  const travelVal = document.getElementById('travel-limit-input').value;
                  const creditsVal = document.getElementById('credits-balance-input').value;
                  updateUser(editUser.id, {
                    subscription_tier: document.getElementById('tier-select').value,
                    full_name: document.getElementById('name-input').value,
                    ai_scan_limit_override: scanVal !== '' ? parseInt(scanVal) : null,
                    ai_travel_limit_override: travelVal !== '' ? parseInt(travelVal) : null,
                    travel_credits_balance: creditsVal !== '' ? parseInt(creditsVal) : 0,
                  });
                }}
                  style={{ flex: 1, background: C.accent, border: "none", borderRadius: 8, padding: "10px", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  Save Changes
                </button>
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 16, paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Danger Zone</div>
                <button onClick={() => { setShowDeleteUserConfirm(true); setDeleteUserConfirmText(''); }}
                  style={{ width: '100%', background: 'transparent', border: `1px solid ${C.danger}66`, borderRadius: 8, padding: '10px', color: C.danger, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  🗑 Delete Account Permanently
                </button>
              </div>

              <div style={{ fontSize: 12, color: C.sub, textAlign: "center" }}>
                User ID: {editUser.id}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteUserConfirm && editUser && (
        <div onClick={() => setShowDeleteUserConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', border: `1px solid ${C.danger}66` }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.danger, marginBottom: 10 }}>Delete this account permanently?</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, marginBottom: 16 }}>
              This permanently deletes <strong style={{ color: C.text }}>{editUser.email}</strong> — all their pets, records, trips, and login access. This cannot be undone. Their email becomes available for signup again.
            </div>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 8 }}>Type <strong style={{ color: C.text }}>DELETE</strong> to confirm:</div>
            <input maxLength={150} value={deleteUserConfirmText} onChange={e => setDeleteUserConfirmText(e.target.value)} placeholder="DELETE"
              style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteUserConfirm(false)}
                style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, color: C.sub, cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button
                disabled={deleteUserConfirmText !== 'DELETE' || deletingUser}
                onClick={async () => {
                  setDeletingUser(true);
                  const res = await adminFetch('delete_user', { targetUserId: editUser.id });
                  setDeletingUser(false);
                  if (res?.error) { alert('Delete failed: ' + res.error); return; }
                  setUsers(p => p.filter(u => u.id !== editUser.id));
                  setShowDeleteUserConfirm(false);
                  setEditUser(null);
                }}
                style={{ flex: 1, background: deleteUserConfirmText === 'DELETE' ? C.danger : C.border, border: 'none', borderRadius: 8, padding: 10, color: '#fff', cursor: deleteUserConfirmText === 'DELETE' ? 'pointer' : 'not-allowed', fontWeight: 700 }}>
                {deletingUser ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
