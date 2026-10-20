/* Supabase client, profiles, role UI, drop data layer */
// Payments are OFF until config.js sets window.DROPLIVE_PAYMENTS_ENABLED = true (and the Paystack setup is done).
const PAYMENTS_ENABLED = window.DROPLIVE_PAYMENTS_ENABLED === true;
const STORAGE_KEY='droplive_mvp_drops_v2';
const SUPABASE_URL = window.DROPLIVE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.DROPLIVE_SUPABASE_ANON_KEY || '';
// v0.14.1: never let a rate-limited (429) or server-error token refresh sign the user out.
// supabase-js treats a 429 on /token as a permanent failure and DELETES the saved session (=> SIGNED_OUT).
// Network failures, by contrast, are "retryable": the session is kept and the refresh is retried automatically.
// So we turn a 429/5xx on the refresh call into a network-style failure. Real invalid-token errors (400/401) still sign out.
const _nativeFetch = (...a)=>window.fetch(...a);
function authAwareFetch(input, init){
  return _nativeFetch(input, init).then(res=>{
    try{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(url.includes('/auth/v1/token')&&url.includes('grant_type=refresh_token')&&(res.status===429||res.status>=500)){
        throw new TypeError('Temporary auth failure ('+res.status+'); keeping session and retrying');
      }
    }catch(e){if(e instanceof TypeError)throw e;}
    return res;
  });
}
const sb = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) ? window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},
  global:{fetch:authAwareFetch}
}) : null;

// v0.13.0: one shared, short-lived session read. Many features call this at once on page load; this keeps it to a single
// auth call (and at most one token refresh) instead of a burst, which is what triggers Supabase 429 on /token.
let _sessP=null;
function authSession(){
  if(!sb)return Promise.resolve({data:{session:null},error:null});
  if(!_sessP){_sessP=sb.auth.getSession().then(r=>{
    // Remember the last good session. If a refresh is temporarily failing (rate limit / network), keep showing the user as signed in.
    if(r&&r.data&&r.data.session)window._lastGoodSession=r.data.session;
    else if(r&&r.error&&window._lastGoodSession)return {data:{session:window._lastGoodSession},error:null};
    return r;
  }).finally(()=>setTimeout(()=>{_sessP=null;},1500));}
  return _sessP;
}
// Replaces sb.auth.getUser(): reads the local session instead of a network call each time (the database still enforces access via RLS).
async function authUser(){
  const {data,error}=await authSession();
  if(error&&(error.status===429||/429|rate limit|too many/i.test(error.message||''))&&!window._rlWarned){
    window._rlWarned=1;try{toast('Too many sign-in attempts from this network. Please wait a few minutes and try again.');}catch(_){}
    setTimeout(()=>{window._rlWarned=0;},60000);
  }
  return {data:{user:data?.session?.user||null},error:error||null};
}
let currentDrop = null;
let currentProfile=null, profileLoadedFor=null, pledgeBusy=false, createBusy=false, lastRequestUnrouted=false;
const creatorMeta={};
async function fetchCreatorNames(ids){
  const out={}, u=[...new Set((ids||[]).filter(Boolean))]; if(!sb||!u.length)return out;
  let r=await sb.from('public_creator_profiles').select('id,display_name,username,verified').in('id',u);
  if(r.error)r=await sb.from('public_creator_profiles').select('id,display_name').in('id',u);
  if(r.error){console.warn('public_creator_profiles unavailable (run the v0.4.0 migration); falling back:',r.error.message);r=await sb.from('profiles').select('id,display_name').in('id',u);}
  (r.data||[]).forEach(x=>{out[x.id]=x.display_name;creatorMeta[x.id]={username:x.username||null,verified:!!x.verified};}); return out;
}
async function attachCreatorNames(rows){const n=await fetchCreatorNames(rows.map(r=>r.creator_id));rows.forEach(r=>{if(n[r.creator_id])r.profiles={display_name:n[r.creator_id]}});return rows;}
async function loadMyProfile(force){
  if(!sb)return null;
  const {data:{session}}=await authSession(); const uid=session?.user?.id||null;
  if(!uid){currentProfile=null;profileLoadedFor=null;applyRoleUI();return null;}
  if(!force&&profileLoadedFor===uid&&currentProfile)return currentProfile;
  const {data,error}=await sb.from('profiles').select('id,display_name,role,avatar_url,username').eq('id',uid).maybeSingle();
  if(error){console.warn('Profile load failed; keeping current UI:',error.message);return currentProfile;}
  currentProfile=data||null; profileLoadedFor=uid; applyRoleUI(); refreshCreatorBadge();
  if(currentProfile&&!currentProfile.username&&currentProfile.role!=='fan'&&!window._nudged){window._nudged=true;setTimeout(()=>toast('Tip: set your @username in Account & Settings so fans can find you.'),800);}
  return currentProfile;
}
function applyRoleUI(){
  // Hide creator-only navigation only when the saved role is known to be 'fan'. Unknown/loading never hides or signs out. The database enforces the real rule.
  const show=!sb||!currentProfile||['creator','both'].includes(currentProfile.role);
  document.querySelectorAll('.tabs .tab').forEach(t=>{const oc=t.getAttribute('data-act')||'';if(oc.includes("'create'")||oc.includes("'creator'"))t.style.display=show?'':'none';});
  document.querySelectorAll('#accountModal button').forEach(b=>{const oc=b.getAttribute('data-act')||'';if(oc.includes('openCreatorDemandFromAccount')||oc.includes('startCreateDropFromAccount'))b.style.display=show?'':'none';});
  const hb=document.getElementById('heroCreatorBtn');
  if(hb){const r=currentProfile?.role;hb.textContent=!sb||!currentProfile?"I'M A CREATOR":(['creator','both'].includes(r)?'OPEN CREATOR DASHBOARD':'BECOME A CREATOR');}
  const cn=document.getElementById('creatorName');
  if(cn&&currentProfile?.display_name){cn.value=currentProfile.display_name;cn.readOnly=true;cn.title='Your public name comes from Account & Settings.';}
}

