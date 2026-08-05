(function (HP) {
  'use strict';

  if (!HP) throw new Error('HaydarPack core is required');

  var $ = HP.ui.element;
  var esc = HP.util.escapeHtml;
  var attr = HP.util.attr;
  var money = HP.util.money;
  var busy = false;

  function data() { return HP.store.getData(); }
  function optionRows(rows, selected) {
    return '<option value="">— اختر —</option>' + (rows || []).map(function (item) { return '<option value="' + attr(item.id) + '" ' + (String(selected || '') === String(item.id) ? 'selected' : '') + '>' + esc(item.name) + '</option>'; }).join('');
  }

  function render() {
    var state = data();
    var client = $('doc-client'); if (client) client.innerHTML = optionRows(state.clients || [], client.value);
    var factory = $('doc-factory'); if (factory) factory.innerHTML = optionRows(state.factories || [], factory.value);
    var list = $('documents-list');
    if (!list) return;
    list.innerHTML = (state.documents || []).map(function (document) {
      return '<div class="card document-card"><div class="row"><span><b>' + esc(document.title || document.type || 'مستند') + '</b><small>' + esc(document.no || '') + ' • ' + esc(document.entityName || '') + ' • ' + esc(document.date || '') + '</small></span><b>' + money(document.total || document.snapshot && document.snapshot.historicalTotal || 0) + '</b></div><div class="btn-row"><button class="btn small blue" data-action="document-reprint" data-id="' + attr(document.id) + '">إعادة إنشاء PDF من النسخة التاريخية</button>' + (document.fileUrl ? '<a class="btn small" href="' + attr(document.fileUrl) + '" target="_blank" rel="noopener">فتح آخر PDF</a>' : '') + '</div></div>';
    }).join('') || '<div class="empty">لا توجد مستندات محفوظة</div>';
  }

  function documentLabel(type) {
    return {customerQuotation: 'عرض السعر', customerInvoice: 'الفاتورة', customerStatement: 'كشف حساب العميل', factoryStatement: 'كشف حساب المصنع'}[type] || 'المستند';
  }

  async function generate(type, entityId, orderIds, documentId) {
    if (busy) throw HP.errors.create('MUTATION_STATUS_UNKNOWN', 'يوجد مستند قيد الإنشاء الآن');
    var popup = null;
    try { popup = window.open('', '_blank'); if (popup) popup.document.write('<div dir="rtl" style="font-family:Arial;padding:30px">جاري إنشاء PDF رسمي على Google...</div>'); } catch (ignore) {}
    busy = true;
    var status = $('document-status');
    if (status) { status.textContent = 'جاري إنشاء PDF الرسمي على Google'; status.className = 'alert blue'; }
    try {
      var payload = documentId ? {documentId: documentId} : {documentType: type, entityId: entityId, orderIds: Array.isArray(orderIds) ? orderIds : []};
      if (!documentId && !entityId) throw HP.errors.create('INVALID_PAYLOAD', 'اختر العميل أو المصنع أولًا');
      var response = await HP.actions.auxiliary('generateDocumentPdf', {payload: payload}, {mutationId: HP.util.uid('mutation-pdf'), formKey: 'documents'});
      if (!response.fileUrl) throw HP.errors.create('GOOGLE_DRIVE_WRITE_FAILED', 'تم إنشاء السجل بدون رابط PDF صالح');
      if (popup) popup.location.replace(response.fileUrl); else window.open(response.fileUrl, '_blank', 'noopener');
      if (status) { status.textContent = 'تم إنشاء ' + (documentId ? 'النسخة التاريخية' : documentLabel(type)) + ' على Google: ' + (response.fileName || 'PDF'); status.className = 'alert green'; }
      HP.ui.toast('تم إنشاء PDF الرسمي', 'success');
      render();
      return response;
    } catch (rawError) {
      if (popup) popup.close();
      var error = HP.errors.normalize(rawError);
      if (status) { status.textContent = error.code + ': ' + error.message; status.className = 'alert red'; }
      throw error;
    } finally {
      busy = false;
    }
  }

  function selectedOrderIds() {
    return Array.prototype.map.call(document.querySelectorAll('#orders-list input[data-action="select-order"]:checked'), function (box) { return box.dataset.id; });
  }

  function handle(action, button) {
    if (action === 'document-generate-quotation') return generate('customerQuotation', $('doc-client').value, selectedOrderIds());
    if (action === 'document-generate-invoice') return generate('customerInvoice', $('doc-client').value, selectedOrderIds());
    if (action === 'document-generate-client-statement') return generate('customerStatement', $('doc-client').value, selectedOrderIds());
    if (action === 'document-generate-factory-statement') return generate('factoryStatement', $('doc-factory').value, selectedOrderIds());
    if (action === 'document-reprint') return generate('', '', [], button.dataset.id);
  }

  HP.events.on('state:confirmed', render);
  HP.events.on('app:ready', render);
  HP.documents = {generate: function (type, id, orderIds) { return generate(type, id, orderIds || []); }, handle: handle, render: render, renderCenter: render};
})(window.HaydarPack);
