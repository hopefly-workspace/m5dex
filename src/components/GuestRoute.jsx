/**
 * Guest Route Component
 * Prevents authenticated users from accessing authentication-related routes
 * Redirects authenticated users to dashboard
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const GuestRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid var(--border-light)',
            borderTopColor: 'var(--brand-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p className="text-body-md text-secondary" style={{ marginTop: 'var(--space-md)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not authenticated, allow access to auth routes
  return children;
};

export default GuestRoute;
