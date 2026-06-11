/**
 * Exchange Connection Setup Screen
 * Connect external exchange accounts
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Supported exchanges
const popularExchanges = [
  { id: 'binance', name: 'Binance', logo: '🔷', supported: true },
  { id: 'coinbase', name: 'Coinbase Pro', logo: '🔵', supported: true },
  { id: 'kraken', name: 'Kraken', logo: '🟠', supported: true },
  { id: 'bitfinex', name: 'Bitfinex', logo: '🟣', supported: true },
  { id: 'kucoin', name: 'KuCoin', logo: '🔴', supported: true },
];

const allExchanges = [
  ...popularExchanges,
  { id: 'okx', name: 'OKX', logo: '⚪', supported: true },
  { id: 'bybit', name: 'Bybit', logo: '🟦', supported: true },
  { id: 'gate', name: 'Gate.io', logo: '🟧', supported: true },
  { id: 'huobi', name: 'Huobi', logo: '🟨', supported: true },
  { id: 'bitmex', name: 'BitMEX', logo: '🟩', supported: true },
  { id: 'deribit', name: 'Deribit', logo: '🟪', supported: true },
  { id: 'ftx', name: 'FTX', logo: '⬜', supported: false },
  { id: 'gemini', name: 'Gemini', logo: '💎', supported: true },
  { id: 'bitstamp', name: 'Bitstamp', logo: '🟫', supported: true },
  { id: 'crypto_com', name: 'Crypto.com', logo: '🔶', supported: true },
  { id: 'binance_us', name: 'Binance US', logo: '🔷', supported: true },
  { id: 'bitget', name: 'Bitget', logo: '🟥', supported: true },
  { id: 'mexc', name: 'MEXC', logo: '🟨', supported: true },
  { id: 'phemex', name: 'Phemex', logo: '🟦', supported: true },
];

const ExchangeConnection = () => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const displayedExchanges = showAll ? allExchanges : popularExchanges;

  const handleConnect = (exchange) => {
    navigate('/exchange-api-config', {
      state: { exchange }
    });
  };

  const handleSkip = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--space-md)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-2xl)'
        }}>
          <div style={{ flex: 1 }}>
            <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-sm)' }}>
              Connect Exchange
            </h1>
            <p className="text-body-md text-secondary">
              Link your trading accounts to start trading
            </p>
          </div>
          <button
            onClick={handleSkip}
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--text-body-md)',
              padding: 'var(--space-sm)',
              textDecoration: 'underline'
            }}
          >
            Skip
          </button>
        </div>

        {/* Exchange Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--space-lg)',
          marginBottom: 'var(--space-xl)'

        }}
          className="exchange_grid"
        >
          {displayedExchanges.map((exchange) => (
            <div
              key={exchange.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-md)',
                transition: 'all 0.2s',
                position: 'relative',
                opacity: exchange.supported ? 1 : 0.6
              }}
              onMouseEnter={(e) => {
                if (exchange.supported) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }
              }}
              onMouseLeave={(e) => {
                if (exchange.supported) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {/* Exchange Logo */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                marginBottom: 'var(--space-xs)'
              }}>
                {exchange.logo}
              </div>

              {/* Exchange Name */}
              <h3 className="text-h4 text-primary" style={{ textAlign: 'center' }}>
                {exchange.name}
              </h3>

              {/* Connection Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-xs)',
                marginBottom: 'var(--space-sm)'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: exchange.supported ? 'var(--color-success)' : 'var(--text-tertiary)'
                }}></div>
                <span className="text-body-sm text-secondary">
                  {exchange.supported ? 'Supported' : 'Coming Soon'}
                </span>
              </div>

              {/* Connect Button */}
              <button
                onClick={() => handleConnect(exchange)}
                disabled={!exchange.supported}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  opacity: exchange.supported ? 1 : 0.5,
                  cursor: exchange.supported ? 'pointer' : 'not-allowed'
                }}
              >
                Connect
              </button>
            </div>
          ))}
        </div>

        {/* Show More/Less Button */}
        {!showAll && (
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <button
              onClick={() => setShowAll(true)}
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
              Show all {allExchanges.length}+ exchanges
            </button>
          </div>
        )}

        {showAll && (
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <button
              onClick={() => setShowAll(false)}
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
              Show less
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{
          paddingTop: 'var(--space-xl)',
          borderTop: '1px solid var(--divider)',
          textAlign: 'center'
        }}>
          <button
            onClick={handleSkip}
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--text-body-md)',
              textDecoration: 'underline',
              padding: 'var(--space-sm)'
            }}
          >
            Add More Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExchangeConnection;

