/* v0.12.0: Report button + Live room (countdown, fan questions, post-session rating). Backed by RLS; UI only reflects it. */
let reportTarget=null;
async function openReport(type){
  let id=null; if(type==='drop'){const d=activeDrop();id=d&&d.id;}else if(type==='creator'){id=profileCreator&&profileCreator.id;}
  if(!id||String(id).startsWith('demo')){toast('Nothing to report here yet.');return;}
  if(!sb){toast('Reporting needs a live account.');return;}
  const {data:{session}}=await authSession(); if(!session){toast('Sign in to send a report.');openAuth();return;}
  reportTarget={type,id}; document.getElementById('reportDetails').value=''; document.getElementById('reportMsg').style.display='none';
  document.getElementById('reportModal').style.display='flex';
}
function closeReport(){document.getElementById('reportModal').style.display='none';}
async function submitReport(){
  const msg=document.getElementById('reportMsg'), say=t=>{msg.style.display='block';msg.textContent=t;};
  if(!reportTarget)return; const cat=document.getElementById('reportCategory').value, det=document.getElementById('reportDetails').value.trim();
  const {data:{user}}=await authUser(); if(!user){openAuth();return;}
  const {error}=await sb.from('reports').insert({reporter_id:user.id,target_type:reportTarget.type,target_id:reportTarget.id,reason:(cat+(det?': '+det:'')).slice(0,500)});
  if(error){say(/rate|limit|too many/i.test(error.message)?'You have sent several reports recently. Please try again later.':'Could not send: '+error.message);return;}
  closeReport(); toast('Report sent. Thank you, we will review it.','good');
}
function countdownText(t){const ms=t-Date.now();if(ms<=0)return 'Starting now';const m=Math.floor(ms/60000),h=Math.floor(m/60),d=Math.floor(h/24);return d>0?`Starts in ${d}d ${h%24}h`:h>0?`Starts in ${h}h ${m%60}m`:`Starts in ${m}m`;}
let liveRoomTimer;
async function loadLiveRoom(){
  const box=document.getElementById('liveRoom'), d=activeDrop(); clearInterval(liveRoomTimer);
  if(!box)return; box.style.display='none';
  if(!sb||!d||!d.id||String(d.id).startsWith('demo'))return;
  const {data:{user}}=await authUser(); if(!user)return;
  const isCreator=d.creatorId===user.id; let paid=false;
  if(!isCreator){const c=await sb.from('contributions').select('id').eq('drop_id',d.id).eq('fan_id',user.id).eq('status','paid').limit(1); paid=!!(c.data&&c.data.length);}
  if(!isCreator&&!paid)return;
  const st=d.status||'funding', t=d.scheduled_at?new Date(d.scheduled_at):null;
  const badge={funding:'FUNDING',unlocked:'FUNDED',live:'LIVE NOW',completed:'COMPLETED'}[st]||st.toUpperCase();
  let html='<div class="bge bg-g">LIVE ROOM · '+escapeHtml(badge)+'</div><div class="ct">'+escapeHtml(d.title||'Session')+'</div>';
  if(st==='live')html+='<div class="cb" style="margin:6px 0">The session is live. Use JOIN SESSION above.</div>';
  else if(st!=='completed'&&t&&!isNaN(t))html+='<div class="cb" id="lrCount" style="margin:6px 0"></div>';
  const qs=await sb.from('drop_questions').select('id,body,answered,created_at').eq('drop_id',d.id).order('created_at',{ascending:true}).limit(100);
  const list=qs.data||[];
  html+='<div class="cl" style="margin-top:10px">'+(isCreator?'FAN QUESTIONS ('+list.length+')':'YOUR QUESTIONS')+'</div>';
  html+=list.length?list.map(q=>'<div class="cb" style="display:flex;gap:8px;align-items:center;margin:4px 0;'+(q.answered?'opacity:.55':'')+'"><span style="flex:1">'+escapeHtml(q.body)+'</span>'+(isCreator&&!q.answered?'<button class="tab" data-act="markQuestionAnswered(\''+escapeJs(q.id)+'\')">Answered</button>':'')+'</div>').join(''):'<div class="cb" style="opacity:.7">No questions yet.</div>';
  if(!isCreator&&['funding','unlocked','live'].includes(st))html+='<div style="display:flex;gap:8px;margin-top:8px"><input id="lrAsk" class="form-input" maxlength="300" placeholder="Ask the creator a question" style="flex:1"><button class="tab" data-act="askQuestion()">Send</button></div>';
  if(st==='completed'){
    const rr=await sb.from('drop_ratings').select('stars,comment,fan_id').eq('drop_id',d.id);
    const rows=rr.data||[];
    if(isCreator){const avg=rows.length?(rows.reduce((a,x)=>a+x.stars,0)/rows.length).toFixed(1):null;html+='<div class="cl" style="margin-top:10px">RATINGS</div><div class="cb">'+(avg?escapeHtml(avg)+' / 5 from '+rows.length+' backer'+(rows.length===1?'':'s'):'No ratings yet.')+'</div>';}
    else if(rows.some(x=>x.fan_id===user.id))html+='<div class="cb" style="margin-top:10px">Thanks, your rating was sent.</div>';
    else html+='<div class="cl" style="margin-top:10px">HOW WAS IT?</div><div style="display:flex;gap:6px;margin:6px 0">'+[1,2,3,4,5].map(n=>'<button class="tab" data-act="rateDrop('+n+')" aria-label="'+n+' stars">'+'★'.repeat(n)+'</button>').join('')+'</div>';
  }
  box.innerHTML=html; box.style.display='block';
  if(document.getElementById('lrCount')){const tick=()=>{const e=document.getElementById('lrCount');if(e)e.textContent=countdownText(t);};tick();liveRoomTimer=setInterval(tick,30000);}
}
async function askQuestion(){
  const d=activeDrop(), el=document.getElementById('lrAsk'), body=(el&&el.value||'').trim(); if(body.length<2){toast('Type your question first.');return;}
  const {data:{user}}=await authUser(); if(!user)return;
  const {error}=await sb.from('drop_questions').insert({drop_id:d.id,fan_id:user.id,body});
  if(error){toast('Could not send: '+error.message);return;} toast('Question sent.','good'); loadLiveRoom();
}
async function markQuestionAnswered(id){const {error}=await sb.from('drop_questions').update({answered:true}).eq('id',id); if(error){toast(error.message);return;} loadLiveRoom();}
async function rateDrop(n){
  const d=activeDrop(); const {data:{user}}=await authUser(); if(!user)return;
  const {error}=await sb.from('drop_ratings').insert({drop_id:d.id,fan_id:user.id,stars:n});
  if(error){toast('Could not save rating: '+error.message);return;} toast('Thanks for rating.','good'); loadLiveRoom();
}

