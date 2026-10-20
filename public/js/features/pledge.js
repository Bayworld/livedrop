/* Pledge flow */
async function pledge(){
  const d=activeDrop(); if(!d){toast('Create a Drop first.');return;}
  if(sb){
    const {data:{user}}=await authUser();
    if(!user){openAuth();return;}
    if(sb&&((d.deadline&&new Date(d.deadline)<=new Date())||(d.status&&!['funding','unlocked','live'].includes(d.status)))){toast('Funding for this Drop has closed.');return;}
    if(String(d.id).startsWith('demo-')){toast('This is a demo experience, not a real Drop, so it cannot be supported.');return;}
    if(pledgeBusy)return; pledgeBusy=true;
    const cta=document.getElementById('cta'); if(cta)cta.disabled=true;
    try{
      if(PAYMENTS_ENABLED){
      toast('Opening secure checkout…');
        const {data,error}=await sb.functions.invoke('paystack-init',{body:{drop_id:d.id}});
        let msg=data?.error;
        if(error&&!msg){try{msg=(await error.context.json()).error;}catch(_){}}
        if(error||!data?.authorization_url){toast(msg||'Could not start payment. Please try again.');return;}
        location.href=data.authorization_url;   // Paystack hosted checkout; it sends the fan back with ?payment=<reference>
        return;
      }
      const {error}=await sb.from('contributions').insert({drop_id:d.id,fan_id:user.id,amount:d.contribution,status:'pending'});
      if(error){toast(error.code==='23505'?'You already have a pending pledge on this Drop. Check My Activity.':'Pledge could not be recorded: '+error.message);return;}
      toast('Pledge recorded as PENDING. No payment has been taken and no money has moved. Payments are not connected yet.','good');
    }finally{pledgeBusy=false; if(cta)cta.disabled=false;}
    return;
  }
  const drops=getDrops(); const local=drops.find(x=>x.id===d.id) || drops[drops.length-1];
  if(!local)return;
  const history=JSON.parse(localStorage.getItem('droplive_test_contributions_v1')||'[]');
  history.unshift({drop_id:local.id,title:local.title,creator:local.creator||'Creator',amount:Number(local.contribution),status:'test_recorded',created_at:new Date().toISOString()});
  localStorage.setItem('droplive_test_contributions_v1',JSON.stringify(history));
  local.raised=(local.raised||0)+Number(local.contribution); local.contributors=(local.contributors||0)+1; local.lastContributionAt=new Date().toISOString(); saveDrops(drops); currentDrop=local; renderActiveDrop();
  const b=document.getElementById('cta'); b.textContent=local.raised>=local.goal?'✓ DROP UNLOCKED':'✓ TEST CONTRIBUTION RECORDED'; b.style.background='var(--gr)'; setTimeout(()=>{renderActiveDrop();b.style.background='var(--gold)'},1800);
}

/* Returning from Paystack: confirm the payment server-side, then refresh the Drop. */
async function handlePaymentReturn(){
  const qs=new URLSearchParams(location.search), ref=qs.get('payment'), dropId=qs.get('drop');
  if(!ref||!sb||!PAYMENTS_ENABLED)return;
  history.replaceState(null,'',location.pathname+(dropId?'?drop='+encodeURIComponent(dropId):''));
  const {data:{user}}=await authUser(); if(!user){openAuth();return;}
  toast('Confirming your payment…');
  for(let i=0;i<6;i++){
    const {data}=await sb.functions.invoke('paystack-verify',{body:{reference:ref}});
    if(data?.status==='paid'){toast('Payment received. You’re in! 🎉','good');try{await loadInitialDrop();renderMyActivity();loadDelivery();}catch(_){}return;}
    if(data?.status==='failed'||data?.status==='refunded'){toast('That payment did not go through. You were not charged.');return;}
    await new Promise(r=>setTimeout(r,2500));
  }
  toast('Still confirming. Check My Activity in a minute; you will not be charged twice.');
}

async function cancelPledge(id){
  if(!sb||!confirm('Withdraw this pending pledge? No money has been taken.'))return;
  const {error}=await sb.rpc('fan_cancel_pledge',{p_contribution_id:id});
  if(error){toast(error.message.replace(/^.*?:\s*/,'')||'Could not withdraw the pledge.');return;}
  toast('Pledge withdrawn.','good'); renderMyActivity();
}
