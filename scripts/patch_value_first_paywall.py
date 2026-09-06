#!/usr/bin/env python3
from pathlib import Path


def once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)

# App owns the transition from Travel back to the existing upgrade modal so
# Travel does not duplicate checkout code or create a second billing surface.
app_path = Path('src/App.jsx')
app = app_path.read_text(encoding='utf-8')
app = once(app,
    '  const [isAffiliate, setIsAffiliate] = useState(false);',
    '  const [isAffiliate, setIsAffiliate] = useState(false);\n  const [upgradeRequestKey, setUpgradeRequestKey] = useState(0);',
    'App upgrade request state')
app = once(app,
    '    return <Travel userId={session.user.id} onBack={() => setShowTravel(false)} />;',
    '    return <Travel\n      userId={session.user.id}\n      tier={profile?.subscription_tier || \'free\'}\n      onUpgrade={() => {\n        setShowTravel(false);\n        setUpgradeRequestKey(key => key + 1);\n      }}\n      onBack={() => setShowTravel(false)}\n    />;',
    'Travel value-first props')
app = once(app,
    '          onOpenAffiliate={() => setShowAffiliatePortal(true)}\n        />',
    '          onOpenAffiliate={() => setShowAffiliatePortal(true)}\n          upgradeRequestKey={upgradeRequestKey}\n        />',
    'YourPetPass upgrade request prop')
app_path.write_text(app, encoding='utf-8')

# Health locks should make the free value explicit rather than implying the
# user's existing health record is blocked.
paw_path = Path('src/PawRecord.jsx')
paw = paw_path.read_text(encoding='utf-8')
paw = once(paw,
    'const PremiumLock=({onUpgrade,label="Premium Feature"})=>(\n  <div style={{background:"#C9A84C10",border:"1px solid #C9A84C44",borderRadius:12,padding:16,textAlign:"center"}}>\n    <Ic n="crown" s={24} c="#C9A84C"/>\n    <div style={{fontWeight:600,marginTop:8,marginBottom:4}}>{label}</div>\n    <div style={{color:"#385744",fontSize:13,marginBottom:12}}>Upgrade to Premium to unlock this feature</div>\n    <Btn onClick={onUpgrade} style={{margin:"0 auto",background:"#C9A84C",color:"#FAFCFB"}}><Ic n="crown" s={14} c="#FAFCFB"/> Upgrade Now</Btn>\n  </div>\n);',
    'const PremiumLock=({onUpgrade,label="Premium Feature",detail="Your core pet health record stays free. Premium adds this extra tool when you need it."})=>(\n  <div style={{background:"#C9A84C10",border:"1px solid #C9A84C44",borderRadius:12,padding:16,textAlign:"center"}}>\n    <Ic n="crown" s={24} c="#C9A84C"/>\n    <div style={{fontWeight:600,marginTop:8,marginBottom:4}}>{label}</div>\n    <div style={{color:"#385744",fontSize:13,lineHeight:1.55,marginBottom:12}}>{detail}</div>\n    <Btn onClick={onUpgrade} style={{margin:"0 auto",background:"#C9A84C",color:"#FAFCFB"}}><Ic n="crown" s={14} c="#FAFCFB"/> See Premium Options</Btn>\n  </div>\n);',
    'value-first PremiumLock')
paw = paw.replace(
    '<PremiumLock onUpgrade={onUpgrade} label="Vaccine Schedule — Premium Feature"/>',
    '<PremiumLock onUpgrade={onUpgrade} label="Vaccine Schedule — Premium Feature" detail="Keep recording vaccines for free. Premium adds due-date schedule guidance and proactive tracking."/>'
)
paw = paw.replace(
    '<PremiumLock onUpgrade={onUpgrade} label="Weight Tracking — Premium Feature"/>',
    '<PremiumLock onUpgrade={onUpgrade} label="Weight Tracking — Premium Feature" detail="Your core health history stays free. Premium adds weight logging and trend charts over time."/>'
)
paw = paw.replace(
    '<PremiumLock onUpgrade={onUpgrade} label="Document Storage — Premium Feature"/>',
    '<PremiumLock onUpgrade={onUpgrade} label="Document Storage — Premium Feature" detail="Your manually entered health records stay free. Premium adds private document storage and AI document scanning."/>'
)
paw = paw.replace(
    '<PremiumLock onUpgrade={onUpgrade} label="QR Health Card — Premium Feature"/>',
    '<PremiumLock onUpgrade={onUpgrade} label="QR Health Card — Premium Feature" detail="Your pet\'s health history stays available in the app. Premium adds a shareable emergency QR health card."/>'
)
paw = once(paw,
    'const Home=({state,dispatch,userId,tier,userEmail,onSignOut,isAdmin,onOpenAdmin,onOpenTravel,isAffiliate,onOpenAffiliate})=>{',
    'const Home=({state,dispatch,userId,tier,userEmail,onSignOut,isAdmin,onOpenAdmin,onOpenTravel,isAffiliate,onOpenAffiliate,upgradeRequestKey})=>{',
    'Home upgrade request prop')
paw = once(paw,
    '  const[errorCount,setErrorCount]=useState(0);\n  const[upcomingTrips,setUpcomingTrips]=useState([]);',
    '  const[errorCount,setErrorCount]=useState(0);\n  const[upcomingTrips,setUpcomingTrips]=useState([]);\n\n  useEffect(()=>{\n    if(upgradeRequestKey>0)setShowUpgrade(true);\n  },[upgradeRequestKey]);',
    'Home upgrade request effect')
