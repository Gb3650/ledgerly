import type { Account, BooksState, Expense, Invoice } from '../types';

export function invoiceTotals(lines: { qty: number; rate: number }[], taxRate = 0.08) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
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

export function profitAndLoss(state: BooksState, from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;

  // Cash-ish income: payments collected in range (supports partial pays).
  const income = (state.payments ?? [])
    .filter((p) => inRange(p.date))
    .reduce((s, p) => s + p.amount, 0);

  const expenses = state.expenses
    .filter((e) => e.status === 'paid' && inRange(e.date))
    .reduce((s, e) => s + e.amount, 0);

  const byCategory = new Map<string, number>();
  for (const e of state.expenses.filter((x) => x.status === 'paid' && inRange(x.date))) {
    const acct = state.accounts.find((a) => a.id === e.categoryAccountId);
    const name = acct?.name ?? 'Uncategorized';
    byCategory.set(name, (byCategory.get(name) ?? 0) + e.amount);
  }

  const net = income - expenses;

  return {
    income,
    expenses,
    net,
    byCategory: [...byCategory.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export function salesByProduct(state: BooksState, from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;
  const map = new Map<string, { name: string; qty: number; amount: number }>();
  for (const inv of state.invoices) {
    if (inv.status === 'draft' || inv.status === 'void' || !inRange(inv.date)) continue;
    for (const line of inv.lines) {
      const key = line.productId || line.description;
      const product = state.products.find((p) => p.id === line.productId);
      const name = product?.name ?? line.description;
      const cur = map.get(key) ?? { name, qty: 0, amount: 0 };
      cur.qty += line.qty;
      cur.amount += line.amount;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
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

  const invAsset = accounts.find((a) => a.id === 'acc_inventory');
  if (invAsset) {
    // Cost proxy: 40% of sell price × qty across all locations.
    invAsset.balance = state.products
      .filter((p) => p.type === 'inventory')
      .reduce((s, p) => {
        const qty = stock
          .filter((row) => row.productId === p.id)
          .reduce((n, row) => n + row.qty, 0);
        return s + qty * p.unitPrice * 0.4;
      }, 0);
    invAsset.balance = Math.round(invAsset.balance * 100) / 100;
  }

  const ar = accounts.find((a) => a.type === 'accounts_receivable');
  if (ar) {
    ar.balance = unpaidInvoices(state.invoices).reduce((s, i) => s + i.balance, 0);
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
    payments: state.payments ?? [],
    purchaseOrders: state.purchaseOrders ?? [],
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
