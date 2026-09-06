#!/usr/bin/env python3
from pathlib import Path

path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')

# Remove the submit callback accidentally matched inside EmailRecordModal.
text = text.replace('      setSent(true);\n      onSubmitted?.(reportType);\n    }catch(e){setErr(e.message);}\n    setSending(false);\n  };\n\n  return(<Modal title={`Email ${dog.name}\'s Records`}',
                    '      setSent(true);\n    }catch(e){setErr(e.message);}\n    setSending(false);\n  };\n\n  return(<Modal title={`Email ${dog.name}\'s Records`}', 1)

# Add the callback only to the actual feedback submission success path.
old_feedback = """      const data=await res.json();
      if(!res.ok||data.error)throw new Error(data.error||'Could not submit report');
      setSent(true);
    }catch(e){setErr(e.message);}"""
new_feedback = """      const data=await res.json();
      if(!res.ok||data.error)throw new Error(data.error||'Could not submit report');
      setSent(true);
      onSubmitted?.(reportType);
    }catch(e){setErr(e.message);}"""
if new_feedback not in text:
    if old_feedback not in text:
        raise SystemExit('Could not locate feedback submission success path')
    text = text.replace(old_feedback, new_feedback, 1)

# Remove eligibility/cooldown logic from OverviewTab, where the generic
# premium-line matcher placed it, then add it to Home immediately after its
# upgrade-request effect.
misplaced = '''  const healthRecordCount=state.vaccinations.length+state.medications.length+state.visits.length+state.allergies.length;
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
  const dismissPostSuccessFeedback=()=>rememberFeedbackPrompt("dismissed");
'''

# Only remove the block if it appears inside OverviewTab before ptLabel.
overview_marker = 'const OverviewTab=({dog,state,userId,tier,setModal,onUpgrade,onScan,dispatch})=>{'
overview_start = text.find(overview_marker)
pt_start = text.find('  const ptLabel=petTypeLabel(dog.pet_type);', overview_start)
if overview_start < 0 or pt_start < 0:
    raise SystemExit('Could not locate OverviewTab boundaries')
overview_segment = text[overview_start:pt_start]
if misplaced in overview_segment:
    text = text[:overview_start] + overview_segment.replace(misplaced, '', 1) + text[pt_start:]

home_anchor = '''  useEffect(()=>{
    if(upgradeRequestKey>0)setShowUpgrade(true);
  },[upgradeRequestKey]);
  const premium=isPremium(tier);

  useEffect(()=>{
    if(!isAdmin)return;'''
home_replacement = '''  useEffect(()=>{
    if(upgradeRequestKey>0)setShowUpgrade(true);
  },[upgradeRequestKey]);
  const premium=isPremium(tier);
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
  const dismissPostSuccessFeedback=()=>rememberFeedbackPrompt("dismissed");

  useEffect(()=>{
    if(!isAdmin)return;'''
if home_replacement not in text:
    if home_anchor not in text:
        raise SystemExit('Could not locate Home insertion anchor')
    text = text.replace(home_anchor, home_replacement, 1)

path.write_text(text, encoding='utf-8')
print('Repaired post-success feedback placement.')
