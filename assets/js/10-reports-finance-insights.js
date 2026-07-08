/* Haydar Pack V53 - Finance Insights & Drilldown
   GitHub-only upgrade. Adds cash-flow, follow-up and drilldown reports above V52 Reports Pro. */
(function(){
  'use strict';
  var VERSION='53.0.0-finance-insights';
  var SITE_VERSION='53financeinsights';
  var ROOT_ID='hp-v53-finance-insights';
  var MODAL_ID='hp-v53-drilldown-modal';

  function byId(id){return document.getElementById(id)}
  function arr(name){return (window.DB && Array.isArray(DB[name])) ? DB[name] : []}
  function n(v){var x=parseFloat(v);return isNaN(x)?0:x}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function safeJs(v){return JSON.stringify(String(v==null?'':v))}
  function money(v){try{return n(v).toLocaleString('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:2})+' ج'}catch(e){return String(n(v))+' ج'}}
  function count(v){try{return n(v).toLocaleString('ar-EG',{maximumFractionDigits:0})}catch(e){return String(n(v))}}
  function pct(v){try{return (n(v)*100).toLocaleString('ar-EG',{maximumFractionDigits:1})+'%'}catch(e){return String(Math.round(n(v)*100))+'%'}}
  function dateOf(o){return String((o&&o.date)||'')}
  function monthOf(o){var d=dateOf(o); return /^\d{4}-\d{2}/.test(d)?d.slice(0,7):''}
  function latestMonth(){var ms={}; arr('orders').forEach(function(o){var m=monthOf(o); if(m)ms[m]=1}); var keys=Object.keys(ms).sort(); return keys.length?keys[keys.length-1]:(new Date().toISOString().slice(0,7))}
  function monthLabel(m){if(!m)return 'بدون تاريخ'; var p=String(m).split('-'); return p.length===2?p[1]+'/'+p[0]:m}
  function activePeriod(){return window.repPeriod || 'all'}
  function activeMonth(){return window.selRepMonth || latestMonth()}
  function matchDate(date,period,month){try{if(typeof window.dateMatches==='function')return window.dateMatches(date,period,month)}catch(e){} if(!date)return period==='all'||!period; if(period==='month')return String(date).slice(0,7)===(month||''); return true}
  function inActivePeriod(o){return matchDate((o&&o.date)||'',activePeriod(),activeMonth())}
  function ordersPeriod(){return arr('orders').filter(inActivePeriod)}
  function expensesPeriod(){return arr('expenses').filter(inActivePeriod)}
  function paymentsPeriod(){return arr('payments').filter(inActivePeriod)}
  function transfersPeriod(){return arr('transfers').filter(inActivePeriod)}
  function calc(){return window.HP_CALC||{}}
  function orderClient(o){try{if(calc().clientNetForOrder)return calc().clientNetForOrder(o)}catch(e){} try{if(typeof window.clientTotalForOrder==='function')return window.clientTotalForOrder(o)}catch(e){} var qty=n(o&&o.fQty)>0?n(o.fQty):n(o&&o.qty); return Math.max(0,qty*n(o&&o.price)+n(o&&o.aklashe)-n(o&&o.discount)-n(o&&o.invoiceDiscount))}
  function orderFactory(o){try{if(calc().factoryTotalForOrder)return calc().factoryTotalForOrder(o)}catch(e){} try{if(typeof window.factoryTotalForOrder==='function')return window.factoryTotalForOrder(o)}catch(e){} return n(o&&o.fQty)*n(o&&o.fPrice)+n(o&&o.fAk)}
  function orderExp(orderId){try{if(calc().orderExpenseTotal)return calc().orderExpenseTotal(orderId)}catch(e){} return arr('expenses').filter(function(e){return e.orderId===orderId}).reduce(function(s,e){return s+n(e.amount)},0)}
  function orderProfit(o){try{if(calc().profitForOrder)return calc().profitForOrder(o)}catch(e){} try{if(typeof window.profitForOrder==='function')return window.profitForOrder(o)}catch(e){} return orderClient(o)-orderFactory(o)-orderExp(o&&o.id)}
  function clientName(id){var c=arr('clients').find(function(x){return x.id===id}); return c?c.name:'؟'}
  function factoryName(id){var f=arr('factories').find(function(x){return x.id===id}); return f?f.name:'؟'}
  function normalizeStatus(st){try{if(typeof window.normalizeStatus==='function')return window.normalizeStatus(st)}catch(e){} return st||'تحت التنفيذ'}
  function clientBalance(id){try{if(calc().clientBalance)return calc().clientBalance(id)}catch(e){} try{if(typeof window.clientBalance==='function')return window.clientBalance(id)}catch(e){} var c=arr('clients').find(function(x){return x.id===id})||{}; var total=arr('orders').filter(function(o){return o.clientId===id}).reduce(function(s,o){return s+orderClient(o)},0); var deposits=arr('orders').filter(function(o){return o.clientId===id}).reduce(function(s,o){return s+n(o.deposit)},0); var payments=arr('payments').filter(function(p){return p.clientId===id}).reduce(function(s,p){return s+n(p.amount)},0); return total+n(c.debt)-deposits-payments}
  function factoryBalance(id){try{if(calc().factoryBalance)return calc().factoryBalance(id)}catch(e){} try{if(typeof window.factoryBalance==='function')return window.factoryBalance(id)}catch(e){} var f=arr('factories').find(function(x){return x.id===id})||{}; var total=arr('orders').filter(function(o){return o.factoryId===id}).reduce(function(s,o){return s+orderFactory(o)},0); var paid=arr('transfers').filter(function(t){return t.factoryId===id}).reduce(function(s,t){return s+n(t.amount)},0); return total+n(f.debt)-paid}
  function statusClass(v){return n(v)>=0?'good':'bad'}
  function sortDesc(rows,key){return rows.slice().sort(function(a,b){return n(b[key])-n(a[key])})}
  function allMonths(limit){var src={}; ['orders','expenses','payments','transfers'].forEach(function(k){arr(k).forEach(function(o){var m=monthOf(o); if(m)src[m]=1})}); var keys=Object.keys(src).sort(); if(!keys.length)keys=[new Date().toISOString().slice(0,7)]; return keys.slice(-(limit||12))}

  function clientCollections(){return paymentsPeriod().reduce(function(s,p){return s+n(p.amount)},0)+ordersPeriod().reduce(function(s,o){return s+n(o.deposit)},0)}
  function periodSummary(){
    var orders=ordersPeriod(), expenses=expensesPeriod(), payments=paymentsPeriod(), transfers=transfersPeriod();
    var sales=orders.reduce(function(s,o){return s+orderClient(o)},0);
    var factoryCost=orders.reduce(function(s,o){return s+orderFactory(o)},0);
    var exp=expenses.reduce(function(s,e){return s+n(e.amount)},0);
    var profit=sales-factoryCost-exp;
    var cashIn=payments.reduce(function(s,p){return s+n(p.amount)},0)+orders.reduce(function(s,o){return s+n(o.deposit)},0);
    var factoryPaid=transfers.reduce(function(s,t){return s+n(t.amount)},0);
    var netCash=cashIn-factoryPaid-exp;
    var clientDebt=arr('clients').reduce(function(s,c){return s+Math.max(0,clientBalance(c.id))},0);
    var factoryDebt=arr('factories').reduce(function(s,f){return s+Math.max(0,factoryBalance(f.id))},0);
    return {orders:orders,expenses:expenses,payments:payments,transfers:transfers,sales:sales,factoryCost:factoryCost,exp:exp,profit:profit,cashIn:cashIn,factoryPaid:factoryPaid,netCash:netCash,clientDebt:clientDebt,factoryDebt:factoryDebt,collectionRate:sales?cashIn/sales:0};
  }
  function followupClients(){
    return arr('clients').map(function(c){
      var os=arr('orders').filter(function(o){return o.clientId===c.id});
      var last=os.map(function(o){return o.date||''}).sort().pop()||'';
      var sales=os.reduce(function(s,o){return s+orderClient(o)},0);
      var paid=arr('payments').filter(function(p){return p.clientId===c.id}).reduce(function(s,p){return s+n(p.amount)},0)+os.reduce(function(s,o){return s+n(o.deposit)},0);
      return {id:c.id,name:c.name||'؟',balance:clientBalance(c.id),orders:os.length,last:last,sales:sales,paid:paid};
    }).filter(function(r){return r.balance>0}).sort(function(a,b){return n(b.balance)-n(a.balance)}).slice(0,10);
  }
  function followupFactories(){
    return arr('factories').map(function(f){
      var os=arr('orders').filter(function(o){return o.factoryId===f.id});
      var last=os.map(function(o){return o.date||''}).sort().pop()||'';
      var cost=os.reduce(function(s,o){return s+orderFactory(o)},0);
      var paid=arr('transfers').filter(function(t){return t.factoryId===f.id}).reduce(function(s,t){return s+n(t.amount)},0);
      return {id:f.id,name:f.name||'؟',balance:factoryBalance(f.id),orders:os.length,last:last,cost:cost,paid:paid};
    }).filter(function(r){return r.balance>0}).sort(function(a,b){return n(b.balance)-n(a.balance)}).slice(0,10);
  }
  function monthlyCashFlow(){
    return allMonths(10).map(function(m){
      var os=arr('orders').filter(function(o){return monthOf(o)===m});
      var ps=arr('payments').filter(function(p){return monthOf(p)===m});
      var es=arr('expenses').filter(function(e){return monthOf(e)===m});
      var ts=arr('transfers').filter(function(t){return monthOf(t)===m});
      var sales=os.reduce(function(s,o){return s+orderClient(o)},0);
      var cashIn=ps.reduce(function(s,p){return s+n(p.amount)},0)+os.reduce(function(s,o){return s+n(o.deposit)},0);
      var expense=es.reduce(function(s,e){return s+n(e.amount)},0);
      var factoryPaid=ts.reduce(function(s,t){return s+n(t.amount)},0);
      var profit=sales-os.reduce(function(s,o){return s+orderFactory(o)},0)-expense;
      return {id:m,name:monthLabel(m),orders:os.length,sales:sales,cashIn:cashIn,factoryPaid:factoryPaid,expenses:expense,net:cashIn-factoryPaid-expense,profit:profit};
    });
  }
  function profitOrders(){
    return ordersPeriod().map(function(o){return {id:o.id,code:o.code||'',date:o.date||'',client:clientName(o.clientId),factory:factoryName(o.factoryId),status:normalizeStatus(o.status),sales:orderClient(o),cost:orderFactory(o),expenses:orderExp(o.id),profit:orderProfit(o)}}).sort(function(a,b){return Math.abs(n(b.profit))-Math.abs(n(a.profit))}).slice(0,10);
  }
  function kpi(title,val,cls,sub){return '<div class="hp-v53-kpi '+(cls||'')+'"><span>'+esc(title)+'</span><b>'+esc(val)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>'}
  function row(cells,action){return '<div class="hp-v53-row">'+cells.map(function(c){return '<div class="'+(c.cls||'')+'"><span>'+esc(c.label)+'</span><b>'+esc(c.val)+'</b></div>'}).join('')+(action?'<div class="hp-v53-actions">'+action+'</div>':'')+'</div>'}
  function block(title,sub,rows,empty){return '<section class="hp-v53-block"><div class="hp-v53-title"><h3>'+esc(title)+'</h3>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</div><div class="hp-v53-table">'+(rows&&rows.length?rows.join(''):'<div class="hp-v53-empty">'+esc(empty||'لا توجد بيانات')+'</div>')+'</div></section>'}
  function buildHtml(){
    var s=periodSummary(), clients=followupClients(), factories=followupFactories(), months=monthlyCashFlow(), profits=profitOrders();
    var periodText=activePeriod()==='month'?'شهر '+monthLabel(activeMonth()):'كل البيانات / حسب اختيار فلاتر التقرير';
    var html='<div class="hp-v53-wrap"><div class="hp-v53-head"><div><div class="sec-label">Reports Pro V53</div><h2>تحليل التحصيل والكاش فلو</h2><p>'+esc(periodText)+' — قراءة مالية سريعة مبنية على الداتا الحالية بدون تغيير أي بيانات.</p></div><div class="hp-v53-tools">'
      +'<button class="btn small blue" onclick="HP_V53_FINANCE.exportCsv(\'cashflow\')"><i class="ti ti-download"></i> Cash Flow CSV</button>'
      +'<button class="btn small" onclick="HP_V53_FINANCE.exportCsv(\'followup\')">متابعة CSV</button>'
      +'<button class="btn small" onclick="HP_V53_FINANCE.refresh()">تحديث</button>'
      +'</div></div>';
    html+='<div class="hp-v53-kpis">'
      +kpi('تحصيلات العملاء',money(s.cashIn),'good','دفعات + عربون الفترة')
      +kpi('تحويلات المصانع',money(s.factoryPaid),'bad','مدفوع للمصانع في الفترة')
      +kpi('مصروفات الفترة',money(s.exp),'bad','مصروفات مسجلة')
      +kpi('صافي حركة الكاش',money(s.netCash),statusClass(s.netCash),'تحصيلات - مصنع - مصروفات')
      +kpi('مديونية العملاء الحالية',money(s.clientDebt),'bad','إجمالي الأرصدة المفتوحة')
      +kpi('التزامات المصانع الحالية',money(s.factoryDebt),'bad','إجمالي أرصدة المصانع')
      +kpi('نسبة التحصيل للفترة',pct(s.collectionRate),s.collectionRate>=.75?'good':(s.collectionRate>=.4?'warn':'bad'),'مقارنة بالمبيعات')
      +kpi('ربح الفترة المتوقع',money(s.profit),statusClass(s.profit),'بعد تكلفة المصنع والمصروفات')
      +'</div><div class="hp-v53-grid">';
    html+=block('عملاء محتاجين متابعة','أعلى أرصدة عملاء مفتوحة حاليًا',clients.map(function(r){return row([{label:'العميل',val:r.name},{label:'الرصيد',val:money(r.balance),cls:'bad'},{label:'أوردرات',val:count(r.orders)},{label:'آخر أوردر',val:r.last||'—'}],'<button class="btn small" onclick="HP_V53_FINANCE.open(\'client\','+safeJs(r.id)+')">كشف سريع</button>')}).join(''),'لا توجد أرصدة عملاء مفتوحة');
    html+=block('مصانع محتاجة تسوية','أعلى أرصدة مصانع مفتوحة حاليًا',factories.map(function(r){return row([{label:'المصنع',val:r.name},{label:'الرصيد',val:money(r.balance),cls:'bad'},{label:'أوردرات',val:count(r.orders)},{label:'آخر أوردر',val:r.last||'—'}],'<button class="btn small" onclick="HP_V53_FINANCE.open(\'factory\','+safeJs(r.id)+')">كشف سريع</button>')}).join(''),'لا توجد أرصدة مصانع مفتوحة');
    html+=block('كاش فلو آخر الشهور','تحصيلات، تحويلات، مصروفات، وصافي حركة الكاش',months.map(function(r){return row([{label:'الشهر',val:r.name},{label:'تحصيل',val:money(r.cashIn),cls:'good'},{label:'مصانع',val:money(r.factoryPaid),cls:'bad'},{label:'مصروفات',val:money(r.expenses),cls:'bad'},{label:'صافي كاش',val:money(r.net),cls:statusClass(r.net)}],'<button class="btn small" onclick="HP_V53_FINANCE.open(\'month\','+safeJs(r.id)+')">تفاصيل</button>')}).join(''),'لا توجد شهور كافية');
    html+=block('أوردرات مؤثرة على الربح','أكبر أوردرات ربحًا أو خسارة في الفترة',profits.map(function(r){return row([{label:'الكود',val:r.code||r.id},{label:'العميل',val:r.client},{label:'الحالة',val:r.status},{label:'ربح',val:money(r.profit),cls:statusClass(r.profit)}],'<button class="btn small" onclick="HP_V53_FINANCE.open(\'order\','+safeJs(r.id)+')">فتح</button>')}).join(''),'لا توجد أوردرات في الفترة');
    html+='</div></div>';
    return html;
  }
  function ensureRoot(){var reports=byId('pg-reports'); if(!reports)return null; var root=byId(ROOT_ID); if(!root){root=document.createElement('div'); root.id=ROOT_ID; reports.appendChild(root)} return root}
  function render(){try{var r=ensureRoot(); if(r)r.innerHTML=buildHtml()}catch(e){console.error('V53 finance render failed',e); try{if(window.HP_V50_STABILITY&&HP_V50_STABILITY.log)HP_V50_STABILITY.log('V53_REPORTS_ERROR',String(e&&e.message||e),'render')}catch(_){}}}
  function ensureModal(){var m=byId(MODAL_ID); if(m)return m; m=document.createElement('div'); m.id=MODAL_ID; m.className='hp-v53-modal'; m.innerHTML='<div class="hp-v53-modal-card"><button class="hp-v53-close" onclick="HP_V53_FINANCE.close()">×</button><div id="hp-v53-modal-body"></div></div>'; document.body.appendChild(m); return m}
  function line(label,val,cls){return '<div class="hp-v53-detail-line '+(cls||'')+'"><span>'+esc(label)+'</span><b>'+esc(val)+'</b></div>'}
  function miniRows(items,cols){return '<div class="hp-v53-mini">'+(items.length?items.map(function(x){return '<div class="hp-v53-mini-row">'+cols.map(function(c){var v=typeof c.val==='function'?c.val(x):x[c.key]; return '<div><span>'+esc(c.label)+'</span><b>'+esc(v)+'</b></div>'}).join('')+'</div>'}).join(''):'<div class="hp-v53-empty">لا توجد حركات</div>')+'</div>'}
  function open(type,id){
    var title='تفاصيل'; var body='';
    if(type==='client'){
      var c=arr('clients').find(function(x){return x.id===id})||{}; var os=arr('orders').filter(function(o){return o.clientId===id}).sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))}); var ps=arr('payments').filter(function(p){return p.clientId===id}).sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))});
      title='كشف سريع للعميل: '+(c.name||'؟'); body='<div class="hp-v53-detail-grid">'+line('رصيد العميل الحالي',money(clientBalance(id)),'bad')+line('عدد الأوردرات',count(os.length))+line('إجمالي المبيعات',money(os.reduce(function(s,o){return s+orderClient(o)},0)),'good')+line('إجمالي المدفوع',money(ps.reduce(function(s,p){return s+n(p.amount)},0)+os.reduce(function(s,o){return s+n(o.deposit)},0)))+'</div>';
      body+=miniRows(os.slice(0,25),[{label:'تاريخ',key:'date'},{label:'كود',key:'code'},{label:'حالة',val:function(o){return normalizeStatus(o.status)}},{label:'قيمة',val:function(o){return money(orderClient(o))}},{label:'ربح',val:function(o){return money(orderProfit(o))}}]);
      body+='<div class="hp-v53-actions-line"><button class="btn blue" onclick="openClientDetail('+safeJs(id)+')">فتح تفاصيل العميل</button><button class="btn" onclick="HP_V53_FINANCE.exportEntity(\'client\','+safeJs(id)+')">CSV</button></div>';
    }else if(type==='factory'){
      var f=arr('factories').find(function(x){return x.id===id})||{}; var fos=arr('orders').filter(function(o){return o.factoryId===id}).sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))}); var ts=arr('transfers').filter(function(t){return t.factoryId===id}).sort(function(a,b){return String(b.date||'').localeCompare(String(a.date||''))});
      title='كشف سريع للمصنع: '+(f.name||'؟'); body='<div class="hp-v53-detail-grid">'+line('رصيد المصنع الحالي',money(factoryBalance(id)),'bad')+line('عدد الأوردرات',count(fos.length))+line('إجمالي التكلفة',money(fos.reduce(function(s,o){return s+orderFactory(o)},0)),'bad')+line('إجمالي التحويلات',money(ts.reduce(function(s,t){return s+n(t.amount)},0)))+'</div>';
      body+=miniRows(fos.slice(0,25),[{label:'تاريخ',key:'date'},{label:'كود',key:'code'},{label:'عميل',val:function(o){return clientName(o.clientId)}},{label:'تكلفة',val:function(o){return money(orderFactory(o))}},{label:'ربح',val:function(o){return money(orderProfit(o))}}]);
      body+='<div class="hp-v53-actions-line"><button class="btn blue" onclick="openFactoryDetail('+safeJs(id)+')">فتح تفاصيل المصنع</button><button class="btn" onclick="HP_V53_FINANCE.exportEntity(\'factory\','+safeJs(id)+')">CSV</button></div>';
    }else if(type==='month'){
      var m=id; var osM=arr('orders').filter(function(o){return monthOf(o)===m}); var psM=arr('payments').filter(function(p){return monthOf(p)===m}); var esM=arr('expenses').filter(function(e){return monthOf(e)===m}); var tsM=arr('transfers').filter(function(t){return monthOf(t)===m}); var cash=psM.reduce(function(s,p){return s+n(p.amount)},0)+osM.reduce(function(s,o){return s+n(o.deposit)},0); var ex=esM.reduce(function(s,e){return s+n(e.amount)},0); var tr=tsM.reduce(function(s,t){return s+n(t.amount)},0);
      title='تفاصيل شهر '+monthLabel(m); body='<div class="hp-v53-detail-grid">'+line('تحصيلات',money(cash),'good')+line('تحويلات مصانع',money(tr),'bad')+line('مصروفات',money(ex),'bad')+line('صافي الكاش',money(cash-tr-ex),statusClass(cash-tr-ex))+'</div>';
      body+=miniRows(osM.slice(0,30),[{label:'تاريخ',key:'date'},{label:'كود',key:'code'},{label:'عميل',val:function(o){return clientName(o.clientId)}},{label:'قيمة',val:function(o){return money(orderClient(o))}},{label:'ربح',val:function(o){return money(orderProfit(o))}}]);
      body+='<div class="hp-v53-actions-line"><button class="btn" onclick="HP_V53_FINANCE.exportEntity(\'month\','+safeJs(m)+')">CSV</button></div>';
    }else if(type==='order'){
      var o=arr('orders').find(function(x){return x.id===id})||{}; title='تفاصيل أوردر '+(o.code||o.id||''); body='<div class="hp-v53-detail-grid">'+line('العميل',clientName(o.clientId))+line('المصنع',factoryName(o.factoryId))+line('المبيعات',money(orderClient(o)),'good')+line('تكلفة المصنع',money(orderFactory(o)),'bad')+line('مصروفات الأوردر',money(orderExp(o.id)),'bad')+line('الربح',money(orderProfit(o)),statusClass(orderProfit(o)))+'</div><div class="hp-v53-actions-line"><button class="btn blue" onclick="openOrderDetail('+safeJs(id)+')">فتح تفاصيل الأوردر</button></div>';
    }
    var mEl=ensureModal(); var b=byId('hp-v53-modal-body'); b.innerHTML='<div class="hp-v53-modal-title"><h3>'+esc(title)+'</h3><p>تقرير قراءة فقط — لا يعدل أي بيانات.</p></div>'+body; mEl.classList.add('active');
  }
  function close(){var m=byId(MODAL_ID); if(m)m.classList.remove('active')}
  function csvEscape(v){v=String(v==null?'':v); return '"'+v.replace(/"/g,'""')+'"'}
  function download(name,rows){var csv='\ufeff'+rows.map(function(r){return r.map(csvEscape).join(',')}).join('\n'); var blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href); a.remove()},500)}
  function exportCsv(type){var s=periodSummary(); if(type==='followup')return download('haydar-pack-v53-followup.csv',[['Type','Name','Balance','Orders','Last date']].concat(followupClients().map(function(r){return ['Client',r.name,r.balance,r.orders,r.last]}),followupFactories().map(function(r){return ['Factory',r.name,r.balance,r.orders,r.last]}))); if(type==='cashflow')return download('haydar-pack-v53-cashflow.csv',[['Month','Orders','Sales','Cash in','Factory paid','Expenses','Net cash','Profit']].concat(monthlyCashFlow().map(function(r){return [r.id,r.orders,r.sales,r.cashIn,r.factoryPaid,r.expenses,r.net,r.profit]}))); return download('haydar-pack-v53-summary.csv',[['Metric','Value'],['Cash in',s.cashIn],['Factory paid',s.factoryPaid],['Expenses',s.exp],['Net cash',s.netCash],['Client debt',s.clientDebt],['Factory debt',s.factoryDebt],['Profit',s.profit]]);}
  function exportEntity(type,id){var rows=[]; if(type==='client'){rows=[['Date','Order code','Status','Sales','Profit']].concat(arr('orders').filter(function(o){return o.clientId===id}).map(function(o){return [o.date||'',o.code||'',normalizeStatus(o.status),orderClient(o),orderProfit(o)]})); return download('haydar-pack-v53-client-'+id+'.csv',rows)} if(type==='factory'){rows=[['Date','Order code','Client','Factory cost','Profit']].concat(arr('orders').filter(function(o){return o.factoryId===id}).map(function(o){return [o.date||'',o.code||'',clientName(o.clientId),orderFactory(o),orderProfit(o)]})); return download('haydar-pack-v53-factory-'+id+'.csv',rows)} if(type==='month'){rows=[['Date','Order code','Client','Factory','Sales','Factory cost','Profit']].concat(arr('orders').filter(function(o){return monthOf(o)===id}).map(function(o){return [o.date||'',o.code||'',clientName(o.clientId),factoryName(o.factoryId),orderClient(o),orderFactory(o),orderProfit(o)]})); return download('haydar-pack-v53-month-'+id+'.csv',rows)}}
  function hook(){if(window.__HP_V53_FINANCE_HOOKED)return; window.__HP_V53_FINANCE_HOOKED=true; var old=window.renderReports; window.renderReports=function(){if(typeof old==='function')old.apply(this,arguments); render()}; setTimeout(function(){try{if((window.activePage||'')==='reports')render()}catch(e){}},550)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook); else hook();
  window.HP_V53_FINANCE={version:VERSION,siteVersion:SITE_VERSION,refresh:render,open:open,close:close,exportCsv:exportCsv,exportEntity:exportEntity,summary:periodSummary};
})();
