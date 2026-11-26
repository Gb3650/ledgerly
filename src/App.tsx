import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Accounts } from './pages/Accounts';
import { Apps } from './pages/Apps';
import { Banking } from './pages/Banking';
import { Bills } from './pages/Bills';
import { CustomerDetail } from './pages/CustomerDetail';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Inventory } from './pages/Inventory';
import { Invoices } from './pages/Invoices';
import { PayBills } from './pages/PayBills';
import { Products } from './pages/Products';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Quotes } from './pages/Quotes';
import { ReceivePayment } from './pages/ReceivePayment';
import { Reports } from './pages/Reports';
import { Sales } from './pages/Sales';
import { SalesReceipts } from './pages/SalesReceipts';
import { Settings } from './pages/Settings';
import { Taxes } from './pages/Taxes';
import { VendorDetail } from './pages/VendorDetail';
import { Vendors } from './pages/Vendors';
import { BooksProvider } from './store/BooksContext';

export default function App() {
  return (
    <BooksProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="banking" element={<Banking />} />
            <Route path="sales" element={<Sales />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="sales-receipts" element={<SalesReceipts />} />
            <Route path="receive-payment" element={<ReceivePayment />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="bills" element={<Bills />} />
            <Route path="pay-bills" element={<PayBills />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="vendors/:id" element={<VendorDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="taxes" element={<Taxes />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="apps" element={<Apps />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </BooksProvider>
  );
}
