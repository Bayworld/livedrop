/* Session delivery, navigation helper, invite loop, creator badge and checklist */
// ── v0.8.0: session delivery (private; paid backers and the creator only)
async function loadDelivery(){
  if(typeof loadLiveRoom==='function')loadLiveRoom();
  const box=document.getElementById('deliveryCard'), d=activeDrop(); if(!box||!sb||!d||!d.id||String(d.id).startsWith('demo-')){if(box)box.style.display='none';return;}
  const {data:{session}}=await authSession(); if(!session){box.style.display='none';return;}
  const r=await sb.from('drop_delivery').select('session_url,notes').eq('drop_id',d.id).maybeSingle();
  if(r.error||!r.data||(!r.data.session_url&&!r.data.notes)){
    box.style.display='none'; return;
  }
  const when=d.scheduled_at||d.liveAt||null, t=when?new Date(when):null;
  const cal=t&&!isNaN(t)?'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(d.title||'DropLive session')+'&dates='+t.toISOString().replace(/[-:]|\.\d{3}/g,'')+'/'+new Date(t.getTime()+3600000).toISOString().replace(/[-:]|\.\d{3}/g,'')+'&details='+encodeURIComponent(r.data.session_url||''):'';
  box.innerHTML='<div class="bge bg-g">YOUR ACCESS</div><div class="ct">'+escapeHtml(d.title||'Session')+'</div>'+(r.data.notes?'<div class="cb" style="margin:6px 0;white-space:pre-wrap">'+escapeHtml(r.data.notes)+'</div>':'')+'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'+(r.data.session_url?'<a class="dc-cta" style="margin:0;width:auto;text-decoration:none;display:inline-block" href="'+escapeHtml(r.data.session_url)+'" target="_blank" rel="noopener noreferrer">JOIN SESSION</a>':'')+(cal?'<a class="tab" style="text-decoration:none" href="'+cal+'" target="_blank" rel="noopener noreferrer">Add to calendar</a>':'')+'</div>';
  box.style.display='block';
}

function navTo(n){if(n==='settings'){openSettingsPanel();}else{const t=document.querySelector('.tab[data-act*="\''+n+'\'"]');if(t)sw(n,t);}document.querySelectorAll('#bottomNav button').forEach(b=>b.classList.toggle('on',b.getAttribute('data-act').includes("'"+n+"'")));window.scrollTo({top:0});}
// ── v0.7.0: invite loop, creator badge, checklist
function inviteLink(n){return location.origin+location.pathname+'?invite='+encodeURIComponent(n);}
function inviteText(n){return 'Fans are asking '+n+' to host live experiences on DropLive. If that is you (or you know them), join here: '+inviteLink(n);}
async function inviteShare(kind,srcId){
  const n=(srcId?(document.getElementById(srcId)?.value||''):(window._inviteName||'')).trim().slice(0,60);
  if(!n){toast('Type the creator\u2019s name first.');return;}
  if(kind==='wa'){window.open('https://wa.me/?text='+encodeURIComponent(inviteText(n)),'_blank','noopener');return;}
  try{await navigator.clipboard.writeText(inviteText(n));toast('Invite copied. Paste it anywhere.','good');}catch(e){prompt('Copy this invite:',inviteText(n));}
}
async function loadInviteBanner(){
  const n=(new URLSearchParams(location.search).get('invite')||'').trim().slice(0,60); const box=document.getElementById('inviteBanner');
  if(!n||!box)return;
  let cnt=null; if(sb){try{const r=await sb.rpc('creator_request_count',{p_name:n});if(!r.error&&typeof r.data==='number')cnt=r.data;}catch(e){}}
  box.innerHTML='<div class="bge bg-g">YOU\u2019VE BEEN INVITED</div><div class="ct">'+(cnt>0?escapeHtml(String(cnt))+' fan'+(cnt===1?' is':'s are'):'Fans are')+' asking '+escapeHtml(n)+' to host a live Drop.</div><div class="cb" style="margin-bottom:10px">Join as a creator, set your name to <strong>'+escapeHtml(n)+'</strong>, and create your first Drop in minutes. Fans pay nothing until you go live.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="dc-cta" style="margin:0;width:auto" data-act="joinFromInvite()">JOIN AS A CREATOR</button><button class="tab" data-act="document.getElementById(\'inviteBanner\').style.display=\'none\'">Dismiss</button></div>';
  box.style.display='block';
}
function joinFromInvite(){
  const n=(new URLSearchParams(location.search).get('invite')||'').trim().slice(0,60);
  openAuth('up'); const d=document.getElementById('authDisplayName'); if(d&&!d.value)d.value=n;
  const r=document.querySelector('input[name="authRoleR"][value="creator"]'); if(r)r.checked=true;
}
async function refreshCreatorBadge(){
  const tab=Array.from(document.querySelectorAll('.tabs .tab')).find(t=>(t.getAttribute('data-act')||'').includes("'creator'")); if(!tab)return;
  let n=0;
  if(sb&&currentProfile&&currentProfile.role!=='fan'){try{const r=await sb.from('drop_requests').select('id',{count:'exact',head:true}).eq('creator_id',currentProfile.id).eq('status','open');if(!r.error)n=r.count||0;}catch(e){}}
  tab.innerHTML='Creator Dashboard'+(n>0?' <span style="background:var(--gold);color:#000;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px">'+n+'</span>':'');
  if(n>0&&!window._badgeToast){window._badgeToast=true;toast('You have '+n+' open fan request'+(n===1?'':'s')+' in your Creator Dashboard.','good');}
}
async function renderCreatorChecklist(){
  const box=document.getElementById('creatorChecklist'); if(!box)return;
  if(!sb||!currentProfile||currentProfile.role==='fan'){box.style.display='none';return;}
  let drops=0; try{const r=await sb.from('drops').select('id',{count:'exact',head:true}).eq('creator_id',currentProfile.id);drops=r.count||0;}catch(e){}
  const steps=[[!!currentProfile.display_name,'Set your public name'],[!!currentProfile.username,'Pick your @username (Account & Settings)'],[drops>0,'Create your first Drop'],[drops>0,'Share its link on WhatsApp / Instagram']];
  if(steps.every((x,i)=>x[0]&&i<3)&&drops>0){box.style.display='none';return;}
  box.innerHTML='<div class="ct">Get started</div>'+steps.slice(0,3).map(x=>'<div class="cb" style="margin:4px 0">'+(x[0]?'\u2705':'\u2B1C')+' '+x[1]+'</div>').join('')+'<div class="cb" style="margin-top:6px">Then share your Drop link — it carries your name and a live countdown.</div>';
  box.style.display='block';
}
