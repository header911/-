/* Haydar Pack V53.3 - Mobile UX Guard
   Keeps V50/V49 protections. Removes the floating quick-action button completely.
   Adds reliable Android/iOS browser Back handling inside the PWA/browser page. */
(function(){
  'use strict';
  var VERSION='53.3.0-mobile-back-no-fab';
  var SITE_VERSION='54docspro';
  var booted=false, suppressNavStack=false;
  var pageStack=[];
  function $(id){return document.getElementById(id)}
  function qa(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel))}
  function isMobile(){try{return window.matchMedia('(max-width: 720px)').matches}catch(e){return window.innerWidth<=720}}
  function toastSafe(msg){try{if(typeof window.toast==='function')window.toast(msg);else console.log(msg)}catch(e){}}
  function page(){return window.activePage||'home'}
  function pageBtn(name){return document.querySelector(".nb[onclick*='"+String(name).replace(/'/g,'')+"']")||document.querySelector('.nb')}
  function safeShowPage(name){
    try{
      suppressNavStack=true;
      if(typeof window.showPage==='function') window.showPage(name,pageBtn(name));
      window.activePage=name;
    }catch(e){try{window.activePage=name}catch(_){}}
    finally{suppressNavStack=false; setTimeout(function(){updateDrawerState()},80)}
  }
  function topModal(){var m=qa('.hp-v53-modal.active,.modal.active,.modal.open');return m[m.length-1]||null}
  function closeTopModal(){var m=topModal(); if(!m)return false; try{m.classList.remove('active');m.classList.remove('open')}catch(e){} return true}
  function closeTopDrawer(){
    var overlays=qa('.overlay.open,.drawer-root.open');
    var top=overlays[overlays.length-1];
    if(top){try{if(top.id&&typeof window.closeDrawer==='function')window.closeDrawer(top.id);else top.classList.remove('open')}catch(e){try{top.classList.remove('open')}catch(_){}}return true;}
    return false;
  }
  function titleForDrawer(drawer,overlay){
    var t=drawer&&drawer.querySelector&&drawer.querySelector('.drawer-title');
    if(t)return (t.textContent||'').trim().slice(0,40)||'رجوع';
    if(overlay&&overlay.id==='dr-order')return 'الأوردر';
    if(overlay&&overlay.id==='dr-client')return 'العميل';
    if(overlay&&overlay.id==='dr-sync')return 'المزامنة والحماية';
    return 'الرجوع';
  }
  function injectStyle(){
    if($('hp-v533-mobile-style'))return;
    var st=document.createElement('style'); st.id='hp-v533-mobile-style';
    st.textContent='\n/* V53.3 Mobile UX without floating FAB */\n'
      +'@media(max-width:720px){'
      +'html,body{overscroll-behavior-y:contain!important;-webkit-tap-highlight-color:transparent!important}'
      +'.app{min-height:100dvh!important}'
      +'.drawer{max-height:96dvh!important;padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:90px!important}'
      +'.overlay.open{align-items:stretch!important;justify-content:flex-end!important;background:rgba(0,0,0,.38)!important}'
      +'.field input,.field select,.field textarea{touch-action:manipulation!important}'
      +'.btn,.chip,.mt-btn,.nb,.topbar-btn{touch-action:manipulation!important;user-select:none!important}'
      +'.table-wrap{position:relative!important;box-shadow:inset -10px 0 0 rgba(0,0,0,.06)!important}'
      +'.table-wrap:before{content:"اسحب يمين/شمال لرؤية باقي الجدول";display:block;background:#fff6df;border-bottom:3px solid #000;padding:8px 10px;font-size:15px;font-weight:900;color:#000!important}'
      +'.hp-v52-closebar{position:sticky;top:0;z-index:30;margin:-8px 0 12px!important;background:#fff!important;border:4px solid #000!important;border-radius:18px!important;padding:8px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;box-shadow:0 3px 0 #000!important}'
      +'.hp-v52-closebar-title{font-size:16px!important;font-weight:900!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#000!important}'
      +'.hp-v52-closebar .btn{min-height:44px!important;font-size:16px!important;padding:8px 12px!important;box-shadow:none!important}'
      +'.toast{bottom:calc(28px + env(safe-area-inset-bottom,0px))!important;z-index:2100!important}'
      +'}\n';
    document.head.appendChild(st);
  }
  function updateDrawerState(){
    var open=qa('.overlay.open');
    document.body.classList.toggle('hp-v52-drawer-open',open.length>0);
    open.forEach(function(ov){
      var drawer=ov.querySelector('.drawer')||ov;
      if(!drawer||drawer.querySelector('.hp-v52-closebar'))return;
      var bar=document.createElement('div');bar.className='hp-v52-closebar';
      bar.innerHTML='<button class="btn" type="button"><i class="ti ti-arrow-right"></i> رجوع</button><div class="hp-v52-closebar-title"></div>';
      var title=bar.querySelector('.hp-v52-closebar-title'); if(title)title.textContent=titleForDrawer(drawer,ov);
      bar.querySelector('button').addEventListener('click',function(e){e.preventDefault();closeTopDrawer();setTimeout(updateDrawerState,60)});
      drawer.insertBefore(bar,drawer.firstChild);
    });
  }
  function pushGuard(){
    if(!isMobile())return;
    try{
      var st=history.state||{};
      if(!st || !st.hpV533Guard){history.pushState({hpV533Guard:true,page:page(),t:Date.now()},'',location.href)}
    }catch(e){}
  }
  function initStack(){
    var p=page();
    if(!pageStack.length)pageStack=[p||'home'];
  }
  function wrapNavAndDrawers(){
    var oldShow=window.showPage;
    if(typeof oldShow==='function'&&!oldShow.__hpV533){
      var wrapped=function(name,btn){
        var before=page();
        var r=oldShow.apply(this,arguments);
        var after=name||page();
        if(!suppressNavStack&&after&&after!==before){pageStack.push(after); if(pageStack.length>30)pageStack=pageStack.slice(-30); pushGuard();}
        setTimeout(updateDrawerState,60);
        try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){}
        return r;
      };
      wrapped.__hpV533=true;wrapped.__hpOriginal=oldShow;window.showPage=wrapped;
    }
    var oldOpen=window.openDrawer;
    if(typeof oldOpen==='function'&&!oldOpen.__hpV533){
      var openWrapped=function(){var r=oldOpen.apply(this,arguments);setTimeout(updateDrawerState,60);setTimeout(updateDrawerState,350);pushGuard();return r};
      openWrapped.__hpV533=true;openWrapped.__hpOriginal=oldOpen;window.openDrawer=openWrapped;
    }
    var oldClose=window.closeDrawer;
    if(typeof oldClose==='function'&&!oldClose.__hpV533){
      var closeWrapped=function(){var r=oldClose.apply(this,arguments);setTimeout(updateDrawerState,60);return r};
      closeWrapped.__hpV533=true;closeWrapped.__hpOriginal=oldClose;window.closeDrawer=closeWrapped;
    }
  }
  function mobileBack(){
    if(closeTopModal()){setTimeout(updateDrawerState,80);return true;}
    if(closeTopDrawer()){setTimeout(updateDrawerState,80);return true;}
    initStack();
    if(pageStack.length>1){
      pageStack.pop();
      var prev=pageStack[pageStack.length-1]||'home';
      safeShowPage(prev);
      return true;
    }
    if(page()!=='home'){
      pageStack=['home'];
      safeShowPage('home');
      return true;
    }
    pageStack=['home'];
    safeShowPage('home');
    toastSafe('أنت في الصفحة الرئيسية');
    return true;
  }
  function setupHardwareBack(){
    if(window.__HP_V533_BACK_GUARD)return; window.__HP_V533_BACK_GUARD=true;
    try{history.replaceState({hpV533Root:true,page:page()},'',location.href); pushGuard();}catch(e){}
    window.addEventListener('popstate',function(){
      setTimeout(function(){
        try{mobileBack()}catch(e){}
        try{pushGuard()}catch(e){}
      },20);
    },true);
  }
  function boot(){
    if(booted)return;booted=true;
    injectStyle();initStack();wrapNavAndDrawers();setupHardwareBack();updateDrawerState();
    setInterval(function(){if(isMobile())updateDrawerState()},1800);
    try{console.log('Haydar Pack V53.3 Mobile UX Guard loaded',VERSION,SITE_VERSION)}catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(boot,500)});
  window.addEventListener('load',function(){setTimeout(boot,700)});
  setTimeout(boot,1400);
  window.HP_V51_MOBILE_UX={version:VERSION,siteVersion:SITE_VERSION,back:mobileBack,refresh:function(){updateDrawerState()},floatingRemoved:true};
  window.HP_V52_MOBILE_UX=window.HP_V51_MOBILE_UX;
})();
