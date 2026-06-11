/**
 * Secure Route Component
 * Protects routes with authentication and security checks
 */

import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { tokenStorage } from '../utils/storage.js';
import { useClickjackingProtection, useFrameDetection } from '../utils/securityHooks.js';
import { useAuth } from '../hooks/useAuth.js';

const SecureRoute = ({ children, requireAuth = true }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Security protections
  useClickjackingProtection();
  useFrameDetection();

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

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default SecureRoute;

