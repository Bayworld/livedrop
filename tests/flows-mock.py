"""Runs the new flows against a FAKE Supabase (no network). Proves the browser code calls the right things; does NOT test the database."""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent / 'public'
FAKE = """
window.__calls=[]; window.DROPLIVE_SUPABASE_URL='https://x.supabase.co'; window.DROPLIVE_SUPABASE_ANON_KEY='anon';
window.__notifs=[{id:'n1',kind:'drop_live',title:'LIVE NOW: Test Drop',body:'Creator',link:'?drop=abc-123',read_at:null,created_at:new Date().toISOString()},
                 {id:'n2',kind:'x',title:'Evil',body:'',link:'https://evil.example',read_at:null,created_at:new Date().toISOString()}];
function qb(table){const st={table,ops:[]};const p=new Proxy(function(){},{get(_,k){
  if(k==='then')return (res)=>{window.__calls.push({table:st.table,ops:st.ops});
     const data=st.table==='notifications'?window.__notifs:[];res({data,error:null,count:0});};
  return (...a)=>{st.ops.push([k,...a.map(x=>typeof x==='object'?JSON.stringify(x):x)]);return p;};}});return p;}
const __M={createClient(){return{
  auth:{getUser:async()=>({data:{user:window.__anon?null:{id:'u1',email:'a@b.c'}},error:null}),getSession:async()=>({data:{session:window.__anon?null:{user:{id:'u1',email:'a@b.c'}}},error:null}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}}},
  from:(t)=>qb(t),
  rpc:async(n,a)=>{window.__calls.push({rpc:n,args:a});return{data:a.p_phase,error:null}},
  functions:{invoke:async(n,a)=>{window.__calls.push({fn:n,args:a});return{data:{authorization_url:'about:blank'},error:null}}}}}};
Object.defineProperty(window,'supabase',{get(){return __M},set(){}});
"""
fails=[]
def check(n,c):
    print(('PASS ' if c else 'FAIL ')+n)
    if not c: fails.append(n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.add_init_script(FAKE)
    pg.goto((root/'index.html').as_uri()); pg.wait_for_timeout(1200)
    check('bell visible when signed in', pg.is_visible('#bellBtn'))
    check('unread count shows 2', pg.inner_text('#bellCount')=='2')
    pg.click('#bellBtn'); check('inbox lists notifications', 'LIVE NOW: Test Drop' in pg.inner_text('#notifList'))
    pg.evaluate("window.confirm=()=>true")
    pg.evaluate("setDropPhase('11111111-1111-1111-1111-111111111111','live')"); pg.wait_for_timeout(300)
    calls=pg.evaluate("window.__calls")
    check('go live calls set_drop_phase RPC', any(c.get('rpc')=='set_drop_phase' and c['args']['p_phase']=='live' for c in calls))
    pg.evaluate("acceptRequest('22222222-2222-2222-2222-222222222222')"); pg.wait_for_timeout(300)
    calls=pg.evaluate("window.__calls")
    check('accept updates drop_requests status', any(c.get('table')=='drop_requests' and any(o[0]=='update' and 'accepted' in o[1] for o in c['ops']) for c in calls))
    check('payments flag defaults OFF', pg.evaluate("PAYMENTS_ENABLED===false"))
    check('pilot copy shown (no Paystack claim)', 'Paystack' not in pg.inner_text('#aboutNote'))
    pg.evaluate("openNotification(1)"); pg.wait_for_timeout(200)
    check('off-site notification link is NOT followed', pg.evaluate("location.protocol")=='file:')
    # creator button: fan -> becomes creator
    pg.evaluate("window.__calls.length=0; currentProfile={role:'fan',display_name:'Fan One'}")
    pg.evaluate("creatorCta()"); pg.wait_for_timeout(400)
    calls=pg.evaluate("window.__calls")
    check('fan tapping creator button upserts role=both', any(c.get('table')=='profiles' and any(o[0]=='upsert' and '"role":"both"' in o[1] for o in c['ops']) for c in calls))
    pg.evaluate("window.__calls.length=0; currentProfile={role:'creator',display_name:'C'}; applyRoleUI()")
    check('creator sees dashboard label', pg.inner_text('#heroCreatorBtn')=='OPEN CREATOR DASHBOARD')
    pg.evaluate("creatorCta()"); pg.wait_for_timeout(200)
    check('creator is NOT sent to sign-up', pg.evaluate("document.getElementById('authModal').style.display")!='flex')
    check('creator lands on dashboard panel', pg.evaluate("document.getElementById('p-creator').classList.contains('on')"))
    check('no uncaught errors', not errs)
    for e in errs: print('  ERR',e)
    # signed-out visitor
    pg3=b.new_page(); pg3.add_init_script("window.__anon=true;"+FAKE); pg3.goto((root/'index.html').as_uri()); pg3.wait_for_timeout(800)
    pg3.evaluate("creatorCta()"); pg3.wait_for_timeout(300)
    check('visitor gets sign-up with Creator preselected', pg3.evaluate("document.getElementById('authModal').style.display")=='flex' and pg3.evaluate("document.querySelector('input[name=authRoleR]:checked').value")=='creator')
    # payments ON variant
    pg2=b.new_page(); pg2.add_init_script("window.DROPLIVE_PAYMENTS_ENABLED=true;"+FAKE); pg2.goto((root/'index.html').as_uri()); pg2.wait_for_timeout(800)
    check('payments ON swaps in Paystack copy', 'Paystack' in pg2.inner_text('#aboutNote'))
    b.close()
sys.exit(1 if fails else 0)
