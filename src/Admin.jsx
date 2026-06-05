// src/Admin.jsx — YourPetPass Admin Dashboard
// Only accessible to users with is_admin = true in profiles table
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

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

const Tab = ({ id, label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: "8px 18px", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
    background: active ? C.accent : "transparent", color: active ? "#fff" : C.sub, transition: "all .15s"
  }}>{label}</button>
);

export default function Admin({ onBack }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [aiLogs, setAiLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: u }, { data: logs }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("ai_usage_log").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setUsers(u || []);
    setAiLogs(logs || []);
    setLoading(false);
  };

  const updateUser = async (userId, updates) => {
    await supabase.from("profiles").update(updates).eq("id", userId);
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
          {[{ id: "overview", label: "Overview" }, { id: "users", label: `Users (${totalUsers})` }, { id: "ai", label: `AI Usage (${aiLogs.length})` }].map(t => (
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
                    <td style={{ padding: "8px 12px" }}>{log.user_email || "—"}</td>
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
                        <button onClick={() => setEditUser(user)}
                          style={{ background: C.accent + "22", color: C.accent, border: `1px solid ${C.accent}44`, borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Edit
                        </button>
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
                    <td style={{ padding: "7px 10px" }}>{log.user_email?.split("@")[0] || "—"}</td>
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
                <label style={{ fontSize: 11, color: C.sub, textTransform: "uppercase", letterSpacing: ".05em", display: "block", marginBottom: 6 }}>Full Name</label>
                <input id="name-input" defaultValue={editUser.full_name || ""}
                  style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 12px", color: C.text, fontSize: 14, width: "100%", outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setEditUser(null)}
                  style={{ flex: 1, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px", color: C.sub, cursor: "pointer", fontWeight: 600 }}>
                  Cancel
                </button>
                <button onClick={() => updateUser(editUser.id, {
                  subscription_tier: document.getElementById("tier-select").value,
                  full_name: document.getElementById("name-input").value,
                })}
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
