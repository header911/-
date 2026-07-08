/* ===== V51 Mobile UX Upgrade =====
   Frontend-only patch. Keeps V50 Backup/Sync/Data Guard untouched.
   Adds mobile quick actions, safer drawer close, mobile back helper and touch polish.
*/
(function(){
  'use strict';
  var VERSION='52.0.0-reports-pro';
  var SITE_VERSION='53_2postaudit';
  var booted=false;
  function $(id){return document.getElementById(id)}
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))}
  function isMobile(){try{return window.matchMedia('(max-width: 720px)').matches}catch(e){return window.innerWidth<=720}}
  function toastSafe(msg){try{if(typeof window.toast==='function')window.toast(msg);else console.log(msg)}catch(e){}}
  function closeFab(){var f=$('hp-v52-fab');if(f)f.classList.remove('open')}
  function anyDrawerOpen(){return !!document.querySelector('.overlay.open,.drawer-root.open,.modal.open')}
  function closeTopDrawer(){
    var overlays=qa('.overlay.open,.drawer-root.open,.modal.open');
    var top=overlays[overlays.length-1];
    if(top){try{if(top.id&&typeof window.closeDrawer==='function')window.closeDrawer(top.id);else top.classList.remove('open')}catch(e){top.classList.remove('open')}return true;}
    return false;
  }
  function pageNameAr(name){return ({home:'الرئيسية',orders:'الأوردرات',clients:'العملاء',factories:'المصانع',reports:'التقارير'})[name||window.activePage]||'الرئيسية'}
  function doAction(kind){
    closeFab();
    try{
      if(kind==='order'){ if(typeof window.openOrderForm==='function') window.openOrderForm(); return; }
      if(kind==='client'){ if(typeof window.openClientForm==='function') window.openClientForm(); else if(typeof window.openDrawer==='function') window.openDrawer('dr-client'); return; }
      if(kind==='sync'){ if(typeof window.openSync==='function') window.openSync(); return; }
      if(kind==='home'){ if((window.activePage||'home')!=='home' && typeof window.showPage==='function') window.showPage('home',document.querySelector(".nb[onclick*='home']")); window.scrollTo({top:0,behavior:'smooth'}); return; }
      if(kind==='top'){ window.scrollTo({top:0,behavior:'smooth'}); return; }
    }catch(e){toastSafe('تعذر تنفيذ الأمر')}
  }
  function injectStyle(){
    if($('hp-v52-style'))return;
    var st=document.createElement('style'); st.id='hp-v52-style';
    st.textContent='\n/* V51 Mobile UX */\n'
      +'@media(max-width:720px){'
      +'html,body{overscroll-behavior-y:contain!important;-webkit-tap-highlight-color:transparent!important}'
      +'.app{min-height:100dvh!important}'
      +'.drawer{max-height:96dvh!important;padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:110px!important}'
      +'.overlay.open{align-items:stretch!important;justify-content:flex-end!important;background:rgba(0,0,0,.38)!important}'
      +'.field input,.field select,.field textarea{touch-action:manipulation!important}'
      +'.btn,.chip,.mt-btn,.nb,.topbar-btn{touch-action:manipulation!important;user-select:none!important}'
      +'.table-wrap{position:relative!important;box-shadow:inset -10px 0 0 rgba(0,0,0,.06)!important}'
      +'.table-wrap:before{content:"اسحب يمين/شمال لرؤية باقي الجدول";display:block;background:#fff6df;border-bottom:3px solid #000;padding:8px 10px;font-size:15px;font-weight:900;color:#000!important}'
      +'.hp-v52-fab{position:fixed;right:16px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:1900;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}'
      +'.hp-v52-fab-panel{display:none;flex-direction:column;gap:8px;align-items:stretch;min-width:210px;pointer-events:auto}'
      +'.hp-v52-fab.open .hp-v52-fab-panel{display:flex}'
      +'.hp-v52-fab button{font-family:inherit!important;font-weight:900!important;border:4px solid #000!important;border-radius:18px!important;background:#fff!important;color:#000!important;box-shadow:0 4px 0 #000!important;min-height:54px!important;padding:10px 14px!important;font-size:17px!important}'
      +'.hp-v52-fab-main{width:64px!important;height:64px!important;border-radius:50%!important;background:#000!important;color:#fff!important;font-size:28px!important;display:flex!important;align-items:center!important;justify-content:center!important;pointer-events:auto}'
      +'.hp-v52-fab-panel button{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;text-align:right!important;background:#fff!important}'
      +'.hp-v52-fab-panel button.primary{background:#000!important;color:#fff!important}'
      +'body.hp-v52-drawer-open .hp-v52-fab{display:none!important}'
      +'.hp-v52-closebar{position:sticky;top:0;z-index:30;margin:-8px 0 12px!important;background:#fff!important;border:4px solid #000!important;border-radius:18px!important;padding:8px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;box-shadow:0 3px 0 #000!important}'
      +'.hp-v52-closebar-title{font-size:16px!important;font-weight:900!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000!important}'
      +'.hp-v52-closebar .btn{min-height:44px!important;font-size:16px!important;padding:8px 12px!important;box-shadow:none!important}'
      +'.hp-v52-page-pill{position:fixed;left:12px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:1850;background:#fff!important;color:#000!important;border:4px solid #000!important;border-radius:18px!important;padding:10px 12px!important;font-weight:900!important;font-size:15px!important;box-shadow:0 4px 0 #000!important;max-width:48vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}'
      +'body.hp-v52-drawer-open .hp-v52-page-pill{display:none!important}'
      +'.toast{bottom:calc(94px + env(safe-area-inset-bottom,0px))!important;z-index:2100!important}'
      +'}'
      +'@media(min-width:721px){.hp-v52-fab,.hp-v52-page-pill{display:none!important}}\n';
    document.head.appendChild(st);
  }
  function ensureFab(){
    if($('hp-v52-fab'))return;
    var wrap=document.createElement('div'); wrap.id='hp-v52-fab'; wrap.className='hp-v52-fab';
    wrap.innerHTML='<div class="hp-v52-fab-panel">'
      +'<button class="primary" type="button" data-hp-v52="order"><i class="ti ti-plus"></i> أوردر جديد</button>'
      +'<button type="button" data-hp-v52="client"><i class="ti ti-user-plus"></i> عميل جديد</button>'
      +'<button type="button" data-hp-v52="sync"><i class="ti ti-cloud-check"></i> مزامنة وحماية</button>'
      +'<button type="button" data-hp-v52="home"><i class="ti ti-home"></i> الرئيسية / أعلى</button>'
      +'</div><button class="hp-v52-fab-main" type="button" aria-label="أوامر سريعة"><i class="ti ti-menu-2"></i></button>';
    document.body.appendChild(wrap);
    wrap.querySelector('.hp-v52-fab-main').addEventListener('click',function(e){e.preventDefault();wrap.classList.toggle('open')});
    qa('[data-hp-v52]',wrap).forEach(function(b){b.addEventListener('click',function(e){e.preventDefault();doAction(b.getAttribute('data-hp-v52'))})});
    document.addEventListener('click',function(e){if(wrap.classList.contains('open')&&!wrap.contains(e.target))closeFab()},true);
  }
  function ensurePagePill(){
    var p=$('hp-v52-page-pill');
    if(!p){p=document.createElement('div');p.id='hp-v52-page-pill';p.className='hp-v52-page-pill';document.body.appendChild(p)}
    p.textContent='أنت في: '+pageNameAr(window.activePage||'home');
  }
  function titleForDrawer(drawer,overlay){
    var t=drawer.querySelector('.drawer-title');
    if(t)return (t.textContent||'').trim().slice(0,40)||'رجوع';
    if(overlay&&overlay.id==='dr-order')return 'الأوردر';
    if(overlay&&overlay.id==='dr-client')return 'العميل';
    if(overlay&&overlay.id==='dr-sync')return 'المزامنة والحماية';
    return 'الرجوع';
  }
  function enhanceOpenDrawers(){
    var open=qa('.overlay.open');
    document.body.classList.toggle('hp-v52-drawer-open',open.length>0);
    open.forEach(function(ov){
      var drawer=ov.querySelector('.drawer')||ov;
      if(!drawer||drawer.querySelector('.hp-v52-closebar'))return;
      var bar=document.createElement('div');bar.className='hp-v52-closebar';
      bar.innerHTML='<button class="btn" type="button"><i class="ti ti-arrow-right"></i> رجوع</button><div class="hp-v52-closebar-title">'+titleForDrawer(drawer,ov).replace(/[<>&]/g,'')+'</div>';
      bar.querySelector('button').addEventListener('click',function(e){e.preventDefault();try{if(ov.id&&typeof window.closeDrawer==='function')window.closeDrawer(ov.id);else ov.classList.remove('open')}catch(_){ov.classList.remove('open')}setTimeout(enhanceOpenDrawers,60)});
      drawer.insertBefore(bar,drawer.firstChild);
    });
  }
  function wrapNavAndDrawers(){
    var oldShow=window.showPage;
    if(typeof oldShow==='function'&&!oldShow.__hpV52){
      var wrapped=function(){var r=oldShow.apply(this,arguments);closeFab();setTimeout(ensurePagePill,60);try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){}return r};
      wrapped.__hpV52=true;wrapped.__hpOriginal=oldShow;window.showPage=wrapped;
    }
    var oldOpen=window.openDrawer;
    if(typeof oldOpen==='function'&&!oldOpen.__hpV52){
      var openWrapped=function(){var r=oldOpen.apply(this,arguments);closeFab();setTimeout(enhanceOpenDrawers,60);setTimeout(enhanceOpenDrawers,350);return r};
      openWrapped.__hpV52=true;openWrapped.__hpOriginal=oldOpen;window.openDrawer=openWrapped;
    }
    var oldClose=window.closeDrawer;
    if(typeof oldClose==='function'&&!oldClose.__hpV52){
      var closeWrapped=function(){var r=oldClose.apply(this,arguments);setTimeout(enhanceOpenDrawers,60);return r};
      closeWrapped.__hpV52=true;closeWrapped.__hpOriginal=oldClose;window.closeDrawer=closeWrapped;
    }
  }
  function setupBackHelper(){
    if(window.__HP_V51_BACK_HELPER)return; window.__HP_V51_BACK_HELPER=true;
    window.hpV52MobileBack=function(){
      if(closeTopDrawer()){setTimeout(enhanceOpenDrawers,80);return true;}
      if((window.activePage||'home')!=='home'&&typeof window.showPage==='function'){
        window.showPage('home',document.querySelector(".nb[onclick*='home']"));return true;
      }
      toastSafe('أنت بالفعل في الصفحة الرئيسية');return true;
    };
  }
  function boot(){
    if(booted)return;booted=true;
    injectStyle();ensureFab();ensurePagePill();wrapNavAndDrawers();setupBackHelper();enhanceOpenDrawers();
    setInterval(function(){if(isMobile()){ensurePagePill();enhanceOpenDrawers()}},1800);
    try{console.log('Haydar Pack V51 Mobile UX loaded',VERSION,SITE_VERSION)}catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,600)});
  window.addEventListener('load',function(){setTimeout(boot,900)});
  window.addEventListener('popstate',function(){setTimeout(function(){ensurePagePill();enhanceOpenDrawers()},120)},true);
  setTimeout(boot,1800);
  window.HP_V51_MOBILE_UX={version:VERSION,siteVersion:SITE_VERSION,back:function(){return window.hpV52MobileBack&&window.hpV52MobileBack()},refresh:function(){ensurePagePill();enhanceOpenDrawers()}};
  window.HP_V52_MOBILE_UX=window.HP_V51_MOBILE_UX;
})();
/* ===== END V51 Mobile UX Upgrade ===== */
