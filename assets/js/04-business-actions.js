(function (HP) {
  'use strict';

  var locks = {};

  function pendingById(id) {
    return HP.store.pending().find(function (item) { return item.request && item.request.mutationId === id; }) || null;
  }

  function putPending(item) {
    var rows = HP.store.pending().filter(function (value) { return value.request && value.request.mutationId !== item.request.mutationId; });
    rows.unshift(item);
    HP.store.writePending(rows.slice(0, 100));
    return item;
  }

  function removePending(id) {
    HP.store.writePending(HP.store.pending().filter(function (item) { return !item.request || item.request.mutationId !== id; }));
  }

  function updatePending(id, patch) {
    var rows = HP.store.pending();
    rows.forEach(function (item) { if (item.request && item.request.mutationId === id) Object.assign(item, patch || {}); });
    HP.store.writePending(rows);
  }

  function requestFor(operation, payload, options) {
    options = options || {};
    var confirmed = HP.store.getConfirmed();
    if (!confirmed) throw HP.errors.create('STATE_VALIDATION_FAILED', 'لا توجد حالة مؤكدة من Google');
    return {
      action: 'commitMutation',
      appVersion: HP.version,
      mutationId: options.mutationId || HP.util.uid('mutation'),
      deviceId: HP.util.deviceId(),
      baseRevision: confirmed.revision,
      operation: operation,
      entityType: options.entityType || '',
      payload: HP.util.clone(payload || {}),
      createdAt: HP.util.now()
    };
  }

  async function refreshConfirmedState() {
    var state = await HP.api.getState();
    HP.store.setConfirmed(state);
    return state;
  }

  async function execute(action, request, meta) {
    meta = meta || {};
    var id = request.mutationId;
    if (locks[id]) throw HP.errors.create('MUTATION_STATUS_UNKNOWN', 'العملية نفسها ما زالت قيد المتابعة', {mutationId: id});
    locks[id] = true;
    putPending({request: HP.util.clone(request), action: action, formKey: meta.formKey || '', draft: HP.util.clone(meta.draft || null), status: 'PENDING', attempts: Number(meta.attempts || 0), createdAt: request.createdAt || HP.util.now(), lastError: null});
    HP.ui.setSyncState('saving', 'جاري الحفظ على Google');
    HP.events.emit('mutation:saving', {request: request, meta: meta});
    var started = Date.now();
    try {
      updatePending(id, {attempts: Number((pendingById(id) || {}).attempts || 0) + 1, lastAttemptAt: HP.util.now()});
      var response = await HP.api.mutate(action, request);
      removePending(id);
      if (action === 'commitMutation' || action === 'restoreBackup' || action === 'generateDocumentPdf' || action === 'migrateLegacyState') {
        await refreshConfirmedState();
      }
      HP.ui.setSyncState('confirmed', response.revision ? 'تم الحفظ على Google - مراجعة ' + response.revision : 'تم تأكيد العملية من Google');
      HP.events.emit('mutation:confirmed', {request: request, response: response, durationMs: Date.now() - started, meta: meta});
      return response;
    } catch (rawError) {
      var error = HP.errors.normalize(rawError);
      updatePending(id, {status: error.code === 'REVISION_CONFLICT' || error.code === 'VERSION_REJECTED' || error.code === 'INVALID_PAYLOAD' || error.code === 'STATE_VALIDATION_FAILED' ? 'REJECTED' : 'PENDING', lastError: {code: error.code, message: error.message, at: HP.util.now()}});
      HP.diagnostics.log(error.code, error, {mutationId: id, operation: request.operation || action, frontendVersion: HP.version, baseRevision: request.baseRevision, durationMs: Date.now() - started});
      HP.ui.setSyncState('error', error.message);
      HP.events.emit('mutation:failed', {request: request, error: error, durationMs: Date.now() - started, meta: meta});
      throw error;
    } finally {
      delete locks[id];
    }
  }

  async function commit(operation, payload, options) {
    options = options || {};
    if (HP.legacyRecovery) HP.legacyRecovery.assertWritable(operation);
    var request = requestFor(operation, payload, options);
    return execute('commitMutation', request, options);
  }

  async function auxiliary(action, payload, options) {
    options = options || {};
    if (HP.legacyRecovery && action !== 'createBackup') HP.legacyRecovery.assertWritable(action);
    var confirmed = HP.store.getConfirmed();
    var request = Object.assign({}, payload || {}, {
      action: action,
      appVersion: HP.version,
      mutationId: options.mutationId || HP.util.uid(action.toLowerCase()),
      deviceId: HP.util.deviceId(),
      baseRevision: confirmed ? confirmed.revision : 0,
      createdAt: HP.util.now()
    });
    return execute(action, request, options);
  }

  async function retry(mutationId) {
    var item = pendingById(mutationId);
    if (!item) throw HP.errors.create('INVALID_PAYLOAD', 'العملية المعلقة غير موجودة');
    return execute(item.action || 'commitMutation', item.request, {formKey: item.formKey, draft: item.draft, attempts: item.attempts});
  }

  async function resolvePending() {
    var rows = HP.store.pending();
    var changed = false;
    for (var index = 0; index < rows.length; index += 1) {
      var item = rows[index];
      if (!item.request || !item.request.mutationId) continue;
      try {
        var status = await HP.api.getMutationStatus(item.request.mutationId);
        if (status.status === 'COMMITTED' && status.ok) {
          removePending(item.request.mutationId);
          changed = true;
          HP.events.emit('mutation:resolved', {request: item.request, response: status, formKey: item.formKey});
        } else if (status.status === 'REJECTED' || status.ok === false) {
          updatePending(item.request.mutationId, {status: 'REJECTED', lastError: status.error || {code: 'SERVER_INTERNAL_ERROR', message: 'تم رفض العملية'}});
        }
      } catch (error) {
        HP.diagnostics.log('MUTATION_STATUS_UNKNOWN', error, {mutationId: item.request.mutationId, operation: item.request.operation || item.action});
      }
    }
    if (changed) await refreshConfirmedState();
    return HP.store.pending();
  }

  function downloadPending(mutationId) {
    var item = pendingById(mutationId);
    if (!item) throw HP.errors.create('INVALID_PAYLOAD', 'العملية المعلقة غير موجودة');
    var blob = new Blob([JSON.stringify({format: 'HaydarPackV58PendingMutation', exportedAt: HP.util.now(), item: item}, null, 2)], {type: 'application/json;charset=utf-8'});
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'HaydarPack_Pending_' + mutationId.replace(/[^A-Za-z0-9._-]/g, '_') + '.json';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 500);
  }

  function discard(mutationId) {
    if (!mutationId) return;
    removePending(mutationId);
  }

  HP.actions = {commit: commit, auxiliary: auxiliary, retry: retry, resolvePending: resolvePending, refreshState: refreshConfirmedState, downloadPending: downloadPending, pendingById: pendingById, discard: discard};
})(window.HaydarPack);
