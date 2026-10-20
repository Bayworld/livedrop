/* Explore, demand board, creator directory, sharing */
function demoDrops(){return new URLSearchParams(location.search).has('demo')?DEMO_DROPS:[];}
const DEMO_DROPS=[
  {id:'demo-burna',creator:'Burna Boy',title:'Private Afrobeats Q&A',description:'A sample fan-funded live conversation about music, creativity and the journey.',goal:500000,contribution:10000,raised:325000,contributors:65,status:'funding',category:'music',demo:true},
  {id:'demo-phyna',creator:'Phyna',title:'Reality TV & Life — Live Q&A',description:'A sample live conversation about reality TV, life after the show and fan questions.',goal:150000,contribution:5000,raised:92000,contributors:18,status:'funding',category:'entertainment',demo:true},
  {id:'demo-olamide',creator:'Olamide',title:'Music, Hustle & Industry — Live Session',description:'A sample creator conversation about music, business and building culture.',goal:750000,contribution:10000,raised:510000,contributors:51,status:'funding',category:'music',demo:true},
  {id:'demo-davido',creator:'Davido',title:'Afrobeats, Business & Life — Live Conversation',description:'A sample experience covering music, entrepreneurship and life on the road.',goal:1000000,contribution:20000,raised:640000,contributors:32,status:'funding',category:'business',demo:true},
  {id:'demo-jerry',creator:'Pastor Jerry Eze',title:'Faith & Purpose — Live Q&A',description:'A sample faith-focused live Q&A around purpose, prayer and personal growth.',goal:300000,contribution:5000,raised:215000,contributors:43,status:'funding',category:'faith',demo:true},
  {id:'demo-toke',creator:'Toke Makinwa',title:'Relationships, Career & Life — Live Q&A',description:'A sample conversation about relationships, career and navigating modern life.',goal:200000,contribution:5000,raised:140000,contributors:28,status:'funding',category:'lifestyle',demo:true}
];
let exploreItems=[]; let activeExploreFilter='all'; let exploreQuery=''; let exploreSort='new'; let exploreSearchTimer;
function normalizeDropRow(data){return {id:data.id,creator:data.profiles?.display_name||data.creator||'Creator',title:data.title,description:data.description||'',goal:Number(data.goal_amount??data.goal??0),contribution:Number(data.contribution_amount??data.contribution??0),raised:Number(data.raised_amount??data.raised??0),contributors:Number(data.contributor_count??data.contributors??0),status:data.status||'funding',category:data.category||'other',creatorId:data.creator_id,deadline:data.deadline,demo:false}}
async function loadExploreDrops(){
  exploreItems=[...demoDrops()];
  if(sb){
    const {data,error}=await sb.from('drops').select('id,creator_id,title,description,goal_amount,contribution_amount,status,raised_amount,contributor_count,deadline,category').in('status',['funding','unlocked','live']).order('created_at',{ascending:false}).limit(50);
    if(!error && data){await attachCreatorNames(data);exploreItems=[...data.filter(r=>!r.deadline||new Date(r.deadline)>new Date()).map(normalizeDropRow),...demoDrops()];}
  }else{
    const locals=getDrops().map(normalizeDropRow); exploreItems=[...locals,...demoDrops()];
  }
  renderExplore(); renderMyActivity();
}

