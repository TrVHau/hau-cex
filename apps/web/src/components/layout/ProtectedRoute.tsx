import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authStore } from '../../store/authStore';
import { LoadingPage } from '../ui';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  if (!authStore.isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly) {
    const user = authStore.getUser();
    if (!user || user.role !== 'ADMIN') {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

export { LoadingPage };
