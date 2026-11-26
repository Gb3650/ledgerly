import type {
  Account,
  BooksState,
  Expense,
  Invoice,
  SalesReceipt,
} from '../types';

export function invoiceTotals(lines: { qty: number; rate: number }[], taxRate = 0.08) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.qty * l.rate, 0) * 100) / 100;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

export function openReceivableStatuses(status: Invoice['status']) {
  return status === 'sent' || status === 'partial' || status === 'overdue';
}

export function unpaidInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => openReceivableStatuses(i.status) && i.balance > 0);
}

function lineCogs(
  state: BooksState,
  lines: { productId?: string; qty: number }[],
): number {
  return lines.reduce((s, l) => {
    if (!l.productId) return s;
    const p = state.products.find((x) => x.id === l.productId);
    if (!p || p.type !== 'inventory') return s;
    return s + l.qty * (p.cost ?? 0);
  }, 0);
}

/** Accrual P&L: invoiced + cash sales, COGS, operating expenses. */
export function profitAndLoss(state: BooksState, from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;

  const invoices = (state.invoices ?? []).filter(
    (i) => i.status !== 'draft' && i.status !== 'void' && inRange(i.date),
  );
  const receipts = (state.salesReceipts ?? []).filter((r) => inRange(r.date));

  const invoiceIncome = invoices.reduce((s, i) => s + i.subtotal, 0);
  const receiptIncome = receipts.reduce((s, r) => s + r.subtotal, 0);
  const income = Math.round((invoiceIncome + receiptIncome) * 100) / 100;
  const taxCollected =
    Math.round(
      (invoices.reduce((s, i) => s + i.tax, 0) + receipts.reduce((s, r) => s + r.tax, 0)) * 100,
    ) / 100;

  const cogs =
    Math.round(
      (invoices.reduce((s, i) => s + lineCogs(state, i.lines), 0) +
        receipts.reduce((s, r) => s + lineCogs(state, r.lines), 0)) *
        100,
    ) / 100;

  const grossProfit = Math.round((income - cogs) * 100) / 100;

  const expensesList = state.expenses.filter((e) => e.status === 'paid' && inRange(e.date));
  const expenses = Math.round(expensesList.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  const byCategory = new Map<string, number>();
  for (const e of expensesList) {
    const acct = state.accounts.find((a) => a.id === e.categoryAccountId);
    const name = acct?.name ?? 'Uncategorized';
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount);
  }

  const byIncome = new Map<string, number>();
  const addIncomeLine = (name: string, amount: number) => {
    byIncome.set(name, (byIncome.get(name) ?? 0) + amount);
  };
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const product = state.products.find((p) => p.id === line.productId);
      const acct = state.accounts.find(
        (a) => a.id === (product?.incomeAccountId ?? 'acc_products'),
      );
      addIncomeLine(acct?.name ?? 'Sales', line.amount);
    }
  }
  for (const r of receipts) {
    for (const line of r.lines) {
      const product = state.products.find((p) => p.id === line.productId);
      const acct = state.accounts.find(
        (a) => a.id === (product?.incomeAccountId ?? 'acc_products'),
      );
      addIncomeLine(acct?.name ?? 'Sales', line.amount);
    }
  }

  const cashCollected = (state.payments ?? [])
    .filter((p) => inRange(p.date))
    .reduce((s, p) => s + p.amount, 0);
  const cashSales = receipts.reduce((s, r) => s + r.total, 0);

  const net = Math.round((grossProfit - expenses) * 100) / 100;

  return {
    income,
    invoiceIncome,
    receiptIncome,
    taxCollected,
    cogs,
    grossProfit,
    expenses,
    net,
    cashCollected: Math.round((cashCollected + cashSales) * 100) / 100,
    byCategory: [...byCategory.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
    byIncome: [...byIncome.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function inventoryValuation(state: BooksState) {
  const rows = state.products
    .filter((p) => p.type === 'inventory' && p.isActive !== false)
    .map((p) => {
      const qty = (state.stock ?? [])
        .filter((s) => s.productId === p.id)
        .reduce((n, s) => n + s.qty, 0);
      const value = Math.round(qty * (p.cost ?? 0) * 100) / 100;
      return {
        product: p,
        qty,
        cost: p.cost ?? 0,
        value,
        saleValue: Math.round(qty * p.unitPrice * 100) / 100,
      };
    })
    .sort((a, b) => b.value - a.value);
  const totalValue = Math.round(rows.reduce((s, r) => s + r.value, 0) * 100) / 100;
  const totalSaleValue = Math.round(rows.reduce((s, r) => s + r.saleValue, 0) * 100) / 100;
  return { rows, totalValue, totalSaleValue };
}

export function salesByProduct(state: BooksState, from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;
  const map = new Map<string, { name: string; qty: number; amount: number; cogs: number }>();

  const add = (doc: Invoice | SalesReceipt) => {
    for (const line of doc.lines) {
      const key = line.productId || line.description;
      const product = state.products.find((p) => p.id === line.productId);
      const name = product?.name ?? line.description;
      const cur = map.get(key) ?? { name, qty: 0, amount: 0, cogs: 0 };
      cur.qty += line.qty;
      cur.amount += line.amount;
      if (product?.type === 'inventory') cur.cogs += line.qty * (product.cost ?? 0);
      map.set(key, cur);
    }
  };

  for (const inv of state.invoices) {
    if (inv.status === 'draft' || inv.status === 'void' || !inRange(inv.date)) continue;
    add(inv);
  }
  for (const r of state.salesReceipts ?? []) {
    if (!inRange(r.date)) continue;
    add(r);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      cogs: Math.round(r.cogs * 100) / 100,
      margin: Math.round((r.amount - r.cogs) * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function spendByVendor(state: BooksState, from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;
  const map = new Map<string, { name: string; expenses: number; pos: number; total: number }>();

  for (const e of state.expenses.filter((x) => inRange(x.date))) {
    const key = e.payeeId || e.payeeName;
    const vendor = state.vendors.find((v) => v.id === e.payeeId);
    const name = vendor?.name ?? e.payeeName;
    const cur = map.get(key) ?? { name, expenses: 0, pos: 0, total: 0 };
    cur.expenses += e.amount;
    cur.total += e.amount;
    map.set(key, cur);
  }

  for (const po of state.purchaseOrders ?? []) {
    if (po.status === 'cancelled' || po.status === 'draft' || !inRange(po.date)) continue;
    const vendor = state.vendors.find((v) => v.id === po.vendorId);
    const key = po.vendorId;
    const name = vendor?.name ?? 'Unknown vendor';
    const cur = map.get(key) ?? { name, expenses: 0, pos: 0, total: 0 };
    cur.pos += po.total;
    cur.total += po.total;
    map.set(key, cur);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function monthlyIncomeSeries(state: BooksState, year: number) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const from = `${year}-${month}-01`;
    const to = `${year}-${month}-31`;
    const pl = profitAndLoss(state, from, to);
    return { month: i + 1, label: from.slice(5, 7), income: pl.income, net: pl.net };
  });
  return months;
}

export function balanceSheet(state: BooksState) {
  const group = (types: Account['type'][]) =>
    state.accounts
      .filter((a) => types.includes(a.type) && a.isActive)
      .map((a) => ({ ...a }));

  const assets = group(['bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset']);
  const liabilities = group([
    'accounts_payable',
    'credit_card',
    'other_current_liability',
  ]).map((a) => (a.type === 'credit_card' ? { ...a, balance: Math.abs(a.balance) } : a));
  const equity = group(['equity']);

  const sum = (rows: Account[]) => rows.reduce((s, a) => s + a.balance, 0);

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const equityAccounts = sum(equity);
  const year = new Date().getFullYear();
  const { net: netIncome } = profitAndLoss(state, `${year}-01-01`, `${year}-12-31`);

  return {
    assets,
    liabilities,
    equity,
    netIncome,
    totalAssets,
    totalLiabilities,
    totalEquity: equityAccounts + netIncome,
  };
}

export function arAging(invoices: Invoice[], customers: BooksState['customers']) {
  const open = unpaidInvoices(invoices);
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  const today = new Date();
  const rows = open.map((inv) => {
    const due = new Date(inv.dueDate + 'T12:00:00');
    const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
    let bucket: keyof typeof buckets = 'current';
    if (days <= 0) bucket = 'current';
    else if (days <= 30) bucket = 'd30';
    else if (days <= 60) bucket = 'd60';
    else bucket = 'd90';
    buckets[bucket] += inv.balance;
    const customer = customers.find((c) => c.id === inv.customerId);
    return { invoice: inv, customerName: customer?.name ?? 'Unknown', days, bucket };
  });
  return { buckets, rows };
}

export function refreshBalances(state: BooksState): BooksState {
  const accounts = state.accounts.map((a) => ({ ...a }));
  const stock = state.stock ?? [];
  const locations = state.locations ?? [];
  const valuation = inventoryValuation({ ...state, stock });

  const invAsset = accounts.find((a) => a.id === 'acc_inventory');
  if (invAsset) {
    invAsset.balance = valuation.totalValue;
  }

  const ar = accounts.find((a) => a.type === 'accounts_receivable');
  if (ar) {
    ar.balance = unpaidInvoices(state.invoices).reduce((s, i) => s + i.balance, 0);
  }

  const taxPayable = accounts.find((a) => a.id === 'acc_sales_tax');
  if (taxPayable) {
    const invTax = (state.invoices ?? [])
      .filter((i) => i.status !== 'draft' && i.status !== 'void')
      .reduce((s, i) => s + i.tax, 0);
    const rcptTax = (state.salesReceipts ?? []).reduce((s, r) => s + r.tax, 0);
    taxPayable.balance = Math.round((invTax + rcptTax) * 100) / 100;
  }

  const cogsAcct = accounts.find((a) => a.id === 'acc_cogs');
  if (cogsAcct) {
    const year = new Date().getFullYear();
    cogsAcct.balance = profitAndLoss(state, `${year}-01-01`, `${year}-12-31`).cogs;
  }

  const customers = state.customers.map((c) => ({
    ...c,
    balance: unpaidInvoices(state.invoices)
      .filter((i) => i.customerId === c.id)
      .reduce((s, i) => s + i.balance, 0),
  }));

  const vendors = state.vendors.map((v) => {
    const unpaid = state.expenses.filter(
      (e) => e.payeeId === v.id && e.status === 'pending',
    );
    const openPos = (state.purchaseOrders ?? []).filter(
      (po) => po.vendorId === v.id && (po.status === 'sent' || po.status === 'partial'),
    );
    return {
      ...v,
      balance:
        unpaid.reduce((s, e) => s + e.amount, 0) +
        openPos.reduce((s, po) => s + po.total, 0),
    };
  });

  return {
    ...state,
    locations,
    stock,
    stockTransfers: state.stockTransfers ?? [],
    stockMovements: state.stockMovements ?? [],
    payments: state.payments ?? [],
    purchaseOrders: state.purchaseOrders ?? [],
    quotes: state.quotes ?? [],
    salesReceipts: state.salesReceipts ?? [],
    accounts,
    customers,
    vendors,
  };
}

export function markOverdue(invoices: Invoice[]): Invoice[] {
  const today = todayStr();
  return invoices.map((inv) => {
    if (
      (inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue') &&
      inv.dueDate < today &&
      inv.balance > 0
    ) {
      return { ...inv, status: 'overdue' as const };
    }
    return inv;
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function expenseImpact(expenses: Expense[]) {
  return expenses.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
}

export function invoiceBodyText(
  company: BooksState['company'],
  customer: BooksState['customers'][0] | undefined,
  inv: Invoice,
) {
  const lines = inv.lines
    .map((l) => `  - ${l.description}: ${l.qty} × $${l.rate.toFixed(2)} = $${l.amount.toFixed(2)}`)
    .join('\n');
  return [
    `${company.name}`,
    company.email,
    '',
    `Invoice #${inv.number}`,
    `Date: ${inv.date}   Due: ${inv.dueDate}`,
    `Bill to: ${customer?.name ?? 'Customer'}${customer?.company ? ` (${customer.company})` : ''}`,
    customer?.email ? `Email: ${customer.email}` : '',
    '',
    'Line items:',
    lines,
    '',
    `Subtotal: $${inv.subtotal.toFixed(2)}`,
    `Tax: $${inv.tax.toFixed(2)}`,
    `Total: $${inv.total.toFixed(2)}`,
    `Balance due: $${inv.balance.toFixed(2)}`,
    '',
    inv.message || 'Thank you for your business.',
  ]
    .filter(Boolean)
    .join('\n');
}
