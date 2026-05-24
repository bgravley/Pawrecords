import { useReducer, useState, useEffect, useRef, Component } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const C = {
  bg:"#07090f",surface:"#0e1219",card:"#141b27",border:"#1c2438",
  accent:"#2dd4bf",accentDim:"#2dd4bf14",warn:"#fb923c",warnDim:"#fb923c14",
  danger:"#f87171",dangerDim:"#f8717114",blue:"#60a5fa",blueDim:"#60a5fa14",
  gold:"#fbbf24",purple:"#c084fc",text:"#eef2ff",sub:"#7c8fac",muted:"#2d3a50",navH:64,
};

const GLOBAL=`
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;overscroll-behavior:none}
  body{background:#07090f;color:#eef2ff;font-family:'Outfit',sans-serif;font-size:15px;-webkit-font-smoothing:antialiased}
  input,select,textarea{font-family:'Outfit',sans-serif;font-size:14px;background:#0e1219;color:#eef2ff;
    border:1.5px solid #1c2438;border-radius:10px;padding:10px 14px;width:100%;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus,select:focus,textarea:focus{border-color:#2dd4bf;box-shadow:0 0 0 3px #2dd4bf14}
  select option{background:#0e1219} button{font-family:'Outfit',sans-serif;cursor:pointer;border:none}
  button:active{transform:scale(.97)} ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-thumb{background:#1c2438;border-radius:4px}
  .fade{animation:fu .22s ease}
  @keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;

const CORE_V=[
  {name:"Rabies",dur:12,note:"Required by law in most US states. Ask vet about 1-yr vs 3-yr."},
  {name:"DHPP",dur:36,note:"Distemper, Hepatitis, Parvovirus, Parainfluenza. Core after puppy series."},
  {name:"DA2PP",dur:36,note:"Adenovirus type 2; often interchangeable with DHPP."},
];
const OPT_V=[
  {name:"Bordetella",dur:12,note:"Recommended for boarding, grooming, or dog parks."},
  {name:"Leptospirosis",dur:12,note:"For dogs near wildlife or standing water."},
  {name:"Lyme Disease",dur:12,note:"Recommended in tick-endemic regions."},
  {name:"Canine Influenza",dur:12,note:"For dogs in frequent close contact with others."},
  {name:"Rattlesnake Vaccine",dur:6,note:"For dogs in rattlesnake-prone areas."},
];

// STORAGE — split keys, one per entity type; each document file = own key
const K={
  dogs:"pr2_dogs",vacc:"pr2_vacc",meds:"pr2_meds",alrg:"pr2_alrg",
  visits:"pr2_visits",weights:"pr2_weights",vets:"pr2_vets",docsIdx:"pr2_docs_idx",
  docFile:id=>`pr2_df_${id}`,
};
const sg=async k=>{try{const r=await window.storage.get(k);return r?JSON.parse(r.value):null}catch{return null}};
const ss=async(k,v)=>{try{await window.storage.set(k,JSON.stringify(v))}catch(e){console.error("StorageWrite:",k,e)}};

const RUSTY={id:"rusty-default",name:"Rusty",breed:"Mixed",gender:"male",neutered:true,weight:"25",dob:"",color:"",microchip:"",emergencyContact:"",emergencyPhone:"",notes:"Test dog — delete when ready.",photo:""};

const loadAll=async()=>{
  const[dogs,vacc,meds,alrg,visits,weights,vets,docsIdx]=await Promise.all([
    sg(K.dogs),sg(K.vacc),sg(K.meds),sg(K.alrg),sg(K.visits),sg(K.weights),sg(K.vets),sg(K.docsIdx)]);
  const idx=docsIdx||[];
  const files=await Promise.all(idx.map(d=>sg(K.docFile(d.id))));
  // Seed Rusty if no dogs have ever been saved
  const seedDogs=(dogs&&dogs.length>0)?dogs:[RUSTY];
  return{dogs:seedDogs,vaccinations:vacc||[],medications:meds||[],allergies:alrg||[],
    visits:visits||[],weights:weights||[],vets:vets||[],
    documents:idx.map((d,i)=>({...d,fileData:files[i]||null}))};
};
const persistAll=async s=>{
  const{documents}=s;
  await Promise.all([
    ss(K.dogs,s.dogs),ss(K.vacc,s.vaccinations),ss(K.meds,s.medications),
    ss(K.alrg,s.allergies),ss(K.visits,s.visits),ss(K.weights,s.weights),ss(K.vets,s.vets),
    ss(K.docsIdx,documents.map(({fileData,...m})=>m)),
    ...documents.map(d=>d.fileData?ss(K.docFile(d.id),d.fileData):Promise.resolve()),
  ]);
};

// UTILS
const uid=()=>Math.random().toString(36).slice(2,9);
const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>{if(!d)return"—";return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})};
const addM=(d,m)=>{const dt=new Date(d+"T12:00:00");dt.setMonth(dt.getMonth()+parseInt(m));return dt.toISOString().slice(0,10)};
const daysUntil=d=>{if(!d)return null;const n=new Date();n.setHours(12,0,0,0);return Math.round((new Date(d+"T12:00:00")-n)/86400000)};
const vSt=due=>{const d=daysUntil(due);if(d===null)return{c:"#2d3a50",label:"Not recorded"};if(d<0)return{c:"#f87171",label:`Overdue ${Math.abs(d)}d`};if(d===0)return{c:"#fb923c",label:"Due today!"};if(d<=30)return{c:"#fb923c",label:`Due in ${d}d`};return{c:"#2dd4bf",label:`Due ${fmt(due)}`}};

const exportICS=(dogName,vacName,due)=>{
  const d=new Date(due+"T09:00:00"),p=n=>String(n).padStart(2,"0");
  const ts=`${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T090000`;
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//PawRecord//EN","BEGIN:VEVENT",
    `DTSTART:${ts}`,`DTEND:${ts}`,`SUMMARY:${dogName} — ${vacName} due`,
    `DESCRIPTION:${vacName} vaccination due for ${dogName}. Managed in PawRecord.`,
    "STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar"}));
  a.download=`${dogName}_${vacName.replace(/\s+/g,"_")}.ics`;a.click();
};

const exportHTML=(dog,state)=>{
  const v=state.vaccinations.filter(x=>x.dogId===dog.id);
  const m=state.medications.filter(x=>x.dogId===dog.id);
  const al=state.allergies.filter(x=>x.dogId===dog.id);
  const vs=state.visits.filter(x=>x.dogId===dog.id).sort((a,b)=>b.date.localeCompare(a.date));
  const row=(l,val)=>`<tr><td class="lbl">${l}</td><td>${val||"—"}</td></tr>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${dog.name} Medical Records</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111}
