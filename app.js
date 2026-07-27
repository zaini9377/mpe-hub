(function(){
  "use strict";
  const config=window.MPE_CONFIG||{};
  const pages=["dashboard","logbook","asset","mccb"];
  const titles={dashboard:"Dashboard",logbook:"Buku Log Makmal",asset:"Borang KEW.PA-9",mccb:"MCCB Test Report"};
  const demoSummary={logbook:18,assets:4,passRate:96,actions:2,total:24,logToday:3,recent:[
    {module:"logbook",title:"Kalibrasi alat pengujian",meta:"Makmal Elektrik · 09:42",status:"Lengkap"},
    {module:"asset",title:"Pinjaman Power Clamp Meter",meta:"MPE-EL-024 · Semalam",status:"Dipinjam"},
    {module:"mccb",title:"MCCB 100A · Schneider",meta:"TR-2026-041 · 14 Jul",status:"Lulus"}
  ]};
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const isConnected=()=>Boolean(config.GOOGLE_SCRIPT_URL&&/^https:\/\/script\.google\.com\/.+\/exec/.test(config.GOOGLE_SCRIPT_URL));

  function init(){
    setDateDefaults(); buildAssetRow(); buildEquipment(); buildReadings(); bindNavigation(); bindDialogs(); bindForms(); bindCalculations(); updateConnectionUI();
    route(location.hash.slice(1)||"dashboard",false);
    if(isConnected()){renderLoadingSummary();loadDashboard();}else renderSummary(demoSummary);
  }
  function setDateDefaults(){
    const now=new Date(); const date=now.toISOString().slice(0,10); const time=now.toTimeString().slice(0,5);
    $("#today-date").textContent=new Intl.DateTimeFormat("ms-MY",{day:"2-digit",month:"short",year:"numeric"}).format(now);
    $$('[data-today]').forEach(el=>el.value=date); $$('[data-now]').forEach(el=>el.value=time); $$('[data-autono]').forEach(el=>el.value=`${el.dataset.autono}-${now.getFullYear()}-${String(Date.now()).slice(-5)}`);
  }
  function bindNavigation(){
    $$('[data-route]').forEach(el=>el.addEventListener("click",e=>{e.preventDefault();route(el.dataset.route);}));
    window.addEventListener("hashchange",()=>route(location.hash.slice(1),false));
  }
  function route(name,push=true){
    if(!pages.includes(name))name="dashboard";
    $$('[data-page]').forEach(p=>p.classList.toggle("active",p.dataset.page===name));
    $$('[data-route]').forEach(n=>n.classList.toggle("active",n.dataset.route===name));
    $("#page-title").textContent=titles[name]; if(push)history.pushState(null,"",`#${name}`); window.scrollTo({top:0,behavior:"smooth"});
  }
  function bindDialogs(){
    const dialog=$("#setup-dialog"); $$('[data-open-setup]').forEach(b=>b.addEventListener("click",()=>dialog.showModal())); $$('[data-close-dialog]').forEach(b=>b.addEventListener("click",()=>dialog.close()));
    dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
  }
  function updateConnectionUI(){
    const connected=isConnected(); $("#connection-banner").hidden=connected; $("#sync-label").textContent=connected?"Drive disambungkan":"Mod demo"; $("#sync-detail").textContent=connected?"Penyegerakan aktif":"Google Drive belum disambung"; $(".status-dot").style.background=connected?"var(--lime)":"var(--orange)"; $("#configured-url").textContent=connected?config.GOOGLE_SCRIPT_URL:"Belum ditetapkan";
  }
  function buildAssetRow(){
    const host=$("#asset-items"); const n=host.children.length+1; const row=document.createElement("div"); row.className="repeater-row"; row.innerHTML=`<span class="row-num">${String(n).padStart(2,"0")}</span><label class="field"><span>No. siri pendaftaran *</span><input name="assetSiri[]" required placeholder="MPE/EL/001"></label><label class="field"><span>Keterangan aset *</span><input name="assetNama[]" required placeholder="Nama / model aset"></label><label class="field"><span>Tarikh dipinjam *</span><input type="date" name="assetTarikhPinjam[]" required data-today></label><label class="field"><span>Tarikh dijangka pulang *</span><input type="date" name="assetTarikhPulang[]" required></label><button type="button" class="remove-row" aria-label="Buang aset">×</button>`; host.appendChild(row); setDateDefaults(); row.querySelector(".remove-row").addEventListener("click",()=>{if(host.children.length>1){row.remove();renumberRows();}else showToast("Sekurang-kurangnya satu aset diperlukan.",true);});
  }
  function renumberRows(){ $$(".repeater-row .row-num").forEach((el,i)=>el.textContent=String(i+1).padStart(2,"0")); }
  function buildEquipment(){
    const names=["Circuit Breaker Test Set","Digital Thermohygrometer","Power Clamp Meter","Torque Wrench / Driver","Digital Stop Watch / Timer"];
    $("#equipment-list").innerHTML=names.map((name,i)=>`<div class="equipment-row"><strong>${name}</strong><input name="equipmentId_${i}" placeholder="Jenama / Model / ID"><select name="calibration_${i}"><option>Yes</option><option>No</option><option>-</option></select><select name="functionality_${i}"><option>Yes</option><option>No</option></select></div>`).join("");
  }
  function buildReadings(){
    const times=["0 min","+20 min","+40 min","+60 min","+80 min","+100 min","+120 min"];
    $("#reading-grid").innerHTML=times.map((t,i)=>`<label><span>${t}</span><input type="number" step="0.01" name="reading_${i}" aria-label="Bacaan ${t}"></label>`).join("");
  }
  function bindCalculations(){
    const form=$("#mccb-form"); [form.elements.ratedCurrent,form.elements.tcd].forEach(el=>el.addEventListener("input",()=>{const b=(Number(form.elements.ratedCurrent.value)||0)*(Number(form.elements.tcd.value)||0);$("#rated-at-test").textContent=`${b.toFixed(2)} A`;$("#test-105").textContent=`${(b*1.05).toFixed(2)} A`;$("#test-130").textContent=`${(b*1.3).toFixed(2)} A`;}));
  }
  function bindForms(){
    $("#add-asset").addEventListener("click",buildAssetRow); $("#refresh-dashboard").addEventListener("click",loadDashboard);
    $$("form[data-module]").forEach(form=>form.addEventListener("submit",handleSubmit));
  }
  async function handleSubmit(event){
    event.preventDefault(); const form=event.currentTarget;
    if(!isConnected()){showToast("Sambungkan Google Drive dahulu melalui Tetapan Integrasi.",true);$("#setup-dialog").showModal();return;}
    const submit=form.querySelector('[type="submit"]'); const original=submit.innerHTML; submit.disabled=true; submit.textContent="Menyimpan...";
    try{const data=await serializeForm(form); const result=await api({action:"save",module:form.dataset.module,data}); if(!result.ok)throw new Error(result.error||"Rekod gagal disimpan"); showToast(`Rekod berjaya disimpan · ${result.recordId||""}`); form.reset(); setDateDefaults(); if(form.id==="asset-form"){$("#asset-items").innerHTML="";buildAssetRow();} await loadDashboard(); route("dashboard");}
    catch(error){showToast(error.message||"Ralat sambungan. Cuba lagi.",true);}finally{submit.disabled=false;submit.innerHTML=original;}
  }
  async function serializeForm(form){
    const fd=new FormData(form),data={};
    for(const [key,value] of fd.entries()){
      if(value instanceof File){if(!value.size)continue;if(value.size>5*1024*1024)throw new Error("Saiz lampiran melebihi 5 MB.");data[key]=await fileToPayload(value);continue;}
      const cleanKey=key.replace("[]",""); if(key.endsWith("[]")){(data[cleanKey]??=[]).push(value);}else data[cleanKey]=value;
    }
    $$('input[type="checkbox"]',form).forEach(el=>data[el.name]=el.checked);
    if(form.dataset.module==="asset")data.items=(data.assetSiri||[]).map((siri,i)=>({siri,keterangan:data.assetNama?.[i]||"",tarikhPinjam:data.assetTarikhPinjam?.[i]||"",tarikhPulang:data.assetTarikhPulang?.[i]||""}));
    if(form.dataset.module==="mccb"){data.equipment=[0,1,2,3,4].map(i=>({id:data[`equipmentId_${i}`]||"",calibration:data[`calibration_${i}`],functionality:data[`functionality_${i}`]}));data.readings=[0,1,2,3,4,5,6].map(i=>data[`reading_${i}`]||"");}
    return data;
  }
  function fileToPayload(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve({name:file.name,type:file.type,data:String(r.result).split(",")[1]});r.onerror=reject;r.readAsDataURL(file);});}
  async function api(payload){
    const response=await fetch(config.GOOGLE_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow"}); if(!response.ok)throw new Error(`Ralat rangkaian (${response.status})`); return response.json();
  }
  async function loadDashboard(){
    if(!isConnected()){renderSummary(demoSummary);return;} const button=$("#refresh-dashboard");button.disabled=true;button.textContent="Menyegar...";
    try{const result=await api({action:"dashboard"});if(!result.ok)throw new Error(result.error);renderSummary(result.summary);}catch(error){renderUnavailableSummary();showToast("Dashboard tidak dapat disegerakkan.",true);}finally{button.disabled=false;button.textContent="Segar semula";}
  }
  function renderLoadingSummary(){
    setSummaryValues("—");
    $("#dashboard").setAttribute("aria-busy","true");
    $("#activity-list").innerHTML=`<div class="empty-state"><strong>Memuatkan data terkini...</strong><small>Sila tunggu sementara Drive disegerakkan.</small></div>`;
  }
  function renderUnavailableSummary(){
    setSummaryValues("—");
    $("#dashboard").setAttribute("aria-busy","false");
    $("#activity-list").innerHTML=`<div class="empty-state"><strong>Data tidak tersedia</strong><small>Gunakan butang Segar semula untuk mencuba lagi.</small></div>`;
  }
  function setSummaryValues(value){
    ["#metric-logbook","#metric-assets","#metric-tests","#metric-actions","#hero-count","#log-today","#asset-active","#test-rate"].forEach(selector=>$(selector).textContent=value);
  }
  function renderSummary(s){
    $("#dashboard").setAttribute("aria-busy","false");
    $("#metric-logbook").textContent=s.logbook??0;$("#metric-assets").textContent=s.assets??0;$("#metric-tests").textContent=`${s.passRate??0}%`;$("#metric-actions").textContent=s.actions??0;$("#hero-count").textContent=s.total??0;$("#log-today").textContent=String(s.logToday??0).padStart(2,"0");$("#asset-active").textContent=String(s.assets??0).padStart(2,"0");$("#test-rate").textContent=`${s.passRate??0}%`;
    $("#activity-list").innerHTML=s.recent?.length?s.recent.map(item=>{const type=item.module==="asset"?"PA9":item.module==="mccb"?"TEST":"LOG";const klass=item.module==="asset"?"type-asset":item.module==="mccb"?"type-test":"type-log";const badge=statusClass(item.status);return `<div class="activity-row"><span class="activity-type ${klass}">${type}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta||"")}</small></div><span class="badge ${badge}">${escapeHtml(statusLabel(item.status))}</span></div>`;}).join(""):`<div class="empty-state"><strong>Belum ada rekod</strong><small>Aktiviti pertama anda akan dipaparkan di sini.</small></div>`;
  }
  function statusLabel(status){return /^pass$/i.test(String(status||"").trim())?"Lulus":status||"";}
  function statusClass(status){
    const value=String(status||"").trim().toLowerCase();
    if(["pass","lulus","lengkap","dipulangkan"].includes(value))return "success";
    if(["fail","gagal","tidak lulus","tidak lengkap"].includes(value))return "danger";
    return "warning";
  }
  function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v);return d.innerHTML;}
  function showToast(message,isError=false){const toast=$("#toast");toast.textContent=message;toast.className=`toast show${isError?" error":""}`;clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.className="toast",3600);}
  document.addEventListener("DOMContentLoaded",init);
})();
