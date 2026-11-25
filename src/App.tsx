import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Accounts } from './pages/Accounts';
import { Banking } from './pages/Banking';
import { Customers } from './pages/Customers';
import { Dashboard } from './pages/Dashboard';
import { Expenses } from './pages/Expenses';
import { Invoices } from './pages/Invoices';
import { Products } from './pages/Products';
import { Reports } from './pages/Reports';
import { Sales } from './pages/Sales';
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
            <Route path="customers" element={<Customers />} />
            <Route path="products" element={<Products />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="reports" element={<Reports />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </BooksProvider>
  );
}
