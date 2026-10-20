/* Startup, date defaults, countdown */
if(sb){
  sb.auth.onAuthStateChange((event,session)=>{
    _sessP=null;
    applyAuthSession(session);
    // Never await Supabase calls inside this callback and never refresh sessions here (avoids the old 429 loop).
    if(event==='PASSWORD_RECOVERY'){setTimeout(()=>{openSettingsPanel();toast('Enter a new password under Security, then save.','good');},0);}
    if(event==='SIGNED_OUT'){window._lastGoodSession=null;currentProfile=null;profileLoadedFor=null;setTimeout(applyRoleUI,0);}
    else if(session&&(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='USER_UPDATED')){setTimeout(()=>loadMyProfile(false),0);}
  });
  const rc=document.getElementById('requestCreator');
  rc?.addEventListener('input',()=>{const h=document.getElementById('requestCreatorId');if(h)h.value='';});
  rc?.addEventListener('change',e=>{const v=e.target.value.trim().toLowerCase(),m=creatorDirectoryItems.filter(c=>c.id!==directoryUserId&&(c.display_name||'').toLowerCase()===v),h=document.getElementById('requestCreatorId');if(h)h.value=m.length===1?m[0].id:'';});
  rc?.addEventListener('focus',()=>{if(!creatorDirectoryItems.length)loadCreatorDirectory();},{once:true});
}
if(PAYMENTS_ENABLED){
  const set=(id,h)=>{const e=document.getElementById(id);if(e)e.innerHTML=h;};
  set('aboutNote','DropLive lets fans request live experiences from creators and fund them together. <strong>Requests are free demand signals.</strong> Contributing to a Drop is a real payment through Paystack. If a Drop misses its goal by the deadline, or the creator cancels, you are refunded in full.');
  set('payNote','Secure payment by <strong>Paystack</strong> (card, bank transfer, USSD). If the goal is not met by the deadline, or the creator cancels, you are refunded in full to your original payment method.');
  set('trustLine','Funding deadline countdown above · Payments secured by Paystack');
}
loadInitialDrop();
updateAuthButton();
handlePaymentReturn();
loadExploreDrops();loadInviteBanner();

// Set sensible date defaults without hard-coding a past date.
(function initCreateDates(){
  const now=new Date();
  const live=new Date(now.getTime()+24*60*60*1000);
  live.setMinutes(0,0,0);
  const pad=n=>String(n).padStart(2,'0');
  const dateEl=document.getElementById('dropDate');
  const deadlineEl=document.getElementById('dropDeadline');
  if(dateEl) dateEl.value=`${live.getFullYear()}-${pad(live.getMonth()+1)}-${pad(live.getDate())}`;
  if(deadlineEl){
    const dl=new Date(live.getTime()-2*60*60*1000);
    deadlineEl.value=`${dl.getFullYear()}-${pad(dl.getMonth()+1)}-${pad(dl.getDate())}T${pad(dl.getHours())}:${pad(dl.getMinutes())}`;
  }
})();

// ── Real countdown to the Drop's funding deadline (hidden when there is none)
function tick(){
  const d=activeDrop(), box=document.querySelector('.dc-countdown'); if(!box)return;
  const t=d&&d.deadline?new Date(d.deadline).getTime():NaN;
  if(!Number.isFinite(t)||t<=Date.now()){box.style.display='none';return;}
  box.style.display=''; const left=Math.floor((t-Date.now())/1000), pad=n=>String(n).padStart(2,'0');
  document.getElementById('cdH').textContent=pad(Math.min(Math.floor(left/3600),999));
  document.getElementById('cdM').textContent=pad(Math.floor(left%3600/60));
  document.getElementById('cdS').textContent=pad(left%60);
}
setInterval(tick,1000);tick();