function getDrops(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch(e){return[]}}
function saveDrops(drops){localStorage.setItem(STORAGE_KEY,JSON.stringify(drops))}
function activeDrop(){return currentDrop || getDrops()[getDrops().length-1] || null}
function renderActiveDrop(){
  const d=activeDrop(); if(!d)return;
  const raised=Number(d.raised||0), goal=Number(d.goal||1), pct=Math.min(Math.round(raised/goal*100),100), el=id=>document.getElementById(id);
  if(el('raised'))el('raised').textContent=money(raised);
  if(el('fill'))el('fill').style.width=pct+'%';
  if(el('pcount'))el('pcount').textContent=(d.contributors||0).toLocaleString()+' fans contributed';
  if(el('lc'))el('lc').textContent=(d.contributors||0).toLocaleString()+' in';
  if(el('sleft'))el('sleft').textContent=raised>=goal?'🔥 DROP UNLOCKED':money(Math.max(goal-raised,0))+' to unlock';
  const goalEl=document.querySelector('.dc-goal'); if(goalEl)goalEl.textContent='of '+money(goal)+' goal';
  const cta=el('cta'); if(cta)cta.textContent='CONTRIBUTE '+money(d.contribution)+' · '+(raised>=goal?'DROP UNLOCKED':'UNLOCK THE DROP');
  const basePrice=el('baseTierPrice'); if(basePrice)basePrice.textContent=money(d.contribution);
  const contribution=el('publicContribution'); if(contribution)contribution.textContent=money(d.contribution);
  const desc=el('dropDescriptionPublic'); if(desc)desc.textContent=d.description || 'Support this exclusive Drop experience.';
  const title=document.querySelector('.dc-tt'); if(title && d.title)title.textContent=d.title;
  const name=document.querySelector('.dc-name'); if(name && d.creator){name.textContent=d.creator;if(d.creatorId){name.style.cursor='pointer';name.title='View creator profile';name.onclick=()=>{location.href=location.pathname+'?creator='+encodeURIComponent(d.creatorId);};}}
  const av=document.querySelector('.dc-av'); if(av && d.creator)av.textContent=initials(d.creator);
  const cm=creatorMeta[d.creatorId]||{}; const meta=document.querySelector('.dc-meta'); if(meta)meta.textContent=(d.demo?'Demo experience · ':'')+(cm.verified?'✓ Verified creator':'Creator')+(cm.username?' · @'+cm.username:'');
  const lp=document.querySelector('.live-pill'); if(lp){const m={funding:'FUNDING',unlocked:'FUNDED',live:'LIVE NOW',completed:'COMPLETED',failed:'NOT FUNDED',cancelled:'CANCELLED',draft:'DRAFT'};lp.textContent=m[d.status]||'FUNDING';}
  const sc=document.getElementById('stickyCta'); if(sc)sc.textContent='CONTRIBUTE '+money(d.contribution)+' · PLEDGE';
  const closed=(d.deadline&&new Date(d.deadline)<=new Date())||(d.status&&!['funding','unlocked','live'].includes(d.status));
  loadDelivery();
  [cta,sc].forEach(b=>{if(b){b.disabled=!!closed;if(closed)b.textContent=d.status==='cancelled'?'DROP CANCELLED':'FUNDING CLOSED';}});
}
async function loadDropFromBackend(id){
  if(!sb || !id)return null;
  const {data,error}=await sb.from('drops').select('id,creator_id,title,description,goal_amount,contribution_amount,scheduled_at,deadline,status,raised_amount,contributor_count').eq('id',id).single();
  if(error) return null;
  const names=await fetchCreatorNames([data.creator_id]);
  const creatorName=names[data.creator_id]||'Unnamed creator';
  return {id:data.id,creator:creatorName,title:data.title,description:data.description,goal:data.goal_amount,contribution:data.contribution_amount,date:data.scheduled_at,time:'',deadline:data.deadline,raised:data.raised_amount||0,contributors:data.contributor_count||0,status:data.status,creatorId:data.creator_id};
}

// ── Creator profile pages (?creator=<id or username>) ──