/* v0.14.0 pilot: keep the room fresh without a manual refresh. Every 20s (page visible, nobody typing) re-read the Drop status; if it changed, reload the room and the Join card. */
async function refreshLiveStatus(){
  const d=activeDrop(); if(!sb||!d||!d.id||String(d.id).startsWith('demo'))return;
  const a=document.activeElement, q=document.getElementById('lrAsk'); if((a&&a.id==='lrAsk')||(q&&q.value))return;
  const r=await sb.from('drops').select('status').eq('id',d.id).maybeSingle(); if(r.error||!r.data)return;
  const changed=r.data.status!==d.status; d.status=r.data.status;
  if(changed&&typeof loadDelivery==='function'){loadDelivery();if(typeof renderActiveDrop==='function')renderActiveDrop();}
  else if(document.getElementById('liveRoom')&&document.getElementById('liveRoom').style.display!=='none')loadLiveRoom();
}
if(sb)setInterval(()=>{if(document.visibilityState==='visible')refreshLiveStatus();},20000);

/* Pilot only (payments OFF): the creator confirms a pledge as paid, e.g. after a bank transfer. Enforced by creator_mark_pledge_paid(). */

/* One row in the creator's pledge list: pending pledges can be confirmed, paid ones can be refunded. */
function pledgeRow(x){
  const act=x.status==='paid'?'markPledgeRefunded':'markPledgePaid';
  const label=x.status==='paid'?'Mark refunded':'Mark paid';
  return '<div class="cb" style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="flex:1">'+escapeHtml(pledgeNames[x.fan_id]||'Fan')+' · '+escapeHtml(pledgeTitle(x.drop_id))+' · '+escapeHtml(money(x.amount))+'</span><button class="tab" data-act="'+act+'(\''+escapeJs(x.id)+'\')">'+label+'</button></div>';
}
let pledgeNames={};let pledgeTitle=()=>'Drop';
async function renderPilotPledges(drops,anchor){
  if(!sb||(typeof PAYMENTS_ENABLED!=='undefined'&&PAYMENTS_ENABLED)||!anchor)return;
  let box=document.getElementById('pilotPledges');
  if(!box){box=document.createElement('div');box.id='pilotPledges';box.style.margin='14px 0';anchor.parentNode.insertBefore(box,anchor.nextSibling);}
  const ids=(drops||[]).map(x=>x.id); if(!ids.length){box.innerHTML='';return;}
  const r=await sb.from('contributions').select('id,drop_id,fan_id,amount,status,created_at').in('drop_id',ids).in('status',['pending','paid']).order('created_at',{ascending:false}).limit(60);
  const rows=(r.data||[]); if(r.error||!rows.length){box.innerHTML='';return;}
  let names=pledgeNames={}; const p=await sb.from('profiles').select('id,display_name').in('id',[...new Set(rows.map(x=>x.fan_id))]); (p.data||[]).forEach(x=>names[x.id]=x.display_name);
  const title=pledgeTitle=id=>((drops.find(x=>x.id===id)||{}).title)||'Drop';
  box.innerHTML='<div class="cl">PLEDGES (PILOT)</div><div class="cb" style="opacity:.75;margin:4px 0">Payments are off. When a fan has paid you directly, confirm it here to unlock their access. If you return a payment, mark it refunded before cancelling a Drop.</div>'+
    rows.map(pledgeRow).join('');
}
async function markPledgePaid(id){
  if(!sb||!confirm('Confirm you received this payment?'))return;
  const {error}=await sb.rpc('creator_mark_pledge_paid',{p_contribution_id:id});
  if(error){toast(error.message.replace(/^.*?:\s*/,'')||'Could not confirm.');return;}
  toast('Pledge confirmed. The fan now has access.','good'); renderCreatorDashboard();
}

async function markPledgeRefunded(id){
  if(!sb||!confirm('Confirm you have returned this payment to the fan?'))return;
  const {error}=await sb.rpc('creator_mark_pledge_refunded',{p_contribution_id:id});
  if(error){toast(error.message.replace(/^.*?:\s*/,'')||'Could not record the refund.');return;}
  toast('Refund recorded. The fan has been notified.','good'); renderCreatorDashboard();
}
