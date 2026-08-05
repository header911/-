(function (HP) {
  'use strict';

  var $ = HP.ui.element;
  var esc = HP.util.escapeHtml;
  var attr = HP.util.attr;
  var money = HP.util.money;
  var count = HP.util.count;
  var n = HP.util.number;
  var filters = {orderStatus: 'all', orderPeriod: 'all', orderFactory: 'all', archive: false, homePeriod: 'month'};
  var imageDrafts = {};
  var selectedOrders = {};

  function data() { return HP.store.getData(); }
  function confirmed() { return HP.store.getConfirmed(); }
  function byId(list, id) { return (list || []).find(function (item) { return String(item.id) === String(id); }) || null; }
  function clientName(state, id) { var item = byId(state.clients, id); return item ? item.name : 'عميل غير موجود'; }
  function factoryName(state, id) { var item = byId(state.factories, id); return item ? item.name : 'مصنع غير موجود'; }
  function dateValue(id) { return String($(id) && $(id).value || HP.util.today()); }
  function field(id) { return String($(id) && $(id).value || ''); }
  function checkedOrders() { return Object.keys(selectedOrders).filter(function (id) { return selectedOrders[id]; }); }

  function setText(id, value) { var node = $(id); if (node) node.textContent = String(value == null ? '' : value); }
  function setValue(id, value) { var node = $(id); if (node) node.value = value == null ? '' : value; }

  function showPage(page, button) {
    document.querySelectorAll('.page').forEach(function (node) { node.classList.toggle('active', node.id === 'pg-' + page); });
    document.querySelectorAll('.navbar .nb').forEach(function (node) { node.classList.toggle('active', node === button || node.dataset.page === page); });
    renderPage(page);
  }

  function renderPage(page) {
    if (page === 'home') renderHome();
    if (page === 'orders') renderOrders();
    if (page === 'clients') renderClients();
    if (page === 'factories') renderFactories();
    if (page === 'reports' && HP.reports) HP.reports.renderReports();
    if (page === 'capital' && HP.reports) HP.reports.renderCapital();
  }

  function renderAll() {
    renderHome();
    renderOrders();
    renderClients();
    renderFactories();
    if (HP.reports) { HP.reports.renderReports(); HP.reports.renderCapital(); }
    if (HP.documents) HP.documents.renderCenter();
    if (HP.backup) HP.backup.renderStatus();
  }

  function renderHome() {
    var state = data();
    var totals = HP.calc.periodTotals(state, filters.homePeriod, HP.util.today().slice(0, 7));
    setText('h-income', money(totals.income));
    setText('h-costs', money(totals.factoryCost + totals.expenses));
    setText('h-profit', money(totals.profit));
    setText('h-pending', money((state.clients || []).reduce(function (sum, client) { return sum + Math.max(0, HP.calc.clientBalance(state, client.id)); }, 0)));
    setText('h-ords', count(totals.orders.length));
    setText('h-delivered', count(totals.orders.filter(function (order) { return order.status === 'تم التوصيل للعميل'; }).length));
    var periods = $('home-periods');
    if (periods) periods.innerHTML = [['today','اليوم'],['week','الأسبوع'],['month','الشهر'],['all','الكل']].map(function (item) { return '<button class="chip ' + (filters.homePeriod === item[0] ? 'active' : '') + '" data-action="home-period" data-value="' + item[0] + '">' + item[1] + '</button>'; }).join('');
    var statuses = {};
    totals.orders.forEach(function (order) { statuses[order.status || 'بدون حالة'] = (statuses[order.status || 'بدون حالة'] || 0) + 1; });
    var statusBox = $('h-status');
    if (statusBox) statusBox.innerHTML = Object.keys(statuses).length ? Object.keys(statuses).map(function (key) { return '<div class="row"><span>' + esc(key) + '</span><b>' + count(statuses[key]) + '</b></div>'; }).join('') : empty('لا توجد أوردرات في الفترة');
    var recent = $('h-recent-orders');
    if (recent) recent.innerHTML = (state.orders || []).slice().sort(function (a, b) { return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || '')); }).slice(0, 5).map(orderCard).join('') || empty('لا توجد أوردرات');
    var dues = $('h-factory-dues');
    if (dues) dues.innerHTML = (state.factories || []).map(function (factory) { return {name: factory.name, balance: HP.calc.factoryBalance(state, factory.id)}; }).filter(function (item) { return item.balance > 0; }).sort(function (a, b) { return b.balance - a.balance; }).map(function (item) { return '<div class="row"><span>' + esc(item.name) + '</span><b class="danger">' + money(item.balance) + '</b></div>'; }).join('') || empty('لا توجد مبالغ مطلوبة للمصانع');
  }

  function orderCard(order) {
    var state = data();
    var profit = HP.calc.orderProfit(state, order);
    return '<div class="order-card ' + (order.archived ? 'archived' : '') + '">' +
      '<div class="oc-top"><label><input type="checkbox" data-action="select-order" data-id="' + attr(order.id) + '" ' + (selectedOrders[order.id] ? 'checked' : '') + '> <b>' + esc(order.code || 'بدون كود') + '</b></label><span class="badge">' + esc(order.status || '') + '</span></div>' +
      '<div class="oc-title">' + esc(order.name || 'أوردر بدون اسم') + '</div>' +
      '<div class="oc-meta">' + esc(clientName(state, order.clientId)) + ' • ' + esc(factoryName(state, order.factoryId)) + ' • ' + esc(order.date || '') + '</div>' +
      '<div class="oc-nums"><span>العميل <b>' + money(HP.calc.customerOrderValue(order)) + '</b></span><span>المصنع <b>' + money(HP.calc.factoryOrderCost(order)) + '</b></span><span>الربح <b class="' + (profit < 0 ? 'danger' : 'success') + '">' + money(profit) + '</b></span></div>' +
      '<button class="btn small" data-action="order-detail" data-id="' + attr(order.id) + '">التفاصيل</button></div>';
  }

  function renderOrders() {
    var state = data();
    var query = String($('q-orders') && $('q-orders').value || '').trim().toLowerCase();
    var rows = (state.orders || []).filter(function (order) {
      if (!!order.archived !== !!filters.archive) return false;
      if (filters.orderStatus !== 'all' && order.status !== filters.orderStatus) return false;
      if (filters.orderFactory !== 'all' && order.factoryId !== filters.orderFactory) return false;
      if (!HP.calc.periodMatch(order.date, filters.orderPeriod, HP.util.today().slice(0, 7))) return false;
      var haystack = [order.code, order.name, clientName(state, order.clientId), factoryName(state, order.factoryId)].join(' ').toLowerCase();
      return !query || haystack.indexOf(query) >= 0;
    }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var statuses = ['all'].concat(Array.from(new Set((state.orders || []).map(function (order) { return order.status || 'بدون حالة'; }))));
    var statusChips = $('status-chips');
    if (statusChips) statusChips.innerHTML = statuses.map(function (status) { return '<button class="chip ' + (filters.orderStatus === status ? 'active' : '') + '" data-action="order-status-filter" data-value="' + attr(status) + '">' + esc(status === 'all' ? 'كل الحالات' : status) + '</button>'; }).join('');
    var periodChips = $('period-chips');
    if (periodChips) periodChips.innerHTML = [['all','كل البيانات'],['today','اليوم'],['week','الأسبوع'],['month','الشهر']].map(function (item) { return '<button class="chip ' + (filters.orderPeriod === item[0] ? 'active' : '') + '" data-action="order-period-filter" data-value="' + item[0] + '">' + item[1] + '</button>'; }).join('');
    var factoryChips = $('order-chips');
    if (factoryChips) factoryChips.innerHTML = [{id: 'all', name: 'كل المصانع'}].concat(state.factories || []).map(function (factory) { return '<button class="chip ' + (filters.orderFactory === factory.id ? 'active' : '') + '" data-action="order-factory-filter" data-value="' + attr(factory.id) + '">' + esc(factory.name) + '</button>'; }).join('');
    var list = $('orders-list');
    if (list) list.innerHTML = rows.map(orderCard).join('') || empty(filters.archive ? 'الأرشيف فارغ' : 'لا توجد أوردرات مطابقة');
    setText('archive-toggle-label', filters.archive ? 'عرض الجاري' : 'عرض الأرشيف');
  }

  function renderClients() {
    var state = data();
    var query = String($('q-clients') && $('q-clients').value || '').trim().toLowerCase();
    var rows = (state.clients || []).filter(function (client) { return !query || [client.name, client.phone, client.addr].join(' ').toLowerCase().indexOf(query) >= 0; });
    var list = $('clients-list');
    if (list) list.innerHTML = rows.map(function (client) {
      var balance = HP.calc.clientBalance(state, client.id);
      var orderCount = state.orders.filter(function (order) { return order.clientId === client.id; }).length;
      return '<div class="client-card"><div><b>' + esc(client.name) + '</b><small>' + esc(client.phone || '') + ' • ' + count(orderCount) + ' أوردر</small></div><div><b class="' + (balance > 0 ? 'danger' : 'success') + '">' + money(balance) + '</b><button class="btn small blue" data-action="client-detail" data-id="' + attr(client.id) + '">فتح</button></div></div>';
    }).join('') || empty('لا يوجد عملاء');
  }

  function renderFactories() {
    var state = data();
    var list = $('factories-list');
    if (list) list.innerHTML = (state.factories || []).map(function (factory) {
      var balance = HP.calc.factoryBalance(state, factory.id);
      var orderCount = state.orders.filter(function (order) { return order.factoryId === factory.id; }).length;
      return '<div class="client-card"><div><b>' + esc(factory.name) + '</b><small>' + esc(factory.phone || '') + ' • ' + count(orderCount) + ' أوردر</small></div><div><b class="' + (balance > 0 ? 'danger' : 'success') + '">' + money(balance) + '</b><button class="btn small" data-action="factory-detail" data-id="' + attr(factory.id) + '">فتح</button></div></div>';
    }).join('') || empty('لا توجد مصانع');
  }

  function empty(message) { return '<div class="empty">' + esc(message) + '</div>'; }

  function fillSelect(id, rows, selected, placeholder) {
    var node = $(id);
    if (!node) return;
    node.innerHTML = '<option value="">' + esc(placeholder || '— اختر —') + '</option>' + rows.map(function (item) { return '<option value="' + attr(item.id) + '" ' + (String(selected || '') === String(item.id) ? 'selected' : '') + '>' + esc(item.name) + '</option>'; }).join('');
  }

  function resetMutation(drawerId) {
    var drawer = $(drawerId);
    if (drawer) { drawer.dataset.mutationId = ''; drawer.dataset.saving = '0'; clearFormError(drawer); }
  }

  function openOrderForm(id) {
    var state = data();
    var order = id ? byId(state.orders, id) : null;
    resetMutation('dr-order');
    fillSelect('o-client', state.clients || [], order && order.clientId, '— اختر عميل —');
    fillSelect('o-factory', state.factories || [], order && order.factoryId, '— اختر مصنع —');
    setValue('o-edit-id', order && order.id);
    setValue('o-code', order && order.code || nextOrderCode(state.orders || [], HP.util.today()));
    setValue('o-date', order && order.date || HP.util.today());
    setValue('o-name', order && order.name || '');
    setValue('o-status', order && order.status || 'تحت التنفيذ');
    setValue('o-type', order && order.type || 'يد داخلية');
    setValue('o-color', order && order.color || 'ابيض');
    setValue('o-handle', order && order.handle || '');
    setValue('o-print', order && order.print || '');
    setValue('o-color-count', order && order.colorCount || '1');
    setValue('o-width', order && order.width || '');
    setValue('o-height', order && order.height || '');
    setValue('o-size', order && order.size || '');
    setValue('o-qty', order && order.qty || '');
    setValue('o-price', order && order.price || '');
    setValue('o-ak', order && order.aklashe || '');
    setValue('o-deposit', order && order.deposit || '');
    setValue('o-discount', order && (order.invoiceDiscount != null ? order.invoiceDiscount : order.discount) || '');
    setValue('o-notes', order && order.notes || '');
    imageDrafts['o-design'] = null;
    var preview = $('o-design-preview');
    if (preview) { preview.classList.add('hide'); preview.removeAttribute('src'); }
    setText('order-drawer-title', order ? 'تعديل الأوردر' : 'أوردر جديد');
    calcOrderPreview();
    HP.ui.openDrawer('dr-order');
  }

  function nextOrderCode(orders, date) {
    var month = String(date || HP.util.today()).slice(0, 7).replace('-', '');
    var max = 0;
    (orders || []).forEach(function (order) { var match = String(order.code || '').match(new RegExp('^ORD-' + month + '-(\\d+)$')); if (match) max = Math.max(max, Number(match[1])); });
    return 'ORD-' + month + '-' + String(max + 1).padStart(4, '0');
  }

  function orderPayload() {
    return {
      code: field('o-code'), name: field('o-name').trim(), clientId: field('o-client'), factoryId: field('o-factory'), status: field('o-status'), type: field('o-type'), color: field('o-color'), handle: field('o-handle'), print: field('o-print'), colorCount: field('o-color-count'), face: field('o-face') || 'وجه واحد', width: field('o-width'), height: field('o-height'), size: field('o-size'), qty: n(field('o-qty')), price: n(field('o-price')), aklashe: n(field('o-ak')), deposit: n(field('o-deposit')), invoiceDiscount: n(field('o-discount')), date: dateValue('o-date'), notes: field('o-notes')
    };
  }

  function validateOrder(payload) {
    if (!payload.clientId) throw HP.errors.create('INVALID_PAYLOAD', 'اختر العميل');
    if (!payload.factoryId) throw HP.errors.create('INVALID_PAYLOAD', 'اختر المصنع');
    ['qty','price','aklashe','deposit','invoiceDiscount'].forEach(function (key) { if (payload[key] < 0) throw HP.errors.create('INVALID_PAYLOAD', 'القيم المالية والكميات لا يمكن أن تكون سالبة'); });
  }

  async function uploadDraftImage(inputId, businessMutationId, kind) {
    var draft = imageDrafts[inputId];
    if (!draft) return null;
    var result = await HP.actions.auxiliary('putImage', {imageId: 'img-' + businessMutationId.replace(/[^A-Za-z0-9._-]/g, '_'), kind: kind, originalName: draft.name, mimeType: draft.type, size: draft.size, dataUrl: draft.dataUrl}, {mutationId: 'upload-' + businessMutationId, formKey: inputId});
    return {ref: 'v58-drive-image', imageId: result.imageId, kind: kind, name: draft.name, type: draft.type, size: draft.size, fileId: result.fileId};
  }

  async function saveOrderForm(button) {
    var drawer = $('dr-order');
    var payload = orderPayload();
    validateOrder(payload);
    var editId = field('o-edit-id');
    var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-order');
    drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () {
      var image = await uploadDraftImage('o-design', mutationId, 'order-design');
      if (image) payload.designImage = image;
      var response = await HP.actions.commit(editId ? 'editOrder' : 'addOrder', editId ? {id: editId, patch: payload} : payload, {mutationId: mutationId, formKey: 'order', draft: payload, entityType: 'order'});
      resetMutation('dr-order');
      HP.ui.closeDrawer('dr-order');
      HP.ui.toast('تم الحفظ على Google', 'success');
      renderAll();
      return response;
    });
  }

  function calcOrderPreview() {
    var order = {qty: n(field('o-qty')), fQty: 0, price: n(field('o-price')), aklashe: n(field('o-ak')), invoiceDiscount: n(field('o-discount'))};
    var total = HP.calc.customerOrderValue(order);
    setText('o-total-prev', money(total));
    setText('o-due-prev', money(Math.max(0, total - n(field('o-deposit')))));
  }

  function updateOrderCodeForDate() {
    if (field('o-edit-id')) return;
    setValue('o-code', nextOrderCode(data().orders || [], dateValue('o-date')));
  }

  function openClientForm(id) {
    var client = id ? byId(data().clients, id) : null;
    resetMutation('dr-client');
    setValue('c-edit-id', client && client.id);
    setValue('c-name', client && client.name || '');
    setValue('c-phone', client && client.phone || '');
    setValue('c-addr', client && client.addr || '');
    setValue('c-debt', client && client.debt || '');
    setText('client-drawer-title', client ? 'تعديل بيانات العميل' : 'عميل جديد');
    var save = document.querySelector('#dr-client [data-action="save-client"]');
    if (save) save.innerHTML = '<i class="ti ti-check"></i> ' + (client ? 'حفظ التعديل' : 'إضافة');
    HP.ui.openDrawer('dr-client');
  }

  async function saveClientForm(button) {
    var drawer = $('dr-client');
    var id = field('c-edit-id');
    var payload = {name: field('c-name').trim(), phone: field('c-phone'), addr: field('c-addr'), debt: n(field('c-debt'))};
    if (!payload.name) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل اسم العميل');
    var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-client');
    drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () {
      await HP.actions.commit(id ? 'editClient' : 'addClient', id ? {id: id, patch: payload} : payload, {mutationId: mutationId, formKey: 'client', draft: payload, entityType: 'client'});
      resetMutation('dr-client'); HP.ui.closeDrawer('dr-client'); HP.ui.toast('تم الحفظ على Google', 'success'); renderAll();
    });
  }

  function openFactoryForm(id) {
    var factory = id ? byId(data().factories, id) : null;
    resetMutation('dr-factory');
    setValue('f-edit-id', factory && factory.id); setValue('f-name', factory && factory.name || ''); setValue('f-phone', factory && factory.phone || ''); setValue('f-debt', factory && factory.debt || '');
    setText('factory-drawer-title', factory ? 'تعديل بيانات المصنع' : 'مصنع جديد');
    HP.ui.openDrawer('dr-factory');
  }

  async function saveFactoryForm(button) {
    var drawer = $('dr-factory'); var id = field('f-edit-id'); var payload = {name: field('f-name').trim(), phone: field('f-phone'), debt: n(field('f-debt'))};
    if (!payload.name) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل اسم المصنع');
    var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-factory'); drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () { await HP.actions.commit(id ? 'editFactory' : 'addFactory', id ? {id: id, patch: payload} : payload, {mutationId: mutationId, formKey: 'factory', draft: payload, entityType: 'factory'}); resetMutation('dr-factory'); HP.ui.closeDrawer('dr-factory'); HP.ui.toast('تم الحفظ على Google', 'success'); renderAll(); });
  }

  function openPaymentForm(clientId, paymentId) {
    var state = data(); var payment = paymentId ? byId(state.payments, paymentId) : null; var client = byId(state.clients, clientId || payment && payment.clientId);
    resetMutation('dr-payment'); setValue('pay-edit-id', payment && payment.id); setValue('pay-cid', client && client.id); setValue('pay-amt', payment && payment.amount || ''); setValue('pay-date', payment && payment.date || HP.util.today()); setValue('pay-note', payment && payment.note || ''); setText('pay-info', (payment ? 'تعديل دفعة: ' : 'تسجيل دفعة لـ: ') + (client ? client.name : ''));
    imageDrafts['pay-receipt'] = null; resetPreview('pay-receipt-preview'); HP.ui.openDrawer('dr-payment');
  }

  async function savePaymentForm(button) {
    var drawer = $('dr-payment'); var id = field('pay-edit-id'); var payload = {clientId: field('pay-cid'), amount: n(field('pay-amt')), date: dateValue('pay-date'), note: field('pay-note')};
    if (!(payload.amount > 0)) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل مبلغًا أكبر من صفر');
    var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-payment'); drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () { var image = await uploadDraftImage('pay-receipt', mutationId, 'payment-receipt'); if (image) payload.receipt = image; await HP.actions.commit(id ? 'editPayment' : 'addPayment', id ? Object.assign({id: id}, payload) : payload, {mutationId: mutationId, formKey: 'payment', draft: payload, entityType: 'payment'}); resetMutation('dr-payment'); HP.ui.closeDrawer('dr-payment'); HP.ui.toast('تم الحفظ على Google', 'success'); renderAll(); });
  }

  function openTransferForm(factoryId, transferId) {
    var state = data(); var transfer = transferId ? byId(state.transfers, transferId) : null;
    resetMutation('dr-transfer'); fillSelect('t-fac', state.factories || [], factoryId || transfer && transfer.factoryId, '— اختر مصنع —'); setValue('t-edit-id', transfer && transfer.id); setValue('t-amt', transfer && transfer.amount || ''); setValue('t-date', transfer && transfer.date || HP.util.today()); setValue('t-type', transfer && transfer.type || 'فودافون كاش'); setValue('t-note', transfer && transfer.note || ''); imageDrafts['t-receipt'] = null; resetPreview('t-receipt-preview'); HP.ui.openDrawer('dr-transfer');
  }

  async function saveTransferForm(button) {
    var drawer = $('dr-transfer'); var id = field('t-edit-id'); var payload = {factoryId: field('t-fac'), amount: n(field('t-amt')), date: dateValue('t-date'), type: field('t-type'), note: field('t-note')};
    if (!payload.factoryId) throw HP.errors.create('INVALID_PAYLOAD', 'اختر المصنع'); if (!(payload.amount > 0)) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل مبلغًا أكبر من صفر');
    var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-transfer'); drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () { var image = await uploadDraftImage('t-receipt', mutationId, 'factory-receipt'); if (image) payload.receipt = image; await HP.actions.commit(id ? 'editFactoryPayment' : 'addFactoryPayment', id ? Object.assign({id: id}, payload) : payload, {mutationId: mutationId, formKey: 'transfer', draft: payload, entityType: 'transfer'}); resetMutation('dr-transfer'); HP.ui.closeDrawer('dr-transfer'); HP.ui.toast('تم الحفظ على Google', 'success'); renderAll(); });
  }

  function openExpenseForm(id) {
    var state = data(); var expense = id ? byId(state.expenses, id) : null;
    resetMutation('dr-expense'); setValue('ex-edit-id', expense && expense.id); fillSelect('ex-order', [{id: '', name: 'مصروف عام بدون أوردر'}].concat((state.orders || []).map(function (order) { return {id: order.id, name: (order.code || '') + ' - ' + clientName(state, order.clientId)}; })), expense && expense.orderId, 'مصروف عام بدون أوردر'); setValue('ex-type', expense && expense.type || 'هوالك / عمولة'); setValue('ex-amt', expense && expense.amount || ''); setValue('ex-date', expense && expense.date || HP.util.today()); setValue('ex-note', expense && expense.note || ''); HP.ui.openDrawer('dr-expense');
  }

  async function saveExpenseForm(button) {
    var drawer = $('dr-expense'); var id = field('ex-edit-id'); var payload = {orderId: field('ex-order'), type: field('ex-type'), amount: n(field('ex-amt')), date: dateValue('ex-date'), note: field('ex-note')}; if (!(payload.amount > 0)) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل مبلغًا أكبر من صفر');
    var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-expense'); drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () { await HP.actions.commit(id ? 'editExpense' : 'addExpense', id ? Object.assign({id: id}, payload) : payload, {mutationId: mutationId, formKey: 'expense', draft: payload, entityType: 'expense'}); resetMutation('dr-expense'); HP.ui.closeDrawer('dr-expense'); HP.ui.toast('تم الحفظ على Google', 'success'); renderAll(); });
  }

  function openFactoryPricing(orderId) {
    var state = data(); var order = byId(state.orders, orderId); if (!order) return;
    resetMutation('dr-fprice'); setValue('fp-oid', order.id); setValue('fp-qty', order.fQty || order.qty || ''); setValue('fp-price', order.fPrice || ''); setValue('fp-ak', order.fAk || ''); setText('fp-info', (order.code || '') + ' • ' + clientName(state, order.clientId)); calcFactoryPreview(); HP.ui.openDrawer('dr-fprice');
  }

  function calcFactoryPreview() { var state = data(); var order = byId(state.orders, field('fp-oid')) || {}; var fQty = n(field('fp-qty')), fPrice = n(field('fp-price')), fAk = n(field('fp-ak')); setText('fp-total-prev', money(fQty * fPrice + fAk)); setText('fp-client-total-prev', money(Math.max(0, fQty * n(order.price) + n(order.aklashe) - HP.calc.orderDiscount(order)))); }

  async function saveFactoryPricing(button) {
    var drawer = $('dr-fprice'); var payload = {id: field('fp-oid'), fQty: n(field('fp-qty')), fPrice: n(field('fp-price')), fAk: n(field('fp-ak'))}; var mutationId = drawer.dataset.mutationId || HP.util.uid('mutation-fprice'); drawer.dataset.mutationId = mutationId;
    await runFormMutation(drawer, button, async function () { await HP.actions.commit('updateFactoryPricing', payload, {mutationId: mutationId, formKey: 'factory-pricing', draft: payload, entityType: 'order'}); resetMutation('dr-fprice'); HP.ui.closeDrawer('dr-fprice'); HP.ui.toast('تم الحفظ على Google', 'success'); renderAll(); });
  }

  function showClientDetail(id) {
    var state = data(); var client = byId(state.clients, id); if (!client) return; var orders = state.orders.filter(function (order) { return order.clientId === id; }); var payments = state.payments.filter(function (payment) { return payment.clientId === id; }).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
    var html = '<div class="drawer-handle"></div><div class="drawer-title">' + esc(client.name) + '</div><div class="stat-grid"><div class="stat-box blue"><div class="sl">الرصيد</div><div class="sv">' + money(HP.calc.clientBalance(state, id)) + '</div></div><div class="stat-box green"><div class="sl">الأوردرات</div><div class="sv">' + count(orders.length) + '</div></div></div>' +
      '<div class="btn-row"><button class="btn green" data-action="open-payment" data-id="' + attr(id) + '">تسجيل دفعة</button><button class="btn" data-action="open-client" data-id="' + attr(id) + '">تعديل</button><button class="btn red-out" data-action="delete-client" data-id="' + attr(id) + '">حذف</button></div>' +
      '<div class="btn-row"><button class="btn blue" data-action="document" data-type="customerQuotation" data-id="' + attr(id) + '">عرض سعر PDF</button><button class="btn blue" data-action="document" data-type="customerInvoice" data-id="' + attr(id) + '">فاتورة PDF</button><button class="btn" data-action="document" data-type="customerStatement" data-id="' + attr(id) + '">كشف حساب PDF</button></div>' +
      '<div class="sec-label">الأوردرات</div>' + (orders.map(orderCard).join('') || empty('لا توجد أوردرات')) +
      '<div class="sec-label">الدفعات</div>' + (payments.map(function (payment) { return '<div class="row"><span>' + esc(payment.date || '') + ' • ' + esc(payment.note || '') + '</span><b>' + money(payment.amount) + '</b><div><button class="btn small" data-action="edit-payment" data-id="' + attr(payment.id) + '" data-parent="' + attr(id) + '">تعديل</button><button class="btn small red-out" data-action="delete-payment" data-id="' + attr(payment.id) + '">حذف</button></div></div>'; }).join('') || empty('لا توجد دفعات')) + '<button class="btn full" data-action="close" data-drawer="dr-client-detail">إغلاق</button>';
    $('client-detail-body').innerHTML = html; HP.ui.openDrawer('dr-client-detail');
  }

  function showFactoryDetail(id) {
    var state = data(); var factory = byId(state.factories, id); if (!factory) return; var orders = state.orders.filter(function (order) { return order.factoryId === id; }); var transfers = state.transfers.filter(function (transfer) { return transfer.factoryId === id; });
    $('factory-detail-body').innerHTML = '<div class="drawer-handle"></div><div class="drawer-title">' + esc(factory.name) + '</div><div class="stat-grid"><div class="stat-box amber"><div class="sl">الرصيد</div><div class="sv">' + money(HP.calc.factoryBalance(state, id)) + '</div></div><div class="stat-box blue"><div class="sl">الأوردرات</div><div class="sv">' + count(orders.length) + '</div></div></div><div class="btn-row"><button class="btn green" data-action="open-transfer" data-id="' + attr(id) + '">تحويل</button><button class="btn" data-action="open-factory" data-id="' + attr(id) + '">تعديل</button><button class="btn red-out" data-action="delete-factory" data-id="' + attr(id) + '">حذف</button><button class="btn blue" data-action="document" data-type="factoryStatement" data-id="' + attr(id) + '">كشف PDF</button></div><div class="sec-label">الأوردرات</div>' + (orders.map(orderCard).join('') || empty('لا توجد أوردرات')) + '<div class="sec-label">التحويلات</div>' + (transfers.map(function (transfer) { return '<div class="row"><span>' + esc(transfer.date || '') + ' • ' + esc(transfer.type || '') + '</span><b>' + money(transfer.amount) + '</b><div><button class="btn small" data-action="edit-transfer" data-id="' + attr(transfer.id) + '" data-parent="' + attr(id) + '">تعديل</button><button class="btn small red-out" data-action="delete-transfer" data-id="' + attr(transfer.id) + '">حذف</button></div></div>'; }).join('') || empty('لا توجد تحويلات')) + '<button class="btn full" data-action="close" data-drawer="dr-factory-detail">إغلاق</button>';
    HP.ui.openDrawer('dr-factory-detail');
  }

  function showOrderDetail(id) {
    var state = data(); var order = byId(state.orders, id); if (!order) return;
    $('order-detail-body').innerHTML = '<div class="drawer-handle"></div><div class="drawer-title">' + esc(order.code || '') + '</div><div class="card"><div class="row"><span>العميل</span><b>' + esc(clientName(state, order.clientId)) + '</b></div><div class="row"><span>المصنع</span><b>' + esc(factoryName(state, order.factoryId)) + '</b></div><div class="row"><span>الحالة</span><b>' + esc(order.status || '') + '</b></div><div class="row"><span>إجمالي العميل</span><b>' + money(HP.calc.customerOrderValue(order)) + '</b></div><div class="row"><span>تكلفة المصنع</span><b>' + money(HP.calc.factoryOrderCost(order)) + '</b></div><div class="row"><span>الربح</span><b>' + money(HP.calc.orderProfit(state, order)) + '</b></div></div><div class="field"><label>تغيير الحالة</label><select data-action="change-status" data-id="' + attr(id) + '">' + ['تم استلام الأوردر','تحت التنفيذ','جاهز للشحن','تم التوصيل للعميل'].map(function (status) { return '<option ' + (status === order.status ? 'selected' : '') + '>' + status + '</option>'; }).join('') + '</select></div><div class="btn-row"><button class="btn" data-action="open-order" data-id="' + attr(id) + '">تعديل الأوردر</button><button class="btn amber" data-action="factory-pricing" data-id="' + attr(id) + '">بيانات المصنع</button><button class="btn red-out" data-action="delete-order" data-id="' + attr(id) + '">حذف</button></div><button class="btn full" data-action="close" data-drawer="dr-order-detail">إغلاق</button>';
    HP.ui.openDrawer('dr-order-detail');
  }

  async function simpleDelete(operation, payload, message) {
    if (!confirm(message)) return;
    try { await HP.actions.commit(operation, payload, {mutationId: HP.util.uid('mutation-delete'), entityType: operation.replace(/^delete/, '').toLowerCase()}); HP.ui.toast('تم الحذف على Google', 'success'); document.querySelectorAll('.overlay.open').forEach(function (node) { node.classList.remove('open'); }); renderAll(); }
    catch (error) { showGlobalError(error); }
  }

  async function changeStatus(id, status) {
    try { await HP.actions.commit('changeOrderStatus', {id: id, status: status}, {mutationId: HP.util.uid('mutation-status'), entityType: 'order'}); HP.ui.toast('تم تحديث الحالة على Google', 'success'); renderAll(); showOrderDetail(id); }
    catch (error) { showGlobalError(error); }
  }

  function resetPreview(id) { var node = $(id); if (node) { node.classList.add('hide'); node.removeAttribute('src'); } }

  function handleImageInput(input, previewId) {
    var file = input.files && input.files[0]; if (!file) return;
    if (!/^image\//.test(file.type || '')) { HP.ui.toast('اختر ملف صورة فقط', 'error'); return; }
    if (file.size > 1800 * 1024) { HP.ui.toast('الصورة كبيرة؛ الحد 1.8 MB في RC', 'error'); input.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function () { imageDrafts[input.id] = {name: file.name, type: file.type, size: file.size, dataUrl: reader.result}; var preview = $(previewId); if (preview) { preview.src = reader.result; preview.classList.remove('hide'); } };
    reader.onerror = function () { HP.ui.toast('تعذر قراءة الصورة', 'error'); };
    reader.readAsDataURL(file);
  }

  function setSaving(drawer, button, saving) {
    drawer.dataset.saving = saving ? '1' : '0';
    if (button) { button.disabled = !!saving; if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML; button.innerHTML = saving ? '<i class="ti ti-loader"></i> جاري الحفظ على Google' : button.dataset.originalText; }
  }

  function clearFormError(drawer) { var node = drawer && drawer.querySelector('.hp-v58-form-error'); if (node) node.remove(); }

  function showFormError(drawer, error) {
    clearFormError(drawer);
    var id = drawer.dataset.mutationId || '';
    var legacyBlocked = !!(error.details && error.details.legacyPendingCount);
    var deterministic = /^(INVALID_PAYLOAD|REVISION_CONFLICT|VERSION_REJECTED|STATE_VALIDATION_FAILED)$/.test(String(error.code || ''));
    var retryButton = legacyBlocked ? '<button class="btn amber" data-action="legacy-review">فتح مراجعة V57</button>' : deterministic ? '<button class="btn" data-action="reset-form-mutation">تصحيح البيانات ومحاولة جديدة</button>' : '<button class="btn" data-action="retry-form">إعادة المحاولة بنفس العملية</button>';
    var pendingDownload = !legacyBlocked && id ? '<button class="btn" data-action="download-pending" data-id="' + attr(id) + '">تنزيل العملية للطوارئ</button>' : '';
    var node = document.createElement('div'); node.className = 'alert red hp-v58-form-error'; node.innerHTML = '<b>' + esc(error.code || 'ERROR') + '</b><div>' + esc(error.message || 'تعذر الحفظ') + '</div>' + (id || legacyBlocked ? '<div class="btn-row">' + retryButton + pendingDownload + '</div>' : '');
    var panel = drawer.querySelector('.drawer'); if (panel) panel.insertBefore(node, panel.lastElementChild || null);
  }

  async function runFormMutation(drawer, button, worker) {
    clearFormError(drawer); setSaving(drawer, button, true);
    try { return await worker(); }
    catch (error) { error = HP.errors.normalize(error); showFormError(drawer, error); HP.ui.toast(error.message, 'error'); throw error; }
    finally { setSaving(drawer, button, false); }
  }

  function showGlobalError(error) { error = HP.errors.normalize(error); HP.ui.toast(error.code + ': ' + error.message, 'error'); }

  function retryForm(button) {
    var drawer = button.closest('.overlay'); if (!drawer) return;
    var action = drawer.querySelector('[data-action^="save-"]'); if (action) action.click();
  }

  function resetFormMutation(button) {
    var drawer = button.closest('.overlay'); if (!drawer) return;
    HP.actions.discard(drawer.dataset.mutationId || '');
    drawer.dataset.mutationId = '';
    clearFormError(drawer);
    HP.ui.toast('تم الاحتفاظ بالبيانات؛ صححها ثم احفظ كمحاولة جديدة', 'warn');
  }

  async function boot() {
    if (HP.runtime.booted) return;
    HP.runtime.booted = true;
    HP.ui.showLoading('جاري التحقق من العمليات المعلقة وتحميل Google...');
    HP.store.loadCached();
    if (HP.legacyRecovery) HP.legacyRecovery.inspect();
    try {
      HP.runtime.health = await HP.api.healthCheck();
      await HP.actions.resolvePending();
      var state = await HP.api.getState();
      HP.store.setConfirmed(state);
      if (HP.legacyRecovery) HP.legacyRecovery.reconcile(state.data);
      if (HP.legacyRecovery && HP.legacyRecovery.isBlocking()) {
        HP.ui.setSyncState('error', 'تم اكتشاف تعديل قديم من V57 غير مؤكد — راجعه قبل أي حفظ جديد');
      } else {
        HP.ui.setSyncState('confirmed', 'متصل ومحفوظ على Google - مراجعة ' + state.revision);
      }
      renderAll();
      HP.ui.hideLoading();
      if (HP.legacyRecovery && HP.legacyRecovery.isBlocking()) {
        HP.ui.toast('يوجد تعديل V57 غير مؤكد. افتح حالة النظام ونزّل حزمة الاسترداد.', 'error');
      }
      HP.events.emit('app:ready', state);
    } catch (rawError) {
      var error = HP.errors.normalize(rawError);
      HP.runtime.readOnly = true;
      HP.runtime.lastError = {category: error.code, message: error.message, timestamp: HP.util.now()};
      HP.diagnostics.log(error.code, error, {phase: 'boot'});
      if (HP.store.getConfirmed()) { renderAll(); HP.ui.hideLoading(); HP.ui.setSyncState('error', 'عرض آخر نسخة مؤكدة محفوظة على الجهاز فقط: ' + error.message); HP.ui.toast('البرنامج في وضع القراءة فقط حتى يعود Google', 'error'); }
      else { setText('cloud-loading-text', error.code + ': ' + error.message); HP.ui.setSyncState('error', error.message); }
      HP.events.emit('app:boot-failed', error);
    }
  }

  function dispatchClick(event) {
    var button = event.target.closest('[data-action]'); if (!button) return;
    var action = button.dataset.action; var id = button.dataset.id || ''; event.preventDefault();
    if (/^(open-order|open-client|open-factory|open-payment|edit-payment|open-transfer|edit-transfer|open-expense|factory-pricing)$/.test(action)) {
      var parentOverlay = button.closest('.overlay');
      if (parentOverlay && /-detail$/.test(parentOverlay.id)) parentOverlay.classList.remove('open');
    }
    Promise.resolve().then(function () {
      if (action === 'nav') showPage(button.dataset.page, button);
      else if (action === 'open-sync') { HP.ui.openDrawer('dr-sync'); if (HP.backup) HP.backup.refreshStatus(); }
      else if (action === 'open-notify') openNotifications();
      else if (action === 'close') HP.ui.closeDrawer(button.dataset.drawer);
      else if (action === 'open-order') openOrderForm(id);
      else if (action === 'save-order') return saveOrderForm(button);
      else if (action === 'open-client') openClientForm(id);
      else if (action === 'save-client') return saveClientForm(button);
      else if (action === 'open-factory') openFactoryForm(id);
      else if (action === 'save-factory') return saveFactoryForm(button);
      else if (action === 'open-payment') openPaymentForm(id);
      else if (action === 'edit-payment') openPaymentForm(button.dataset.parent, id);
      else if (action === 'save-payment') return savePaymentForm(button);
      else if (action === 'open-transfer') openTransferForm(id);
      else if (action === 'edit-transfer') openTransferForm(button.dataset.parent, id);
      else if (action === 'save-transfer') return saveTransferForm(button);
      else if (action === 'open-expense') openExpenseForm(id);
      else if (action === 'save-expense') return saveExpenseForm(button);
      else if (action === 'factory-pricing') openFactoryPricing(id);
      else if (action === 'save-factory-pricing') return saveFactoryPricing(button);
      else if (action === 'client-detail') showClientDetail(id);
      else if (action === 'factory-detail') showFactoryDetail(id);
      else if (action === 'order-detail') showOrderDetail(id);
      else if (action === 'delete-client') return simpleDelete('deleteClient', {id: id}, 'تأكيد حذف العميل وأوردراته ودفعاته مع حفظ سجل للاسترجاع؟');
      else if (action === 'delete-factory') return simpleDelete('deleteFactory', {id: id}, 'تأكيد حذف المصنع؟');
      else if (action === 'delete-order') return simpleDelete('deleteOrder', {id: id, expenseMode: 'general'}, 'تأكيد حذف الأوردر؟ المصروفات المرتبطة ستتحول إلى عامة.');
      else if (action === 'delete-payment') return simpleDelete('deletePayment', {id: id}, 'تأكيد حذف الدفعة؟');
      else if (action === 'delete-transfer') return simpleDelete('deleteFactoryPayment', {id: id}, 'تأكيد حذف التحويل؟');
      else if (action === 'delete-expense') return simpleDelete('deleteExpense', {id: id}, 'تأكيد حذف المصروف؟');
      else if (action === 'home-period') { filters.homePeriod = button.dataset.value; renderHome(); }
      else if (action === 'order-status-filter') { filters.orderStatus = button.dataset.value; renderOrders(); }
      else if (action === 'order-period-filter') { filters.orderPeriod = button.dataset.value; renderOrders(); }
      else if (action === 'order-factory-filter') { filters.orderFactory = button.dataset.value; renderOrders(); }
      else if (action === 'toggle-archive') { filters.archive = !filters.archive; renderOrders(); }
      else if (action === 'toggle-visible-orders') { document.querySelectorAll('#orders-list input[data-action="select-order"]').forEach(function (box) { selectedOrders[box.dataset.id] = !box.checked; box.checked = !box.checked; }); }
      else if (action === 'clear-design') { imageDrafts['o-design'] = null; setValue('o-design', ''); resetPreview('o-design-preview'); }
      else if (action === 'retry-form') retryForm(button);
      else if (action === 'reset-form-mutation') resetFormMutation(button);
      else if (action === 'download-pending') HP.actions.downloadPending(id);
      else if (action === 'safe-reload') HP.ui.safeReload();
      else if (action === 'document' && HP.documents) return HP.documents.generate(button.dataset.type, id, checkedOrders());
      else if (action.indexOf('legacy-') === 0 && HP.backup) return HP.backup.handle(action, button);
      else if (action.indexOf('backup-') === 0 && HP.backup) return HP.backup.handle(action, button);
      else if (action.indexOf('capital-') === 0 && HP.reports) return HP.reports.handleCapital(action, button);
      else if (action.indexOf('document-') === 0 && HP.documents) return HP.documents.handle(action, button);
    }).catch(showGlobalError);
  }

  function dispatchChange(event) {
    var node = event.target;
    if (node.dataset.action === 'change-status') changeStatus(node.dataset.id, node.value);
    else if (node.dataset.action === 'select-order') selectedOrders[node.dataset.id] = !!node.checked;
    else if (node.id === 'o-date') updateOrderCodeForDate();
    else if (node.id === 'o-design') handleImageInput(node, 'o-design-preview');
    else if (node.id === 'pay-receipt') handleImageInput(node, 'pay-receipt-preview');
    else if (node.id === 't-receipt') handleImageInput(node, 't-receipt-preview');
  }

  function dispatchInput(event) {
    if (event.target.id === 'q-orders') renderOrders();
    else if (event.target.id === 'q-clients') renderClients();
    else if (/^(o-qty|o-price|o-ak|o-deposit|o-discount)$/.test(event.target.id)) calcOrderPreview();
    else if (/^fp-(qty|price|ak)$/.test(event.target.id)) calcFactoryPreview();
  }

  function openNotifications() {
    var state = data(); var alerts = [];
    state.clients.forEach(function (client) { var balance = HP.calc.clientBalance(state, client.id); if (balance > 0) alerts.push('تحصيل من ' + client.name + ': ' + money(balance)); });
    state.orders.forEach(function (order) { if (HP.calc.orderProfit(state, order) < 0) alerts.push('أوردر خاسر: ' + (order.code || order.id)); });
    $('notify-body').innerHTML = alerts.slice(0, 20).map(function (message) { return '<div class="alert amber">' + esc(message) + '</div>'; }).join('') || empty('لا توجد تنبيهات حرجة');
    HP.ui.openDrawer('dr-notify');
  }

  document.addEventListener('click', dispatchClick);
  document.addEventListener('change', dispatchChange);
  document.addEventListener('input', dispatchInput);
  document.addEventListener('click', function (event) { if (event.target.classList.contains('overlay')) HP.ui.closeDrawer(event.target.id); });
  HP.events.on('state:confirmed', renderAll);
  HP.events.on('dom:ready', boot);
  HP.uiPages = {renderAll: renderAll, renderHome: renderHome, renderOrders: renderOrders, renderClients: renderClients, renderFactories: renderFactories, showPage: showPage, openOrderForm: openOrderForm, showClientDetail: showClientDetail, showFactoryDetail: showFactoryDetail, showOrderDetail: showOrderDetail, boot: boot};
})(window.HaydarPack);
