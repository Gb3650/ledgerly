import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createSeed, STORAGE_KEY } from '../data/seed';
import { invoiceTotals, markOverdue, refreshBalances } from '../lib/accounting';
import { addDaysISO, todayISO, uid } from '../lib/format';
import type {
  BankTransaction,
  BooksState,
  Customer,
  Expense,
  Invoice,
  InvoiceLine,
  Product,
  Vendor,
} from '../types';

interface BooksContextValue {
  state: BooksState;
  resetSampleData: () => void;
  addCustomer: (c: Omit<Customer, 'id' | 'balance' | 'createdAt'>) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addVendor: (v: Omit<Vendor, 'id' | 'balance' | 'createdAt'>) => void;
  addProduct: (p: Omit<Product, 'id'>) => void;
  saveInvoice: (input: {
    id?: string;
    customerId: string;
    date: string;
    dueDate: string;
    status: Invoice['status'];
    message: string;
    lines: Omit<InvoiceLine, 'id' | 'amount'>[];
  }) => string;
  receivePayment: (invoiceId: string, amount?: number) => void;
  addExpense: (input: Omit<Expense, 'id' | 'createdAt'>) => void;
  payExpense: (id: string) => void;
  matchTransaction: (id: string, categoryAccountId: string) => void;
  excludeTransaction: (id: string) => void;
}

const BooksContext = createContext<BooksContextValue | null>(null);

function loadState(): BooksState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BooksState;
      return refreshBalances({ ...parsed, invoices: markOverdue(parsed.invoices) });
    }
  } catch {
    /* ignore */
  }
  return refreshBalances(createSeed());
}

