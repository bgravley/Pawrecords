#!/usr/bin/env python3
from pathlib import Path
import re


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)


# ── PawRecord: shared authenticated-app primitives ─────────────
path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')

text = replace_once(
    text,
    "  button:active{transform:scale(.97)} ::-webkit-scrollbar{width:3px}\n",
    "  button:active{transform:scale(.97)}\n  button:focus-visible,[role=\"button\"]:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #C9A84C;outline-offset:3px}\n  ::-webkit-scrollbar{width:3px}\n",
    'global focus-visible styles',
)

old_ic = '  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[n]}</svg>;'
new_ic = '  return <svg aria-hidden="true" focusable="false" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[n]}</svg>;'
text = replace_once(text, old_ic, new_ic, 'decorative icon semantics')

old_btn = '''const Btn=({children,onClick,v="primary",sm,full,style:s,disabled})=>{\n  const V={primary:{background:"#2C4A38",color:"#FAFCFB"},secondary:{background:"#FFFFFF",color:"#1A2E22",border:"1px solid #DCE8E0"},danger:{background:"#C4714A14",color:"#C4714A",border:"1px solid #C4714A44"},ghost:{background:"transparent",color:"#385744"}};\n  return <button onClick={disabled?undefined:onClick} style={{...V[v],borderRadius:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity .15s",width:full?"100%":"auto",justifyContent:full?"center":"flex-start",padding:sm?"7px 14px":"10px 20px",fontSize:sm?13:14,opacity:disabled?.5:1,border:"none",...s}} onMouseEnter={e=>!disabled&&(e.currentTarget.style.opacity="0.8")} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;\n};'''
new_btn = '''const Btn=({children,onClick,v="primary",sm,full,style:s,disabled,...props})=>{\n  const V={primary:{background:"#2C4A38",color:"#FAFCFB"},secondary:{background:"#FFFFFF",color:"#1A2E22",border:"1px solid #DCE8E0"},danger:{background:"#C4714A14",color:"#C4714A",border:"1px solid #C4714A44"},ghost:{background:"transparent",color:"#385744"}};\n  return <button type="button" disabled={!!disabled} aria-disabled={disabled?true:undefined} onClick={onClick} {...props} style={{...V[v],borderRadius:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity .15s",width:full?"100%":"auto",justifyContent:full?"center":"flex-start",padding:sm?"7px 14px":"10px 20px",fontSize:sm?13:14,opacity:disabled?.5:1,border:"none",cursor:disabled?"not-allowed":"pointer",...s}} onMouseEnter={e=>!disabled&&(e.currentTarget.style.opacity="0.8")} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;\n};'''
text = replace_once(text, old_btn, new_btn, 'PawRecord accessible Btn')

old_card = '''const Card=({children,style:s,onClick})=>(\n  <div onClick={onClick} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:16,padding:18,boxShadow:"0 2px 12px rgba(44,32,23,0.06)",...s,cursor:onClick?"pointer":"default",transition:"border-color .2s"}} onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor="#2C4A3855")} onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor="#DCE8E0")}>{children}</div>\n);'''
new_card = '''const Card=({children,style:s,onClick,ariaLabel})=>(\n  <div onClick={onClick} role={onClick?"button":undefined} tabIndex={onClick?0:undefined} aria-label={ariaLabel} onKeyDown={e=>{if(onClick&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onClick(e);}}} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:16,padding:18,boxShadow:"0 2px 12px rgba(44,32,23,0.06)",...s,cursor:onClick?"pointer":"default",transition:"border-color .2s"}} onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor="#2C4A3855")} onMouseLeave={e=>onClick&&(e.currentTarget.style.borderColor="#DCE8E0")}>{children}</div>\n);'''
text = replace_once(text, old_card, new_card, 'PawRecord keyboard Card')

old_field = '''const Field=({label,children,col})=>(\n  <div style={{display:"flex",flexDirection:"column",gap:5,gridColumn:col}}>\n    <label style={{fontSize:11,fontWeight:600,color:"#385744",textTransform:"uppercase",letterSpacing:".05em"}}>{label}</label>\n    {children}\n  </div>\n);'''
new_field = '''const Field=({label,children,col})=>(\n  <label style={{display:"flex",flexDirection:"column",gap:5,gridColumn:col}}>\n    <span style={{fontSize:11,fontWeight:600,color:"#385744",textTransform:"uppercase",letterSpacing:".05em"}}>{label}</span>\n    {children}\n  </label>\n);'''
text = replace_once(text, old_field, new_field, 'PawRecord associated Field labels')

