/* Account settings, authentication, session */
const SETTINGS_KEY='droplive_account_preferences_v1';
function openSettingsPanel(btn){
  if(btn){sw('settings',btn);return;}
  document.querySelectorAll('.pn').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  const panel=document.getElementById('p-settings');if(panel)panel.classList.add('on');
  loadAccountSettings();
}
function openSettingsFromAccount(){closeAccount();openSettingsPanel();}
function openCreatorFromSettings(){const t=Array.from(document.querySelectorAll('.tab')).find(x=>x.textContent.includes('Creator Dashboard'));if(t)sw('creator',t);}
function settingMessage(id,msg,good=false){const box=document.getElementById(id);if(!box)return;box.style.display='block';box.style.color=good?'var(--gr)':'var(--rd)';box.textContent=msg;}
function readPreferences(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch(e){return {}}}
async function loadAccountSettings(){
  const prefs=readPreferences();
  const emailLabel=document.getElementById('settingsCurrentEmail');
  if(!sb){if(emailLabel)emailLabel.textContent='Local prototype — connect Supabase to manage email and password.';document.getElementById('settingsDisplayName').value=localStorage.getItem('droplive_display_name')||'';document.getElementById('settingsAvatarUrl').value=localStorage.getItem('droplive_avatar_url')||'';document.getElementById('settingsRole').value=localStorage.getItem('droplive_role')||'fan';return;}
  const {data:{user},error}=await authUser();
  if(error||!user){if(emailLabel)emailLabel.textContent='Sign in to manage your account email.';return;}
  if(emailLabel)emailLabel.textContent=user.email||'Authenticated account';
  const {data:profile}=await sb.from('profiles').select('display_name,avatar_url,role,username').eq('id',user.id).maybeSingle();
  const un=document.getElementById('settingsUsername'); if(un)un.value=profile?.username||'';
  document.getElementById('settingsDisplayName').value=profile?.display_name||user.email?.split('@')[0]||'';
  document.getElementById('settingsAvatarUrl').value=profile?.avatar_url||'';
  document.getElementById('settingsRole').value=['fan','creator','both'].includes(profile?.role)?profile.role:'fan';
}
async function saveAccountProfile(){
  const name=document.getElementById('settingsDisplayName').value.trim();const avatar=document.getElementById('settingsAvatarUrl').value.trim();const role=document.getElementById('settingsRole')?.value||'fan';
  if(!name){settingMessage('settingsProfileMsg','Please enter a display name.');return;}
  if(avatar&&!/^https?:\/\//i.test(avatar)){settingMessage('settingsProfileMsg','Profile photo URL must start with https:// or http://.');return;}
  if(sb){const {data:{user}}=await authUser();if(!user){settingMessage('settingsProfileMsg','Please sign in before saving your profile.');openAuth();return;}
    const uname=(document.getElementById('settingsUsername')?.value||'').trim().toLowerCase().replace(/^@/,'');
    if(uname&&!/^[a-z0-9_]{3,20}$/.test(uname)){settingMessage('settingsProfileMsg','Username must be 3–20 letters, numbers or underscores.');return;}
    const row={id:user.id,display_name:name,avatar_url:avatar||null,role}; if(uname||document.getElementById('settingsUsername'))row.username=uname||null;
    const {error}=await sb.from('profiles').upsert(row,{onConflict:'id'});
    if(error){settingMessage('settingsProfileMsg',error.code==='23505'?'That username is already taken.':'Could not save profile: '+error.message);return;}
  }else{localStorage.setItem('droplive_display_name',name);localStorage.setItem('droplive_avatar_url',avatar);localStorage.setItem('droplive_role',role);}
  settingMessage('settingsProfileMsg','Profile and account mode saved successfully.',true);
  if(sb)await loadMyProfile(true);
  if(typeof loadCreatorDirectory==='function')loadCreatorDirectory();
}
async function changeAccountEmail(){
  if(!sb){settingMessage('settingsSecurityMsg','Connect Supabase and sign in to change your email.');return;}
  const email=document.getElementById('settingsNewEmail').value.trim();if(!email||!document.getElementById('settingsNewEmail').checkValidity()){settingMessage('settingsSecurityMsg','Enter a valid new email address.');return;}
  const {data:{user}}=await authUser();if(!user){settingMessage('settingsSecurityMsg','Please sign in first.');return;}
  const {error}=await sb.auth.updateUser({email});if(error){settingMessage('settingsSecurityMsg','Email update failed: '+error.message);return;}
  settingMessage('settingsSecurityMsg','Email update requested. Check your inbox to complete any required confirmation.',true);
}
async function changeAccountPassword(){
  if(!sb){settingMessage('settingsSecurityMsg','Connect Supabase and sign in to change your password.');return;}
  const password=document.getElementById('settingsNewPassword').value;if(password.length<8){settingMessage('settingsSecurityMsg','Use a password with at least 8 characters.');return;}
  const {data:{user}}=await authUser();if(!user){settingMessage('settingsSecurityMsg','Please sign in first.');return;}
  const {error}=await sb.auth.updateUser({password});if(error){settingMessage('settingsSecurityMsg','Password update failed: '+error.message);return;}
  document.getElementById('settingsNewPassword').value='';settingMessage('settingsSecurityMsg','Password updated successfully.',true);
}

function openAuth(m){if(m==='up'||m==='in')setAuthMode(m);
  if(document.getElementById('accountModal').style.display==='flex') closeAccount();
  document.getElementById('authMsg').style.display='none';
  document.getElementById('authModal').style.display='flex';
}
function closeAuth(){document.getElementById('authModal').style.display='none'}
function openAccount(){document.getElementById('accountModal').style.display='flex'}
function closeAccount(){document.getElementById('accountModal').style.display='none'}
function authMessage(msg,good=false){const el=document.getElementById('authMsg');el.style.display='block';el.style.color=good?'var(--gr)':'var(--rd)';el.textContent=msg}
function accountMessage(msg,good=false){const el=document.getElementById('accountMsg');el.style.display='block';el.style.color=good?'var(--gr)':'var(--rd)';el.textContent=msg}
let authMode='in', authBusy=false;
function setAuthMode(m){
  authMode=m; const up=m==='up', el=id=>document.getElementById(id);
  el('authSignupFields').style.display=up?'block':'none'; el('authTabIn').classList.toggle('on',!up); el('authTabUp').classList.toggle('on',up);
  el('authSubmit').textContent=up?'CREATE ACCOUNT':'SIGN IN'; el('authPassword').autocomplete=up?'new-password':'current-password';
  el('authPassword').placeholder=up?'At least 8 characters':'Password'; el('forgotBtn').style.display=up?'none':''; el('resendBtn').style.display='none'; el('authMsg').style.display='none';
}
function togglePassword(){const e=document.getElementById('authPassword'),show=e.type==='password';e.type=show?'text':'password';document.getElementById('pwToggle').textContent=show?'Hide':'Show';}
function friendlyAuthError(err){
  const m=String(err?.message||'').toLowerCase();
  if(m.includes('invalid login'))return 'Email or password is incorrect.';
  if(m.includes('not confirmed'))return 'unconfirmed';
  if(m.includes('already registered'))return 'An account with this email already exists. Try signing in.';
  if(m.includes('rate limit')||err?.status===429)return 'Too many attempts. Please wait a minute and try again.';
  if(m.includes('fetch')||m.includes('network'))return 'Network problem. Check your connection and try again.';
  return err?.message||'Something went wrong. Please try again.';
}
function authFail(err){const f=friendlyAuthError(err),un=f==='unconfirmed';authMessage(un?'Please confirm your email first. Check your inbox and spam folder.':f);document.getElementById('resendBtn').style.display=un?'':'none';}
function setAuthBusy(b){authBusy=b;const btn=document.getElementById('authSubmit');btn.disabled=b;btn.textContent=b?(authMode==='up'?'CREATING…':'SIGNING IN…'):(authMode==='up'?'CREATE ACCOUNT':'SIGN IN');}
async function handleAuthSubmit(event){
  event.preventDefault(); if(authBusy)return false;
  if(!sb){authMessage('Accounts are not available in local prototype mode.');return false;}
  const email=document.getElementById('authEmail').value.trim(), password=document.getElementById('authPassword').value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){authMessage('Enter a valid email address.');return false;}
  if(!password){authMessage('Enter your password.');return false;}
  if(authMode==='up'&&password.length<8){authMessage('Use a password with at least 8 characters.');return false;}
  setAuthBusy(true);
  try{authMode==='up'?await doSignUp({email,password}):await doSignIn({email,password});}catch(e){authFail(e);}finally{setAuthBusy(false);}
  return false;
}
async function doSignIn(c){
  authMessage('Signing in…',true); const {data,error}=await sb.auth.signInWithPassword(c); if(error){authFail(error);return;}
  authMessage('Welcome back!',true); setTimeout(closeAuth,300); if(data?.session)applyAuthSession(data.session);
}
async function doSignUp(c){
  const displayName=(document.getElementById('authDisplayName').value||'').trim();
  if(!displayName){authMessage('Please enter the name people will see.');return;}
  if(!document.getElementById('authAgree')?.checked){authMessage('Please tick the box to accept the Terms & Privacy.');return;}
  const role=document.querySelector('input[name="authRoleR"]:checked')?.value||'fan';
  authMessage('Creating your account…',true);
  const {data,error}=await sb.auth.signUp({email:c.email,password:c.password,options:{data:{display_name:displayName,role,terms_version:'2026-10-16',terms_accepted_at:new Date().toISOString()},emailRedirectTo:location.origin+location.pathname}});
  if(error){authFail(error);return;}
  if(data?.user?.identities&&data.user.identities.length===0){authMessage('An account with this email already exists. Try signing in.');return;}
  if(!data?.session){authMessage('Almost done! We sent a confirmation link to '+c.email+'. Open it, then come back and sign in.',true);document.getElementById('resendBtn').style.display='';return;}
  const {error:pe}=await sb.from('profiles').upsert({id:data.user.id,display_name:displayName,role},{onConflict:'id'});
  if(pe){authMessage('Account created, but profile setup needs attention: '+pe.message);return;}
  await loadMyProfile(true); applyAuthSession(data.session); authMessage('Account created. Welcome to DropLive!',true); setTimeout(closeAuth,600);
}
async function resendConfirmation(){
  const email=document.getElementById('authEmail').value.trim(); if(!email){authMessage('Enter your email first.');return;}
  const {error}=await sb.auth.resend({type:'signup',email}); authMessage(error?friendlyAuthError(error):'Confirmation email sent again. Check your inbox and spam folder.',!error);
}
async function forgotPassword(){
  const email=document.getElementById('authEmail').value.trim(); if(!email){authMessage('Enter your email above, then tap Forgot password.');return;}
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  authMessage(error?friendlyAuthError(error):'If that email has an account, a reset link is on its way.',!error);
}
function applyAuthSession(session){
  const user=session?.user || null;
  const btn=document.getElementById('authBtn');
  const pill=document.getElementById('modePill');
  if(!btn)return;
  if(user){
    btn.textContent='Account';
    btn.onclick=openAccount;
    pill.style.display='none';
    document.getElementById('accountEmail').textContent=user.email || 'Authenticated user';
  }else{
    btn.textContent='Sign in';
    btn.onclick=openAuth;
    pill.textContent='Local Prototype';pill.style.display=sb?'none':'';
    closeAccount();
  }
}
async function updateAuthButton(){
  const btn=document.getElementById('authBtn');
  if(!btn)return;
  if(!sb){applyAuthSession(null);return;}
  const {data,error}=await authSession();
  if(error){console.warn('DropLive auth session check failed (keeping UI unchanged):',error.message);return;}
  applyAuthSession(data?.session || null);
}
async function signOut(){
  if(sb){const {error}=await sb.auth.signOut();if(error){accountMessage(error.message);return;}}
  applyAuthSession(null);
  closeAccount();
}
function startCreateDropFromAccount(){
  closeAccount();
  const tab=document.querySelector('.tab[data-act*="create"]');
  if(tab)sw('create',tab);
  const form=document.getElementById('createDropForm');
  if(form)form.scrollIntoView({behavior:'smooth',block:'center'});
}
