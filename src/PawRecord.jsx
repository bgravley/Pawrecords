// src/PawRecord.jsx — YourPetPass
import { useReducer, useState, useEffect, useRef, Component } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./lib/supabase";
import * as db from "./lib/db";

const PRICES = {
  monthly: "price_1TaiD5BP9MtRr7gKKYeQgZQ8",
  annual:  "price_1TaiDcBP9MtRr7gK8Iqvj1Gn",
  lifetime:"price_1TaiENBP9MtRr7gKfqjYXGe3",
}
// Coupon codes (created in Stripe dashboard)
// YPPFREE  = 100% off forever (lifetime free)
// YPP3FREE = 100% off for 3 months;


const COUNTRY_CODES=[
  {code:"+1",name:"USA/Canada",flag:"🇺🇸"},
  {code:"+44",name:"UK",flag:"🇬🇧"},
  {code:"+52",name:"Mexico",flag:"🇲🇽"},
  {code:"+57",name:"Colombia",flag:"🇨🇴"},
  {code:"+34",name:"Spain",flag:"🇪🇸"},
  {code:"+33",name:"France",flag:"🇫🇷"},
  {code:"+49",name:"Germany",flag:"🇩🇪"},
  {code:"+39",name:"Italy",flag:"🇮🇹"},
  {code:"+351",name:"Portugal",flag:"🇵🇹"},
  {code:"+31",name:"Netherlands",flag:"🇳🇱"},
  {code:"+61",name:"Australia",flag:"🇦🇺"},
  {code:"+64",name:"New Zealand",flag:"🇳🇿"},
  {code:"+81",name:"Japan",flag:"🇯🇵"},
  {code:"+82",name:"South Korea",flag:"🇰🇷"},
  {code:"+66",name:"Thailand",flag:"🇹🇭"},
  {code:"+65",name:"Singapore",flag:"🇸🇬"},
  {code:"+60",name:"Malaysia",flag:"🇲🇾"},
  {code:"+62",name:"Indonesia",flag:"🇮🇩"},
  {code:"+91",name:"India",flag:"🇮🇳"},
  {code:"+971",name:"UAE",flag:"🇦🇪"},
  {code:"+972",name:"Israel",flag:"🇮🇱"},
  {code:"+27",name:"South Africa",flag:"🇿🇦"},
  {code:"+55",name:"Brazil",flag:"🇧🇷"},
  {code:"+54",name:"Argentina",flag:"🇦🇷"},
  {code:"+56",name:"Chile",flag:"🇨🇱"},
  {code:"+51",name:"Peru",flag:"🇵🇪"},
  {code:"+506",name:"Costa Rica",flag:"🇨🇷"},
  {code:"+507",name:"Panama",flag:"🇵🇦"},
  {code:"+502",name:"Guatemala",flag:"🇬🇹"},
  {code:"+53",name:"Cuba",flag:"🇨🇺"},
  {code:"+1-787",name:"Puerto Rico",flag:"🇵🇷"},
  {code:"+45",name:"Denmark",flag:"🇩🇰"},
  {code:"+46",name:"Sweden",flag:"🇸🇪"},
  {code:"+47",name:"Norway",flag:"🇳🇴"},
  {code:"+358",name:"Finland",flag:"🇫🇮"},
  {code:"+41",name:"Switzerland",flag:"🇨🇭"},
  {code:"+43",name:"Austria",flag:"🇦🇹"},
  {code:"+32",name:"Belgium",flag:"🇧🇪"},
  {code:"+30",name:"Greece",flag:"🇬🇷"},
  {code:"+48",name:"Poland",flag:"🇵🇱"},
  {code:"+420",name:"Czech Republic",flag:"🇨🇿"},
  {code:"+36",name:"Hungary",flag:"🇭🇺"},
  {code:"+40",name:"Romania",flag:"🇷🇴"},
  {code:"+380",name:"Ukraine",flag:"🇺🇦"},
  {code:"+7",name:"Russia",flag:"🇷🇺"},
  {code:"+86",name:"China",flag:"🇨🇳"},
  {code:"+852",name:"Hong Kong",flag:"🇭🇰"},
  {code:"+886",name:"Taiwan",flag:"🇹🇼"},
  {code:"+63",name:"Philippines",flag:"🇵🇭"},
  {code:"+84",name:"Vietnam",flag:"🇻🇳"},
  {code:"+855",name:"Cambodia",flag:"🇰🇭"},
  {code:"+673",name:"Brunei",flag:"🇧🇳"},
  {code:"+94",name:"Sri Lanka",flag:"🇱🇰"},
  {code:"+977",name:"Nepal",flag:"🇳🇵"},
  {code:"+92",name:"Pakistan",flag:"🇵🇰"},
  {code:"+880",name:"Bangladesh",flag:"🇧🇩"},
  {code:"+20",name:"Egypt",flag:"🇪🇬"},
  {code:"+212",name:"Morocco",flag:"🇲🇦"},
  {code:"+234",name:"Nigeria",flag:"🇳🇬"},
  {code:"+254",name:"Kenya",flag:"🇰🇪"},
  {code:"+255",name:"Tanzania",flag:"🇹🇿"},
  {code:"+256",name:"Uganda",flag:"🇺🇬"},
  {code:"+233",name:"Ghana",flag:"🇬🇭"},
];


const US_STATES=[
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky",
  "Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi",
  "Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico",
  "New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania",
  "Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming",
  "District of Columbia","Puerto Rico","Guam","U.S. Virgin Islands","American Samoa",
  "Northern Mariana Islands","U.S. Armed Forces Americas (AA)",
  "U.S. Armed Forces Europe (AE)","U.S. Armed Forces Pacific (AP)"
];


const GLOBAL=`
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;overscroll-behavior:none}
  body{background:#FAF6F0;color:#2C2017;font-family:'Nunito',sans-serif;font-size:15px;-webkit-font-smoothing:antialiased}
  input,select,textarea{font-family:'Nunito',sans-serif;font-size:14px;background:#FAF6F0;color:#2C2017;
    border:1.5px solid #E8DDD0;border-radius:10px;padding:10px 14px;width:100%;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus,select:focus,textarea:focus{border-color:#2D7D6F;box-shadow:0 0 0 3px #2D7D6F14}
  select option{background:#FFFFFF} button{font-family:'Nunito',sans-serif;cursor:pointer;border:none}
  button:active{transform:scale(.97)} ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-thumb{background:#E8DDD0;border-radius:4px}
  .fade{animation:fu .22s ease}
  @keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;

const CORE_V=[
  {name:"Rabies",dur:12,note:"Required by law in most US states."},
  {name:"DHPP",dur:36,note:"Distemper, Hepatitis, Parvovirus, Parainfluenza."},
  {name:"DA2PP",dur:36,note:"Adenovirus type 2; often interchangeable with DHPP."},
];
const OPT_V=[
  {name:"Bordetella",dur:12,note:"Recommended for boarding, grooming, or dog parks."},
  {name:"Leptospirosis",dur:12,note:"For dogs near wildlife or standing water."},
  {name:"Lyme Disease",dur:12,note:"Recommended in tick-endemic regions."},
  {name:"Canine Influenza",dur:12,note:"For dogs in frequent close contact with others."},
  {name:"Rattlesnake Vaccine",dur:6,note:"For dogs in rattlesnake-prone areas."},
];

const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>{if(!d)return"—";return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})};
const addM=(d,m)=>{const dt=new Date(d+"T12:00:00");dt.setMonth(dt.getMonth()+parseInt(m));return dt.toISOString().slice(0,10)};
const daysUntil=d=>{if(!d)return null;const n=new Date();n.setHours(12,0,0,0);return Math.round((new Date(d+"T12:00:00")-n)/86400000)};
const vSt=due=>{const d=daysUntil(due);if(d===null)return{c:"#8B7355",label:"Not recorded"};if(d<0)return{c:"#C4714A",label:`Overdue ${Math.abs(d)}d`};if(d===0)return{c:"#E8A838",label:"Due today!"};if(d<=30)return{c:"#E8A838",label:`Due in ${d}d`};return{c:"#2D7D6F",label:`Due ${fmt(due)}`}};
const isPremium=tier=>tier==='premium'||tier==='lifetime';
const petTypeLabel=type=>{if(type==='service_animal')return'Service Animal';if(type==='esa')return'ESA';return null;};
const petTypeColor=type=>{if(type==='service_animal')return'#2D7D6F';if(type==='esa')return'#E8A838';return null;};

// ── ACTIVITY & ERROR LOGGING ──────────────────────────────
const logActivity = async (userId, userEmail, action, details = {}) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;
    await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, user_email: userEmail, action, details })
    });
  } catch (e) { /* silent fail */ }
};

const logError = async (userId, userEmail, context, errorMessage) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;
    await fetch(`${supabaseUrl}/rest/v1/error_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, user_email: userEmail, context, error_message: errorMessage, reviewed: false })
    });
  } catch (e) { /* silent fail */ }
};



const exportICS=(dogName,vacName,due)=>{
  const d=new Date(due+"T09:00:00"),p=n=>String(n).padStart(2,"0");
  const ts=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T090000`;
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//YourPetPass//EN","BEGIN:VEVENT",`DTSTART:${ts}`,`DTEND:${ts}`,`SUMMARY:${dogName} — ${vacName} due`,`DESCRIPTION:${vacName} vaccination due for ${dogName}. Managed in YourPetPass.`,"STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));a.download=`${dogName}_${vacName.replace(/\s+/g,"_")}.ics`;a.click();
};

const exportHTML=(dog,state)=>{
  const v=state.vaccinations.filter(x=>x.dog_id===dog.id);
  const m=state.medications.filter(x=>x.dog_id===dog.id);
  const al=state.allergies.filter(x=>x.dog_id===dog.id);
  const vs=state.visits.filter(x=>x.dog_id===dog.id).sort((a,b)=>b.visit_date.localeCompare(a.visit_date));
  const ptLabel=petTypeLabel(dog.pet_type);
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${dog.name} Medical Records</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111}h1{font-size:26px;margin-bottom:4px}.gen{color:#666;font-size:13px;margin-bottom:32px}h2{font-size:14px;font-weight:700;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:6px;margin:28px 0 14px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f2f2f2;padding:8px 10px;text-align:left}td{padding:8px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top}.core{background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}.opt{background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;font-size:11px}.sa{background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}.esa{background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}footer{margin-top:48px;color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:16px}@media print{body{margin:16px}}</style></head><body>
<h1>🐾 ${dog.name}'s Medical Records</h1><div class="gen">Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} · YourPetPass</div>
<h2>Profile</h2><table><tr><td><b>Name</b></td><td>${dog.name}${ptLabel?` <span class="${dog.pet_type==='service_animal'?'sa':'esa'}">${ptLabel.toUpperCase()}</span>`:''}</td></tr><tr><td><b>Breed</b></td><td>${dog.breed||"—"}</td></tr><tr><td><b>Born</b></td><td>${fmt(dog.dob)}</td></tr><tr><td><b>Weight</b></td><td>${dog.weight?dog.weight+" lbs":"—"}</td></tr><tr><td><b>Microchip</b></td><td>${dog.microchip||"—"}</td></tr>${dog.emergency_contact?`<tr><td><b>Emergency</b></td><td>${dog.emergency_contact} ${dog.emergency_phone||""}</td></tr>`:""}</table>
${al.length?`<h2>⚠️ Allergies</h2><table><tr><th>Allergen</th><th>Reaction</th><th>Severity</th></tr>${al.map(a=>`<tr><td><b>${a.allergen}</b></td><td>${a.reaction}</td><td>${a.severity.toUpperCase()}</td></tr>`).join("")}</table>`:""}
<h2>Vaccinations</h2>${v.length?`<table><tr><th>Vaccine</th><th>Type</th><th>Given</th><th>Next Due</th><th>Vet</th></tr>${v.map(x=>`<tr><td><b>${x.name}</b></td><td><span class="${x.type==="core"?"core":"opt"}">${x.type.toUpperCase()}</span></td><td>${fmt(x.date_given)}</td><td>${fmt(x.next_due)}</td><td>${x.vet_name||"—"}</td></tr>`).join("")}</table>`:"<p>No vaccinations recorded.</p>"}
${m.length?`<h2>Medications</h2><table><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Status</th></tr>${m.map(x=>`<tr><td><b>${x.name}</b></td><td>${x.dosage}</td><td>${x.frequency}</td><td>${x.active?"Active":"Completed"}</td></tr>`).join("")}</table>`:""}
${vs.length?`<h2>Vet Visits</h2><table><tr><th>Date</th><th>Vet/Clinic</th><th>Reason</th><th>Diagnosis</th></tr>${vs.map(x=>`<tr><td>${fmt(x.visit_date)}</td><td>${x.vet_name||"—"}<br><small>${x.clinic||""}</small></td><td>${x.reason}</td><td>${x.diagnosis||"—"}</td></tr>`).join("")}</table>`:""}
<footer>Generated by YourPetPass · Always consult a licensed veterinarian for medical advice.</footer></body></html>`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));a.download=`${dog.name.replace(/\s+/g,"_")}_Records.html`;a.click();
};

class ErrorBoundary extends Component{
  state={err:null,info:null};
  static getDerivedStateFromError(err){return{err};}
  componentDidCatch(err,info){this.setState({info});}
  render(){
    if(this.state.err)return(<div style={{minHeight:"100vh",background:"#FAF6F0",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}><div style={{background:"#FFFFFF",border:"1px solid #C4714A44",borderRadius:16,padding:28,maxWidth:480,width:"100%"}}><div style={{color:"#C4714A",fontWeight:700,fontSize:18,marginBottom:12}}>⚠ Something crashed</div><div style={{fontFamily:"monospace",fontSize:12,color:"#5A4535",background:"#FFFFFF",borderRadius:10,padding:14,whiteSpace:"pre-wrap",maxHeight:220,overflow:"auto",marginBottom:16}}>{this.state.err.toString()}{"\n"}{this.state.info?.componentStack?.slice(0,500)}</div><button onClick={()=>this.setState({err:null,info:null})} style={{background:"#2D7D6F",color:"#FAF6F0",borderRadius:10,padding:"10px 20px",fontWeight:600,fontSize:14,border:"none",cursor:"pointer"}}>Try to Recover</button></div></div>);
    return this.props.children;
  }
}

const Ic=({n,s=18,c="currentColor"})=>{
  const p={
    paw:<><circle cx="10.5" cy="5.5" r="2"/><circle cx="14.5" cy="4" r="1.5"/><circle cx="7" cy="5.5" r="1.5"/><circle cx="14.5" cy="9" r="1.5"/><path d="M12 10c-2.5 0-7 1.2-7 4v1.5h14V14c0-2.8-4.5-4-7-4z"/></>,
    syringe:<><path d="M18 2l4 4-7 7-1-4-3 3-3-3 3-3-4-1z"/><path d="M5 14l-3 3"/><line x1="7" y1="12" x2="3" y2="16"/></>,
    pill:<><path d="M4.5 12.5l8-8a4.95 4.95 0 017 7l-8 8a4.95 4.95 0 01-7-7z"/><line x1="10" y1="10" x2="14" y2="14"/></>,
    alert:<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    doc:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    stethoscope:<><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6 6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3"/><path d="M8 15v1a6 6 0 006 6 6 6 0 006-6v-4"/><circle cx="20" cy="10" r="2"/></>,
    plus:<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    chevL:<><polyline points="15 18 9 12 15 6"/></>,
    chevR:<><polyline points="9 18 15 12 9 6"/></>,
    x:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    edit:<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    share:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
    download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    map:<><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
    camera:<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    home:<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    weight:<><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></>,
    phone:<><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></>,
    qr:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3"/><rect x="16" y="5" width="3" height="3"/><rect x="5" y="16" width="3" height="3"/><path d="M14 14h3v3h-3zM17 17h3v3h-3z"/></>,
    cal:<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    grid:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    heart:<><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></>,
    crown:<><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="5" y1="20" x2="19" y2="20"/></>,
    lock:<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    logout:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[n]}</svg>;
};

const Btn=({children,onClick,v="primary",sm,full,style:s,disabled})=>{
  const V={primary:{background:"#2D7D6F",color:"#FAF6F0"},secondary:{background:"#FFFFFF",color:"#2C2017",border:"1px solid #E8DDD0"},danger:{background:"#C4714A14",color:"#C4714A",border:"1px solid #C4714A44"},ghost:{background:"transparent",color:"#5A4535"}};
  return <button onClick={disabled?undefined:onClick} style={{...V[v],borderRadius:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity .15s",width:full?"100%":"auto",justifyContent:full?"center":"flex-start",padding:sm?"7px 14px":"10px 20px",fontSize:sm?13:14,opacity:disabled?.5:1,border:"none",...s}} onMouseEnter={e=>!disabled&&(e.currentTarget.style.opacity="0.8")} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;
};

const Card=({children,style:s,onClick})=>(
  <div onClick={onClick} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:16,padding:18,boxShadow:"0 2px 12px rgba(44,32,23,0.06)",...s,cursor:onClick?"pointer":"default",transition:"border-color .2s"}} onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor="#2D7D6F55")} onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor="#E8DDD0")}>{children}</div>
);

