import type { Account, BooksState, Expense, Invoice } from '../types';

export function invoiceTotals(lines: { qty: number; rate: number }[], taxRate = 0.08) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, total };
}

export function unpaidInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
}

export function profitAndLoss(state: BooksState, from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to;

  const income = state.invoices
    .filter((i) => i.status === 'paid' && inRange(i.date))
    .reduce((s, i) => s + i.total, 0);

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

export function balanceSheet(state: BooksState) {
  const group = (types: Account['type'][]) =>
    state.accounts
      .filter((a) => types.includes(a.type) && a.isActive)
      .map((a) => ({ ...a }));

  const assets = group(['bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset']);
  // Credit cards are stored as negative bank-style balances; show them as amounts owed.
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
    // current | 1–30 | 31–60 | 61+
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
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));

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
    return { ...v, balance: unpaid.reduce((s, e) => s + e.amount, 0) };
  });

  void byId;
  return { ...state, accounts, customers, vendors };
}

export function markOverdue(invoices: Invoice[]): Invoice[] {
  const today = todayStr();
  return invoices.map((inv) => {
    if ((inv.status === 'sent' || inv.status === 'overdue') && inv.dueDate < today && inv.balance > 0) {
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