h1{font-size:26px;margin-bottom:4px}.gen{color:#666;font-size:13px;margin-bottom:32px}
h2{font-size:14px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:6px;margin:28px 0 14px}
table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f2f2f2;padding:8px 10px;text-align:left}
td{padding:8px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top}.lbl{color:#666;width:140px}
.core{background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}
.opt{background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:20px;font-size:11px}
.severe{background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:20px;font-size:11px}
.moderate{background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;font-size:11px}
.mild{background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px}
footer{margin-top:48px;color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:16px}
@media print{body{margin:16px}}</style></head><body>
<h1>🐾 ${dog.name}'s Medical Records</h1>
<div class="gen">Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})} · PawRecord</div>
<h2>Profile</h2><table>${row("Name","<b>"+dog.name+"</b>")}${row("Breed",dog.breed)}${row("Date of Birth",fmt(dog.dob))}
${row("Weight",dog.weight?dog.weight+" lbs":"")}${row("Gender",(dog.gender||"")+" "+(dog.neutered?"(neutered/spayed)":""))}
${row("Microchip",dog.microchip)}${dog.emergencyContact?row("Emergency Contact","<b>"+dog.emergencyContact+"</b> · "+(dog.emergencyPhone||"")):""}
</table>${dog.notes?`<p style="font-size:13px;color:#555;margin-top:8px"><b>Notes:</b> ${dog.notes}</p>`:""}
${al.length?`<h2>⚠️ Allergies — Inform every vet</h2><table><tr><th>Allergen</th><th>Reaction</th><th>Severity</th><th>Discovered</th></tr>
${al.map(a=>`<tr><td><b>${a.allergen}</b></td><td>${a.reaction}</td><td><span class="${a.severity}">${a.severity.toUpperCase()}</span></td><td>${fmt(a.dateDiscovered)}</td></tr>`).join("")}</table>`:""}
<h2>Vaccinations</h2>${v.length?`<table><tr><th>Vaccine</th><th>Type</th><th>Given</th><th>Next Due</th><th>Vet</th></tr>
${v.map(x=>`<tr><td><b>${x.name}</b></td><td><span class="${x.type==="core"?"core":"opt"}">${x.type==="core"?"CORE":"OPT"}</span></td><td>${fmt(x.dateGiven)}</td><td>${fmt(x.nextDue)}</td><td>${x.vetName||"—"}</td></tr>`).join("")}</table>`:"<p style='color:#666'>No vaccinations recorded.</p>"}
${m.length?`<h2>Medications</h2><table><tr><th>Medication</th><th>Dosage</th><th>Frequency</th><th>Start</th><th>End</th></tr>
${m.map(x=>`<tr><td><b>${x.name}</b></td><td>${x.dosage}</td><td>${x.frequency}</td><td>${fmt(x.startDate)}</td><td>${fmt(x.endDate)||"Ongoing"}</td></tr>`).join("")}</table>`:""}
${vs.length?`<h2>Vet Visits</h2><table><tr><th>Date</th><th>Vet/Clinic</th><th>Reason</th><th>Diagnosis</th><th>Treatment</th></tr>
${vs.map(x=>`<tr><td>${fmt(x.date)}</td><td>${x.vetName||"—"}<br><small>${x.clinic||""}</small></td><td>${x.reason}</td><td>${x.diagnosis||"—"}</td><td>${x.treatment||"—"}</td></tr>`).join("")}</table>`:""}
<footer>Generated by PawRecord · Always consult a licensed veterinarian for medical advice.</footer></body></html>`;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));
  a.download=`${dog.name.replace(/\s+/g,"_")}_Records.html`;a.click();
};

// REDUCER
const initState=()=>({dogs:[],vaccinations:[],medications:[],allergies:[],visits:[],weights:[],vets:[],documents:[]});
const reducer=(s,a)=>{
  const add=(k,item)=>({...s,[k]:[...s[k],item]});
  const upd=(k,item)=>({...s,[k]:s[k].map(x=>x.id===item.id?item:x)});
  const del=(k,id)=>({...s,[k]:s[k].filter(x=>x.id!==id)});
  switch(a.t){
    case"LOAD":return{...initState(),...a.s};
    case"ADD_DOG":return add("dogs",a.d);case"UPD_DOG":return upd("dogs",a.d);
    case"DEL_DOG":return{...s,dogs:s.dogs.filter(x=>x.id!==a.id),vaccinations:s.vaccinations.filter(x=>x.dogId!==a.id),medications:s.medications.filter(x=>x.dogId!==a.id),allergies:s.allergies.filter(x=>x.dogId!==a.id),visits:s.visits.filter(x=>x.dogId!==a.id),weights:s.weights.filter(x=>x.dogId!==a.id),documents:s.documents.filter(x=>x.dogId!==a.id)};
    case"ADD_VACC":return add("vaccinations",a.v);case"UPD_VACC":return upd("vaccinations",a.v);case"DEL_VACC":return del("vaccinations",a.id);
    case"ADD_MED":return add("medications",a.m);case"UPD_MED":return upd("medications",a.m);case"DEL_MED":return del("medications",a.id);
    case"ADD_ALRG":return add("allergies",a.x);case"UPD_ALRG":return upd("allergies",a.x);case"DEL_ALRG":return del("allergies",a.id);
    case"ADD_VISIT":return add("visits",a.v);case"UPD_VISIT":return upd("visits",a.v);case"DEL_VISIT":return del("visits",a.id);
    case"ADD_WT":return add("weights",a.w);case"DEL_WT":return del("weights",a.id);
    case"ADD_VET":return add("vets",a.v);case"UPD_VET":return upd("vets",a.v);case"DEL_VET":return del("vets",a.id);
    case"ADD_DOC":return add("documents",a.doc);case"DEL_DOC":return del("documents",a.id);
    default:return s;
  }
};

// ERROR BOUNDARY
class ErrorBoundary extends Component{
  state={err:null,info:null};
  static getDerivedStateFromError(err){return{err};}
  componentDidCatch(err,info){this.setState({info});}
  render(){
    if(this.state.err)return(
      <div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{background:"#141b27",border:"1px solid #f8717144",borderRadius:16,padding:28,maxWidth:480,width:"100%"}}>
          <div style={{color:"#f87171",fontWeight:700,fontSize:18,marginBottom:12}}>⚠ Something crashed</div>
          <div style={{fontFamily:"monospace",fontSize:12,color:"#7c8fac",background:"#0e1219",borderRadius:10,padding:14,
            whiteSpace:"pre-wrap",maxHeight:220,overflow:"auto",marginBottom:16}}>
            {this.state.err.toString()}{"\n"}{this.state.info?.componentStack?.slice(0,500)}
          </div>
          <p style={{color:"#7c8fac",fontSize:13,marginBottom:16}}>Your data is safe. Try recovering or refresh the page.</p>
          <button onClick={()=>this.setState({err:null,info:null})}
            style={{background:"#2dd4bf",color:"#07090f",borderRadius:10,padding:"10px 20px",fontWeight:600,fontSize:14,border:"none",cursor:"pointer"}}>
            Try to Recover
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ICONS
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
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[n]}</svg>;
};

// BASE UI
const Btn=({children,onClick,v="primary",sm,full,style:s,disabled})=>{
  const V={primary:{background:"#2dd4bf",color:"#07090f"},secondary:{background:"#141b27",color:"#eef2ff",border:"1px solid #1c2438"},danger:{background:"#f8717114",color:"#f87171",border:"1px solid #f8717144"},ghost:{background:"transparent",color:"#7c8fac"}};
  return <button onClick={disabled?undefined:onClick} style={{...V[v],borderRadius:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity .15s",width:full?"100%":"auto",justifyContent:full?"center":"flex-start",padding:sm?"7px 14px":"10px 20px",fontSize:sm?13:14,opacity:disabled?.5:1,border:"none",...s}}
    onMouseEnter={e=>!disabled&&(e.currentTarget.style.opacity="0.8")}
    onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;
};
const Card=({children,style:s,onClick})=>(
  <div onClick={onClick} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:14,padding:18,...s,cursor:onClick?"pointer":"default",transition:"border-color .2s"}}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor="#2dd4bf55")}
    onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor="#1c2438")}>{children}</div>
);
const Badge=({label,color})=>(
  <span style={{background:color+"20",color,border:`1px solid ${color}40`,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
);
const Field=({label,children,col})=>(
  <div style={{display:"flex",flexDirection:"column",gap:5,gridColumn:col}}>
    <label style={{fontSize:11,fontWeight:600,color:"#7c8fac",textTransform:"uppercase",letterSpacing:".05em"}}>{label}</label>
    {children}
  </div>
);
const Modal=({title,onClose,children})=>(
  <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:"#0e1219",border:"1px solid #1c2438",borderRadius:20,width:"100%",maxWidth:500,maxHeight:"92vh",overflow:"auto",padding:24}} className="fade">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>{title}</h3>
        <button onClick={onClose} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"6px 8px",color:"#7c8fac"}}><Ic n="x" s={16}/></button>
      </div>
      {children}
    </div>
  </div>
);
const Empty=({icon,title,sub,action})=>(
  <div style={{textAlign:"center",padding:"48px 20px"}}>
    <div style={{color:"#2d3a50",marginBottom:12}}><Ic n={icon} s={36} c="#2d3a50"/></div>
    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,marginBottom:6}}>{title}</div>
    <div style={{color:"#7c8fac",fontSize:14,marginBottom:22}}>{sub}</div>
    {action}
  </div>
);
const Avatar=({dog,size=48})=>{
  const cols=["#2dd4bf","#60a5fa","#f472b6","#fb923c","#a78bfa","#34d399","#fbbf24"];
  const ci=dog.name.charCodeAt(0)%cols.length;
  return dog.photo
    ?<img src={dog.photo} alt={dog.name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${cols[ci]}`}}/>
    :<div style={{width:size,height:size,borderRadius:"50%",background:cols[ci]+"25",border:`2px solid ${cols[ci]}`,display:"flex",alignItems:"center",justifyContent:"center",color:cols[ci],fontWeight:700,fontSize:size*.38,fontFamily:"'Cormorant Garamond',serif"}}>{dog.name[0]}</div>;
};

// BOTTOM NAV
const BottomNav=({tab,setTab,alerts})=>{
  const items=[{id:"overview",icon:"home",label:"Overview"},{id:"vaccines",icon:"syringe",label:"Vaccines"},
    {id:"health",icon:"heart",label:"Health"},{id:"records",icon:"stethoscope",label:"Visits"},{id:"more",icon:"grid",label:"More"}];
  return(
    <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:"#0e1219",borderTop:"1px solid #1c2438",display:"flex",height:64}}>
      {items.map(item=>{
        const active=tab===item.id;
        return(<button key={item.id} onClick={()=>setTab(item.id)}
          style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            gap:3,background:"none",color:active?"#2dd4bf":"#7c8fac",fontSize:11,fontWeight:active?600:400,
            transition:"color .15s",position:"relative",paddingTop:2,border:"none"}}>
          <Ic n={item.icon} s={20} c={active?"#2dd4bf":"#7c8fac"}/>
          {item.label}
          {item.id==="vaccines"&&alerts>0&&(
            <span style={{position:"absolute",top:8,left:"calc(50% + 6px)",background:"#f87171",color:"#fff",
              borderRadius:"50%",width:16,height:16,fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{alerts}</span>
          )}
        </button>);
      })}
    </nav>
  );
};