const Badge=({label,color})=>(
  <span style={{background:color+"20",color,border:`1px solid ${color}40`,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
);

const Field=({label,children,col})=>(
  <div style={{display:"flex",flexDirection:"column",gap:5,gridColumn:col}}>
    <label style={{fontSize:11,fontWeight:600,color:"#5A4535",textTransform:"uppercase",letterSpacing:".05em"}}>{label}</label>
    {children}
  </div>
);

const Modal=({title,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:20,width:"100%",maxWidth:wide?620:500,maxHeight:"92vh",overflow:"auto",padding:24,boxShadow:"0 8px 40px rgba(44,32,23,0.15)"}} className="fade">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h3 style={{fontFamily:"'Lora',serif",fontSize:22}}>{title}</h3>
        <button onClick={onClose} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"6px 8px",color:"#5A4535"}}><Ic n="x" s={16}/></button>
      </div>
      {children}
    </div>
  </div>
);

const Empty=({icon,title,sub,action})=>(
  <div style={{textAlign:"center",padding:"48px 20px"}}>
    <div style={{color:"#8B7355",marginBottom:12}}><Ic n={icon} s={36} c="#8B7355"/></div>
    <div style={{fontFamily:"'Lora',serif",fontSize:20,marginBottom:6}}>{title}</div>
    <div style={{color:"#5A4535",fontSize:14,marginBottom:22}}>{sub}</div>
    {action}
  </div>
);

const Avatar=({dog,size=48})=>{
  const cols=["#2D7D6F","#2D7D6F","#C4714A","#E8A838","#2D7D6F","#2D7D6F","#E8A838"];
  const ci=dog.name.charCodeAt(0)%cols.length;
  return dog.photo_url
    ?<img src={dog.photo_url} alt={dog.name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${cols[ci]}`}}/>
    :<div style={{width:size,height:size,borderRadius:"50%",background:cols[ci]+"25",border:`2px solid ${cols[ci]}`,display:"flex",alignItems:"center",justifyContent:"center",color:cols[ci],fontWeight:700,fontSize:size*.38,fontFamily:"'Lora',serif"}}>{dog.name[0]}</div>;
};

const PremiumLock=({onUpgrade,label="Premium Feature"})=>(
  <div style={{background:"#E8A83810",border:"1px solid #E8A83844",borderRadius:12,padding:16,textAlign:"center"}}>
    <Ic n="crown" s={24} c="#E8A838"/>
    <div style={{fontWeight:600,marginTop:8,marginBottom:4}}>{label}</div>
    <div style={{color:"#5A4535",fontSize:13,marginBottom:12}}>Upgrade to Premium to unlock this feature</div>
    <Btn onClick={onUpgrade} style={{margin:"0 auto",background:"#E8A838",color:"#FAF6F0"}}><Ic n="crown" s={14} c="#FAF6F0"/> Upgrade Now</Btn>
  </div>
);

const UpgradeModal=({userId,userEmail,onClose})=>{
  const[loading,setLoading]=useState(null);
  const[error,setError]=useState(null);
  const[coupon,setCoupon]=useState("");
  const[couponApplied,setCouponApplied]=useState(false);
  const[couponLoading,setCouponLoading]=useState(false);

  const applyCoupon=async()=>{
    if(!coupon.trim())return;
    setCouponLoading(true);setError(null);
    // Validate coupon exists by attempting a $0 checkout with it
    // We just pass it through to Stripe on checkout
    setCouponApplied(true);setCouponLoading(false);
  };

  const checkout=async(priceKey,mode)=>{
    setLoading(priceKey);setError(null);
    try{
      const body={priceId:PRICES[priceKey],userId,userEmail,mode};
      if(couponApplied&&coupon.trim())body.couponCode=coupon.trim().toUpperCase();
      const{data,error:fnErr}=await supabase.functions.invoke("create-checkout",{body});
      if(fnErr||data.error)throw new Error(fnErr?.message||data.error);
      window.location.href=data.url;
    }catch(e){setError(e.message);setLoading(null);}
  };

  const plans=[
    {key:"monthly",mode:"subscription",label:"Monthly",price:"$4.99",period:"/month",desc:"Billed monthly, cancel anytime",color:"#2D7D6F"},
    {key:"annual",mode:"subscription",label:"Annual",price:"$39.99",period:"/year",desc:"Save 33% vs monthly — best value",color:"#2D7D6F",popular:true},
    {key:"lifetime",mode:"payment",label:"Lifetime",price:"$99",period:"one time",desc:"Pay once, own it forever",color:"#E8A838"},
  ];

  return(
    <Modal title="Upgrade to Premium" onClose={onClose}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={{background:"#2D7D6F0D",borderRadius:12,padding:14}}>
          <div style={{fontSize:13,fontWeight:700,color:"#2D7D6F",marginBottom:8}}>Premium includes:</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:13,color:"#5A4535"}}>
            {["📷 AI Document Scan","✈️ AI Travel Checklists","📊 Weight Tracking","📄 Export Records","📁 Document Storage","🔲 QR Health Card"].map(f=><div key={f}>{f}</div>)}
          </div>
        </div>
        {error&&<div style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:10,padding:12,fontSize:13,color:"#C4714A"}}>{error}</div>}
        {plans.map(plan=>(
          <div key={plan.key} style={{position:"relative",border:`2px solid ${plan.popular?"#2D7D6F":"#E8DDD0"}`,borderRadius:14,padding:18,background:plan.popular?"#2D7D6F08":"transparent"}}>
            {plan.popular&&<div style={{position:"absolute",top:-10,left:20,background:"#2D7D6F",color:"#FAF6F0",fontSize:11,fontWeight:700,padding:"2px 10px",borderRadius:20}}>BEST VALUE</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:700,fontSize:16}}>{plan.label}</div><div style={{color:"#5A4535",fontSize:13,marginTop:2}}>{plan.desc}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontFamily:"'Lora',serif",fontSize:26,color:plan.color,fontWeight:700}}>{plan.price}</div><div style={{color:"#5A4535",fontSize:12}}>{plan.period}</div></div>
            </div>
            <Btn full onClick={()=>checkout(plan.key,plan.mode)} disabled={!!loading} style={{marginTop:12,background:plan.color,color:"#FAF6F0",justifyContent:"center"}}>{loading===plan.key?"Processing...":`Get ${plan.label}`}</Btn>
          </div>
        ))}
        {/* Coupon Code */}
        <div style={{borderTop:"1px solid #E8DDD0",paddingTop:14}}>
          <div style={{fontSize:13,fontWeight:600,color:"#5A4535",marginBottom:8}}>Have a coupon code?</div>
          {couponApplied
            ?<div style={{display:"flex",alignItems:"center",gap:8,color:"#2D7D6F",fontSize:13,fontWeight:600,background:"#2D7D6F14",borderRadius:10,padding:"10px 14px"}}>
              ✓ Coupon <b>{coupon.toUpperCase()}</b> applied — discount will be reflected at checkout
              <button onClick={()=>{setCouponApplied(false);setCoupon("");}} style={{marginLeft:"auto",background:"none",border:"none",color:"#8B7355",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Remove</button>
            </div>
            :<div style={{display:"flex",gap:8}}>
              <input value={coupon} onChange={e=>setCoupon(e.target.value.toUpperCase())} placeholder="Enter code" style={{flex:1,background:"#FAF6F0",border:"1.5px solid #E8DDD0",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#2C2017",outline:"none",fontFamily:"'Nunito',sans-serif",letterSpacing:".05em"}}/>
              <Btn sm onClick={applyCoupon} disabled={couponLoading||!coupon.trim()}>{couponLoading?"...":"Apply"}</Btn>
            </div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center",color:"#5A4535",fontSize:12}}><Ic n="lock" s={12} c="#5A4535"/> Secure payment via Stripe</div>
      </div>
    </Modal>
  );
};

const BottomNav=({tab,setTab,alerts})=>{
  const items=[{id:"overview",icon:"home",label:"Overview"},{id:"vaccines",icon:"syringe",label:"Vaccines"},{id:"health",icon:"heart",label:"Health"},{id:"records",icon:"stethoscope",label:"Visits"},{id:"more",icon:"grid",label:"More"}];
  return(
    <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:"#FFFFFF",borderTop:"1px solid #E8DDD0",display:"flex",height:64,boxShadow:"0 -2px 12px rgba(44,32,23,0.06)"}}>
      {items.map(item=>{
        const active=tab===item.id;
        return(<button key={item.id} onClick={()=>setTab(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"none",color:active?"#2D7D6F":"#5A4535",fontSize:11,fontWeight:active?600:400,transition:"color .15s",position:"relative",paddingTop:2,border:"none"}}>
          <Ic n={item.icon} s={20} c={active?"#2D7D6F":"#5A4535"}/>
          {item.label}
          {item.id==="vaccines"&&alerts>0&&(<span style={{position:"absolute",top:8,left:"calc(50% + 6px)",background:"#C4714A",color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{alerts}</span>)}
        </button>);
      })}
    </nav>
  );
};


const DeletePetModal=({dog,onConfirm,onClose})=>{
  const[step,setStep]=useState(1);
  const[typing,setTyping]=useState("");

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#FFFFFF",borderRadius:20,padding:28,width:"100%",maxWidth:420,border:"2px solid #C4714A44"}} className="fade">
        {step===1&&<>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
            <div style={{fontFamily:"'Lora',serif",fontSize:22,color:"#C4714A",marginBottom:8}}>Delete {dog.name}?</div>
            <div style={{fontSize:14,color:"#5A4535",lineHeight:1.7}}>
              This will permanently delete <b>{dog.name}'s</b> entire profile including all vaccines, medications, visits, and records.<br/><br/>
              <b>This cannot be undone.</b>
            </div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn v="secondary" onClick={onClose} full>Cancel — Keep {dog.name}</Btn>
            <Btn onClick={()=>setStep(2)} style={{background:"#C4714A",color:"#fff",justifyContent:"center"}} full>Yes, Delete</Btn>
          </div>
        </>}
        {step===2&&<>
          <div style={{textAlign:"center",marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:12}}>🗑️</div>
            <div style={{fontFamily:"'Lora',serif",fontSize:22,color:"#C4714A",marginBottom:8}}>Are you absolutely sure?</div>
            <div style={{fontSize:14,color:"#5A4535",lineHeight:1.7,marginBottom:16}}>
              Type <b>{dog.name}</b> below to confirm deletion.
            </div>
            <input
              value={typing}
              onChange={e=>setTyping(e.target.value)}
              placeholder={`Type "${dog.name}" to confirm`}
              style={{width:"100%",padding:"12px 16px",borderRadius:10,border:`2px solid ${typing===dog.name?"#C4714A":"#E8DDD0"}`,fontSize:15,background:"#FAF6F0",color:"#2C2017",outline:"none",fontFamily:"'Nunito',sans-serif",boxSizing:"border-box"}}
            />
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn v="secondary" onClick={onClose} full>Cancel</Btn>
            <Btn
              onClick={()=>typing===dog.name&&onConfirm()}
              disabled={typing!==dog.name}
              style={{background:"#C4714A",color:"#fff",justifyContent:"center",opacity:typing===dog.name?1:0.4}}
              full>
              Delete Forever
            </Btn>
          </div>
        </>}
      </div>
    </div>
  );
};


const DogForm=({dog,userId,userEmail,onSave,onClose})=>{
  const[f,setF]=useState(dog?{name:dog.name,breed:dog.breed||"",dob:dog.dob||"",weight:dog.weight||"",gender:dog.gender||"male",neutered:dog.neutered||false,microchip:dog.microchip||"",color:dog.color||"",emergencyContact:dog.emergency_contact||"",emergencyPhone:dog.emergency_phone||"",notes:dog.notes||"",photo:dog.photo_url||"",petType:dog.pet_type||"pet"}:{name:"",breed:"",dob:"",weight:"",gender:"male",neutered:false,microchip:"",color:"",emergencyContact:"",emergencyPhone:"",emergencyPhoneCode:"+1",emergencyWhatsapp:"",emergencyWhatsappCode:"+1",notes:"",photo:"",petType:"pet"});
  const[saving,setSaving]=useState(false);
  const[certFile,setCertFile]=useState(null);
  const[certUploaded,setCertUploaded]=useState(!!dog?.certification_doc_path);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const fr=useRef();
  const certRef=useRef();
  const onPhoto=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>set("photo",ev.target.result);r.readAsDataURL(file);};
  const save=async()=>{
    if(!f.name)return;setSaving(true);
    try{
      const payload={
        name:f.name,breed:f.breed||null,dob:f.dob||null,
        weight:f.weight?parseFloat(f.weight):null,
        gender:f.gender,neutered:f.neutered,
        microchip:f.microchip||null,color:f.color||null,
        emergency_contact:f.emergencyContact||null,
        emergency_phone:f.emergencyPhone||null,
        emergency_phone_code:f.emergencyPhoneCode||"+1",
        emergency_whatsapp:f.emergencyWhatsapp||null,
        emergency_whatsapp_code:f.emergencyWhatsappCode||"+1",
        notes:f.notes||null,
        pet_type:f.petType||"pet",
        user_id:userId,
      };
      let result;
      if(dog){
        const{data,error}=await supabase.from("dogs").update(payload).eq("id",dog.id).select().single();
        if(error)throw error;
        result=data;
      } else {
        const{data,error}=await supabase.from("dogs").insert(payload).select().single();
        if(error)throw error;
        result=data;
      }
      // Upload photo
      if(f.photo&&f.photo.startsWith("data:")){
        try{
          const blob=await(await fetch(f.photo)).blob();
          const ext=blob.type.includes("png")?"png":"jpg";
          const path=`${userId}/pets/${result.id}/profile.${ext}`;
          await supabase.storage.from("documents").upload(path,blob,{upsert:true,contentType:blob.type});
          const{data:urlData}=supabase.storage.from("documents").getPublicUrl(path);
          await supabase.from("dogs").update({photo_url:urlData.publicUrl}).eq("id",result.id);
          result.photo_url=urlData.publicUrl;
        }catch(e){console.error("Photo upload failed:",e);}
      }
      // Upload cert
      if(certFile){
        const path=`${userId}/certs/${result.id}_${certFile.name}`;
        await supabase.storage.from("documents").upload(path,certFile,{upsert:true});
        await supabase.from("dogs").update({certification_doc_path:path}).eq("id",result.id);
        result.certification_doc_path=path;
      }
      await logActivity(userId,userEmail||null,dog?"pet_updated":"pet_added",{petName:f.name,breed:f.breed});
      onSave(result);
    }catch(e){
      console.error("Save pet error:",e);
      alert("Could not save: "+e.message);
    }
    setSaving(false);
  };
  return(<Modal title={dog?"Edit Profile":"Add Pet"} onClose={onClose} wide>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"center"}}>
        <div style={{position:"relative",cursor:"pointer"}} onClick={()=>fr.current.click()}>
          {f.photo?<img src={f.photo} style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #2D7D6F"}}/>:<div style={{width:80,height:80,borderRadius:"50%",background:"#FFFFFF",border:"2px dashed #E8DDD0",display:"flex",alignItems:"center",justifyContent:"center",color:"#5A4535"}}><Ic n="camera" s={24} c="#5A4535"/></div>}
          <div style={{position:"absolute",bottom:0,right:0,background:"#2D7D6F",borderRadius:"50%",padding:5}}><Ic n="camera" s={11} c="#FAF6F0"/></div>
        </div>
        <input ref={fr} type="file" accept="image/*" style={{display:"none"}} onChange={onPhoto}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Name" col="1/-1"><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Buddy"/></Field>
        <Field label="Breed"><input value={f.breed} onChange={e=>set("breed",e.target.value)} placeholder="Golden Retriever"/></Field>
        <Field label="Date of Birth"><input type="date" value={f.dob} onChange={e=>set("dob",e.target.value)}/></Field>
        <Field label="Weight (lbs)"><input type="number" value={f.weight} onChange={e=>set("weight",e.target.value)}/></Field>
        <Field label="Color"><input value={f.color} onChange={e=>set("color",e.target.value)} placeholder="Golden"/></Field>
        <Field label="Gender"><select value={f.gender} onChange={e=>set("gender",e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></Field>
        <Field label="Neutered/Spayed"><select value={f.neutered?"yes":"no"} onChange={e=>set("neutered",e.target.value==="yes")}><option value="no">No</option><option value="yes">Yes</option></select></Field>
        <Field label="Microchip ID" col="1/-1"><input value={f.microchip} onChange={e=>set("microchip",e.target.value)} placeholder="985..."/></Field>
        <Field label="Emergency Contact" col="1/-1">
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <input value={f.emergencyContact} onChange={e=>set("emergencyContact",e.target.value)} placeholder="Jane Smith" style={{flex:1}}/>
            <button type="button" onClick={async()=>{
              const{data}=await supabase.from("profiles").select("full_name,phone,phone_country_code,whatsapp").eq("id",userId).single();
              if(data){set("emergencyContact",data.full_name||"");set("emergencyPhone",data.phone||"");set("emergencyPhoneCode",data.phone_country_code||"+1");set("emergencyWhatsapp",data.whatsapp||"");}
            }} style={{background:"#2D7D6F14",border:"1px solid #2D7D6F44",borderRadius:10,padding:"10px 12px",color:"#2D7D6F",fontWeight:600,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
              Use My Info
            </button>
          </div>
        </Field>
        <Field label="Emergency Phone Country Code">
          <select value={f.emergencyPhoneCode||"+1"} onChange={e=>set("emergencyPhoneCode",e.target.value)}>
            {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
          </select>
        </Field>
        <Field label="Emergency Phone Number">
          <input value={f.emergencyPhone} onChange={e=>set("emergencyPhone",e.target.value)} placeholder="555-0100"/>
        </Field>
        <Field label="Emergency WhatsApp" col="1/-1">
          <div style={{display:"flex",gap:8}}>
            <select value={f.emergencyWhatsappCode||"+1"} onChange={e=>set("emergencyWhatsappCode",e.target.value)} style={{width:"auto",flexShrink:0}}>
              {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input value={f.emergencyWhatsapp||""} onChange={e=>set("emergencyWhatsapp",e.target.value)} placeholder="WhatsApp number (if different)"/>
          </div>
        </Field>
      </div>
      <div style={{background:"#FAF6F0",borderRadius:12,padding:14,border:"1.5px solid #E8DDD0"}}>
        <div style={{fontWeight:800,fontSize:12,color:"#5A4535",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>🐾 Pet Classification</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[{value:"pet",label:"Regular Pet",desc:"Standard pet travel and housing rules apply"},{value:"service_animal",label:"Service Animal",desc:"Trained to perform specific tasks for a person with a disability — special travel rights apply"},{value:"esa",label:"Emotional Support Animal (ESA)",desc:"Provides emotional support — different airline and housing rules apply than a regular pet"}].map(opt=>(
            <label key={opt.value} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:f.petType===opt.value?"#2D7D6F14":"#FFFFFF",border:`1.5px solid ${f.petType===opt.value?"#2D7D6F":"#E8DDD0"}`,borderRadius:10,cursor:"pointer"}}>
              <input type="radio" name="petType" value={opt.value} checked={f.petType===opt.value} onChange={e=>set("petType",e.target.value)} style={{marginTop:2,accentColor:"#2D7D6F",width:16,height:16,flexShrink:0}}/>
              <div><div style={{fontWeight:700,fontSize:14}}>{opt.label}</div><div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{opt.desc}</div></div>
            </label>
          ))}
        </div>
        {(f.petType==="service_animal"||f.petType==="esa")&&(
          <div style={{marginTop:14,padding:12,background:"#FFFFFF",borderRadius:10,border:"1px solid #E8DDD044"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#5A4535",marginBottom:6}}>{f.petType==="service_animal"?"📋 Service Animal Documentation":"📋 ESA Letter"}</div>
            <div style={{fontSize:12,color:"#8B7355",marginBottom:10}}>{f.petType==="service_animal"?"Upload your service animal certification, vest photo, or training documentation. This will appear on exports and QR codes.":"Upload your ESA letter from a licensed mental health professional. This will appear on exports and QR codes."}</div>
            <input ref={certRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){setCertFile(e.target.files[0]);setCertUploaded(false);}}}/>
            {certUploaded
              ?<div style={{display:"flex",alignItems:"center",gap:8,color:"#2D7D6F",fontSize:13,fontWeight:600}}>✓ Documentation uploaded{certFile?` — ${certFile.name}`:""}<button onClick={()=>{setCertUploaded(false);setCertFile(null);}} style={{background:"none",border:"none",color:"#8B7355",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Replace</button></div>
              :<Btn sm v="secondary" onClick={()=>certRef.current.click()}>📎 Upload Documentation</Btn>}
          </div>
        )}
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10,marginTop:4}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save Pet"}</Btn></div>
    </div>
  </Modal>);
};

const VaccineForm=({vacc,dogId,userId,onSave,onClose})=>{
  const[f,setF]=useState(vacc?{name:vacc.name,type:vacc.type,dateGiven:vacc.date_given||today(),durationMonths:vacc.duration_months||12,nextDue:vacc.next_due||"",lotNumber:vacc.lot_number||"",vetName:vacc.vet_name||"",notes:vacc.notes||""}:{name:"",type:"core",dateGiven:today(),durationMonths:12,nextDue:"",lotNumber:"",vetName:"",notes:""});
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const all=[...CORE_V,...OPT_V];
  useEffect(()=>{if(f.dateGiven&&f.durationMonths)set("nextDue",addM(f.dateGiven,f.durationMonths));},[f.dateGiven,f.durationMonths]);
  const save=async()=>{
    if(!f.name)return;setSaving(true);
    const payload={dogId,name:f.name,type:f.type,dateGiven:f.dateGiven,nextDue:f.nextDue,durationMonths:parseInt(f.durationMonths),lotNumber:f.lotNumber,vetName:f.vetName,notes:f.notes};
    let result;
    if(vacc){const{data}=await db.updateVaccination({...payload,id:vacc.id});result=data;}
    else{const{data}=await db.addVaccination(userId,payload);result=data;}
    if(result)onSave(result);
    setSaving(false);
  };
  return(<Modal title={vacc?"Edit Vaccination":"Record Vaccination"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Select Vaccine"><select value={f.name} onChange={e=>{const found=all.find(v=>v.name===e.target.value);setF(p=>({...p,name:e.target.value,type:CORE_V.find(v=>v.name===e.target.value)?"core":"optional",durationMonths:found?found.dur:p.durationMonths}));}}><option value="">— Select or enter below —</option><optgroup label="Core (Required)">{CORE_V.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}</optgroup><optgroup label="Optional">{OPT_V.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}</optgroup></select></Field>
      <Field label="Custom Name"><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Vaccine name"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Type"><select value={f.type} onChange={e=>set("type",e.target.value)}><option value="core">Core</option><option value="optional">Optional</option></select></Field>
        <Field label="Duration (months)"><input type="number" value={f.durationMonths} onChange={e=>set("durationMonths",e.target.value)}/></Field>
        <Field label="Date Given"><input type="date" value={f.dateGiven} onChange={e=>set("dateGiven",e.target.value)}/></Field>
        <Field label="Next Due (auto)"><input type="date" value={f.nextDue} onChange={e=>set("nextDue",e.target.value)} style={{borderColor:"#2D7D6F66"}}/></Field>
        <Field label="Lot #"><input value={f.lotNumber} onChange={e=>set("lotNumber",e.target.value)} placeholder="ABC123"/></Field>
        <Field label="Vet"><input value={f.vetName} onChange={e=>set("vetName",e.target.value)} placeholder="Dr. Smith"/></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save"}</Btn></div>
    </div>
  </Modal>);
};

const MedForm=({med,dogId,userId,onSave,onClose})=>{
  const[f,setF]=useState(med?{name:med.name,dosage:med.dosage||"",frequency:med.frequency||"",startDate:med.start_date||today(),endDate:med.end_date||"",prescribingVet:med.prescribing_vet||"",reason:med.reason||"",notes:med.notes||"",active:med.active}:{name:"",dosage:"",frequency:"",startDate:today(),endDate:"",prescribingVet:"",reason:"",notes:"",active:true});
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const save=async()=>{
    if(!f.name)return;setSaving(true);
    const payload={dogId,name:f.name,dosage:f.dosage,frequency:f.frequency,startDate:f.startDate,endDate:f.endDate||null,prescribingVet:f.prescribingVet,reason:f.reason,notes:f.notes,active:f.active};
    let result;
    if(med){const{data}=await db.updateMedication({...payload,id:med.id});result=data;}
    else{const{data}=await db.addMedication(userId,payload);result=data;}
    if(result)onSave(result);
    setSaving(false);
  };
  return(<Modal title={med?"Edit Medication":"Add Medication"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Name" col="1/-1"><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Heartgard Plus"/></Field>
        <Field label="Dosage"><input value={f.dosage} onChange={e=>set("dosage",e.target.value)} placeholder="25mg"/></Field>
        <Field label="Frequency"><input value={f.frequency} onChange={e=>set("frequency",e.target.value)} placeholder="Once daily"/></Field>
        <Field label="Start Date"><input type="date" value={f.startDate} onChange={e=>set("startDate",e.target.value)}/></Field>
        <Field label="End Date"><input type="date" value={f.endDate} onChange={e=>set("endDate",e.target.value)}/></Field>
        <Field label="Prescribing Vet" col="1/-1"><input value={f.prescribingVet} onChange={e=>set("prescribingVet",e.target.value)}/></Field>
        <Field label="Reason" col="1/-1"><input value={f.reason} onChange={e=>set("reason",e.target.value)} placeholder="Heartworm prevention"/></Field>
        <Field label="Status"><select value={f.active?"active":"inactive"} onChange={e=>set("active",e.target.value==="active")}><option value="active">Active</option><option value="inactive">Completed</option></select></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save"}</Btn></div>
    </div>
  </Modal>);
};

const AllergyForm=({allergy,dogId,userId,onSave,onClose})=>{
  const[f,setF]=useState(allergy?{allergen:allergy.allergen,reaction:allergy.reaction||"",severity:allergy.severity,dateDiscovered:allergy.date_discovered||today(),notes:allergy.notes||""}:{allergen:"",reaction:"",severity:"mild",dateDiscovered:today(),notes:""});
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const save=async()=>{
    if(!f.allergen)return;setSaving(true);
    const payload={dogId,allergen:f.allergen,reaction:f.reaction,severity:f.severity,dateDiscovered:f.dateDiscovered,notes:f.notes};
    let result;
    if(allergy){const{data}=await db.updateAllergy({...payload,id:allergy.id});result=data;}
    else{const{data}=await db.addAllergy(userId,payload);result=data;}
    if(result)onSave(result);
    setSaving(false);
  };
  return(<Modal title={allergy?"Edit Allergy":"Add Allergy"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Allergen" col="1/-1"><input value={f.allergen} onChange={e=>set("allergen",e.target.value)} placeholder="Chicken, pollen..."/></Field>
        <Field label="Reaction" col="1/-1"><input value={f.reaction} onChange={e=>set("reaction",e.target.value)} placeholder="Skin rash, vomiting..."/></Field>
        <Field label="Severity"><select value={f.severity} onChange={e=>set("severity",e.target.value)}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></Field>
        <Field label="Date Discovered"><input type="date" value={f.dateDiscovered} onChange={e=>set("dateDiscovered",e.target.value)}/></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save"}</Btn></div>
    </div>
  </Modal>);
};

const VisitForm=({visit,dogId,userId,onSave,onClose})=>{
  const[f,setF]=useState(visit?{date:visit.visit_date,vetName:visit.vet_name||"",clinic:visit.clinic||"",reason:visit.reason,diagnosis:visit.diagnosis||"",treatment:visit.treatment||"",cost:visit.cost||"",notes:visit.notes||""}:{date:today(),vetName:"",clinic:"",reason:"",diagnosis:"",treatment:"",cost:"",notes:""});
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const save=async()=>{
    if(!f.reason)return;setSaving(true);
    const payload={dogId,date:f.date,vetName:f.vetName,clinic:f.clinic,reason:f.reason,diagnosis:f.diagnosis,treatment:f.treatment,cost:f.cost||null,notes:f.notes};
    let result;
    if(visit){const{data}=await db.updateVisit({...payload,id:visit.id});result=data;}
    else{const{data}=await db.addVisit(userId,payload);result=data;}
    if(result)onSave(result);
    setSaving(false);
  };
  return(<Modal title={visit?"Edit Visit":"Log Vet Visit"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Date" col="1/-1"><input type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></Field>
        <Field label="Vet Name"><input value={f.vetName} onChange={e=>set("vetName",e.target.value)} placeholder="Dr. Williams"/></Field>
        <Field label="Clinic"><input value={f.clinic} onChange={e=>set("clinic",e.target.value)} placeholder="Sunrise Animal Hospital"/></Field>
        <Field label="Reason" col="1/-1"><input value={f.reason} onChange={e=>set("reason",e.target.value)} placeholder="Annual checkup, illness..."/></Field>
        <Field label="Diagnosis" col="1/-1"><input value={f.diagnosis} onChange={e=>set("diagnosis",e.target.value)}/></Field>
        <Field label="Treatment" col="1/-1"><input value={f.treatment} onChange={e=>set("treatment",e.target.value)}/></Field>
        <Field label="Cost ($)"><input type="number" value={f.cost} onChange={e=>set("cost",e.target.value)}/></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={save} disabled={saving} full>{saving?"Saving...":"Save"}</Btn></div>
    </div>
  </Modal>);
};

const ShareModal=({dog,onClose})=>{
  const msgs=[`🐾 ${dog.name} is up to date on all vaccinations! Keeping pet records organized with YourPetPass 📋`,`💉 Just logged ${dog.name}'s latest vet visit! Healthy pup = happy life. #YourPetPass #DogMom #DogDad`,`✅ ${dog.name}'s medical records are travel-ready. Best investment for any dog parent! 🐶`];
  const[sel,setSel]=useState(0);
  return(<Modal title={`Share ${dog.name}'s Update`} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {msgs.map((m,i)=><div key={i} onClick={()=>setSel(i)} style={{padding:14,borderRadius:12,border:`2px solid ${sel===i?"#2D7D6F":"#E8DDD0"}`,cursor:"pointer",fontSize:14,lineHeight:1.6,background:sel===i?"#2D7D6F14":"#FFFFFF"}}>{m}</div>)}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:4}}>
        <Btn onClick={()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msgs[sel])}`,"_blank")} style={{background:"#1da1f2",color:"#fff",justifyContent:"center"}}>Twitter</Btn>
        <Btn onClick={()=>window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(msgs[sel])}`,"_blank")} style={{background:"#1877f2",color:"#fff",justifyContent:"center"}}>Facebook</Btn>
        <Btn v="secondary" onClick={()=>navigator.clipboard.writeText(msgs[sel])} style={{justifyContent:"center"}}><Ic n="doc" s={13}/> Copy</Btn>
      </div>
    </div>
  </Modal>);
};

