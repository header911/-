(function (HP) {
  'use strict';

  var n = HP.util.number;
  function cash(value) { return Math.round((n(value) + Number.EPSILON) * 100) / 100; }
  function orderDiscount(order) { return Math.max(0, n(order && (order.invoiceDiscount != null ? order.invoiceDiscount : order.discount))); }
  function billQty(order) { return n(order && order.fQty) > 0 ? n(order.fQty) : n(order && order.qty); }
  function customerGross(order) { return cash(billQty(order) * n(order && order.price) + n(order && order.aklashe)); }
  function customerOrderValue(order) { return cash(Math.max(0, customerGross(order) - orderDiscount(order))); }
  function factoryOrderCost(order) { return cash(n(order && order.fQty) * n(order && order.fPrice) + n(order && order.fAk)); }
  function expensesForOrder(data, orderId) { return cash((data.expenses || []).filter(function (expense) { return expense.orderId === orderId; }).reduce(function (sum, expense) { return sum + n(expense.amount); }, 0)); }
  function orderProfit(data, order) { return cash(customerOrderValue(order) - factoryOrderCost(order) - expensesForOrder(data, order.id)); }
  function clientBalance(data, clientId) {
    var client = (data.clients || []).find(function (item) { return item.id === clientId; }) || {};
    var orders = (data.orders || []).filter(function (order) { return order.clientId === clientId; });
    var total = orders.reduce(function (sum, order) { return sum + customerOrderValue(order); }, 0);
    var deposits = orders.reduce(function (sum, order) { return sum + n(order.deposit); }, 0);
    var payments = (data.payments || []).filter(function (payment) { return payment.clientId === clientId; }).reduce(function (sum, payment) { return sum + n(payment.amount); }, 0);
    return cash(total + n(client.debt) - deposits - payments);
  }
  function factoryBalance(data, factoryId) {
    var factory = (data.factories || []).find(function (item) { return item.id === factoryId; }) || {};
    var cost = (data.orders || []).filter(function (order) { return order.factoryId === factoryId; }).reduce(function (sum, order) { return sum + factoryOrderCost(order); }, 0);
    var paid = (data.transfers || []).filter(function (transfer) { return transfer.factoryId === factoryId; }).reduce(function (sum, transfer) { return sum + n(transfer.amount); }, 0);
    return cash(cost + n(factory.debt) - paid);
  }
  function periodMatch(date, period, month) {
    var value = String(date || '').slice(0, 10);
    var today = HP.util.today();
    if (period === 'all') return true;
    if (period === 'today') return value === today;
    if (period === 'month') return value.slice(0, 7) === String(month || today.slice(0, 7));
    if (period === 'week') {
      var current = new Date(today + 'T00:00:00');
      var target = new Date(value + 'T00:00:00');
      var day = (current.getDay() + 6) % 7;
      current.setDate(current.getDate() - day);
      var end = new Date(current); end.setDate(end.getDate() + 6);
      return target >= current && target <= end;
    }
    return true;
  }
  function periodTotals(data, period, month) {
    var orders = (data.orders || []).filter(function (order) { return periodMatch(order.date, period, month); });
    var expenses = (data.expenses || []).filter(function (expense) { return periodMatch(expense.date, period, month); });
    var income = cash(orders.reduce(function (sum, order) { return sum + customerOrderValue(order); }, 0));
    var factoryCost = cash(orders.reduce(function (sum, order) { return sum + factoryOrderCost(order); }, 0));
    var expenseTotal = cash(expenses.reduce(function (sum, expense) { return sum + n(expense.amount); }, 0));
    return {orders: orders, income: income, factoryCost: factoryCost, expenses: expenseTotal, profit: cash(income - factoryCost - expenseTotal)};
  }
  function liquidity(data) {
    var settings = data.settings && data.settings.v56Wallet || {};
    var receipts = (data.orders || []).reduce(function (sum, order) { return sum + n(order.deposit); }, 0) + (data.payments || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0);
    var out = (data.transfers || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0) + (data.expenses || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0) + (data.houseExpenses || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0);
    var adjustments = (data.walletAdjustments || []).reduce(function (sum, item) { return sum + (item.type === 'out' ? -n(item.amount) : n(item.amount)); }, 0);
    var capital = (data.capitalMoves || []).reduce(function (sum, item) {
      var amount = n(item.amount);
      return sum + (/^(owner_add|loan_in|lend_repay)$/.test(String(item.type || '')) ? amount : /^(owner_withdraw|loan_repay|lend_out)$/.test(String(item.type || '')) ? -amount : 0);
    }, 0);
    return cash(n(settings.openingLiquidity) + receipts + adjustments + capital - out);
  }
  function controls(data) {
    var orderProfitTotal = cash((data.orders || []).reduce(function (sum, order) { return sum + orderProfit(data, order); }, 0));
    var household = cash((data.houseExpenses || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0));
    return {
      counts: {
        clients: (data.clients || []).length,
        factories: (data.factories || []).length,
        orders: (data.orders || []).length,
        payments: (data.payments || []).length,
        documents: (data.documents || []).length,
        archivedOrders: (data.orders || []).filter(function (order) { return order.archived; }).length,
        deliveredOrders: (data.orders || []).filter(function (order) { return order.status === 'تم التوصيل للعميل'; }).length
      },
      totals: {
        orderTotals: cash((data.orders || []).reduce(function (sum, order) { return sum + customerOrderValue(order); }, 0)),
        factoryCosts: cash((data.orders || []).reduce(function (sum, order) { return sum + factoryOrderCost(order); }, 0)),
        paymentTotals: cash((data.payments || []).reduce(function (sum, item) { return sum + n(item.amount); }, 0)),
        profitTotals: orderProfitTotal,
        householdExpenseTotals: household,
        profitAfterHousehold: cash(orderProfitTotal - household),
        customerBalances: cash((data.clients || []).reduce(function (sum, client) { return sum + clientBalance(data, client.id); }, 0)),
        factoryBalances: cash((data.factories || []).reduce(function (sum, factory) { return sum + factoryBalance(data, factory.id); }, 0)),
        liquidity: liquidity(data)
      }
    };
  }

  HP.calc = {cash: cash, orderDiscount: orderDiscount, billQty: billQty, customerGross: customerGross, customerOrderValue: customerOrderValue, factoryOrderCost: factoryOrderCost, expensesForOrder: expensesForOrder, orderProfit: orderProfit, clientBalance: clientBalance, factoryBalance: factoryBalance, periodMatch: periodMatch, periodTotals: periodTotals, liquidity: liquidity, controls: controls};
})(window.HaydarPack);
