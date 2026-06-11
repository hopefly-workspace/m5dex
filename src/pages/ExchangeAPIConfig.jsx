/**
 * API Key Configuration Screen
 * Secure API key input for exchange connection
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { sanitizeInput } from '../utils/security';

const ExchangeAPIConfig = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    api_key: '',
    api_secret: '',
    api_passphrase: '',
  });
  const [errors, setErrors] = useState({});
  const [isTesting, setIsTesting] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const exchange = location.state?.exchange || {
    id: 'binance',
    name: 'Binance',
    logo: '🔷'
  };

  // Check if exchange requires passphrase
  const requiresPassphrase = ['coinbase', 'kraken', 'okx'].includes(exchange.id);

  const handleChange = (field, value) => {
    const sanitizedValue = sanitizeInput(value);
    setFormData((prev) => ({
      ...prev,
      [field]: sanitizedValue,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const handleTestConnection = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate API Key
    if (!formData.api_key.trim()) {
      setErrors({ api_key: 'API key is required' });
      return;
    }

    // Validate API Secret
    if (!formData.api_secret.trim()) {
      setErrors({ api_secret: 'API secret is required' });
      return;
    }

    // Validate Passphrase if required
    if (requiresPassphrase && !formData.api_passphrase.trim()) {
      setErrors({ api_passphrase: 'API passphrase is required' });
      return;
    }

    setIsTesting(true);

    try {
      // In production, encrypt keys client-side before sending
      // For now, this is a placeholder
      const response = await api.post('/exchanges/connect', {
        exchange: exchange.id,
        api_key: formData.api_key.trim(),
        api_secret: formData.api_secret.trim(),
        api_passphrase: requiresPassphrase ? formData.api_passphrase.trim() : undefined,
        permissions: ['read', 'trade'] // Never request withdrawal
      });

      if (response.connection_id) {
        // Navigate to connection success screen
        navigate('/exchange-connection-success', {
          state: {
            connection_id: response.connection_id,
            exchange: exchange,
            account_info: response.account_info
          }
        });
      }
    } catch (error) {
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        setErrors({
          general: errorData.message || 'Connection failed. Please check your credentials.',
          details: errorData.details
        });
      } else {
        setErrors({
          general: error.message || 'Connection failed. Please try again.',
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: 'var(--space-xl) var(--space-md)'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <button
            onClick={() => navigate('/exchange-connection')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-lg)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-primary)'
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-secondary)'}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-body-md">Back</span>
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-sm)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              {exchange.logo}
            </div>
            <div>
              <h1 className="text-display-md text-primary">
                {exchange.name} Connection
              </h1>
            </div>
          </div>
        </div>

        {/* Instructions Section */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-xl)',
          overflow: 'hidden'
        }}>
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            style={{
              width: '100%',
              padding: 'var(--space-lg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-primary)'
            }}
          >
            <span className="text-h4 text-primary">How to get API keys?</span>
            <svg
              style={{
                width: '16px',
                height: '16px',
                transform: showInstructions ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s'
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showInstructions && (
            <div style={{
              padding: 'var(--space-lg)',
              borderTop: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-tertiary)'
            }}>
              <ol style={{
                listStyle: 'decimal',
                paddingLeft: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-md)',
                marginBottom: 'var(--space-md)'
              }}>
                <li className="text-body-md text-secondary">
                  Log in to your {exchange.name} account
                </li>
                <li className="text-body-md text-secondary">
                  Navigate to API settings or API management
                </li>
                <li className="text-body-md text-secondary">
                  Create a new API key with the following permissions:
                  <ul style={{
                    listStyle: 'disc',
                    paddingLeft: 'var(--space-lg)',
                    marginTop: 'var(--space-sm)'
                  }}>
                    <li className="text-body-sm text-secondary">Read account information</li>
                    <li className="text-body-sm text-secondary">Read balances</li>
                    <li className="text-body-sm text-secondary">Place orders</li>
                    <li className="text-body-sm text-danger">❌ Do NOT enable withdrawal permissions</li>
                  </ul>
                </li>
                <li className="text-body-md text-secondary">
                  Copy your API key and secret (they will only be shown once)
                </li>
                <li className="text-body-md text-secondary">
                  Paste them securely in the form below
                </li>
              </ol>
              <a
                href={`https://${exchange.id}.com/api`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--text-link)',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 'var(--text-body-md)',
                  textDecoration: 'underline'
                }}
              >
                View {exchange.name} API documentation →
              </a>
            </div>
          )}
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-md)',
          boxShadow: 'var(--shadow-xl)'
        }}>
          {/* General Error */}
          {errors.general && (
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'rgba(255, 61, 0, 0.2)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-lg)'
            }}>
              <p className="text-body-sm text-danger">{errors.general}</p>
              {errors.details && (
                <p className="text-body-xs text-secondary" style={{ marginTop: 'var(--space-xs)' }}>
                  {errors.details}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleTestConnection} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* API Key */}
            <div>
              <label className="label" htmlFor="api_key">API Key</label>
              <input
                id="api_key"
                type="text"
                value={formData.api_key}
                onChange={(e) => handleChange('api_key', e.target.value)}
                placeholder="Paste your API key"
                className={`input ${errors.api_key ? 'input-error' : ''}`}
                disabled={isTesting}
              />
              {errors.api_key && (
                <p className="text-body-sm text-danger" style={{ marginTop: 'var(--space-xs)' }}>{errors.api_key}</p>
              )}
            </div>

            {/* API Secret */}
            <div>
              <label className="label" htmlFor="api_secret">API Secret</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="api_secret"
                  type={showApiSecret ? 'text' : 'password'}
                  value={formData.api_secret}
                  onChange={(e) => handleChange('api_secret', e.target.value)}
                  placeholder="Paste your API secret"
                  className={`input ark_login_input ${errors.api_secret ? 'input-error' : ''}`}
                  style={{ paddingRight: 'var(--space-xl)' }}
                  disabled={isTesting}
                />
                <button
                  type="button"
                  onClick={() => setShowApiSecret(!showApiSecret)}
                  style={{
                    position: 'absolute',
                    right: 'var(--space-md)',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-secondary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showApiSecret ? (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.api_secret && (
                <p className="text-body-sm text-danger" style={{ marginTop: 'var(--space-xs)' }}>{errors.api_secret}</p>
              )}
              <p className="text-body-xs text-tertiary" style={{ marginTop: 'var(--space-xs)' }}>
                ⚠️ Never share with anyone
              </p>
            </div>

            {/* API Passphrase (if required) */}
            {requiresPassphrase && (
              <div>
                <label className="label" htmlFor="api_passphrase">API Passphrase</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="api_passphrase"
                    type={showPassphrase ? 'text' : 'password'}
                    value={formData.api_passphrase}
                    onChange={(e) => handleChange('api_passphrase', e.target.value)}
                    placeholder="Enter passphrase"
                    className={`input ${errors.api_passphrase ? 'input-error' : ''}`}
                    style={{ paddingRight: 'var(--space-xl)' }}
                    disabled={isTesting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    style={{
                      position: 'absolute',
                      right: 'var(--space-md)',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showPassphrase ? (
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.api_passphrase && (
                  <p className="text-body-sm text-danger" style={{ marginTop: 'var(--space-xs)' }}>{errors.api_passphrase}</p>
                )}
              </div>
            )}

            {/* Permissions Required */}
            <div style={{
              padding: 'var(--space-lg)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <p className="text-body-sm text-secondary" style={{ marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                Permissions Required:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {[
                  { required: true, text: 'Read account information' },
                  { required: true, text: 'Read balances' },
                  { required: true, text: 'Place orders' },
                  { required: false, text: 'Withdraw funds' },
                ].map((perm, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    {perm.required ? (
                      <svg style={{ width: '20px', height: '20px', color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg style={{ width: '20px', height: '20px', color: 'var(--color-danger)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="text-body-sm" style={{ color: perm.required ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                      {perm.text} {perm.required ? '(Required)' : '(NOT required)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Notes */}
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'rgba(0, 102, 255, 0.1)',
              border: '1px solid var(--brand-primary-glow)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                <svg style={{ width: '20px', height: '20px', color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-body-sm text-primary" style={{ fontWeight: 500 }}>
                  Security Notes
                </span>
              </div>
              <ul style={{
                listStyle: 'disc',
                paddingLeft: 'var(--space-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-xs)',
                marginTop: 'var(--space-sm)'
              }}>
                <li className="text-body-sm text-secondary">
                  Your keys are encrypted and stored securely
                </li>
                <li className="text-body-sm text-secondary">
                  We never request withdrawal permissions
                </li>
                <li className="text-body-sm text-secondary">
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                    padding: '2px var(--space-xs)',
                    backgroundColor: 'var(--brand-primary)',
                    color: 'white',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-body-xs)',
                    fontWeight: 600
                  }}>
                    AES-256 Encrypted
                  </span>
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="text_action_btn" style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)', flexWrap: "wrap", }}>
              <button
                type="button"
                onClick={() => navigate('/exchange-connection')}
                className="btn btn-outline"
                style={{ flex: 1 }}
                disabled={isTesting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isTesting}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {isTesting ? 'Testing Connection...' : 'Test Connection'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExchangeAPIConfig;