const AIScanModal=({dog,userId,userEmail,dispatch,onSave,onClose})=>{
  const[step,setStep]=useState("upload");
  const[images,setImages]=useState([]);
  const[extracted,setExtracted]=useState(null);
  const[error,setError]=useState(null);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[include,setInclude]=useState({visit:true,vaccines:true,weight:true,medications:true,allergies:true,classification:true});
  const fr=useRef();
  const cameraRef=useRef();
  const MAX_IMAGES=4;

  const loadPdfAsImage=async(arrayBuffer)=>{
    await new Promise((resolve,reject)=>{
      if(window.pdfjsLib){resolve();return;}
      const script=document.createElement("script");
      script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve();};
      script.onerror=()=>reject(new Error("Failed to load PDF library"));
      document.head.appendChild(script);
    });
    const pdfjsLib=window.pdfjsLib;
    const pdf=await pdfjsLib.getDocument({data:new Uint8Array(arrayBuffer)}).promise;
    const results=[];
    const pagesToLoad=Math.min(pdf.numPages,MAX_IMAGES-images.length);
    for(let i=1;i<=pagesToLoad;i++){
      const page=await pdf.getPage(i);
      const scale=2;
      const viewport=page.getViewport({scale});
      const canvas=document.createElement("canvas");
      canvas.width=viewport.width;canvas.height=viewport.height;
      await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
      results.push({dataUrl:canvas.toDataURL("image/jpeg",0.92),label:`Page ${i}`});
    }
    return results;
  };

  const addFiles=async(fileList)=>{
    const files=Array.from(fileList);
    const remaining=MAX_IMAGES-images.length;
    if(remaining<=0)return;
    const toProcess=files.slice(0,remaining);
    const newImages=[];
    for(const file of toProcess){
      if(file.type==="application/pdf"){
        try{const buf=await file.arrayBuffer();const pdfImages=await loadPdfAsImage(buf);newImages.push(...pdfImages);}
        catch(e){setError("Could not read PDF: "+e.message);}
      } else {
        await new Promise(res=>{const r=new FileReader();r.onload=ev=>{newImages.push({dataUrl:ev.target.result,label:file.name.replace(/\.[^.]+$/,"")});res();};r.readAsDataURL(file);});
      }
    }
    setImages(prev=>[...prev,...newImages].slice(0,MAX_IMAGES));
    setError(null);
  };

  const removeImage=(idx)=>setImages(prev=>prev.filter((_,i)=>i!==idx));

  const analyze=async()=>{
    if(images.length===0)return;
    setStep("scanning");setError(null);
    try{
      const imagePayload=images.map(img=>({base64:img.dataUrl.split(",")[1],mediaType:img.dataUrl.split(";")[0].split(":")[1]}));
      const res=await fetch("/api/ai-scan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({images:imagePayload,userId,userEmail:userEmail||null,petName:dog.name})});
      if(!res.ok){const e=await res.json();throw new Error(e.error||"Scan request failed");}
      const data=await res.json();
      if(data.error)throw new Error(data.error);
      setExtracted(data.extracted);
      setStep("review");
    }catch(err){
      setError("Could not analyze: "+(err.message||"Unknown error"));
      setStep("upload");
      await logError(userId,userEmail||null,"ai_scan",err.message||"Unknown error");
    }
  };

  const saveAll=async()=>{
    setSaving(true);
    try{
      const dt=extracted.documentType;

      // VET VISIT or HEALTH CERT — save visit, vaccines, weight, medications, allergies
      if(dt==="vet_visit"||dt==="health_certificate"||dt==="vaccine_record"||dt==="unknown"){
        const vv=extracted.vetVisit||extracted.healthCertificate||{};
        const vaccines=vv.vaccines||extracted.healthCertificate?.vaccines||[];
        const medications=vv.medications||[];
        const allergies=vv.allergies||[];
        const visitDate=vv.visitDate||today();
        const weight=vv.weight||extracted.healthCertificate?.weight||null;

        if(include.visit&&(vv.reason||vv.visitDate||vv.diagnosis)){
          await db.addVisit(userId,{dogId:dog.id,date:visitDate,vetName:vv.vetName||"",clinic:vv.clinicName||"",reason:vv.reason||"Vet visit (scanned)",diagnosis:vv.diagnosis||"",treatment:vv.treatment||"",cost:vv.cost||null,notes:vv.notes||""});
        }
        if(include.vaccines){
          for(const v of vaccines.filter(v=>v.name)){
            const dur=([...CORE_V,...OPT_V].find(x=>x.name===v.name)?.dur)||12;
            const given=v.dateGiven||visitDate;
            await db.addVaccination(userId,{dogId:dog.id,name:v.name,type:v.type||"optional",dateGiven:given,nextDue:v.nextDue||addM(given,dur),lotNumber:v.lotNumber||"",vetName:vv.vetName||"",notes:"",durationMonths:dur});
          }
        }
        if(include.weight&&weight){
          await db.addWeight(userId,{dogId:dog.id,date:visitDate,weight:parseFloat(weight),notes:"From AI scan"});
          await supabase.from("dogs").update({weight:parseFloat(weight)}).eq("id",dog.id);
          dispatch&&dispatch({t:"UPD_DOG",d:{...dog,weight:parseFloat(weight)}});
        }
        if(include.medications){
          for(const m of medications.filter(m=>m.name)){
            await db.addMedication(userId,{dogId:dog.id,name:m.name,dosage:m.dosage||"",frequency:m.frequency||"",reason:m.reason||"",startDate:visitDate,endDate:null,prescribingVet:vv.vetName||"",notes:"",active:true});
          }
        }
        if(include.allergies){
          for(const a of allergies.filter(a=>a.allergen)){
            await db.addAllergy(userId,{dogId:dog.id,allergen:a.allergen,reaction:a.reaction||"",severity:a.severity||"mild",dateDiscovered:visitDate,notes:"From AI scan"});
          }
        }
      }

      // SERVICE ANIMAL CERT
      if(dt==="service_animal_cert"&&include.classification){
        const sa=extracted.serviceAnimal||{};
        await supabase.from("dogs").update({pet_type:"service_animal"}).eq("id",dog.id);
        if(sa.weight){
          await supabase.from("dogs").update({weight:parseFloat(sa.weight)}).eq("id",dog.id);
        }
      }

      // ESA LETTER
      if(dt==="esa_letter"&&include.classification){
        await supabase.from("dogs").update({pet_type:"esa"}).eq("id",dog.id);
      }

      setSaved(true);
      setTimeout(()=>{onSave();onClose();},1400);
    }catch(e){setError(e.message);}
    setSaving(false);
  };

  const tog=k=>setInclude(p=>({...p,[k]:!p[k]}));
  const dt=extracted?.documentType;
  const isClassification=dt==="service_animal_cert"||dt==="esa_letter";
  const isVetDoc=dt==="vet_visit"||dt==="health_certificate"||dt==="vaccine_record"||dt==="unknown";

  // Doc type display
  const docTypeLabel={
    vet_visit:"🏥 Vet Visit Record",
    service_animal_cert:"🦺 Service Animal Certificate",
    esa_letter:"💙 ESA Letter",
    health_certificate:"✈️ Health Certificate",
    vaccine_record:"💉 Vaccine Record",
    unknown:"📄 Document",
  };
  const docTypeColor={
    vet_visit:"#2D7D6F",service_animal_cert:"#2D7D6F",esa_letter:"#E8A838",
    health_certificate:"#2D7D6F",vaccine_record:"#2D7D6F",unknown:"#8B7355",
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#FFFFFF",border:"1px solid #2D7D6F44",borderRadius:20,width:"100%",maxWidth:520,maxHeight:"94vh",overflow:"auto",padding:24}} className="fade">

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <h3 style={{fontFamily:"'Lora',serif",fontSize:22}}>AI Document Scan</h3>
              <span style={{background:"#E8A83820",color:"#E8A838",border:"1px solid #E8A83840",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>PREMIUM</span>
            </div>
            <p style={{color:"#5A4535",fontSize:13,marginTop:2}}>Vet records · Service animal certs · ESA letters · Health certs</p>
          </div>
          <button onClick={onClose} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"6px 8px",color:"#5A4535"}}><Ic n="x" s={16}/></button>
        </div>

        {/* Upload step */}
        {step==="upload"&&<>
          {error&&<div style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:12,padding:14,marginBottom:16,fontSize:13,color:"#C4714A"}}>{error}</div>}
          <input ref={fr} type="file" accept="image/*,application/pdf" multiple style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>addFiles(e.target.files)}/>

          {images.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {images.map((img,idx)=>(
                <div key={idx} style={{position:"relative",borderRadius:12,overflow:"hidden",border:"1px solid #E8DDD0",background:"#FFFFFF"}}>
                  <img src={img.dataUrl} style={{width:"100%",height:120,objectFit:"cover",display:"block"}}/>
                  <div style={{position:"absolute",top:0,left:0,right:0,background:"rgba(0,0,0,0.45)",padding:"4px 8px",fontSize:11,color:"#fff",fontWeight:600}}>{img.label||`Page ${idx+1}`}</div>
                  <button onClick={()=>removeImage(idx)} style={{position:"absolute",top:4,right:4,background:"#C4714A",border:"none",borderRadius:"50%",width:22,height:22,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
              ))}
              {images.length<MAX_IMAGES&&(
                <div onClick={()=>fr.current.click()} style={{height:120,borderRadius:12,border:"2px dashed #2D7D6F66",background:"#2D7D6F08",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",gap:6,color:"#2D7D6F"}}>
                  <Ic n="plus" s={24} c="#2D7D6F"/><span style={{fontSize:12,fontWeight:600}}>Add page</span>
                </div>
              )}
            </div>
          )}

          {images.length>0&&(
            <div style={{background:"#FAF6F0",borderRadius:10,padding:"8px 12px",fontSize:12,color:"#8B7355",marginBottom:14}}>
              {images.length}/{MAX_IMAGES} pages.{images.length===MAX_IMAGES?<span style={{color:"#C4714A",fontWeight:600}}> Maximum reached.</span>:<span> Add {MAX_IMAGES-images.length} more.</span>}
            </div>
          )}

          {images.length===0&&(
            <div style={{border:"2px dashed #2D7D6F44",borderRadius:16,padding:28,textAlign:"center",background:"#2D7D6F08",marginBottom:12}}>
              <div style={{fontSize:36,marginBottom:8}}>📄</div>
              <div style={{fontFamily:"'Lora',serif",fontSize:18,marginBottom:4}}>Scan Any Pet Document</div>
              <div style={{color:"#5A4535",fontSize:13,marginBottom:4}}>Vet visits · Vaccines · Service animal certs · ESA letters · Health certs</div>
              <div style={{color:"#8B7355",fontSize:12,marginBottom:16}}>AI identifies the document type and saves to the right place automatically</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                <button onClick={()=>cameraRef.current.click()} style={{background:"#2D7D6F",color:"#FAF6F0",borderRadius:10,padding:"10px 6px",fontWeight:600,fontSize:12,border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <Ic n="camera" s={18} c="#FAF6F0"/>Take Photo
                </button>
                <button onClick={()=>{fr.current.accept="image/*";fr.current.click();}} style={{background:"#FFFFFF",color:"#2C2017",borderRadius:10,padding:"10px 6px",fontWeight:600,fontSize:12,border:"1.5px solid #E8DDD0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <Ic n="camera" s={18}/>Photo Library
                </button>
                <button onClick={()=>{fr.current.accept="image/*,application/pdf";fr.current.click();}} style={{background:"#FFFFFF",color:"#2C2017",borderRadius:10,padding:"10px 6px",fontWeight:600,fontSize:12,border:"1.5px solid #E8DDD0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <Ic n="doc" s={18}/>Upload File
                </button>
              </div>
            </div>
          )}

          {images.length>0&&images.length<MAX_IMAGES&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
              <button onClick={()=>cameraRef.current.click()} style={{background:"#2D7D6F14",color:"#2D7D6F",borderRadius:10,padding:"8px 6px",fontWeight:600,fontSize:12,border:"1px solid #2D7D6F44",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ic n="camera" s={15} c="#2D7D6F"/>Add Photo</button>
              <button onClick={()=>{fr.current.accept="image/*";fr.current.click();}} style={{background:"#FAF6F0",color:"#5A4535",borderRadius:10,padding:"8px 6px",fontWeight:600,fontSize:12,border:"1px solid #E8DDD0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ic n="camera" s={15}/>Library</button>
              <button onClick={()=>{fr.current.accept="image/*,application/pdf";fr.current.click();}} style={{background:"#FAF6F0",color:"#5A4535",borderRadius:10,padding:"8px 6px",fontWeight:600,fontSize:12,border:"1px solid #E8DDD0",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><Ic n="doc" s={15}/>File</button>
            </div>
          )}

          {images.length>0&&(
            <div style={{display:"flex",gap:10}}>
              <Btn v="secondary" onClick={()=>setImages([])} full>Clear All</Btn>
              <Btn onClick={analyze} full><Ic n="syringe" s={15}/> Analyze {images.length} Page{images.length>1?"s":""}</Btn>
            </div>
          )}
        </>}

        {/* Scanning */}
        {step==="scanning"&&(
          <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:48,marginBottom:20,animation:"spin 1.5s linear infinite",display:"inline-block"}}>🔍</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <div style={{fontFamily:"'Lora',serif",fontSize:22,marginBottom:8}}>Reading Document...</div>
            <div style={{color:"#5A4535",fontSize:14}}>AI is identifying document type and extracting all data</div>
          </div>
        )}

        {/* Review */}
        {step==="review"&&extracted&&(<>
          {/* Document type banner */}
          <div style={{background:(docTypeColor[dt]||"#8B7355")+"15",border:`1px solid ${(docTypeColor[dt]||"#8B7355")}44`,borderRadius:12,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,color:docTypeColor[dt]||"#8B7355",fontSize:14}}>{docTypeLabel[dt]||"Document"}</div>
              {extracted.documentSummary&&<div style={{fontSize:12,color:"#5A4535",marginTop:2}}>{extracted.documentSummary}</div>}
            </div>
            <span style={{fontSize:12,color:"#2D7D6F",fontWeight:600}}>✓ Identified</span>
          </div>

          {/* SERVICE ANIMAL CERT review */}
          {dt==="service_animal_cert"&&extracted.serviceAnimal&&(<>
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}>🦺 Classification Update</div>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#5A4535"}}><input type="checkbox" checked={include.classification} onChange={()=>tog("classification")} style={{width:16,height:16,accentColor:"#2D7D6F"}}/>Include</label>
              </div>
              <div style={{background:"#2D7D6F14",borderRadius:10,padding:12,fontSize:13}}>
                <div style={{fontWeight:700,color:"#2D7D6F",marginBottom:6}}>Will update {dog.name} to: Service Animal</div>
                {extracted.serviceAnimal.certificationNumber&&<div><span style={{color:"#5A4535"}}>Cert #: </span>{extracted.serviceAnimal.certificationNumber}</div>}
                {extracted.serviceAnimal.issuingOrganization&&<div><span style={{color:"#5A4535"}}>Issued by: </span>{extracted.serviceAnimal.issuingOrganization}</div>}
                {extracted.serviceAnimal.expirationDate&&<div><span style={{color:"#5A4535"}}>Expires: </span>{fmt(extracted.serviceAnimal.expirationDate)}</div>}
                {extracted.serviceAnimal.tasksPerformed?.length>0&&<div style={{marginTop:6}}><span style={{color:"#5A4535"}}>Tasks: </span>{extracted.serviceAnimal.tasksPerformed.join(" · ")}</div>}
              </div>
            </div>
          </>)}

          {/* ESA LETTER review */}
          {dt==="esa_letter"&&extracted.esaLetter&&(<>
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:14}}>💙 Classification Update</div>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#5A4535"}}><input type="checkbox" checked={include.classification} onChange={()=>tog("classification")} style={{width:16,height:16,accentColor:"#E8A838"}}/>Include</label>
              </div>
              <div style={{background:"#E8A83814",borderRadius:10,padding:12,fontSize:13}}>
                <div style={{fontWeight:700,color:"#E8A838",marginBottom:6}}>Will update {dog.name} to: Emotional Support Animal</div>
                {extracted.esaLetter.therapistName&&<div><span style={{color:"#5A4535"}}>Therapist: </span>{extracted.esaLetter.therapistName}</div>}
                {extracted.esaLetter.therapistLicense&&<div><span style={{color:"#5A4535"}}>License: </span>{extracted.esaLetter.therapistLicense}</div>}
                {extracted.esaLetter.expirationDate&&<div><span style={{color:"#5A4535"}}>Expires: </span>{fmt(extracted.esaLetter.expirationDate)}</div>}
              </div>
            </div>
          </>)}

          {/* VET VISIT / HEALTH CERT review */}
          {isVetDoc&&extracted.vetVisit&&[
            {key:"visit",label:"Vet Visit",icon:"stethoscope",content:
              <div style={{background:"#FFFFFF",borderRadius:10,padding:12,fontSize:13,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[["Date",fmt(extracted.vetVisit.visitDate)],["Vet",extracted.vetVisit.vetName||"—"],["Clinic",extracted.vetVisit.clinicName||"—"],["Reason",extracted.vetVisit.reason||"—"],["Diagnosis",extracted.vetVisit.diagnosis||"—"],["Cost",extracted.vetVisit.cost?`$${extracted.vetVisit.cost}`:"—"]].map(([k,v])=>
                  <div key={k}><span style={{color:"#5A4535"}}>{k}: </span>{v}</div>)}
              </div>},
            {key:"vaccines",label:`Vaccines (${(extracted.vetVisit.vaccines||[]).filter(v=>v.name).length})`,icon:"syringe",
              content:(extracted.vetVisit.vaccines||[]).filter(v=>v.name).map((v,i)=>
                <div key={i} style={{background:"#FFFFFF",borderRadius:10,padding:10,fontSize:13,marginBottom:6}}>
                  <b>{v.name}</b> · Given {fmt(v.dateGiven)} · Next {fmt(v.nextDue)}{v.lotNumber?<span style={{color:"#8B7355"}}> · Lot {v.lotNumber}</span>:null}
                </div>)},
            {key:"weight",label:`Weight: ${extracted.vetVisit.weight} lbs`,icon:"weight",show:!!extracted.vetVisit.weight,content:null},
            {key:"medications",label:`Medications (${(extracted.vetVisit.medications||[]).filter(m=>m.name).length})`,icon:"pill",
              content:(extracted.vetVisit.medications||[]).filter(m=>m.name).map((m,i)=>
                <div key={i} style={{background:"#FFFFFF",borderRadius:10,padding:10,fontSize:13,marginBottom:6}}>
                  <b>{m.name}</b>{m.dosage?` · ${m.dosage}`:""}
                  {m.frequency&&<span style={{color:"#8B7355"}}> · {m.frequency}</span>}
                </div>)},
            {key:"allergies",label:`Allergies (${(extracted.vetVisit.allergies||[]).filter(a=>a.allergen).length})`,icon:"alert",
              show:(extracted.vetVisit.allergies||[]).filter(a=>a.allergen).length>0,
              content:(extracted.vetVisit.allergies||[]).filter(a=>a.allergen).map((a,i)=>
                <div key={i} style={{background:"#FFFFFF",borderRadius:10,padding:10,fontSize:13,marginBottom:6,display:"flex",justifyContent:"space-between"}}>
                  <span><b>{a.allergen}</b>{a.reaction?` — ${a.reaction}`:""}</span>
                  <span style={{color:a.severity==="severe"?"#C4714A":a.severity==="moderate"?"#E8A838":"#2D7D6F",fontWeight:600,fontSize:11}}>{(a.severity||"mild").toUpperCase()}</span>
                </div>)},
          ].filter(item=>item.show!==false).map(item=>(
            <div key={item.key} style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n={item.icon} s={15} c="#2D7D6F"/> {item.label}</div>
                <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#5A4535"}}><input type="checkbox" checked={include[item.key]} onChange={()=>tog(item.key)} style={{width:16,height:16,accentColor:"#2D7D6F"}}/>Include</label>
              </div>
              {item.content}
            </div>
          ))}

          {saved
            ?<div style={{textAlign:"center",padding:"16px 0",color:"#2D7D6F",fontWeight:600,fontSize:16}}>✓ Saved successfully!</div>
            :<div style={{display:"flex",gap:10}}>
              <Btn v="secondary" onClick={()=>{setStep("upload");setExtracted(null);}} full>Rescan</Btn>
              <Btn onClick={saveAll} disabled={saving} full>{saving?"Saving...":"✓ Confirm & Save"}</Btn>
            </div>}
        </>)}
      </div>
    </div>
  );
};


const QRSection=({dog,state,backBtn})=>{
  const[token,setToken]=useState(dog.emergency_token||null);
  const[generating,setGenerating]=useState(false);
  const[copied,setCopied]=useState(false);

  const generateToken=async()=>{
    setGenerating(true);
    const newToken=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    await supabase.from("dogs").update({emergency_token:newToken}).eq("id",dog.id);
    setToken(newToken);
    setGenerating(false);
  };

  const emergencyUrl=token?`https://yourpetpass.com/emergency/${token}`:"";
  const qrUrl=token?`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(emergencyUrl)}`:"";

  const copyLink=()=>{
    navigator.clipboard.writeText(emergencyUrl);
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {backBtn}
        <h3 style={{fontFamily:"'Lora',serif",fontSize:20}}>QR Health Card</h3>
      </div>

      <Card>
        <div style={{fontSize:14,color:"#5A4535",lineHeight:1.7,marginBottom:16}}>
          This QR code links to <b>{dog.name}'s full health record</b> — no login required.
          Anyone who scans it (a vet, border agent, dog sitter) sees the complete record instantly in their browser.
        </div>

        {!token?(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:40,marginBottom:12}}>🔲</div>
            <div style={{fontFamily:"'Lora',serif",fontSize:18,marginBottom:8}}>No QR code yet</div>
            <div style={{color:"#8B7355",fontSize:13,marginBottom:20}}>Generate a unique emergency link for {dog.name}</div>
            <Btn onClick={generateToken} disabled={generating} style={{margin:"0 auto",justifyContent:"center"}}>
              {generating?"Generating...":"Generate QR Code"}
            </Btn>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
            <img src={qrUrl} style={{borderRadius:12,border:"2px solid #E8DDD0",background:"#fff",padding:10,width:240,height:240}}/>
            <div style={{width:"100%",background:"#FAF6F0",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:"#5A4535",flex:1,wordBreak:"break-all"}}>{emergencyUrl}</span>
              <button onClick={copyLink} style={{background:"#2D7D6F",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>
                {copied?"Copied!":"Copy"}
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%"}}>
              <Btn v="secondary" sm full onClick={()=>window.open(emergencyUrl,"_blank")} style={{justifyContent:"center"}}>
                Preview Page
              </Btn>
              <Btn v="secondary" sm full onClick={generateToken} style={{justifyContent:"center",color:"#C4714A"}}>
                Regenerate
              </Btn>
            </div>
            <div style={{fontSize:12,color:"#8B7355",textAlign:"center",lineHeight:1.6}}>
              💡 Print this QR code and attach it to {dog.name}'s collar tag or carrier.
              Tap "Regenerate" to invalidate the old link if needed.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};


const OverviewTab=({dog,state,userId,tier,setModal,onUpgrade,onScan,dispatch})=>{
  const vaccines=state.vaccinations.filter(v=>v.dog_id===dog.id);
  const urgent=vaccines.filter(v=>v.next_due&&daysUntil(v.next_due)<=30);
  const al=state.allergies.filter(a=>a.dog_id===dog.id);
  const meds=state.medications.filter(m=>m.dog_id===dog.id&&m.active);
  const sev=s=>({mild:"#2D7D6F",moderate:"#E8A838",severe:"#C4714A"}[s]||"#E8A838");
  const premium=isPremium(tier);
  const ptLabel=petTypeLabel(dog.pet_type);
  const ptColor=petTypeColor(dog.pet_type);
  const ptFull=dog.pet_type==="service_animal"?"Service Animal":dog.pet_type==="esa"?"Emotional Support Animal":null;
  const ProfileRow=({label,value})=>value?(<div style={{display:"flex",flexDirection:"column",gap:3,padding:"10px 0",borderBottom:"1px solid #F0E8DC"}}><div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:".06em"}}>{label}</div><div style={{fontWeight:500,fontSize:15,color:"#2C2017"}}>{value}</div></div>):null;
  const age=dog.dob?Math.floor((Date.now()-new Date(dog.dob+"T12:00:00"))/(365.25*86400000)):null;
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    {ptFull&&ptColor&&(<Card style={{border:`2px solid ${ptColor}55`,background:ptColor+"0D",padding:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <span style={{fontSize:22}}>{dog.pet_type==="service_animal"?"🦺":"💙"}</span>
        <div style={{flex:1}}><div style={{fontWeight:800,color:ptColor,fontSize:16}}>{ptFull}</div><div style={{fontSize:12,color:"#8B7355",marginTop:2}}>{dog.pet_type==="service_animal"?"Trained to perform specific tasks for a person with a disability":"Provides emotional support — different airline and housing rules apply"}</div></div>
      </div>
      <div style={{background:"#FFFFFF",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#5A4535",lineHeight:1.6}}>{dog.pet_type==="service_animal"?"✈️ Service animals have special travel rights. Airlines must allow them in cabin. Carry documentation at all times.":"✈️ ESAs have different rules than service animals. Always check with airline and property before travel."}</div>
      <div style={{marginTop:10,fontSize:13,fontWeight:600,color:dog.certification_doc_path?"#2D7D6F":"#8B7355"}}>{dog.certification_doc_path?"📋 Documentation uploaded ✓":"📋 No documentation — add via Edit Profile"}</div>
    </Card>)}
    {urgent.length>0&&(<Card style={{border:"1px solid #E8A83844",background:"#E8A83814"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,color:"#E8A838",fontWeight:600,fontSize:14}}><Ic n="alert" s={15} c="#E8A838"/> Attention Needed</div>{urgent.map(v=>{const st=vSt(v.next_due);return(<div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #E8DDD044"}}><span style={{fontSize:14}}>{v.name}</span><Badge label={st.label} color={st.c}/></div>);})}</Card>)}
    <Card>
      <div style={{fontWeight:800,fontSize:12,color:"#5A4535",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4}}>🐾 Pet Profile</div>
      <ProfileRow label="Name" value={dog.name}/>
      <ProfileRow label="Breed" value={dog.breed}/>
      <ProfileRow label="Date of Birth" value={fmt(dog.dob)}/>
      <ProfileRow label="Age" value={age!==null?`${age} years old`:null}/>
      {(()=>{
        const weights=state.weights.filter(w=>w.dog_id===dog.id).sort((a,b)=>b.log_date.localeCompare(a.log_date));
        const latest=weights[0];
        const prev=weights[1];
        const trend=latest&&prev?(parseFloat(latest.weight_lbs)-parseFloat(prev.weight_lbs)):null;
        const trendStr=trend!==null?(trend>0?`▲ ${trend.toFixed(1)} lbs since last visit`:trend<0?`▼ ${Math.abs(trend).toFixed(1)} lbs since last visit`:"Stable"):null;
        const trendColor=trend>0?"#C4714A":trend<0?"#2D7D6F":"#8B7355";
        return dog.weight?(
          <div style={{display:"flex",flexDirection:"column",gap:3,padding:"10px 0",borderBottom:"1px solid #F0E8DC"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:".06em"}}>Weight</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontWeight:500,fontSize:15,color:"#2C2017"}}>{dog.weight} lbs</span>
              {trendStr&&<span style={{fontSize:12,color:trendColor,fontWeight:600}}>{trendStr}</span>}
            </div>
          </div>
        ):null;
      })()}
      <ProfileRow label="Color" value={dog.color}/>
      <ProfileRow label="Gender" value={dog.gender?(dog.gender.charAt(0).toUpperCase()+dog.gender.slice(1))+(dog.neutered?" · Neutered/Spayed":""):null}/>
      <ProfileRow label="Microchip" value={dog.microchip}/>
      <ProfileRow label="Classification" value={ptFull||"Regular Pet"}/>
      {(dog.emergency_contact||dog.emergency_phone)&&(<div style={{display:"flex",flexDirection:"column",gap:3,padding:"10px 0",borderBottom:"1px solid #F0E8DC"}}><div style={{fontSize:11,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:".06em"}}>Emergency Contact</div><div style={{fontWeight:500,fontSize:15,color:"#2C2017",display:"flex",alignItems:"center",gap:8}}><Ic n="phone" s={14} c="#E8A838"/>{dog.emergency_contact}{dog.emergency_phone?` · ${dog.emergency_phone_code||""} ${dog.emergency_phone}`:""}</div></div>)}
      {dog.notes&&<ProfileRow label="Notes" value={dog.notes}/>}
    </Card>
    {al.length>0&&(<Card style={{border:"1px solid #C4714A44"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,color:"#C4714A",fontWeight:600,fontSize:14}}><Ic n="alert" s={15} c="#C4714A"/> Known Allergies</div>{al.map(a=>(<div key={a.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #E8DDD044",fontSize:14}}><span><b>{a.allergen}</b> — {a.reaction}</span><Badge label={a.severity} color={sev(a.severity)}/></div>))}</Card>)}
    {meds.length>0&&(<Card><div style={{fontWeight:600,marginBottom:10,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="pill" s={14} c="#2D7D6F"/> Active Medications</div>{meds.map(m=>(<div key={m.id} style={{fontSize:14,padding:"6px 0",borderBottom:"1px solid #E8DDD044"}}><b>{m.name}</b> · {m.dosage} · {m.frequency}</div>))}</Card>)}
  </div>);
};

const SchedulePanel=({vaccines,all})=>{
  const[open,setOpen]=useState(false);
  const missing=all.filter(rv=>!vaccines.find(v=>v.name===rv.name));
  return(<div style={{borderRadius:14,border:"1px solid #E8DDD0",overflow:"hidden"}}>
    <button onClick={()=>setOpen(p=>!p)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",background:"#FFFFFF",border:"none",cursor:"pointer",textAlign:"left"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{fontWeight:700,fontSize:14,color:"#2C2017"}}>Recommended Vaccine Schedule</div>{missing.length>0&&<span style={{background:"#E8A83820",color:"#E8A838",border:"1px solid #E8A83844",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{missing.length} not recorded</span>}</div>
      <span style={{color:"#8B7355",fontSize:18,transition:"transform .2s",display:"inline-block",transform:open?"rotate(180deg)":"rotate(0deg)"}}>›</span>
    </button>
    {open&&(<div style={{background:"#FAF6F0",borderTop:"1px solid #E8DDD0",padding:"4px 0"}}>{all.map(rv=>{const rec=vaccines.find(v=>v.name===rv.name);const isCore=CORE_V.includes(rv);return(<div key={rv.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #E8DDD044"}}><div><div style={{fontSize:13,fontWeight:600,color:"#2C2017"}}>{rv.name}</div><div style={{fontSize:11,color:"#8B7355",marginTop:2}}>{rv.note}</div></div>{rec?<Badge label="Recorded ✓" color="#2D7D6F"/>:<Badge label={isCore?"Required":"Optional"} color={isCore?"#E8A838":"#8B7355"}/>}</div>);})}</div>)}
  </div>);
};

const VaccinesTab=({dog,state,dispatch,userId,tier,onUpgrade})=>{
  const[modal,setModal]=useState(null);
  const[filter,setFilter]=useState("");
  const vaccines=state.vaccinations.filter(v=>v.dog_id===dog.id);
  const all=[...CORE_V,...OPT_V];
  const premium=isPremium(tier);
  const delVacc=async(id)=>{await db.deleteVaccination(id);dispatch({t:"DEL_VACC",id});};
  const filtered=vaccines.filter(v=>!filter||v.name.toLowerCase().includes(filter.toLowerCase()));
  const core=filtered.filter(v=>v.type==="core");
  const optional=filtered.filter(v=>v.type!=="core");

  const VaccCard=({v})=>{
    const st=vSt(v.next_due);
    const isOverdue=v.next_due&&daysUntil(v.next_due)<0;
    const isDueSoon=v.next_due&&daysUntil(v.next_due)>=0&&daysUntil(v.next_due)<=30;
    const borderColor=isOverdue?"#C4714A":isDueSoon?"#E8A838":"#2D7D6F";
    return(
      <div style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:14,borderLeft:`4px solid ${borderColor}`,overflow:"hidden",boxShadow:"0 2px 8px rgba(44,32,23,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px 8px"}}>
          <span style={{fontWeight:700,fontSize:15}}>{v.name}</span>
          <div style={{display:"flex",gap:5}}>
            {v.next_due&&<button title="Add to Calendar" onClick={()=>exportICS(dog.name,v.name,v.next_due)} style={{background:"#2D7D6F14",border:"1px solid #2D7D6F44",borderRadius:8,padding:"5px 8px",color:"#2D7D6F"}}><Ic n="cal" s={13}/></button>}
            <button onClick={()=>setModal({type:"edit",v})} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"5px 8px",color:"#5A4535"}}><Ic n="edit" s={13}/></button>
            <button onClick={()=>delVacc(v.id)} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderTop:"1px solid #F0E8DC",background:"#FAF6F0"}}>
          <div style={{padding:"10px 14px",borderRight:"1px solid #F0E8DC"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>Last Given</div>
            <div style={{fontSize:14,fontWeight:600,color:"#2C2017"}}>{fmt(v.date_given)||"—"}</div>
            {v.vet_name&&<div style={{fontSize:11,color:"#8B7355",marginTop:1}}>{v.vet_name}</div>}
          </div>
          <div style={{padding:"10px 14px",background:borderColor+"10"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#8B7355",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>Next Due</div>
            <div style={{fontSize:14,fontWeight:700,color:borderColor}}>{v.next_due?fmt(v.next_due):"Not set"}</div>
            <div style={{fontSize:11,color:borderColor,fontWeight:600,marginTop:1}}>{st.label}</div>
          </div>
        </div>
      </div>
    );
  };

  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h3 style={{fontFamily:"'Lora',serif",fontSize:20}}>Vaccinations {vaccines.length>0&&<span style={{fontSize:14,color:"#8B7355",fontFamily:"'Nunito',sans-serif"}}>({vaccines.length})</span>}</h3>
      <Btn sm onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Add</Btn>
    </div>
    {vaccines.length>2&&(
      <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search vaccines..."
        style={{background:"#FAF6F0",border:"1.5px solid #E8DDD0",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#2C2017",outline:"none",fontFamily:"'Nunito',sans-serif"}}/>
    )}
    {vaccines.length===0
      ?<Empty icon="syringe" title="No vaccinations yet" sub="Record your first vaccination to get started." action={<Btn onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Record Vaccination</Btn>}/>
      :<>
        {core.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#2D7D6F",textTransform:"uppercase",letterSpacing:".08em",display:"flex",alignItems:"center",gap:6,marginTop:4}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#2D7D6F",display:"inline-block"}}/>Core Vaccines
          </div>
          {core.map(v=><VaccCard key={v.id} v={v}/>)}
        </>}
        {optional.length>0&&<>
          <div style={{fontSize:11,fontWeight:800,color:"#8B7355",textTransform:"uppercase",letterSpacing:".08em",display:"flex",alignItems:"center",gap:6,marginTop:4}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#8B7355",display:"inline-block"}}/>Optional Vaccines
          </div>
          {optional.map(v=><VaccCard key={v.id} v={v}/>)}
        </>}
        {filter&&filtered.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#8B7355",fontSize:14}}>No vaccines matching "{filter}"</div>}
      </>}
    {premium?<SchedulePanel vaccines={vaccines} all={all}/>:<PremiumLock onUpgrade={onUpgrade} label="Vaccine Schedule — Premium Feature"/>}
    {modal?.type==="add"&&<VaccineForm dogId={dog.id} userId={userId} onSave={v=>{dispatch({t:"ADD_VACC",v});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="edit"&&<VaccineForm vacc={modal.v} dogId={dog.id} userId={userId} onSave={v=>{dispatch({t:"UPD_VACC",v});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);
};

const HealthTab=({dog,state,dispatch,userId,tier,onUpgrade})=>{
  const[modal,setModal]=useState(null);
  const[medFilter,setMedFilter]=useState("active"); // active | all
  const meds=state.medications.filter(m=>m.dog_id===dog.id);
  const al=state.allergies.filter(a=>a.dog_id===dog.id);
  const sevColor=s=>({mild:"#2D7D6F",moderate:"#E8A838",severe:"#C4714A"}[s]||"#E8A838");
  const sevBorder=s=>({mild:"#2D7D6F",moderate:"#E8A838",severe:"#C4714A"}[s]||"#E8A838");
  const delMed=async(id)=>{await db.deleteMedication(id);dispatch({t:"DEL_MED",id});};
  const delAlrg=async(id)=>{await db.deleteAllergy(id);dispatch({t:"DEL_ALRG",id});};

  // Sort allergies — severe first
  const sortedAllergies=[...al].sort((a,b)=>{const order={severe:0,moderate:1,mild:2};return(order[a.severity]||2)-(order[b.severity]||2);});
  const displayMeds=medFilter==="active"?meds.filter(m=>m.active):meds;

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h3 style={{fontFamily:"'Lora',serif",fontSize:20}}>Health</h3>
      <div style={{display:"flex",gap:8}}>
        <Btn sm v="secondary" onClick={()=>setModal({type:"addAlrg"})}><Ic n="alert" s={13}/> Allergy</Btn>
        <Btn sm onClick={()=>setModal({type:"addMed"})}><Ic n="pill" s={13}/> Med</Btn>
      </div>
    </div>

    {/* Allergies section */}
    <div style={{fontSize:11,fontWeight:800,color:"#C4714A",textTransform:"uppercase",letterSpacing:".08em",display:"flex",alignItems:"center",gap:6}}>
      <span style={{width:8,height:8,borderRadius:"50%",background:"#C4714A",display:"inline-block"}}/>
      Known Allergies {al.length>0&&`(${al.length})`}
    </div>
    {sortedAllergies.length===0
      ?<Card style={{borderStyle:"dashed"}}><div style={{color:"#5A4535",fontSize:14,textAlign:"center",padding:"12px 0"}}>No allergies recorded. <span style={{color:"#2D7D6F",cursor:"pointer"}} onClick={()=>setModal({type:"addAlrg"})}>Add one</span></div></Card>
      :sortedAllergies.map(a=>(
        <div key={a.id} style={{background:"#FFFFFF",border:`1px solid ${sevColor(a.severity)}44`,borderLeft:`5px solid ${sevBorder(a.severity)}`,borderRadius:"0 12px 12px 0",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",boxShadow:"0 2px 8px rgba(44,32,23,0.06)"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontWeight:700,fontSize:16}}>{a.allergen}</span>
              <span style={{background:sevColor(a.severity)+"20",color:sevColor(a.severity),border:`1px solid ${sevColor(a.severity)}40`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{a.severity.toUpperCase()}</span>
              {a.severity==="severe"&&<span style={{fontSize:12,color:"#C4714A",fontWeight:700}}>⚠ DO NOT EXPOSE</span>}
            </div>
            {a.reaction&&<div style={{fontSize:13,color:"#5A4535"}}>Reaction: {a.reaction}</div>}
            {a.date_discovered&&<div style={{fontSize:12,color:"#8B7355",marginTop:4}}>Identified: {fmt(a.date_discovered)}</div>}
          </div>
          <div style={{display:"flex",gap:5,marginLeft:10}}>
            <button onClick={()=>setModal({type:"editAlrg",a})} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"5px 8px",color:"#5A4535"}}><Ic n="edit" s={13}/></button>
            <button onClick={()=>delAlrg(a.id)} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>
      ))}

    {/* Medications section */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
      <div style={{fontSize:11,fontWeight:800,color:"#2D7D6F",textTransform:"uppercase",letterSpacing:".08em",display:"flex",alignItems:"center",gap:6}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:"#2D7D6F",display:"inline-block"}}/>
        Medications {meds.length>0&&`(${meds.length})`}
      </div>
      {meds.length>0&&(
        <div style={{display:"flex",gap:4,background:"#FAF6F0",borderRadius:8,padding:3,border:"1px solid #E8DDD0"}}>
          {["active","all"].map(f=>(
            <button key={f} onClick={()=>setMedFilter(f)} style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:medFilter===f?"#FFFFFF":"transparent",color:medFilter===f?"#2C2017":"#8B7355",boxShadow:medFilter===f?"0 1px 3px rgba(44,32,23,0.1)":"none"}}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>

    {displayMeds.length===0
      ?<Empty icon="pill" title={medFilter==="active"?"No active medications":"No medications"} sub="Add current or past medications." action={<Btn onClick={()=>setModal({type:"addMed"})}><Ic n="plus" s={14}/> Add Medication</Btn>}/>
      :displayMeds.map(m=>(
        <Card key={m.id} style={{borderLeft:`4px solid ${m.active?"#2D7D6F":"#E8DDD0"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontWeight:700,fontSize:15}}>{m.name}</span>
                <span style={{background:m.active?"#2D7D6F14":"#E8DDD033",color:m.active?"#2D7D6F":"#8B7355",fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:700}}>{m.active?"ACTIVE":"COMPLETED"}</span>
              </div>
              <div style={{fontSize:13,color:"#5A4535",marginBottom:4}}>
                {m.dosage&&<span>{m.dosage}</span>}
                {m.frequency&&<span> · {m.frequency}</span>}
              </div>
              {m.reason&&<div style={{fontSize:12,color:"#8B7355"}}>For: {m.reason}</div>}
              {m.prescribing_vet&&<div style={{fontSize:12,color:"#8B7355"}}>Rx: {m.prescribing_vet}</div>}
              <div style={{fontSize:12,color:"#8B7355",marginTop:2}}>
                Started: {fmt(m.start_date)}
                {m.end_date&&<span> · Ended: {fmt(m.end_date)}</span>}
              </div>
            </div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>setModal({type:"editMed",m})} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"5px 8px",color:"#5A4535"}}><Ic n="edit" s={13}/></button>
              <button onClick={()=>delMed(m.id)} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button>
            </div>
          </div>
        </Card>
      ))}

    {modal?.type==="addMed"&&<MedForm dogId={dog.id} userId={userId} onSave={m=>{dispatch({t:"ADD_MED",m});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="editMed"&&<MedForm med={modal.m} dogId={dog.id} userId={userId} onSave={m=>{dispatch({t:"UPD_MED",m});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="addAlrg"&&<AllergyForm dogId={dog.id} userId={userId} onSave={x=>{dispatch({t:"ADD_ALRG",x});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="editAlrg"&&<AllergyForm allergy={modal.a} dogId={dog.id} userId={userId} onSave={x=>{dispatch({t:"UPD_ALRG",x});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);
};


const RecordsTab=({dog,state,dispatch,userId})=>{
  const[modal,setModal]=useState(null);
  const[filter,setFilter]=useState("");
  const visits=state.visits.filter(v=>v.dog_id===dog.id).sort((a,b)=>b.visit_date.localeCompare(a.visit_date));
  const filtered=visits.filter(v=>!filter||v.reason?.toLowerCase().includes(filter.toLowerCase())||v.vet_name?.toLowerCase().includes(filter.toLowerCase())||v.diagnosis?.toLowerCase().includes(filter.toLowerCase()));
  const delVisit=async(id)=>{await db.deleteVisit(id);dispatch({t:"DEL_VISIT",id});};

  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h3 style={{fontFamily:"'Lora',serif",fontSize:20}}>Vet Visits {visits.length>0&&<span style={{fontSize:14,color:"#8B7355",fontFamily:"'Nunito',sans-serif"}}>({visits.length})</span>}</h3>
      <Btn sm onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Log Visit</Btn>
    </div>

    {visits.length>2&&(
      <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search visits by reason, vet, or diagnosis..."
        style={{background:"#FAF6F0",border:"1.5px solid #E8DDD0",borderRadius:10,padding:"9px 14px",fontSize:14,color:"#2C2017",outline:"none",fontFamily:"'Nunito',sans-serif"}}/>
    )}

    {visits.length===0
      ?<Empty icon="stethoscope" title="No visits logged" sub="Track every vet visit for a complete history." action={<Btn onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Log Visit</Btn>}/>
      :<div style={{position:"relative"}}>
        {/* Timeline line */}
        <div style={{position:"absolute",left:19,top:24,bottom:24,width:2,background:"#E8DDD0",zIndex:0}}/>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {filtered.map((v,idx)=>(
            <div key={v.id} style={{display:"flex",gap:14,paddingBottom:16,position:"relative"}}>
              {/* Timeline dot */}
              <div style={{flexShrink:0,width:40,display:"flex",flexDirection:"column",alignItems:"center",paddingTop:16}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:"#2D7D6F",border:"2px solid #FFFFFF",boxShadow:"0 0 0 2px #2D7D6F",zIndex:1}}/>
              </div>
              {/* Card */}
              <div style={{flex:1,background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:14,padding:"14px 16px",boxShadow:"0 2px 8px rgba(44,32,23,0.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:15,marginBottom:2}}>{v.reason}</div>
                    <div style={{fontSize:12,color:"#8B7355",display:"flex",alignItems:"center",gap:6}}>
                      <Ic n="cal" s={12} c="#8B7355"/>
                      {fmt(v.visit_date)}
                      {v.vet_name&&<><span>·</span>{v.vet_name}</>}
                      {v.clinic&&<><span>·</span>{v.clinic}</>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5,marginLeft:8}}>
                    <button onClick={()=>setModal({type:"edit",v})} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"5px 8px",color:"#5A4535"}}><Ic n="edit" s={13}/></button>
                    <button onClick={()=>delVisit(v.id)} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button>
                  </div>
                </div>
                {v.diagnosis&&<div style={{fontSize:13,color:"#2C2017",marginBottom:3}}><span style={{color:"#8B7355",fontWeight:600}}>Dx: </span>{v.diagnosis}</div>}
                {v.treatment&&<div style={{fontSize:13,color:"#2C2017",marginBottom:3}}><span style={{color:"#8B7355",fontWeight:600}}>Tx: </span>{v.treatment}</div>}
                {v.cost&&<div style={{fontSize:13,color:"#2D7D6F",fontWeight:600,marginTop:4}}>${v.cost}</div>}
              </div>
            </div>
          ))}
          {filter&&filtered.length===0&&<div style={{textAlign:"center",padding:"20px 40px",color:"#8B7355",fontSize:14}}>No visits matching "{filter}"</div>}
        </div>
      </div>}

    {modal?.type==="add"&&<VisitForm dogId={dog.id} userId={userId} onSave={v=>{dispatch({t:"ADD_VISIT",v});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="edit"&&<VisitForm visit={modal.v} dogId={dog.id} userId={userId} onSave={v=>{dispatch({t:"UPD_VISIT",v});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);
};


const MoreTab=({dog,state,dispatch,userId,tier,onUpgrade})=>{
  const[section,setSection]=useState(null);
  const[modal,setModal]=useState(null);
  const premium=isPremium(tier);
  const weights=state.weights.filter(w=>w.dog_id===dog.id).sort((a,b)=>a.log_date.localeCompare(b.log_date));
  const vets=state.vets;
  const docs=state.documents.filter(d=>d.dog_id===dog.id);
  const back=()=>setSection(null);
  const backBtn=<button onClick={back} style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:8,padding:"6px 8px",color:"#5A4535"}}><Ic n="chevL" s={16}/></button>;

  if(section==="weight")return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Lora',serif",fontSize:20,flex:1}}>Weight History</h3>{premium&&<Btn sm onClick={()=>setModal("addWeight")}><Ic n="plus" s={14}/> Log</Btn>}</div>
    {premium?<>
      {weights.length>=2&&(<Card><ResponsiveContainer width="100%" height={180}><LineChart data={weights.map(w=>({date:w.log_date.slice(5),weight:w.weight_lbs}))}><CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0"/><XAxis dataKey="date" stroke="#5A4535" tick={{fontSize:11}}/><YAxis stroke="#5A4535" tick={{fontSize:11}} domain={["auto","auto"]}/><Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:10,color:"#2C2017",fontSize:13}} formatter={v=>[v+" lbs","Weight"]}/><Line type="monotone" dataKey="weight" stroke="#2D7D6F" strokeWidth={2} dot={{r:3,fill:"#2D7D6F"}}/></LineChart></ResponsiveContainer></Card>)}
      {weights.length===0?<Empty icon="weight" title="No weight records" sub="Log weight at each vet visit to track trends." action={<Btn onClick={()=>setModal("addWeight")}><Ic n="plus" s={14}/> Log Weight</Btn>}/>:weights.slice().reverse().map(w=>(<Card key={w.id}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={{fontFamily:"'Lora',serif",fontSize:22,fontWeight:600}}>{w.weight_lbs}<span style={{fontSize:14,color:"#5A4535"}}> lbs</span></span><div style={{fontSize:12,color:"#5A4535",marginTop:2}}>{fmt(w.log_date)}{w.notes?` · ${w.notes}`:""}</div></div><button onClick={async()=>{await db.deleteWeight(w.id);dispatch({t:"DEL_WT",id:w.id});}} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button></div></Card>))}
      {modal==="addWeight"&&<Modal title="Log Weight" onClose={()=>setModal(null)}>
        {(()=>{const[wf,setWf]=useState({date:today(),weight:"",notes:""});return <div style={{display:"flex",flexDirection:"column",gap:12}}><Field label="Date"><input type="date" value={wf.date} onChange={e=>setWf(p=>({...p,date:e.target.value}))}/></Field><Field label="Weight (lbs)"><input type="number" step="0.1" value={wf.weight} onChange={e=>setWf(p=>({...p,weight:e.target.value}))} placeholder="55.2"/></Field><Field label="Notes"><input value={wf.notes} onChange={e=>setWf(p=>({...p,notes:e.target.value}))}/></Field><div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={()=>setModal(null)} full>Cancel</Btn><Btn onClick={async()=>{if(!wf.weight)return;const{data}=await db.addWeight(userId,{dogId:dog.id,date:wf.date,weight:parseFloat(wf.weight),notes:wf.notes});
                  if(data){
                    dispatch({t:"ADD_WT",w:data});
                    await supabase.from("dogs").update({weight:parseFloat(wf.weight)}).eq("id",dog.id);
                    dispatch({t:"UPD_DOG",d:{...dog,weight:parseFloat(wf.weight)}});
                  }
                  setModal(null);}} full>Save</Btn></div></div>;})()}
      </Modal>}
    </>:<PremiumLock onUpgrade={onUpgrade} label="Weight Tracking — Premium Feature"/>}
  </div>);

  if(section==="vets")return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Lora',serif",fontSize:20,flex:1}}>Saved Vets</h3><Btn sm onClick={()=>setModal({type:"addVet"})}><Ic n="plus" s={14}/> Add</Btn></div>
    <Btn full v="secondary" onClick={()=>window.open("https://www.google.com/maps/search/veterinarian+near+me","_blank")}><Ic n="map" s={15}/> Find Nearby Vets</Btn>
    {vets.map(v=>(<Card key={v.id}><div style={{display:"flex",justifyContent:"space-between"}}><div><div style={{fontWeight:600}}>{v.name}</div>{v.clinic&&<div style={{fontSize:13,color:"#5A4535"}}>{v.clinic}</div>}{v.phone&&<a href={`tel:${v.phone}`} style={{fontSize:13,color:"#2D7D6F",display:"flex",alignItems:"center",gap:4,marginTop:4,textDecoration:"none"}}><Ic n="phone" s={12} c="#2D7D6F"/>{v.phone}</a>}</div><button onClick={async()=>{await db.deleteSavedVet(v.id);dispatch({t:"DEL_VET",id:v.id});}} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button></div></Card>))}
    {modal?.type==="addVet"&&<Modal title="Save Vet Contact" onClose={()=>setModal(null)}>{(()=>{const[vf,setVf]=useState({name:"",clinic:"",phone:""});return <div style={{display:"flex",flexDirection:"column",gap:12}}><Field label="Vet Name"><input value={vf.name} onChange={e=>setVf(p=>({...p,name:e.target.value}))} placeholder="Dr. Johnson"/></Field><Field label="Clinic"><input value={vf.clinic} onChange={e=>setVf(p=>({...p,clinic:e.target.value}))}/></Field><Field label="Phone"><input value={vf.phone} onChange={e=>setVf(p=>({...p,phone:e.target.value}))}/></Field><div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={()=>setModal(null)} full>Cancel</Btn><Btn onClick={async()=>{if(!vf.name)return;const{data}=await db.addSavedVet(userId,vf);if(data)dispatch({t:"ADD_VET",v:data});setModal(null);}} full>Save</Btn></div></div>;})()}</Modal>}
  </div>);

  if(section==="docs")return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Lora',serif",fontSize:20,flex:1}}>Documents</h3>{premium&&<Btn sm onClick={()=>setModal("addDoc")}><Ic n="plus" s={14}/> Upload</Btn>}</div>
    {premium?<>{docs.length===0?<Empty icon="doc" title="No documents" sub="Upload photos or scans of vet records." action={<Btn onClick={()=>setModal("addDoc")}><Ic n="camera" s={14}/> Upload</Btn>}/>:docs.map(d=>(<Card key={d.id}><div style={{display:"flex",gap:12,alignItems:"flex-start"}}><div style={{width:56,height:56,borderRadius:10,background:"#FFFFFF",border:"1px solid #E8DDD0",display:"flex",alignItems:"center",justifyContent:"center",color:"#8B7355",flexShrink:0}}><Ic n="doc" s={22} c="#8B7355"/></div><div style={{flex:1}}><div style={{fontWeight:600}}>{d.name}</div><div style={{fontSize:12,color:"#5A4535",marginTop:2}}>{fmt(d.doc_date)}</div></div><button onClick={async()=>{await db.deleteDocument(d.id,d.file_path);dispatch({t:"DEL_DOC",id:d.id});}} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A"}}><Ic n="trash" s={13}/></button></div></Card>))}</>:<PremiumLock onUpgrade={onUpgrade} label="Document Storage — Premium Feature"/>}
  </div>);

  if(section==="qr"){
    if(!premium)return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Lora',serif",fontSize:20}}>QR Health Card</h3></div><PremiumLock onUpgrade={onUpgrade} label="QR Health Card — Premium Feature"/></div>);
    return <QRSection dog={dog} state={state} backBtn={backBtn}/>;
  }

  const tiles=[{id:"weight",icon:"weight",label:"Weight History",desc:"Track & chart weight over time",color:"#2D7D6F",locked:!premium},{id:"vets",icon:"map",label:"Saved Vets",desc:"Contacts + find vets nearby",color:"#2D7D6F",locked:false},{id:"docs",icon:"doc",label:"Documents",desc:"Upload vet records & certificates",color:"#E8A838",locked:!premium},{id:"qr",icon:"qr",label:"QR Health Card",desc:"Scannable card for any vet",color:"#5A4535",locked:!premium}];
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <h3 style={{fontFamily:"'Lora',serif",fontSize:20}}>More</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{tiles.map(tile=>(<Card key={tile.id} onClick={()=>setSection(tile.id)} style={{padding:20,opacity:tile.locked?.75:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{color:tile.color,marginBottom:8}}><Ic n={tile.icon} s={24} c={tile.color}/></div>{tile.locked&&<Ic n="lock" s={14} c="#5A4535"/>}</div><div style={{fontWeight:600,fontSize:15,marginBottom:4}}>{tile.label}</div><div style={{fontSize:12,color:"#5A4535"}}>{tile.desc}</div>{tile.locked&&<div style={{fontSize:11,color:"#E8A838",marginTop:6}}>✦ Premium</div>}</Card>))}</div>
    {!premium&&<Btn full onClick={onUpgrade} style={{background:"#E8A838",color:"#FAF6F0",justifyContent:"center"}}><Ic n="crown" s={15} c="#FAF6F0"/> Upgrade to Premium</Btn>}
  </div>);
};

const initState=()=>({dogs:[],vaccinations:[],medications:[],allergies:[],visits:[],weights:[],vets:[],documents:[]});
const reducer=(s,a)=>{
  switch(a.t){
    case"LOAD":return{...initState(),...a.s};
    case"ADD_DOG":return{...s,dogs:[...s.dogs,a.d]};
    case"UPD_DOG":return{...s,dogs:s.dogs.map(x=>x.id===a.d.id?a.d:x)};
    case"DEL_DOG":return{...s,dogs:s.dogs.filter(x=>x.id!==a.id)};
    case"ADD_VACC":return{...s,vaccinations:[...s.vaccinations,a.v]};
    case"UPD_VACC":return{...s,vaccinations:s.vaccinations.map(x=>x.id===a.v.id?a.v:x)};
    case"DEL_VACC":return{...s,vaccinations:s.vaccinations.filter(x=>x.id!==a.id)};
    case"ADD_MED":return{...s,medications:[...s.medications,a.m]};
    case"UPD_MED":return{...s,medications:s.medications.map(x=>x.id===a.m.id?a.m:x)};
    case"DEL_MED":return{...s,medications:s.medications.filter(x=>x.id!==a.id)};
    case"ADD_ALRG":return{...s,allergies:[...s.allergies,a.x]};
    case"UPD_ALRG":return{...s,allergies:s.allergies.map(x=>x.id===a.x.id?a.x:x)};
    case"DEL_ALRG":return{...s,allergies:s.allergies.filter(x=>x.id!==a.id)};
    case"ADD_VISIT":return{...s,visits:[...s.visits,a.v]};
    case"UPD_VISIT":return{...s,visits:s.visits.map(x=>x.id===a.v.id?a.v:x)};
    case"DEL_VISIT":return{...s,visits:s.visits.filter(x=>x.id!==a.id)};
    case"ADD_WT":return{...s,weights:[...s.weights,a.w]};
    case"DEL_WT":return{...s,weights:s.weights.filter(x=>x.id!==a.id)};
    case"ADD_VET":return{...s,vets:[...s.vets,a.v]};
    case"DEL_VET":return{...s,vets:s.vets.filter(x=>x.id!==a.id)};
    case"ADD_DOC":return{...s,documents:[...s.documents,a.doc]};
    case"DEL_DOC":return{...s,documents:s.documents.filter(x=>x.id!==a.id)};
    default:return s;
  }
};

const DogDetail=({dog,state,dispatch,userId,tier,onBack,onUpgrade,userEmail})=>{
  const[tab,setTab]=useState("overview");
  const[modal,setModal]=useState(null);
  const[showScan,setShowScan]=useState(false);
  const[showUpgrade,setShowUpgrade]=useState(false);
  const[showDelete,setShowDelete]=useState(false);
  const urgent=state.vaccinations.filter(v=>v.dog_id===dog.id&&v.next_due&&daysUntil(v.next_due)<=30).length;
  const premium=isPremium(tier);
  const upgrade=()=>setShowUpgrade(true);

  const handleDeletePet=async()=>{
    // Delete all related records first
    await Promise.all([
      supabase.from("vaccinations").delete().eq("dog_id",dog.id),
      supabase.from("medications").delete().eq("dog_id",dog.id),
      supabase.from("allergies").delete().eq("dog_id",dog.id),
      supabase.from("visits").delete().eq("dog_id",dog.id),
      supabase.from("weights").delete().eq("dog_id",dog.id),
      supabase.from("documents").delete().eq("dog_id",dog.id),
    ]);
    await supabase.from("dogs").delete().eq("id",dog.id);
    dispatch({t:"DEL_DOG",id:dog.id});
    onBack();
  };

  const ptLabel=petTypeLabel(dog.pet_type);
  const ptColor=petTypeColor(dog.pet_type);
  return(<div style={{minHeight:"100vh",background:"#FAF6F0",paddingBottom:80}}>
    <div style={{position:"sticky",top:0,zIndex:100}}>
      {/* Main header */}
      <div style={{background:"#1E5C52",padding:"14px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:680,margin:"0 auto"}}>
          <div style={{display:"flex",gap:6}}>
          <button onClick={onBack} title="Back to My Pets" style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:10,padding:"8px 10px",color:"#FFFFFF"}}><Ic n="chevL" s={18}/></button>
          <button onClick={onBack} title="Home" style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.3)",borderRadius:10,padding:"8px 10px",color:"#FFFFFF"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        </div>
          <Avatar dog={dog} size={40}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"'Lora',serif",fontSize:20,color:"#FFFFFF"}}>{dog.name}</div>
              {ptLabel&&ptColor&&<span style={{background:ptColor+"30",color:"#fff",border:`1px solid ${ptColor}66`,borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{ptLabel}</span>}
            </div>
            <div style={{color:"#F5C45E",fontSize:12}}>{dog.breed||"Dog"}</div>
          </div>
        </div>
      </div>
      {/* Sticky action bar */}
      <div style={{background:"#164D44",borderBottom:"1px solid #0D3830",padding:"8px 16px"}}>
        <div style={{display:"flex",gap:8,maxWidth:680,margin:"0 auto"}}>
          {[
            {label:"Edit",icon:"edit",action:()=>setModal("editDog"),always:true},
            {label:"Share",icon:"share",action:()=>setModal("share"),always:true},
            {label:"Export",icon:"download",action:()=>{exportHTML(dog,state);logActivity(userId,userEmail||null,'export_records',{petName:dog.name});},premium:true},
            {label:"AI Scan",icon:"camera",action:()=>setShowScan(true),premium:true},
          ].map(btn=>(
            <button key={btn.label} onClick={btn.always||premium?btn.action:upgrade}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                background:btn.label==="AI Scan"&&premium?"#2D7D6F":(btn.premium&&!premium?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.15)"),
                border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,padding:"7px 4px",
                color:btn.premium&&!premium?"#E8A838":"#FFFFFF",cursor:"pointer",transition:"opacity .15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              {btn.premium&&!premium
                ?<Ic n="lock" s={15} c="#E8A838"/>
                :<Ic n={btn.icon} s={15} c="#FFFFFF"/>}
              <span style={{fontSize:11,fontWeight:600}}>{btn.label}</span>
            </button>
          ))}
          <button onClick={()=>setShowDelete(true)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,
              background:"rgba(196,113,74,0.25)",border:"1px solid rgba(196,113,74,0.4)",
              borderRadius:10,padding:"7px 10px",color:"#FFAA88",cursor:"pointer",transition:"opacity .15s"}}
            onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
            onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
            <Ic n="trash" s={15} c="#FFAA88"/>
            <span style={{fontSize:11,fontWeight:600}}>Delete</span>
          </button>
        </div>
      </div>
    </div>
    <div style={{maxWidth:680,margin:"0 auto",padding:"18px 16px"}} className="fade">
      {tab==="overview"&&<OverviewTab dog={dog} state={state} userId={userId} tier={tier} setModal={setModal} onUpgrade={upgrade} onScan={()=>setShowScan(true)} dispatch={dispatch}/>}
      {tab==="vaccines"&&<VaccinesTab dog={dog} state={state} dispatch={dispatch} userId={userId} tier={tier} onUpgrade={upgrade}/>}
      {tab==="health"&&<HealthTab dog={dog} state={state} dispatch={dispatch} userId={userId} tier={tier} onUpgrade={upgrade}/>}
      {tab==="records"&&<RecordsTab dog={dog} state={state} dispatch={dispatch} userId={userId}/>}
      {tab==="more"&&<MoreTab dog={dog} state={state} dispatch={dispatch} userId={userId} tier={tier} onUpgrade={upgrade}/>}
    </div>
    <BottomNav tab={tab} setTab={setTab} alerts={urgent}/>
    {modal==="editDog"&&<DogForm dog={dog} userId={userId} userEmail={userEmail} onSave={d=>{dispatch({t:"UPD_DOG",d});setModal(null);}} onClose={()=>setModal(null)}/>}
    {showDelete&&<DeletePetModal dog={dog} onConfirm={handleDeletePet} onClose={()=>setShowDelete(false)}/>}
    {modal==="share"&&<ShareModal dog={dog} onClose={()=>setModal(null)}/>}
    {showScan&&<AIScanModal dog={dog} userId={userId} userEmail={userEmail} dispatch={dispatch} onSave={async()=>{const[{data:v},{data:m},{data:vis},{data:al}]=await Promise.all([db.getVaccinations(userId),db.getMedications(userId),db.getVisits(userId),db.getAllergies(userId)]);dispatch({t:'LOAD',s:{dogs:state.dogs,vaccinations:v||[],medications:m||[],allergies:al||[],visits:vis||[],weights:state.weights,vets:state.vets,documents:state.documents}});}} onClose={()=>setShowScan(false)}/>}
    {showUpgrade&&<UpgradeModal userId={userId} userEmail={userEmail} onClose={()=>setShowUpgrade(false)}/>}
  </div>);
};

const BillingSection=({userId,tier,userEmail})=>{
  const[portalLoading,setPortalLoading]=useState(false);
  const tierLabel=tier==='lifetime'?'Lifetime Premium':tier==='premium'?'Premium':'Free';
  const tierColor=tier==='lifetime'?'#E8A838':tier==='premium'?'#2D7D6F':'#8B7355';

  const openPortal=async()=>{
    setPortalLoading(true);
    try{
      const{data,error}=await supabase.functions.invoke("create-portal",{body:{userId,userEmail}});
      if(error||data.error)throw new Error(error?.message||data.error);
      window.location.href=data.url;
    }catch(e){alert("Could not open billing portal: "+e.message);}
    setPortalLoading(false);
  };

  return(
    <div>
      <div style={{fontWeight:800,fontSize:12,color:"#5A4535",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>💳 Billing & Plan</div>
      <div style={{background:"#FAF6F0",border:"1.5px solid #E8DDD0",borderRadius:12,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Current Plan</div>
            <div style={{fontSize:13,color:"#8B7355",marginTop:2}}>{userEmail}</div>
          </div>
          <span style={{background:tierColor+"20",color:tierColor,border:`1px solid ${tierColor}40`,borderRadius:20,padding:"4px 12px",fontSize:13,fontWeight:700}}>{tierLabel}</span>
        </div>
      </div>
      {tier==='free'
        ?<div style={{fontSize:13,color:"#5A4535"}}>You're on the free plan. Upgrade to unlock AI scanning, travel tools, exports, and more.</div>
        :tier!=='lifetime'&&<Btn full v="secondary" onClick={openPortal} disabled={portalLoading} style={{justifyContent:"center"}}>{portalLoading?"Opening...":"Manage Subscription / Cancel"}</Btn>}
      {tier==='lifetime'&&<div style={{fontSize:13,color:"#2D7D6F",fontWeight:600,textAlign:"center",padding:"8px 0"}}>✓ Lifetime access — no subscription needed</div>}
    </div>
  );
};

const OwnerProfileModal=({userId,tier,userEmail,onUpgrade,onClose})=>{
  const[f,setF]=useState({fullName:"",phoneCode:"+1",phone:"",whatsapp:"",whatsappCode:"+1",country:"",city:"",state:"",zip:"",address:"",instagram:"",facebook:"",twitter:"",photo:""});
  const[contacts,setContacts]=useState([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[addingContact,setAddingContact]=useState(false);
  const[newContact,setNewContact]=useState({name:"",phoneCode:"+1",phone:"",whatsappCode:"+1",whatsapp:"",relationship:"",email:""});
  const[section,setSection]=useState("profile"); // profile | billing
  const profPhotoRef=useRef();
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    const load=async()=>{
      const{data:prof}=await supabase.from("profiles").select("*").eq("id",userId).single();
      if(prof)setF({fullName:prof.full_name||"",phoneCode:prof.phone_country_code||"+1",phone:prof.phone||"",whatsapp:prof.whatsapp||"",whatsappCode:prof.whatsapp_country_code||"+1",country:prof.country||"",city:prof.city||"",state:prof.state||"",zip:prof.zip||"",address:prof.address||"",instagram:prof.instagram||"",facebook:prof.facebook||"",twitter:prof.twitter||"",photo:prof.photo_url||""});
      const{data:ec}=await supabase.from("emergency_contacts").select("*").eq("user_id",userId).order("sort_order");
      setContacts(ec||[]);
      setLoading(false);
    };
    load();
  },[userId]);

  const saveProfile=async()=>{
    setSaving(true);
    const profUpdate={full_name:f.fullName,phone:f.phone,phone_country_code:f.phoneCode,whatsapp:f.whatsapp,whatsapp_country_code:f.whatsappCode,address:f.address,city:f.city,state:f.state,zip:f.zip,country:f.country,instagram:f.instagram,facebook:f.facebook,twitter:f.twitter};
    if(f.photo&&f.photo.startsWith("data:")){
      const blob=await(await fetch(f.photo)).blob();
      const path=`${userId}/profile_photo.jpg`;
      await supabase.storage.from("documents").upload(path,blob,{upsert:true,contentType:"image/jpeg"});
      const{data:urlData}=supabase.storage.from("documents").getPublicUrl(path);
      profUpdate.photo_url=urlData.publicUrl;
    }
    await supabase.from("profiles").update(profUpdate).eq("id",userId);
    setSaving(false);
  };

  const addContact=async()=>{
    if(!newContact.name||!newContact.phone)return;
    const{data}=await supabase.from("emergency_contacts").insert({user_id:userId,...newContact,sort_order:contacts.length}).select().single();
    if(data){setContacts(p=>[...p,data]);setNewContact({name:"",phoneCode:"+1",phone:"",whatsappCode:"+1",whatsapp:"",relationship:"",email:""});setAddingContact(false);}
  };

  const deleteContact=async(id)=>{
    await supabase.from("emergency_contacts").delete().eq("id",id);
    setContacts(p=>p.filter(x=>x.id!==id));
  };

  if(loading)return(<Modal title="My Account" onClose={onClose}><div style={{textAlign:"center",padding:40,color:"#8B7355"}}>Loading...</div></Modal>);

  return(<Modal title="My Account" onClose={onClose} wide>
    {/* Tab nav */}
    <div style={{display:"flex",gap:8,marginBottom:20,background:"#FAF6F0",borderRadius:12,padding:4}}>
      {[{id:"profile",label:"👤 Profile"},{id:"billing",label:"💳 Billing"}].map(t=>(
        <button key={t.id} onClick={()=>setSection(t.id)} style={{flex:1,padding:"9px 0",borderRadius:10,fontWeight:600,fontSize:14,border:"none",cursor:"pointer",background:section===t.id?"#FFFFFF":"transparent",color:section===t.id?"#2C2017":"#8B7355",boxShadow:section===t.id?"0 1px 4px rgba(44,32,23,0.1)":"none",transition:"all .15s"}}>{t.label}</button>
      ))}
    </div>

    {section==="profile"&&<div style={{display:"flex",flexDirection:"column",gap:18}}>
      {/* Basic info */}
      <div>
        <div style={{fontWeight:800,fontSize:12,color:"#5A4535",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>👤 Your Information</div>
        {/* Profile Photo */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:8}}>
          <div style={{position:"relative",cursor:"pointer"}} onClick={()=>profPhotoRef.current.click()}>
            {f.photo
              ?<img src={f.photo} style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #2D7D6F"}}/>
              :<div style={{width:80,height:80,borderRadius:"50%",background:"#FFFFFF",border:"2px dashed #E8DDD0",display:"flex",alignItems:"center",justifyContent:"center",color:"#5A4535"}}><Ic n="camera" s={24} c="#5A4535"/></div>}
            <div style={{position:"absolute",bottom:0,right:0,background:"#2D7D6F",borderRadius:"50%",padding:5}}><Ic n="camera" s={11} c="#FAF6F0"/></div>
          </div>
          <input ref={profPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>set("photo",ev.target.result);r.readAsDataURL(file);}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Full Name" col="1/-1"><input value={f.fullName} onChange={e=>set("fullName",e.target.value)} placeholder="Jane Smith"/></Field>
          <Field label="Phone Country Code">
            <select value={f.phoneCode} onChange={e=>set("phoneCode",e.target.value)}>
              {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
            </select>
          </Field>
          <Field label="Phone Number">
            <input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="555-0100"/>
          </Field>
          <Field label="WhatsApp Country Code">
            <select value={f.whatsappCode} onChange={e=>set("whatsappCode",e.target.value)}>
              {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.name} ({c.code})</option>)}
            </select>
          </Field>
          <Field label="WhatsApp Number">
            <input value={f.whatsapp} onChange={e=>set("whatsapp",e.target.value)} placeholder="Same or different number"/>
          </Field>
          <Field label="Country"><input value={f.country} onChange={e=>set("country",e.target.value)} placeholder="United States"/></Field>
          <Field label="Address" col="1/-1"><input value={f.address} onChange={e=>set("address",e.target.value)} placeholder="123 Main St"/></Field>
          <Field label="City"><input value={f.city} onChange={e=>set("city",e.target.value)} placeholder="Miami"/></Field>
          <Field label="ZIP / Postal Code"><input value={f.zip||""} onChange={e=>set("zip",e.target.value)} placeholder="33101"/></Field>
          <Field label="State/Province" col="1/-1">
            {f.country===""||f.country==="United States"||f.country==="USA"||f.country==="US"
              ?<select value={f.state} onChange={e=>set("state",e.target.value)}>
                <option value="">Select state...</option>
                {US_STATES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              :<input value={f.state} onChange={e=>set("state",e.target.value)} placeholder="State / Province / Region"/>}
          </Field>
        </div>
      </div>
      {/* Social */}
      <div>
        <div style={{fontWeight:800,fontSize:12,color:"#5A4535",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>📱 Social Media</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20,width:28}}>📸</span><input value={f.instagram} onChange={e=>set("instagram",e.target.value)} placeholder="Instagram (@yourhandle)"/></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20,width:28}}>👤</span><input value={f.facebook} onChange={e=>set("facebook",e.target.value)} placeholder="Facebook profile URL"/></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:20,width:28}}>🐦</span><input value={f.twitter} onChange={e=>set("twitter",e.target.value)} placeholder="X/Twitter (@yourhandle)"/></div>
        </div>
      </div>
      <Btn onClick={saveProfile} disabled={saving} full>{saving?"Saving...":"Save Profile"}</Btn>
      {/* Emergency Contacts */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontWeight:800,fontSize:12,color:"#5A4535",textTransform:"uppercase",letterSpacing:".08em"}}>🚨 Emergency Contacts</div>
          <Btn sm onClick={()=>setAddingContact(true)}><Ic n="plus" s={13}/> Add</Btn>
        </div>
        <div style={{fontSize:13,color:"#8B7355",marginBottom:12}}>Appear on QR codes and exported records.</div>
        {contacts.length===0&&!addingContact&&<div style={{textAlign:"center",padding:"16px 0",color:"#8B7355",fontSize:14,border:"1.5px dashed #E8DDD0",borderRadius:12}}>No emergency contacts yet.</div>}
        {contacts.map(ec=>(<div key={ec.id} style={{background:"#FAF6F0",border:"1px solid #E8DDD0",borderRadius:12,padding:14,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontWeight:700,fontSize:15}}>{ec.name}</div><div style={{fontSize:13,color:"#5A4535"}}>{ec.relationship&&<span>{ec.relationship} · </span>}<a href={`tel:${ec.phone}`} style={{color:"#2D7D6F",textDecoration:"none"}}>{ec.phone}</a></div>{ec.email&&<div style={{fontSize:12,color:"#8B7355"}}>{ec.email}</div>}</div>
            <button onClick={()=>deleteContact(ec.id)} style={{background:"#C4714A14",border:"1px solid #C4714A44",borderRadius:8,padding:"5px 8px",color:"#C4714A",cursor:"pointer"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>))}
        {addingContact&&(<div style={{background:"#FAF6F0",border:"1.5px solid #2D7D6F44",borderRadius:12,padding:16,marginTop:8}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <Field label="Name" col="1/-1"><input value={newContact.name} onChange={e=>setNewContact(p=>({...p,name:e.target.value}))} placeholder="Jane Doe"/></Field>
            <Field label="Phone Code">
              <select value={newContact.phoneCode||"+1"} onChange={e=>setNewContact(p=>({...p,phoneCode:e.target.value}))}>
                {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </Field>
            <Field label="Phone Number"><input value={newContact.phone} onChange={e=>setNewContact(p=>({...p,phone:e.target.value}))} placeholder="555-0100"/></Field>
            <Field label="Relationship"><input value={newContact.relationship} onChange={e=>setNewContact(p=>({...p,relationship:e.target.value}))} placeholder="Sister, Vet, Friend"/></Field>
            <Field label="WhatsApp Code">
              <select value={newContact.whatsappCode||"+1"} onChange={e=>setNewContact(p=>({...p,whatsappCode:e.target.value}))}>
                {COUNTRY_CODES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </Field>
            <Field label="WhatsApp"><input value={newContact.whatsapp||""} onChange={e=>setNewContact(p=>({...p,whatsapp:e.target.value}))} placeholder="WhatsApp number"/></Field>
            <Field label="Email" col="1/-1"><input value={newContact.email} onChange={e=>setNewContact(p=>({...p,email:e.target.value}))} placeholder="jane@email.com"/></Field>
          </div>
          <div style={{display:"flex",gap:8}}><Btn v="secondary" sm onClick={()=>setAddingContact(false)} full>Cancel</Btn><Btn sm onClick={addContact} full>Save Contact</Btn></div>
        </div>)}
      </div>
    </div>}

    {section==="billing"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
      <BillingSection userId={userId} tier={tier} userEmail={userEmail}/>
      {tier==="free"&&<Btn full onClick={onUpgrade} style={{background:"#E8A838",color:"#FAF6F0",justifyContent:"center"}}><Ic n="crown" s={15} c="#FAF6F0"/> Upgrade to Premium</Btn>}
    </div>}
  </Modal>);
};

const Home=({state,dispatch,userId,tier,userEmail,onSignOut,isAdmin,onOpenAdmin})=>{
  const[addDog,setAddDog]=useState(false);
  const[selDog,setSelDog]=useState(null);
  const[showUpgrade,setShowUpgrade]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[errorCount,setErrorCount]=useState(0);
  const premium=isPremium(tier);

  useEffect(()=>{
    if(!isAdmin)return;
    const checkErrors=async()=>{
      try{
        const{data:{session}}=await supabase.auth.getSession();
        const token=session?.access_token;
        const res=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({type:'error_count'})});
        const d=await res.json();
        setErrorCount(d.count||0);
      }catch(e){console.error('Error count check failed:',e);}
    };
    checkErrors();
    const interval=setInterval(checkErrors,60000);
    return()=>clearInterval(interval);
  },[isAdmin]);

  if(selDog){
    const dog=state.dogs.find(d=>d.id===selDog);
    if(dog)return <DogDetail dog={dog} state={state} dispatch={dispatch} userId={userId} tier={tier} userEmail={userEmail} onBack={()=>setSelDog(null)} onUpgrade={()=>setShowUpgrade(true)}/>;
  }

  const totalAlerts=state.vaccinations.filter(v=>v.next_due&&daysUntil(v.next_due)<=30).length;
  return(<div style={{minHeight:"100vh",background:"#FAF6F0"}}>
    <div style={{background:"#1E5C52",padding:"16px 16px"}}>
      <div style={{maxWidth:680,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <button onClick={()=>{setSelDog(null);window.scrollTo(0,0);}} style={{background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>
            <div style={{fontFamily:"'Lora',serif",fontSize:28,color:"#FFFFFF"}}>🐾 <span style={{fontWeight:900}}>Your</span><span style={{color:"#F5C45E",fontWeight:900}}>Pet</span><span style={{fontWeight:900}}>Pass</span></div>
            <div style={{fontSize:13,color:"#F5C45E",marginTop:1,fontStyle:"italic",fontFamily:"Lora,serif"}}>Your pet's health passport</div>
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {!premium&&<button onClick={()=>setShowUpgrade(true)} style={{background:"#E8A83820",border:"1px solid #E8A83844",borderRadius:10,padding:"7px 12px",color:"#E8A838",fontWeight:600,fontSize:12,display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}><Ic n="crown" s={13} c="#E8A838"/>Premium</button>}
          {totalAlerts>0&&<div style={{background:"#E8A83814",border:"1px solid #E8A83844",borderRadius:10,padding:"7px 12px",display:"flex",alignItems:"center",gap:5,color:"#E8A838",fontSize:13}}><Ic n="alert" s={14} c="#E8A838"/>{totalAlerts}</div>}
          <button onClick={()=>setShowProfile(true)} title="My Account" style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:10,padding:"7px 10px",color:"#5A4535",cursor:"pointer"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A4535" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </button>
          {isAdmin&&<button onClick={onOpenAdmin} title="Admin Dashboard" style={{position:"relative",background:"#1E5C52",border:"1px solid #2D7D6F44",borderRadius:10,padding:"7px 10px",color:"#FFFFFF",cursor:"pointer",fontSize:11,fontWeight:700}}>
  ⚙ Admin
  {errorCount>0&&<span style={{position:"absolute",top:-6,right:-6,background:"#C4714A",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{errorCount}</span>}
</button>}
          <button onClick={onSignOut} title="Sign out" style={{background:"#FFFFFF",border:"1px solid #E8DDD0",borderRadius:10,padding:"7px 10px",color:"#5A4535",cursor:"pointer"}}><Ic n="logout" s={16} c="#5A4535"/></button>
        </div>
      </div>
    </div>
    <div style={{maxWidth:680,margin:"0 auto",padding:"20px 16px"}}>
      {state.dogs.length===0?(<div style={{textAlign:"center",paddingTop:60}}>
        <div style={{fontSize:56,marginBottom:14}}>🐕</div>
        <div style={{fontFamily:"'Lora',serif",fontSize:28,marginBottom:8,fontStyle:"italic"}}>Welcome to YourPetPass</div>
        <div style={{color:"#5A4535",marginBottom:28,fontSize:15,lineHeight:1.7}}>Keep your pet's health records organized,<br/>vaccination schedules on track, and every<br/>document ready when you travel.</div>
        <Btn onClick={()=>setAddDog(true)} style={{margin:"0 auto",fontSize:16,padding:"14px 28px"}}><Ic n="plus" s={16}/> Add Your First Pet</Btn>
      </div>):(<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h2 style={{fontFamily:"'Lora',serif",fontSize:22}}>My Pets</h2><Btn sm onClick={()=>setAddDog(true)}><Ic n="plus" s={14}/> Add Pet</Btn></div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {state.dogs.map(dog=>{
            const dv=state.vaccinations.filter(v=>v.dog_id===dog.id);
            const overdue=dv.filter(v=>v.next_due&&daysUntil(v.next_due)<0).length;
            const upcoming=dv.filter(v=>v.next_due&&daysUntil(v.next_due)>=0&&daysUntil(v.next_due)<=30).length;
            const activeMeds=state.medications.filter(m=>m.dog_id===dog.id&&m.active).length;
            const allergyCount=state.allergies.filter(a=>a.dog_id===dog.id).length;
            const age=dog.dob?Math.floor((Date.now()-new Date(dog.dob+"T12:00:00"))/(365.25*86400000)):null;
            const ptLabel=petTypeLabel(dog.pet_type);
            const ptColor=petTypeColor(dog.pet_type);
            return(<Card key={dog.id} onClick={()=>setSelDog(dog.id)}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <Avatar dog={dog} size={52}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Lora',serif",fontSize:18}}>{dog.name}</div>
                  <div style={{color:"#5A4535",fontSize:13,marginBottom:8}}>{dog.breed||"Dog"}{age!==null?` · ${age}yr`:""}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {ptLabel&&ptColor&&<Badge label={ptLabel} color={ptColor}/>}
                    {overdue>0&&<Badge label={`${overdue} overdue`} color="#C4714A"/>}
                    {upcoming>0&&!overdue&&<Badge label={`${upcoming} due soon`} color="#E8A838"/>}
                    {dv.length>0&&!overdue&&!upcoming&&<Badge label="Up to date ✓" color="#2D7D6F"/>}
                    {activeMeds>0&&<Badge label={`${activeMeds} med${activeMeds>1?"s":""}`} color="#2D7D6F"/>}
                    {allergyCount>0&&<Badge label={`${allergyCount} allerg${allergyCount>1?"ies":"y"}`} color="#C4714A"/>}
                  </div>
                </div>
                <Ic n="chevR" s={18} c="#8B7355"/>
              </div>
            </Card>);
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:18}}>
          {[{l:"Pets",v:state.dogs.length,i:"paw",c:"#2D7D6F"},{l:"Vaccines",v:state.vaccinations.length,i:"syringe",c:"#2D7D6F"},{l:"Visits",v:state.visits.length,i:"stethoscope",c:"#5A4535"}].map(s=>(<Card key={s.l} style={{padding:14,textAlign:"center"}}><div style={{color:s.c,marginBottom:6}}><Ic n={s.i} s={18} c={s.c}/></div><div style={{fontFamily:"'Lora',serif",fontSize:22}}>{s.v}</div><div style={{fontSize:11,color:"#5A4535"}}>{s.l}</div></Card>))}
        </div>
      </>)}
    </div>
    {addDog&&<DogForm userId={userId} userEmail={userEmail} onSave={d=>{dispatch({t:"ADD_DOG",d});setAddDog(false);}} onClose={()=>setAddDog(false)}/>}
    {showUpgrade&&<UpgradeModal userId={userId} userEmail={userEmail} onClose={()=>setShowUpgrade(false)}/>}
    {showProfile&&<OwnerProfileModal userId={userId} tier={tier} userEmail={userEmail} onUpgrade={()=>{setShowProfile(false);setShowUpgrade(true);}} onClose={()=>setShowProfile(false)}/>}
  </div>);
};

export default function YourPetPass({userId,profile,onSignOut,isAdmin,onOpenAdmin}){
  const[state,dispatch]=useReducer(reducer,null,initState);
  const[ready,setReady]=useState(false);
  const[tier,setTier]=useState("free");
  const[userEmail,setUserEmail]=useState("");

  useEffect(()=>{
    const load=async()=>{
      const{data:prof}=await supabase.from("profiles").select("*").eq("id",userId).single();
      if(prof){setTier(prof.subscription_tier||"free");setUserEmail(prof.email||"");}
      const[{data:dogs},{data:vacc},{data:meds},{data:alrg},{data:visits},{data:weights},{data:vets},{data:docs}]=await Promise.all([
        supabase.from("dogs").select("*").eq("user_id",userId).order("created_at"),
        db.getVaccinations(userId),db.getMedications(userId),db.getAllergies(userId),
        db.getVisits(userId),db.getWeights(userId),db.getSavedVets(userId),db.getDocuments(userId)
      ]);
      dispatch({t:"LOAD",s:{dogs:dogs||[],vaccinations:vacc||[],medications:meds||[],allergies:alrg||[],visits:visits||[],weights:weights||[],vets:vets||[],documents:docs||[]}});
      setReady(true);
    };
    load();
    const params=new URLSearchParams(window.location.search);
    if(params.get("payment")==="success"){window.history.replaceState({},"",window.location.pathname);setTimeout(()=>load(),2000);}
  },[userId]);

  if(!ready)return(<div style={{minHeight:"100vh",background:"#FAF6F0",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:"'Nunito',sans-serif",fontSize:28,fontWeight:900,color:"#2D7D6F"}}>🐾 Loading...</div></div>);

  return(
    <ErrorBoundary>
      <style>{GLOBAL}</style>
      <Home state={state} dispatch={dispatch} userId={userId} tier={tier} userEmail={userEmail} onSignOut={onSignOut} isAdmin={isAdmin} onOpenAdmin={onOpenAdmin}/>
    </ErrorBoundary>
  );
}
