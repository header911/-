(function (HP) {
  'use strict';

  if (!HP) throw new Error('HaydarPack core is required');

  function backendUrl() {
    var url = String(HP.config.backendUrl || '').trim().replace(/\s+/g, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/(?:exec|dev)$/i.test(url)) {
      throw HP.errors.create('BACKEND_UNREACHABLE', 'رابط Apps Script الخاص ببيئة V58-RC غير مضبوط');
    }
    return url;
  }

  function jsonp(action, params, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var callback = 'hpV58_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
      var query = new URLSearchParams(Object.assign({}, params || {}, {
        action: action,
        callback: callback,
        appVersion: HP.version,
        _: Date.now()
      }));
      var script = document.createElement('script');
      var finished = false;
      var timer;

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callback]; } catch (error) { window[callback] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callback] = function (response) {
        if (finished) return;
        finished = true;
        cleanup();
        if (response && response.ok === false) reject(HP.errors.normalize(response));
        else resolve(response);
      };
      script.onerror = function () {
        if (finished) return;
        finished = true;
        cleanup();
        reject(HP.errors.create('BACKEND_UNREACHABLE', 'تعذر الوصول إلى Google Apps Script'));
      };
      timer = setTimeout(function () {
        if (finished) return;
        finished = true;
        cleanup();
        reject(HP.errors.create('NETWORK_TIMEOUT', 'انتهت مهلة الاتصال بـ Google'));
      }, timeoutMs || HP.config.requestTimeoutMs);
      script.src = backendUrl() + '?' + query.toString();
      document.head.appendChild(script);
    });
  }

  function postNoCors(action, request) {
    var body = Object.assign({}, request || {}, {action: action, appVersion: HP.version});
    return fetch(backendUrl(), {
      method: 'POST',
      mode: 'no-cors',
      redirect: 'follow',
      cache: 'no-store',
      headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      body: JSON.stringify(body)
    }).catch(function (error) {
      throw HP.errors.create(navigator.onLine ? 'BACKEND_UNREACHABLE' : 'NETWORK_TIMEOUT', navigator.onLine ? 'تعذر إرسال العملية إلى Google' : 'لا يوجد اتصال بالإنترنت');
    });
  }

  function pause(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function getMutationStatus(mutationId) {
    return jsonp('getMutationStatus', {mutationId: mutationId}, 18000);
  }

  async function waitForMutation(mutationId, timeoutMs) {
    var started = Date.now();
    var lastError = null;
    while (Date.now() - started < (timeoutMs || HP.config.mutationTimeoutMs)) {
      try {
        var response = await getMutationStatus(mutationId);
        if (response.status === 'COMMITTED' && response.ok) return response;
        if (response.status === 'REJECTED' || response.ok === false) throw HP.errors.normalize(response);
      } catch (error) {
        lastError = HP.errors.normalize(error);
        if (lastError.code !== 'NETWORK_TIMEOUT' && lastError.code !== 'BACKEND_UNREACHABLE') throw lastError;
      }
      await pause(1400);
    }
    throw HP.errors.create('MUTATION_STATUS_UNKNOWN', 'لم يصل تأكيد نهائي من Google حتى الآن', {mutationId: mutationId, lastError: lastError && lastError.message || ''});
  }

  async function mutate(action, request) {
    var mutationId = String(request && request.mutationId || '');
    if (!mutationId) throw HP.errors.create('INVALID_PAYLOAD', 'mutationId مفقود');
    var post = postNoCors(action, request);
    await Promise.race([post, pause(9000)]).catch(function () {});
    return waitForMutation(mutationId);
  }

  async function getState() {
    return jsonp('getState', {}, 30000);
  }

  async function getRevision() {
    return jsonp('getRevision', {}, 18000);
  }

  async function healthCheck() {
    return jsonp('healthCheck', {}, 18000);
  }

  async function getImage(imageId) {
    return jsonp('getImage', {imageId: imageId}, 30000);
  }

  HP.api = {
    read: jsonp,
    mutate: mutate,
    getMutationStatus: getMutationStatus,
    waitForMutation: waitForMutation,
    getState: getState,
    getRevision: getRevision,
    healthCheck: healthCheck,
    getImage: getImage,
    backendUrl: backendUrl
  };
})(window.HaydarPack);
