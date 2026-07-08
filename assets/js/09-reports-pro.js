/* Haydar Pack V52 - Reports Pro
   GitHub-only upgrade. Adds advanced management reports without changing data or Apps Script. */
(function(){
  'use strict';
  var VERSION='52.0.0-reports-pro';
  var SITE_VERSION='53financeinsights';
  var ROOT_ID='hp-v52-reports-pro';

  function byId(id){return document.getElementById(id)}
  function arr(name){return (window.DB && Array.isArray(DB[name])) ? DB[name] : []}
  function n(v){var x=parseFloat(v);return isNaN(x)?0:x}
  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})
  }
  function money(v){
    try{return n(v).toLocaleString('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2})+' ج'}catch(e){return String(n(v))+' ج'}
  }
  function count(v){
    try{return n(v).toLocaleString('ar-EG',{maximumFractionDigits:0})}catch(e){return String(n(v))}
  }
  function dateOf(o){return String((o&&o.date)||'')}
  function monthOf(o){var d=dateOf(o); return /^\d{4}-\d{2}/.test(d)?d.slice(0,7):''}
  function monthLabel(m){
    if(!m)return 'بدون تاريخ';
    var p=m.split('-'); return p.length===2 ? p[1]+'/'+p[0] : m;
  }
  function safeDateMatch(date,period,month){
    try{if(typeof window.dateMatches==='function')return window.dateMatches(date,period,month)}catch(e){}
    if(!date)return period==='all' || !period;
    if(period==='month')return String(date).slice(0,7)===(month||'');
    return true;
  }
  function activePeriod(){return window.repPeriod || 'all'}
  function activeMonth(){return window.selRepMonth || latestMonth()}
  function latestMonth(){
    var ms={}; arr('orders').forEach(function(o){var m=monthOf(o); if(m)ms[m]=1});
    var keys=Object.keys(ms).sort(); return keys.length?keys[keys.length-1]:(new Date().toISOString().slice(0,7));
  }
  function filteredOrders(){
    var p=activePeriod(), m=activeMonth();
    return arr('orders').filter(function(o){return safeDateMatch(o.date,p,m)})
  }
  function filteredExpenses(){
    var p=activePeriod(), m=activeMonth();
    return arr('expenses').filter(function(e){return safeDateMatch(e.date,p,m)})
  }
  function filteredPayments(){
    var p=activePeriod(), m=activeMonth();
    return arr('payments').filter(function(e){return safeDateMatch(e.date,p,m)})
  }
  function filteredTransfers(){
    var p=activePeriod(), m=activeMonth();
    return arr('transfers').filter(function(e){return safeDateMatch(e.date,p,m)})
  }
  function calc(){return window.HP_CALC||{}}
  function orderClient(o){
    try{if(calc().clientNetForOrder)return calc().clientNetForOrder(o)}catch(e){}
    try{if(typeof window.clientTotalForOrder==='function')return window.clientTotalForOrder(o)}catch(e){}
    var qty=n(o&&o.fQty)>0?n(o.fQty):n(o&&o.qty); return Math.max(0,qty*n(o&&o.price)+n(o&&o.aklashe)-n(o&&o.discount)-n(o&&o.invoiceDiscount));
  }
  function orderFactory(o){
    try{if(calc().factoryTotalForOrder)return calc().factoryTotalForOrder(o)}catch(e){}
    try{if(typeof window.factoryTotalForOrder==='function')return window.factoryTotalForOrder(o)}catch(e){}
    return n(o&&o.fQty)*n(o&&o.fPrice)+n(o&&o.fAk);
  }
  function orderExp(orderId){
    try{if(calc().orderExpenseTotal)return calc().orderExpenseTotal(orderId)}catch(e){}
    return arr('expenses').filter(function(e){return e.orderId===orderId}).reduce(function(s,e){return s+n(e.amount)},0)
  }
  function orderProfit(o){
    try{if(calc().profitForOrder)return calc().profitForOrder(o)}catch(e){}
    try{if(typeof window.profitForOrder==='function')return window.profitForOrder(o)}catch(e){}
    return orderClient(o)-orderFactory(o)-orderExp(o&&o.id);
  }
  function clientName(id){var c=arr('clients').find(function(x){return x.id===id}); return c?c.name:'؟'}
  function factoryName(id){var f=arr('factories').find(function(x){return x.id===id}); return f?f.name:'؟'}
  function clientBalance(id){
    try{if(calc().clientBalance)return calc().clientBalance(id)}catch(e){}
    try{if(typeof window.clientBalance==='function')return window.clientBalance(id)}catch(e){}
    var c=arr('clients').find(function(x){return x.id===id})||{};
    var total=arr('orders').filter(function(o){return o.clientId===id}).reduce(function(s,o){return s+orderClient(o)},0);
    var deposits=arr('orders').filter(function(o){return o.clientId===id}).reduce(function(s,o){return s+n(o.deposit)},0);
    var payments=arr('payments').filter(function(p){return p.clientId===id}).reduce(function(s,p){return s+n(p.amount)},0);
    return total+n(c.debt)-deposits-payments;
  }
  function factoryBalance(id){
    try{if(calc().factoryBalance)return calc().factoryBalance(id)}catch(e){}
    try{if(typeof window.factoryBalance==='function')return window.factoryBalance(id)}catch(e){}
    var f=arr('factories').find(function(x){return x.id===id})||{};
    var total=arr('orders').filter(function(o){return o.factoryId===id}).reduce(function(s,o){return s+orderFactory(o)},0);
    var paid=arr('transfers').filter(function(t){return t.factoryId===id}).reduce(function(s,t){return s+n(t.amount)},0);
    return total+n(f.debt)-paid;
  }
  function addMap(map,id,patch){
    id=id||'__none__';
    if(!map[id])map[id]={id:id,name:'؟',orders:0,sales:0,cost:0,expenses:0,profit:0,paid:0,balance:0};
    Object.keys(patch||{}).forEach(function(k){map[id][k]=(map[id][k]||0)+n(patch[k])});
    return map[id];
  }
  function topRows(rows,key,limit){
    return rows.slice().sort(function(a,b){return n(b[key])-n(a[key])}).slice(0,limit||10)
  }
  function statusClass(v){return n(v)>=0?'good':'bad'}
  function rowHtml(r,cols,action){
    return '<div class="hp-v52-row">'+cols.map(function(c){
      var val=typeof c.val==='function'?c.val(r):r[c.key];
      var cls=c.cls||''; if(typeof c.cls==='function')cls=c.cls(r)||'';
      return '<div class="'+cls+'"><span class="hp-v52-lbl">'+esc(c.label)+'</span><b>'+esc(val)+'</b></div>';
    }).join('')+(action?'<div class="hp-v52-actions">'+action(r)+'</div>':'')+'</div>';
  }
  function makeSummary(){
    var orders=filteredOrders(), expenses=filteredExpenses(), payments=filteredPayments(), transfers=filteredTransfers();
    var sales=orders.reduce(function(s,o){return s+orderClient(o)},0);
    var cost=orders.reduce(function(s,o){return s+orderFactory(o)},0);
    var exp=expenses.reduce(function(s,e){return s+n(e.amount)},0);
    var profit=sales-cost-exp;
    var paid=payments.reduce(function(s,p){return s+n(p.amount)},0)+orders.reduce(function(s,o){return s+n(o.deposit)},0);
    var factoryPaid=transfers.reduce(function(s,t){return s+n(t.amount)},0);
    var clientsTouched={}; orders.forEach(function(o){if(o.clientId)clientsTouched[o.clientId]=1});
    var factoriesTouched={}; orders.forEach(function(o){if(o.factoryId)factoriesTouched[o.factoryId]=1});
    return {orders:orders,expenses:expenses,payments:payments,transfers:transfers,sales:sales,cost:cost,exp:exp,profit:profit,paid:paid,factoryPaid:factoryPaid,clients:Object.keys(clientsTouched).length,factories:Object.keys(factoriesTouched).length};
  }
  function clientsReport(orders){
    var map={};
    orders.forEach(function(o){var r=addMap(map,o.clientId,{orders:1,sales:orderClient(o),cost:orderFactory(o),expenses:orderExp(o.id),profit:orderProfit(o)});r.name=clientName(o.clientId)});
    filteredPayments().forEach(function(p){var r=addMap(map,p.clientId,{paid:n(p.amount)});r.name=clientName(p.clientId)});
    orders.forEach(function(o){var r=addMap(map,o.clientId,{paid:n(o.deposit)});r.name=clientName(o.clientId)});
    Object.keys(map).forEach(function(id){map[id].balance=clientBalance(id)});
    return Object.keys(map).map(function(id){return map[id]})
  }
  function factoriesReport(orders){
    var map={};
    orders.forEach(function(o){var r=addMap(map,o.factoryId,{orders:1,sales:orderClient(o),cost:orderFactory(o),profit:orderProfit(o)});r.name=factoryName(o.factoryId)});
    filteredTransfers().forEach(function(t){var r=addMap(map,t.factoryId,{paid:n(t.amount)});r.name=factoryName(t.factoryId)});
    Object.keys(map).forEach(function(id){map[id].balance=factoryBalance(id)});
    return Object.keys(map).map(function(id){return map[id]})
  }
  function statusReport(orders){
    var map={};
    orders.forEach(function(o){var st=(typeof window.normalizeStatus==='function')?window.normalizeStatus(o.status):(o.status||'تحت التنفيذ');var r=addMap(map,st,{orders:1,sales:orderClient(o),cost:orderFactory(o),profit:orderProfit(o)});r.name=st});
    return Object.keys(map).map(function(k){return map[k]})
  }
  function monthsBack(limit){
    var src={}; arr('orders').forEach(function(o){var m=monthOf(o); if(m)src[m]=1}); arr('expenses').forEach(function(e){var m=monthOf(e); if(m)src[m]=1});
    var keys=Object.keys(src).sort();
    if(!keys.length){keys=[new Date().toISOString().slice(0,7)]}
    return keys.slice(-limit);
  }
  function monthlyReport(){
    return monthsBack(8).map(function(m){
      var orders=arr('orders').filter(function(o){return monthOf(o)===m});
      var exp=arr('expenses').filter(function(e){return monthOf(e)===m}).reduce(function(s,e){return s+n(e.amount)},0);
      var sales=orders.reduce(function(s,o){return s+orderClient(o)},0);
      var cost=orders.reduce(function(s,o){return s+orderFactory(o)},0);
      return {id:m,name:monthLabel(m),orders:orders.length,sales:sales,cost:cost,expenses:exp,profit:sales-cost-exp};
    })
  }
  function cards(summary){
    return '<div class="hp-v52-kpis">'
      +'<div class="hp-v52-kpi good"><span>مبيعات الفترة</span><b>'+money(summary.sales)+'</b></div>'
      +'<div class="hp-v52-kpi bad"><span>تكلفة المصانع</span><b>'+money(summary.cost)+'</b></div>'
      +'<div class="hp-v52-kpi bad"><span>مصروفات الفترة</span><b>'+money(summary.exp)+'</b></div>'
      +'<div class="hp-v52-kpi '+statusClass(summary.profit)+'"><span>صافي الربح</span><b>'+money(summary.profit)+'</b></div>'
      +'<div class="hp-v52-kpi"><span>أوردرات الفترة</span><b>'+count(summary.orders.length)+'</b></div>'
      +'<div class="hp-v52-kpi"><span>عملاء الفترة</span><b>'+count(summary.clients)+'</b></div>'
      +'</div>';
  }
  function tableBlock(title,subtitle,rows,cols,action,empty){
    return '<section class="hp-v52-block"><div class="hp-v52-title"><div><h3>'+esc(title)+'</h3>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div></div>'+
      '<div class="hp-v52-table">'+(rows&&rows.length?rows.map(function(r){return rowHtml(r,cols,action)}).join(''):'<div class="hp-v52-empty">'+esc(empty||'لا توجد بيانات')+'</div>')+'</div></section>';
  }
  function buildHtml(){
    var summary=makeSummary(), clients=clientsReport(summary.orders), factories=factoriesReport(summary.orders), statuses=statusReport(summary.orders), months=monthlyReport();
    var debtRows=arr('clients').map(function(c){return {id:c.id,name:c.name||'؟',balance:clientBalance(c.id),orders:arr('orders').filter(function(o){return o.clientId===c.id}).length}}).filter(function(r){return r.balance>0});
    var html='<div class="hp-v52-head"><div><div class="sec-label">Reports Pro V52</div><h2>تقارير الإدارة المتقدمة</h2><p>الفترة الحالية: '+esc(activePeriod()==='month'?'شهر '+monthLabel(activeMonth()):'كل البيانات / حسب اختيار الفلاتر')+'</p></div><div class="hp-v52-tools">'
      +'<button class="btn small blue" onclick="HP_V52_REPORTS_PRO.exportCsv(\'summary\')"><i class="ti ti-download"></i> ملخص CSV</button>'
      +'<button class="btn small" onclick="HP_V52_REPORTS_PRO.exportCsv(\'clients\')">عملاء CSV</button>'
      +'<button class="btn small" onclick="HP_V52_REPORTS_PRO.exportCsv(\'orders\')">أوردرات CSV</button>'
      +'</div></div>';
    html+=cards(summary);
    html+='<div class="hp-v52-grid">';
    html+=tableBlock('أعلى العملاء مبيعات','حسب الفترة المختارة',topRows(clients,'sales',8),[
      {label:'العميل',key:'name'},{label:'مبيعات',val:function(r){return money(r.sales)},cls:'good'},{label:'مدفوع',val:function(r){return money(r.paid)}},{label:'ربح',val:function(r){return money(r.profit)},cls:function(r){return statusClass(r.profit)}},{label:'رصيد حالي',val:function(r){return money(r.balance)},cls:function(r){return r.balance>0?'bad':'good'}}
    ],function(r){return '<button class="btn small" onclick="openClientDetail(\''+esc(r.id)+'\')">تفاصيل</button>'},'لا توجد مبيعات عملاء');
    html+=tableBlock('أعلى العملاء مديونية','الأرصدة الحالية الإجمالية',topRows(debtRows,'balance',8),[
      {label:'العميل',key:'name'},{label:'الرصيد',val:function(r){return money(r.balance)},cls:'bad'},{label:'عدد الأوردرات',val:function(r){return count(r.orders)}}
    ],function(r){return '<button class="btn small" onclick="openClientDetail(\''+esc(r.id)+'\')">تحصيل</button>'},'لا توجد مديونيات عملاء');
    html+=tableBlock('تقرير المصانع','تكلفة ومدفوعات المصانع حسب الفترة',topRows(factories,'cost',8),[
      {label:'المصنع',key:'name'},{label:'تكلفة',val:function(r){return money(r.cost)},cls:'bad'},{label:'محول',val:function(r){return money(r.paid)}},{label:'رصيد حالي',val:function(r){return money(r.balance)},cls:function(r){return r.balance>0?'bad':'good'}},{label:'ربح أوردراته',val:function(r){return money(r.profit)},cls:function(r){return statusClass(r.profit)}}
    ],function(r){return '<button class="btn small" onclick="openFactoryDetail(\''+esc(r.id)+'\')">تفاصيل</button>'},'لا توجد بيانات مصانع');
    html+=tableBlock('حالات الأوردرات','عدد وقيمة كل حالة',topRows(statuses,'orders',10),[
      {label:'الحالة',key:'name'},{label:'عدد',val:function(r){return count(r.orders)}},{label:'مبيعات',val:function(r){return money(r.sales)},cls:'good'},{label:'ربح',val:function(r){return money(r.profit)},cls:function(r){return statusClass(r.profit)}}
    ],null,'لا توجد أوردرات');
    html+=tableBlock('اتجاه آخر الشهور','قراءة سريعة للمبيعات والربح',months,[
      {label:'الشهر',key:'name'},{label:'أوردرات',val:function(r){return count(r.orders)}},{label:'مبيعات',val:function(r){return money(r.sales)},cls:'good'},{label:'تكلفة',val:function(r){return money(r.cost)},cls:'bad'},{label:'ربح',val:function(r){return money(r.profit)},cls:function(r){return statusClass(r.profit)}}
    ],null,'لا توجد شهور');
    html+='</div>';
    return html;
  }
  function ensureRoot(){
    var reports=byId('pg-reports'); if(!reports)return null;
    var root=byId(ROOT_ID);
    if(!root){root=document.createElement('div'); root.id=ROOT_ID; root.className='hp-v52-wrap'; reports.appendChild(root)}
    return root;
  }
  function renderPro(){
    try{var root=ensureRoot(); if(root)root.innerHTML=buildHtml()}catch(e){console.error('V52 reports render failed',e); try{if(window.HP_V50_STABILITY&&HP_V50_STABILITY.log)HP_V50_STABILITY.log('V52_REPORTS_ERROR',String(e&&e.message||e),'renderPro')}catch(_){}}
  }
  function csvEscape(v){v=String(v==null?'':v); return '"'+v.replace(/"/g,'""')+'"'}
  function download(name,rows){
    var csv='\ufeff'+rows.map(function(r){return r.map(csvEscape).join(',')}).join('\n');
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove()},500);
  }
  function exportCsv(type){
    var summary=makeSummary(), rows=[];
    if(type==='clients'){
      rows=[['Client','Orders','Sales','Paid in period','Current balance','Profit in period']].concat(clientsReport(summary.orders).map(function(r){return [r.name,r.orders,r.sales,r.paid,r.balance,r.profit]}));
      return download('haydar-pack-v52-clients.csv',rows);
    }
    if(type==='orders'){
      rows=[['Code','Date','Client','Factory','Status','Sales','Factory cost','Expenses','Profit']].concat(summary.orders.map(function(o){return [o.code||'',o.date||'',clientName(o.clientId),factoryName(o.factoryId),o.status||'',orderClient(o),orderFactory(o),orderExp(o.id),orderProfit(o)]}));
      return download('haydar-pack-v52-orders.csv',rows);
    }
    if(type==='factories'){
      rows=[['Factory','Orders','Factory cost','Transfers in period','Current balance','Order profit']].concat(factoriesReport(summary.orders).map(function(r){return [r.name,r.orders,r.cost,r.paid,r.balance,r.profit]}));
      return download('haydar-pack-v52-factories.csv',rows);
    }
    rows=[['Metric','Value'],['Sales',summary.sales],['Factory cost',summary.cost],['Expenses',summary.exp],['Profit',summary.profit],['Orders',summary.orders.length],['Clients',summary.clients],['Factories',summary.factories]];
    return download('haydar-pack-v52-summary.csv',rows);
  }
  function hookReports(){
    if(window.__HP_V52_REPORTS_HOOKED)return; window.__HP_V52_REPORTS_HOOKED=true;
    var old=window.renderReports;
    window.renderReports=function(){
      if(typeof old==='function')old.apply(this,arguments);
      renderPro();
    };
    setTimeout(function(){try{if((window.activePage||'')==='reports')renderPro()}catch(e){}},400);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hookReports); else hookReports();
  window.HP_V52_REPORTS_PRO={version:VERSION,siteVersion:SITE_VERSION,render:renderPro,exportCsv:exportCsv,summary:makeSummary};
})();
