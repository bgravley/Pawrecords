#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


def apply_brand(text):
    text = text.replace(
        "family=Lora:ital,wght@0,400;0,600;1,400&family=Nunito:wght@400;600;700&display=swap",
        "family=Lora:wght@400;600&family=Playfair+Display:wght@700;800&display=swap",
    )
    for old, new in [
        ("#2D7D6F", "#2C4A38"),
        ("#1E5C52", "#1A2E22"),
        ("#FAF6F0", "#FAFCFB"),
        ("#5A4535", "#1A2E22"),
        ("#8B7355", "#5C7464"),
        ("#E8DDD0", "#DCE8E0"),
        ("#2C2017", "#1A2E22"),
        ("#E8A838", "#C9A84C"),
        ("#A8D5CE", "#C9A84C"),
        ("#C8E8E4", "#EAF4EE"),
    ]:
        text = text.replace(old, new)
    text = text.replace("font-family: 'Nunito', sans-serif", "font-family: 'Lora', serif")
    text = text.replace("header a { font-family: 'Lora', serif", "header a { font-family: 'Playfair Display', serif")
    text = text.replace(".hero h1 { font-family: 'Lora', serif", ".hero h1 { font-family: 'Playfair Display', serif")
    text = text.replace("h2 { font-family: 'Lora', serif", "h2 { font-family: 'Playfair Display', serif")
    text = text.replace(".card h2 { font-family: 'Lora', serif", ".card h2 { font-family: 'Playfair Display', serif")
    return text

# Terms
p = Path("public/terms.html")
t = apply_brand(p.read_text(encoding="utf-8"))
t = replace_once(t,
    "Effective Date: June 21, 2026 &nbsp;·&nbsp; Last Updated: June 21, 2026",
    "Effective Date: June 21, 2026 &nbsp;·&nbsp; Last Updated: September 7, 2026",
    "terms date")
t = replace_once(t,
    "<strong>The short version:</strong> Use YourPetPass to manage your pet's health records and travel documents responsibly. Don't misuse the platform, don't rely solely on our AI-generated travel checklists for legal compliance, and pay for the plan you choose. We'll keep the service running and your data safe.",
    "<strong>The short version:</strong> Use YourPetPass to manage your pet's health records and travel documents responsibly. Don't misuse the platform, don't rely solely on AI-generated travel checklists for legal compliance, and pay for the plan you choose. We use the safeguards described in our Privacy Policy, but no online service can promise uninterrupted operation or absolute security.",
    "terms short version")
t = replace_once(t,
    "<p>The QR Health Card feature generates a publicly accessible page containing your pet's basic health information for emergency use. You control whether this feature is enabled for each pet and are responsible for the information you choose to make publicly accessible through it.</p>",
    "<p>The Emergency QR feature creates a tokenized, no-login emergency page for a pet. It is not a public pet directory. You control whether the feature is enabled and which supported emergency fields are shared. The Emergency QR does not expose the pet's full medical record or private uploaded documents. Anyone who has the QR code or its associated link may be able to view the fields you chose to share, so you are responsible for those choices.</p>",
    "terms emergency QR")
t = replace_once(t,
    "<section>\n      <h2>8. Intellectual Property</h2>\n      <p>The Service, including its design, software, and branding, is owned by RD Marketing LLC. You retain ownership of your pet's health records and the content you upload, as described in our Privacy Policy.</p>\n    </section>",
    "<section>\n      <h2>8. Intellectual Property</h2>\n      <p>The Service, including its design, software, and branding, is owned by RD Marketing LLC or its licensors. You retain ownership of your pet's health records and other content you upload.</p>\n      <p>You grant RD Marketing LLC a limited, non-exclusive license to host, store, process, reproduce, and display your uploaded content only as reasonably necessary to provide, secure, support, and improve the Service as described in our Privacy Policy. You represent that you have the rights needed to upload and use that content through the Service.</p>\n    </section>\n\n    <section>\n      <h2>9. Copyright Complaints</h2>\n      <p>If you believe material made available through YourPetPass infringes your copyright, follow the notice process on our <a href=\"/copyright.html\" style=\"color:var(--teal);\">Copyright Complaints page</a>. We may remove or restrict access to material when appropriate under applicable law and may address repeat infringement or abuse of the Service.</p>\n    </section>",
    "terms IP and copyright")
for old, new in [
    ("<h2>9. Disclaimer of Warranties</h2>", "<h2>10. Disclaimer of Warranties</h2>"),
    ("<h2>10. Limitation of Liability</h2>", "<h2>11. Limitation of Liability</h2>"),
    ("<h2>11. Termination</h2>", "<h2>12. Termination</h2>"),
    ("<h2>12. Changes to These Terms</h2>", "<h2>13. Changes to These Terms</h2>"),
    ("<h2>13. Governing Law</h2>", "<h2>14. Governing Law</h2>"),
]:
    t = replace_once(t, old, new, f"terms renumber {old}")
