/* Requests, demand inbox, activity, creator dashboard, forms */
async function renderCreatorDemand(){
  const box=document.getElementById('creatorDemandList'), summary=document.getElementById('creatorDemandSummary');
  if(!box||!summary)return;
  box.innerHTML='';
  if(!sb){summary.textContent='Connect Supabase to use the creator demand inbox.';box.innerHTML='<div class="market-empty">Creator demand is available in backend mode.</div>';return;}
  const {data:{user}}=await authUser();
  if(!user){summary.textContent='Sign in to see fan requests addressed to you.';box.innerHTML='<div class="market-empty"><button class="dc-cta" data-act="openAuth()">SIGN IN</button></div>';return;}
  let q=sb.from('drop_requests').select('id,fan_id,creator_id,creator_name,title,description,willing_amount,potential_supporters,status,created_at').order('created_at',{ascending:false});
  q=q.eq('creator_id',user.id);
  const {data,error}=await q;
  if(error){summary.textContent='Could not load creator requests: '+error.message;box.innerHTML='';return;}
  const items=(data||[]);
  const open=items.filter(x=>x.status==='open');
  const potential=open.reduce((sum,x)=>sum+(Number(x.willing_amount)||0)*(Number(x.potential_supporters)||0),0);
  summary.innerHTML=`<strong>${open.length}</strong> open request${open.length===1?'':'s'} · estimated demand <strong>${money(potential)}</strong>`;
  const board=await sb.from('public_open_requests').select('id,backers,interest_total').eq('creator_id',user.id);
  if(!board.error&&board.data?.length){const fans=board.data.reduce((a,x)=>a+Number(x.backers),0),tot=board.data.reduce((a,x)=>a+Number(x.interest_total),0);summary.innerHTML+=` · <strong>${fans}</strong> fans backing · <strong>${money(tot)}</strong> interest (not paid)`;}
  if(!items.length){box.innerHTML='<div class="market-empty">No fan requests are matched to this creator yet. Fans reach you by choosing your profile in the Creators tab.</div>';return;}
  box.innerHTML=items.map(x=>{const total=(Number(x.willing_amount)||0)*(Number(x.potential_supporters)||0);const canAct=x.status==='open'||x.status==='accepted';return `<div class="demand-item"><div class="demand-head"><div><strong>${escapeHtml(x.title)}</strong><div class="market-meta">Requested for ${escapeHtml(x.creator_name)} · ${new Date(x.created_at).toLocaleDateString()}</div></div><span class="status-badge ${canAct?'status-open':''}">${escapeHtml(x.status)}</span></div><p class="cb" style="margin:9px 0">${escapeHtml(x.description)}</p><div class="market-stats"><span>${money(x.willing_amount)} willingness</span><span>${Number(x.potential_supporters).toLocaleString()} potential supporters</span><span class="demand-total">${money(total)}</span></div>${canAct?`<div class="demand-actions">${x.status==='open'?`<button class="dc-cta" style="margin:0" data-act="acceptRequest('${x.id}')">ACCEPT</button>`:''}<button class="${x.status==='open'?'tab':'dc-cta'}" ${x.status==='open'?'':'style="margin:0"'} data-act="convertRequestToDrop('${x.id}')">CREATE DROP FROM THIS</button><button class="tab" data-act="markRequestStatus('${x.id}','declined')">DECLINE</button></div>`:''}</div>`}).join('');
}
async function markRequestStatus(id,status){
  if(!sb)return;
  const {data:{user}}=await authUser();if(!user){openAuth();return;}
  const {error}=await sb.from('drop_requests').update({status}).eq('id',id).eq('creator_id',user.id);
  if(error){toast('Could not update request: '+error.message);return false;}
  toast(status==='accepted'?'Request accepted. The fans who asked have been notified.':'Request updated.','good');
  renderCreatorDemand();
  return true;
}
async function convertRequestToDrop(id){
  if(!sb){return;}
  const {data:{user}}=await authUser();if(!user){openAuth();return;}
  const {data:req,error}=await sb.from('drop_requests').select('id,creator_id,creator_name,title,description,willing_amount,potential_supporters,status').eq('id',id).single();
  if(error||!req){toast('Could not load this request.');return;}
  if(req.creator_id!==user.id){toast('This request is not assigned to your creator account.');return;}
  if(!['open','accepted'].includes(req.status)){toast('This request is already '+req.status+'.');return;}
  document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('on'));
  const tab=document.querySelector('.tabs .tab[data-act*="create"]');if(tab)tab.classList.add('on');
  document.getElementById('p-create').classList.add('on');
  document.getElementById('creatorName').value=currentProfile?.display_name||req.creator_name;
  document.getElementById('dropTitle').value=req.title;
  document.getElementById('dropDescription').value=req.description;
  document.getElementById('dropContribution').value=req.willing_amount;
  document.getElementById('dropGoal').value=Math.max(req.willing_amount*req.potential_supporters,req.willing_amount);
  document.getElementById('createResult').style.display='block';
  document.getElementById('createResult').innerHTML='<div class="prototype-note"><strong>Request loaded.</strong><br>Review the details, choose the live date/time and funding deadline, then create the Drop. The request will be marked converted after successful creation.</div>';
  window.pendingRequestId=id;
}
function renderMyActivity(){
  const dbox=document.getElementById('myDropsList'), rbox=document.getElementById('myRequestsList'), sbox=document.getElementById('mySupportedDropsList');
  if(!dbox||!rbox||!sbox)return;
  const empty=(msg)=>`<div class="market-empty">${msg}</div>`;
  const contributionCard=(c,d)=>`<div class="activity-item"><strong>${escapeHtml(d?.title||c.title||'Drop')}</strong><div class="activity-meta">${escapeHtml(d?.creator||c.creator||'Creator')}<br>${c.n>1?c.n+' pledges · ':''}Pledged: ${money(c.amount)}<br>Latest ${new Date(c.created_at).toLocaleDateString()}</div><span class="activity-status ${c.status==='paid'?'done':'pending'}">${({paid:'PAID',refunded:'REFUNDED',cancelled:'WITHDRAWN',failed:'FAILED'})[c.status]||'PENDING · NO MONEY TAKEN'}</span>${c.status==='pending'&&c.id?`<button class="tab" style="margin-top:8px" data-act="cancelPledge('${escapeJs(c.id)}')">WITHDRAW PLEDGE</button>`:''}</div>`;
  if(!sb){
    const locals=getDrops();
    dbox.innerHTML=locals.length?locals.map(d=>`<div class="activity-item"><strong>${escapeHtml(d.title)}</strong><div class="activity-meta">${money(d.raised)} / ${money(d.goal)} · ${d.contributors||0} supporters<br>Status: ${escapeHtml(d.status||'funding')}</div></div>`).join(''):empty('You have not created a Drop yet.');
    const req=JSON.parse(localStorage.getItem('droplive_requests_v1')||'[]');
    rbox.innerHTML=req.length?req.map(x=>`<div class="activity-item"><strong>${escapeHtml(x.creator_name)} · ${escapeHtml(x.title)}</strong><div class="activity-meta">${money(x.willing_amount)} willingness · ${x.potential_supporters} potential supporters<br>Status: ${escapeHtml(x.status||'open')}</div></div>`).join(''):empty('No requests yet.');
    const history=JSON.parse(localStorage.getItem('droplive_test_contributions_v1')||'[]');
    sbox.innerHTML=history.length?history.map(c=>contributionCard(c,{title:c.title,creator:c.creator})).join(''):empty('You have not supported a Drop yet.');
    return;
  }
  authSession().then(async({data:sessionData,error:sessionError})=>{
    if(sessionError){dbox.innerHTML=empty('Could not verify your session. Please refresh after signing in again.');rbox.innerHTML=empty('Could not verify your session. Please refresh after signing in again.');sbox.innerHTML=empty('Could not verify your session. Please refresh after signing in again.');return;}
    const user=sessionData?.session?.user;
    if(!user){dbox.innerHTML=empty('Sign in to see Drops you created.');rbox.innerHTML=empty('Sign in to see your requests.');sbox.innerHTML=empty('Sign in to see Drops you support.');return;}
    const dr=await sb.from('drops').select('id,title,goal_amount,raised_amount,contributor_count,status').eq('creator_id',user.id).order('created_at',{ascending:false});
    dbox.innerHTML=dr.data?.length?dr.data.map(x=>`<div class="activity-item"><strong>${escapeHtml(x.title)}</strong><div class="activity-meta">${money(x.raised_amount)} / ${money(x.goal_amount)} · ${x.contributor_count||0} supporters<br>Status: ${escapeHtml(x.status)}</div></div>`).join(''):empty('You have not created a Drop yet.');
    const rr=await sb.from('drop_requests').select('creator_name,title,willing_amount,potential_supporters,status,created_at').eq('fan_id',user.id).order('created_at',{ascending:false});
    if(rr.error){rbox.innerHTML=empty('Your requests could not be loaded: '+escapeHtml(rr.error.message));} else rbox.innerHTML=rr.data?.length?rr.data.map(x=>`<div class="activity-item"><strong>${escapeHtml(x.creator_name)} · ${escapeHtml(x.title)}</strong><div class="activity-meta">${money(x.willing_amount)} willingness · ${(x.potential_supporters||0).toLocaleString()} potential supporters<br>Sent ${new Date(x.created_at).toLocaleDateString()}</div><span class="activity-status ${x.status==='converted'?'done':''}">${escapeHtml(String(x.status||'open').replace(/_/g,' ').toUpperCase())}</span></div>`).join(''):empty('No requests yet.');
    const cr=await sb.from('contributions').select('id,drop_id,amount,status,created_at').eq('fan_id',user.id).order('created_at',{ascending:false});
    if(cr.data){const g={};cr.data.forEach(c=>{const k=c.drop_id+'|'+c.status;if(!g[k])g[k]={...c,n:0,amount:0};g[k].n++;g[k].amount+=Number(c.amount);});cr.data=Object.values(g);}
    if(cr.error){sbox.innerHTML=empty('Could not load contributions right now. Please refresh and try again.');return;}
    const rows=cr.data||[];
    if(!rows.length){sbox.innerHTML=empty('You have not supported a Drop yet.');return;}
    const ids=[...new Set(rows.map(c=>c.drop_id).filter(Boolean))];
    const dropsById={};
    if(ids.length){const result=await sb.from('drops').select('id,title,creator_id,status,scheduled_at').in('id',ids);(result.data||[]).forEach(d=>dropsById[d.id]=d);}
    const creatorIds=[...new Set(Object.values(dropsById).map(d=>d.creator_id).filter(Boolean))];
    const names={};
    if(creatorIds.length){Object.assign(names,await fetchCreatorNames(creatorIds));}
    sbox.innerHTML=rows.map(c=>{const d=dropsById[c.drop_id];return contributionCard(c,d?{...d,creator:names[d.creator_id]||'Creator'}:null);}).join('');
  }).catch(()=>{dbox.innerHTML=empty('Could not load your Drops. Refresh and try again.');rbox.innerHTML=empty('Could not load your requests. Refresh and try again.');sbox.innerHTML=empty('Could not load your contributions. Refresh and try again.');});
}

