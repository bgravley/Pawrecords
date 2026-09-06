#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / 'src/App.jsx').read_text(encoding='utf-8', errors='ignore')
paw = (ROOT / 'src/PawRecord.jsx').read_text(encoding='utf-8', errors='ignore')
travel = (ROOT / 'src/Travel.jsx').read_text(encoding='utf-8', errors='ignore')
ai_travel = (ROOT / 'api/ai-travel.js').read_text(encoding='utf-8', errors='ignore')

checks = []
def check(name, ok):
    checks.append((name, bool(ok)))

# Free users must get useful core product value before an upgrade decision.
check('New trip creation remains available without a premium conditional',
      '<Btn onClick={() => setShowNew(true)}' in travel)
check('Free travel users can add requirements manually',
      'You can build the requirements checklist yourself for free.' in travel and
      '<Btn v="secondary" onClick={() => setShowAddItem(true)}>+ Add Requirement Manually</Btn>' in travel)
check('Trip is saved before the AI upgrade boundary is presented',
      'Your trip is saved' in travel)
check('Travel receives the authenticated profile tier from App',
      "tier={profile?.subscription_tier || 'free'}" in app)
check('Free AI travel clicks are intercepted before generation begins',
      'const generateRequirements = async () => {\n    if (!premium)' in travel and
      travel.index('if (!premium)') < travel.index('setGenerating(true); setGenError(null);'))
check('Free travel AI CTA routes to existing upgrade surface rather than checkout',
      'onUpgrade={() => {' in app and 'setShowTravel(false);' in app and 'setUpgradeRequestKey(key => key + 1);' in app and
      '✨ See Premium AI Options' in travel)
check('Travel does not duplicate checkout pricing for the AI premium boundary',
      'See Premium AI Options' in travel and 'onClick={onUpgrade}' in travel)
check('Backend AI travel premium enforcement remains intact',
      "if (!isPremium)" in ai_travel and 'requiresUpgrade: true' in ai_travel)

# Health records should state what stays free, not imply the user's record is
# held hostage by a locked add-on.
check('Generic health paywall states core record stays free',
      'Your core pet health record stays free.' in paw)
check('Vaccine recording is explicitly described as remaining free',
      'Keep recording vaccines for free.' in paw)
check('Manual health records remain free when document storage is locked',
      'Your manually entered health records stay free.' in paw)
check('Premium lock CTA is informational rather than an immediate purchase verb',
      'See Premium Options' in paw and '> Upgrade Now</Btn>' not in paw)
check('Travel upgrade handoff opens only after an explicit request key',
      'if(upgradeRequestKey>0)setShowUpgrade(true);' in paw)

# Keep the existing free record actions available. These are important
# assertions because a future refactor should not accidentally put the first
# pet/vaccine interaction behind the premium state.
check('Add Pet remains a core action', 'Add Your First Pet' in paw or '>Add Pet<' in paw)
check('Vaccination form remains available independently of premium schedule',
      'VaccineForm dogId={dog.id}' in paw and 'premium?<SchedulePanel' in paw)
check('Saved vets remain outside premium lock',
      'if(section==="vets")' in paw and 'Find Nearby Vets' in paw)

failed = [name for name, ok in checks if not ok]
for name, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'}: {name}")

print(f"\nValue-first paywall audit: {len(checks)-len(failed)}/{len(checks)} checks passed")
if failed:
    print('Failures:')
    for name in failed:
        print(f'- {name}')
    raise SystemExit(1)