t = replace_once(t,
    "<p><a href=\"/contact.html\" style=\"color:#fff;\">yourpetpass.com/contact.html</a></p>",
    "<p><a href=\"/contact.html\" style=\"color:#fff;\">yourpetpass.com/contact.html</a></p>\n      <p style=\"margin-top:6px;font-size:14px;\"><a href=\"/ai-policy.html\" style=\"color:#fff;\">AI &amp; Source Policy</a> · <a href=\"/copyright.html\" style=\"color:#fff;\">Copyright Complaints</a></p>",
    "terms contact links")
t = replace_once(t,
    "<a href=\"https://yourpetpass.com\" style=\"color:var(--muted);\">yourpetpass.com</a>\n  </footer>",
    "<a href=\"https://yourpetpass.com\" style=\"color:var(--muted);\">yourpetpass.com</a> &nbsp;·&nbsp;\n    <a href=\"/privacy.html\" style=\"color:var(--muted);\">Privacy</a> &nbsp;·&nbsp;\n    <a href=\"/ai-policy.html\" style=\"color:var(--muted);\">AI &amp; Sources</a> &nbsp;·&nbsp;\n    <a href=\"/copyright.html\" style=\"color:var(--muted);\">Copyright</a> &nbsp;·&nbsp;\n    <a href=\"/contact.html\" style=\"color:var(--muted);\">Contact</a>\n  </footer>",
    "terms footer")
p.write_text(t, encoding="utf-8")

# Privacy
p = Path("public/privacy.html")
t = apply_brand(p.read_text(encoding="utf-8"))
t = replace_once(t,
    "Effective Date: June 7, 2026 &nbsp;·&nbsp; Last Updated: September 6, 2026",
    "Effective Date: June 7, 2026 &nbsp;·&nbsp; Last Updated: September 7, 2026",
    "privacy date")
t = replace_once(t,
    "We protect your data with industry-standard security and do not sell your name, email, or pet records to third parties.",
    "We use security safeguards described below and do not sell your name, email, or pet records to third parties.",
    "privacy short security claim")
t = replace_once(t,
    "<li><strong>OpenAI</strong> — AI document scanning and travel checklist generation</li>",
    "<li><strong>OpenAI</strong> — AI document scanning and travel checklist research/generation</li>\n        <li><strong>Anthropic</strong> — secondary AI review of generated travel checklist output</li>",
    "privacy AI providers")
t = replace_once(t,
    "<p><strong>Public emergency profile:</strong> If you generate a QR Health Card for a pet, that pet's basic health information (allergies, emergency contact, vaccination status) will be accessible to anyone who scans the QR code or visits the associated link, without requiring a login. You control whether this feature is active.</p>",
    "<p><strong>Emergency QR page:</strong> If you enable an Emergency QR for a pet, YourPetPass creates a high-entropy, tokenized link that does not require login. It is not a public pet directory. Only the supported emergency fields you choose to share are returned; the full medical record and private uploaded documents are not exposed through the Emergency QR. Anyone who has the QR code or associated link may be able to view the fields you enabled.</p>",
    "privacy emergency QR")
t = replace_once(t,
    "<li><strong>Delete your account</strong> by contacting us at <a href=\"/contact.html\" style=\"color:var(--teal);\">our contact page</a> — we will permanently delete your account and associated data within 30 days</li>",
    "<li><strong>Request account deletion</strong> through <a href=\"/contact.html\" style=\"color:var(--teal);\">our contact page</a>. We remove account-linked pet records and other user-owned content as described in the Data Retention section below.</li>",
    "privacy account deletion")
t = replace_once(t,
    "<p>We retain your account and pet health data for as long as your account is active. If you delete your account, we will permanently remove your data within 30 days, except where we are required by law to retain certain records for a longer period.</p>\n      <p>Anonymized, aggregated usage data may be retained indefinitely for analytics and product improvement purposes.</p>",
    "<p>We retain your account and pet health data for as long as your account is active. After an account-deletion request is completed, account-linked pet records and other user-owned content are removed, subject to limited backups, fraud/security needs, payment or legal recordkeeping, and other retention required by law.</p>\n      <p>Operational records such as activity, error, abuse-prevention, or AI-usage logs may be retained in de-identified or account-disassociated form where reasonably needed for security, reliability, accounting, analytics, or legal compliance. Aggregated or de-identified information may be retained for product improvement and research.</p>",
    "privacy retention")
