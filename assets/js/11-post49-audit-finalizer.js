/* Haydar Pack V53.2 - Post V49 Audit Finalizer
   Purpose: verify and preserve V49.1/V50/V51/V52/V53 features, force final reports order,
   and expose a visible self-check so missing modules do not stay hidden. */
(function(){
  'use strict';
  var VERSION='53.2.0-post49-audit-rebuild';
  var SITE_VERSION='53_2postaudit';
  var REPORT_AUDIT_ID='hp-v532-post49-audit-strip';
  var MODULES=[
    {key:'save',label:'V49.1 حماية الحفظ',global:'HP_V501_SAVE_GUARD',alt:'HP_V49_1_SAVE_GUARD'},
    {key:'backup',label:'V50 Backup Pro',global:'HP_V50_BACKUP_PRO'},
    {key:'mobile',label:'V51 Mobile UX',global:'HP_V51_MOBILE_UX',alt:'HP_V52_MOBILE_UX'},
    {key:'reports',label:'V52 Reports Pro',global:'HP_V52_REPORTS_PRO'},
    {key:'finance',label:'V53 Finance Insights',global:'HP_V53_FINANCE'}
  ];
  function byId(id){return document.getElementById(id)}
  function has(m){return !!(window[m.global]||(m.alt&&window[m.alt]))}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function log(type,msg,extra){try{if(window.HP_V50_STABILITY&&HP_V50_STABILITY.log)HP_V50_STABILITY.log(type,msg,extra||'V53.2')}catch(e){}}
  function aliasModules(){
    try{if(window.HP_V501_SAVE_GUARD&&!window.HP_V49_1_SAVE_GUARD)window.HP_V49_1_SAVE_GUARD=window.HP_V501_SAVE_GUARD}catch(e){}
    try{if(window.HP_V52_MOBILE_UX&&!window.HP_V51_MOBILE_UX)window.HP_V51_MOBILE_UX=window.HP_V52_MOBILE_UX}catch(e){}
  }
  function moduleStatus(){aliasModules();return MODULES.map(function(m){return {key:m.key,label:m.label,ok:has(m)}})}
  function auditHtml(){
    var rows=moduleStatus();
    var ok=rows.every(function(r){return r.ok});
    return '<div id="'+REPORT_AUDIT_ID+'" class="hp-v532-audit '+(ok?'ok':'bad')+'">'
      +'<div><b>مراجعة ما بعد V49 — V53.2</b><small>تأكيد تحميل كل التطويرات: V49.1 + V50 + V51 + V52 + V53</small></div>'
      +'<div class="hp-v532-audit-items">'+rows.map(function(r){return '<span class="'+(r.ok?'ok':'bad')+'">'+(r.ok?'✓':'!')+' '+esc(r.label)+'</span>'}).join('')+'</div>'
      +'</div>';
  }
  function ensureStyle(){
    if(byId('hp-v532-audit-style'))return;
    var st=document.createElement('style');st.id='hp-v532-audit-style';
    st.textContent='\n#hp-v532-post49-audit-strip{margin:0 0 14px 0;padding:12px 14px;border:3px solid #0f5f2f;border-radius:18px;background:#e9fff1;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;direction:rtl;font-weight:900}\n#hp-v532-post49-audit-strip.bad{border-color:#b91c1c;background:#fff1f1}\n#hp-v532-post49-audit-strip small{display:block;color:#475569;margin-top:4px;font-weight:800}\n.hp-v532-audit-items{display:flex;gap:8px;flex-wrap:wrap}.hp-v532-audit-items span{border:2px solid #d0d7e2;border-radius:999px;padding:7px 10px;background:#fff}.hp-v532-audit-items span.ok{border-color:#15803d;color:#166534}.hp-v532-audit-items span.bad{border-color:#b91c1c;color:#b91c1c}\n@media(max-width:700px){#hp-v532-post49-audit-strip{font-size:13px}.hp-v532-audit-items span{padding:6px 8px}}\n';
    document.head.appendChild(st);
  }
  function placeAuditStrip(){
    ensureStyle();
    var reports=byId('pg-reports'); if(!reports)return;
    var old=byId(REPORT_AUDIT_ID); if(old)old.remove();
    var holder=document.createElement('div');holder.innerHTML=auditHtml();
    reports.insertBefore(holder.firstChild,reports.firstChild);
  }
  function forceReportsOrder(){
    var reports=byId('pg-reports'); if(!reports)return;
    try{if(window.HP_V52_REPORTS_PRO&&typeof HP_V52_REPORTS_PRO.render==='function')HP_V52_REPORTS_PRO.render()}catch(e){log('V53_2_V52_RENDER_ERROR',String(e&&e.message||e));}
    try{if(window.HP_V53_FINANCE&&typeof HP_V53_FINANCE.refresh==='function')HP_V53_FINANCE.refresh()}catch(e){log('V53_2_FINANCE_RENDER_ERROR',String(e&&e.message||e));}
    var v53=byId('hp-v53-finance-insights'), v52=byId('hp-v52-reports-pro'), strip=byId(REPORT_AUDIT_ID);
    if(v53&&v52&&v53.compareDocumentPosition(v52)&Node.DOCUMENT_POSITION_PRECEDING){reports.insertBefore(v53,v52)}
    if(strip&&strip.parentNode===reports)reports.insertBefore(strip,reports.firstChild);
    if(!v53){
      var box=document.createElement('div');box.id='hp-v53-finance-insights';box.className='hp-v53-wrap';
      box.innerHTML='<div class="hp-v53-head"><div><div class="sec-label">Reports Pro V53</div><h2>تحليل التحصيل والكاش فلو</h2><p>لم يتم تحميل قسم V53. اضغط تحديث أو امسح كاش الصفحة.</p></div><div><button class="btn small blue" onclick="location.reload()">إعادة تحميل</button></div></div>';
      reports.insertBefore(box, v52||reports.firstChild);
      log('V53_2_FINANCE_MISSING','HP_V53_FINANCE root missing after render');
    }
  }
  function finalRenderReports(){
    try{if(typeof window.__hpV532BaseReports==='function')window.__hpV532BaseReports.apply(this,arguments)}catch(e){log('V53_2_BASE_REPORTS_ERROR',String(e&&e.message||e));}
    try{placeAuditStrip();forceReportsOrder()}catch(e){log('V53_2_FINAL_REPORTS_ERROR',String(e&&e.message||e));}
  }
  function hookReports(){
    if(window.__HP_V532_AUDIT_HOOKED)return; window.__HP_V532_AUDIT_HOOKED=true;
    aliasModules();
    window.__hpV532BaseReports=window.renderReports;
    window.renderReports=finalRenderReports;
    setTimeout(function(){try{if((window.activePage||'')==='reports')window.renderReports()}catch(e){}},250);
    setTimeout(function(){try{if((window.activePage||'')==='reports')window.renderReports()}catch(e){}},900);
    setTimeout(function(){try{if((window.activePage||'')==='reports')window.renderReports()}catch(e){}},1800);
  }
  function verify(){var s=moduleStatus();return {version:VERSION,siteVersion:SITE_VERSION,modules:s,ok:s.every(function(x){return x.ok})};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hookReports);else hookReports();
  window.HP_POST49_AUDIT={version:VERSION,siteVersion:SITE_VERSION,verify:verify,renderReports:finalRenderReports,forceReportsOrder:forceReportsOrder};
})();