async function renderCreatorDashboard(){
  const el=id=>document.getElementById(id);
  const empty=msg=>`<div class="market-empty">${msg}</div>`;
  const notice=el('creatorDashboardNotice'), dropsBox=el('creatorDashboardDrops'), demandBox=el('creatorDashboardDemand');
  if(!notice||!dropsBox||!demandBox)return;
  const setStat=(id,value)=>{if(el(id))el(id).textContent=value;};
  ['creatorPaidTotal','creatorPendingTotal','creatorDropCount','creatorSupporterCount','creatorOpenDemand','creatorEstimatedDemand'].forEach(id=>setStat(id,id.includes('Total')||id==='creatorEstimatedDemand'?'₦0':'0'));
  if(!sb){
    const locals=getDrops();
    setStat('creatorDropCount',String(locals.length));
    const history=(()=>{try{return JSON.parse(localStorage.getItem('droplive_test_contributions_v1')||'[]')}catch(e){return[]}})();
    const pending=history.reduce((sum,c)=>sum+(String(c.status||'pending')==='pending'?Number(c.amount||0):0),0);
    setStat('creatorPendingTotal',money(pending));
    dropsBox.innerHTML=locals.length?locals.map(d=>{const goal=Number(d.goal||0),raised=Number(d.raised||0),pct=goal?Math.min(100,Math.round(raised/goal*100)):0;return `<div class="creator-drop-row"><div class="creator-drop-top"><div><div class="creator-drop-title">${escapeHtml(d.title||'Untitled Drop')}</div><div class="creator-drop-meta">Status: ${escapeHtml(d.status||'funding')} · ${Number(d.contributors||0)} supporters</div></div><span class="status-badge">LOCAL TEST</span></div><div class="creator-progress"><div style="width:${pct}%"></div></div><div class="creator-drop-meta">${money(raised)} / ${money(goal)} · ${pct}% of goal</div></div>`}).join(''):empty('No local Drops found. Sign in and create a Drop to see your creator activity here.');
    demandBox.innerHTML=empty('Demand inbox requires a connected Supabase account.');
    notice.textContent='Local prototype mode: figures are browser-local test data, not verified earnings.';
    return;
  }
  const {data:{user},error:userError}=await authUser();
  if(userError||!user){notice.textContent='Sign in to load your creator dashboard.';dropsBox.innerHTML=empty('Sign in to see your Drops.');demandBox.innerHTML=empty('Sign in to see your demand inbox.');el('creatorDashboardGreeting').textContent='Your creator activity';return;}
  try{
    const profile=await sb.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
    const creatorName=profile.data?.display_name||user.email?.split('@')[0]||'Creator';
    el('creatorDashboardGreeting').textContent='Welcome back, '+creatorName;
    const dr=await sb.from('drops').select('id,title,description,goal_amount,raised_amount,contributor_count,status,deadline,scheduled_at,created_at').eq('creator_id',user.id).order('created_at',{ascending:false});
    if(dr.error)throw dr.error;
    const drops=dr.data||[]; setStat('creatorDropCount',String(drops.length));
    const ids=drops.map(d=>d.id);
    let contributions=[];
    if(ids.length){const cr=await sb.from('contributions').select('id,drop_id,fan_id,amount,status,created_at').in('drop_id',ids);if(cr.error)throw cr.error;contributions=cr.data||[];}
    const paid=contributions.filter(c=>c.status==='paid');
    const pending=contributions.filter(c=>c.status==='pending');
    setStat('creatorPaidTotal',money(paid.reduce((sum,c)=>sum+Number(c.amount||0),0)));
    setStat('creatorPendingTotal',money(pending.reduce((sum,c)=>sum+Number(c.amount||0),0)));
    setStat('creatorSupporterCount',String(new Set(paid.map(c=>c.fan_id).filter(Boolean)).size));
    const byDrop={}; contributions.forEach(c=>{(byDrop[c.drop_id]||(byDrop[c.drop_id]=[])).push(c)});
    dropsBox.innerHTML=drops.length?drops.map(d=>{
      const list=byDrop[d.id]||[], paidRows=list.filter(c=>c.status==='paid'), pendingRows=list.filter(c=>c.status==='pending');
      const paidAmount=paidRows.reduce((sum,c)=>sum+Number(c.amount||0),0), pendingAmount=pendingRows.reduce((sum,c)=>sum+Number(c.amount||0),0);
      const goal=Number(d.goal_amount||0), pct=goal?Math.min(100,Math.round(paidAmount/goal*100)):0;
      const expired=d.status==='funding'&&d.deadline&&new Date(d.deadline)<=new Date();
      const status=expired?'CLOSED · DEADLINE PASSED':String(d.status||'funding').replace(/_/g,' ').toUpperCase();
      const deadline=d.deadline?new Date(d.deadline):null;
      const deadlineText=deadline&&!Number.isNaN(deadline.getTime())?' · Deadline '+deadline.toLocaleDateString() : '';
      return `<div class="creator-drop-row"><div class="creator-drop-top"><div><div class="creator-drop-title">${escapeHtml(d.title||'Untitled Drop')}</div><div class="creator-drop-meta">${escapeHtml(status)} · ${new Set(paidRows.map(c=>c.fan_id).filter(Boolean)).size} verified supporters${deadlineText}</div></div><span class="status-badge ${d.status==='funding'&&!expired?'status-open':''}">${escapeHtml(status)}</span></div><div class="creator-progress"><div style="width:${pct}%"></div></div><div class="creator-drop-meta">Verified funding: <strong>${money(paidAmount)}</strong> / ${money(goal)} · ${pct}% of goal<br>Pending test contributions: ${money(pendingAmount)} · not paid</div></div>`;
    }).join(''):empty('You have not created a Drop yet. Use Create a Drop to get started.');
    window._dashDrops=drops; if(typeof renderPilotPledges==='function')renderPilotPledges(drops,dropsBox);
    dropsBox.querySelectorAll('.creator-drop-row').forEach((row,i)=>{const d=drops[i];if(!d)return;const bar=document.createElement('div');bar.className='share-row';
      bar.innerHTML=`<button class="tab" data-act="openEditDrop(${i})">Edit</button><button class="tab" data-act="copyDropLink('${d.id}')">Copy link</button>`+((d.status==='unlocked'||(d.status==='funding'&&!PAYMENTS_ENABLED))?`<button class="dc-cta" style="margin:0;width:auto;padding:8px 16px" data-act="setDropPhase('${d.id}','live')">GO LIVE</button>`:'')+(d.status==='live'?`<button class="dc-cta" style="margin:0;width:auto;padding:8px 16px" data-act="setDropPhase('${d.id}','completed')">END SESSION</button>`:'')+(['cancelled','live','completed','failed'].includes(d.status)?'':`<button class="tab" data-act="cancelDrop(${i})">Cancel Drop</button>`);row.appendChild(bar);});
    const req=await sb.from('drop_requests').select('id,creator_name,title,description,willing_amount,potential_supporters,status,created_at').eq('creator_id',user.id).order('created_at',{ascending:false});
    if(req.error)throw req.error;
    const requests=req.data||[], open=requests.filter(r=>r.status==='open');
    const estimated=open.reduce((sum,r)=>sum+Number(r.willing_amount||0)*Number(r.potential_supporters||0),0);
    setStat('creatorOpenDemand',String(open.length));setStat('creatorEstimatedDemand',money(estimated));
    demandBox.innerHTML=requests.length?requests.map(r=>{
      const est=Number(r.willing_amount||0)*Number(r.potential_supporters||0);
      return `<div class="demand-item"><div class="demand-head"><div><div class="creator-drop-title">${escapeHtml(r.title||'Experience request')}</div><div class="activity-meta">From fans requesting ${escapeHtml(r.creator_name||creatorName)}<br>Willingness: ${money(r.willing_amount)} · Potential supporters: ${Number(r.potential_supporters||0).toLocaleString()}<br>Estimated demand: <strong>${money(est)}</strong> · estimate only</div></div><span class="status-badge ${r.status==='open'?'status-open':''}">${escapeHtml(String(r.status||'open').replace(/_/g,' ').toUpperCase())}</span></div></div>`;
    }).join(''):empty('No requests addressed to your creator profile yet.');
    notice.textContent='Live Supabase data loaded. Only records marked paid count as verified contributions; pending contributions and estimated demand are separate.';
  }catch(err){
    notice.textContent='Some dashboard data could not be loaded. Check your Supabase table permissions and refresh. '+(err?.message||'');
    dropsBox.innerHTML=empty('Unable to load creator Drops.');demandBox.innerHTML=empty('Unable to load creator demand.');
  }
}

