/* Delegated actions: replaces inline on* handlers so the CSP can drop 'unsafe-inline' for scripts.
   Markup uses data-act="fn('a',1)", data-input="fn()", data-submit="fn(event)". Only global functions are callable; nothing is eval'd. */
(function(){
  function parseArgs(src,el,ev){
    const out=[];let i=0;const n=src.length;
    const ws=()=>{while(i<n&&/\s/.test(src[i]))i++;};
    while(true){ws();if(i>=n)break;const c=src[i];
      if(c==="'"||c==='"'){i++;let s='';while(i<n&&src[i]!==c){if(src[i]==='\\'){i++;const e=src[i];
        if(e==='n')s+='\n';else if(e==='x'){s+=String.fromCharCode(parseInt(src.substr(i+1,2),16));i+=2;}
        else if(e==='u'){s+=String.fromCharCode(parseInt(src.substr(i+1,4),16));i+=4;}else s+=e;i++;}else s+=src[i++];}
        i++;out.push(s);}
      else{let j=i;while(j<n&&src[j]!==',')j++;const t=src.slice(i,j).trim();i=j;
        out.push(t==='this'?el:t==='event'?ev:t==='true'?true:t==='false'?false:t==='null'?null:t==='undefined'?undefined:Number(t));}
      ws();if(src[i]===',')i++;}
    return out;
  }
  function run(code,el,ev){
    code=String(code||'').trim(); let m;
    let stop=false; if((m=code.match(/^([\s\S]*?);\s*return false$/))){code=m[1].trim();stop=true;}
    if((m=code.match(/^return\s+([\s\S]+)$/))){const r=run(m[1],el,ev);if(r===false)ev.preventDefault();return r;}
    if((m=code.match(/^if\(event\.target===this\)\s*([\s\S]+)$/))){return ev.target===el?run(m[1],el,ev):undefined;}
    if((m=code.match(/^document\.getElementById\((['"])(.+?)\1\)\.style\.display=(['"])(.*?)\3$/))){const t=document.getElementById(m[2]);if(t)t.style.display=m[4];return;}
    if((m=code.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/))){
      const f=window[m[1]]; if(typeof f!=='function'){console.warn('Unknown action',m[1]);return;}
      const r=f.apply(null,parseArgs(m[2],el,ev)); if(stop)ev.preventDefault(); return r;}
    console.warn('Unsupported action',code);
  }
  function dispatch(attr){return function(ev){
    for(let el=ev.target;el&&el!==document;el=el.parentElement){
      if(el.hasAttribute&&el.hasAttribute(attr)){
        if(el.tagName==='A'&&(el.getAttribute('href')||'#').startsWith('#'))ev.preventDefault();
        run(el.getAttribute(attr),el,ev);}}};}
  document.addEventListener('click',dispatch('data-act'));
  document.addEventListener('input',dispatch('data-input'));
  document.addEventListener('submit',dispatch('data-submit'));
  window.__runAction=run;
})();
