/**
 * Exchange Connection Success Screen
 * Confirm successful exchange connection
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatTimestamp } from '../utils/formatTime';
import api from '../services/api';

const ExchangeConnectionSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Get connection data from location state
  const [connectionData] = useState(() => {
    return location.state || {
      connection_id: 'mock-connection-id',
      exchange: {
        id: 'binance',
        name: 'Binance',
        logo: '🔷'
      },
      account_info: {
        account_id: '1234567890',
        balances_synced: true,
        last_sync: new Date().toISOString()
      }
    };
  });
  const [syncData, setSyncData] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [syncError, setSyncError] = useState(null);

  // Auto-trigger sync on mount
  useEffect(() => {
    const syncExchangeData = async () => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const response = await api.get(`/exchanges/${connectionData.connection_id}/sync`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('ark_auth_token')}`
          }
        });

        setSyncData(response);
        setIsSyncing(false);
      } catch (error) {
        setSyncError(error.message || 'Failed to sync exchange data');
        setIsSyncing(false);
      }
    };

    syncExchangeData();
  }, [connectionData.connection_id]);

  // Calculate total balance
  const calculateTotalBalance = () => {
    if (!syncData?.balances) return '0.00';

    // In real app, convert all balances to USD/equivalent
    // For now, just show count
    return syncData.balances.length > 0
      ? `${syncData.balances.length} assets`
      : '0.00';
  };

  // Mask account ID
  const maskAccountId = (id) => {
    if (!id) return 'N/A';
    const str = String(id);
    if (str.length <= 4) return str;
    return `${str.substring(0, 2)}${'*'.repeat(str.length - 4)}${str.substring(str.length - 2)}`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-md)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-md)',
        boxShadow: 'var(--shadow-xl)',
        textAlign: 'center'
      }}>
        {/* Success Animation */}
        <div
          className="SuccessPulse"
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-success-light) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-xl)',
            position: 'relative',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
          <svg style={{ width: '60px', height: '60px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
          <div style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-success)',
            border: '4px solid var(--bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Success Title */}
        <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-md)' }}>
          Exchange Connected Successfully!
        </h1>

        {/* Exchange Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-md)',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-light)'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            {connectionData.exchange?.logo || '🔷'}
          </div>
          <div>
            <h2 className="text-h2 text-primary">
              {connectionData.exchange?.name || 'Exchange'}
            </h2>
          </div>
        </div>

        {/* Sync Status */}
        {isSyncing && (
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'rgba(0, 184, 212, 0.1)',
            border: '1px solid var(--color-info)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-sm)' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--border-light)',
                borderTopColor: 'var(--color-info)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p className="text-body-md text-primary">
                Syncing exchange data...
              </p>
            </div>
          </div>
        )}

        {/* Sync Error */}
        {syncError && (
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'rgba(255, 61, 0, 0.2)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <p className="text-body-sm text-danger">{syncError}</p>
          </div>
        )}

        {/* Account Summary */}
        {syncData && !isSyncing && (
          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-xl)',
            marginBottom: 'var(--space-xl)',
            textAlign: 'left'
          }}>
            <h3 className="text-h3 text-primary" style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
              Account Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {/* Account ID */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 'var(--space-md)',
                borderBottom: '1px solid var(--divider)'
              }}>
                <span className="text-body-md text-secondary">Account ID</span>
                <span className="text-body-md font-mono text-primary">
                  {maskAccountId(connectionData.account_info?.account_id)}
                </span>
              </div>

              {/* Total Balance */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 'var(--space-md)',
                borderBottom: '1px solid var(--divider)'
              }}>
                <span className="text-body-md text-secondary">Total Balance</span>
                <span className="text-number-md font-mono text-primary">
                  {calculateTotalBalance()}
                </span>
              </div>

              {/* Available Assets */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 'var(--space-md)',
                borderBottom: '1px solid var(--divider)'
              }}>
                <span className="text-body-md text-secondary">Available Assets</span>
                <span className="text-body-md font-mono text-primary">
                  {syncData.balances?.length || 0}
                </span>
              </div>

              {/* Last Synced */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span className="text-body-md text-secondary">Last Synced</span>
                <span className="text-body-sm text-secondary">
                  {formatTimestamp(connectionData.account_info?.last_sync)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* View Dashboard Button */}
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            View Dashboard
          </button>

          {/* Connect Another Exchange Button */}
          <button
            onClick={() => navigate('/exchange-connection', { replace: true })}
            className="btn btn-outline"
            style={{ width: '100%' }}
          >
            Connect Another Exchange
          </button>

          {/* Manage Connection Link */}
          <button
            onClick={() => {
              // Navigate to connection management (to be implemented)
              navigate('/dashboard', { replace: true });
            }}
            style={{
              color: 'var(--text-link)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--text-body-md)',
              fontWeight: 500,
              textDecoration: 'underline',
              padding: 'var(--space-sm)'
            }}
          >
            Manage Connection
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeConnectionSuccess;

