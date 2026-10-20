/* Shared helpers: toast, escaping, formatting. Loaded first. */
let toastTimer;
function toast(msg,kind){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.className='show'+(kind==='good'?' good':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.className=''},5500);}
window.alert=function(m){toast(String(m));};
function money(n){return '₦'+Number(n||0).toLocaleString('en-NG')}
function initials(name){return String(name||'Creator').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// Safe for use inside a double-quoted HTML attribute that holds a single-quoted JS string.
// Order matters: JS-escape first, then HTML-escape (the browser HTML-decodes before running JS).
function escapeJs(v){const j=String(v??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ').replace(/</g,'\\x3c');return escapeHtml(j)}
