(function () {
  'use strict';

  var APP_VERSION = '58.0.0-rc.2';
  var RELEASE_TOKEN = '58rc2';
  var CACHE_KEY = 'haydar_pack_v58_confirmed_state';
  var PENDING_KEY = 'haydar_pack_v58_pending_mutations';
  var DEVICE_KEY = 'haydar_pack_v58_device_id';
  var LOG_KEY = 'haydar_pack_v58_diagnostics';
  var LEGACY_PROOF_KEY = 'haydar_pack_v58_legacy_recovery_proofs';
  var listeners = {};
  var confirmed = null;
  var runtime = {
    backendVersion: '',
    health: null,
    lastError: null,
    booted: false,
    readOnly: true,
    legacyRecovery: null
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function now() {
    return new Date().toISOString();
  }

  function today() {
    return now().slice(0, 10);
  }

  function number(value) {
    var parsed = Number(String(value == null ? '' : value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value) {
    return number(value).toLocaleString('ar-EG', {minimumFractionDigits: 0, maximumFractionDigits: 2}) + ' ج';
  }

  function count(value) {
    return number(value).toLocaleString('ar-EG', {maximumFractionDigits: 2});
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character];
    });
  }

  function attr(value) {
    return escapeHtml(value).replace(/[\r\n]+/g, ' ');
  }

  function uid(prefix) {
    var random = '';
    try { random = crypto.randomUUID().replace(/-/g, ''); }
    catch (error) { random = Date.now().toString(36) + Math.random().toString(36).slice(2); }
    return String(prefix || 'id') + '-' + random.slice(0, 28);
  }

  function deviceId() {
    var id = '';
    try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch (error) {}
    if (!id) {
      id = uid('device');
      try { localStorage.setItem(DEVICE_KEY, id); } catch (error) {}
    }
    return id;
  }

  function on(name, handler) {
    listeners[name] = listeners[name] || [];
    listeners[name].push(handler);
    return function () {
      listeners[name] = (listeners[name] || []).filter(function (item) { return item !== handler; });
    };
  }

  function emit(name, payload) {
    (listeners[name] || []).slice().forEach(function (handler) {
      try { handler(payload); } catch (error) { log('UI_EVENT_ERROR', error, {event: name}); }
    });
  }

  function readJson(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || 'null');
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      log('LOCAL_CACHE_WRITE_FAILED', error, {key: key});
      return false;
    }
  }

  function loadCachedConfirmed() {
    var value = readJson(CACHE_KEY, null);
    if (value && value.data && Number(value.revision) > 0) confirmed = value;
    return clone(confirmed);
  }

  function setConfirmed(response) {
    if (!response || !response.ok || !response.data || !Number(response.revision) || !response.stateHash) {
      throw createError('STATE_VALIDATION_FAILED', 'استجابة الحالة المؤكدة غير صالحة');
    }
    confirmed = {
      revision: Number(response.revision),
      stateHash: String(response.stateHash),
      updatedAt: String(response.updatedAt || response.serverTimestamp || now()),
      backendVersion: String(response.backendVersion || ''),
      schemaVersion: Number(response.schemaVersion) || 58,
      counts: clone(response.counts || {}),
      controls: clone(response.controls || {}),
      data: clone(response.data)
    };
    runtime.backendVersion = confirmed.backendVersion;
    runtime.readOnly = false;
    writeJson(CACHE_KEY, confirmed);
    emit('state:confirmed', clone(confirmed));
    return clone(confirmed);
  }

  function getConfirmed() {
    return clone(confirmed);
  }

  function getData() {
    return clone(confirmed && confirmed.data || blankData());
  }

  function blankData() {
    return {
      clients: [], factories: [], orders: [], payments: [], transfers: [], expenses: [], capitalMoves: [],
      deletedItems: [], deletedLog: [], deletedArchive: [], documents: [], houseExpenses: [], walletAdjustments: [],
      settings: {extraMonths: [], v56Wallet: {}}, factoryViews: {}, clientNotes: {}, documentCounters: {}, _id: 1, version: 11
    };
  }

  function pendingItems() {
    var value = readJson(PENDING_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function writePending(items) {
    writeJson(PENDING_KEY, Array.isArray(items) ? items : []);
    emit('pending:changed', pendingItems());
  }

  function createError(code, message, details) {
    var error = new Error(message || code || 'حدث خطأ');
    error.code = code || 'SERVER_INTERNAL_ERROR';
    error.details = details || null;
    return error;
  }

  function normalizeError(error, fallbackCode) {
    if (error && error.error && error.error.code) return createError(error.error.code, error.error.message, error.error.details);
    if (error && error.code) return error;
    var message = error && error.message || String(error || 'حدث خطأ');
    return createError(fallbackCode || 'SERVER_INTERNAL_ERROR', message);
  }

  function sanitizedMessage(error) {
    var message = String(error && error.message || error || 'حدث خطأ');
    return message.replace(/https?:\/\/[^\s]+/g, '[URL]').slice(0, 500);
  }

  function log(category, error, context) {
    var rows = readJson(LOG_KEY, []);
    if (!Array.isArray(rows)) rows = [];
    rows.unshift({
      timestamp: now(),
      category: String(category || 'UNKNOWN'),
      message: sanitizedMessage(error),
      context: clone(context || {})
    });
    rows = rows.slice(0, 120);
    writeJson(LOG_KEY, rows);
    runtime.lastError = rows[0];
    emit('diagnostics:changed', rows[0]);
  }

  function logs() {
    return readJson(LOG_KEY, []);
  }

  function recoveryProofs() {
    var rows = readJson(LEGACY_PROOF_KEY, []);
    return Array.isArray(rows) ? clone(rows) : [];
  }

  function writeRecoveryProof(proof) {
    if (!proof || !proof.signature) return;
    var rows = recoveryProofs().filter(function (item) { return item && item.signature !== proof.signature; });
    rows.unshift(clone(proof));
    writeJson(LEGACY_PROOF_KEY, rows.slice(0, 20));
  }

  function element(id) {
    return document.getElementById(id);
  }

  function toast(message, kind) {
    var node = element('toast');
    if (!node) return;
    node.textContent = String(message || '');
    node.className = 'toast show ' + (kind || '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.className = 'toast'; }, 3400);
  }

  function setSyncState(status, message) {
    var line = element('sync-status');
    var connection = element('cloud-connection-status');
    var dot = element('sync-dot');
    if (line) {
      line.textContent = String(message || '');
      line.dataset.status = status || '';
    }
    if (connection) connection.textContent = status === 'confirmed' ? 'متصل ومحفوظ على Google' : status === 'saving' ? 'جاري الحفظ على Google' : status === 'error' ? 'توجد مشكلة تحتاج مراجعة' : 'جاري الاتصال';
    if (dot) dot.className = 'sync-dot ' + (status === 'confirmed' ? 'ok' : status === 'saving' ? 'work' : status === 'error' ? 'err' : '');
    emit('sync:status', {status: status, message: message});
  }

  function showLoading(message) {
    var cover = element('cloud-loading-cover');
    var text = element('cloud-loading-text');
    if (text) text.textContent = message || 'جاري تحميل آخر بيانات مؤكدة من Google...';
    if (cover) cover.classList.remove('hide', 'hp-v29-forced-hide');
  }

  function hideLoading() {
    var cover = element('cloud-loading-cover');
    if (cover) cover.classList.add('hide');
  }

  function openDrawer(id) {
    var drawer = element(id);
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.querySelectorAll('input[type="date"]').forEach(function (input) { if (!input.value) input.value = today(); });
  }

  function closeDrawer(id) {
    var drawer = element(id);
    if (!drawer) return;
    if (drawer.dataset.saving === '1') {
      toast('انتظر تأكيد Google قبل إغلاق النموذج', 'warn');
      return;
    }
    drawer.classList.remove('open');
  }

  function safeReload() {
    var url = new URL(location.href);
    url.searchParams.set('v', RELEASE_TOKEN);
    url.searchParams.set('reload', String(Date.now()));
    location.replace(url.toString());
  }

  var HP = {
    version: APP_VERSION,
    releaseToken: RELEASE_TOKEN,
    config: {
      backendUrl: String(window.HP_APPS_SCRIPT_URL || '').trim(),
      requestTimeoutMs: 15000,
      mutationTimeoutMs: 55000
    },
    runtime: runtime,
    util: {clone: clone, now: now, today: today, number: number, money: money, count: count, escapeHtml: escapeHtml, attr: attr, uid: uid, deviceId: deviceId},
    events: {on: on, emit: emit},
    store: {loadCached: loadCachedConfirmed, setConfirmed: setConfirmed, getConfirmed: getConfirmed, getData: getData, blankData: blankData, pending: pendingItems, writePending: writePending, recoveryProofs: recoveryProofs, writeRecoveryProof: writeRecoveryProof},
    errors: {create: createError, normalize: normalizeError},
    diagnostics: {log: log, list: logs},
    ui: {element: element, toast: toast, setSyncState: setSyncState, showLoading: showLoading, hideLoading: hideLoading, openDrawer: openDrawer, closeDrawer: closeDrawer, safeReload: safeReload}
  };

  window.HaydarPack = HP;
  document.addEventListener('DOMContentLoaded', function () { emit('dom:ready'); });
})();
