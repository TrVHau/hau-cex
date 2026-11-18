import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketListPage } from './pages/MarketListPage';
import { TradingPage } from './pages/TradingPage';
import { WalletPage } from './pages/WalletPage';
import { OrdersPage } from './pages/OrdersPage';
import { TradesPage } from './pages/TradesPage';
import { LedgerPage } from './pages/LedgerPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RootLayout } from './components/layout/RootLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'markets',
        element: <MarketListPage />,
      },
      {
        path: 'trade/:symbol',
        element: (
          <ProtectedRoute>
            <TradingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'wallet',
        element: (
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'trades',
        element: (
          <ProtectedRoute>
            <TradesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'ledger',
        element: (
          <ProtectedRoute>
            <LedgerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
