import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createSeed, STORAGE_KEY } from '../data/seed';
import {
  billLineTotals,
  invoiceTotals,
  markBillsOverdue,
  markOverdue,
  refreshBalances,
} from '../lib/accounting';
import { fetchCloudBooks, saveCloudBooks } from '../lib/cloudBooks';
import {
  adjustStock,
  buildMovements,
  canFulfill,
  withProductTotals,
} from '../lib/inventory';
import { addDaysISO, todayISO, uid } from '../lib/format';
import type {
  Bill,
  BillLine,
  BooksState,
  Customer,
  Expense,
  Invoice,
  InvoiceLine,
  Location,
  PoLine,
  Product,
  PurchaseOrder,
  Quote,
  SalesReceipt,
  Vendor,
} from '../types';

interface BooksContextValue {
  state: BooksState;
  syncStatus: 'local' | 'cloud' | 'syncing' | 'error';
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
  adjustInventory: (input: {
    locationId: string;
    productId: string;
    qtyDelta: number;
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
    allowOversell?: boolean;
  }) => { id: string; ok: boolean; shortages?: Array<{ productId: string; need: number; have: number }> };
  voidInvoice: (invoiceId: string) => void;
  quickInvoice: (input: {
    customerId: string;
    productId: string;
    qty: number;
    locationId?: string;
    send?: boolean;
  }) => string;
  receivePayment: (invoiceId: string, amount?: number, method?: string, memo?: string) => void;
  markInvoiceEmailed: (invoiceId: string) => void;
  saveQuote: (input: {
    id?: string;
    customerId: string;
    locationId?: string;
    date: string;
    expiryDate: string;
    status: Quote['status'];
    message: string;
    lines: Omit<InvoiceLine, 'id' | 'amount'>[];
  }) => string;
  convertQuoteToInvoice: (quoteId: string) => string;
  saveSalesReceipt: (input: {
    id?: string;
    customerId?: string;
    customerName: string;
    locationId: string;
    date: string;
    paymentMethod: string;
    memo: string;
    lines: Omit<InvoiceLine, 'id' | 'amount'>[];
    allowOversell?: boolean;
  }) => { id: string; ok: boolean; shortages?: Array<{ productId: string; need: number; have: number }> };
  addExpense: (input: Omit<Expense, 'id' | 'createdAt'>) => void;
  payExpense: (id: string) => void;
  saveBill: (input: {
    id?: string;
    vendorId: string;
    date: string;
    dueDate: string;
    memo: string;
    lines: Array<Omit<BillLine, 'id' | 'amount'>>;
  }) => string;
  voidBill: (billId: string) => void;
  payBills: (input: {
    paymentAccountId: string;
    date: string;
    method?: string;
    memo?: string;
    allocations: Array<{ billId: string; amount: number }>;
  }) => void;
  receivePayments: (input: {
    customerId: string;
    date: string;
    method?: string;
    memo?: string;
    allocations: Array<{ invoiceId: string; amount: number }>;
  }) => void;
  savePurchaseOrder: (input: {
    id?: string;
    vendorId: string;
    locationId: string;
    date: string;
    expectedDate: string;
    status: PurchaseOrder['status'];
    memo: string;
    lines: Array<Omit<PoLine, 'id' | 'amount'> & { qtyReceived?: number }>;
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
  const products = withProductTotals(
    (raw.products ?? []).map((p) => ({
      ...p,
      cost: typeof p.cost === 'number' ? p.cost : 0,
      unitPrice: typeof p.unitPrice === 'number' ? p.unitPrice : 0,
      isActive: p.isActive !== false,
    })),
    stock,
  );
  return refreshBalances({
    ...raw,
    locations,
    stock,
    stockTransfers: raw.stockTransfers ?? [],
    stockMovements: raw.stockMovements ?? [],
    payments: raw.payments ?? [],
    bills: markBillsOverdue(raw.bills ?? []),
    billPayments: raw.billPayments ?? [],
    purchaseOrders: raw.purchaseOrders ?? [],
    quotes: raw.quotes ?? [],
    salesReceipts: raw.salesReceipts ?? [],
    products,
    nextPoNumber: raw.nextPoNumber ?? 501,
    nextQuoteNumber: raw.nextQuoteNumber ?? 2001,
    nextReceiptNumber: raw.nextReceiptNumber ?? 9001,
    nextBillNumber: raw.nextBillNumber ?? 1001,
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
  const [syncStatus, setSyncStatus] = useState<'local' | 'cloud' | 'syncing' | 'error'>('local');
  const hydrated = useRef(false);
  const skipCloud = useRef(false);
  /** Bumped to ignore stale /api/books responses after reset or remount. */
  const cloudLoadId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadId = ++cloudLoadId.current;
    (async () => {
      const cloud = await fetchCloudBooks();
      if (cancelled || loadId !== cloudLoadId.current) return;
      if (cloud?.company) {
        skipCloud.current = true;
        setState(normalize(cloud));
        setSyncStatus('cloud');
        skipCloud.current = false;
      }
      hydrated.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!hydrated.current || skipCloud.current) return;
    const t = window.setTimeout(() => {
      setSyncStatus((s) => (s === 'cloud' || s === 'syncing' ? 'syncing' : s));
      void saveCloudBooks(state).then((ok) => {
        if (ok) setSyncStatus('cloud');
        else setSyncStatus((s) => (s === 'syncing' ? 'local' : s));
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [state]);

  const commit = useCallback((updater: (prev: BooksState) => BooksState) => {
    setState((prev) => normalize(updater(prev)));
  }, []);

  const resetSampleData = useCallback(() => {
    // Invalidate any in-flight cloud hydrate so it cannot overwrite this reset.
    cloudLoadId.current += 1;
    const seed = normalize(createSeed());
    skipCloud.current = true;
    setState(seed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {
      /* ignore quota */
    }
    hydrated.current = true;
    skipCloud.current = false;
    setSyncStatus('syncing');
    // Persist seed to Postgres immediately so the next reload stays reset.
    void saveCloudBooks(seed).then((ok) => {
      setSyncStatus(ok ? 'cloud' : 'local');
    });
  }, []);

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
        const lines = [{ productId: input.productId, qty: input.qty }];
        let stock = adjustStock(prev.stock, input.fromLocationId, lines, -1, ids);
        stock = adjustStock(stock, input.toLocationId, lines, 1, ids);
        const movements = [
          ...buildMovements(input.fromLocationId, lines, -1, ids, 'transfer_out', {
            memo: input.memo,
          }),
          ...buildMovements(input.toLocationId, lines, 1, ids, 'transfer_in', {
            memo: input.memo,
          }),
        ];
        return {
          ...prev,
          stock,
          stockMovements: [...movements, ...(prev.stockMovements ?? [])],
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

  const adjustInventory = useCallback(
    (input: {
      locationId: string;
      productId: string;
      qtyDelta: number;
      memo?: string;
    }) => {
      if (!input.qtyDelta) return false;
      let ok = false;
      commit((prev) => {
        const ids = inventoryIds(prev.products);
        if (!ids.has(input.productId)) return prev;
        const have = prev.stock.find(
          (s) => s.locationId === input.locationId && s.productId === input.productId,
        )?.qty ?? 0;
        if (input.qtyDelta < 0 && have < Math.abs(input.qtyDelta)) return prev;
        ok = true;
        const lines = [{ productId: input.productId, qty: Math.abs(input.qtyDelta) }];
        const direction: 1 | -1 = input.qtyDelta > 0 ? 1 : -1;
        const stock = adjustStock(prev.stock, input.locationId, lines, direction, ids);
        const movements = buildMovements(
          input.locationId,
          lines,
          direction,
          ids,
          'adjustment',
          { memo: input.memo ?? 'Inventory adjustment' },
        );
        return {
          ...prev,
          stock,
          stockMovements: [...movements, ...(prev.stockMovements ?? [])],
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
        products: [
          ...prev.products,
          { ...p, id: uid('prd'), qtyOnHand: p.qtyOnHand ?? 0, isActive: true },
        ],
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
      allowOversell?: boolean;
    }) => {
      let newId = input.id ?? uid('inv');
      let result: {
        id: string;
        ok: boolean;
        shortages?: Array<{ productId: string; need: number; have: number }>;
      } = { id: newId, ok: true };

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
        let stockMovements = prev.stockMovements ?? [];

        // Restore then re-apply so edits don't double-deplete.
        if (wasOpen && existing?.locationId) {
          stock = adjustStock(stock, existing.locationId, existing.lines, 1, ids);
          stockMovements = [
            ...buildMovements(existing.locationId, existing.lines, 1, ids, 'invoice_void', {
              refType: 'invoice',
              refId: existing.id,
              memo: `Edit restore INV-${existing.number}`,
            }),
            ...stockMovements,
          ];
        }
        if (willOpen && locationId) {
          const check = canFulfill(stock, locationId, lines, ids);
          if (!check.ok && !input.allowOversell) {
            result = { id: newId, ok: false, shortages: check.shortages };
            return prev;
          }
          stock = adjustStock(stock, locationId, lines, -1, ids);
          stockMovements = [
            ...buildMovements(locationId, lines, -1, ids, 'invoice_fulfill', {
              refType: 'invoice',
              refId: newId,
              memo: `Fulfill INV-${number}`,
              date: input.date,
            }),
            ...stockMovements,
          ];
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
          quoteId: existing?.quoteId,
        };
        const invoices = existing
          ? prev.invoices.map((i) => (i.id === existing.id ? invoice : i))
          : [...prev.invoices, invoice];
        return {
          ...prev,
          stock,
          stockMovements,
          invoices,
          nextInvoiceNumber: existing ? prev.nextInvoiceNumber : prev.nextInvoiceNumber + 1,
        };
      });
      return result;
    },
    [commit],
  );

  const voidInvoice = useCallback(
    (invoiceId: string) => {
      commit((prev) => {
        const inv = prev.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.status === 'void') return prev;
        const ids = inventoryIds(prev.products);
        let stock = prev.stock;
        let stockMovements = prev.stockMovements ?? [];
        if (inv.status !== 'draft' && inv.locationId) {
          stock = adjustStock(stock, inv.locationId, inv.lines, 1, ids);
          stockMovements = [
            ...buildMovements(inv.locationId, inv.lines, 1, ids, 'invoice_void', {
              refType: 'invoice',
              refId: inv.id,
              memo: `Void INV-${inv.number}`,
            }),
            ...stockMovements,
          ];
        }
        return {
          ...prev,
          stock,
          stockMovements,
          invoices: prev.invoices.map((i) =>
            i.id === invoiceId ? { ...i, status: 'void' as const, balance: 0 } : i,
          ),
        };
      });
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
      const res = saveInvoice({
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
        allowOversell: true,
      });
      return res.id;
    },
    [saveInvoice, state.products],
  );

  const receivePayment = useCallback(
    (invoiceId: string, amount?: number, method = 'Manual', memo = '') => {
      commit((prev) => {
        const inv = prev.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.balance <= 0 || inv.status === 'void') return prev;
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

  const saveQuote = useCallback(
    (input: {
      id?: string;
      customerId: string;
      locationId?: string;
      date: string;
      expiryDate: string;
      status: Quote['status'];
      message: string;
      lines: Omit<InvoiceLine, 'id' | 'amount'>[];
    }) => {
      let newId = input.id ?? uid('quo');
      commit((prev) => {
        const existing = input.id ? prev.quotes.find((q) => q.id === input.id) : undefined;
        if (existing?.status === 'converted') return prev;
        const lines: InvoiceLine[] = input.lines.map((l) => ({
          ...l,
          id: uid('ql'),
          amount: Math.round(l.qty * l.rate * 100) / 100,
        }));
        const totals = invoiceTotals(lines);
        const quote: Quote = {
          id: newId,
          number: existing?.number ?? String(prev.nextQuoteNumber),
          customerId: input.customerId,
          locationId: input.locationId,
          date: input.date,
          expiryDate: input.expiryDate,
          status: input.status === 'converted' ? 'sent' : input.status,
          lines,
          message: input.message,
          ...totals,
          createdAt: existing?.createdAt ?? todayISO(),
          invoiceId: existing?.invoiceId,
        };
        return {
          ...prev,
          quotes: existing
            ? prev.quotes.map((q) => (q.id === existing.id ? quote : q))
            : [...(prev.quotes ?? []), quote],
          nextQuoteNumber: existing ? prev.nextQuoteNumber : prev.nextQuoteNumber + 1,
        };
      });
      return newId;
    },
    [commit],
  );

  const convertQuoteToInvoice = useCallback(
    (quoteId: string) => {
      const quote = state.quotes.find((q) => q.id === quoteId);
      if (!quote || quote.status === 'converted') return '';
      const res = saveInvoice({
        customerId: quote.customerId,
        locationId: quote.locationId,
        date: todayISO(),
        dueDate: addDaysISO(todayISO(), 30),
        status: 'sent',
        message: quote.message || 'Converted from estimate.',
        lines: quote.lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          qty: l.qty,
          rate: l.rate,
        })),
        allowOversell: true,
      });
      if (res.ok) {
        commit((prev) => ({
          ...prev,
          quotes: prev.quotes.map((q) =>
            q.id === quoteId
              ? { ...q, status: 'converted' as const, invoiceId: res.id }
              : q,
          ),
          invoices: prev.invoices.map((i) =>
            i.id === res.id ? { ...i, quoteId } : i,
          ),
        }));
      }
      return res.id;
    },
    [commit, saveInvoice, state.quotes],
  );

  const saveSalesReceipt = useCallback(
    (input: {
      id?: string;
      customerId?: string;
      customerName: string;
      locationId: string;
      date: string;
      paymentMethod: string;
      memo: string;
      lines: Omit<InvoiceLine, 'id' | 'amount'>[];
      allowOversell?: boolean;
    }) => {
      let newId = input.id ?? uid('rcpt');
      let result: {
        id: string;
        ok: boolean;
        shortages?: Array<{ productId: string; need: number; have: number }>;
      } = { id: newId, ok: true };

      commit((prev) => {
        const existing = input.id
          ? prev.salesReceipts.find((r) => r.id === input.id)
          : undefined;
        const lines: InvoiceLine[] = input.lines.map((l) => ({
          ...l,
          id: uid('rl'),
          amount: Math.round(l.qty * l.rate * 100) / 100,
        }));
        const totals = invoiceTotals(lines);
        const ids = inventoryIds(prev.products);
        let stock = prev.stock;
        let stockMovements = prev.stockMovements ?? [];

        if (existing) {
          stock = adjustStock(stock, existing.locationId, existing.lines, 1, ids);
        }
        const check = canFulfill(stock, input.locationId, lines, ids);
        if (!check.ok && !input.allowOversell) {
          result = { id: newId, ok: false, shortages: check.shortages };
          return prev;
        }
        stock = adjustStock(stock, input.locationId, lines, -1, ids);
        const number = existing?.number ?? String(prev.nextReceiptNumber);
        stockMovements = [
          ...buildMovements(input.locationId, lines, -1, ids, 'sales_receipt', {
            refType: 'sales_receipt',
            refId: newId,
            memo: `Sales receipt #${number}`,
            date: input.date,
          }),
          ...stockMovements,
        ];

        const receipt: SalesReceipt = {
          id: newId,
          number,
          customerId: input.customerId,
          customerName: input.customerName,
          locationId: input.locationId,
          date: input.date,
          paymentMethod: input.paymentMethod,
          lines,
          memo: input.memo,
          ...totals,
          createdAt: existing?.createdAt ?? todayISO(),
        };

        const deltaCash = totals.total - (existing?.total ?? 0);

        return {
          ...prev,
          stock,
          stockMovements,
          salesReceipts: existing
            ? prev.salesReceipts.map((r) => (r.id === existing.id ? receipt : r))
            : [...(prev.salesReceipts ?? []), receipt],
          nextReceiptNumber: existing ? prev.nextReceiptNumber : prev.nextReceiptNumber + 1,
          accounts: prev.accounts.map((a) =>
            a.id === 'acc_checking' ? { ...a, balance: a.balance + deltaCash } : a,
          ),
          transactions: existing
            ? prev.transactions
            : [
                {
                  id: uid('txn'),
                  accountId: 'acc_checking',
                  date: input.date,
                  description: `Sales receipt #${number} — ${input.customerName}`,
                  amount: totals.total,
                  type: 'sales_receipt' as const,
                  matched: true,
                  categoryAccountId: 'acc_products',
                  payee: input.customerName,
                },
                ...prev.transactions,
              ],
        };
      });
      return result;
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
            a.id === expense.paymentAccountId
              ? { ...a, balance: a.balance - expense.amount }
              : a,
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

  const saveBill = useCallback(
    (input: {
      id?: string;
      vendorId: string;
      date: string;
      dueDate: string;
      memo: string;
      lines: Array<Omit<BillLine, 'id' | 'amount'>>;
    }) => {
      let newId = input.id ?? uid('bill');
      commit((prev) => {
        const existing = input.id ? (prev.bills ?? []).find((b) => b.id === input.id) : undefined;
        if (existing && (existing.status === 'paid' || existing.status === 'void')) return prev;
        const lines: BillLine[] = input.lines
          .filter((l) => l.description && l.qty > 0)
          .map((l, i) => ({
            categoryAccountId: l.categoryAccountId,
            description: l.description,
            qty: l.qty,
            rate: l.rate,
            id: existing?.lines[i]?.id ?? uid('bl'),
            amount: Math.round(l.qty * l.rate * 100) / 100,
          }));
        const totals = billLineTotals(lines);
        const paid = existing ? existing.total - existing.balance : 0;
        const balance = Math.max(0, Math.round((totals.total - paid) * 100) / 100);
        let status: Bill['status'] = 'open';
        if (balance <= 0) status = 'paid';
        else if (paid > 0) status = 'partial';
        else if (input.dueDate < todayISO()) status = 'overdue';
        const bill: Bill = {
          id: newId,
          number: existing?.number ?? String(prev.nextBillNumber ?? 1001),
          vendorId: input.vendorId,
          date: input.date,
          dueDate: input.dueDate,
          status,
          lines,
          memo: input.memo,
          ...totals,
          balance,
          createdAt: existing?.createdAt ?? todayISO(),
        };
        const bills = existing
          ? (prev.bills ?? []).map((b) => (b.id === existing.id ? bill : b))
          : [bill, ...(prev.bills ?? [])];
        return {
          ...prev,
          bills,
          nextBillNumber: existing ? prev.nextBillNumber : (prev.nextBillNumber ?? 1001) + 1,
        };
      });
      return newId;
    },
    [commit],
  );

  const voidBill = useCallback(
    (billId: string) => {
      commit((prev) => ({
        ...prev,
        bills: (prev.bills ?? []).map((b) =>
          b.id === billId && b.status !== 'paid'
            ? { ...b, status: 'void' as const, balance: 0 }
            : b,
        ),
      }));
    },
    [commit],
  );

  const payBills = useCallback(
    (input: {
      paymentAccountId: string;
      date: string;
      method?: string;
      memo?: string;
      allocations: Array<{ billId: string; amount: number }>;
    }) => {
      commit((prev) => {
        const allocs = input.allocations.filter((a) => a.amount > 0);
        if (!allocs.length) return prev;
        let bills = [...(prev.bills ?? [])];
        const newPayments = [...(prev.billPayments ?? [])];
        let totalPaid = 0;
        const payeeNames: string[] = [];

        for (const alloc of allocs) {
          const bill = bills.find((b) => b.id === alloc.billId);
          if (!bill || bill.status === 'void' || bill.balance <= 0) continue;
          const pay = Math.min(alloc.amount, bill.balance);
          if (pay <= 0) continue;
          totalPaid += pay;
          const vendor = prev.vendors.find((v) => v.id === bill.vendorId);
          if (vendor) payeeNames.push(vendor.name);
          const balance = Math.round((bill.balance - pay) * 100) / 100;
          const status: Bill['status'] =
            balance <= 0 ? 'paid' : balance < bill.total ? 'partial' : bill.status;
          bills = bills.map((b) => (b.id === bill.id ? { ...b, balance, status } : b));
          newPayments.unshift({
            id: uid('bpay'),
            billId: bill.id,
            amount: pay,
            date: input.date,
            paymentAccountId: input.paymentAccountId,
            method: input.method ?? 'Check',
            memo: input.memo ?? '',
            createdAt: todayISO(),
          });
        }

        if (totalPaid <= 0) return prev;
        const label =
          payeeNames.length === 1
            ? payeeNames[0]
            : `Bill payment (${allocs.length})`;

        return {
          ...prev,
          bills,
          billPayments: newPayments,
          accounts: prev.accounts.map((a) =>
            a.id === input.paymentAccountId
              ? { ...a, balance: a.balance - totalPaid }
              : a,
          ),
          transactions: [
            {
              id: uid('txn'),
              accountId: input.paymentAccountId,
              date: input.date,
              description: label,
              amount: -totalPaid,
              type: 'bill_payment' as const,
              matched: true,
              categoryAccountId: 'acc_ap',
              payee: label,
            },
            ...prev.transactions,
          ],
        };
      });
    },
    [commit],
  );

  const receivePayments = useCallback(
    (input: {
      customerId: string;
      date: string;
      method?: string;
      memo?: string;
      allocations: Array<{ invoiceId: string; amount: number }>;
    }) => {
      commit((prev) => {
        const allocs = input.allocations.filter((a) => a.amount > 0);
        if (!allocs.length) return prev;
        let invoices = [...prev.invoices];
        const payments = [...(prev.payments ?? [])];
        let total = 0;

        for (const alloc of allocs) {
          const inv = invoices.find((i) => i.id === alloc.invoiceId);
          if (!inv || inv.customerId !== input.customerId || inv.balance <= 0) continue;
          if (inv.status === 'draft' || inv.status === 'void' || inv.status === 'paid') continue;
          const pay = Math.min(alloc.amount, inv.balance);
          if (pay <= 0) continue;
          total += pay;
          const balance = Math.round((inv.balance - pay) * 100) / 100;
          const status = balance <= 0 ? ('paid' as const) : ('partial' as const);
          invoices = invoices.map((i) => (i.id === inv.id ? { ...i, balance, status } : i));
          payments.unshift({
            id: uid('pay'),
            invoiceId: inv.id,
            amount: pay,
            date: input.date,
            method: input.method ?? 'Check',
            memo: input.memo ?? '',
            createdAt: todayISO(),
          });
        }

        if (total <= 0) return prev;
        const customer = prev.customers.find((c) => c.id === input.customerId);

        return {
          ...prev,
          invoices,
          payments,
          accounts: prev.accounts.map((a) =>
            a.id === 'acc_checking' ? { ...a, balance: a.balance + total } : a,
          ),
          transactions: [
            {
              id: uid('txn'),
              accountId: 'acc_checking',
              date: input.date,
              description: `Payment from ${customer?.name ?? 'customer'}`,
              amount: total,
              type: 'payment' as const,
              matched: true,
              categoryAccountId: 'acc_ar',
              payee: customer?.name,
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
      lines: Array<Omit<PoLine, 'id' | 'amount'> & { qtyReceived?: number }>;
    }) => {
      let newId = input.id ?? uid('po');
      commit((prev) => {
        const existing = input.id ? prev.purchaseOrders.find((p) => p.id === input.id) : undefined;
        const lines: PoLine[] = input.lines.map((l, i) => ({
          productId: l.productId,
          description: l.description,
          qty: l.qty,
          rate: l.rate,
          id: existing?.lines[i]?.id ?? uid('pl'),
          qtyReceived: Math.min(l.qty, l.qtyReceived ?? existing?.lines[i]?.qtyReceived ?? 0),
          amount: Math.round(l.qty * l.rate * 100) / 100,
        }));
        const totals = invoiceTotals(lines);
        const number = existing?.number ?? String(prev.nextPoNumber);
        let status = input.status;
        if (status !== 'draft' && status !== 'cancelled') {
          const fully = lines.length > 0 && lines.every((l) => l.qtyReceived >= l.qty);
          const any = lines.some((l) => l.qtyReceived > 0);
          if (fully) status = 'received';
          else if (any) status = 'partial';
        }
        const po: PurchaseOrder = {
          id: newId,
          number,
          vendorId: input.vendorId,
          locationId: input.locationId,
          date: input.date,
          expectedDate: input.expectedDate,
          status,
          memo: input.memo,
          lines,
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
        const ids = inventoryIds(prev.products);
        const stock = adjustStock(prev.stock, po.locationId, deltaLines, 1, ids);
        const movements = buildMovements(po.locationId, deltaLines, 1, ids, 'po_receive', {
          refType: 'purchase_order',
          refId: po.id,
          memo: `Receive PO #${po.number}`,
        });
        return {
          ...prev,
          stock,
          stockMovements: [...movements, ...(prev.stockMovements ?? [])],
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
      syncStatus,
      resetSampleData,
      updateCompany,
      exportBooks,
      importBooks,
      addLocation,
      updateLocation,
      transferStock,
      adjustInventory,
      addCustomer,
      updateCustomer,
      addVendor,
      updateVendor,
      addProduct,
      updateProduct,
      saveInvoice,
      voidInvoice,
      quickInvoice,
      receivePayment,
      markInvoiceEmailed,
      saveQuote,
      convertQuoteToInvoice,
      saveSalesReceipt,
      addExpense,
      payExpense,
      saveBill,
      voidBill,
      payBills,
      receivePayments,
      savePurchaseOrder,
      receivePo,
      matchTransaction,
      excludeTransaction,
    }),
    [
      state,
      syncStatus,
      resetSampleData,
      updateCompany,
      exportBooks,
      importBooks,
      addLocation,
      updateLocation,
      transferStock,
      adjustInventory,
      addCustomer,
      updateCustomer,
      addVendor,
      updateVendor,
      addProduct,
      updateProduct,
      saveInvoice,
      voidInvoice,
      quickInvoice,
      receivePayment,
      markInvoiceEmailed,
      saveQuote,
      convertQuoteToInvoice,
      saveSalesReceipt,
      addExpense,
      payExpense,
      saveBill,
      voidBill,
      payBills,
      receivePayments,
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
