// src/AffiliatePortal.jsx
// Shown when a logged-in user is an affiliate.
// Uses Supabase RLS — only returns data for their own affiliate account.
// They never see admin data, other affiliates, or user management.

import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

const C = {
  bg: '#FAF6F0', card: '#FFFFFF', border: '#E8DDD0',
  teal: '#2D7D6F', tealDk: '#1E5C52', tealLt: '#4A9E90',
  brown: '#5A4535', muted: '#8B7355', text: '#2C2017',
  amber: '#E8A838', red: '#C4714A', green: '#2D7D6F',
  light: '#F4EFE8',
};

const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const money = (cents) => `$${(Math.abs(cents || 0) / 100).toFixed(2)}`;

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Lora', serif", fontSize: 26, fontWeight: 600, color: color || C.teal, marginBottom: sub ? 4 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted }}>{sub}</div>}
    </div>
  );
}

export default function AffiliatePortal({ userId, userEmail, onClose }) {
  const [affiliate, setAffiliate] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [monthFilter, setMonthFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load this affiliate's record (RLS ensures only their own).
      // .limit(1).maybeSingle() instead of .single() -- won't error if this
      // ever matches zero or more than one row (a duplicate-affiliate-row
      // bug hit exactly this pattern elsewhere in the app; this stays
      // resilient even though a DB constraint now prevents it at the source).
      const { data: aff } = await supabase.from('affiliates').select('*').eq('user_id', userId).limit(1).maybeSingle();
      if (!aff) { setLoading(false); return; }
      setAffiliate(aff);

      // Load their commissions (RLS ensures only their own)
      const { data: comms } = await supabase
        .from('affiliate_commissions')
        .select('*')
        .eq('affiliate_id', aff.id)
        .order('created_at', { ascending: false });
      setCommissions(comms || []);
    } catch (e) {
      console.error('Affiliate portal load error:', e);
    }
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: 20, color: C.teal }}>Loading your dashboard...</div>
    </div>
  );

  if (!affiliate) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 22, marginBottom: 8 }}>No affiliate account found</div>
        <div style={{ color: C.muted, fontSize: 14 }}>Contact Brandon at bgravley@rdmarketingllc.com to get set up.</div>
      </div>
    </div>
  );

  const referralUrl = `https://yourpetpass.com?ref=${affiliate.referral_code}`;

  // Sales = positive entries
  const sales = commissions.filter(c => c.status !== 'refund' && (c.commission_amount_cents || 0) > 0);
  // Refunds = negative entries
  const refunds = commissions.filter(c => c.status === 'refund');

  const grossCommission = sales.reduce((s, c) => s + (c.commission_amount_cents || 0), 0);
  const totalRefundback = refunds.reduce((s, c) => s + Math.abs(c.commission_amount_cents || 0), 0);
  const netCommission = grossCommission - totalRefundback;
  const pendingPayout = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission_amount_cents || 0), 0);
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission_amount_cents || 0), 0);

  // This month
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthSales = sales.filter(c => (c.period_month || '').startsWith(thisMonth));
  const thisMonthRefunds = refunds.filter(c => (c.period_month || '').startsWith(thisMonth));
  const thisMonthNet = thisMonthSales.reduce((s, c) => s + (c.commission_amount_cents || 0), 0)
    - thisMonthRefunds.reduce((s, c) => s + Math.abs(c.commission_amount_cents || 0), 0);

  // Monthly breakdown
  const months = [...new Set(commissions.map(c => c.period_month).filter(Boolean))].sort().reverse();

  // Filter commissions for display
  const filtered = monthFilter === 'all' ? commissions : commissions.filter(c => c.period_month === monthFilter);

  const inp = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
    border: `1.5px solid ${C.border}`, background: C.bg, color: C.text,
    outline: 'none', fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Nunito', sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.tealDk, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <img src="/logo_horizontal_cream_transparent.png" alt="YourPetPass" style={{ height: 34, display: "block" }} />
          <div style={{ fontSize: 13, color: '#A8D5CE', marginTop: 4 }}>Affiliate Partner Dashboard</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Back to App
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 24, color: C.text, marginBottom: 4 }}>Welcome back 👋</div>
          <div style={{ fontSize: 14, color: C.muted }}>
            Your referral code: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.teal, background: `${C.teal}14`, padding: '2px 8px', borderRadius: 6 }}>{affiliate.referral_code}</span>
            &nbsp;·&nbsp; {affiliate.commission_rate}% commission &nbsp;·&nbsp;
            <span style={{ color: affiliate.status === 'active' ? C.green : C.amber, fontWeight: 600 }}>{affiliate.status?.toUpperCase()}</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard label="This Month (Net)" value={money(thisMonthNet)} sub={`${thisMonthSales.length} sales · ${thisMonthRefunds.length} refunds`} color={thisMonthNet >= 0 ? C.green : C.red}/>
          <StatCard label="Pending Payout" value={money(pendingPayout)} sub="Not yet paid" color={C.amber}/>
          <StatCard label="All-Time Earned (Net)" value={money(netCommission)} sub={`${sales.length} sales · ${refunds.length} refunds`}/>
          <StatCard label="Total Paid to You" value={money(totalPaid)} sub="Confirmed payments" color={C.green}/>
        </div>

        {/* Referral Link */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Your Referral Link</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>
            Share this link anywhere. Every new user who signs up through it is tracked to you permanently.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.teal, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {referralUrl}
            </div>
            <button onClick={copyLink} style={{ background: copied ? C.tealDk : C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer', flexShrink: 0, fontFamily: "'Nunito', sans-serif" }}>
              {copied ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>
            💡 When someone visits this link and creates an account, you earn {affiliate.commission_rate}% of every payment they make — monthly, annual, or lifetime — forever.
          </div>
        </div>

        {/* Monthly Breakdown */}
        {months.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Monthly Summary</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.muted }}>
                    {['Month', 'Sales', 'Gross Earned', 'Refunds', 'Clawback', 'Net Earned', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map(month => {
                    const mSales = commissions.filter(c => c.period_month === month && c.status !== 'refund' && (c.commission_amount_cents||0) > 0);
                    const mRefunds = commissions.filter(c => c.period_month === month && c.status === 'refund');
                    const mGross = mSales.reduce((s, c) => s + (c.commission_amount_cents||0), 0);
                    const mClawback = mRefunds.reduce((s, c) => s + Math.abs(c.commission_amount_cents||0), 0);
                    const mNet = mGross - mClawback;
                    const mPaid = mSales.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission_amount_cents||0), 0);
                    const allPaid = mPaid === mGross && mGross > 0;
                    return (
                      <tr key={month} style={{ borderTop: `1px solid ${C.border}20` }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{month}</td>
                        <td style={{ padding: '10px 12px' }}>{mSales.length}</td>
                        <td style={{ padding: '10px 12px', color: C.green, fontWeight: 600 }}>{money(mGross)}</td>
                        <td style={{ padding: '10px 12px' }}>{mRefunds.length}</td>
                        <td style={{ padding: '10px 12px', color: mClawback > 0 ? C.red : C.muted }}>{mClawback > 0 ? `-${money(mClawback)}` : '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: mNet >= 0 ? C.green : C.red }}>{money(mNet)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: allPaid ? `${C.green}22` : `${C.amber}22`, color: allPaid ? C.green : C.amber, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                            {allPaid ? 'PAID' : 'PENDING'}
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

        {/* Transaction Ledger */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Transaction Ledger</div>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, color: C.text, cursor: 'pointer' }}>
              <option value="all">All time</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: C.muted }}>No transactions yet. Share your referral link to get started!</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: C.muted }}>
                    {['Date', 'Month', 'Sale Amount', 'Your Rate', 'Your Commission', 'Type', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const isRefund = c.status === 'refund';
                    const rowColor = isRefund ? C.red : (c.status === 'paid' ? C.green : C.text);
                    return (
                      <tr key={c.id} style={{ borderTop: `1px solid ${C.border}20`, background: isRefund ? `${C.red}06` : 'transparent' }}>
                        <td style={{ padding: '8px 12px', color: C.muted }}>{fmt(c.created_at?.slice(0,10))}</td>
                        <td style={{ padding: '8px 12px', color: C.muted }}>{c.period_month || '—'}</td>
                        <td style={{ padding: '8px 12px', color: isRefund ? C.red : C.text }}>
                          {isRefund ? '-' : ''}{money(c.payment_amount_cents)}
                        </td>
                        <td style={{ padding: '8px 12px', color: C.muted }}>{c.commission_rate}%</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: rowColor }}>
                          {isRefund ? '-' : '+'}{money(c.commission_amount_cents)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: isRefund ? `${C.red}14` : `${C.teal}14`, color: isRefund ? C.red : C.teal, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                            {isRefund ? 'REFUND' : 'SALE'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            background: c.status === 'paid' ? `${C.green}22` : c.status === 'refund' ? `${C.red}14` : `${C.amber}22`,
                            color: c.status === 'paid' ? C.green : c.status === 'refund' ? C.red : C.amber,
                            borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700
                          }}>
                            {c.status === 'paid' ? `PAID${c.payout_method ? ' via ' + c.payout_method.toUpperCase() : ''}` : c.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payout Info */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Payouts</div>
          <div style={{ fontSize: 13, color: C.muted }}>
            We'll reach out directly to arrange payment once you have a balance to pay out — no need to enter anything here yet.
          </div>
        </div>

      </div>
    </div>
  );
}
