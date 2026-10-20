/* v0.13.0: creator earnings (read-only, from the creator_earnings() database function) */
async function loadEarnings(){
  const box=document.getElementById('creatorEarnings'); if(!box||!sb)return;
  const {data:{user}}=await authUser(); if(!user){box.innerHTML='<div class="market-empty">Sign in to see your earnings.</div>';return;}
  const r=await sb.rpc('creator_earnings');
  if(r.error){box.innerHTML='<div class="market-empty">Earnings are not available yet.</div>';console.warn('creator_earnings:',r.error.message);return;}
  const rows=r.data||[];
  if(!rows.length){box.innerHTML='<div class="market-empty">No Drops yet. Earnings appear here once fans pay.</div>';return;}
  const tot=rows.reduce((a,x)=>({g:a.g+Number(x.gross||0),f:a.f+Number(x.fee||0),n:a.n+Number(x.net||0),rf:a.rf+Number(x.refunded||0)}),{g:0,f:0,n:0,rf:0});
  box.innerHTML='<div class="creator-drop-row"><strong>Total</strong> · '+escapeHtml(money(tot.g))+' paid · fees '+escapeHtml(money(tot.f))+' · <strong>you keep '+escapeHtml(money(tot.n))+'</strong>'+(tot.rf?' · refunded '+escapeHtml(money(tot.rf)):'')+'</div>'+
    rows.map(x=>'<div class="creator-drop-row"><strong>'+escapeHtml(x.title||'Drop')+'</strong> <span class="cb">('+escapeHtml(String(x.status||''))+')</span><br>'+Number(x.paid_count||0)+' backers · '+escapeHtml(money(Number(x.gross||0)))+' paid · fee '+escapeHtml(money(Number(x.fee||0)))+' · net '+escapeHtml(money(Number(x.net||0)))+'</div>').join('')+
    '<div class="cb" style="margin-top:6px;opacity:.7">Amounts become payable after a Drop is completed. Payments are not live during the pilot.</div>';
}
(function(){const base=window.renderCreatorDashboard; if(typeof base!=='function')return;
  window.renderCreatorDashboard=async function(){const out=await base.apply(this,arguments); try{await loadEarnings();}catch(e){console.warn(e);} return out;};})();
