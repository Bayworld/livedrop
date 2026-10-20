/* Public creator profile pages, initial drop loading */
let profileCreator=null;
function profileUrl(c){return location.origin+location.pathname+'?creator='+encodeURIComponent(c.username||c.id);}
function leaveProfile(){location.href=location.pathname;}
async function copyProfileLink(){if(!profileCreator)return;const u=profileUrl(profileCreator);try{await navigator.clipboard.writeText(u);toast('Profile link copied.','good');}catch(e){prompt('Copy this profile link:',u);}}
async function copyMyProfileLink(){const p=await loadMyProfile();if(!p){openAuth();return;}const u=profileUrl(p);try{await navigator.clipboard.writeText(u);toast('Your profile link is copied.','good');}catch(e){prompt('Copy your profile link:',u);}}
async function profileFollow(){if(!profileCreator)return;await toggleCreatorFollow(profileCreator.id);const b=document.getElementById('pfFollowBtn');if(b)b.textContent=followedCreatorIds.has(profileCreator.id)?'FOLLOWING':'FOLLOW';}
function profileRequest(){if(!profileCreator)return;document.body.classList.remove('public-profile-mode');const t=document.querySelector('.tab[data-act*="request"]');openRequestWithCreator(profileCreator.display_name||'',profileCreator.id);}
async function loadProfilePage(key){
  document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.getElementById('p-profile').classList.add('on');
  const box=document.getElementById('profileBox');
  if(!sb){box.innerHTML='<div class="market-empty">Creator profiles need the connected database.</div>';return;}
  const k=String(key||'').trim().replace(/^@/,'').slice(0,64);
  const isId=/^[0-9a-f-]{36}$/i.test(k);
  let q=sb.from('public_creator_profiles').select('id,display_name,username,verified,role,avatar_url');
  q=isId?q.eq('id',k):q.eq('username',k.toLowerCase());
  const r=await q.maybeSingle();
  if(r.error||!r.data){box.innerHTML='<div class="market-empty">We couldn’t find that creator. The link may be wrong, or they haven’t set up a profile yet.</div>';return;}
  const c=r.data; profileCreator=c; document.title=(c.display_name||'Creator')+' · DropLive';
  const d=await sb.from('drops').select('id,creator_id,title,description,goal_amount,contribution_amount,status,raised_amount,contributor_count,deadline').eq('creator_id',c.id).in('status',['funding','unlocked','live','completed']).order('created_at',{ascending:false}).limit(50);
  const rows=d.data||[];
  creatorMeta[c.id]={username:c.username||null,verified:!!c.verified};
  const active=rows.filter(x=>['funding','unlocked','live'].includes(x.status));
  const done=rows.filter(x=>x.status==='completed');
  const backers=rows.reduce((a,x)=>a+(x.contributor_count||0),0), raised=rows.reduce((a,x)=>a+Number(x.raised_amount||0),0);
  const {data:sd}=await authSession(); const uid=sd?.session?.user?.id||null;
  followedCreatorIds=new Set();
  if(uid){const f=await sb.from('creator_follows').select('creator_id').eq('fan_id',uid).eq('creator_id',c.id);if(!f.error)followedCreatorIds=new Set((f.data||[]).map(x=>x.creator_id));}
  const card=x=>{const pct=x.goal_amount?Math.min(100,Math.round((x.raised_amount||0)/x.goal_amount*100)):0;return `<article class="market-card"><div class="market-card-body"><div class="market-title" style="margin-top:0">${escapeHtml(x.title)}</div><div class="market-desc">${escapeHtml((x.description||'').slice(0,110))}</div><div class="market-progress"><div style="width:${pct}%"></div></div><div class="market-stats"><span><strong>${money(x.raised_amount)}</strong> of ${money(x.goal_amount)}</span><span>${pct}%</span></div><div class="market-actions"><a class="dc-cta" style="margin:0;text-align:center;text-decoration:none;display:block" href="?drop=${encodeURIComponent(x.id)}">${x.status==='completed'?'VIEW':'BACK THIS DROP'}</a></div></div></article>`;};
  const mine=uid===c.id;
  box.innerHTML=`<div class="pf-head"><div class="market-avatar pf-av">${escapeHtml(initials(c.display_name))}</div><div style="min-width:0"><div class="pf-name">${escapeHtml(c.display_name||'Creator')}</div><div class="market-meta">${c.verified?'✓ VERIFIED CREATOR':'CREATOR'}${c.username?' · @'+escapeHtml(c.username):''}</div></div></div>
  <div class="pf-stats"><div class="pf-stat"><b>${active.length}</b><span>Active Drops</span></div><div class="pf-stat"><b>${backers}</b><span>Backers</span></div><div class="pf-stat"><b>${money(raised)}</b><span>Raised</span></div></div>
  <div class="pf-actions">${mine?'':'<button class="tab" data-act="openReport(\'creator\')">Report</button>'}${mine?'<button class="tab" data-act="copyProfileLink()">COPY MY PROFILE LINK</button>':`<button class="tab" id="pfFollowBtn" data-act="profileFollow()">${followedCreatorIds.has(c.id)?'FOLLOWING':'FOLLOW'}</button><button class="dc-cta" data-act="profileRequest()">REQUEST A DROP</button><button class="tab" data-act="copyProfileLink()">SHARE</button>`}</div>
  <div class="ct" style="margin:26px 0 10px">Active Drops</div>
  <div class="market-grid">${active.length?active.map(card).join(''):'<div class="market-empty" style="grid-column:1/-1">No active Drops right now. Follow this creator or request one.</div>'}</div>
  ${done.length?`<div class="ct" style="margin:26px 0 10px">Completed</div><div class="market-grid">${done.map(card).join('')}</div>`:''}`;
}
async function loadInitialDrop(){
  const pk=new URLSearchParams(location.search).get('creator'); if(pk){document.body.classList.add('public-profile-mode');loadProfilePage(pk);return;}
  const id=new URLSearchParams(location.search).get('drop');
  if(id){
    document.body.classList.add('public-drop-mode');
    document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));
    const product=document.getElementById('p-product'); if(product)product.classList.add('on');
    const heading=document.getElementById('publicDropHeading'); if(heading)heading.textContent='Public Drop';
  }
  if(id && sb){const d=await loadDropFromBackend(id);if(d){currentDrop=d;renderActiveDrop();return;}}
  if(id){const d=getDrops().find(x=>x.id===id);if(d)currentDrop=d;}
  renderActiveDrop();
}
