import { Navigate, createBrowserRouter } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { MarketListPage } from './pages/MarketListPage';
import { TradingPage } from './pages/TradingPage';
import { WalletPage } from './pages/WalletPage';
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
        element: <Navigate to="/markets" replace />,
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