t = replace_once(t,
    "<h2>10. Children's Privacy</h2>\n      <p>YourPetPass is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.</p>",
    "<h2>10. Children's Privacy</h2>\n      <p>Accounts are intended for adults who are at least 18 years old, or the age of majority in their jurisdiction, consistent with our Terms of Service. The Service is not directed to children. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can address it.</p>",
    "privacy children")
t = replace_once(t,
    "<p><a href=\"/contact.html\" style=\"color:#fff;\">yourpetpass.com/contact.html</a></p>",
    "<p><a href=\"/contact.html\" style=\"color:#fff;\">yourpetpass.com/contact.html</a></p>\n      <p style=\"margin-top:6px;font-size:14px;\"><a href=\"/ai-policy.html\" style=\"color:#fff;\">AI &amp; Source Policy</a> · <a href=\"/copyright.html\" style=\"color:#fff;\">Copyright Complaints</a></p>",
    "privacy contact links")
t = replace_once(t,
    "<a href=\"/terms.html\" style=\"color:var(--muted);\">Terms</a>\n    &nbsp;·&nbsp;\n    <a href=\"/contact.html\" style=\"color:var(--muted);\">Contact</a>",
    "<a href=\"/terms.html\" style=\"color:var(--muted);\">Terms</a>\n    &nbsp;·&nbsp;\n    <a href=\"/ai-policy.html\" style=\"color:var(--muted);\">AI &amp; Sources</a>\n    &nbsp;·&nbsp;\n    <a href=\"/copyright.html\" style=\"color:var(--muted);\">Copyright</a>\n    &nbsp;·&nbsp;\n    <a href=\"/contact.html\" style=\"color:var(--muted);\">Contact</a>",
    "privacy footer")
p.write_text(t, encoding="utf-8")

# Contact/support
p = Path("public/contact.html")
t = apply_brand(p.read_text(encoding="utf-8"))
t = replace_once(t,
    "placeholder=\"Billing question, bug report, etc.\"",
    "placeholder=\"Billing question, bug report, copyright complaint, etc.\"",
    "contact subject placeholder")
t = replace_once(t,
    "To update your payment method, change plans, or cancel a subscription, sign in and go to <strong>My Account → Billing → Manage Subscription</strong>. This takes you to a secure Stripe-hosted page where you have full control over your plan.",
    "To update your payment method, view invoices, or cancel a subscription, sign in and go to <strong>My Account → Billing → Manage Subscription</strong>. This opens Stripe's secure customer portal for the billing actions currently available on your account.",
    "contact billing card")
t = replace_once(t,
    "Sign in → tap your profile icon → Billing → \"Manage Subscription / Cancel.\" You'll be taken to Stripe's secure portal where you can cancel anytime — no charge for the remainder of your current billing period.",
    "Sign in → tap your profile icon → Billing → \"Manage Subscription / Cancel.\" Stripe's secure portal lets you cancel renewal. You keep access through the end of the billing period you've already paid for, and the subscription will not renew after cancellation takes effect.",
    "contact cancellation FAQ")
t = replace_once(t,
    "<p>Scan the QR code on their tag, or visit the sign-in page and tap \"Emergency Pet Lookup\" — no account required.</p>",
    "<p>If the pet has a YourPetPass Emergency QR, scan that code to open the tokenized emergency page — no account is required. YourPetPass does not provide a public pet directory or name-based emergency lookup.</p>",
    "contact lost pet FAQ")
needle = """      <div class=\"faq-item\">\n        <h3>I found a lost pet — how do I see their info?</h3>\n        <p>If the pet has a YourPetPass Emergency QR, scan that code to open the tokenized emergency page — no account is required. YourPetPass does not provide a public pet directory or name-based emergency lookup.</p>\n      </div>"""
insert = needle + """\n      <div class=\"faq-item\">\n        <h3>How do I send a copyright or legal notice?</h3>\n        <p>Use the form above and clearly identify the subject. For copyright complaints and counter-notices, see our <a class=\"link\" href=\"/copyright.html\">Copyright Complaints page</a> for the information to include.</p>\n      </div>"""
t = replace_once(t, needle, insert, "contact copyright FAQ")
t = replace_once(t,
    "<a href=\"/terms.html\" style=\"color:var(--muted);\">Terms</a>\n  </footer>",
    "<a href=\"/terms.html\" style=\"color:var(--muted);\">Terms</a>\n    &nbsp;·&nbsp;\n    <a href=\"/ai-policy.html\" style=\"color:var(--muted);\">AI &amp; Sources</a>\n    &nbsp;·&nbsp;\n    <a href=\"/copyright.html\" style=\"color:var(--muted);\">Copyright</a>\n  </footer>",
    "contact footer")
p.write_text(t, encoding="utf-8")

print("Applied legal/admin launch hygiene updates to Terms, Privacy, and Contact.")
