(function (HP) {
  'use strict';

  if (!HP) throw new Error('HaydarPack core is required');

  var $ = HP.ui.element;
  var esc = HP.util.escapeHtml;
  var backups = [];
  var swVersion = 'غير مسجل';

  /*
    Isolated V57 recovery adapter.
    It only reads the legacy browser stores and can export them. It never removes
    legacy keys and never sends a legacy full-state JSON to Apps Script.
  */
  var LEGACY_PENDING_KEYS = [
    'hayder_pack_sync_pending_v37',
    'hayder_pack_stage4_pending_v32',
    'hayder_pack_pwa_pending_v10',
    'hayder_pack_unsynced_v9'
  ];
  var LEGACY_META_KEYS = [
    'hayder_pack_sync_meta_v37',
    'hayder_pack_stage4_meta_v32',
    'hayder_pack_pwa_meta_v10',
    'hayder_pack_cloud_meta_v9',
    'hayder_pack_save_confirm_log_v49_1',
    'hayder_pack_error_log_v49',
    'hayder_pack_v39_last_safe_snapshot',
    'hayder_pack_v39_last_safe_snapshot_meta'
  ];
  var LEGACY_LOCAL_KEY = 'hayder_bags_app';
  var LEGACY_IMAGE_INDEX_KEY = 'hayder_pack_v40_image_index';
  var LEGACY_IMAGE_QUEUE_KEY = 'hayder_pack_v40_image_queue';
  var LEGACY_IMAGE_PREFIX = 'hayder_pack_v40_image_';
  var LEGACY_COLLECTIONS = [
    ['clients', 'العملاء'], ['factories', 'المصانع'], ['orders', 'الأوردرات'], ['payments', 'دفعات العملاء'],
    ['transfers', 'تحويلات المصانع'], ['expenses', 'مصروفات التشغيل'], ['capitalMoves', 'حركات رأس المال'],
    ['houseExpenses', 'مصروفات البيت'], ['walletAdjustments', 'تسويات السيولة'], ['documents', 'المستندات'],
    ['deletedItems', 'المحذوفات'], ['deletedLog', 'سجل الحذف'], ['deletedArchive', 'أرشيف الحذف']
  ];
  var LEGACY_OBJECTS = [['settings', 'الإعدادات'], ['factoryViews', 'عرض المصانع'], ['clientNotes', 'ملاحظات العملاء'], ['documentCounters', 'عدادات المستندات']];

  function readLegacy(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null || raw === '' ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canonical(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }

  function legacyFingerprint(pending, legacyData) {
    var identity = (pending || []).map(function (item) {
      var value = item.value || {};
      return [item.key, value.id || '', value.hash || '', value.localUpdatedAt || '', value.baseRevision == null ? '' : value.baseRevision].join('|');
    }).join('||') + '||' + canonical(legacyData || {});
    var first = 2166136261, second = 2246822519;
    for (var index = 0; index < identity.length; index += 1) {
      first = Math.imul(first ^ identity.charCodeAt(index), 16777619);
      second = Math.imul(second ^ identity.charCodeAt(index), 3266489917);
    }
    return identity.length.toString(36) + '-' + (first >>> 0).toString(16) + '-' + (second >>> 0).toString(16);
  }

  function recordKey(record, index) {
    if (record && record.id != null && record.id !== '') return String(record.id);
    return '__index_' + index;
  }

  function collectionDiff(legacyRows, confirmedRows) {
    legacyRows = Array.isArray(legacyRows) ? legacyRows : [];
    confirmedRows = Array.isArray(confirmedRows) ? confirmedRows : [];
    var legacyMap = {}, confirmedMap = {};
    legacyRows.forEach(function (row, index) { legacyMap[recordKey(row, index)] = row; });
    confirmedRows.forEach(function (row, index) { confirmedMap[recordKey(row, index)] = row; });
    var added = [], removed = [], changed = [];
    Object.keys(legacyMap).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(confirmedMap, key)) added.push(key);
      else if (canonical(legacyMap[key]) !== canonical(confirmedMap[key])) changed.push(key);
    });
    Object.keys(confirmedMap).forEach(function (key) { if (!Object.prototype.hasOwnProperty.call(legacyMap, key)) removed.push(key); });
    return {added: added, removed: removed, changed: changed, total: added.length + removed.length + changed.length};
  }

  function buildLegacyDiff(legacyData, confirmedData) {
    legacyData = legacyData || {};
    confirmedData = confirmedData || {};
    var rows = [], total = 0;
    LEGACY_COLLECTIONS.forEach(function (item) {
      var result = collectionDiff(legacyData[item[0]], confirmedData[item[0]]);
      if (result.total) rows.push({key: item[0], label: item[1], added: result.added.length, removed: result.removed.length, changed: result.changed.length, total: result.total, ids: {added: result.added.slice(0, 10), removed: result.removed.slice(0, 10), changed: result.changed.slice(0, 10)}});
      total += result.total;
    });
    LEGACY_OBJECTS.forEach(function (item) {
      if (canonical(legacyData[item[0]] || {}) !== canonical(confirmedData[item[0]] || {})) {
        rows.push({key: item[0], label: item[1], added: 0, removed: 0, changed: 1, total: 1, ids: {changed: ['object']}});
        total += 1;
      }
    });
    return {total: total, rows: rows};
  }

  function inspectLegacy() {
    var pending = [];
    LEGACY_PENDING_KEYS.forEach(function (key) {
      var value = readLegacy(key, null);
      if (value) pending.push({key: key, value: value});
    });
    var imageQueue = readLegacy(LEGACY_IMAGE_QUEUE_KEY, []);
    var localData = readLegacy(LEGACY_LOCAL_KEY, null);
    var pendingData = null;
    for (var index = 0; index < pending.length && !pendingData; index += 1) {
      var value = pending[index].value || {};
      pendingData = value.data || value.local || null;
    }
    var legacyData = pendingData || localData;
    var signature = pending.length ? legacyFingerprint(pending, legacyData) : '';
    var proof = signature ? HP.store.recoveryProofs().find(function (item) { return item && item.signature === signature; }) || null : null;
    HP.runtime.legacyRecovery = {
      detected: pending.length > 0,
      blocking: pending.length > 0 && !proof,
      compared: !!proof,
      pendingCount: pending.length,
      pending: pending,
      legacyData: legacyData,
      localDataAvailable: !!localData,
      imageQueueCount: Array.isArray(imageQueue) ? imageQueue.length : 0,
      diff: null,
      signature: signature,
      resolvedEquivalent: !!proof,
      proof: proof
    };
    renderLegacy();
    return HP.runtime.legacyRecovery;
  }

  function reconcileLegacy(confirmedData) {
    var status = HP.runtime.legacyRecovery || inspectLegacy();
    if (!status.detected) { status.blocking = false; renderLegacy(); return status; }
    if (status.resolvedEquivalent) { status.blocking = false; status.compared = true; renderLegacy(); return status; }
    if (!status.legacyData || !confirmedData) { status.blocking = true; status.compared = false; renderLegacy(); return status; }
    status.diff = buildLegacyDiff(status.legacyData, confirmedData);
    status.compared = true;
    status.blocking = status.diff.total > 0;
    if (!status.blocking) {
      var confirmed = HP.store.getConfirmed();
      status.proof = {signature: status.signature, confirmedRevision: confirmed && confirmed.revision || 0, confirmedStateHash: confirmed && confirmed.stateHash || '', verifiedAt: HP.util.now()};
      status.resolvedEquivalent = true;
      HP.store.writeRecoveryProof(status.proof);
    }
    renderLegacy();
    return status;
  }

  function legacyMetaText(status) {
    var first = status.pending[0] && status.pending[0].value || {};
    var parts = [];
    if (first.reason) parts.push('السبب: ' + first.reason);
    if (first.baseRevision != null) parts.push('مراجعة البداية: ' + first.baseRevision);
    if (first.localUpdatedAt) parts.push('وقت التعديل: ' + first.localUpdatedAt);
    if (first.attempts != null) parts.push('محاولات الرفع القديمة: ' + first.attempts);
    return parts.join(' • ');
  }

  function renderLegacy() {
    var status = HP.runtime.legacyRecovery;
    var banner = $('legacy-recovery-banner');
    var bannerText = $('legacy-recovery-banner-text');
    var panel = $('legacy-recovery-panel');
    if (!status || !status.detected) {
      if (banner) banner.classList.add('hide');
      if (panel) panel.classList.add('hide');
      return;
    }
    if (banner) {
      banner.classList.remove('hide');
      banner.classList.toggle('safe', status.compared && !status.blocking);
    }
    if (bannerText) bannerText.textContent = status.resolvedEquivalent ? 'تم إثبات تطابق السجل القديم مع Google' + (status.proof && status.proof.confirmedRevision ? ' في المراجعة ' + status.proof.confirmedRevision : '') + '، ولن يُرفع كنسخة كاملة.' : status.compared ? 'وجدنا فروقًا فعلية. تم إيقاف الحفظ الجديد حتى تُراجع حزمة الاسترداد.' : 'تم إيقاف أي حفظ جديد حتى تتم مقارنة التعديل ببيانات Google.';
    if (!panel) return;
    panel.classList.remove('hide');
    panel.classList.toggle('safe', status.compared && !status.blocking);
    var diffHtml = '';
    if (status.diff && status.diff.rows.length) {
      diffHtml = '<div class="legacy-diff-grid">' + status.diff.rows.map(function (row) {
        return '<div><b>' + esc(row.label) + '</b><span>جديد محليًا: ' + row.added + ' • غير موجود محليًا: ' + row.removed + ' • مختلف: ' + row.changed + '</span></div>';
      }).join('') + '</div>';
    }
    var title = status.resolvedEquivalent ? 'تم إثبات أن سجل V57 موجود بالفعل على Google' : 'تعديل V57 غير مؤكد يحتاج استردادًا آمنًا';
    var differenceText = status.diff && status.diff.total === 1 ? 'يوجد فرق واحد' : 'توجد ' + (status.diff && status.diff.total || 0) + ' فروق';
    var explanation = status.resolvedEquivalent ? 'تم حفظ بصمة الإثبات محليًا' + (status.proof && status.proof.confirmedRevision ? ' عند المراجعة ' + status.proof.confirmedRevision : '') + '. ستظل صالحة بعد العمليات الجديدة، وأبقينا مفاتيح V57 كما هي ولم نحذفها.' : status.compared ? differenceText + ' بين نسخة V57 المحلية والحالة المؤكدة. لن نرفع قاعدة المتصفح كاملة ولن نمسح السجل.' : 'تعذر إجراء المقارنة حتى تصل الحالة المؤكدة من Google. أي كتابة جديدة موقوفة مؤقتًا.';
    panel.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(explanation) + '</p>' + diffHtml + '<p class="tiny">سجلات V57 المعلقة: ' + status.pendingCount + ' • صور قديمة في انتظار الرفع: ' + status.imageQueueCount + (legacyMetaText(status) ? '<br>' + esc(legacyMetaText(status)) : '') + '</p><div class="btn-row"><button class="btn amber" type="button" data-action="legacy-download">تنزيل حزمة استرداد V57</button><button class="btn" type="button" data-action="legacy-recompare">إعادة المقارنة مع Google</button></div><p class="tiny"><b>مهم:</b> لا تستخدم زر المزامنة في V57 ولا تمسح بيانات المتصفح قبل تنزيل الحزمة ومراجعة الفروق.</p>';
  }

  function collectLegacyBundle() {
    var status = HP.runtime.legacyRecovery || inspectLegacy();
    var metadata = {};
    LEGACY_META_KEYS.forEach(function (key) { var value = readLegacy(key, null); if (value != null) metadata[key] = value; });
    var imageIndex = readLegacy(LEGACY_IMAGE_INDEX_KEY, []);
    var images = {};
    if (Array.isArray(imageIndex)) imageIndex.forEach(function (id) { var value = readLegacy(LEGACY_IMAGE_PREFIX + id, null); if (value) images[id] = value; });
    return {
      format: 'HaydarPackV57LocalRecoveryBundle',
      exportedAt: HP.util.now(),
      sourceApplication: 'V57 legacy browser storage',
      safety: 'READ_ONLY_EXPORT_NO_SERVER_UPLOAD',
      comparison: status.diff,
      confirmedEquivalentProof: status.proof,
      pendingStores: status.pending.reduce(function (result, item) { result[item.key] = item.value; return result; }, {}),
      localDatabase: readLegacy(LEGACY_LOCAL_KEY, null),
      metadata: metadata,
      images: {index: imageIndex, queue: readLegacy(LEGACY_IMAGE_QUEUE_KEY, []), items: images}
    };
  }

  function downloadLegacyBundle() {
    var bundle = collectLegacyBundle();
    var blob = new Blob([JSON.stringify(bundle, null, 2)], {type: 'application/json;charset=utf-8'});
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'HaydarPack_V57_LOCAL_RECOVERY_' + HP.util.today() + '.json';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 500);
    HP.ui.toast('تم تنزيل حزمة V57 محليًا دون رفع أي بيانات إلى Google', 'success');
  }

  function assertLegacyWritable(operation) {
    var status = HP.runtime.legacyRecovery;
    if (status && status.blocking) {
      throw HP.errors.create('MUTATION_STATUS_UNKNOWN', 'يوجد تعديل V57 غير مؤكد. نزّل حزمة الاسترداد وراجع الفرق قبل تنفيذ ' + String(operation || 'عملية جديدة') + '.', {legacyPendingCount: status.pendingCount, legacyDifferenceCount: status.diff && status.diff.total});
    }
  }

  function legacyIsBlocking() {
    return !!(HP.runtime.legacyRecovery && HP.runtime.legacyRecovery.blocking);
  }

  function set(id, value) { var node = $(id); if (node) node.textContent = String(value == null || value === '' ? '—' : value); }

  function renderStatus() {
    var confirmed = HP.store.getConfirmed();
    var health = HP.runtime.health || {};
    var lastError = HP.runtime.lastError || HP.diagnostics.list()[0] || null;
    set('status-app-version', HP.version + ' (V58-RC)');
    set('status-backend-version', health.backendVersion || HP.runtime.backendVersion || 'غير متصل');
    set('status-revision', confirmed && confirmed.revision);
    set('status-hash', confirmed && confirmed.stateHash);
    set('status-last-save', confirmed && confirmed.updatedAt || health.lastConfirmedGoogleSave);
    set('status-pending', HP.store.pending().length + (HP.runtime.legacyRecovery && HP.runtime.legacyRecovery.pendingCount || 0));
    set('status-last-error', lastError ? (lastError.category || lastError.code || 'ERROR') + ': ' + (lastError.message || '') : 'لا يوجد');
    set('status-health', health.ok ? 'سليم • ' + (health.environment || 'STAGING') : 'غير متصل');
    set('status-sw-version', swVersion);
    var badge = $('release-badge'); if (badge) badge.textContent = 'V58-RC • rev ' + (confirmed && confirmed.revision || '—');
  }

  async function refreshStatus() {
    try {
      HP.runtime.health = await HP.api.healthCheck();
      HP.runtime.backendVersion = HP.runtime.health.backendVersion || '';
    } catch (error) {
      HP.runtime.health = {ok: false};
      HP.runtime.lastError = {category: HP.errors.normalize(error).code, message: HP.errors.normalize(error).message, timestamp: HP.util.now()};
    }
    try {
      var response = await HP.api.read('listBackups', {}, 30000);
      backups = response.backups || [];
      var select = $('backup-select');
      if (select) select.innerHTML = '<option value="">— اختر نسخة رسمية —</option>' + backups.map(function (item) { return '<option value="' + esc(item.fileId) + '">مراجعة ' + esc(item.revision) + ' • ' + esc(item.createdAt) + (item.reason ? ' • ' + esc(item.reason) : '') + '</option>'; }).join('');
    } catch (error) {
      backups = [];
    }
    renderStatus();
  }

  function downloadConfirmed() {
    var confirmed = HP.store.getConfirmed();
    if (!confirmed) throw HP.errors.create('STATE_VALIDATION_FAILED', 'لا توجد حالة مؤكدة للتنزيل');
    var exportObject = {format: 'HaydarPackV58EmergencyConfirmedCopy', exportedAt: HP.util.now(), applicationVersion: HP.version, revision: confirmed.revision, stateHash: confirmed.stateHash, schemaVersion: confirmed.schemaVersion, counts: confirmed.counts, controls: confirmed.controls, data: confirmed.data};
    var blob = new Blob([JSON.stringify(exportObject, null, 2)], {type: 'application/json;charset=utf-8'});
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'HaydarPack_V58_rev_' + confirmed.revision + '_' + HP.util.today() + '.json'; document.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 500);
  }

  async function createBackup(button) {
    button.disabled = true;
    try {
      var response = await HP.actions.auxiliary('createBackup', {}, {mutationId: HP.util.uid('mutation-backup'), formKey: 'backup-center'});
      HP.ui.toast('تم إنشاء نسخة رسمية مؤكدة على Google', 'success');
      var message = $('backup-result'); if (message) { message.className = 'alert green'; message.textContent = 'تم إنشاء ' + response.fileName + ' للمراجعة ' + response.revision; }
      await refreshStatus();
    } finally { button.disabled = false; }
  }

  async function restoreBackup(button) {
    var fileId = $('backup-select') && $('backup-select').value;
    var selected = backups.find(function (item) { return item.fileId === fileId; });
    if (!selected) throw HP.errors.create('INVALID_PAYLOAD', 'اختر نسخة احتياطية رسمية');
    if (!window.confirm('سيتم أولًا إنشاء نسخة قبل الاسترجاع، ثم استرجاع مراجعة ' + selected.revision + ' داخل مراجعة جديدة. هل تريد المتابعة؟')) return;
    button.disabled = true;
    try {
      var response = await HP.actions.auxiliary('restoreBackup', {backupFileId: selected.fileId}, {mutationId: HP.util.uid('mutation-restore-backup'), formKey: 'backup-restore'});
      HP.ui.toast('تم الاسترجاع على Google داخل مراجعة جديدة ' + response.revision, 'success');
      await refreshStatus();
    } finally { button.disabled = false; }
  }

  async function handle(action, button) {
    if (action === 'legacy-review') { HP.ui.openDrawer('dr-sync'); renderLegacy(); return; }
    if (action === 'legacy-download') return downloadLegacyBundle();
    if (action === 'legacy-recompare') { var confirmed = HP.store.getConfirmed(); reconcileLegacy(confirmed && confirmed.data); renderStatus(); HP.ui.toast(legacyIsBlocking() ? 'ما زالت هناك فروق تحتاج مراجعة' : 'تمت المقارنة ولا توجد فروق في بيانات العمل', legacyIsBlocking() ? 'warn' : 'success'); return; }
    if (action === 'backup-refresh') return refreshStatus();
    if (action === 'backup-create') return createBackup(button);
    if (action === 'backup-restore') return restoreBackup(button);
    if (action === 'backup-download-confirmed') return downloadConfirmed();
    if (action === 'backup-resolve-pending') { await HP.actions.resolvePending(); await HP.actions.refreshState(); renderStatus(); HP.ui.toast('تمت مراجعة العمليات المعلقة', 'success'); }
    if (action === 'backup-safe-reload') return HP.ui.safeReload();
    if (action === 'backup-update-app') { if (navigator.serviceWorker) { var registration = await navigator.serviceWorker.getRegistration(); if (registration) await registration.update(); } return HP.ui.safeReload(); }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) { swVersion = 'غير مدعوم'; renderStatus(); return; }
    try {
      var registration = await navigator.serviceWorker.register('./sw.js?v=' + HP.releaseToken, {updateViaCache: 'none'});
      await registration.update();
      var worker = registration.active || registration.waiting || registration.installing;
      if (worker) worker.postMessage({type: 'GET_VERSION'});
      swVersion = 'V58-RC مسجل';
    } catch (error) {
      swVersion = 'فشل التسجيل';
      HP.diagnostics.log('SERVICE_WORKER_ERROR', error, {});
    }
    renderStatus();
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'VERSION') { swVersion = event.data.version || 'غير معروف'; renderStatus(); }
  });

  HP.events.on('pending:changed', renderStatus);
  HP.events.on('diagnostics:changed', renderStatus);
  HP.events.on('state:confirmed', function (state) { reconcileLegacy(state && state.data); renderStatus(); });
  HP.events.on('app:ready', function () { registerServiceWorker(); refreshStatus(); });
  HP.legacyRecovery = {inspect: inspectLegacy, reconcile: reconcileLegacy, isBlocking: legacyIsBlocking, assertWritable: assertLegacyWritable, render: renderLegacy, diff: buildLegacyDiff, exportBundle: collectLegacyBundle};
  HP.backup = {handle: handle, refreshStatus: refreshStatus, renderStatus: renderStatus, registerServiceWorker: registerServiceWorker};
})(window.HaydarPack);
