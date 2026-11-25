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
import { adjustStock, withProductTotals } from '../lib/inventory';
import { addDaysISO, todayISO, uid } from '../lib/format';
import type {
  BooksState,
  Customer,
  Expense,
  Invoice,
  InvoiceLine,
  Location,
  PoLine,
  Product,
  PurchaseOrder,
  Vendor,
} from '../types';

interface BooksContextValue {
  state: BooksState;
  resetSampleData: () => void;
  updateCompany: (patch: Partial<BooksState['company']>) => void;
  exportBooks: () => string;
  importBooks: (json: string) => boolean;
  addLocation: (l: Omit<Location, 'id'>) => string;
  updateLocation: (id: string, patch: Partial<Location>) => void;
  transferStock: (input: {
    fromLocationId: string;
    toLocationId: string;
    productId: string;
    qty: number;
    memo?: string;
  }) => boolean;
  addCustomer: (c: Omit<Customer, 'id' | 'balance' | 'createdAt'>) => string;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addVendor: (v: Omit<Vendor, 'id' | 'balance' | 'createdAt'>) => string;
  updateVendor: (id: string, patch: Partial<Vendor>) => void;
  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  saveInvoice: (input: {
    id?: string;
    customerId: string;
    locationId?: string;
    date: string;
    dueDate: string;
    status: Invoice['status'];
    message: string;
    lines: Omit<InvoiceLine, 'id' | 'amount'>[];
  }) => string;
  quickInvoice: (input: {
    customerId: string;
    productId: string;
    qty: number;
    locationId?: string;
    send?: boolean;
  }) => string;
  receivePayment: (invoiceId: string, amount?: number, method?: string, memo?: string) => void;
  markInvoiceEmailed: (invoiceId: string) => void;
  addExpense: (input: Omit<Expense, 'id' | 'createdAt'>) => void;
  payExpense: (id: string) => void;
  savePurchaseOrder: (input: {
    id?: string;
    vendorId: string;
    locationId: string;
    date: string;
    expectedDate: string;
    status: PurchaseOrder['status'];
    memo: string;
    lines: Omit<PoLine, 'id' | 'amount' | 'qtyReceived'>[];
  }) => string;
  receivePo: (poId: string, receiveAll?: boolean) => void;
  matchTransaction: (id: string, categoryAccountId: string) => void;
  excludeTransaction: (id: string) => void;
}

const BooksContext = createContext<BooksContextValue | null>(null);

function inventoryIds(products: Product[]) {
  return new Set(products.filter((p) => p.type === 'inventory').map((p) => p.id));
}

function normalize(raw: BooksState): BooksState {
  const locations = raw.locations ?? [];
  const stock = raw.stock ?? [];
  const products = withProductTotals(raw.products ?? [], stock);
  return refreshBalances({
    ...raw,
    locations,
    stock,
    stockTransfers: raw.stockTransfers ?? [],
    payments: raw.payments ?? [],
    purchaseOrders: raw.purchaseOrders ?? [],
    products,
    nextPoNumber: raw.nextPoNumber ?? 501,
    invoices: markOverdue(raw.invoices ?? []),
  });
}

function loadState(): BooksState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw) as BooksState);
  } catch {
    /* ignore */
  }
  return normalize(createSeed());
}