old_modal_inner = '<div style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:20,width:"100%",maxWidth:wide?620:500,maxHeight:"92vh",overflow:"auto",padding:24,boxShadow:"0 8px 40px rgba(44,32,23,0.15)"}} className="fade">'
new_modal_inner = '<div role="dialog" aria-modal="true" aria-label={title} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:20,width:"100%",maxWidth:wide?620:500,maxHeight:"92vh",overflow:"auto",padding:24,boxShadow:"0 8px 40px rgba(44,32,23,0.15)"}} className="fade">'
text = replace_once(text, old_modal_inner, new_modal_inner, 'PawRecord modal semantics')
old_close = '<button onClick={onClose} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:8,padding:"6px 8px",color:"#385744"}}><Ic n="x" s={16}/></button>'
new_close = '<button type="button" aria-label={`Close ${title}`} onClick={onClose} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:8,padding:"6px 8px",color:"#385744"}}><Ic n="x" s={16}/></button>'
text = replace_once(text, old_close, new_close, 'PawRecord modal close label')

old_empty = '''const Empty=({icon,title,sub,action})=>(\n  <div style={{textAlign:"center",padding:"48px 20px"}}>\n    <div style={{color:"#6A8372",marginBottom:12}}><Ic n={icon} s={36} c="#6A8372"/></div>\n    <div style={{fontFamily:"'Lora',serif",fontSize:20,marginBottom:6}}>{title}</div>\n    <div style={{color:"#385744",fontSize:14,marginBottom:22}}>{sub}</div>\n    {action}\n  </div>\n);'''
new_empty = '''const Empty=({icon,title,sub,action})=>(\n  <section aria-label={title} style={{textAlign:"center",padding:"48px 20px"}}>\n    <div aria-hidden="true" style={{color:"#6A8372",marginBottom:12}}><Ic n={icon} s={36} c="#6A8372"/></div>\n    <h3 style={{fontFamily:"'Lora',serif",fontSize:20,marginBottom:6}}>{title}</h3>\n    <p style={{color:"#385744",fontSize:14,marginBottom:22,lineHeight:1.6}}>{sub}</p>\n    {action}\n  </section>\n);'''
text = replace_once(text, old_empty, new_empty, 'semantic Empty state')

# Helpful empty states rather than non-interactive click text.
old_allergy = '''?<Card style={{borderStyle:"dashed"}}><div style={{color:"#385744",fontSize:14,textAlign:"center",padding:"12px 0"}}>No allergies recorded. <span style={{color:"#2C4A38",cursor:"pointer"}} onClick={()=>setModal({type:"addAlrg"})}>Add one</span></div></Card>'''
new_allergy = '''?<Empty icon="alert" title="No allergies recorded" sub="Add a known allergy or sensitivity so it stays with your pet's health history." action={<Btn onClick={()=>setModal({type:"addAlrg"})}><Ic n="plus" s={14}/> Add Allergy</Btn>}/>'''
text = replace_once(text, old_allergy, new_allergy, 'allergy empty action')

old_docs = '''?(<div style={{textAlign:"center",padding:"24px 0"}}>\n            <div style={{fontSize:40,marginBottom:12}}>📄</div>\n            <div style={{fontFamily:"'Lora',serif",fontSize:18,marginBottom:6}}>No documents yet</div>\n            <div style={{fontSize:13,color:"#385744",marginBottom:4}}>Use AI Scan to upload vet records, vaccine docs, or service animal certs.</div>\n            <div style={{fontSize:12,color:"#6A8372",marginBottom:16}}>Scanned records are automatically saved to your pet's health profile.</div>\n            <Btn onClick={onScan}><Ic n="camera" s={14}/> Start AI Scan</Btn>\n          </div>)'''
new_docs = '''?<Empty icon="doc" title="No documents yet" sub="Scan a vet record, vaccine certificate, or travel document. YourPetPass will keep it with this pet's health history." action={<Btn onClick={onScan}><Ic n="camera" s={14}/> Scan First Document</Btn>}/>'''
text = replace_once(text, old_docs, new_docs, 'documents empty state')

# Saved vets previously rendered a blank area when there were none.
vets_anchor = '    {vets.map(v=>(<Card key={v.id}>'
if 'No saved vets yet' not in text:
    if vets_anchor not in text:
        raise SystemExit('Could not locate saved-vets list')
    text = text.replace(vets_anchor, '    {vets.length===0&&<Empty icon="stethoscope" title="No saved vets yet" sub="Save your regular vet or a clinic you trust so their contact details stay easy to find." action={<Btn onClick={()=>setModal({type:"addVet"})}><Ic n="plus" s={14}/> Save a Vet</Btn>}/>}\n' + vets_anchor, 1)

# Search fields need names independent of placeholder text.
text = text.replace('<input maxLength={150} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search vaccines..."', '<input aria-label="Search vaccinations" maxLength={150} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search vaccines..."')
text = text.replace('<input maxLength={150} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search visits by reason, vet, or diagnosis..."', '<input aria-label="Search vet visits" maxLength={150} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search visits by reason, vet, or diagnosis..."')