function showCreatedDrop(d){
  const box=document.getElementById('createResult'); box.style.display='block';
  box.innerHTML='<div class="prototype-note"><strong style="color:var(--gr)">Drop created.</strong><br><span class="result-link">'+location.origin+location.pathname+'?drop='+encodeURIComponent(d.id)+'</span><br><br>'+(sb?'This Drop is stored in Supabase.':'This is currently local test data. Connect Supabase to make it persistent across devices.')+'</div>';
}
async function createDropRecord(d){
  if(!sb)return false;
  const {data:{user}}=await authUser();
  if(!user){openAuth();return false;}
  if(currentProfile&&currentProfile.role==='fan'){toast('Turn on Creator mode in Account & Settings before creating a Drop.');return false;}
  const row={creator_id:user.id,title:d.title,description:d.description,goal_amount:d.goal,contribution_amount:d.contribution,scheduled_at:new Date(d.date+'T'+d.time).toISOString(),deadline:new Date(d.deadline).toISOString(),status:'funding',raised_amount:0,contributor_count:0,category:d.category||'other'};
  const {data,error}=await sb.from('drops').insert(row).select('id').single();
  if(error){toast('Could not create Drop: '+error.message);return false;}
  d.id=data.id; d.creatorId=user.id; await fetchCreatorNames([user.id]); if(window.pendingRequestId){await sb.from('drop_requests').update({status:'converted'}).eq('id',window.pendingRequestId).eq('creator_id',user.id);window.pendingRequestId=null;} return true;
}
document.getElementById('createDropForm').addEventListener('submit',async function(e){
  e.preventDefault();
  const date=document.getElementById('dropDate').value;
  const time=document.getElementById('dropTime').value;
  const deadline=document.getElementById('dropDeadline').value;
  const liveAt=new Date(date+'T'+time);
  const deadlineAt=new Date(deadline);
  if(!date || !time || !deadline || Number.isNaN(liveAt.getTime()) || Number.isNaN(deadlineAt.getTime())){toast('Please complete the date and time fields.');return;}
  if(deadlineAt >= liveAt){toast('Funding deadline must be before the live session.');return;}
  const goal=Number(document.getElementById('dropGoal').value);
  const contribution=Number(document.getElementById('dropContribution').value);
  if(!Number.isFinite(goal) || goal<1000){toast('Funding goal must be at least ₦1,000.');return;}
  if(!Number.isFinite(contribution) || contribution<100){toast('Contribution must be at least ₦100.');return;}
  if(contribution>goal){toast('Contribution cannot be greater than the funding goal.');return;}
  const d={id:'drop_'+Date.now().toString(36),creator:document.getElementById('creatorName').value.trim(),title:document.getElementById('dropTitle').value.trim(),description:document.getElementById('dropDescription').value.trim(),category:document.getElementById('dropCategory').value,goal,contribution,date,time,deadline,raised:0,contributors:0,status:'funding',createdAt:new Date().toISOString()};
  if(sb){if(createBusy)return;createBusy=true;let ok=false;try{ok=await createDropRecord(d)}finally{createBusy=false}if(!ok)return;} else {const drops=getDrops();drops.push(d);saveDrops(drops);}
  currentDrop=d; showCreatedDrop(d); renderActiveDrop();
  const productTab=document.querySelector('.tab[data-act*="product"]');if(productTab)sw('product',productTab);
});

document.getElementById('requestDropForm').addEventListener('submit',async function(e){e.preventDefault();await saveDropRequest();});
