/* SpellVault UI and application logic. No external requests or libraries. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const emptyData = () => ({mails:[],apps:[],settings:{globalLock:false}});
  let data=emptyData(), selectedMail=null, page="mail", globalPassphrase=null;
  let sheetMode=null, editingId=null, pendingPin=null, pinAction=null, toastTimer=null;
  const revealed=new Map(), wrongPins=new Map();
  const uid=()=>crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
  const escapeText=s=>String(s??"");
  const safeJSON=(obj)=>JSON.stringify(obj);
  const toast=msg=>{const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2600);};
  const save=async()=>{let record;if(data.settings.globalLock){if(!globalPassphrase)throw new Error("Vault is locked.");record=await VaultCrypto.encryptVault(data,globalPassphrase);}else record={version:1,globalLock:false,data};await VaultDB.set(record);};
  const hideAll=()=>{revealed.forEach(v=>clearTimeout(v.timer));revealed.clear();renderApps();};
  const setPage=p=>{page=p;$("mailPage").classList.toggle("hidden",p!=="mail");$("appPage").classList.toggle("hidden",p!=="apps");$("settingsPage").classList.toggle("hidden",p!=="settings");$("backBtn").classList.toggle("hidden",p==="mail");render();};
  const showMain=()=>{$("welcome").classList.add("hidden");$("unlockScreen").classList.add("hidden");$("mainView").classList.remove("hidden");setPage("mail");};
  async function load(){
    const rec=await VaultDB.get();
    if(!rec){data=emptyData();await save();showMain();return;}
    if(rec.globalLock){$("welcome").classList.add("hidden");$("mainView").classList.add("hidden");$("unlockScreen").classList.remove("hidden");return;}
    data=rec.data||emptyData();showMain();
  }
  function render(){if(page==="mail")renderMails();if(page==="apps")renderApps();}
  function renderMails(){
    const q=$("mailSearch").value.toLowerCase().trim(), grid=$("mailGrid");
    const mails=data.mails.filter(m=>m.address.toLowerCase().includes(q));
    $("mailCount").textContent=`${mails.length} ${mails.length===1?"entry":"entries"}`;
    grid.replaceChildren();
    if(!mails.length){grid.append(emptyState(q?"No matching emails":"Your vault is waiting","Add an email address to start organizing your logins.","＋","addMailBtn"));return;}
    mails.forEach(m=>{const count=data.apps.filter(a=>a.mailId===m.id).length;const card=document.createElement("button");card.className="mail-card";card.type="button";const icon=document.createElement("div");icon.className="mail-icon";icon.textContent="✉";const address=document.createElement("div");address.className="mail-address";address.textContent=m.address;const meta=document.createElement("div");meta.className="mail-meta";meta.textContent=`${count} ${count===1?"application":"applications"}`;card.append(icon,address,meta);card.addEventListener("click",()=>{selectedMail=m.id;setPage("apps");});grid.append(card);});
  }
  function emptyState(title,desc,symbol,actionId){const box=document.createElement("div");box.className="empty-state";const icon=document.createElement("div");icon.className="empty-symbol";icon.textContent=symbol;const h=document.createElement("h3");h.textContent=title;const p=document.createElement("p");p.textContent=desc;const b=document.createElement("button");b.className="btn btn-secondary";b.textContent=actionId==="addMailBtn"?"Add your first mail":"Add your first app";b.addEventListener("click",()=>$(actionId).click());box.append(icon,h,p,b);return box;}
  function renderApps(){
    const mail=data.mails.find(m=>m.id===selectedMail);if(!mail){setPage("mail");return;}
    $("selectedMailTitle").textContent=mail.address;$("selectedMailSubtitle").textContent="Your saved logins for this email address.";
    const q=$("appSearch").value.toLowerCase().trim(), list=$("appList");
    const apps=data.apps.filter(a=>a.mailId===selectedMail && (a.name.toLowerCase().includes(q)||(a.username||"").toLowerCase().includes(q)));
    $("appCount").textContent=`${apps.length} ${apps.length===1?"entry":"entries"}`;list.replaceChildren();
    if(!apps.length){list.append(emptyState(q?"No matching apps":"Nothing saved here yet","Add an application to keep its login details close.","＋","addAppBtn"));return;}
    apps.forEach(a=>{
      const card=document.createElement("article");card.className="app-card";
      const top=document.createElement("div");top.className="app-card-top";
      const info=document.createElement("div");const name=document.createElement("div");name.className="app-name";name.textContent=a.name;const username=document.createElement("div");username.className="app-username";username.textContent=a.username||mail.address;info.append(name,username);top.append(info);
      if(a.locked){const tag=document.createElement("span");tag.className="lock-tag";tag.textContent="♙ PIN LOCK";top.append(tag);}
      const pw=document.createElement("div");pw.className="password-line";const value=document.createElement("span");value.className="password-value";value.textContent=a.locked?"Locked":(revealed.has(a.id)?revealed.get(a.id).value:"••••••••••••");if(a.locked)value.classList.add("locked");pw.append(value);
      const actions=document.createElement("div");actions.className="card-actions";
      const reveal=actionButton(revealed.has(a.id)?"Hide":"Reveal",()=>a.locked?askPin(a,"reveal"):toggleReveal(a));const copy=actionButton("Copy",()=>a.locked?askPin(a,"copy"):copyPassword(a));const edit=actionButton("Edit",()=>openAppSheet(a));const del=actionButton("Delete",()=>deleteApp(a),"delete");
      actions.append(reveal,copy,edit,del);card.append(top,pw,actions);list.append(card);
    });
  }
  function actionButton(label,fn,extra=""){const b=document.createElement("button");b.type="button";b.className="action-btn "+extra;b.textContent=label;b.addEventListener("click",fn);return b;}
  function toggleReveal(a){if(revealed.has(a.id)){clearTimeout(revealed.get(a.id).timer);revealed.delete(a.id);}else{const timer=setTimeout(()=>{revealed.delete(a.id);renderApps();},10000);revealed.set(a.id,{value:a.password,timer});}renderApps();}
  async function copyPassword(a){try{await navigator.clipboard.writeText(a.password);toast("Password copied. Clipboard clears in 20 seconds if unchanged.");const copied=a.password;setTimeout(async()=>{try{const current=await navigator.clipboard.readText();if(current===copied)await navigator.clipboard.writeText("");}catch(_){/* Clipboard read permission may be unavailable. */}},20000);}catch(_){toast("Clipboard access unavailable. Use Reveal instead.");}}
  function askPin(a,action){const lock=wrongPins.get(a.id)||{count:0,until:0};if(Date.now()<lock.until){toast(`Please wait ${Math.ceil((lock.until-Date.now())/1000)} seconds before trying again.`);return;}pendingPin=a;pinAction=action;$("pinTitle").textContent=action==="copy"?"Copy protected password":"Unlock application";$("pinDescription").textContent=`Enter the PIN for ${a.name}.`; $("pinInput").value="";$("pinError").textContent="";$("pinModal").classList.remove("hidden");setTimeout(()=>$("pinInput").focus(),50);}
  $("unlockForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const pass=$("masterPass").value;
    $("unlockError").textContent="";
    try{
      const rec=await VaultDB.get();
      if(!rec || !rec.globalLock) throw new Error("No locked vault found.");
      data=await VaultCrypto.decryptVault(rec,pass);
      globalPassphrase=pass;
      $("masterPass").value="";
      showMain();
      toast("Vault unlocked.");
    }catch(_){
      $("unlockError").textContent="Incorrect passphrase or damaged vault.";
      $("masterPass").value="";
    }
  });
  $("pinForm").addEventListener("submit",async e=>{e.preventDefault();if(!pendingPin)return;const pin=$("pinInput").value;if(!/^\d{4,6}$/.test(pin)){$("pinError").textContent="Enter a 4–6 digit PIN.";return;}try{const password=await VaultCrypto.decryptAppPassword(pendingPin.passwordCipher,pin);wrongPins.delete(pendingPin.id);$("pinModal").classList.add("hidden");if(pinAction==="copy"){await copyPassword({...pendingPin,password});}else{const id=pendingPin.id;const timer=setTimeout(()=>{revealed.delete(id);renderApps();},10000);revealed.set(id,{value:password,timer});renderApps();}pendingPin=null;}catch(_){const state=wrongPins.get(pendingPin.id)||{count:0,until:0};state.count++;if(state.count>=5){state.count=0;state.until=Date.now()+30000;$("pinError").textContent="Too many incorrect attempts. Wait 30 seconds.";}else{$("pinError").textContent=`Incorrect PIN. ${5-state.count} attempts remaining.`;}wrongPins.set(pendingPin.id,state);}});
  $("closePinBtn").addEventListener("click",()=>$("pinModal").classList.add("hidden"));
  function openSheet(title,eyebrow,html,mode){sheetMode=mode;$("sheetTitle").textContent=title;$("sheetEyebrow").textContent=eyebrow;$("sheetForm").innerHTML=html;$("sheet").classList.remove("hidden");$("sheetBackdrop").classList.remove("hidden");}
  function closeSheet(){$("sheet").classList.add("hidden");$("sheetBackdrop").classList.add("hidden");sheetMode=null;editingId=null;}
  $("closeSheetBtn").addEventListener("click",closeSheet);$("sheetBackdrop").addEventListener("click",closeSheet);
  function openMailSheet(mail=null){editingId=mail?.id||null;openSheet(mail?"Edit mail":"Add new mail",mail?"UPDATE ENTRY":"NEW EMAIL",`
    <label class="field-label" for="mailAddress">Email address</label><input class="field-input" id="mailAddress" type="email" autocomplete="off" required maxlength="254" placeholder="you@example.com" value="${mail?attr(mail.address):""}">
    <div class="form-actions"><button type="button" class="btn btn-secondary" id="cancelSheet">Cancel</button><button class="btn btn-primary" type="submit">Save mail</button></div>`,"mail");$("cancelSheet").addEventListener("click",closeSheet);}
  function attr(s){return String(s??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function openAppSheet(app=null){editingId=app?.id||null;const mail=data.mails.find(m=>m.id===selectedMail);const lockChecked=app?.locked||false;openSheet(app?"Edit application":"Add new application",app?"UPDATE LOGIN":"NEW LOGIN",`
    <label class="field-label" for="appName">Application name</label><input class="field-input" id="appName" required maxlength="80" autocomplete="off" placeholder="e.g. GitHub" value="${app?attr(app.name):""}">
    <label class="field-label" for="appUsername">Username</label><input class="field-input" id="appUsername" maxlength="254" autocomplete="off" placeholder="${attr(mail.address)}" value="${app?attr(app.username||""):""}">
    <label class="field-label" for="appPassword">Password</label><div class="generator-row"><input class="field-input" id="appPassword" type="password" ${app?.locked?"":"required"} autocomplete="off" maxlength="2048" placeholder="${app?.locked?"Leave blank to keep the protected password":"Enter a strong password"}" value="${app&&!app.locked?attr(app.password):""}"><button type="button" id="generateBtn" class="btn btn-secondary">Generate</button></div>
    <div class="strength"><span id="strengthBar"></span></div><p class="field-hint" id="strengthHint">Password strength appears here.</p>
    <label class="field-label" for="appNote">Note (optional)</label><textarea class="field-input textarea" id="appNote" maxlength="500" placeholder="A reminder for this login...">${app?attr(app.note||""):""}</textarea>
    <label class="check-row"><input id="lockApp" type="checkbox" ${lockChecked?"checked":""}> Lock this app with a separate PIN</label>
    <p class="field-hint" id="lockHint">${app?.locked?"This app is already PIN-encrypted. Keep its current PIN to preserve protection.":""}</p>
    <div class="form-actions"><button type="button" class="btn btn-secondary" id="cancelSheet">Cancel</button><button class="btn btn-primary" type="submit">Save application</button></div>`,"app");$("cancelSheet").addEventListener("click",closeSheet);
    $("appPassword").addEventListener("input",updateStrength);$("generateBtn").addEventListener("click",()=>{$("appPassword").value=generatePassword(20);$("appPassword").type="text";updateStrength();});}
  function updateStrength(){const p=$("appPassword").value;let score=0;if(p.length>=12)score++;if(/[a-z]/.test(p)&&/[A-Z]/.test(p))score++;if(/\d/.test(p))score++;if(/[^A-Za-z0-9]/.test(p))score++;$("strengthBar").style.width=(score*25)+"%";$("strengthHint").textContent=["Very weak","Weak","Fair","Strong","Excellent"][score];}
  function generatePassword(n){const chars="abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+";const random=crypto.getRandomValues(new Uint32Array(n));return Array.from(random,x=>chars[x%chars.length]).join("");}
  $("sheetForm").addEventListener("submit",async e=>{e.preventDefault();try{
    if(sheetMode==="mail"){const address=$("mailAddress").value.trim().toLowerCase();if(!address)return;if(data.mails.some(m=>m.address===address&&m.id!==editingId)){toast("That email is already saved.");return;}if(editingId){data.mails.find(m=>m.id===editingId).address=address;}else data.mails.push({id:uid(),address});await save();closeSheet();renderMails();toast("Email saved.");}
    if(sheetMode==="app"){const name=$("appName").value.trim(),username=$("appUsername").value.trim(),password=$("appPassword").value, note=$("appNote").value.trim(),locked=$("lockApp").checked;if(!name||!password)return;const existing=data.apps.find(a=>a.id===editingId);let record={id:editingId||uid(),mailId:selectedMail,name,username,note,locked};
      if(locked){if(existing?.locked){record.passwordCipher=existing.passwordCipher;if(password!==""&&password!=="••••••••") {const pin=prompt("To replace the protected password, enter its existing 4–6 digit PIN. This temporary prompt is not stored.");if(!pin||!/^\d{4,6}$/.test(pin)){toast("Password unchanged; other details saved.");}else{try{await VaultCrypto.decryptAppPassword(existing.passwordCipher,pin);record.passwordCipher=await VaultCrypto.encryptAppPassword(password,pin);}catch(_){toast("Incorrect PIN; password unchanged.");}}}}else{const pin=prompt("Create a 4–6 digit PIN for this app. If you forget this PIN, this password cannot be recovered.");if(!pin||!/^\d{4,6}$/.test(pin)){toast("A valid 4–6 digit PIN is required.");return;}const confirmPin=prompt("Confirm your app PIN.");if(pin!==confirmPin){toast("PINs did not match.");return;}record.passwordCipher=await VaultCrypto.encryptAppPassword(password,pin);}}
      else {record.password=password;}
      if(existing){Object.assign(existing,record);}else data.apps.push(record);await save();closeSheet();renderApps();toast("Application saved securely.");}
    }catch(err){console.error("Save failed",err);toast("Could not save. Please try again.");}});
  async function deleteApp(a){if(!confirm(`Delete ${a.name} from SpellVault?`))return;const r=revealed.get(a.id);if(r)clearTimeout(r.timer);revealed.delete(a.id);data.apps=data.apps.filter(x=>x.id!==a.id);await save();renderApps();toast("Application deleted.");}
  $("continueBtn").addEventListener("click",async()=>{const rec=await VaultDB.get();if(rec?.globalLock){await load();}else showMain();});
  $("addMailBtn").addEventListener("click",()=>openMailSheet());$("addAppBtn").addEventListener("click",()=>openAppSheet());
  $("mailSearch").addEventListener("input",renderMails);$("appSearch").addEventListener("input",renderApps);
  $("backBtn").addEventListener("click",()=>{if(page==="apps"){selectedMail=null;setPage("mail");}else if(page==="settings"){setPage(selectedMail?"apps":"mail");}});
  $("settingsBtn").addEventListener("click",()=>{if(page!=="settings"){setPage("settings");$("globalLockToggle").checked=!!data.settings.globalLock;}});
  $("brandHome").addEventListener("click",e=>{e.preventDefault();selectedMail=null;setPage("mail");});
  $("globalLockToggle").addEventListener("change",async e=>{const enabled=e.target.checked;if(enabled){const pass=prompt("Create a strong master passphrase (at least 12 characters). If forgotten, your vault cannot be recovered.");if(!pass||pass.length<12){e.target.checked=false;toast("Use a passphrase of at least 12 characters.");return;}const confirmPass=prompt("Confirm your master passphrase.");if(pass!==confirmPass){e.target.checked=false;toast("Passphrases did not match.");return;}globalPassphrase=pass;data.settings.globalLock=true;await save();toast("App Lock enabled.");}else{if(!confirm("Disable App Lock? Your vault data will be stored without global encryption. Continue?")){e.target.checked=true;return;}data.settings.globalLock=false;await save();globalPassphrase=null;toast("App Lock disabled.");}});
  $("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({format:"SpellVaultBackup",version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="spellvault-backup.json";a.click();URL.revokeObjectURL(url);toast("Backup exported. Keep it somewhere safe.");});
  $("importBtn").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(obj.format!=="SpellVaultBackup"||!obj.data||!Array.isArray(obj.data.mails)||!Array.isArray(obj.data.apps))throw new Error("Invalid backup");if(!confirm("Import this backup? Existing vault entries will be replaced."))return;data=obj.data;data.settings=data.settings||{globalLock:false};globalPassphrase=null;await save();setPage("mail");toast("Backup restored.");}catch(_){toast("This backup file is invalid or unsupported.");}finally{e.target.value="";}});
  $("clearDataBtn").addEventListener("click",async()=>{if(!confirm("Permanently delete ALL SpellVault data from this browser? This cannot be undone. Export a backup first if needed."))return;if(!confirm("Final confirmation: delete all emails, apps and settings?"))return;await VaultDB.clear();data=emptyData();globalPassphrase=null;selectedMail=null;await save();setPage("mail");toast("All vault data cleared.");});
  document.addEventListener("visibilitychange",()=>{if(document.hidden)hideAll();});
  window.addEventListener("pagehide",hideAll);
  if("serviceWorker" in navigator && (location.protocol==="https:"||location.hostname==="localhost")){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));}
  load().catch(err=>{console.error("Startup error",err);toast("Unable to open local vault.");});
})();