# Icon-only controls get explicit accessible names.
replacements = [
    ('<button title="Add to Calendar" onClick={()=>exportICS(dog.name,v.name,v.next_due)}', '<button type="button" aria-label={`Add ${v.name} vaccination due date to calendar`} title="Add to Calendar" onClick={()=>exportICS(dog.name,v.name,v.next_due)}'),
    ('<button onClick={()=>setModal({type:"edit",v})} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:8,padding:"5px 8px",color:"#385744"}}><Ic n="edit" s={13}/></button>', '<button type="button" aria-label={`Edit ${v.name} vaccination`} onClick={()=>setModal({type:"edit",v})} style={{background:"#FFFFFF",border:"1px solid #DCE8E0",borderRadius:8,padding:"5px 8px",color:"#385744"}}><Ic n="edit" s={13}/></button>'),
    ('<button onClick={()=>delVacc(v.id)}', '<button type="button" aria-label={`Delete ${v.name} vaccination`} onClick={()=>delVacc(v.id)}'),
    ('<button onClick={()=>setModal({type:"editAlrg",a})}', '<button type="button" aria-label={`Edit ${a.allergen} allergy`} onClick={()=>setModal({type:"editAlrg",a})}'),
    ('<button onClick={()=>delAlrg(a.id)}', '<button type="button" aria-label={`Delete ${a.allergen} allergy`} onClick={()=>delAlrg(a.id)}'),
    ('<button onClick={()=>setModal({type:"editMed",m})}', '<button type="button" aria-label={`Edit ${m.name} medication`} onClick={()=>setModal({type:"editMed",m})}'),
    ('<button onClick={()=>delMed(m.id)}', '<button type="button" aria-label={`Delete ${m.name} medication`} onClick={()=>delMed(m.id)}'),
    ('<button onClick={()=>delVisit(v.id)}', '<button type="button" aria-label={`Delete vet visit ${v.reason}`} onClick={()=>delVisit(v.id)}'),
    ('<button onClick={async()=>{try{await db.deleteWeight(w.id);', '<button type="button" aria-label={`Delete weight record from ${fmt(w.log_date)}`} onClick={async()=>{try{await db.deleteWeight(w.id);'),
    ('<button onClick={async()=>{await db.deleteSavedVet(v.id);', '<button type="button" aria-label={`Delete saved vet ${v.name}`} onClick={async()=>{await db.deleteSavedVet(v.id);'),
    ('<button onClick={async()=>{await db.deleteDocument(d.id,d.file_path);', '<button type="button" aria-label={`Delete ${d.name||"document"}`} onClick={async()=>{await db.deleteDocument(d.id,d.file_path);'),
    ('<button onClick={()=>deleteContact(ec.id)}', '<button type="button" aria-label={`Delete emergency contact ${ec.name}`} onClick={()=>deleteContact(ec.id)}'),
]
for old, new in replacements:
    if old in text and new not in text:
        text = text.replace(old, new, 1)

# Document open/download link is icon-only.
text = text.replace('target="_blank" rel="noopener noreferrer"\n            style={{background:"#2C4A3814"', 'target="_blank" rel="noopener noreferrer" aria-label={`Open ${d.name||"document"}`}\n            style={{background:"#2C4A3814"')

# First-run state should have a real heading.
text = text.replace('<div style={{fontFamily:"\'Lora\',serif",fontSize:28,marginBottom:8,fontStyle:"italic"}}>Welcome to YourPetPass</div>', '<h2 style={{fontFamily:"\'Lora\',serif",fontSize:28,marginBottom:8,fontStyle:"italic"}}>Welcome to YourPetPass</h2>')

path.write_text(text, encoding='utf-8')


# ── Travel: match the same interaction primitives ─────────────
path = Path('src/Travel.jsx')
text = path.read_text(encoding='utf-8')

old_btn = '''  return (\n    <button onClick={disabled ? undefined : onClick}\n      style={{ ...V[v], borderRadius: 12, fontWeight: 700, display: "inline-flex", alignItems: "center",\n        gap: 6, width: full ? "100%" : "auto", justifyContent: full ? "center" : "flex-start",\n        padding: sm ? "7px 14px" : "10px 20px", fontSize: sm ? 13 : 14,\n        opacity: disabled ? 0.5 : 1, border: "none", cursor: "pointer",\n        fontFamily: "'Nunito', sans-serif", ...s }}\n      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "0.85")}\n      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>\n      {children}\n    </button>\n  );'''
new_btn = '''  return (\n    <button type="button" disabled={!!disabled} aria-disabled={disabled ? true : undefined} onClick={onClick}\n      style={{ ...V[v], borderRadius: 12, fontWeight: 700, display: "inline-flex", alignItems: "center",\n        gap: 6, width: full ? "100%" : "auto", justifyContent: full ? "center" : "flex-start",\n        padding: sm ? "7px 14px" : "10px 20px", fontSize: sm ? 13 : 14,\n        opacity: disabled ? 0.5 : 1, border: "none", cursor: disabled ? "not-allowed" : "pointer",\n        fontFamily: "'Nunito', sans-serif", ...s }}\n      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "0.85")}\n      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>\n      {children}\n    </button>\n  );'''
text = replace_once(text, old_btn, new_btn, 'Travel accessible Btn')

