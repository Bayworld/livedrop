/* Edit and cancel Drop, legal, explore filters, navigation */
const toLocalInput=iso=>{if(!iso)return'';const d=new Date(iso);if(isNaN(d))return'';const q=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${q(d.getMonth()+1)}-${q(d.getDate())}T${q(d.getHours())}:${q(d.getMinutes())}`;};
function openEditDrop(i){const d=(window._dashDrops||[])[i];if(!d)return;editingDropId=d.id;const g=id=>document.getElementById(id);
  g('editTitle').value=d.title||'';g('editDescription').value=d.description||'';g('editLive').value=toLocalInput(d.scheduled_at);g('editDeadline').value=toLocalInput(d.deadline);g('editMsg').style.display='none';g('editSessionUrl').value='';g('editSessionNotes').value='';g('editDropModal').style.display='flex';sb.from('drop_delivery').select('session_url,notes').eq('drop_id',d.id).maybeSingle().then(r=>{if(r.data){g('editSessionUrl').value=r.data.session_url||'';g('editSessionNotes').value=r.data.notes||'';}});}
function closeEditDrop(){document.getElementById('editDropModal').style.display='none';}
async function saveEditDrop(){
  const g=id=>document.getElementById(id), msg=t=>{const b=g('editMsg');b.style.display='block';b.textContent=t;};
  const title=g('editTitle').value.trim(), description=g('editDescription').value.trim(), live=new Date(g('editLive').value), dl=new Date(g('editDeadline').value);
  if(!title){msg('Title is required.');return;} if(isNaN(live)||isNaN(dl)){msg('Enter both dates.');return;} if(dl>=live){msg('Funding deadline must be before the live session.');return;}
  const {data:{user}}=await authUser(); if(!user){openAuth();return;}
  const {error}=await sb.from('drops').update({title,description,scheduled_at:live.toISOString(),deadline:dl.toISOString()}).eq('id',editingDropId).eq('creator_id',user.id);
  if(error){msg('Could not save: '+error.message);return;}
  const url=g('editSessionUrl').value.trim(), notes=g('editSessionNotes').value.trim();
  if(url&&!/^https:\/\//i.test(url)){msg('Session link must start with https://');return;}
  const dr=await sb.from('drop_delivery').upsert({drop_id:editingDropId,session_url:url||null,notes:notes||null,updated_at:new Date().toISOString()});
  if(dr.error){msg('Drop saved, but session details failed: '+dr.error.message+' (run the v0.8.0 migration).');return;}
  closeEditDrop(); toast('Drop updated.','good'); renderCreatorDashboard();
}
async function cancelDrop(i){
  const d=(window._dashDrops||[])[i]; if(!d)return;
  if(!confirm('Cancel this Drop? Fans can no longer contribute, and anyone who already paid will be refunded.'))return;
  const {data:{user}}=await authUser(); if(!user){openAuth();return;}
  const {error}=await sb.from('drops').update({status:'cancelled'}).eq('id',d.id).eq('creator_id',user.id);
  if(error){toast('Could not cancel: '+error.message);return;} toast('Drop cancelled.','good'); renderCreatorDashboard();
}
async function copyDropLink(id){const url=location.origin+location.pathname+'?drop='+encodeURIComponent(id);try{await navigator.clipboard.writeText(url);toast('Link copied.','good');}catch(e){prompt('Copy this link:',url);}}
function openLegal(){closeAuth();document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('on'));document.getElementById('p-legal').classList.add('on');window.scrollTo({top:0});}
(function(){const c=window.DROPLIVE_CONTACT_EMAIL;if(c){const html=` · <a href="mailto:${escapeHtml(c)}">Contact</a>`;['footContact','legalContact'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML=html;});document.querySelectorAll('.support-email').forEach(e=>{e.textContent=c;e.style.background='none';});}})();
function filterExplore(filter,btn){activeExploreFilter=filter;document.querySelectorAll('.filter-chip').forEach(x=>x.classList.remove('on'));btn.classList.add('on');renderExplore()}
function scrollToDrops(){document.getElementById('exploreSection')?.scrollIntoView({behavior:'smooth',block:'start'})}
function openRequestFromNav(){const tab=document.querySelector('.tab[data-act*="request"]');if(tab)sw('request',tab)}
function openRequestFromAccount(){closeAccount();openRequestFromNav()}
function openCreatorDemandFromAccount(){closeAccount();openCreatorDemand()}
function openCreatorDemand(){
  const tab=document.querySelector('.tab[data-act*="mydrops"]');
  document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('on'));
  document.getElementById('p-demand').classList.add('on');
  renderCreatorDemand();
}
function openMyActivityFromAccount(){closeAccount();const tab=document.querySelector('.tab[data-act*="mydrops"]');if(tab)sw('mydrops',tab);renderMyActivity()}
function openRequestWithCreator(name,id){const tab=document.querySelector('.tab[data-act*="request"]');if(tab)sw('request',tab);const el=document.getElementById('requestCreator');if(el)el.value=name;const h=document.getElementById('requestCreatorId');if(h)h.value=id||'';document.getElementById('requestTitle')?.focus()}
function requestFromDirectory(id){const c=creatorDirectoryItems.find(x=>x.id===id);if(c)openRequestWithCreator(c.display_name||'',c.id)}
function openDropFromExplore(id){const d=exploreItems.find(x=>x.id===id);if(!d)return;currentDrop=d;renderActiveDrop();const tab=document.createElement('button');tab.className='tab';sw('product',tab);window.scrollTo({top:0,behavior:'smooth'});}
async function saveDropRequest(){if(window._reqBusy)return;window._reqBusy=true;try{await saveDropRequestInner();}finally{window._reqBusy=false;}}
async function saveDropRequestInner(){
  const creator=document.getElementById('requestCreator').value.trim(), title=document.getElementById('requestTitle').value.trim(), description=document.getElementById('requestDescription').value.trim();
  const amount=Number(document.getElementById('requestAmount').value), people=Number(document.getElementById('requestPeople').value);
  if(!creator||!title||!description){toast('Please complete the request fields.');return;}
  if(!Number.isFinite(amount)||amount<100){toast('Willing contribution must be at least ₦100.');return;}
  if(!Number.isFinite(people)||people<1){toast('Potential supporters must be at least 1.');return;}
  if(sb){
    const {data:sessionData,error:sessionError}=await authSession();
    if(sessionError){toast('Could not verify your sign-in right now. Please wait a moment and try again.');console.warn('Request session check failed:',sessionError.message);return;}
    const user=sessionData?.session?.user;
    if(!user){openAuth();return;}
    let creatorId=document.getElementById('requestCreatorId')?.value||null;
    if(!creatorId){
      const esc=creator.replace(/[\\%_]/g,'\\$&');
      const m=await sb.from('public_creator_profiles').select('id').in('role',['creator','both']).ilike('display_name',esc).limit(5);
      if(m.error) console.warn('Creator lookup failed; saving request by name only:',m.error.message);
      else if((m.data||[]).length>1){toast('More than one registered creator uses that name. Please choose the right one from the Creators tab and use its REQUEST button.');return;}
      else if(m.data?.length===1)creatorId=m.data[0].id;
    }
    lastRequestUnrouted=!creatorId;
    const {error}=await sb.from('drop_requests').insert({fan_id:user.id,creator_id:creatorId,creator_name:creator,title,description,willing_amount:amount,potential_supporters:people,status:'open'});
    if(error){toast('Request was not saved: '+error.message);return;}
  }
  else{const arr=JSON.parse(localStorage.getItem('droplive_requests_v1')||'[]');arr.push({id:'req_'+Date.now().toString(36),creator_name:creator,title,description,willing_amount:amount,potential_supporters:people,status:'open',createdAt:new Date().toISOString()});localStorage.setItem('droplive_requests_v1',JSON.stringify(arr));}
  const box=document.getElementById('requestResult');box.style.display='block';window._inviteName=creator;const unrouted=sb&&lastRequestUnrouted;box.innerHTML='<div class="prototype-note"><strong style="color:var(--gr)">Request sent ✓</strong><br>Your demand signal has been recorded. No money was charged.'+(unrouted?'<br><br>This creator is not on DropLive yet, so they cannot see your request. Invite them so it reaches them:<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="tab" data-act="inviteShare(\'wa\')">Invite on WhatsApp</button><button type="button" class="tab" data-act="inviteShare(\'copy\')">Copy invite</button></div>':'')+'</div>';document.getElementById('requestDropForm').reset();document.getElementById('requestAmount').value=5000;document.getElementById('requestPeople').value=20;renderMyActivity();
}