export function BooksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BooksState>(() => loadState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const commit = useCallback((updater: (prev: BooksState) => BooksState) => {
    setState((prev) => refreshBalances(updater(prev)));
  }, []);

  const resetSampleData = useCallback(() => {
    setState(refreshBalances(createSeed()));
  }, []);

  const addCustomer = useCallback(
    (c: Omit<Customer, 'id' | 'balance' | 'createdAt'>) => {
      commit((prev) => ({
        ...prev,
        customers: [
          ...prev.customers,
          { ...c, id: uid('cus'), balance: 0, createdAt: todayISO() },
        ],
      }));
    },
    [commit],
  );

  const updateCustomer = useCallback(
    (id: string, patch: Partial<Customer>) => {
      commit((prev) => ({
        ...prev,
        customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }));
    },
    [commit],
  );

  const addVendor = useCallback(
    (v: Omit<Vendor, 'id' | 'balance' | 'createdAt'>) => {
      commit((prev) => ({
        ...prev,
        vendors: [
          ...prev.vendors,
          { ...v, id: uid('ven'), balance: 0, createdAt: todayISO() },
        ],
      }));
    },
    [commit],
  );

  const addProduct = useCallback(
    (p: Omit<Product, 'id'>) => {
      commit((prev) => ({
        ...prev,
        products: [...prev.products, { ...p, id: uid('prd') }],
      }));
    },
    [commit],
  );

  const saveInvoice = useCallback(
    (input: {
      id?: string;
      customerId: string;
      date: string;
      dueDate: string;
      status: Invoice['status'];
      message: string;
      lines: Omit<InvoiceLine, 'id' | 'amount'>[];
    }) => {
      let newId = input.id ?? uid('inv');
      commit((prev) => {
        const lines: InvoiceLine[] = input.lines.map((l) => ({
          ...l,
          id: uid('il'),
          amount: Math.round(l.qty * l.rate * 100) / 100,
        }));
        const totals = invoiceTotals(lines);
        const existing = input.id ? prev.invoices.find((i) => i.id === input.id) : undefined;
        const number = existing?.number ?? String(prev.nextInvoiceNumber);
        const invoice: Invoice = {
          id: newId,
          number,
          customerId: input.customerId,
          date: input.date,
          dueDate: input.dueDate || addDaysISO(input.date, 30),
          status: input.status,
          message: input.message,
          lines,
          ...totals,
          balance: input.status === 'paid' ? 0 : totals.total,
          createdAt: existing?.createdAt ?? todayISO(),
        };
        const invoices = existing
          ? prev.invoices.map((i) => (i.id === existing.id ? invoice : i))
          : [...prev.invoices, invoice];
        return {
          ...prev,
          invoices,
          nextInvoiceNumber: existing ? prev.nextInvoiceNumber : prev.nextInvoiceNumber + 1,
        };
      });
      return newId;
    },
    [commit],
  );

  const receivePayment = useCallback(
    (invoiceId: string, amount?: number) => {
      commit((prev) => {
        const inv = prev.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.balance <= 0) return prev;
        const pay = amount ?? inv.balance;
        const balance = Math.max(0, Math.round((inv.balance - pay) * 100) / 100);
        const customer = prev.customers.find((c) => c.id === inv.customerId);
        const txn: BankTransaction = {
          id: uid('txn'),
          accountId: 'acc_checking',
          date: todayISO(),
          description: `Payment received — ${customer?.name ?? 'Customer'} INV-${inv.number}`,
          amount: pay,
          type: 'payment',
          matched: true,
          categoryAccountId: 'acc_ar',
          payee: customer?.name,
        };
        const checking = prev.accounts.find((a) => a.id === 'acc_checking');
        return {
          ...prev,
          invoices: prev.invoices.map((i) =>
            i.id === invoiceId
              ? { ...i, balance, status: balance === 0 ? 'paid' : i.status }
              : i,
          ),
          transactions: [txn, ...prev.transactions],
          accounts: prev.accounts.map((a) =>
            a.id === 'acc_checking' && checking
              ? { ...a, balance: a.balance + pay }
              : a,
          ),
        };
      });
    },
    [commit],
  );

  const addExpense = useCallback(
    (input: Omit<Expense, 'id' | 'createdAt'>) => {
      commit((prev) => {
        const expense: Expense = { ...input, id: uid('exp'), createdAt: todayISO() };
        let accounts = prev.accounts;
        let transactions = prev.transactions;
        if (expense.status === 'paid') {
          accounts = accounts.map((a) => {
            if (a.id === expense.paymentAccountId) {
              const delta = a.type === 'credit_card' ? -expense.amount : -expense.amount;
              return { ...a, balance: a.balance + delta };
            }
            return a;
          });
          transactions = [
            {
              id: uid('txn'),
              accountId: expense.paymentAccountId,
              date: expense.date,
              description: expense.payeeName,
              amount: -expense.amount,
              type: 'expense',
              matched: true,
              categoryAccountId: expense.categoryAccountId,
              payee: expense.payeeName,
            },
            ...transactions,
          ];
        }
        return { ...prev, expenses: [expense, ...prev.expenses], accounts, transactions };
      });
    },
    [commit],
  );

  const payExpense = useCallback(
    (id: string) => {
      commit((prev) => {
        const exp = prev.expenses.find((e) => e.id === id);
        if (!exp || exp.status === 'paid') return prev;
        return {
          ...prev,
          expenses: prev.expenses.map((e) =>
            e.id === id ? { ...e, status: 'paid', paymentAccountId: e.paymentAccountId || 'acc_checking' } : e,
          ),
          accounts: prev.accounts.map((a) =>
            a.id === (exp.paymentAccountId || 'acc_checking')
              ? { ...a, balance: a.balance - exp.amount }
              : a.id === 'acc_ap'
                ? { ...a, balance: Math.max(0, a.balance - exp.amount) }
                : a,
          ),
          transactions: [
            {
              id: uid('txn'),
              accountId: exp.paymentAccountId || 'acc_checking',
              date: todayISO(),
              description: exp.payeeName,
              amount: -exp.amount,
              type: 'expense' as const,
              matched: true,
              categoryAccountId: exp.categoryAccountId,
              payee: exp.payeeName,
            },
            ...prev.transactions,
          ],
        };
      });
    },
    [commit],
  );

  const matchTransaction = useCallback(
    (id: string, categoryAccountId: string) => {
      commit((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? { ...t, matched: true, categoryAccountId } : t,
        ),
      }));
    },
    [commit],
  );

  const excludeTransaction = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }));
    },
    [commit],
  );

  const value = useMemo(
    () => ({
      state,
      resetSampleData,
      addCustomer,
      updateCustomer,
      addVendor,
      addProduct,
      saveInvoice,
      receivePayment,
      addExpense,
      payExpense,
      matchTransaction,
      excludeTransaction,
    }),
    [
      state,
      resetSampleData,
      addCustomer,
      updateCustomer,
      addVendor,
      addProduct,
      saveInvoice,
      receivePayment,
      addExpense,
      payExpense,
      matchTransaction,
      excludeTransaction,
    ],
  );

  return <BooksContext.Provider value={value}>{children}</BooksContext.Provider>;
}

export function useBooks() {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error('useBooks must be used within BooksProvider');
  return ctx;
}