old_card = '''const Card = ({ children, style: s, onClick }) => (\n  <div onClick={onClick} style={{\n    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,\n    padding: 18, boxShadow: C.shadow, ...s,\n    cursor: onClick ? "pointer" : "default", transition: "box-shadow .2s"\n  }}\n    onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 20px rgba(44,32,23,0.14)")}\n    onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = C.shadow)}>\n    {children}\n  </div>\n);'''
new_card = '''const Card = ({ children, style: s, onClick, ariaLabel }) => (\n  <div onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} aria-label={ariaLabel}\n    onKeyDown={e => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(e); } }} style={{\n    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,\n    padding: 18, boxShadow: C.shadow, ...s,\n    cursor: onClick ? "pointer" : "default", transition: "box-shadow .2s"\n  }}\n    onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 20px rgba(44,32,23,0.14)")}\n    onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = C.shadow)}>\n    {children}\n  </div>\n);'''
text = replace_once(text, old_card, new_card, 'Travel keyboard Card')

old_field = '''const Field = ({ label, children, col }) => (\n  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: col }}>\n    <label style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</label>\n    {children}\n  </div>\n);'''
new_field = '''const Field = ({ label, children, col }) => (\n  <label style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: col }}>\n    <span style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>\n    {children}\n  </label>\n);'''
text = replace_once(text, old_field, new_field, 'Travel associated Field labels')

old_modal_inner = '''    <div style={{\n      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,\n      width: "100%", maxWidth: wide ? 620 : 500, maxHeight: "92vh",\n      overflow: "auto", padding: 24, boxShadow: "0 8px 40px rgba(44,32,23,0.15)"\n    }}>'''
new_modal_inner = '''    <div role="dialog" aria-modal="true" aria-label={title} style={{\n      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,\n      width: "100%", maxWidth: wide ? 620 : 500, maxHeight: "92vh",\n      overflow: "auto", padding: 24, boxShadow: "0 8px 40px rgba(44,32,23,0.15)"\n    }}>'''
text = replace_once(text, old_modal_inner, new_modal_inner, 'Travel modal semantics')
old_close = '''        <button onClick={onClose} style={{\n          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,\n          padding: "6px 10px", color: C.sub, cursor: "pointer"\n        }}>✕</button>'''
new_close = '''        <button type="button" aria-label={`Close ${title}`} onClick={onClose} style={{\n          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,\n          padding: "6px 10px", color: C.sub, cursor: "pointer"\n        }}>✕</button>'''
text = replace_once(text, old_close, new_close, 'Travel modal close label')

# Make the empty-trip message a semantic region/heading without changing visual design.
text = text.replace('<div style={{ textAlign: "center", padding: "52px 20px" }}>\n            <div style={{ fontSize: 48, marginBottom: 14 }}>✈️</div>\n            <div style={{ fontFamily: "\'Lora\', serif", fontSize: 22, marginBottom: 6, fontStyle: "italic" }}>\n              {filter === "upcoming" ? "No upcoming trips" : "No past trips"}\n            </div>', '<section aria-label={filter === "upcoming" ? "No upcoming trips" : "No past trips"} style={{ textAlign: "center", padding: "52px 20px" }}>\n            <div aria-hidden="true" style={{ fontSize: 48, marginBottom: 14 }}>✈️</div>\n            <h3 style={{ fontFamily: "\'Lora\', serif", fontSize: 22, marginBottom: 6, fontStyle: "italic" }}>\n              {filter === "upcoming" ? "No upcoming trips" : "No past trips"}\n            </h3>')
# Close only the matching empty-state container after the Plan First Trip block.
text = text.replace('''            {filter === "upcoming" && (\n              <Btn onClick={() => setShowNew(true)} style={{ margin: "0 auto", background: C.warn, color: "#2C2017" }}>+ Plan First Trip</Btn>\n            )}\n          </div>''', '''            {filter === "upcoming" && (\n              <Btn onClick={() => setShowNew(true)} style={{ margin: "0 auto", background: C.warn, color: "#2C2017" }}>+ Plan First Trip</Btn>\n            )}\n          </section>''')

path.write_text(text, encoding='utf-8')

print('Applied authenticated-app accessibility foundation and stronger empty states.')
