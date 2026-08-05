(function (HP) {
  'use strict';

  if (!HP) throw new Error('HaydarPack core is required');

  var $ = HP.ui.element;
  var esc = HP.util.escapeHtml;
  var attr = HP.util.attr;
  var money = HP.util.money;
  var n = HP.util.number;

  function data() { return HP.store.getData(); }
  function text(id, value) { var node = $(id); if (node) node.textContent = String(value == null ? '' : value); }
  function row(label, value, className) { return '<div class="row"><span>' + esc(label) + '</span><b class="' + (className || '') + '">' + esc(value) + '</b></div>'; }
  function empty(message) { return '<div class="empty">' + esc(message) + '</div>'; }
  function find(array, id) { return (array || []).find(function (item) { return String(item.id) === String(id); }) || null; }

  function renderReports() {
    var state = data();
    var controls = HP.calc.controls(state);
    var stats = $('rep-stats');
    if (stats) stats.innerHTML = [
      ['إجمالي المبيعات', controls.totals.orderTotals, 'green'],
      ['تكلفة المصانع', controls.totals.factoryCosts, 'red'],
      ['ربح الأوردرات', controls.totals.profitTotals, 'amber'],
      ['مصروفات البيت', controls.totals.householdExpenseTotals, 'red'],
      ['الربح بعد البيت', controls.totals.profitAfterHousehold, 'green'],
      ['السيولة الحالية', controls.totals.liquidity, 'blue']
    ].map(function (item) { return '<div class="stat-box ' + item[2] + '"><div class="sl">' + item[0] + '</div><div class="sv">' + money(item[1]) + '</div></div>'; }).join('');

    var factories = $('rep-fac');
    if (factories) factories.innerHTML = (state.factories || []).map(function (factory) {
      return row(factory.name, money(HP.calc.factoryBalance(state, factory.id)), 'danger');
    }).join('') || empty('لا توجد مصانع');

    var clients = $('rep-clients');
    if (clients) clients.innerHTML = (state.clients || []).map(function (client) {
      var balance = HP.calc.clientBalance(state, client.id);
      return row(client.name, money(balance), balance > 0 ? 'danger' : 'success');
    }).join('') || empty('لا يوجد عملاء');

    var statuses = {};
    (state.orders || []).forEach(function (order) { statuses[order.status || 'بدون حالة'] = (statuses[order.status || 'بدون حالة'] || 0) + 1; });
    var statusNode = $('rep-status');
    if (statusNode) statusNode.innerHTML = Object.keys(statuses).map(function (key) { return row(key, statuses[key]); }).join('') || empty('لا توجد أوردرات');

    var expenseNode = $('rep-expenses');
    if (expenseNode) expenseNode.innerHTML = (state.expenses || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 30).map(function (expense) {
      return '<div class="row"><span>' + esc(expense.date || '') + ' • ' + esc(expense.type || 'مصروف') + '</span><b>' + money(expense.amount) + '</b><button class="btn small red-out" data-action="report-delete-expense" data-id="' + attr(expense.id) + '">حذف</button></div>';
    }).join('') || empty('لا توجد مصروفات');

    var deletedNode = $('deleted-list');
    if (deletedNode) deletedNode.innerHTML = (state.deletedLog || []).map(function (item) {
      return '<div class="row"><span>' + esc(item.label || item.type || 'عنصر محذوف') + '<small>' + esc(item.deletedAt || '') + '</small></span><button class="btn small green" data-action="report-restore-deleted" data-id="' + attr(item.id) + '">استرجاع</button></div>';
    }).join('') || empty('لا توجد عناصر قابلة للاسترجاع');
  }

  function liquidityParts(state) {
    var wallet = state.settings && state.settings.v56Wallet || {};
    var deposits = (state.orders || []).reduce(function (sum, item) { return sum + n(item.deposit); }, 0);
    var payments = (state.payments || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0);
    var factories = (state.transfers || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0);
    var expenses = (state.expenses || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0);
    var house = (state.houseExpenses || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0);
    var adjustments = (state.walletAdjustments || []).reduce(function (sum, item) { return sum + (item.type === 'out' ? -n(item.amount) : n(item.amount)); }, 0);
    var capital = (state.capitalMoves || []).reduce(function (sum, item) {
      return sum + (/^(owner_add|loan_in|lend_repay)$/.test(String(item.type || '')) ? n(item.amount) : /^(owner_withdraw|loan_repay|lend_out)$/.test(String(item.type || '')) ? -n(item.amount) : 0);
    }, 0);
    return {opening: n(wallet.openingLiquidity), received: deposits + payments, factories: factories, expenses: expenses, house: house, adjustments: adjustments, capital: capital, current: HP.calc.liquidity(state)};
  }

  function renderLiquidity() {
    var state = data();
    var parts = liquidityParts(state);
    text('liq-current', money(parts.current));
    text('liq-received', money(parts.received));
    text('liq-paid', money(parts.factories + parts.expenses + parts.house));
    text('liq-opening-label', money(parts.opening));
    var opening = $('liq-opening'); if (opening && document.activeElement !== opening) opening.value = parts.opening || '';
    var detail = $('liq-breakdown');
    if (detail) detail.innerHTML = row('رصيد البداية', money(parts.opening)) + row('عربون ودفعات العملاء', money(parts.received), 'success') + row('تحويلات المصانع', money(parts.factories), 'danger') + row('مصروفات التشغيل', money(parts.expenses), 'danger') + row('مصروفات البيت', money(parts.house), 'danger') + row('تسويات السيولة', money(parts.adjustments)) + row('حركات رأس المال', money(parts.capital));

    var adjustments = $('liq-adjustments-list');
    if (adjustments) adjustments.innerHTML = (state.walletAdjustments || []).slice().reverse().map(function (item) {
      return '<div class="row"><span>' + esc(item.date || '') + ' • ' + esc(item.note || (item.type === 'out' ? 'خصم' : 'إضافة')) + '</span><b class="' + (item.type === 'out' ? 'danger' : 'success') + '">' + (item.type === 'out' ? '− ' : '+ ') + money(item.amount) + '</b><button class="btn small red-out" data-action="liquidity-delete" data-id="' + attr(item.id) + '">حذف</button></div>';
    }).join('') || empty('لا توجد تسويات يدوية');

    var houses = $('house-list');
    if (houses) houses.innerHTML = (state.houseExpenses || []).slice().reverse().map(function (item) {
      return '<div class="row"><span>' + esc(item.date || '') + ' • ' + esc(item.category || 'أخرى') + ' • ' + esc(item.note || '') + '</span><b>' + money(item.amount) + '</b><button class="btn small red-out" data-action="house-delete" data-id="' + attr(item.id) + '">حذف</button></div>';
    }).join('') || empty('لا توجد مصروفات بيت');

    var capital = $('capital-list');
    if (capital) capital.innerHTML = (state.capitalMoves || []).slice().reverse().map(function (item) {
      return '<div class="row"><span>' + esc(item.date || '') + ' • ' + esc(capitalLabel(item.type)) + ' • ' + esc(item.note || '') + '</span><b>' + money(item.amount) + '</b><button class="btn small red-out" data-action="capital-delete" data-id="' + attr(item.id) + '">حذف</button></div>';
    }).join('') || empty('لا توجد حركات رأس مال');
  }

  function capitalLabel(type) {
    return {owner_add: 'إضافة من المالك', owner_withdraw: 'سحب المالك', loan_in: 'قرض داخل', loan_repay: 'سداد قرض', lend_out: 'سلفة خارجة', lend_repay: 'رد سلفة'}[type] || type || 'حركة';
  }

  async function runForm(formId, operation, payload, options) {
    options = options || {};
    var form = $(formId);
    var button = form && form.querySelector('[type="submit"]');
    var status = form && form.querySelector('.form-status');
    var mutationId = form.dataset.mutationId || HP.util.uid('mutation-' + operation.toLowerCase());
    form.dataset.mutationId = mutationId;
    if (button) button.disabled = true;
    if (status) { status.textContent = 'جاري الحفظ على Google'; status.className = 'form-status saving'; }
    try {
      await HP.actions.commit(operation, payload, {mutationId: mutationId, formKey: formId, draft: payload, entityType: options.entityType || ''});
      form.dataset.mutationId = '';
      if (options.clear) options.clear.forEach(function (id) { if ($(id)) $(id).value = ''; });
      if (status) { status.textContent = 'تم الحفظ على Google'; status.className = 'form-status success'; }
      HP.ui.toast('تم الحفظ على Google', 'success');
      renderAll();
    } catch (rawError) {
      var error = HP.errors.normalize(rawError);
      if (status) { status.textContent = error.code + ': ' + error.message; status.className = 'form-status error'; }
      HP.ui.toast(error.message, 'error');
      throw error;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function submitReportAction(action) {
    if (action === 'liquidity-save-opening') {
      return runForm('form-opening', 'editSettings', {settings: {v56Wallet: {openingLiquidity: n($('liq-opening').value)}}}, {entityType: 'settings'});
    }
    if (action === 'liquidity-add') {
      var amount = n($('liq-amount').value); if (!(amount > 0)) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل مبلغًا أكبر من صفر');
      return runForm('form-liquidity', 'addLiquidityAdjustment', {type: $('liq-type').value, amount: amount, date: $('liq-date').value || HP.util.today(), note: $('liq-note').value}, {entityType: 'walletAdjustment', clear: ['liq-amount','liq-note']});
    }
    if (action === 'house-add') {
      var houseAmount = n($('house-amount').value); if (!(houseAmount > 0)) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل مبلغًا أكبر من صفر');
      return runForm('form-house', 'addHouseholdExpense', {category: $('house-category').value, amount: houseAmount, date: $('house-date').value || HP.util.today(), note: $('house-note').value}, {entityType: 'houseExpense', clear: ['house-amount','house-note']});
    }
    if (action === 'capital-add') {
      var capAmount = n($('capital-amount').value); if (!(capAmount > 0)) throw HP.errors.create('INVALID_PAYLOAD', 'أدخل مبلغًا أكبر من صفر');
      return runForm('form-capital', 'addCapitalMovement', {type: $('capital-type').value, amount: capAmount, date: $('capital-date').value || HP.util.today(), note: $('capital-note').value}, {entityType: 'capitalMovement', clear: ['capital-amount','capital-note']});
    }
  }

  async function remove(operation, id, question) {
    if (!window.confirm(question)) return;
    await HP.actions.commit(operation, {id: id}, {mutationId: HP.util.uid('mutation-delete'), entityType: ''});
    HP.ui.toast('تم الحذف على Google', 'success');
    renderAll();
  }

  async function handleCapital(action) { return submitReportAction(action); }

  function exportConfirmedJson() {
    var confirmed = HP.store.getConfirmed();
    if (!confirmed) throw HP.errors.create('STATE_VALIDATION_FAILED', 'لا توجد حالة مؤكدة للتنزيل');
    var blob = new Blob([JSON.stringify({format: 'HaydarPackV58ConfirmedExport', exportedAt: HP.util.now(), revision: confirmed.revision, stateHash: confirmed.stateHash, data: confirmed.data}, null, 2)], {type: 'application/json;charset=utf-8'});
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'HaydarPack_V58_Confirmed_rev_' + confirmed.revision + '.json'; document.body.appendChild(link); link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 500);
  }

  function renderAll() { renderReports(); renderLiquidity(); }

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action]'); if (!button) return;
    var action = button.dataset.action;
    if (!/^(liquidity-|house-|report-)/.test(action)) return;
    event.preventDefault();
    Promise.resolve().then(function () {
      if (action === 'liquidity-delete') return remove('deleteLiquidityAdjustment', button.dataset.id, 'حذف حركة السيولة؟');
      if (action === 'house-delete') return remove('deleteHouseholdExpense', button.dataset.id, 'حذف مصروف البيت؟');
      if (action === 'report-delete-expense') return remove('deleteExpense', button.dataset.id, 'حذف المصروف؟');
      if (action === 'report-restore-deleted') return HP.actions.commit('restoreDeletedItem', {id: button.dataset.id}, {mutationId: HP.util.uid('mutation-restore'), entityType: 'deletedItem'}).then(function () { HP.ui.toast('تم الاسترجاع على Google', 'success'); renderAll(); });
      if (action === 'report-export-confirmed') return exportConfirmedJson();
      return submitReportAction(action);
    }).catch(function (rawError) { var error = HP.errors.normalize(rawError); HP.ui.toast(error.code + ': ' + error.message, 'error'); });
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action="capital-delete"]'); if (!button) return;
    event.preventDefault();
    remove('deleteCapitalMovement', button.dataset.id, 'حذف حركة رأس المال؟').catch(function (error) { error = HP.errors.normalize(error); HP.ui.toast(error.code + ': ' + error.message, 'error'); });
  });

  ['form-opening','form-liquidity','form-house','form-capital'].forEach(function (id) {
    document.addEventListener('submit', function (event) {
      if (!event.target || event.target.id !== id) return;
      event.preventDefault();
      var button = event.submitter || event.target.querySelector('[type="submit"]');
      submitReportAction(button && button.dataset.action || '').catch(function () {});
    });
  });

  HP.events.on('state:confirmed', renderAll);
  HP.events.on('app:ready', renderAll);
  HP.reports = {render: renderAll, renderReports: renderReports, renderCapital: renderLiquidity, handleCapital: handleCapital, liquidityParts: liquidityParts};
})(window.HaydarPack);
