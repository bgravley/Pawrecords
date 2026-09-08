#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(path, old, new, label):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count == 0 and new in text:
        print(f'already updated {path}: {label}')
        return False
    if count != 1:
        raise SystemExit(f'{path} {label}: expected exactly one old match, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'updated {path}: {label}')
    return True

changed = False
changed |= replace_exact(
    'src/AffiliatePortal.jsx',
    'Share this link anywhere. Every new user who signs up through it is tracked to you permanently.',
    'Share this link anywhere. When a new user signs up through it, their referral is associated with your affiliate account.',
    'referral association wording',
)
changed |= replace_exact(
    'src/AffiliatePortal.jsx',
    '💡 When someone visits this link and creates an account, you earn {affiliate.commission_rate}% of every payment they make — monthly, annual, or lifetime — forever.',
    'For eligible payments made while your affiliate account is active, you earn {affiliate.commission_rate}% of the payment amount after Stripe processing fees. Refunds can reduce previously earned commission.',
    'commission basis and duration disclosure',
)
changed |= replace_exact(
    'src/AffiliatePortal.jsx',
    "{['Date', 'Month', 'Sale Amount', 'Your Rate', 'Your Commission', 'Type', 'Status'].map(h => (",
    "{['Date', 'Month', 'Customer Payment', 'Your Rate', 'Your Commission', 'Type', 'Status'].map(h => (",
    'ledger gross payment label',
)
changed |= replace_exact(
    'src/AffiliatePortal.jsx',
    "{isRefund ? '-' : ''}{money(c.payment_amount_cents)}",
    "{isRefund ? '-' : ''}{money(c.gross_amount_cents)}",
    'ledger displays gross customer charge/refund',
)
changed |= replace_exact(
    'src/AffiliatePortal.jsx',
    "{isRefund ? '-' : ''}{money(c.gross_amount_cents)}",
    "{isRefund ? '-' : ''}{money(c.gross_amount_cents ?? c.payment_amount_cents)}",
    'ledger preserves older rows without stored gross amount',
)
changed |= replace_exact(
    'src/AffiliatePortal.jsx',
    '<div style={{ fontWeight: 700, fontSize: 16 }}>Transaction Ledger</div>',
    '<div><div style={{ fontWeight: 700, fontSize: 16 }}>Transaction Ledger</div><div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Customer Payment shows the gross charge or refund. Your commission is calculated from the eligible payment amount after Stripe processing fees.</div></div>',
    'ledger calculation disclosure',
)
changed |= replace_exact(
    'api/notify-affiliate.js',
    '${esc(rateLabel)} of eligible payments',
    '${esc(rateLabel)} of eligible net payments',
    'welcome email commission basis label',
)
changed |= replace_exact(
    'api/notify-affiliate.js',
    '<p style="line-height:1.7;margin-top:18px;">Share this link with your audience. Log in with this email to view your affiliate dashboard and referral activity.</p>',
    '<p style="line-height:1.7;margin-top:18px;">Share this link with your audience. Log in with this email to view your affiliate dashboard and referral activity.</p>\n      <p style="line-height:1.7;font-size:13px;color:#7C9E87;">Commission is calculated from eligible payment proceeds after Stripe processing fees. Refunds can reduce commission, and new commissions are recorded while your affiliate account remains active.</p>',
    'welcome email calculation and active-status disclosure',
)

print('affiliate disclosure patch complete' if changed else 'affiliate disclosures already current')
