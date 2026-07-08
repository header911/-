/* Haydar Pack V54 - Post V49 Audit + Backend Link Settings
   Final frontend tester: verifies post-V49 modules through V54, forces reports order, injects Apps Script /exec editor in sync screen. */
(function(){
  'use strict';
  var VERSION='54.0.0-documents-pro';
  var SITE_VERSION='54docspro';
  var REPORT_AUDIT_ID='hp-v533-post49-audit-strip';
  var BACKEND_PANEL_ID='hp-v533-backend-panel';
  var URL_KEY='hayder_pack_stage4_backend_url_v32';
  var OLD_URL_KEY='hayder_pack_backend_url_v10';
  var DEFAULT_URL=(typeof window.HP_APPS_SCRIPT_URL==='string'&&window.HP_APPS_SCRIPT_URL)||'https://script.google.com/macros/s/AKfycbw0RxMaw2gNicQjSD5T3LHhd-6d2DnABYKGNNMDD1NN3b09wJL3OatLviAn7xqDu2Zq6w/exec';
  var MODULES=[
    {key:'save',label:'V49.1 حماية الحفظ',global:'HP_V501_SAVE_GUARD',alt:'HP_V49_1_SAVE_GUARD'},
    {key:'backup',label:'V50 Backup Pro',global:'HP_V50_BACKUP_PRO'},
    {key:'mobile',label:'V51/V53.3 Mobile Back',global:'HP_V51_MOBILE_UX',alt:'HP_V52_MOBILE_UX'},
    {key:'reports',label:'V52 Reports Pro',global:'HP_V52_REPORTS_PRO'},
    {key:'finance',label:'V53.3 Finance Actions',global:'HP_V53_FINANCE'},
    {key:'documents',label:'V54 Documents Pro',global:'HP_V54_DOCS'}
  ];
  function byId(id){return document.getElementById(id)}
  function q(sel,root){return (root||document).querySelector(sel)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function toastSafe(msg){try{if(typeof window.toast==='function')window.toast(msg);else console.log(msg)}catch(e){}}
  function log(type,msg,extra){try{if(window.HP_V50_STABILITY&&HP_V50_STABILITY.log)HP_V50_STABILITY.log(type,msg,extra||'V54')}catch(e){}}
  function has(m){return !!(window[m.global]||(m.alt&&window[m.alt]))}
  function aliasModules(){try{if(window.HP_V501_SAVE_GUARD&&!window.HP_V49_1_SAVE_GUARD)window.HP_V49_1_SAVE_GUARD=window.HP_V501_SAVE_GUARD}catch(e){} try{if(window.HP_V52_MOBILE_UX&&!window.HP_V51_MOBILE_UX)window.HP_V51_MOBILE_UX=window.HP_V52_MOBILE_UX}catch(e){}}
  function moduleStatus(){aliasModules();return MODULES.map(function(m){return {key:m.key,label:m.label,ok:has(m)}})}
  function normalizeUrl(url){url=String(url||'').trim().replace(/\s+/g,'').replace(/[?#].*$/,'').replace(/\/+$/,''); var m=url.match(/^(https:\/\/script\.google\.com\/macros\/s\/[^\/]+)(?:\/(exec|dev))?$/); return m?m[1]+'/exec':''}
  function currentBackend(){var u=''; try{u=localStorage.getItem(URL_KEY)||localStorage.getItem(OLD_URL_KEY)||''}catch(e){} u=normalizeUrl(u)||normalizeUrl(window.HP_APPS_SCRIPT_URL)||normalizeUrl(DEFAULT_URL); try{localStorage.setItem(URL_KEY,u);localStorage.setItem(OLD_URL_KEY,u)}catch(e){} window.HP_APPS_SCRIPT_URL=u; return u}
  function setBackend(url){url=normalizeUrl(url); if(!url){toastSafe('رابط Apps Script غير صحيح. لازم يكون رابط /exec');return false} try{localStorage.setItem(URL_KEY,url);localStorage.setItem(OLD_URL_KEY,url)}catch(e){} window.HP_APPS_SCRIPT_URL=url; toastSafe('تم حفظ رابط Apps Script الجديد على هذا الجهاز'); injectBackendPanel(true); return true}
  function resetBackend(){if(!confirm('ترجع رابط Apps Script الافتراضي؟'))return; setBackend(DEFAULT_URL)}
  function saveBackendFromInput(){var inp=byId('hp-v533-backend-url'); if(!inp)return; if(confirm('سيتم تغيير رابط Apps Script المستخدم للمزامنة على هذا الجهاز. تأكد أنك عملت Deploy صحيح. تكمل؟'))setBackend(inp.value)}
  function testBackend(){currentBackend(); var line=byId('hp-v533-backend-test'); if(line)line.textContent='جاري اختبار الاتصال...'; try{if(window.HP_V37_SYNC&&typeof HP_V37_SYNC.checkMeta==='function'){HP_V37_SYNC.checkMeta(true).then(function(res){if(line)line.textContent=res?'تم الاتصال بنجاح أو تم قراءة الحالة.':'لم يصل رد واضح، راجع الرابط أو الصلاحيات.'}).catch(function(e){if(line)line.textContent=e.message||'فشل الاختبار'});return}}catch(e){} if(line)line.textContent='تعذر تشغيل اختبار المزامنة الآن، لكن الرابط محفوظ.'}
  function injectStyle(){if(byId('hp-v533-style'))return; var st=document.createElement('style'); st.id='hp-v533-style'; st.textContent='\n#'+REPORT_AUDIT_ID+'{margin:0 0 14px 0;padding:12px 14px;border:3px solid #0f5f2f;border-radius:18px;background:#e9fff1;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;direction:rtl;font-weight:900}\n#'+REPORT_AUDIT_ID+'.bad{border-color:#b91c1c;background:#fff1f1}\n#'+REPORT_AUDIT_ID+' small{display:block;color:#475569;margin-top:4px;font-weight:800}.hp-v533-audit-items{display:flex;gap:8px;flex-wrap:wrap}.hp-v533-audit-items span{border:2px solid #d0d7e2;border-radius:999px;padding:7px 10px;background:#fff}.hp-v533-audit-items span.ok{border-color:#15803d;color:#166534}.hp-v533-audit-items span.bad{border-color:#b91c1c;color:#b91c1c}\n#'+BACKEND_PANEL_ID+'{border:4px solid #000;border-radius:18px;background:#fff7d8;padding:14px;margin:12px 0;box-shadow:0 3px 0 #000;direction:rtl}#'+BACKEND_PANEL_ID+' h3{margin:0 0 6px;font-size:20px}#'+BACKEND_PANEL_ID+' input{width:100%;direction:ltr;text-align:left;border:3px solid #000;border-radius:14px;padding:10px;font-weight:800;font-family:monospace;box-sizing:border-box;background:#fff}#hp-v533-backend-test{font-weight:900;margin-top:8px;color:#334155}\n.hp-v53-alert{border:3px solid #000;border-radius:16px;padding:10px;margin:8px 0;background:#fff;display:grid;gap:4px}.hp-v53-alert b{font-size:17px}.hp-v53-alert.good{border-color:#15803d;background:#edfff2}.hp-v53-alert.warn{border-color:#a16207;background:#fff7d6}.hp-v53-alert.bad{border-color:#b91c1c;background:#fff1f1}\n@media(max-width:700px){#'+REPORT_AUDIT_ID+'{font-size:13px}.hp-v533-audit-items span{padding:6px 8px}}\n'; document.head.appendChild(st)}
  function auditHtml(){var rows=moduleStatus(), ok=rows.every(function(r){return r.ok}); return '<div id="'+REPORT_AUDIT_ID+'" class="'+(ok?'ok':'bad')+'"><div><b>فحص نسخة V54</b><small>تأكيد وجود كل ما بعد V49 حتى Documents Pro بدون مسح القديم</small></div><div class="hp-v533-audit-items">'+rows.map(function(r){return '<span class="'+(r.ok?'ok':'bad')+'">'+(r.ok?'✓':'!')+' '+esc(r.label)+'</span>'}).join('')+'</div></div>'}
  function placeAuditStrip(){injectStyle(); var reports=byId('pg-reports'); if(!reports)return; var old=byId(REPORT_AUDIT_ID); if(old)old.remove(); var holder=document.createElement('div');holder.innerHTML=auditHtml(); reports.insertBefore(holder.firstChild,reports.firstChild)}
  function forceReportsOrder(){
    var reports=byId('pg-reports'); if(!reports)return;
    try{if(window.HP_V52_REPORTS_PRO&&typeof HP_V52_REPORTS_PRO.render==='function')HP_V52_REPORTS_PRO.render()}catch(e){log('V53_3_V52_RENDER_ERROR',String(e&&e.message||e))}
    try{if(window.HP_V53_FINANCE&&typeof HP_V53_FINANCE.refresh==='function')HP_V53_FINANCE.refresh()}catch(e){log('V53_3_FINANCE_RENDER_ERROR',String(e&&e.message||e))}
    var v53=byId('hp-v53-finance-insights'), v52=byId('hp-v52-reports-pro'), strip=byId(REPORT_AUDIT_ID);
    if(v53&&v52&&v52.parentNode===reports)reports.insertBefore(v53,v52);
    if(strip&&strip.parentNode===reports)reports.insertBefore(strip,reports.firstChild);
    if(!v53){var box=document.createElement('div');box.id='hp-v53-finance-insights';box.className='hp-v53-wrap';box.innerHTML='<div class="hp-v53-head"><div><div class="sec-label">Reports Pro V53.3</div><h2>قسم V53 لم يتحمل</h2><p>لو ظهرت الرسالة دي، ارفع ملفات V53.3 كاملة وافتح الرابط الجديد.</p></div><div><button class="btn small blue" onclick="location.reload()">إعادة تحميل</button></div></div>';reports.insertBefore(box,v52||reports.firstChild);log('V53_3_FINANCE_MISSING','HP_V53_FINANCE root missing after render')}
  }
  function finalRenderReports(){try{if(typeof window.__hpV533BaseReports==='function')window.__hpV533BaseReports.apply(this,arguments)}catch(e){log('V53_3_BASE_REPORTS_ERROR',String(e&&e.message||e))} try{placeAuditStrip();forceReportsOrder()}catch(e){log('V53_3_FINAL_REPORTS_ERROR',String(e&&e.message||e))}}
  function injectBackendPanel(force){
    injectStyle(); var drawer=q('#dr-sync .drawer')||q('#dr-settings .drawer'); if(!drawer)return; var old=byId(BACKEND_PANEL_ID); if(old)old.remove();
    var div=document.createElement('div'); div.id=BACKEND_PANEL_ID;
    var url=currentBackend();
    div.innerHTML='<h3>تغيير رابط Apps Script من البرنامج</h3><div style="font-weight:900;margin-bottom:8px">استخدمه فقط لو عملت Apps Script جديد أو Deploy جديد. هذا يغير رابط المزامنة على هذا الجهاز فقط.</div><input id="hp-v533-backend-url" value="'+esc(url)+'" placeholder="https://script.google.com/macros/s/.../exec"><div class="btn-row" style="margin-top:10px"><button class="btn blue" onclick="HP_V53_3_FINAL.saveBackendUrl()">حفظ الرابط</button><button class="btn green" onclick="HP_V53_3_FINAL.testBackendUrl()">اختبار الاتصال</button><button class="btn" onclick="HP_V53_3_FINAL.resetBackendUrl()">رجوع للافتراضي</button></div><div id="hp-v533-backend-test">الرابط الحالي محفوظ محليًا وسيستخدم في المزامنة والنسخ الاحتياطي.</div>';
    var anchor=byId('hp-v41-sync-ui')||byId('hp-v37-sync-panel')||drawer.children[2];
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(div,anchor.nextSibling); else drawer.insertBefore(div,drawer.firstChild);
    if(force){var inp=byId('hp-v533-backend-url'); if(inp)inp.focus()}
  }
  function hookOpenSync(){var old=window.openSync; if(typeof old==='function'&&!old.__hpV533Backend){var w=function(){var r=old.apply(this,arguments); setTimeout(function(){injectBackendPanel(false)},260); setTimeout(function(){injectBackendPanel(false)},900); return r}; w.__hpV533Backend=true; w.__hpOriginal=old; window.openSync=w}}
  function hookReports(){if(window.__HP_V533_AUDIT_HOOKED)return; window.__HP_V533_AUDIT_HOOKED=true; aliasModules(); window.__hpV533BaseReports=window.renderReports; window.renderReports=finalRenderReports; setTimeout(function(){try{if((window.activePage||'')==='reports')window.renderReports()}catch(e){}},250); setTimeout(function(){try{if((window.activePage||'')==='reports')window.renderReports()}catch(e){}},900); setTimeout(function(){try{if((window.activePage||'')==='reports')window.renderReports()}catch(e){}},1800)}
  function boot(){injectStyle();hookOpenSync();hookReports();setTimeout(function(){try{if(q('#dr-sync.open .drawer'))injectBackendPanel(false)}catch(e){}},1000)}
  function verify(){var s=moduleStatus();return {version:VERSION,siteVersion:SITE_VERSION,modules:s,ok:s.every(function(x){return x.ok}),backendUrl:currentBackend()}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.HP_V53_3_FINAL={version:VERSION,siteVersion:SITE_VERSION,verify:verify,renderReports:finalRenderReports,forceReportsOrder:forceReportsOrder,backendUrl:currentBackend,saveBackendUrl:saveBackendFromInput,resetBackendUrl:resetBackend,testBackendUrl:testBackend,injectBackendPanel:injectBackendPanel};
  window.HP_POST49_AUDIT=window.HP_V53_3_FINAL;
})();
