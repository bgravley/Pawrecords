#!/usr/bin/env python3
from pathlib import Path


def once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)

path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')

# Let callers open the existing feedback system directly on the most relevant
# category, and let the home prompt learn when a user has already responded.
text = once(
    text,
    'const BugReportModal=({userId,userEmail,onClose})=>{\n  const[description,setDescription]=useState("");\n  const[reportType,setReportType]=useState("bug");',
    'const BugReportModal=({userId,userEmail,onClose,initialType="bug",onSubmitted})=>{\n  const[description,setDescription]=useState("");\n  const[reportType,setReportType]=useState(initialType);',
    'feedback modal initial type',
)
text = once(
    text,
    '      setSent(true);\n    }catch(e){setErr(e.message);}',
    '      setSent(true);\n      onSubmitted?.(reportType);\n    }catch(e){setErr(e.message);}',
    'feedback modal submit callback',
)

# Auto-prompt only after the user has accumulated real value. The prompt state
# stores only a generic status and timestamp in localStorage—never pet, health,
# document, or trip details—and synthetic production E2E users are excluded.
text = once(
    text,
    'const Home=({state,dispatch,userId,tier,userEmail,onSignOut,isAdmin,onOpenAdmin,onOpenTravel,isAffiliate,onOpenAffiliate,upgradeRequestKey})=>{',
    'const POST_SUCCESS_FEEDBACK_COOLDOWN_MS=90*24*60*60*1000;\nconst POST_SUCCESS_FEEDBACK_TEST_EMAILS=new Set(["e2e-primary@yourpetpass.com","e2e-secondary@yourpetpass.com"]);\n\nconst Home=({state,dispatch,userId,tier,userEmail,onSignOut,isAdmin,onOpenAdmin,onOpenTravel,isAffiliate,onOpenAffiliate,upgradeRequestKey})=>{',
    'post-success feedback constants',
)
text = once(
    text,
    '  const[showBugReport,setShowBugReport]=useState(false);\n  const[showAlerts,setShowAlerts]=useState(false);\n  const[errorCount,setErrorCount]=useState(0);\n  const[upcomingTrips,setUpcomingTrips]=useState([]);',
    '  const[showBugReport,setShowBugReport]=useState(false);\n  const[feedbackModalInitialType,setFeedbackModalInitialType]=useState("bug");\n  const[feedbackPromptVisible,setFeedbackPromptVisible]=useState(false);\n  const[showAlerts,setShowAlerts]=useState(false);\n  const[errorCount,setErrorCount]=useState(0);\n  const[upcomingTrips,setUpcomingTrips]=useState([]);',
    'post-success feedback state',
)
text = once(
    text,
    '  const premium=isPremium(tier);',
    '''  const premium=isPremium(tier);
  const healthRecordCount=state.vaccinations.length+state.medications.length+state.visits.length+state.allergies.length;
  const successMilestones=(state.dogs.length>0?1:0)+(healthRecordCount>=2?1:0)+(upcomingTrips.length>0?1:0)+(state.documents.length>0?1:0);
  const feedbackPromptStorageKey=`ypp_feedback_prompt_v1_${userId}`;

  useEffect(()=>{
    const synthetic=POST_SUCCESS_FEEDBACK_TEST_EMAILS.has((userEmail||"").toLowerCase());
    if(synthetic||successMilestones<2){setFeedbackPromptVisible(false);return;}
    try{
      const raw=localStorage.getItem(feedbackPromptStorageKey);
      if(!raw){setFeedbackPromptVisible(true);return;}
      const saved=JSON.parse(raw);
      if(saved?.status==="submitted"){setFeedbackPromptVisible(false);return;}
      const at=Number(saved?.at)||0;
      setFeedbackPromptVisible(!at||Date.now()-at>=POST_SUCCESS_FEEDBACK_COOLDOWN_MS);
    }catch(e){
      // If storage is unavailable, do not nag the user on every render/session.
      setFeedbackPromptVisible(false);
    }
  },[feedbackPromptStorageKey,successMilestones,userEmail]);

  const rememberFeedbackPrompt=(status)=>{
    try{localStorage.setItem(feedbackPromptStorageKey,JSON.stringify({status,at:Date.now()}));}catch(e){/* non-critical */}
    setFeedbackPromptVisible(false);
  };
  const openPostSuccessFeedback=()=>{
    setFeedbackModalInitialType("feedback");
    rememberFeedbackPrompt("opened");
    setShowBugReport(true);
  };
  const dismissPostSuccessFeedback=()=>rememberFeedbackPrompt("dismissed");''',
    'post-success feedback eligibility',
)

# Preserve the header feedback button's existing bug-report starting point.
text = once(
    text,
    '<button onClick={()=>setShowBugReport(true)} title="Share Feedback" aria-label="Share feedback"',
    '<button onClick={()=>{setFeedbackModalInitialType("bug");setShowBugReport(true);}} title="Share Feedback" aria-label="Share feedback"',
    'header feedback launcher',
)

# Place the prompt after the pet content but before travel. It is a normal card,
# not a modal/popover, so it never interrupts a save or navigation action.
travel_marker = '''        <div style={{marginTop:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h2 style={{fontFamily:"'Lora',serif",fontSize:20}}>✈️ Upcoming Travel</h2>'''
feedback_card = '''        {feedbackPromptVisible&&(
          <Card style={{marginTop:24,background:"#EAF4EE",border:"1px solid #9DC4AA",boxShadow:"none"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
              <div style={{flex:"1 1 280px"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:18,color:"#2C4A38",marginBottom:6}}>How’s YourPetPass working for you?</div>
                <div style={{fontSize:13,color:"#385744",lineHeight:1.65}}>You’ve had a chance to put YourPetPass to work. What feels useful, and what would make it better?</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <Btn sm onClick={openPostSuccessFeedback}>Share feedback</Btn>
                <button type="button" onClick={dismissPostSuccessFeedback} style={{background:"transparent",color:"#385744",fontSize:13,fontWeight:600,padding:"8px 10px",borderRadius:8}}>Not now</button>
              </div>
            </div>
          </Card>
        )}

''' + travel_marker
text = once(text, travel_marker, feedback_card, 'post-success feedback card')

text = once(
    text,
    '{showBugReport&&<BugReportModal userId={userId} userEmail={userEmail} onClose={()=>setShowBugReport(false)}/>}',
    '{showBugReport&&<BugReportModal userId={userId} userEmail={userEmail} initialType={feedbackModalInitialType} onSubmitted={()=>rememberFeedbackPrompt("submitted")} onClose={()=>setShowBugReport(false)}/>}',
    'feedback modal wiring',
)

path.write_text(text, encoding='utf-8')
print('Applied respectful post-success feedback prompt.')
