/* Panel switching and tier picker */
function sw(n,btn){
  document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.getElementById('p-'+n).classList.add('on');
  btn.classList.add('on');
  if(n==='mydrops') renderMyActivity();
  if(n==='creators') loadCreatorDirectory();
  if(n==='creator'){renderCreatorDashboard();renderCreatorChecklist();refreshCreatorBadge();}
  if(n==='settings') loadAccountSettings();
}

// ── Tier picker
function pick(el,price){
  document.querySelectorAll('.tier').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('cta').textContent='CONTRIBUTE '+price+' · UNLOCK THE DROP';
}

// ── Drop data layer: local prototype now, Supabase when configured.
