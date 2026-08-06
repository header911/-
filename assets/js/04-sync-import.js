/* Haydar Pack production sync — confirmed Google mutations without UI redesign. */
(function(){
  'use strict';

  var VERSION='2026.08.05-production-fix.1';
  var SITE_VERSION='production_20260806_fix4';
  var LOCAL_KEY='hayder_bags_app';
  var META_KEY='hayder_pack_sync_meta_v37';
  var PENDING_KEY='hayder_pack_sync_pending_v37';
  var CONFIRMED_KEY='hayder_pack_confirmed_state_current';
  var LEGACY_CONFIRMED_KEY='hayder_pack_confirmed_state_v58';
  var URL_KEY='hayder_pack_stage4_backend_url_v32';
  var OLD_URL_KEY='hayder_pack_backend_url_v10';
  var DEVICE_KEY='hayder_pack_device_id_v37';
  var EMERGENCY_KEY='hayder_pack_emergency_local_backup_current';
  var LEGACY_PENDING_KEYS=['hayder_pack_stage4_pending_v32','hayder_pack_pwa_pending_v10','hayder_pack_unsynced_v9'];
  var FIXED_URL='https://script.google.com/macros/s/AKfycbyz3ChhXQ2xMZdD2UHmAsLitbgIvKcSGiQYX7zBNNrJb6h9lem5sLlOBgpkPCOyrWZd2A/exec';
  var RETRY_DELAYS=[4000,8000,15000,30000,60000,120000];

  var state={revision:0,updatedAt:'',ackHash:'',stateHash:'',lastLocalSaveAt:'',lastCloudSaveAt:'',lastError:'',lastErrorCategory:'',lastAttemptAt:'',deviceId:'',backendVersion:'',serviceWorkerVersion:SITE_VERSION};
  var confirmed=null, syncTimer=null, retryTimer=null, metaTimer=null, reconcileTimer=null;
  var readFlights={};
  var saving=false, booted=false, suppress=false, allowConfirmedToast=false;
  var originalToast=window.toast, originalCloseDrawer=window.closeDrawer;
  var deferredDrawers={};
  var EDITABLE_DRAWERS={'dr-order':true,'dr-client':true,'dr-factory':true,'dr-transfer':true,'dr-expense':true,'dr-payment':true,'dr-fprice':true,'dr-capital':true};

  window.HP_MUTATION_SYNC=true;

  function $(id){return document.getElementById(id)}
  function now(){return new Date().toISOString()}
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  function clone(value){if(value===undefined)return null;return JSON.parse(JSON.stringify(value))}
  function n(value){var number=Number(value);return isFinite(number)?number:0}
  function arrays(db,key){if(!Array.isArray(db[key]))db[key]=[]}
  function cleanData(input){
    var db=clone(input||{});
    ['clients','factories','orders','payments','transfers','expenses','capitalMoves','documents','houseExpenses','walletAdjustments','deletedItems','deletedLog','deletedArchive'].forEach(function(key){arrays(db,key)});
    if(!db.settings||typeof db.settings!=='object'||Array.isArray(db.settings))db.settings={};
    if(!Array.isArray(db.settings.extraMonths))db.settings.extraMonths=[];
    delete db.settings.dataSafety;
    delete db.settings.googleClientId;
    db.settings.autoSync=false;
    db._id=n(db._id)||1;
    db.version=Math.max(n(db.version)||0,11);
    return db;
  }
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object'){
      var out={};Object.keys(value).sort().forEach(function(key){out[key]=canonical(value[key])});return out;
    }
    return value;
  }
  function stableText(value){return JSON.stringify(canonical(value))}
  function same(a,b){return stableText(a)===stableText(b)}
  function hashText(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return ('00000000'+(h>>>0).toString(16)).slice(-8)}
  function dataHash(db){return hashText(JSON.stringify(cleanData(db||{})))}
  function counts(db){db=db||{};return {clients:(db.clients||[]).length,factories:(db.factories||[]).length,orders:(db.orders||[]).length,payments:(db.payments||[]).length,transfers:(db.transfers||[]).length,expenses:(db.expenses||[]).length,capitalMoves:(db.capitalMoves||[]).length,documents:(db.documents||[]).length,deleted:((db.deletedItems||[]).length+(db.deletedLog||[]).length+(db.deletedArchive||[]).length)}}
  function usefulCount(db){var c=counts(db||{});return c.clients+c.factories+c.orders+c.payments+c.transfers+c.expenses+c.capitalMoves+c.documents+c.deleted}
  function hasUsefulData(db){return usefulCount(db)>0}
  function readJSON(key,fallback){try{var raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch(error){return fallback}}
  function writeJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(error){console.error(error);return false}}
  function fmtTime(value){if(!value)return 'لا توجد بعد';try{return new Date(value).toLocaleString('ar-EG')}catch(error){return String(value)}}
  function toastDirect(message){try{if(typeof originalToast==='function')originalToast(message);else console.log(message)}catch(error){console.log(message)}}
  function toastSafe(message){allowConfirmedToast=true;try{toastDirect(message)}finally{allowConfirmedToast=false}}
  function categoryError(category,message,details){var error=new Error(message||'تعذر تنفيذ الطلب');error.category=category||'SERVER_INTERNAL_ERROR';error.details=details||null;return error}
  function errorMessage(error){return String(error&&error.message||error||'تعذر تنفيذ الطلب')}

  function installToastGuard(){
    if(typeof originalToast!=='function'||window.toast&&window.toast.__hpConfirmedGuard)return;
    var guarded=function(message){
      var text=String(message||'');
      if(!allowConfirmedToast&&pendingData()&&/^تم (حفظ|إضافة|تعديل|تسجيل|تحديث|نقل|حذف|إنشاء)/.test(text)){
        return originalToast('تم تأمين العملية على الجهاز — جاري تأكيد Google...');
      }
      return originalToast(message);
    };
    guarded.__hpConfirmedGuard=true;
    window.toast=guarded;
    try{toast=guarded}catch(error){}
  }

  function normalizeUrl(url){
    url=String(url||'').trim().replace(/\s+/g,'').replace(/[?#].*$/,'').replace(/\/+$/,'');
    var match=url.match(/^(https:\/\/script\.google\.com\/macros\/s\/[^\/]+)(?:\/(exec|dev))?$/);
    return match?match[1]+'/exec':'';
  }
  function backendUrl(){
    var configured=normalizeUrl(window.HP_APPS_SCRIPT_URL||FIXED_URL)||FIXED_URL;
    var stored='';try{stored=normalizeUrl(localStorage.getItem(URL_KEY)||localStorage.getItem(OLD_URL_KEY)||'')}catch(error){}
    var url=configured||stored||FIXED_URL;
    try{localStorage.setItem(URL_KEY,url);localStorage.setItem(OLD_URL_KEY,url)}catch(error){}
    window.HP_APPS_SCRIPT_URL=url;
    return url;
  }
  function deviceId(){
    if(state.deviceId)return state.deviceId;
    try{state.deviceId=localStorage.getItem(DEVICE_KEY)||''}catch(error){}
    if(!state.deviceId){state.deviceId='dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);try{localStorage.setItem(DEVICE_KEY,state.deviceId)}catch(error){}}
    return state.deviceId;
  }
  function mutationId(){return 'mut-'+Date.now().toString(36)+'-'+deviceId().replace(/[^a-zA-Z0-9]/g,'').slice(-12)+'-'+Math.random().toString(36).slice(2,12)}
  function installUniqueIds(){
    var fn=function(){var value=Date.now()*1000+Math.floor(Math.random()*1000);DB._id=Math.max(n(DB._id),value);return 'i'+String(value)};
    window.uid=fn;try{uid=fn}catch(error){}
  }

  function saveState(){deviceId();writeJSON(META_KEY,state);updateUI()}
  function loadState(){var old=readJSON(META_KEY,{});if(old&&typeof old==='object')Object.assign(state,old);deviceId();saveState()}
  function readConfirmed(){var value=readJSON(CONFIRMED_KEY,null)||readJSON(LEGACY_CONFIRMED_KEY,null);if(value&&value.data){writeJSON(CONFIRMED_KEY,value);return value}return null}
  function writeConfirmed(data,meta){
    confirmed={revision:Number(meta&&meta.revision)||0,updatedAt:meta&&meta.updatedAt||'',checksum:meta&&meta.checksum||dataHash(data),stateHash:meta&&meta.stateHash||'',data:cleanData(data)};
    writeJSON(CONFIRMED_KEY,confirmed);
    state.revision=confirmed.revision;state.updatedAt=confirmed.updatedAt;state.ackHash=confirmed.checksum;state.stateHash=confirmed.stateHash;state.backendVersion=meta&&meta.backendVersion||meta&&meta.appVersion||state.backendVersion;saveState();
  }

  function emptyQueue(){return {formatVersion:2,queue:[],localSnapshot:null,legacySnapshot:null,localUpdatedAt:'',attempts:0,lastError:'',lastErrorCategory:''}}
  function loadQueue(){
    var raw=readJSON(PENDING_KEY,null);
    if(!raw)return emptyQueue();
    if(raw.formatVersion===2&&Array.isArray(raw.queue))return raw;
    var legacy=raw&&raw.data?cleanData(raw.data):null;
    return {formatVersion:2,queue:[],localSnapshot:legacy,legacySnapshot:legacy,localUpdatedAt:raw.localUpdatedAt||now(),attempts:n(raw.attempts),lastError:'',lastErrorCategory:''};
  }
  function saveQueue(queue){
    queue=queue||emptyQueue();queue.formatVersion=2;queue.localUpdatedAt=queue.localUpdatedAt||now();queue.attempts=queue.queue&&queue.queue[0]?n(queue.queue[0].attempts):0;
    if((!queue.queue||!queue.queue.length)&&!queue.legacySnapshot&&!queue.unbasedSnapshot){try{localStorage.removeItem(PENDING_KEY)}catch(error){}updateUI();return}
    writeJSON(PENDING_KEY,queue);updateUI();
  }
  function pendingData(){var queue=loadQueue();return queue.queue.length||queue.legacySnapshot||queue.unbasedSnapshot?queue:null}
  function pendingCount(){var queue=loadQueue();return queue.queue.length+(queue.legacySnapshot||queue.unbasedSnapshot?1:0)}
  function clearPending(){try{localStorage.removeItem(PENDING_KEY)}catch(error){}updateUI()}

  function arrayHasIds(list){
    if(!Array.isArray(list))return false;
    var seen={};
    for(var i=0;i<list.length;i++){if(!list[i]||typeof list[i]!=='object'||Array.isArray(list[i])||!String(list[i].id||''))return false;var id=String(list[i].id);if(seen[id])return false;seen[id]=true}
    return true;
  }
  function mapById(list){var out={};(list||[]).forEach(function(item){out[String(item.id)]=item});return out}
  function buildPatch(beforeInput,afterInput){
    var before=cleanData(beforeInput||{}),after=cleanData(afterInput||{}),collections=[],values=[];
    var keys={};Object.keys(before).concat(Object.keys(after)).forEach(function(key){keys[key]=true});
    Object.keys(keys).sort().forEach(function(key){
      var be=Object.prototype.hasOwnProperty.call(before,key),ae=Object.prototype.hasOwnProperty.call(after,key),b=before[key],a=after[key];
      if(be&&ae&&Array.isArray(b)&&Array.isArray(a)&&arrayHasIds(b)&&arrayHasIds(a)){
        var bm=mapById(b),am=mapById(a),adds=[],updates=[],deletes=[];
        Object.keys(am).forEach(function(id){if(!bm[id])adds.push(clone(am[id]));else if(!same(bm[id],am[id]))updates.push({id:id,before:clone(bm[id]),after:clone(am[id])})});
        Object.keys(bm).forEach(function(id){if(!am[id])deletes.push({id:id,before:clone(bm[id])})});
        if(adds.length||updates.length||deletes.length)collections.push({key:key,adds:adds,updates:updates,deletes:deletes});
      }else if(be!==ae||!same(b,a)){
        values.push({key:key,beforeExists:be,before:be?clone(b):null,afterExists:ae,after:ae?clone(a):null});
      }
    });
    return {collections:collections,values:values};
  }
  function patchEmpty(patch){return !patch||(!(patch.collections||[]).length&&!(patch.values||[]).length)}
  function buildRecoveryPatch(remote,local){
    var patch=buildPatch(remote,local);
    patch.collections=(patch.collections||[]).map(function(change){return {key:change.key,adds:change.adds||[],updates:[],deletes:[]}}).filter(function(change){return change.adds.length});
    patch.values=(patch.values||[]).filter(function(change){return change.key==='_id'});
    return patch;
  }
  function inferOperation(reason,patch){
    var change=patch&&patch.collections&&patch.collections.length===1&&!(patch.values||[]).length?patch.collections[0]:null;
    if(!change)return String(reason||'updateBusinessData').slice(0,80);
    var action=change.adds.length?'add':change.deletes.length?'delete':change.updates.length?'edit':'update';
    var names={clients:'Client',factories:'Factory',orders:'Order',payments:'Payment',transfers:'FactoryPayment',expenses:'Expense',capitalMoves:'CapitalMove',documents:'Document',houseExpenses:'HouseholdExpense',walletAdjustments:'LiquidityAdjustment'};
    return names[change.key]?action+names[change.key]:String(reason||'updateBusinessData').slice(0,80);
  }
  function entityTypeForPatch(patch){return patch&&patch.collections&&patch.collections[0]?String(patch.collections[0].key||'data'): 'data'}
  function applyPatchLocal(data,patch){
    var next=clone(data||{});
    (patch.collections||[]).forEach(function(change){
      if(!Array.isArray(next[change.key]))next[change.key]=[];
      var list=next[change.key];
      (change.adds||[]).forEach(function(item){if(!list.some(function(x){return String(x&&x.id)===String(item.id)}))list.push(clone(item))});
      (change.updates||[]).forEach(function(item){var index=list.findIndex(function(x){return String(x&&x.id)===String(item.id)});if(index>=0)list[index]=clone(item.after)});
      (change.deletes||[]).forEach(function(item){next[change.key]=next[change.key].filter(function(x){return String(x&&x.id)!==String(item.id)});list=next[change.key]});
    });
    (patch.values||[]).forEach(function(change){if(change.afterExists)next[change.key]=clone(change.after);else delete next[change.key]});
    return cleanData(next);
  }

  function captureActiveForm(){
    var roots=document.querySelectorAll('.overlay.open[id],.drawer-root.open[id],.modal.open[id]'),root=null;
    Array.prototype.some.call(roots,function(candidate){if(EDITABLE_DRAWERS[candidate.id]){root=candidate;return true}return false});
    if(!root||!root.id)return null;
    var fields=[];Array.prototype.forEach.call(root.querySelectorAll('input,select,textarea'),function(element){if(!element.id&&!element.name)return;fields.push({id:element.id||'',name:element.name||'',type:element.type||'',value:element.value,checked:!!element.checked})});
    return {drawerId:root.id,fields:fields,capturedAt:now()};
  }
  function restoreForm(snapshot,force){
    if(!snapshot||!snapshot.drawerId)return;
    var root=$(snapshot.drawerId);if(!root)return;
    if(root.classList.contains('open')&&!force)return false;
    root.classList.add('open');
    (snapshot.fields||[]).forEach(function(field){var element=field.id?$(field.id):null;if(!element&&field.name)element=root.querySelector('[name="'+String(field.name).replace(/"/g,'\\"')+'"]');if(!element)return;if(field.type==='checkbox'||field.type==='radio')element.checked=!!field.checked;else element.value=field.value});
    Array.prototype.forEach.call(root.querySelectorAll('button[data-hp-confirmed-disabled="1"]'),function(button){button.disabled=false;button.removeAttribute('data-hp-confirmed-disabled')});
    return true;
  }
  function unlockForm(snapshot){
    if(!snapshot||!snapshot.drawerId)return;
    var root=$(snapshot.drawerId);if(!root)return;
    Array.prototype.forEach.call(root.querySelectorAll('button[data-hp-confirmed-disabled="1"]'),function(button){button.disabled=false;button.removeAttribute('data-hp-confirmed-disabled')});
  }
  function holdForm(snapshot){
    if(!snapshot||!snapshot.drawerId)return;
    deferredDrawers[snapshot.drawerId]=snapshot;
    var root=$(snapshot.drawerId);if(!root)return;
    Array.prototype.forEach.call(root.querySelectorAll('button[onclick*="save" i],button[onclick*="Save" i]'),function(button){button.disabled=true;button.setAttribute('data-hp-confirmed-disabled','1')});
    setTimeout(function(){
      try{if(root.classList.contains('open')&&typeof originalCloseDrawer==='function')originalCloseDrawer(snapshot.drawerId)}catch(error){}
      unlockForm(snapshot);
    },0);
  }
  function releaseForm(snapshot,success){
    if(!snapshot||!snapshot.drawerId)return;
    unlockForm(snapshot);
    if(deferredDrawers[snapshot.drawerId]&&deferredDrawers[snapshot.drawerId].capturedAt===snapshot.capturedAt)delete deferredDrawers[snapshot.drawerId];
  }
  function installCloseGuard(){
    if(typeof originalCloseDrawer!=='function'||window.closeDrawer&&window.closeDrawer.__hpConfirmedGuard)return;
    var guarded=function(){return originalCloseDrawer.apply(this,arguments)};
    guarded.__hpConfirmedGuard=true;window.closeDrawer=guarded;try{closeDrawer=guarded}catch(error){}
  }

  function localWrite(db){
    try{DB=cleanData(db||DB);if(typeof reduceDBForStorage==='function')reduceDBForStorage();localStorage.setItem(LOCAL_KEY,JSON.stringify(DB));return true}
    catch(error){console.error(error);toastSafe('تعذر الحفظ على الجهاز لأن المساحة ممتلئة');return false}
  }
  function localRead(){try{var raw=localStorage.getItem(LOCAL_KEY);if(raw)DB=cleanData(JSON.parse(raw));if(typeof migrate==='function')migrate();localStorage.setItem(LOCAL_KEY,JSON.stringify(DB))}catch(error){console.error(error)}}
  function saveEmergencyLocalBackup(reason,data){
    var value=cleanData(data||DB||{});if(!hasUsefulData(value))return;
    writeJSON(EMERGENCY_KEY,{version:VERSION,reason:reason||'emergency',createdAt:now(),counts:counts(value),data:value});
  }

  function markPending(reason){
    var current=cleanData(DB||{}),queue=loadQueue(),base=queue.localSnapshot||(confirmed&&confirmed.data)||null;
    if(!base){queue.unbasedSnapshot=current;queue.localSnapshot=current;queue.localUpdatedAt=now();saveQueue(queue);schedulePush(100);return queue}
    var patch=buildPatch(base,current);
    if(patchEmpty(patch)){queue.localSnapshot=current;saveQueue(queue);return pendingData()}
    var form=captureActiveForm(),item={mutationId:mutationId(),operation:inferOperation(reason,patch),entityType:entityTypeForPatch(patch),createdAt:now(),baseRevision:null,patch:patch,reason:String(reason||'auto-save').slice(0,120),attempts:0,lastAttemptAt:'',form:form,blocked:false};
    queue.queue.push(item);queue.localSnapshot=current;queue.localUpdatedAt=item.createdAt;queue.lastError='';queue.lastErrorCategory='';state.lastLocalSaveAt=item.createdAt;saveState();saveQueue(queue);holdForm(form);schedulePush(80);return queue;
  }

  function setText(id,text,cls){var element=$(id);if(!element)return;element.textContent=text;if(cls)element.className='cloud-status-value '+cls}
  function setSync(name,message){
    try{if(typeof setSyncState==='function')setSyncState(name,message||'')}catch(error){}
    var status=$('sync-status');if(status)status.textContent=message||'';
    var cls=name==='ok'?'success':name==='work'?'warn':name==='err'?'danger':'';
    setText('cloud-connection-status',name==='ok'?'متصل ومحفوظ':name==='work'?'جاري تأكيد Google':name==='err'?'الحفظ لم يتأكد بعد':'جاهز',cls);
    var banner=$('cloud-offline-banner');if(banner){if(name==='err'){banner.textContent=message||'لم يتم تأكيد الحفظ على Google';banner.classList.add('show')}else{banner.classList.remove('show');banner.textContent=''}}
  }
  function updateUI(){
    setText('cloud-revision-status',String(state.revision||0));setText('cloud-last-status',fmtTime(state.lastCloudSaveAt||state.updatedAt));
    var queue=pendingData(),area=$('cloud-conflict-area');
    if(area)area.innerHTML=queue?'<div class="cloud-conflict-note" style="background:#FFF2B8;border-color:#000;color:#000">يوجد '+pendingCount()+' تعديل في انتظار تأكيد Google.<br>آخر محاولة: '+fmtTime(state.lastAttemptAt)+'<br>السبب: '+String(queue.lastError||state.lastError||'جاري الحفظ')+'<div class="btn-row" style="margin-top:8px"><button class="btn green" onclick="manualSync()">إعادة المحاولة الآن</button><button class="btn blue" onclick="downloadPendingOperation()">تنزيل العملية للطوارئ</button></div></div>':'';
    var health=$('data-health-status');if(health)health.textContent=queue?'سليمة محليًا — في انتظار تأكيد Google':'سليمة ومحفوظة على Google';
    var line=$('hp-v37-pending-line');if(line)line.textContent='حركات في انتظار التأكيد: '+pendingCount();
  }
  function hideLoading(){var cover=$('cloud-loading-cover');if(cover)cover.classList.add('hide')}
  function onePage(){try{var pages=[].slice.call(document.querySelectorAll('.page')),active=pages.filter(function(page){return page.classList.contains('active')});if(pages.length&&active.length!==1)pages.forEach(function(page,index){page.classList.toggle('active',index===0)})}catch(error){}}

  function jsonp(action,params,timeoutMs){
    params=params||{};
    var flightKey=(action==='getState'||action==='getRevision')?action:'';
    if(flightKey&&readFlights[flightKey])return readFlights[flightKey];
    var request=new Promise(function(resolve,reject){
      var url=backendUrl(),callback='hpConfirmed_'+Date.now()+'_'+Math.floor(Math.random()*1000000),query='action='+encodeURIComponent(action)+'&callback='+encodeURIComponent(callback)+'&_='+Date.now(),script=document.createElement('script'),done=false,timer;
      Object.keys(params).forEach(function(key){query+='&'+encodeURIComponent(key)+'='+encodeURIComponent(params[key])});
      function cleanup(){try{delete window[callback]}catch(error){window[callback]=undefined}if(script.parentNode)script.parentNode.removeChild(script);clearTimeout(timer)}
      window[callback]=function(result){done=true;cleanup();resolve(result)};
      script.onerror=function(){if(!done){cleanup();reject(categoryError('BACKEND_UNREACHABLE','تعذر الوصول إلى Google Apps Script'))}};
      timer=setTimeout(function(){if(!done){cleanup();reject(categoryError('NETWORK_TIMEOUT','انتهت مهلة الاتصال أثناء انتظار Google'))}},timeoutMs||30000);
      script.src=url+(url.indexOf('?')>=0?'&':'?')+query;document.head.appendChild(script);
    });
    if(!flightKey)return request;
    readFlights[flightKey]=request.then(function(result){delete readFlights[flightKey];return result},function(error){delete readFlights[flightKey];throw error});
    return readFlights[flightKey];
  }
  function postForm(action,fields){
    return new Promise(function(resolve,reject){
      try{
        var url=backendUrl(),name='hp_confirmed_post_'+Date.now(),iframe=document.createElement('iframe'),form=document.createElement('form');
        fields=fields||{};fields.action=action;fields.appVersion=VERSION;fields.siteVersion=SITE_VERSION;
        iframe.name=name;iframe.style.display='none';iframe.setAttribute('data-hp-confirmed-post','1');iframe.setAttribute('data-hp-mutation-id',String(fields.mutationId||''));form.method='POST';form.action=url;form.target=name;form.style.display='none';form.acceptCharset='UTF-8';
        Object.keys(fields).forEach(function(key){var input=document.createElement('textarea');input.name=key;input.value=String(fields[key]==null?'':fields[key]);form.appendChild(input)});
        document.body.appendChild(iframe);document.body.appendChild(form);form.submit();
        setTimeout(function(){try{form.remove()}catch(error){}},100);
        setTimeout(function(){try{iframe.remove()}catch(error){}},90000);
        resolve({submitted:true});
      }catch(error){reject(categoryError('BACKEND_UNREACHABLE','تعذر إرسال عملية الحفظ إلى Google'))}
    });
  }
  function cleanupPostFrames(mutationId){
    Array.prototype.forEach.call(document.querySelectorAll('iframe[data-hp-confirmed-post="1"]'),function(frame){if(!mutationId||frame.getAttribute('data-hp-mutation-id')===String(mutationId))try{frame.remove()}catch(error){}});
  }
  function responseError(result){
    if(result&&result.category)return categoryError(result.category,result.message||'رفض Google عملية الحفظ',result.details);
    if(result&&result.message&&/Unknown action/i.test(result.message))return categoryError('VERSION_REJECTED','ملف Code.gs المنشور لا يدعم الحفظ المؤكد. استبدله بالملف النهائي ثم اعمل Deploy جديد.');
    return categoryError('SERVER_INTERNAL_ERROR',result&&result.message||'تعذر تأكيد عملية الحفظ');
  }
  async function pollMutation(id){
    var lastError=null;
    for(var attempt=0;attempt<8;attempt++){
      try{
        var result=await jsonp('getMutationStatus',{mutationId:id},8000);
        if(result&&result.status==='committed'&&result.ok!==false)return result;
        if(result&&result.status==='rejected')throw responseError(result);
        if(result&&result.ok===false)throw responseError(result);
      }catch(error){lastError=error;if(error.category==='VERSION_REJECTED'||error.category==='INVALID_PAYLOAD'||error.category==='REVISION_CONFLICT'||error.category==='STATE_VALIDATION_FAILED')throw error}
      await wait(350+attempt*250);
    }
    throw lastError||categoryError('MUTATION_STATUS_UNKNOWN','لم يصل تأكيد Google بعد؛ العملية محفوظة وسيعاد الاستعلام بنفس الرقم');
  }

  function schedulePush(delay){clearTimeout(syncTimer);syncTimer=setTimeout(function(){pushPending(false)},delay==null?900:delay)}
  function scheduleRetry(){
    clearTimeout(retryTimer);var queue=pendingData();if(!queue||!queue.queue.length)return;
    var first=queue.queue[0];if(first.blocked)return;
    var delay=RETRY_DELAYS[Math.min(n(first.attempts),RETRY_DELAYS.length-1)];retryTimer=setTimeout(function(){pushPending(false)},delay);
  }
  function scheduleReconcile(delay){
    clearTimeout(reconcileTimer);reconcileTimer=setTimeout(function(){if(!pendingData()&&!saving)pull(false,true)},delay==null?900:delay);
  }
  function updateConfirmedFromReceipt(item,result){
    var base=confirmed&&confirmed.data?confirmed.data:{};
    var data=item.operation==='replaceSnapshot'?cleanData(item.replaceData||{}):applyPatchLocal(base,item.patch||{});
    writeConfirmed(data,{revision:result.revision,updatedAt:result.serverTimestamp,checksum:dataHash(data),stateHash:result.stateHash,backendVersion:result.backendVersion});
  }
  async function sendMutation(item){
    item.attempts=n(item.attempts)+1;item.lastAttemptAt=now();if(item.baseRevision==null)item.baseRevision=n(state.revision);
    state.lastAttemptAt=item.lastAttemptAt;saveState();
    var payload=item.operation==='replaceSnapshot'?{data:item.replaceData,confirm:'REPLACE_CONFIRMED'}:{patch:item.patch};
    await postForm('commitMutation',{mutationId:item.mutationId,deviceId:deviceId(),baseRevision:item.baseRevision,operation:item.operation,entityType:item.entityType||'data',createdAt:item.createdAt,payload:JSON.stringify(payload)});
    await wait(650);
    return pollMutation(item.mutationId);
  }
  async function pushPending(show){
    if(saving)return false;
    var queue=loadQueue();
    if(queue.legacySnapshot||queue.unbasedSnapshot){await prepareUnbasedQueue(queue);queue=loadQueue()}
    if(!queue.queue.length){if(show)toastSafe('لا توجد تعديلات معلقة');return checkMeta(false)}
    if(!navigator.onLine){setSync('err','لا يوجد إنترنت — البيانات محفوظة على الجهاز ولم يتم اعتبارها محفوظة على Google');scheduleRetry();return false}
    var item=queue.queue[0];if(item.blocked&&!show){updateUI();return false}if(show)item.blocked=false;
    saving=true;setSync('work','جاري الحفظ على Google...');saveQueue(queue);
    try{
      var result=await sendMutation(item);
      cleanupPostFrames(item.mutationId);
      updateConfirmedFromReceipt(item,result);
      queue=loadQueue();
      if(queue.queue.length&&queue.queue[0].mutationId===item.mutationId)queue.queue.shift();
      queue.lastError='';queue.lastErrorCategory='';queue.localUpdatedAt=now();saveQueue(queue);
      releaseForm(item.form,true);
      state.lastCloudSaveAt=result.serverTimestamp||now();state.lastError='';state.lastErrorCategory='';state.revision=n(result.revision)||state.revision;state.stateHash=result.stateHash||state.stateHash;saveState();
      toastSafe('تم الحفظ على Google');
      saving=false;
      setSync('ok','تم الحفظ على Google');
      if(pendingData())schedulePush(60);else scheduleReconcile(900);
      return true;
    }catch(error){
      saving=false;queue=loadQueue();var current=queue.queue[0];
      var category=error.category||'SERVER_INTERNAL_ERROR',message=errorMessage(error);
      if(current){current.attempts=item.attempts;current.lastAttemptAt=item.lastAttemptAt;current.blocked=['INVALID_PAYLOAD','REVISION_CONFLICT','VERSION_REJECTED','STATE_VALIDATION_FAILED'].indexOf(category)>=0}
      queue.lastError=message;queue.lastErrorCategory=category;saveQueue(queue);
      if(current&&current.blocked){cleanupPostFrames(item.mutationId);restoreForm(item.form)}else releaseForm(item.form,false);
      state.lastError=message;state.lastErrorCategory=category;saveState();setSync('err',category+': '+message);
      if(!current||!current.blocked)scheduleRetry();
      if(show)toastSafe(message);
      return false;
    }
  }

  async function getRemoteState(){var result=await jsonp('getState',{},35000);if(!result||result.ok===false)throw responseError(result);if(!result.data||typeof result.data!=='object')throw categoryError('STATE_VALIDATION_FAILED','Google أعاد بيانات غير صالحة');return result}
  function applyRemote(result,message){
    var remote=cleanData(result.data||{});if(!hasUsefulData(remote)&&hasUsefulData(DB))throw categoryError('STATE_VALIDATION_FAILED','Google أعاد قاعدة فارغة؛ تم الحفاظ على نسخة الجهاز ولم يتم استبدالها');
    if(hasUsefulData(DB))saveEmergencyLocalBackup('before-google-state',DB);
    suppress=true;try{DB=remote;if(typeof migrate==='function')migrate();localWrite(DB)}finally{suppress=false}
    writeConfirmed(DB,result);state.lastCloudSaveAt=result.updatedAt||state.lastCloudSaveAt;state.lastError='';state.lastErrorCategory='';saveState();
    try{if(typeof refreshAll==='function')refreshAll();if(typeof runDataHealthCheckUI==='function')runDataHealthCheckUI()}catch(error){console.error(error)}
    setSync('ok',message||'متصل ومحفوظ على Google');onePage();return result;
  }
  async function prepareUnbasedQueue(queue){
    if(!navigator.onLine)throw categoryError('BACKEND_UNREACHABLE','يلزم الاتصال بـ Google لتجهيز التعديل المعلّق');
    var remote=await getRemoteState(),local=cleanData(queue.legacySnapshot||queue.unbasedSnapshot||queue.localSnapshot||DB||{});
    writeConfirmed(remote.data,remote);var patch=buildRecoveryPatch(remote.data,local);
    queue.legacySnapshot=null;queue.unbasedSnapshot=null;queue.localSnapshot=local;
    if(!patchEmpty(patch)){
      queue.queue.push({mutationId:mutationId(),operation:inferOperation('recoverPendingData',patch),entityType:entityTypeForPatch(patch),createdAt:now(),baseRevision:n(remote.revision),patch:patch,reason:'recover-pending-data',attempts:0,lastAttemptAt:'',form:null,blocked:false});
      saveQueue(queue);DB=local;localWrite(DB);
    }else{
      saveQueue(queue);applyRemote(remote,'تم تحميل آخر بيانات مؤكدة من Google');
    }
  }
  async function pull(show,forceAfterCommit){
    if(pendingData()){if(forceAfterCommit)return null;return pushPending(!!show)}
    if(!navigator.onLine){setSync('err','أوفلاين — تم فتح آخر نسخة محفوظة على الجهاز');return null}
    try{
      var localHashBefore=dataHash(DB);
      setSync('work','جاري تحميل آخر بيانات مؤكدة من Google...');var result=await getRemoteState();
      if(!pendingData()&&dataHash(DB)===localHashBefore)applyRemote(result,show?'تم تحميل آخر تحديث من Google':'متصل ومحفوظ على Google');
      if(show)toastSafe('تم تحميل آخر تحديث');return result;
    }catch(error){state.lastError=errorMessage(error);state.lastErrorCategory=error.category||'BACKEND_UNREACHABLE';saveState();setSync('err',(error.category||'BACKEND_UNREACHABLE')+': '+errorMessage(error));return null}
  }
  async function bootPull(){
    var queue=loadQueue(),local=cleanData(DB||{});
    if(queue.legacySnapshot||queue.unbasedSnapshot){await prepareUnbasedQueue(queue);return pushPending(false)}
    if(queue.queue.length)return pushPending(false);
    var result=await getRemoteState(),remote=cleanData(result.data||{}),localChanged=state.ackHash&&dataHash(local)!==state.ackHash;
    if(localChanged||(!state.ackHash&&hasUsefulData(local)&&usefulCount(local)>usefulCount(remote))){
      saveEmergencyLocalBackup('local-difference-before-upgrade',local);writeConfirmed(remote,result);
      var patch=buildRecoveryPatch(remote,local);
      if(!patchEmpty(patch)){var recovery=emptyQueue();recovery.localSnapshot=local;recovery.localUpdatedAt=now();recovery.queue.push({mutationId:mutationId(),operation:inferOperation('recoverLocalChange',patch),entityType:entityTypeForPatch(patch),createdAt:now(),baseRevision:n(result.revision),patch:patch,reason:'recover-local-change',attempts:0,lastAttemptAt:'',form:null,blocked:false});saveQueue(recovery);return pushPending(false)}
    }
    return applyRemote(result,'متصل ومحفوظ على Google');
  }
  function checkMeta(show){
    if(pendingData())return pushPending(false);
    if(!navigator.onLine)return Promise.resolve(null);
    return jsonp('getRevision',{},18000).then(function(meta){if(!meta||meta.ok===false)throw responseError(meta);if(n(meta.revision)>n(state.revision))return pull(false);state.revision=n(meta.revision)||state.revision;state.updatedAt=meta.updatedAt||state.updatedAt;state.ackHash=meta.checksum||state.ackHash;state.stateHash=meta.stateHash||state.stateHash;state.backendVersion=meta.backendVersion||meta.appVersion||state.backendVersion;saveState();setSync('ok','متصل ومحفوظ على Google');return meta}).catch(function(error){if(show)setSync('err',(error.category||'BACKEND_UNREACHABLE')+': '+errorMessage(error));return null})
  }

  function backup(){if(!navigator.onLine){toastSafe('يلزم الإنترنت لإنشاء Backup على Google');return Promise.resolve(false)}setSync('work','جاري إنشاء Backup على Google...');return jsonp('createBackup',{},35000).then(function(result){if(!result||result.ok===false)throw responseError(result);setSync('ok','تم إنشاء Backup على Google');toastSafe('تم إنشاء النسخة الاحتياطية');return true}).catch(function(error){setSync('err',errorMessage(error));toastSafe(errorMessage(error));return false})}
  async function restoreFromRecoveryAction(action,label){
    if(pendingData())throw categoryError('REVISION_CONFLICT','يوجد تعديل غير مؤكد. أكّد الحفظ أولًا قبل الاسترجاع.');
    var result=await jsonp(action,{},45000);if(!result||result.ok===false)throw responseError(result);applyRemote(result,label||'تم الاسترجاع من Google');toastSafe(label||'تم الاسترجاع');return result;
  }
  function extractImport(parsed){if(!parsed||typeof parsed!=='object')throw new Error('ملف الداتا غير صالح');var data=parsed.data&&typeof parsed.data==='object'?parsed.data:parsed;data=cleanData(data);if(!hasUsefulData(data))throw new Error('ملف الداتا فارغ');return data}
  function importFile(input){
    var file=input&&input.files&&input.files[0];if(!file)return;var reader=new FileReader();
    reader.onload=function(){(async function(){try{var data=extractImport(JSON.parse(reader.result));if(!confirm('سيتم إنشاء Backup على Google ثم استيراد الملف بعد التحقق منه. هل تستمر؟'))return;var queue=emptyQueue(),form=captureActiveForm();queue.localSnapshot=data;queue.localUpdatedAt=now();queue.queue.push({mutationId:mutationId(),operation:'replaceSnapshot',entityType:'database',createdAt:now(),baseRevision:n(state.revision),replaceData:data,reason:'import-json',attempts:0,lastAttemptAt:'',form:form,blocked:false});DB=data;localWrite(DB);saveQueue(queue);holdForm(form);await pushPending(true)}catch(error){toastSafe(errorMessage(error))}})()};
    reader.onerror=function(){toastSafe('تعذر قراءة الملف')};reader.readAsText(file,'utf-8');
  }
  function downloadBackup(){try{var payload={format:'HayderPackBackup',version:VERSION,exportedAt:now(),revision:state.revision||0,stateHash:state.stateHash||'',counts:counts(DB),data:cleanData(DB)},blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='HaydarPack_Backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(link);link.click();setTimeout(function(){URL.revokeObjectURL(link.href);link.remove()},500);toastSafe('تم تنزيل نسخة JSON')}catch(error){toastSafe('تعذر تنزيل النسخة')}}
  function downloadPending(){var queue=pendingData();if(!queue){toastSafe('لا توجد عملية معلقة');return}var blob=new Blob([JSON.stringify({version:VERSION,exportedAt:now(),queue:queue,data:cleanData(DB)},null,2)],{type:'application/json;charset=utf-8'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='HaydarPack_Pending_'+Date.now()+'.json';link.click();setTimeout(function(){URL.revokeObjectURL(link.href)},800)}

  function ensureSyncPanel(){
    var drawer=document.querySelector('#dr-sync .drawer');if(!drawer)return;var old=$('hp-stage4-sync-panel');if(old)old.remove();if($('hp-v37-sync-panel'))return;
    var div=document.createElement('div');div.id='hp-v37-sync-panel';div.className='alert blue';div.innerHTML='<div style="font-weight:900;margin-bottom:8px">الحفظ المؤكد على Google</div><div>لن تظهر رسالة نجاح إلا بعد تأكيد Google. إعادة المحاولة تستخدم نفس رقم العملية ولا تنشئ تكرارًا.</div><div id="hp-v37-pending-line" style="font-weight:900;margin-top:8px">حركات في انتظار التأكيد: '+pendingCount()+'</div><div class="btn-row" style="margin-top:10px"><button class="btn green" onclick="refreshCloudData(true)"><i class="ti ti-refresh"></i> تحديث آمن من Google</button><button class="btn blue" onclick="manualSync()"><i class="ti ti-cloud-up"></i> تأكيد الحفظ الآن</button></div>';
    var grid=drawer.querySelector('.cloud-status-grid');drawer.insertBefore(div,grid||drawer.children[2]||null);updateUI();
  }
  function triggerImport(){var input=$('cloud-import-input');if(input){input.value='';input.click()}}
  function boot(){
    if(booted)return;booted=true;backendUrl();loadState();confirmed=readConfirmed();localRead();installUniqueIds();installToastGuard();installCloseGuard();
    for(var i=0;i<LEGACY_PENDING_KEYS.length&&!pendingData();i++){var legacy=readJSON(LEGACY_PENDING_KEYS[i],null);if(legacy&&legacy.data){var queue=emptyQueue();queue.legacySnapshot=cleanData(legacy.data);queue.localSnapshot=queue.legacySnapshot;queue.localUpdatedAt=now();saveQueue(queue)}}
    try{if(typeof refreshAll==='function')refreshAll()}catch(error){}hideLoading();onePage();
    if(navigator.onLine)bootPull().catch(function(error){state.lastError=errorMessage(error);state.lastErrorCategory=error.category||'BACKEND_UNREACHABLE';saveState();setSync('err',(error.category||'BACKEND_UNREACHABLE')+': '+errorMessage(error));scheduleRetry()});else setSync('err','أوفلاين — البيانات الموجودة على الجهاز لم يتم اعتبارها محفوظة على Google');
    clearInterval(metaTimer);metaTimer=setInterval(function(){if(document.hidden||!navigator.onLine)return;if(pendingData())pushPending(false);else checkMeta(false)},60000);
  }

  var oldOpenSync=window.openSync;
  window.openSync=function(){var result=oldOpenSync?oldOpenSync.apply(this,arguments):undefined;setTimeout(function(){ensureSyncPanel();updateUI();onePage()},0);return result};
  window.refreshCloudData=function(show){return pendingData()?pushPending(!!show):pull(!!show)};
  window.loadFromDrive=function(){return window.refreshCloudData(true)};
  window.manualSync=function(){return pushPending(true)};
  window.manualSyncNow=window.manualSync;
  window.createCloudBackup=backup;
  window.triggerCloudImport=triggerImport;
  window.importCloudBackup=importFile;
  window.downloadManualBackup=downloadBackup;
  window.downloadPendingOperation=downloadPending;
  window.restorePreviousGoogleData=function(){return restoreFromRecoveryAction('restorePrevious','تم استرجاع النسخة السابقة من Google').catch(function(error){toastSafe(errorMessage(error));return false})};
  window.restoreLatestGoogleBackup=function(){return restoreFromRecoveryAction('restoreLatestBackup','تم استرجاع أحدث Backup من Google').catch(function(error){toastSafe(errorMessage(error));return false})};
  window.scheduleSync=function(){markPending('scheduled');schedulePush(250);return true};
  window.save=save=function(skipSync){var ok=localWrite(DB);if(ok&&!suppress&&!skipSync){markPending('business-save');setSync(navigator.onLine?'work':'err',navigator.onLine?'تم تأمين العملية على الجهاز — جاري رفعها إلى Google':'لا يوجد إنترنت — العملية مؤمنة على الجهاز وسترفع إلى Google تلقائيًا')}return ok};
  window.HP_V37_SYNC={version:VERSION,backendUrl:backendUrl,push:pushPending,pull:pull,checkMeta:checkMeta,markPending:markPending,dataHash:dataHash,pendingCount:pendingCount,state:function(){return clone(state)}};
  window.HP_CONFIRMED_SYNC=window.HP_V37_SYNC;
  window.addEventListener('online',function(){setSync('work','عاد الإنترنت — جاري تأكيد العمليات المعلقة');pushPending(false)});
  window.addEventListener('focus',function(){if(pendingData())pushPending(false);else checkMeta(false)});
  document.addEventListener('visibilitychange',function(){if(!document.hidden){if(pendingData())pushPending(false);else checkMeta(false)}});
  document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,80);setTimeout(function(){hideLoading();onePage()},5000)});
  window.addEventListener('load',function(){setTimeout(function(){hideLoading();onePage();if(!booted)boot()},800)});
  setTimeout(function(){hideLoading();onePage();if(!booted)boot()},6500);
})();
