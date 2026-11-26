export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';
export type ExpenseStatus = 'unbilled' | 'paid' | 'pending';
export type PoStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'converted' | 'declined';
export type AccountType =
  | 'bank'
  | 'accounts_receivable'
  | 'other_current_asset'
  | 'fixed_asset'
  | 'accounts_payable'
  | 'credit_card'
  | 'other_current_liability'
  | 'equity'
  | 'income'
  | 'cogs'
  | 'expense'
  | 'other_income'
  | 'other_expense';

export type TxnType = 'deposit' | 'expense' | 'transfer' | 'payment' | 'sales_receipt';

export type StockMovementReason =
  | 'po_receive'
  | 'invoice_fulfill'
  | 'invoice_void'
  | 'sales_receipt'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment'
  | 'opening';

export interface Company {
  name: string;
  legalName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  fiscalYearStart: number;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  isActive: boolean;
}

/** Quantity of one product at one physical location. */
export interface StockLevel {
  locationId: string;
  productId: string;
  qty: number;
}

export interface StockTransfer {
  id: string;
  date: string;
  fromLocationId: string;
  toLocationId: string;
  productId: string;
  qty: number;
  memo: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  locationId: string;
  qtyDelta: number;
  reason: StockMovementReason;
  refType?: string;
  refId?: string;
  memo: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  billingAddress: string;
  balance: number;
  createdAt: string;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  balance: number;
  createdAt: string;
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  /** Customer-facing sale price. */
  unitPrice: number;
  /** Unit cost / landed cost (what you pay). */
  cost: number;
  incomeAccountId: string;
  expenseAccountId?: string;
  type: 'service' | 'inventory' | 'non_inventory';
  /** Total across all locations (derived when refreshing). */
  qtyOnHand: number;
  reorderPoint?: number;
  isActive?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  detailType: string;
  number: string;
  balance: number;
  isActive: boolean;
}

export interface InvoiceLine {
  id: string;
  productId?: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  /** Location that fulfills / depletes inventory. */
  locationId?: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  message: string;
  subtotal: number;
  tax: number;
  total: number;
  balance: number;
  createdAt: string;
  emailedAt?: string;
  quoteId?: string;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string;
  locationId?: string;
  date: string;
  expiryDate: string;
  status: QuoteStatus;
  lines: InvoiceLine[];
  message: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  invoiceId?: string;
}

export interface SalesReceipt {
  id: string;
  number: string;
  customerId?: string;
  customerName: string;
  locationId: string;
  date: string;
  paymentMethod: string;
  lines: InvoiceLine[];
  memo: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: string;
  memo: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  payeeId?: string;
  payeeName: string;
  paymentAccountId: string;
  categoryAccountId: string;
  date: string;
  amount: number;
  status: ExpenseStatus;
  memo: string;
  refNumber: string;
  createdAt: string;
}

export interface PoLine {
  id: string;
  productId?: string;
  description: string;
  qty: number;
  qtyReceived: number;
  rate: number;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  vendorId: string;
  /** Location that receives stock. */
  locationId: string;
  date: string;
  expectedDate: string;
  status: PoStatus;
  lines: PoLine[];
  memo: string;
  subtotal: number;
  tax: number;
  total: number;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: TxnType;
  categoryAccountId?: string;
  matched: boolean;
  payee?: string;
}

export interface BooksState {
  company: Company;
  locations: Location[];
  stock: StockLevel[];
  stockTransfers: StockTransfer[];
  stockMovements: StockMovement[];
  customers: Customer[];
  vendors: Vendor[];
  products: Product[];
  accounts: Account[];
  invoices: Invoice[];
  quotes: Quote[];
  salesReceipts: SalesReceipt[];
  payments: Payment[];
  expenses: Expense[];
  purchaseOrders: PurchaseOrder[];
  transactions: BankTransaction[];
  nextInvoiceNumber: number;
  nextPoNumber: number;
  nextQuoteNumber: number;
  nextReceiptNumber: number;
}
