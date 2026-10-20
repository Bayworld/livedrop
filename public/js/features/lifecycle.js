/* Drop lifecycle (accept, go live, end) and in-app notifications */
async function acceptRequest(id){
  const ok=await markRequestStatus(id,'accepted');
  if(ok&&confirm('Request accepted. Create the Drop for it now?'))convertRequestToDrop(id);
}

async function setDropPhase(id,phase){
  if(!sb)return;
  const msg=phase==='live'?'Go live now? Everyone who joined and your followers will be notified.':'End this session and mark the Drop completed?';
  if(!confirm(msg))return;
  const {error}=await sb.rpc('set_drop_phase',{p_drop_id:id,p_phase:phase});
  if(error){toast(error.message.replace(/^.*?:\s*/,'')||'Could not change the Drop.');return;}
  toast(phase==='live'?'You are LIVE. Fans have been notified.':'Session ended. Drop completed.','good');
  renderCreatorDashboard();
}

/* "I'M A CREATOR": the right next step for each kind of visitor (it used to always open sign-up). */
async function creatorCta(){
  if(!sb){navTo('create');return;}                       // local prototype mode
  const {data:{user}}=await authUser();
  if(!user){                                            // visitor: open sign-up with Creator pre-selected
    openAuth('up');
    const r=document.querySelector('input[name="authRoleR"][value="creator"]'); if(r)r.checked=true;
    return;
  }
  if(!currentProfile)await loadMyProfile(true);
  if(['creator','both'].includes(currentProfile?.role)){navTo('creator');return;}   // already a creator
  if(!confirm('Switch your account to Creator mode? You keep all your fan features too.'))return;
  const name=currentProfile?.display_name||(user.email||'creator').split('@')[0].slice(0,60);
  const {error}=await sb.from('profiles').upsert({id:user.id,display_name:name,role:'both'},{onConflict:'id'});
  if(error){toast('Could not switch your account: '+error.message);return;}
  await loadMyProfile(true);
  toast('You are now a creator. Create your first Drop!','good');
  navTo('create');
}

/* ── Notifications ── */
let notifItems=[];
async function refreshBell(){
  const bell=document.getElementById('bellBtn'); if(!bell||!sb)return;
  const {data:{user}}=await authUser();
  if(!user){bell.style.display='none';return;}
  bell.style.display='';
  const r=await sb.from('notifications').select('id,kind,title,body,link,read_at,created_at').order('created_at',{ascending:false}).limit(30);
  if(r.error)return;
  const prevUnread=notifItems.filter(n=>!n.read_at).length;
  notifItems=r.data||[];
  const unread=notifItems.filter(n=>!n.read_at).length, c=document.getElementById('bellCount');
  c.textContent=unread>9?'9+':String(unread); c.style.display=unread?'inline-block':'none';
  if(unread>prevUnread&&prevUnread>=0&&document.visibilityState==='visible'&&notifItems.length&&window._bellReady)toast(notifItems.find(n=>!n.read_at).title,'good');
  window._bellReady=true;
  if(document.getElementById('notifModal').style.display==='flex')renderNotifications();
}
function renderNotifications(){
  const box=document.getElementById('notifList');
  box.innerHTML=notifItems.length?notifItems.map((n,i)=>`<div class="activity-item" style="cursor:${n.link?'pointer':'default'};${n.read_at?'opacity:.6':''}" ${n.link?`data-act="openNotification(${i})"`:''}><strong>${escapeHtml(n.title)}</strong><div class="activity-meta">${escapeHtml(n.body||'')}<br>${new Date(n.created_at).toLocaleString()}</div></div>`).join(''):'<div class="market-empty">Nothing yet. You will see replies to your requests and live alerts here.</div>';
}
function openNotifications(){document.getElementById('notifModal').style.display='flex';renderNotifications();}
function closeNotifications(){document.getElementById('notifModal').style.display='none';}
async function markAllNotificationsRead(){
  if(!sb)return;
  await sb.from('notifications').update({read_at:new Date().toISOString()}).is('read_at',null);
  refreshBell();
}
async function openNotification(i){
  const n=notifItems[i]; if(!n)return;
  if(!n.read_at&&sb)await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('id',n.id);
  if(typeof n.link==='string'&&/^\?[A-Za-z0-9=&_.@%-]{1,200}$/.test(n.link))location.href=location.pathname+n.link;  // only same-site query links
}
if(sb){
  refreshBell(); setInterval(()=>{if(document.visibilityState==='visible')refreshBell();},120000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshBell();});
  sb.auth.onAuthStateChange(()=>{_sessP=null;window._bellReady=false;notifItems=[];refreshBell();});
}
