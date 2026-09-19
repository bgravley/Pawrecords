import { useEffect, useMemo, useState } from 'react';

const C = { green:'#2C4A38', sage:'#7C9E87', light:'#9DC4AA', mint:'#EAF4EE', white:'#FAFCFB', gold:'#C9A84C', text:'#1A2E22', muted:'#5C7464' };

const seed = [
  'United States','France','United Kingdom','Canada','Mexico','Germany','Italy','Spain',
  'Costa Rica','Brazil','Australia','Japan','Colombia','Ecuador'
];

function slugify(v='') { return v.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

export default function PetTravelRequirementsPreview() {
  const [origin,setOrigin]=useState('United States');
  const [destination,setDestination]=useState('');
  const [species,setSpecies]=useState('dog');
  const [date,setDate]=useState('');
  const [mode,setMode]=useState('air');
  const [guide,setGuide]=useState(null);
  const [loading,setLoading]=useState(false);

  const destinationSlug=useMemo(()=>slugify(destination),[destination]);

  useEffect(()=>{
    if (!destinationSlug) { setGuide(null); return; }
    let active=true;
    setLoading(true);
    fetch(`/api/travel-requirements?destination=${encodeURIComponent(destinationSlug)}`)
      .then(async r => ({ ok:r.ok, body:await r.json().catch(()=>({})) }))
      .then(({ok,body})=>{ if(active) setGuide(ok ? body : { editorial_status:'not_yet_reviewed' }); })
      .catch(()=>{ if(active) setGuide({ editorial_status:'not_yet_reviewed' }); })
      .finally(()=>{ if(active) setLoading(false); });
    return ()=>{ active=false; };
  },[destinationSlug]);

  const hasReviewedGuide = guide?.editorial_status === 'reviewed' && guide?.requirements?.length > 0;

  const field={width:'100%',boxSizing:'border-box',padding:'12px 13px',borderRadius:10,border:'1px solid #D7E4DA',background:'#fff',fontFamily:"'Lora', serif",fontSize:14,color:C.text};
  const label={fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:C.muted,display:'block',marginBottom:6};

  return <div style={{minHeight:'100vh',background:C.white,color:C.text,fontFamily:"'Lora', serif"}}>
    <header style={{background:C.green,color:'#fff',padding:'56px 22px 48px'}}>
      <div style={{maxWidth:1000,margin:'0 auto'}}>
        <div style={{color:C.gold,fontSize:12,fontWeight:700,letterSpacing:'.12em',textTransform:'uppercase',marginBottom:12}}>YourPetPass Travel Desk · Preview</div>
        <h1 style={{fontFamily:"'Playfair Display', serif",fontSize:'clamp(34px,6vw,58px)',lineHeight:1.05,margin:'0 0 16px',maxWidth:780}}>Pet Travel Requirements</h1>
        <p style={{maxWidth:690,fontSize:17,lineHeight:1.7,color:'#E5EFE8',margin:0}}>Start with your route. YourPetPass will show reviewed requirements when we have them, or help build your trip requirements when we don't.</p>
      </div>
    </header>

    <main style={{maxWidth:1000,margin:'0 auto',padding:'34px 22px 70px'}}>
      <section style={{background:'#fff',border:'1px solid #DDE8E0',borderRadius:18,padding:24,boxShadow:'0 8px 30px rgba(44,74,56,.07)'}}>
        <h2 style={{fontFamily:"'Playfair Display', serif",color:C.green,fontSize:26,margin:'0 0 6px'}}>Where are you going?</h2>
        <p style={{color:C.muted,lineHeight:1.6,margin:'0 0 20px'}}>Travel rules can change based on where you're coming from, your pet and your travel date.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:14}}>
          <div><label style={label}>From</label><input style={field} value={origin} onChange={e=>setOrigin(e.target.value)} /></div>
          <div><label style={label}>To</label><input style={field} list="ypp-destinations" placeholder="France" value={destination} onChange={e=>setDestination(e.target.value)} /><datalist id="ypp-destinations">{seed.map(x=><option key={x} value={x}/>)}</datalist></div>
          <div><label style={label}>Pet</label><select style={field} value={species} onChange={e=>setSpecies(e.target.value)}><option value="dog">Dog</option><option value="cat">Cat</option></select></div>
          <div><label style={label}>Travel date</label><input style={field} type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
          <div><label style={label}>Travel by</label><select style={field} value={mode} onChange={e=>setMode(e.target.value)}><option value="air">Air</option><option value="land">Land</option><option value="sea">Sea</option></select></div>
        </div>
      </section>

      {destination && <section style={{marginTop:26}}>
        {loading ? <div style={{padding:22,color:C.muted}}>Checking reviewed YourPetPass requirements…</div> : hasReviewedGuide ? <>
          <div style={{background:C.mint,borderRadius:16,padding:22,border:'1px solid #D4E6D9'}}>
            <div style={{fontSize:12,fontWeight:700,color:C.sage,textTransform:'uppercase',letterSpacing:'.08em'}}>Reviewed destination guide</div>
            <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:30,color:C.green,margin:'6px 0 10px'}}>{guide.jurisdiction.display_name} pet entry requirements</h2>
            <p style={{margin:0,lineHeight:1.7}}>These are the reviewed requirements currently available in the YourPetPass knowledge layer. Your trip details determine which rules apply.</p>
          </div>
          <div style={{display:'grid',gap:12,marginTop:16}}>
            {guide.requirements.filter(r=>r.species==='all'||r.species===species).map(r=><article key={r.id} style={{background:'#fff',border:'1px solid #E0E9E2',borderRadius:14,padding:18}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',color:C.sage}}>{r.requirement_type.replaceAll('_',' ')}</div>
              <h3 style={{fontFamily:"'Playfair Display', serif",color:C.green,margin:'5px 0 7px',fontSize:21}}>{r.title}</h3>
              <p style={{margin:0,lineHeight:1.7,color:C.text}}>{r.rule_text}</p>
            </article>)}
          </div>
        </> : <div style={{background:C.green,color:'#fff',borderRadius:18,padding:26}}>
          <div style={{color:C.gold,fontSize:12,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em'}}>We can research this route</div>
          <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:30,margin:'7px 0 10px'}}>We don't have a reviewed {destination} guide yet.</h2>
          <p style={{color:'#E5EFE8',lineHeight:1.7,maxWidth:700}}>Build the trip in YourPetPass and the existing travel research system can research the official requirements for {origin} → {destination}. The reusable findings can then enter our review queue for a future public guide.</p>
          <button type="button" disabled style={{marginTop:8,border:0,borderRadius:10,padding:'13px 18px',background:C.gold,color:C.text,fontWeight:800,fontFamily:"'Lora', serif",opacity:.65}}>Build my trip requirements — enabled after review</button>
          <div style={{fontSize:11,color:'#BFD1C5',marginTop:10}}>Preview safety: this button is intentionally disabled until the reviewed workflow is approved.</div>
        </div>}
      </section>}

      <section style={{marginTop:38,borderTop:'1px solid #DDE8E0',paddingTop:28}}>
        <h2 style={{fontFamily:"'Playfair Display', serif",fontSize:27,color:C.green,margin:'0 0 12px'}}>How YourPetPass verifies travel requirements</h2>
        <p style={{color:C.muted,lineHeight:1.75,maxWidth:800}}>Country entry, export, transit, quarantine, health and customs rules are tied to responsible government authorities. Airline sources are used for that airline's own carriage policies, and airport sources for airport-specific logistics. Reviewed guidance records when its sources were checked so changing rules can be revalidated.</p>
      </section>
    </main>
  </div>;
}