function visibleExploreItems(){
  const q=exploreQuery.trim().toLowerCase();
  const list=exploreItems.filter(d=>(activeExploreFilter==='all'||d.category===activeExploreFilter)&&(!q||(d.title+' '+d.creator+' '+d.description).toLowerCase().includes(q)));
  const share=d=>d.raised/Math.max(d.goal,1);
  const ends=d=>d.deadline?new Date(d.deadline).getTime():Infinity;
  if(exploreSort==='funded')list.sort((a,b)=>b.raised-a.raised);
  else if(exploreSort==='close')list.sort((a,b)=>share(b)-share(a));
  else if(exploreSort==='ending')list.sort((a,b)=>ends(a)-ends(b));
  return list;
}
function setExploreSearch(el){clearTimeout(exploreSearchTimer);exploreSearchTimer=setTimeout(()=>{exploreQuery=el.value||'';renderExplore();},180);}
function setExploreSort(el){exploreSort=el.value||'new';renderExplore();}
function renderExplore(){
  const grid=document.getElementById('exploreGrid'); if(!grid)return;
  const items=visibleExploreItems();
  if(!items.length){grid.innerHTML='<div class="market-empty">'+(exploreQuery?'Nothing matches that search.':activeExploreFilter==='all'?'No live Drops yet. Request one from a creator you love, or invite them to join DropLive.':'No Drops in this category yet.')+'<br><br><button class="tab" data-act="openRequestFromNav()">Request a Drop</button></div>';return;}
  grid.innerHTML=items.map(d=>{const pct=Math.min(Math.round(d.raised/Math.max(d.goal,1)*100),100);return `<article class="market-card"><div class="market-card-body"><div class="market-creator"><div class="market-avatar">${escapeHtml(initials(d.creator))}</div><div><div class="market-name">${escapeHtml(d.creator)}</div><div class="market-meta">${escapeHtml((d.category||'experience').toUpperCase())}</div></div>${d.demo?'<span class="demo-label">DEMO</span>':''}</div><div class="market-title">${escapeHtml(d.title)}</div><div class="market-desc">${escapeHtml(d.description)}</div><div class="market-progress"><div style="width:${pct}%"></div></div><div class="market-stats"><span><strong>${money(d.raised)}</strong> / ${money(d.goal)}</span><span>${d.contributors.toLocaleString()} joined</span></div><div class="market-stats" style="margin-top:5px"><span>${pct}% funded</span><span><strong>${money(d.contribution)}</strong> to join</span></div><div class="market-actions"><button class="dc-cta" style="margin:0" data-act="openDropFromExplore('${String(d.id).replace(/'/g,"\'")}')">VIEW DROP</button><button class="tab" data-act="openRequestWithCreator('${escapeJs(d.creator)}')">REQUEST</button></div></div></article>`}).join('');
}
async function loadDemandBoard(){
  const box=document.getElementById('demandBoard'); if(!box||!sb)return;
  const {data:{session}}=await authSession(); const uid=session?.user?.id||null;
  const r=await sb.from('public_open_requests').select('id,creator_id,creator_name,title,description,willing_amount,backers,interest_total').order('interest_total',{ascending:false}).limit(30);
  if(r.error){box.innerHTML='<div class="market-empty">Demand board unavailable until the v0.5.0 migration is applied.</div>';return;}
  let mine=new Set(); if(uid){const q=await sb.from('request_pledges').select('request_id').eq('fan_id',uid);if(!q.error)mine=new Set((q.data||[]).map(x=>x.request_id));}
  box.innerHTML=(r.data||[]).length?r.data.map(x=>`<article class="market-card"><div class="market-card-body"><div class="market-name">${escapeHtml(x.title)}</div><div class="market-meta">For ${escapeHtml(x.creator_name)}</div><div class="market-desc" style="min-height:0;margin:8px 0">${escapeHtml(x.description||'')}</div><div class="market-meta"><strong>${x.backers}</strong> fan${x.backers==1?'':'s'} · ${money(x.interest_total)} interest (not paid)</div><div class="market-actions"><button class="dc-cta" style="margin:0" data-act="backRequest('${x.id}',${Number(x.willing_amount)})">${mine.has(x.id)?'YOU’RE IN ✓ (tap to undo)':'BACK THIS · '+money(x.willing_amount)}</button></div></div></article>`).join(''):'<div class="market-empty">No open requests for registered creators yet. Request one from a creator card below.</div>';
}
async function backRequest(id,amount){
  const {data:{session}}=await authSession(); const user=session?.user; if(!user){openAuth();return;}
  const ex=await sb.from('request_pledges').select('request_id').eq('request_id',id).eq('fan_id',user.id).maybeSingle();
  const res=ex.data?await sb.from('request_pledges').delete().eq('request_id',id).eq('fan_id',user.id):await sb.from('request_pledges').insert({request_id:id,fan_id:user.id,amount});
  if(res.error){toast('Could not update your backing: '+(res.error.code==='42501'?'you cannot back your own request.':res.error.message));return;}
  loadDemandBoard();
}
let creatorDirectoryItems=[], directoryUserId=null;
let followedCreatorIds=new Set();
async function loadCreatorDirectory(){
  const grid=document.getElementById('creatorDirectory'); if(!grid)return;
  loadDemandBoard();
  const status=document.getElementById('creatorDirectoryStatus');
  if(!sb){ creatorDirectoryItems=[]; status.textContent='Connect Supabase and apply the creator-discovery migration to browse registered creator accounts. Demo profiles are not shown as registered users.'; grid.innerHTML='<div class="market-empty">Creator discovery requires the connected database.</div>'; return; }
  status.textContent='Loading registered creators…';
  const {data:sessionData}=await authSession();
  const userId=sessionData?.session?.user?.id||null;
  const {data,error}=await sb.from('profiles').select('id,display_name,role,avatar_url,created_at,username,verified').in('role',['creator','both']).order('display_name',{ascending:true}).limit(100);
  if(error){status.textContent='Could not load creators: '+error.message;grid.innerHTML='<div class="market-empty">Creator directory could not be loaded. Check the discovery migration and profile read policy.</div>';return;}
  creatorDirectoryItems=data||[]; directoryUserId=userId;
    const dl=document.getElementById('creatorOptions');if(dl)dl.innerHTML=creatorDirectoryItems.filter(c=>c.id!==userId).map(c=>`<option value="${escapeHtml(c.display_name||'')}"></option>`).join('');
  followedCreatorIds=new Set();
  if(userId){const f=await sb.from('creator_follows').select('creator_id').eq('fan_id',userId);if(!f.error)followedCreatorIds=new Set((f.data||[]).map(x=>x.creator_id));}
  status.textContent=creatorDirectoryItems.length?`${creatorDirectoryItems.length} registered creator${creatorDirectoryItems.length===1?'':'s'} found.`:'No registered creators yet. When users activate Creator or Both on their account, they can appear here.';
  filterCreatorDirectory();
}
function filterCreatorDirectory(){
  const grid=document.getElementById('creatorDirectory'); if(!grid)return;
  const q=(document.getElementById('creatorSearch')?.value||'').trim().toLowerCase();
  const items=creatorDirectoryItems.filter(c=>((c.display_name||'Creator')+' '+(c.username||'')).toLowerCase().includes(q.replace(/^@/,'')));
  if(!items.length){grid.innerHTML='<div class="market-empty">No registered creators match that search yet.</div>';return;}
  grid.innerHTML=items.map(c=>`<article class="market-card"><div class="market-card-body"><div class="market-creator"><div class="market-avatar">${escapeHtml(initials(c.display_name))}</div><div><div class="market-name">${escapeHtml(c.display_name||'Creator')}</div><div class="market-meta">${c.id===directoryUserId?'YOU · ':''}${c.verified?'✓ VERIFIED CREATOR':'REGISTERED CREATOR'}${c.username?' · @'+escapeHtml(c.username):''}</div></div></div><div class="market-desc" style="min-height:0;margin:10px 0">Explore this creator’s published Drops and follow them to keep up with new experiences.</div><div class="market-actions"><button class="dc-cta" style="margin:0" data-act="viewCreatorDrops('${c.id}')">VIEW DROPS</button><a class="tab" style="border:.5px solid var(--s4);border-radius:var(--r);padding:10px 14px;text-decoration:none;display:inline-flex;align-items:center" href="?creator=${encodeURIComponent(c.username||c.id)}">PROFILE</a>${c.id===directoryUserId?'<span class="market-meta" style="flex-basis:100%;margin-top:6px">This is your public creator card · <a class="linklike" href="#" data-act="copyMyProfileLink();return false">Copy profile link</a></span>':`<button class="tab" data-act="toggleCreatorFollow('${c.id}')">${followedCreatorIds.has(c.id)?'FOLLOWING':'FOLLOW'}</button><button class="tab" data-act="requestFromDirectory('${c.id}')">REQUEST</button>`}</div></div></article>`).join('');
}
async function toggleCreatorFollow(creatorId){
  if(!sb){toast('Connect your DropLive account to follow creators.');return;}
  const {data:sessionData}=await authSession(); const user=sessionData?.session?.user;
  if(!user){openAuth();return;}
  if(user.id===creatorId){toast('You cannot follow your own creator profile.');return;}
  if(followedCreatorIds.has(creatorId)){
    const {error}=await sb.from('creator_follows').delete().eq('fan_id',user.id).eq('creator_id',creatorId);
    if(error){toast('Could not unfollow creator: '+error.message);return;} followedCreatorIds.delete(creatorId);
  }else{
    const {error}=await sb.from('creator_follows').insert({fan_id:user.id,creator_id:creatorId});
    if(error){toast('Could not follow creator: '+error.message);return;} followedCreatorIds.add(creatorId);
  }
  filterCreatorDirectory();
}
async function viewCreatorDrops(creatorId){
  if(!sb)return;
  const creator=creatorDirectoryItems.find(c=>c.id===creatorId); if(!creator)return;
  const {data,error}=await sb.from('drops').select('id,creator_id,title,description,goal_amount,contribution_amount,status,raised_amount,contributor_count,deadline').eq('creator_id',creatorId).in('status',['funding','unlocked','live']).order('created_at',{ascending:false}).limit(50);
  if(error){toast('Could not load this creator’s Drops: '+error.message);return;}
  await attachCreatorNames(data||[]);const own=(data||[]).map(normalizeDropRow);
  exploreItems=[...own,...demoDrops().filter(d=>d.creator.toLowerCase()===String(creator.display_name||'').toLowerCase())];
  activeExploreFilter='all'; renderExplore();
  const tab=document.querySelector('.tabs .tab[data-act*="explore"]'); if(tab)sw('explore',tab);
  document.getElementById('exploreSection')?.scrollIntoView({behavior:'smooth',block:'start'});
  if(!exploreItems.length)toast('This creator has no published Drops yet.');
}
function dropShareUrl(){const d=activeDrop();return location.origin+location.pathname+(d&&d.id&&!String(d.id).startsWith('demo-')?'?drop='+encodeURIComponent(d.id):'');}
async function shareDrop(kind){
  const d=activeDrop()||{}, url=dropShareUrl(), text=(d.title?d.title+' by '+(d.creator||'a creator')+' — back it on DropLive: ':'DropLive: ')+url;
  if(kind==='wa'){window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener');return;}
  if(kind==='native'&&navigator.share){try{await navigator.share({title:d.title||'DropLive',text:d.title||'',url});}catch(e){}return;}
  try{await navigator.clipboard.writeText(url);const b=document.getElementById('copyLinkBtn');if(b){b.textContent='Link copied ✓';setTimeout(()=>b.textContent='Copy link',1800);}}catch(e){prompt('Copy this link:',url);}
}
let editingDropId=null;
