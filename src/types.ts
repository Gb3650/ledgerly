export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type ExpenseStatus = 'unbilled' | 'paid' | 'pending';
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

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  billingAddress: string;
  balance: number;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  balance: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  unitPrice: number;
  incomeAccountId: string;
  type: 'service' | 'inventory' | 'non_inventory';
  qtyOnHand?: number;
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
  customers: Customer[];
  vendors: Vendor[];
  products: Product[];
  accounts: Account[];
  invoices: Invoice[];
  expenses: Expense[];
  transactions: BankTransaction[];
  nextInvoiceNumber: number;
}