paw = once(paw,
    'export default function YourPetPass({userId,profile,onSignOut,isAdmin,isAffiliate,onOpenAdmin,onOpenTravel,onOpenAffiliate}){',
    'export default function YourPetPass({userId,profile,onSignOut,isAdmin,isAffiliate,onOpenAdmin,onOpenTravel,onOpenAffiliate,upgradeRequestKey=0}){',
    'YourPetPass upgrade request signature')
paw = once(paw,
    'onOpenAdmin={onOpenAdmin} onOpenTravel={onOpenTravel} onOpenAffiliate={onOpenAffiliate}/>',
    'onOpenAdmin={onOpenAdmin} onOpenTravel={onOpenTravel} onOpenAffiliate={onOpenAffiliate} upgradeRequestKey={upgradeRequestKey}/>',
    'Home invocation upgrade request')
paw_path.write_text(paw, encoding='utf-8')

# Travel remains useful for free accounts: create and save the trip, keep its
# itinerary, and add requirements manually. AI research is clearly identified
# as Premium before any AI request is made.
travel_path = Path('src/Travel.jsx')
travel = travel_path.read_text(encoding='utf-8')
travel = once(travel,
    'const TripDetail = ({ trip, userId, dogs, onBack, onUpdate, onDelete, onEdit, onDuplicate }) => {',
    'const TripDetail = ({ trip, userId, dogs, premium, onUpgrade, onBack, onUpdate, onDelete, onEdit, onDuplicate }) => {',
    'TripDetail premium props')
travel = once(travel,
    '  const generateRequirements = async () => {\n    setGenerating(true); setGenError(null);',
    '  const generateRequirements = async () => {\n    if (!premium) {\n      onUpgrade?.();\n      return;\n    }\n    setGenerating(true); setGenError(null);',
    'AI request premium guard')
travel = once(travel,
    '              {checklist.length === 0 && (\n                <Btn sm onClick={generateRequirements} disabled={generating} style={{ background: C.warn, color: "#2C2017" }}>\n                  {generating ? "Researching..." : "🤖 AI Generate"}\n                </Btn>\n              )}',
    '              {checklist.length === 0 && (\n                premium\n                  ? <Btn sm onClick={generateRequirements} disabled={generating} style={{ background: C.warn, color: "#2C2017" }}>\n                      {generating ? "Researching..." : "🤖 AI Generate"}\n                    </Btn>\n                  : <Btn sm onClick={onUpgrade} style={{ background: C.warnDim, color: C.text, border: `1px solid ${C.warn}66` }}>\n                      ✨ Premium AI\n                    </Btn>\n              )}',
    'requirements header AI gate')
travel = once(travel,
    '          {!generating && checklist.length === 0 && (\n            <Card style={{ textAlign: "center", padding: 32, borderStyle: "dashed" }}>\n              <div style={{ fontSize: 36, marginBottom: 12 }}>🛂</div>\n              <div style={{ fontFamily: "\'Lora\', serif", fontSize: 18, marginBottom: 6 }}>No requirements yet</div>\n              <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>Let AI research the requirements for this route, or add them manually</div>\n              <Btn onClick={generateRequirements} style={{ margin: "0 auto", background: C.warn, color: "#2C2017" }}>🤖 Generate Requirements with AI</Btn>\n            </Card>\n          )}',
    '          {!generating && checklist.length === 0 && (\n            <Card style={{ textAlign: "center", padding: 32, borderStyle: "dashed" }}>\n              <div style={{ fontSize: 36, marginBottom: 12 }}>🛂</div>\n              <div style={{ fontFamily: "\'Lora\', serif", fontSize: 18, marginBottom: 6 }}>Your trip is saved</div>\n              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>\n                {premium\n                  ? "Let AI research official requirements for this route, or build the checklist yourself."\n                  : "You can build the requirements checklist yourself for free. Premium adds AI research that turns the route into a starting checklist for you."}\n              </div>\n              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>\n                <Btn v="secondary" onClick={() => setShowAddItem(true)}>+ Add Requirement Manually</Btn>\n                {premium\n                  ? <Btn onClick={generateRequirements} style={{ background: C.warn, color: "#2C2017" }}>🤖 Generate with AI</Btn>\n                  : <Btn onClick={onUpgrade} style={{ background: C.warn, color: "#2C2017" }}>✨ See Premium AI Options</Btn>}\n              </div>\n            </Card>\n          )}',
    'value-first travel empty state')
travel = once(travel,
    'export default function Travel({ userId, onBack }) {',
    'export default function Travel({ userId, tier = "free", onUpgrade, onBack }) {\n  const premium = tier === "premium" || tier === "lifetime";',
    'Travel tier props')
travel = once(travel,
    '<TripDetail trip={trip} userId={userId} dogs={dogs}\n        onBack={() => setSelectedTrip(null)}',
    '<TripDetail trip={trip} userId={userId} dogs={dogs} premium={premium} onUpgrade={onUpgrade}\n        onBack={() => setSelectedTrip(null)}',
    'TripDetail invocation premium props')
travel_path.write_text(travel, encoding='utf-8')

print('Applied value-first paywall timing changes to App, health records, and Travel.')