export function BooksProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BooksState>(() => loadState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const commit = useCallback((updater: (prev: BooksState) => BooksState) => {
    setState((prev) => normalize(updater(prev)));
  }, []);

  const resetSampleData = useCallback(() => setState(normalize(createSeed())), []);

  const updateCompany = useCallback(
    (patch: Partial<BooksState['company']>) => {
      commit((prev) => ({ ...prev, company: { ...prev.company, ...patch } }));
    },
    [commit],
  );

  const exportBooks = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const importBooks = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as BooksState;
      if (!parsed.company || !Array.isArray(parsed.customers)) return false;
      setState(normalize(parsed));
      return true;
    } catch {
      return false;
    }
  }, []);

  const addLocation = useCallback(
    (l: Omit<Location, 'id'>) => {
      const id = uid('loc');
      commit((prev) => ({ ...prev, locations: [...prev.locations, { ...l, id }] }));
      return id;
    },
    [commit],
  );

  const updateLocation = useCallback(
    (id: string, patch: Partial<Location>) => {
      commit((prev) => ({
        ...prev,
        locations: prev.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
    },
    [commit],
  );

  const transferStock = useCallback(
    (input: {
      fromLocationId: string;
      toLocationId: string;
      productId: string;
      qty: number;
      memo?: string;
    }) => {
      if (input.qty <= 0 || input.fromLocationId === input.toLocationId) return false;
      let ok = false;
      commit((prev) => {
        const ids = inventoryIds(prev.products);
        const from = prev.stock.find(
          (s) => s.locationId === input.fromLocationId && s.productId === input.productId,
        );
        if (!from || from.qty < input.qty) return prev;
        ok = true;
        let stock = adjustStock(
          prev.stock,
          input.fromLocationId,
          [{ productId: input.productId, qty: input.qty }],
          -1,
          ids,
        );
        stock = adjustStock(
          stock,
          input.toLocationId,
          [{ productId: input.productId, qty: input.qty }],
          1,
          ids,
        );
        return {
          ...prev,
          stock,
          stockTransfers: [
            {
              id: uid('xfer'),
              date: todayISO(),
              fromLocationId: input.fromLocationId,
              toLocationId: input.toLocationId,
              productId: input.productId,
              qty: input.qty,
              memo: input.memo ?? '',
              createdAt: todayISO(),
            },
            ...prev.stockTransfers,
          ],
        };
      });
      return ok;
    },
    [commit],
  );

  const addCustomer = useCallback(
    (c: Omit<Customer, 'id' | 'balance' | 'createdAt'>) => {
      const id = uid('cus');
      commit((prev) => ({
        ...prev,
        customers: [...prev.customers, { ...c, id, balance: 0, createdAt: todayISO() }],
      }));
      return id;
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
      const id = uid('ven');
      commit((prev) => ({
        ...prev,
        vendors: [...prev.vendors, { ...v, id, balance: 0, createdAt: todayISO() }],
      }));
      return id;
    },
    [commit],
  );

  const updateVendor = useCallback(
    (id: string, patch: Partial<Vendor>) => {
      commit((prev) => ({
        ...prev,
        vendors: prev.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      }));
    },
    [commit],
  );

  const addProduct = useCallback(
    (p: Omit<Product, 'id'>) => {
      commit((prev) => ({
        ...prev,
        products: [...prev.products, { ...p, id: uid('prd'), qtyOnHand: p.qtyOnHand ?? 0 }],
      }));
    },
    [commit],
  );

  const updateProduct = useCallback(
    (id: string, patch: Partial<Product>) => {
      commit((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    [commit],
  );

  const saveInvoice = useCallback(
    (input: {
      id?: string;
      customerId: string;
      locationId?: string;
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
        const paidSoFar = (prev.payments ?? [])
          .filter((p) => p.invoiceId === (existing?.id ?? newId))
          .reduce((s, p) => s + p.amount, 0);
        let status = input.status;
        let balance = Math.max(0, Math.round((totals.total - paidSoFar) * 100) / 100);
        if (status === 'paid') balance = 0;
        else if (paidSoFar > 0 && balance > 0) status = 'partial';
        else if (balance === 0 && paidSoFar > 0) status = 'paid';

        const locationId =
          input.locationId ||
          existing?.locationId ||
          prev.locations.find((l) => l.isActive)?.id;

        const wasOpen = existing && existing.status !== 'draft' && existing.status !== 'void';
        const willOpen = status !== 'draft' && status !== 'void';
        const ids = inventoryIds(prev.products);
        let stock = prev.stock;

        if (wasOpen && existing?.locationId) {
          stock = adjustStock(stock, existing.locationId, existing.lines, 1, ids);
        }
        if (willOpen && locationId) {
          stock = adjustStock(stock, locationId, lines, -1, ids);
        }

        const invoice: Invoice = {
          id: newId,
          number,
          customerId: input.customerId,
          locationId,
          date: input.date,
          dueDate: input.dueDate || addDaysISO(input.date, 30),
          status,
          message: input.message,
          lines,
          ...totals,
          balance: status === 'paid' ? 0 : balance,
          createdAt: existing?.createdAt ?? todayISO(),
          emailedAt: existing?.emailedAt,
        };
        const invoices = existing
          ? prev.invoices.map((i) => (i.id === existing.id ? invoice : i))
          : [...prev.invoices, invoice];
        return {
          ...prev,
          stock,
          invoices,
          nextInvoiceNumber: existing ? prev.nextInvoiceNumber : prev.nextInvoiceNumber + 1,
        };
      });
      return newId;
    },
    [commit],
  );

  const quickInvoice = useCallback(
    (input: {
      customerId: string;
      productId: string;
      qty: number;
      locationId?: string;
      send?: boolean;
    }) => {
      const product = state.products.find((p) => p.id === input.productId);
      if (!product) return '';
      return saveInvoice({
        customerId: input.customerId,
        locationId: input.locationId,
        date: todayISO(),
        dueDate: addDaysISO(todayISO(), 30),
        status: input.send ? 'sent' : 'draft',
        message: 'Thank you for your order with ABC LLC.',
        lines: [
          {
            productId: product.id,
            description: product.description || product.name,
            qty: input.qty,
            rate: product.unitPrice,
          },
        ],
      });
    },
    [saveInvoice, state.products],
  );

  const receivePayment = useCallback(
    (invoiceId: string, amount?: number, method = 'Manual', memo = '') => {
      commit((prev) => {
        const inv = prev.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.balance <= 0) return prev;
        const pay = Math.min(inv.balance, amount ?? inv.balance);
        const balance = Math.max(0, Math.round((inv.balance - pay) * 100) / 100);
        const status = balance === 0 ? 'paid' : 'partial';
        const customer = prev.customers.find((c) => c.id === inv.customerId);
        return {
          ...prev,
          payments: [
            {
              id: uid('pay'),
              invoiceId,
              amount: pay,
              date: todayISO(),
              method,
              memo,
              createdAt: todayISO(),
            },
            ...(prev.payments ?? []),
          ],
          invoices: prev.invoices.map((i) =>
            i.id === invoiceId ? { ...i, balance, status } : i,
          ),
          transactions: [
            {
              id: uid('txn'),
              accountId: 'acc_checking',
              date: todayISO(),
              description: `Payment — ${customer?.name ?? 'Customer'} INV-${inv.number}`,
              amount: pay,
              type: 'payment' as const,
              matched: true,
              categoryAccountId: 'acc_ar',
              payee: customer?.name,
            },
            ...prev.transactions,
          ],
          accounts: prev.accounts.map((a) =>
            a.id === 'acc_checking' ? { ...a, balance: a.balance + pay } : a,
          ),
        };
      });
    },
    [commit],
  );

  const markInvoiceEmailed = useCallback(
    (invoiceId: string) => {
      commit((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) =>
          i.id === invoiceId
            ? {
                ...i,
                emailedAt: todayISO(),
                status: i.status === 'draft' ? 'sent' : i.status,
              }
            : i,
        ),
      }));
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
          accounts = accounts.map((a) =>
            a.id === expense.paymentAccountId ? { ...a, balance: a.balance - expense.amount } : a,
          );
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
        const paymentAccountId = exp.paymentAccountId || 'acc_checking';
        return {
          ...prev,
          expenses: prev.expenses.map((e) =>
            e.id === id ? { ...e, status: 'paid', paymentAccountId } : e,
          ),
          accounts: prev.accounts.map((a) =>
            a.id === paymentAccountId
              ? { ...a, balance: a.balance - exp.amount }
              : a.id === 'acc_ap'
                ? { ...a, balance: Math.max(0, a.balance - exp.amount) }
                : a,
          ),
          transactions: [
            {
              id: uid('txn'),
              accountId: paymentAccountId,
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

  const savePurchaseOrder = useCallback(
    (input: {
      id?: string;
      vendorId: string;
      locationId: string;
      date: string;
      expectedDate: string;
      status: PurchaseOrder['status'];
      memo: string;
      lines: Omit<PoLine, 'id' | 'amount' | 'qtyReceived'>[];
    }) => {
      let newId = input.id ?? uid('po');
      commit((prev) => {
        const lines: PoLine[] = input.lines.map((l) => ({
          ...l,
          id: uid('pl'),
          qtyReceived: 0,
          amount: Math.round(l.qty * l.rate * 100) / 100,
        }));
        const totals = invoiceTotals(lines);
        const existing = input.id ? prev.purchaseOrders.find((p) => p.id === input.id) : undefined;
        const number = existing?.number ?? String(prev.nextPoNumber);
        const po: PurchaseOrder = {
          id: newId,
          number,
          vendorId: input.vendorId,
          locationId: input.locationId,
          date: input.date,
          expectedDate: input.expectedDate,
          status: input.status,
          memo: input.memo,
          lines: existing
            ? lines.map((l, i) => ({
                ...l,
                qtyReceived: existing.lines[i]?.qtyReceived ?? 0,
              }))
            : lines,
          ...totals,
          createdAt: existing?.createdAt ?? todayISO(),
        };
        const purchaseOrders = existing
          ? prev.purchaseOrders.map((p) => (p.id === existing.id ? po : p))
          : [...(prev.purchaseOrders ?? []), po];
        return {
          ...prev,
          purchaseOrders,
          nextPoNumber: existing ? prev.nextPoNumber : prev.nextPoNumber + 1,
        };
      });
      return newId;
    },
    [commit],
  );

  const receivePo = useCallback(
    (poId: string, receiveAll = true) => {
      commit((prev) => {
        const po = prev.purchaseOrders.find((p) => p.id === poId);
        if (!po || po.status === 'cancelled' || po.status === 'received') return prev;
        const lines = po.lines.map((l) => ({
          ...l,
          qtyReceived: receiveAll ? l.qty : Math.min(l.qty, l.qtyReceived + 1),
        }));
        const fully = lines.every((l) => l.qtyReceived >= l.qty);
        const any = lines.some((l) => l.qtyReceived > 0);
        const deltaLines = lines.map((l, i) => ({
          productId: l.productId,
          qty: l.qtyReceived - po.lines[i].qtyReceived,
        }));
        const stock = adjustStock(
          prev.stock,
          po.locationId,
          deltaLines,
          1,
          inventoryIds(prev.products),
        );
        return {
          ...prev,
          stock,
          purchaseOrders: prev.purchaseOrders.map((p) =>
            p.id === poId
              ? {
                  ...p,
                  lines,
                  status: fully ? 'received' : any ? 'partial' : p.status,
                }
              : p,
          ),
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
      updateCompany,
      exportBooks,
      importBooks,
      addLocation,
      updateLocation,
      transferStock,
      addCustomer,
      updateCustomer,
      addVendor,
      updateVendor,
      addProduct,
      updateProduct,
      saveInvoice,
      quickInvoice,
      receivePayment,
      markInvoiceEmailed,
      addExpense,
      payExpense,
      savePurchaseOrder,
      receivePo,
      matchTransaction,
      excludeTransaction,
    }),
    [
      state,
      resetSampleData,
      updateCompany,
      exportBooks,
      importBooks,
      addLocation,
      updateLocation,
      transferStock,
      addCustomer,
      updateCustomer,
      addVendor,
      updateVendor,
      addProduct,
      updateProduct,
      saveInvoice,
      quickInvoice,
      receivePayment,
      markInvoiceEmailed,
      addExpense,
      payExpense,
      savePurchaseOrder,
      receivePo,
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