// FORMS
const DogForm=({dog,onSave,onClose})=>{
  const[f,setF]=useState(dog||{name:"",breed:"",dob:"",weight:"",gender:"male",neutered:false,microchip:"",color:"",emergencyContact:"",emergencyPhone:"",notes:"",photo:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));const fr=useRef();
  const onPhoto=e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>set("photo",ev.target.result);r.readAsDataURL(file);};
  return(<Modal title={dog?"Edit Profile":"Add Dog"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"center"}}>
        <div style={{position:"relative",cursor:"pointer"}} onClick={()=>fr.current.click()}>
          {f.photo?<img src={f.photo} style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #2dd4bf"}}/>
            :<div style={{width:80,height:80,borderRadius:"50%",background:"#141b27",border:"2px dashed #1c2438",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c8fac"}}><Ic n="camera" s={24} c="#7c8fac"/></div>}
          <div style={{position:"absolute",bottom:0,right:0,background:"#2dd4bf",borderRadius:"50%",padding:5}}><Ic n="camera" s={11} c="#07090f"/></div>
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
        <Field label="Emergency Contact"><input value={f.emergencyContact} onChange={e=>set("emergencyContact",e.target.value)} placeholder="Jane Smith"/></Field>
        <Field label="Emergency Phone"><input value={f.emergencyPhone} onChange={e=>set("emergencyPhone",e.target.value)} placeholder="+1 555-0100"/></Field>
        <Field label="Notes" col="1/-1"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      </div>
      <div style={{display:"flex",gap:10,marginTop:4}}>
        <Btn v="secondary" onClick={onClose} full>Cancel</Btn>
        <Btn onClick={()=>{if(!f.name)return;onSave({...f,id:f.id||uid()});}} full>Save Dog</Btn>
      </div>
    </div>
  </Modal>);
};

const VaccineForm=({vacc,dogId,onSave,onClose})=>{
  const[f,setF]=useState(vacc||{name:"",type:"core",dateGiven:today(),durationMonths:12,nextDue:"",lotNumber:"",vetName:"",notes:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));const all=[...CORE_V,...OPT_V];
  useEffect(()=>{if(f.dateGiven&&f.durationMonths)set("nextDue",addM(f.dateGiven,f.durationMonths));},[f.dateGiven,f.durationMonths]);
  return(<Modal title={vacc?"Edit Vaccination":"Record Vaccination"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Select Vaccine">
        <select value={f.name} onChange={e=>{const found=all.find(v=>v.name===e.target.value);setF(p=>({...p,name:e.target.value,type:CORE_V.find(v=>v.name===e.target.value)?"core":"optional",durationMonths:found?found.dur:p.durationMonths}));}}>
          <option value="">— Select or enter below —</option>
          <optgroup label="Core (Required)">{CORE_V.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}</optgroup>
          <optgroup label="Optional">{OPT_V.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}</optgroup>
        </select>
      </Field>
      <Field label="Custom Name (if not listed)"><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Vaccine name"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Type"><select value={f.type} onChange={e=>set("type",e.target.value)}><option value="core">Core (Required)</option><option value="optional">Optional</option></select></Field>
        <Field label="Duration (months)"><input type="number" value={f.durationMonths} onChange={e=>set("durationMonths",e.target.value)}/></Field>
        <Field label="Date Given"><input type="date" value={f.dateGiven} onChange={e=>set("dateGiven",e.target.value)}/></Field>
        <Field label="Next Due (auto-calc)"><input type="date" value={f.nextDue} onChange={e=>set("nextDue",e.target.value)} style={{borderColor:"#2dd4bf66"}}/></Field>
        <Field label="Lot #"><input value={f.lotNumber} onChange={e=>set("lotNumber",e.target.value)} placeholder="ABC123"/></Field>
        <Field label="Administering Vet"><input value={f.vetName} onChange={e=>set("vetName",e.target.value)} placeholder="Dr. Smith"/></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.name)return;onSave({...f,id:f.id||uid(),dogId});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const MedForm=({med,dogId,onSave,onClose})=>{
  const[f,setF]=useState(med||{name:"",dosage:"",frequency:"",startDate:today(),endDate:"",prescribingVet:"",reason:"",notes:"",active:true});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
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
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.name)return;onSave({...f,id:f.id||uid(),dogId});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const AllergyForm=({allergy,dogId,onSave,onClose})=>{
  const[f,setF]=useState(allergy||{allergen:"",reaction:"",severity:"mild",dateDiscovered:today(),notes:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<Modal title={allergy?"Edit Allergy":"Add Allergy"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Allergen" col="1/-1"><input value={f.allergen} onChange={e=>set("allergen",e.target.value)} placeholder="Chicken, pollen, penicillin..."/></Field>
        <Field label="Reaction" col="1/-1"><input value={f.reaction} onChange={e=>set("reaction",e.target.value)} placeholder="Skin rash, vomiting..."/></Field>
        <Field label="Severity"><select value={f.severity} onChange={e=>set("severity",e.target.value)}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe / Anaphylaxis</option></select></Field>
        <Field label="Date Discovered"><input type="date" value={f.dateDiscovered} onChange={e=>set("dateDiscovered",e.target.value)}/></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.allergen)return;onSave({...f,id:f.id||uid(),dogId});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const VisitForm=({visit,dogId,onSave,onClose})=>{
  const[f,setF]=useState(visit||{date:today(),vetName:"",clinic:"",reason:"",diagnosis:"",treatment:"",cost:"",notes:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
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
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.reason)return;onSave({...f,id:f.id||uid(),dogId});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const WeightForm=({dogId,onSave,onClose})=>{
  const[f,setF]=useState({date:today(),weight:"",notes:""});const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<Modal title="Log Weight" onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Date"><input type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></Field>
      <Field label="Weight (lbs)"><input type="number" step="0.1" value={f.weight} onChange={e=>set("weight",e.target.value)} placeholder="55.2"/></Field>
      <Field label="Notes"><input value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="After grooming, vet weigh-in..."/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.weight)return;onSave({...f,id:uid(),dogId,weight:parseFloat(f.weight)});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const VetForm=({vet,onSave,onClose})=>{
  const[f,setF]=useState(vet||{name:"",clinic:"",phone:"",address:"",email:"",notes:""});const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return(<Modal title={vet?"Edit Vet":"Save Vet Contact"} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Vet Name" col="1/-1"><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Dr. Johnson"/></Field>
        <Field label="Clinic" col="1/-1"><input value={f.clinic} onChange={e=>set("clinic",e.target.value)} placeholder="Sunrise Animal Hospital"/></Field>
        <Field label="Phone"><input value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 555-0100"/></Field>
        <Field label="Email"><input value={f.email} onChange={e=>set("email",e.target.value)}/></Field>
        <Field label="Address" col="1/-1"><input value={f.address} onChange={e=>set("address",e.target.value)}/></Field>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.name)return;onSave({...f,id:f.id||uid()});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const DocForm=({dogId,onSave,onClose})=>{
  const[f,setF]=useState({name:"",date:today(),type:"vaccine_record",notes:"",fileData:null,fileName:""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));const fr=useRef();
  const onFile=e=>{const file=e.target.files[0];if(!file)return;set("fileName",file.name);const r=new FileReader();r.onload=ev=>set("fileData",ev.target.result);r.readAsDataURL(file);};
  const DL={"vaccine_record":"Vaccine Record","health_certificate":"Health Certificate","vet_visit":"Vet Visit","lab_results":"Lab Results","prescription":"Prescription","other":"Other"};
  return(<Modal title="Upload Document" onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <Field label="Document Name"><input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Rabies Certificate 2026"/></Field>
      <Field label="Type"><select value={f.type} onChange={e=>set("type",e.target.value)}>{Object.entries(DL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Date"><input type="date" value={f.date} onChange={e=>set("date",e.target.value)}/></Field>
      <div style={{border:"2px dashed #1c2438",borderRadius:12,padding:24,textAlign:"center",cursor:"pointer"}} onClick={()=>fr.current.click()}>
        {f.fileName?<div style={{color:"#2dd4bf",fontSize:14}}>✓ {f.fileName}</div>:<><Ic n="camera" s={28} c="#2d3a50"/><div style={{color:"#7c8fac",marginTop:8,fontSize:14}}>Tap to upload photo or scan</div></>}
        <input ref={fr} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={onFile}/>
      </div>
      <Field label="Notes"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2}/></Field>
      <div style={{display:"flex",gap:10}}><Btn v="secondary" onClick={onClose} full>Cancel</Btn><Btn onClick={()=>{if(!f.name)return;onSave({...f,id:uid(),dogId});}} full>Save</Btn></div>
    </div>
  </Modal>);
};

const ShareModal=({dog,onClose})=>{
  const msgs=[
    `🐾 ${dog.name} is up to date on all vaccinations! Keeping pet records organized with PawRecord 📋`,
    `💉 Just logged ${dog.name}'s latest vet visit! Healthy pup = happy life. #PawRecord #DogMom #DogDad`,
    `✅ ${dog.name}'s medical records are travel-ready. Best investment for any dog parent! 🐶`,
  ];
  const[sel,setSel]=useState(0);
  return(<Modal title={`Share ${dog.name}'s Update`} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <p style={{color:"#7c8fac",fontSize:13}}>Choose a message:</p>
      {msgs.map((m,i)=><div key={i} onClick={()=>setSel(i)} style={{padding:14,borderRadius:12,border:`2px solid ${sel===i?"#2dd4bf":"#1c2438"}`,cursor:"pointer",fontSize:14,lineHeight:1.6,background:sel===i?"#2dd4bf14":"#141b27"}}>{m}</div>)}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:4}}>
        <Btn onClick={()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msgs[sel])}`,"_blank")} style={{background:"#1da1f2",color:"#fff",justifyContent:"center"}}>Twitter</Btn>
        <Btn onClick={()=>window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(msgs[sel])}`,"_blank")} style={{background:"#1877f2",color:"#fff",justifyContent:"center"}}>Facebook</Btn>
        <Btn v="secondary" onClick={()=>navigator.clipboard.writeText(msgs[sel])} style={{justifyContent:"center"}}><Ic n="doc" s={13}/> Copy</Btn>
      </div>
    </div>
  </Modal>);
};

// TABS
const OverviewTab=({dog,state,setModal})=>{
  const vaccines=state.vaccinations.filter(v=>v.dogId===dog.id);
  const urgent=vaccines.filter(v=>v.nextDue&&daysUntil(v.nextDue)<=30);
  const al=state.allergies.filter(a=>a.dogId===dog.id);
  const meds=state.medications.filter(m=>m.dogId===dog.id&&m.active);
  const sev=s=>({mild:"#2dd4bf",moderate:"#fb923c",severe:"#f87171"}[s]||"#fb923c");
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <Card>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["Breed",dog.breed||"—"],["Born",fmt(dog.dob)],["Weight",dog.weight?dog.weight+" lbs":"—"],
          ["Gender",(dog.gender||"—")+(dog.neutered?" · Fixed":"")],["Microchip",dog.microchip||"—"],["Color",dog.color||"—"]].map(([k,v])=>(
          <div key={k}><div style={{fontSize:11,color:"#7c8fac",textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{k}</div>
          <div style={{fontWeight:500,fontSize:14}}>{v}</div></div>))}
      </div>
      {(dog.emergencyContact||dog.emergencyPhone)&&(<div style={{marginTop:12,padding:10,background:"#0e1219",borderRadius:10,display:"flex",alignItems:"center",gap:8}}>
        <Ic n="phone" s={14} c="#fb923c"/><span style={{fontSize:13}}><b>Emergency:</b> {dog.emergencyContact} {dog.emergencyPhone}</span>
      </div>)}
      {dog.notes&&<div style={{marginTop:12,padding:10,background:"#0e1219",borderRadius:10,fontSize:13,color:"#7c8fac"}}>{dog.notes}</div>}
      <div style={{marginTop:12}}><Btn sm v="secondary" onClick={()=>setModal("editDog")}><Ic n="edit" s={13}/> Edit Profile</Btn></div>
    </Card>
    {urgent.length>0&&(<Card style={{border:"1px solid #fb923c44",background:"#fb923c14"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,color:"#fb923c",fontWeight:600,fontSize:14}}><Ic n="alert" s={15} c="#fb923c"/> Attention Needed</div>
      {urgent.map(v=>{const st=vSt(v.nextDue);return(<div key={v.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1c243844"}}><span style={{fontSize:14}}>{v.name}</span><Badge label={st.label} color={st.c}/></div>);})}
    </Card>)}
    {al.length>0&&(<Card style={{border:"1px solid #f8717144"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,color:"#f87171",fontWeight:600,fontSize:14}}><Ic n="alert" s={15} c="#f87171"/> Known Allergies — Always inform your vet</div>
      {al.map(a=>(<div key={a.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1c243844",fontSize:14}}><span><b>{a.allergen}</b> — {a.reaction}</span><Badge label={a.severity} color={sev(a.severity)}/></div>))}
    </Card>)}
    {meds.length>0&&(<Card><div style={{fontWeight:600,marginBottom:10,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="pill" s={14} c="#60a5fa"/> Active Medications</div>
      {meds.map(m=>(<div key={m.id} style={{fontSize:14,padding:"6px 0",borderBottom:"1px solid #1c243844"}}><b>{m.name}</b> · {m.dosage} · {m.frequency}</div>))}</Card>)}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <Btn full onClick={()=>exportHTML(dog,{vaccinations:state.vaccinations,medications:state.medications,allergies:state.allergies,visits:state.visits})}><Ic n="download" s={14}/> Export for Vet</Btn>
      <Btn full v="secondary" onClick={()=>setModal("share")}><Ic n="share" s={14}/> Share</Btn>
    </div>
  </div>);
};

const VaccinesTab=({dog,state,dispatch})=>{
  const[modal,setModal]=useState(null);
  const vaccines=state.vaccinations.filter(v=>v.dogId===dog.id);
  const all=[...CORE_V,...OPT_V];
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Vaccinations</h3>
      <Btn sm onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Add</Btn>
    </div>
    {vaccines.length===0?<Empty icon="syringe" title="No vaccinations yet" sub="Record your first vaccination to get started." action={<Btn onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Record Vaccination</Btn>}/>
      :vaccines.map(v=>{const st=vSt(v.nextDue);return(<Card key={v.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontWeight:600}}>{v.name}</span>
              <Badge label={v.type==="core"?"CORE":"OPTIONAL"} color={v.type==="core"?"#2dd4bf":"#60a5fa"}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:12,color:"#7c8fac",marginTop:4}}>
              <span>Given: {fmt(v.dateGiven)}</span><span>Vet: {v.vetName||"—"}</span>
              {v.lotNumber&&<span>Lot: {v.lotNumber}</span>}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <Badge label={st.label} color={st.c}/>
            <div style={{display:"flex",gap:5}}>
              {v.nextDue&&<button title="Add to Calendar" onClick={()=>exportICS(dog.name,v.name,v.nextDue)} style={{background:"#60a5fa14",border:"1px solid #60a5fa44",borderRadius:8,padding:"5px 8px",color:"#60a5fa"}}><Ic n="cal" s={13}/></button>}
              <button onClick={()=>setModal({type:"edit",v})} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"5px 8px",color:"#7c8fac"}}><Ic n="edit" s={13}/></button>
              <button onClick={()=>dispatch({t:"DEL_VACC",id:v.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
            </div>
          </div>
        </div>
      </Card>);})}
    <Card style={{borderStyle:"dashed",opacity:.8}}>
      <div style={{fontSize:11,fontWeight:700,color:"#7c8fac",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Recommended Schedule</div>
      {all.map(rv=>{const rec=vaccines.find(v=>v.name===rv.name);const isCore=CORE_V.includes(rv);return(
        <div key={rv.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1c243833"}}>
          <div><div style={{fontSize:13,fontWeight:500}}>{rv.name}</div><div style={{fontSize:11,color:"#2d3a50",marginTop:2}}>{rv.note}</div></div>
          {rec?<Badge label="Recorded ✓" color="#2dd4bf"/>:<Badge label={isCore?"Required":"Optional"} color={isCore?"#fb923c":"#2d3a50"}/>}
        </div>);})}
    </Card>
    {modal?.type==="add"&&<VaccineForm dogId={dog.id} onSave={v=>{dispatch({t:"ADD_VACC",v});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="edit"&&<VaccineForm vacc={modal.v} dogId={dog.id} onSave={v=>{dispatch({t:"UPD_VACC",v});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);
};

const HealthTab=({dog,state,dispatch})=>{
  const[modal,setModal]=useState(null);
  const meds=state.medications.filter(m=>m.dogId===dog.id);
  const al=state.allergies.filter(a=>a.dogId===dog.id);
  const sev=s=>({mild:"#2dd4bf",moderate:"#fb923c",severe:"#f87171"}[s]||"#fb923c");
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Health</h3>
      <div style={{display:"flex",gap:8}}>
        <Btn sm v="secondary" onClick={()=>setModal({type:"addAlrg"})}><Ic n="alert" s={13}/> Allergy</Btn>
        <Btn sm onClick={()=>setModal({type:"addMed"})}><Ic n="pill" s={13}/> Med</Btn>
      </div>
    </div>
    <div style={{fontSize:11,fontWeight:700,color:"#f87171",textTransform:"uppercase",letterSpacing:".06em"}}>⚠ Allergies</div>
    {al.length===0?<Card style={{borderStyle:"dashed"}}><div style={{color:"#7c8fac",fontSize:14,textAlign:"center",padding:"12px 0"}}>No allergies recorded. <span style={{color:"#2dd4bf",cursor:"pointer"}} onClick={()=>setModal({type:"addAlrg"})}>Add one</span></div></Card>
      :al.map(a=>(<Card key={a.id} style={{border:`1px solid ${sev(a.severity)}44`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontWeight:600,display:"flex",alignItems:"center",gap:8,marginBottom:4}}>{a.allergen} <Badge label={a.severity.toUpperCase()} color={sev(a.severity)}/></div>
          <div style={{fontSize:13,color:"#7c8fac"}}>Reaction: {a.reaction}</div>
          <div style={{fontSize:12,color:"#2d3a50",marginTop:4}}>Discovered {fmt(a.dateDiscovered)}</div></div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>setModal({type:"editAlrg",a})} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"5px 8px",color:"#7c8fac"}}><Ic n="edit" s={13}/></button>
            <button onClick={()=>dispatch({t:"DEL_ALRG",id:a.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>
      </Card>))}
    <div style={{fontSize:11,fontWeight:700,color:"#60a5fa",textTransform:"uppercase",letterSpacing:".06em"}}>Medications</div>
    {meds.filter(m=>m.active).map(m=>(<Card key={m.id} style={{borderColor:"#2dd4bf44"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{fontWeight:600,marginBottom:4}}>{m.name} <span style={{background:"#2dd4bf14",color:"#2dd4bf",fontSize:11,padding:"2px 8px",borderRadius:20}}>ACTIVE</span></div>
        <div style={{fontSize:13,color:"#7c8fac"}}>{m.dosage} · {m.frequency}</div>
        {m.reason&&<div style={{fontSize:13,color:"#2d3a50",marginTop:3}}>{m.reason}</div>}
        <div style={{fontSize:12,color:"#2d3a50",marginTop:4}}>Since {fmt(m.startDate)}{m.prescribingVet?` · ${m.prescribingVet}`:""}</div></div>
        <div style={{display:"flex",gap:5}}>
          <button onClick={()=>setModal({type:"editMed",m})} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"5px 8px",color:"#7c8fac"}}><Ic n="edit" s={13}/></button>
          <button onClick={()=>dispatch({t:"DEL_MED",id:m.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
        </div>
      </div>
    </Card>))}
    {meds.filter(m=>!m.active).map(m=>(<Card key={m.id} style={{opacity:.65}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontWeight:500,color:"#7c8fac"}}>{m.name}</div><div style={{fontSize:12,color:"#2d3a50"}}>{m.dosage} · {fmt(m.startDate)}–{fmt(m.endDate)||"now"}</div></div>
        <button onClick={()=>dispatch({t:"DEL_MED",id:m.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
      </div>
    </Card>))}
    {meds.length===0&&<Empty icon="pill" title="No medications" sub="Add current or past medications." action={<Btn onClick={()=>setModal({type:"addMed"})}><Ic n="plus" s={14}/> Add Medication</Btn>}/>}
    {modal?.type==="addMed"&&<MedForm dogId={dog.id} onSave={m=>{dispatch({t:"ADD_MED",m});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="editMed"&&<MedForm med={modal.m} dogId={dog.id} onSave={m=>{dispatch({t:"UPD_MED",m});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="addAlrg"&&<AllergyForm dogId={dog.id} onSave={x=>{dispatch({t:"ADD_ALRG",x});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="editAlrg"&&<AllergyForm allergy={modal.a} dogId={dog.id} onSave={x=>{dispatch({t:"UPD_ALRG",x});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);
};

const RecordsTab=({dog,state,dispatch})=>{
  const[modal,setModal]=useState(null);
  const visits=state.visits.filter(v=>v.dogId===dog.id).sort((a,b)=>b.date.localeCompare(a.date));
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>Vet Visits</h3>
      <Btn sm onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Log Visit</Btn>
    </div>
    {visits.length===0?<Empty icon="stethoscope" title="No visits logged" sub="Track every vet visit for a complete history." action={<Btn onClick={()=>setModal({type:"add"})}><Ic n="plus" s={14}/> Log Visit</Btn>}/>
      :visits.map(v=>(<Card key={v.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600}}>{v.reason}</div>
            <div style={{fontSize:12,color:"#7c8fac",marginTop:2}}>{fmt(v.date)}{v.vetName?` · ${v.vetName}`:""}{v.clinic?` @ ${v.clinic}`:""}</div>
            {v.diagnosis&&<div style={{fontSize:13,marginTop:6}}><span style={{color:"#2d3a50"}}>Dx: </span>{v.diagnosis}</div>}
            {v.treatment&&<div style={{fontSize:13}}><span style={{color:"#2d3a50"}}>Tx: </span>{v.treatment}</div>}
            {v.cost&&<div style={{fontSize:13,color:"#2dd4bf",marginTop:4}}>${v.cost}</div>}
          </div>
          <div style={{display:"flex",gap:5,marginLeft:10}}>
            <button onClick={()=>setModal({type:"edit",v})} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"5px 8px",color:"#7c8fac"}}><Ic n="edit" s={13}/></button>
            <button onClick={()=>dispatch({t:"DEL_VISIT",id:v.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>
      </Card>))}
    {modal?.type==="add"&&<VisitForm dogId={dog.id} onSave={v=>{dispatch({t:"ADD_VISIT",v});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="edit"&&<VisitForm visit={modal.v} dogId={dog.id} onSave={v=>{dispatch({t:"UPD_VISIT",v});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);
};

const MoreTab=({dog,state,dispatch})=>{
  const[section,setSection]=useState(null);
  const[modal,setModal]=useState(null);
  const weights=state.weights.filter(w=>w.dogId===dog.id).sort((a,b)=>a.date.localeCompare(b.date));
  const vets=state.vets;
  const docs=state.documents.filter(d=>d.dogId===dog.id).sort((a,b)=>b.date.localeCompare(a.date));
  const DL={"vaccine_record":"Vaccine Record","health_certificate":"Health Certificate","vet_visit":"Vet Visit","lab_results":"Lab Results","prescription":"Prescription","other":"Other"};
  const back=()=>setSection(null);
  const backBtn=<button onClick={back} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"6px 8px",color:"#7c8fac"}}><Ic n="chevL" s={16}/></button>;

  if(section==="weight")return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,flex:1}}>Weight History</h3><Btn sm onClick={()=>setModal("addWeight")}><Ic n="plus" s={14}/> Log</Btn></div>
    {weights.length>=2&&(<Card><ResponsiveContainer width="100%" height={180}>
      <LineChart data={weights.map(w=>({date:w.date.slice(5),weight:w.weight}))}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c2438"/>
        <XAxis dataKey="date" stroke="#7c8fac" tick={{fontSize:11}}/>
        <YAxis stroke="#7c8fac" tick={{fontSize:11}} domain={["auto","auto"]}/>
        <Tooltip contentStyle={{background:"#141b27",border:"1px solid #1c2438",borderRadius:10,color:"#eef2ff",fontSize:13}} formatter={v=>[v+" lbs","Weight"]}/>
        <Line type="monotone" dataKey="weight" stroke="#2dd4bf" strokeWidth={2} dot={{r:3,fill:"#2dd4bf"}}/>
      </LineChart>
    </ResponsiveContainer></Card>)}
    {weights.length===0?<Empty icon="weight" title="No weight records" sub="Log weight at each vet visit to track trends." action={<Btn onClick={()=>setModal("addWeight")}><Ic n="plus" s={14}/> Log Weight</Btn>}/>
      :weights.slice().reverse().map(w=>(<Card key={w.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600}}>{w.weight}<span style={{fontSize:14,color:"#7c8fac"}}> lbs</span></span>
          <div style={{fontSize:12,color:"#7c8fac",marginTop:2}}>{fmt(w.date)}{w.notes?` · ${w.notes}`:""}</div></div>
          <button onClick={()=>dispatch({t:"DEL_WT",id:w.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
        </div>
      </Card>))}
    {modal==="addWeight"&&<WeightForm dogId={dog.id} onSave={w=>{dispatch({t:"ADD_WT",w});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);

  if(section==="vets")return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,flex:1}}>Saved Vets</h3><Btn sm onClick={()=>setModal({type:"addVet"})}><Ic n="plus" s={14}/> Add</Btn></div>
    <Btn full v="secondary" onClick={()=>window.open("https://www.google.com/maps/search/veterinarian+near+me","_blank")}><Ic n="map" s={15}/> Find Nearby Vets on Google Maps</Btn>
    {vets.length===0?<Empty icon="map" title="No saved vets" sub="Save vet contacts for quick access while traveling."/>
      :vets.map(v=>(<Card key={v.id}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontWeight:600}}>{v.name}</div>
          {v.clinic&&<div style={{fontSize:13,color:"#7c8fac",marginTop:1}}>{v.clinic}</div>}
          {v.phone&&<a href={`tel:${v.phone}`} style={{fontSize:13,color:"#2dd4bf",display:"flex",alignItems:"center",gap:4,marginTop:4,textDecoration:"none"}}><Ic n="phone" s={12} c="#2dd4bf"/>{v.phone}</a>}
          {v.address&&<div style={{fontSize:12,color:"#2d3a50",marginTop:2}}>{v.address}</div>}</div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>setModal({type:"editVet",v})} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"5px 8px",color:"#7c8fac"}}><Ic n="edit" s={13}/></button>
            <button onClick={()=>dispatch({t:"DEL_VET",id:v.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>
      </Card>))}
    {modal?.type==="addVet"&&<VetForm onSave={v=>{dispatch({t:"ADD_VET",v});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal?.type==="editVet"&&<VetForm vet={modal.v} onSave={v=>{dispatch({t:"UPD_VET",v});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);

  if(section==="docs")return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,flex:1}}>Documents</h3><Btn sm onClick={()=>setModal("addDoc")}><Ic n="plus" s={14}/> Upload</Btn></div>
    {docs.length===0?<Empty icon="doc" title="No documents" sub="Upload photos or scans of vet records and health certificates." action={<Btn onClick={()=>setModal("addDoc")}><Ic n="camera" s={14}/> Upload Document</Btn>}/>
      :docs.map(d=>(<Card key={d.id}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          {d.fileData&&d.fileData.startsWith("data:image")
            ?<img src={d.fileData} style={{width:56,height:56,borderRadius:10,objectFit:"cover",border:"1px solid #1c2438",flexShrink:0}}/>
            :<div style={{width:56,height:56,borderRadius:10,background:"#0e1219",border:"1px solid #1c2438",display:"flex",alignItems:"center",justifyContent:"center",color:"#2d3a50",flexShrink:0}}><Ic n="doc" s={22} c="#2d3a50"/></div>}
          <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
          <div style={{fontSize:12,color:"#7c8fac",marginTop:2}}>{fmt(d.date)} · {DL[d.type]||d.type}</div>
          {d.notes&&<div style={{fontSize:12,color:"#2d3a50",marginTop:3}}>{d.notes}</div>}</div>
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            {d.fileData&&<a href={d.fileData} download={d.name} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"5px 8px",color:"#7c8fac",display:"flex"}}><Ic n="download" s={13}/></a>}
            <button onClick={()=>dispatch({t:"DEL_DOC",id:d.id})} style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:8,padding:"5px 8px",color:"#f87171"}}><Ic n="trash" s={13}/></button>
          </div>
        </div>
      </Card>))}
    {modal==="addDoc"&&<DocForm dogId={dog.id} onSave={doc=>{dispatch({t:"ADD_DOC",doc});setModal(null);}} onClose={()=>setModal(null)}/>}
  </div>);

  if(section==="qr"){
    const meds=state.medications.filter(m=>m.dogId===dog.id&&m.active).map(m=>m.name).join(", ");
    const als=state.allergies.filter(a=>a.dogId===dog.id).map(a=>a.allergen).join(", ");
    const payload=JSON.stringify({name:dog.name,breed:dog.breed,microchip:dog.microchip||"N/A",dob:dog.dob,allergies:als||"None",medications:meds||"None",emergency:`${dog.emergencyContact||""} ${dog.emergencyPhone||""}`.trim()||"N/A",source:"PawRecord"});
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
    return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>{backBtn}<h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>QR Health Card</h3></div>
      <Card>
        <div style={{fontWeight:600,marginBottom:4,display:"flex",alignItems:"center",gap:8}}><Ic n="qr" s={16} c="#2dd4bf"/> Health Card QR Code</div>
        <p style={{color:"#7c8fac",fontSize:13,marginBottom:16}}>Any vet can scan this to instantly see {dog.name}'s key info — allergies, medications, and emergency contact.</p>
        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <img src={qrUrl} alt="QR Code" style={{borderRadius:12,border:"2px solid #1c2438",background:"#fff",padding:8}}/>
        </div>
        <div style={{background:"#0e1219",borderRadius:10,padding:12,fontSize:12,color:"#7c8fac"}}>
          <b style={{color:"#eef2ff"}}>Encodes:</b> Name, breed, microchip, DOB, allergies, active medications, emergency contact
        </div>
      </Card>
    </div>);
  }

  const tiles=[
    {id:"weight",icon:"weight",label:"Weight History",desc:"Track & chart weight over time",color:"#2dd4bf"},
    {id:"vets",icon:"map",label:"Saved Vets",desc:"Contacts + find vets nearby",color:"#60a5fa"},
    {id:"docs",icon:"doc",label:"Documents",desc:"Upload vet records & certificates",color:"#fbbf24"},
    {id:"qr",icon:"qr",label:"QR Health Card",desc:"Scannable card for any vet",color:"#c084fc"},
  ];
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>More</h3>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {tiles.map(tile=>(<Card key={tile.id} onClick={()=>setSection(tile.id)} style={{padding:20}}>
        <div style={{color:tile.color,marginBottom:8}}><Ic n={tile.icon} s={24} c={tile.color}/></div>
        <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>{tile.label}</div>
        <div style={{fontSize:12,color:"#7c8fac"}}>{tile.desc}</div>
      </Card>))}
    </div>
  </div>);
};

// AI SCAN MODAL
const AIScanModal=({dog,dispatch,onClose})=>{
  const[step,setStep]=useState("upload");
  const[imageData,setImageData]=useState(null);
  const[extracted,setExtracted]=useState(null);
  const[error,setError]=useState(null);
  const[saved,setSaved]=useState(false);
  const[include,setInclude]=useState({visit:true,vaccines:true,weight:true,medications:true,document:true});
  const fr=useRef();

  const onFile=e=>{
    const file=e.target.files[0];if(!file)return;
    const r=new FileReader();r.onload=ev=>setImageData(ev.target.result);r.readAsDataURL(file);
  };

  const analyze=async()=>{
    if(!imageData)return;
    setStep("scanning");setError(null);
    try{
      const base64=imageData.split(",")[1];
      const mediaType=imageData.split(";")[0].split(":")[1];
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:mediaType,data:base64}},
            {type:"text",text:`You are a veterinary record parser. Analyze this vet document image and extract ALL information visible. Return ONLY a raw JSON object — no markdown, no backticks, no explanation, just JSON.

Return this exact structure (use null for anything not found or not visible):
{
  "visitDate": "YYYY-MM-DD or null",
  "vetName": "string or null",
  "clinicName": "string or null",
  "reason": "reason for visit string or null",
  "diagnosis": "string or null",
  "treatment": "string or null",
  "weight": weight_in_lbs_as_number_or_null,
  "cost": total_cost_as_number_or_null,
  "notes": "any other relevant clinical notes or null",
  "vaccines": [{"name":"vaccine name","dateGiven":"YYYY-MM-DD or null","nextDue":"YYYY-MM-DD or null","lotNumber":"string or null","type":"core or optional"}],
  "medications": [{"name":"med name","dosage":"string or null","frequency":"string or null","reason":"string or null"}]
}

Type rules: Rabies/DHPP/DA2PP = "core". Bordetella/Leptospirosis/Lyme/Canine Influenza/Rattlesnake = "optional".
If nextDue is not on the document, calculate from dateGiven: Rabies=12mo, DHPP/DA2PP=36mo, all others=12mo.
Return only the JSON object.`}
          ]}]
        })
      });
      const data=await res.json();
      if(data.error)throw new Error(data.error.message);
      const text=data.content?.find(b=>b.type==="text")?.text||"";
      const clean=text.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setExtracted(parsed);
      setStep("review");
    }catch(err){
      setError("Could not analyze the document: "+(err.message||"Unknown error")+". Please try again or enter records manually.");
      setStep("upload");
    }
  };

  const saveAll=()=>{
    const id=uid();
    if(include.visit&&(extracted.reason||extracted.diagnosis||extracted.visitDate)){
      dispatch({t:"ADD_VISIT",v:{id:uid(),dogId:dog.id,date:extracted.visitDate||today(),vetName:extracted.vetName||"",clinic:extracted.clinicName||"",reason:extracted.reason||"Vet visit (scanned document)",diagnosis:extracted.diagnosis||"",treatment:extracted.treatment||"",cost:extracted.cost||"",notes:extracted.notes||""}});
    }
    if(include.vaccines)(extracted.vaccines||[]).forEach(v=>{
      if(!v.name)return;
      const dur=([...CORE_V,...OPT_V].find(x=>x.name===v.name)?.dur)||12;
      const given=v.dateGiven||extracted.visitDate||today();
      dispatch({t:"ADD_VACC",v:{id:uid(),dogId:dog.id,name:v.name,type:v.type||"optional",dateGiven:given,nextDue:v.nextDue||addM(given,dur),lotNumber:v.lotNumber||"",vetName:extracted.vetName||"",notes:"",durationMonths:dur}});
    });
    if(include.weight&&extracted.weight){
      dispatch({t:"ADD_WT",w:{id:uid(),dogId:dog.id,date:extracted.visitDate||today(),weight:parseFloat(extracted.weight),notes:"From scanned document"}});
    }
    if(include.medications)(extracted.medications||[]).forEach(m=>{
      if(!m.name)return;
      dispatch({t:"ADD_MED",m:{id:uid(),dogId:dog.id,name:m.name,dosage:m.dosage||"",frequency:m.frequency||"",reason:m.reason||"",startDate:extracted.visitDate||today(),endDate:"",prescribingVet:extracted.vetName||"",notes:"",active:true}});
    });
    if(include.document&&imageData){
      dispatch({t:"ADD_DOC",doc:{id:uid(),dogId:dog.id,name:`Vet Visit — ${fmt(extracted.visitDate||today())}`,date:extracted.visitDate||today(),type:"vet_visit",notes:`AI-scanned. ${[extracted.clinicName,extracted.vetName].filter(Boolean).join(" · ")}`,fileData:imageData,fileName:"scanned_record.jpg"}});
    }
    setSaved(true);
    setTimeout(onClose,1400);
  };

  const tog=k=>setInclude(p=>({...p,[k]:!p[k]}));
  const hasMeds=(extracted?.medications||[]).filter(m=>m.name).length>0;
  const hasVacc=(extracted?.vaccines||[]).filter(v=>v.name).length>0;

  return(
    <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0e1219",border:"1px solid #2dd4bf44",borderRadius:20,width:"100%",maxWidth:520,maxHeight:"94vh",overflow:"auto",padding:24}} className="fade">
        
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22}}>AI Document Scan</h3>
              <span style={{background:"#fbbf2420",color:"#fbbf24",border:"1px solid #fbbf2440",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>PREMIUM</span>
            </div>
            <p style={{color:"#7c8fac",fontSize:13,marginTop:2}}>Photo a vet record — AI extracts everything automatically</p>
          </div>
          <button onClick={onClose} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:8,padding:"6px 8px",color:"#7c8fac"}}><Ic n="x" s={16}/></button>
        </div>

        {/* STEP: UPLOAD */}
        {step==="upload"&&<>
          {error&&<div style={{background:"#f8717114",border:"1px solid #f8717144",borderRadius:12,padding:14,marginBottom:16,fontSize:13,color:"#f87171"}}>{error}</div>}
          <input ref={fr} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={onFile}/>
          {!imageData?(<div style={{border:"2px dashed #2dd4bf44",borderRadius:16,padding:40,textAlign:"center",cursor:"pointer",background:"#2dd4bf08"}} onClick={()=>fr.current.click()}>
            <div style={{fontSize:40,marginBottom:12}}>📷</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,marginBottom:8}}>Take or Upload a Photo</div>
            <div style={{color:"#7c8fac",fontSize:14,lineHeight:1.6}}>Vaccine records · Vet reports · Health certificates · Vet bills</div>
            <Btn style={{margin:"20px auto 0"}} onClick={e=>{e.stopPropagation();fr.current.click();}}>
              <Ic n="camera" s={15}/> Choose Photo
            </Btn>
          </div>):(
            <div>
              <img src={imageData} style={{width:"100%",borderRadius:14,border:"1px solid #1c2438",maxHeight:280,objectFit:"contain",background:"#141b27",marginBottom:16}}/>
              <div style={{display:"flex",gap:10}}>
                <Btn v="secondary" onClick={()=>setImageData(null)} full>Retake</Btn>
                <Btn onClick={analyze} full><Ic n="syringe" s={15}/> Analyze Document</Btn>
              </div>
            </div>
          )}
        </>}

        {/* STEP: SCANNING */}
        {step==="scanning"&&(
          <div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{fontSize:48,marginBottom:20,animation:"spin 1.5s linear infinite",display:"inline-block"}}>🔍</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,marginBottom:8}}>Reading Document...</div>
            <div style={{color:"#7c8fac",fontSize:14}}>AI is extracting vaccines, dates, weight, and more</div>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step==="review"&&extracted&&(<>
          <div style={{background:"#2dd4bf14",border:"1px solid #2dd4bf44",borderRadius:12,padding:14,marginBottom:16,fontSize:13,color:"#2dd4bf",display:"flex",alignItems:"center",gap:8}}>
            ✓ Document analyzed — review what to save
          </div>

          {/* Visit info */}
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="stethoscope" s={15} c="#2dd4bf"/> Vet Visit</div>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#7c8fac"}}>
                <input type="checkbox" checked={include.visit} onChange={()=>tog("visit")} style={{width:16,height:16,accentColor:"#2dd4bf"}}/>Include
              </label>
            </div>
            <div style={{background:"#141b27",borderRadius:12,padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13}}>
              {[["Date",fmt(extracted.visitDate)],["Vet",extracted.vetName||"—"],["Clinic",extracted.clinicName||"—"],["Reason",extracted.reason||"—"],["Diagnosis",extracted.diagnosis||"—"],["Cost",extracted.cost?"$"+extracted.cost:"—"]].map(([k,v])=>(
                <div key={k}><span style={{color:"#7c8fac"}}>{k}: </span>{v}</div>
              ))}
            </div>
          </div>

          {/* Vaccines */}
          {hasVacc&&(<div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="syringe" s={15} c="#60a5fa"/> Vaccines ({(extracted.vaccines||[]).filter(v=>v.name).length})</div>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#7c8fac"}}>
                <input type="checkbox" checked={include.vaccines} onChange={()=>tog("vaccines")} style={{width:16,height:16,accentColor:"#2dd4bf"}}/>Include
              </label>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {(extracted.vaccines||[]).filter(v=>v.name).map((v,i)=>(
                <div key={i} style={{background:"#141b27",borderRadius:10,padding:12,fontSize:13}}>
                  <div style={{fontWeight:600,marginBottom:4}}>{v.name} <Badge label={v.type==="core"?"CORE":"OPTIONAL"} color={v.type==="core"?"#2dd4bf":"#60a5fa"}/></div>
                  <div style={{color:"#7c8fac"}}>Given: {fmt(v.dateGiven)} · Next due: {fmt(v.nextDue)}{v.lotNumber?` · Lot: ${v.lotNumber}`:""}</div>
                </div>
              ))}
            </div>
          </div>)}

          {/* Weight */}
          {extracted.weight&&(<div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="weight" s={15} c="#fbbf24"/> Weight: {extracted.weight} lbs</div>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#7c8fac"}}>
                <input type="checkbox" checked={include.weight} onChange={()=>tog("weight")} style={{width:16,height:16,accentColor:"#2dd4bf"}}/>Include
              </label>
            </div>
          </div>)}

          {/* Medications */}
          {hasMeds&&(<div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="pill" s={15} c="#c084fc"/> Medications ({(extracted.medications||[]).filter(m=>m.name).length})</div>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#7c8fac"}}>
                <input type="checkbox" checked={include.medications} onChange={()=>tog("medications")} style={{width:16,height:16,accentColor:"#2dd4bf"}}/>Include
              </label>
            </div>
            {(extracted.medications||[]).filter(m=>m.name).map((m,i)=>(
              <div key={i} style={{background:"#141b27",borderRadius:10,padding:12,fontSize:13,marginBottom:8}}>
                <div style={{fontWeight:600}}>{m.name}</div>
                <div style={{color:"#7c8fac"}}>{[m.dosage,m.frequency,m.reason].filter(Boolean).join(" · ")||"—"}</div>
              </div>
            ))}
          </div>)}

          {/* Save document photo */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,padding:"12px 14px",background:"#141b27",borderRadius:12}}>
            <div style={{fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:8}}><Ic n="camera" s={15} c="#7c8fac"/> Save photo as document</div>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"#7c8fac"}}>
              <input type="checkbox" checked={include.document} onChange={()=>tog("document")} style={{width:16,height:16,accentColor:"#2dd4bf"}}/>Include
            </label>
          </div>

          {saved
            ?<div style={{textAlign:"center",padding:"16px 0",color:"#2dd4bf",fontWeight:600,fontSize:16}}>✓ All records saved!</div>
            :<div style={{display:"flex",gap:10}}>
              <Btn v="secondary" onClick={()=>setStep("upload")} full>Rescan</Btn>
              <Btn onClick={saveAll} full><Ic n="plus" s={15}/> Save All Records</Btn>
            </div>}
        </>)}
      </div>
    </div>
  );
};

// DOG DETAIL
const DogDetail=({dog,state,dispatch,onBack})=>{
  const[tab,setTab]=useState("overview");
  const[modal,setModal]=useState(null);
  const[showScan,setShowScan]=useState(false);
  const urgent=state.vaccinations.filter(v=>v.dogId===dog.id&&v.nextDue&&daysUntil(v.nextDue)<=30).length;
  return(<div style={{minHeight:"100vh",background:"#07090f",paddingBottom:80}}>
    <div style={{background:"#0e1219",borderBottom:"1px solid #1c2438",padding:"14px 16px",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:12,maxWidth:680,margin:"0 auto"}}>
        <button onClick={onBack} style={{background:"#141b27",border:"1px solid #1c2438",borderRadius:10,padding:"8px 10px",color:"#7c8fac"}}><Ic n="chevL" s={18}/></button>
        <Avatar dog={dog} size={40}/>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20}}>{dog.name}</div>
          <div style={{color:"#7c8fac",fontSize:12}}>{dog.breed||"Dog"}</div>
        </div>
        <Btn sm v="secondary" onClick={()=>exportHTML(dog,state)}><Ic n="download" s={14}/></Btn>
        <button onClick={()=>setShowScan(true)} title="AI Scan" style={{background:"linear-gradient(135deg,#2dd4bf22,#60a5fa22)",border:"1px solid #2dd4bf55",borderRadius:10,padding:"7px 11px",color:"#2dd4bf",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:5,cursor:"pointer"}}>
          <Ic n="camera" s={14} c="#2dd4bf"/>AI Scan
        </button>
      </div>
    </div>
    <div style={{maxWidth:680,margin:"0 auto",padding:"18px 16px"}} className="fade">
      {tab==="overview"&&<OverviewTab dog={dog} state={state} dispatch={dispatch} setModal={setModal}/>}
      {tab==="vaccines"&&<VaccinesTab dog={dog} state={state} dispatch={dispatch}/>}
      {tab==="health"&&<HealthTab dog={dog} state={state} dispatch={dispatch}/>}
      {tab==="records"&&<RecordsTab dog={dog} state={state} dispatch={dispatch}/>}
      {tab==="more"&&<MoreTab dog={dog} state={state} dispatch={dispatch}/>}
    </div>
    <BottomNav tab={tab} setTab={setTab} alerts={urgent}/>
    {modal==="editDog"&&<DogForm dog={dog} onSave={d=>{dispatch({t:"UPD_DOG",d});setModal(null);}} onClose={()=>setModal(null)}/>}
    {modal==="share"&&<ShareModal dog={dog} onClose={()=>setModal(null)}/>}
    {showScan&&<AIScanModal dog={dog} dispatch={dispatch} onClose={()=>setShowScan(false)}/>}
  </div>);
};

// HOME
const Home=({state,dispatch})=>{
  const[addDog,setAddDog]=useState(false);
  const[selDog,setSelDog]=useState(null);
  if(selDog){const dog=state.dogs.find(d=>d.id===selDog);if(dog)return <DogDetail dog={dog} state={state} dispatch={dispatch} onBack={()=>setSelDog(null)}/>;}
  const totalAlerts=state.vaccinations.filter(v=>v.nextDue&&daysUntil(v.nextDue)<=30).length;
  return(<div style={{minHeight:"100vh",background:"#07090f"}}>
    <div style={{background:"#0e1219",borderBottom:"1px solid #1c2438",padding:"20px 16px"}}>
      <div style={{maxWidth:680,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,letterSpacing:"-.01em"}}>🐾 PawRecord</div>
          <div style={{fontSize:13,color:"#7c8fac",marginTop:1}}>Pet Health Manager</div>
        </div>
        {totalAlerts>0&&(<div style={{background:"#fb923c14",border:"1px solid #fb923c44",borderRadius:10,padding:"8px 14px",display:"flex",alignItems:"center",gap:6,color:"#fb923c",fontSize:13}}>
          <Ic n="alert" s={14} c="#fb923c"/>{totalAlerts} alert{totalAlerts>1?"s":""}
        </div>)}
      </div>
    </div>
    <div style={{maxWidth:680,margin:"0 auto",padding:"24px 16px"}}>
      {state.dogs.length===0?(<div style={{textAlign:"center",paddingTop:72}}>
        <div style={{fontSize:60,marginBottom:16}}>🐕</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,marginBottom:8}}>Welcome to PawRecord</div>
        <div style={{color:"#7c8fac",marginBottom:32,fontSize:15,lineHeight:1.7}}>Keep your dog's health records organized,<br/>vaccination schedules on track, and every<br/>document ready when you travel.</div>
        <Btn onClick={()=>setAddDog(true)} style={{margin:"0 auto",fontSize:16,padding:"14px 28px"}}><Ic n="plus" s={16}/> Add Your First Dog</Btn>
      </div>):(<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24}}>Your Dogs</h2>
          <Btn sm onClick={()=>setAddDog(true)}><Ic n="plus" s={14}/> Add Dog</Btn>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {state.dogs.map(dog=>{
            const dv=state.vaccinations.filter(v=>v.dogId===dog.id);
            const overdue=dv.filter(v=>v.nextDue&&daysUntil(v.nextDue)<0).length;
            const upcoming=dv.filter(v=>v.nextDue&&daysUntil(v.nextDue)>=0&&daysUntil(v.nextDue)<=30).length;
            const activeMeds=state.medications.filter(m=>m.dogId===dog.id&&m.active).length;
            const allergyCount=state.allergies.filter(a=>a.dogId===dog.id).length;
            const age=dog.dob?Math.floor((Date.now()-new Date(dog.dob+"T12:00:00"))/(365.25*86400000)):null;
            return(<Card key={dog.id} onClick={()=>setSelDog(dog.id)}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <Avatar dog={dog} size={56}/>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19}}>{dog.name}</div>
                  <div style={{color:"#7c8fac",fontSize:13,marginBottom:8}}>{dog.breed||"Dog"}{age!==null?` · ${age}yr`:""}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {overdue>0&&<Badge label={`${overdue} overdue`} color="#f87171"/>}
                    {upcoming>0&&!overdue&&<Badge label={`${upcoming} due soon`} color="#fb923c"/>}
                    {dv.length>0&&!overdue&&!upcoming&&<Badge label="Up to date ✓" color="#2dd4bf"/>}
                    {activeMeds>0&&<Badge label={`${activeMeds} med${activeMeds>1?"s":""}`} color="#60a5fa"/>}
                    {allergyCount>0&&<Badge label={`${allergyCount} allerg${allergyCount>1?"ies":"y"}`} color="#f87171"/>}
                  </div>
                </div>
                <Ic n="chevR" s={18} c="#2d3a50"/>
              </div>
            </Card>);
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:20}}>
          {[{l:"Dogs",v:state.dogs.length,i:"paw",c:"#2dd4bf"},{l:"Vaccines",v:state.vaccinations.length,i:"syringe",c:"#60a5fa"},{l:"Visits",v:state.visits.length,i:"stethoscope",c:"#c084fc"}].map(s=>(
            <Card key={s.l} style={{padding:14,textAlign:"center"}}>
              <div style={{color:s.c,marginBottom:6}}><Ic n={s.i} s={18} c={s.c}/></div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24}}>{s.v}</div>
              <div style={{fontSize:11,color:"#7c8fac"}}>{s.l}</div>
            </Card>))}
        </div>
      </>)}
    </div>
    {addDog&&<DogForm onSave={d=>{dispatch({t:"ADD_DOG",d});setAddDog(false);}} onClose={()=>setAddDog(false)}/>}
  </div>);
};

// APP ROOT
export default function App(){
  const[state,dispatch]=useReducer(reducer,null,initState);
  const[ready,setReady]=useState(false);
  const saveTimer=useRef(null);
  useEffect(()=>{loadAll().then(s=>{dispatch({t:"LOAD",s});setReady(true);});},[]);
  useEffect(()=>{
    if(!ready)return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>persistAll(state),600);
    return()=>clearTimeout(saveTimer.current);
  },[state,ready]);
  if(!ready)return(<div style={{minHeight:"100vh",background:"#07090f",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,color:"#2dd4bf"}}>🐾 PawRecord</div>
  </div>);
  return(<ErrorBoundary><style>{GLOBAL}</style><Home state={state} dispatch={dispatch}/></ErrorBoundary>);
}

