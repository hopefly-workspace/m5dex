/**
 * Two-Factor Authentication (2FA) Verification Screen
 * Second authentication factor for login
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { tokenStorage } from '../utils/storage';
import { extractAuthTokensFromResponse } from '../utils/authTokens';
import OTPInput from '../components/OTPInput';
import api from '../services/api';

const TwoFactorVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  // Get user data from location state (passed from login)
  const [userData] = useState(() => {
    return location.state || {
      email: sessionStorage.getItem('login_email') || '',
      temp_token: sessionStorage.getItem('temp_token') || '',
      device_token: sessionStorage.getItem('device_token') || '',
      method: 'totp' // Default to TOTP
    };
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [verificationMethod, setVerificationMethod] = useState(userData.method || 'totp'); // 'totp', 'sms', 'recovery'
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [recoveryCodesRemaining, setRecoveryCodesRemaining] = useState(null);
  const [trustDevice, setTrustDevice] = useState(false);

  // Mask email for display
  const maskedEmail = userData.email
    ? `${userData.email.substring(0, 3)}***@${userData.email.split('@')[1]}`
    : '';

  // Save user data to session storage
  useEffect(() => {
    if (userData.email) {
      sessionStorage.setItem('login_email', userData.email);
    }
    if (userData.temp_token) {
      sessionStorage.setItem('temp_token', userData.temp_token);
    }
    if (userData.device_token) {
      sessionStorage.setItem('device_token', userData.device_token);
    }
  }, [userData]);

  // Handle OTP change
  const handleOtpChange = (value) => {
    setVerificationCode(value);
    setError(null);
  };

  // Handle OTP complete (auto-submit)
  const handleOtpComplete = (value) => {
    setVerificationCode(value);
    if (value.length === 6 && verificationMethod === 'totp') {
      handleVerify(value);
    }
  };

  // Verify 2FA code
  const handleVerify = async (code = verificationCode) => {
    if (verificationMethod === 'recovery') {
      if (!recoveryCode.trim()) {
        setError('Please enter a recovery code');
        return;
      }
    } else {
      if (!code || code.length !== 6) {
        setError('Please enter a valid 6-digit code');
        return;
      }
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await api.post('/auth/2fa/verify', {
        code: verificationMethod === 'recovery' ? recoveryCode.trim() : code,
        method: verificationMethod,
        trust_device: trustDevice
      }, {
        headers: {
          // Backend contract expects these exact header keys:
          // - authorizationtoken: temp_token from login response
          // - devicetoken: device_token from login response
          authorizationtoken: userData.temp_token,
          devicetoken: userData.device_token || '',
          // Some backends additionally require `cdrtoken`.
          // We don't have refresh token during pre-2FA, so compute it using:
          // cdrtoken = deviceToken $ tempToken $ deviceId
          cdrtoken: (() => {
            const deviceToken = userData.device_token || '';
            const tempToken = userData.temp_token || '';
            const deviceId = localStorage.getItem('device_id') || '';
            if (!deviceToken || !tempToken) return '';
            return `${deviceToken}$${tempToken}$${deviceId}`;
          })()
        }
      });

      const { accessToken, refreshToken, deviceToken: deviceFromResponse } =
        extractAuthTokensFromResponse(response);
      const deviceToken =
        deviceFromResponse ||
        sessionStorage.getItem('device_token') ||
        tokenStorage.getDeviceToken() ||
        '';

      if (accessToken) {
        login(accessToken, refreshToken, deviceToken || undefined);
      }
      if (response.trusted_device_token && trustDevice) {
        localStorage.setItem('trusted_device_token', response.trusted_device_token);
      }

      sessionStorage.removeItem('login_email');
      sessionStorage.removeItem('temp_token');
      sessionStorage.removeItem('device_token');

      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid verification code. Please try again.');
        if (verificationMethod === 'recovery') {
          setRecoveryCode('');
        } else {
          setVerificationCode('');
        }
      } else if (err.response?.status === 423) {
        // Account locked
        setError('Your account has been locked. Please contact support.');
        setTimeout(() => {
          navigate('/support', { replace: true });
        }, 3000);
      } else if (err.response?.data?.recovery_codes_remaining !== undefined) {
        setRecoveryCodesRemaining(err.response.data.recovery_codes_remaining);
        setError(err.response.data.message || 'Invalid recovery code. Please try again.');
        setRecoveryCode('');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
        if (verificationMethod === 'recovery') {
          setRecoveryCode('');
        } else {
          setVerificationCode('');
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Switch verification method
  const handleSwitchMethod = (method) => {
    setVerificationMethod(method);
    setVerificationCode('');
    setRecoveryCode('');
    setError(null);
  };

  // Recovery code screen
  if (verificationMethod === 'recovery') {
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
          maxWidth: '480px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-2xl)',
          boxShadow: 'var(--shadow-xl)'
        }}>
          {/* Header */}
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <button
              onClick={() => handleSwitchMethod('totp')}
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

            <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
              Use Recovery Code
            </h1>
            <p className="text-body-md text-secondary" style={{ textAlign: 'center' }}>
              Enter one of your recovery codes
            </p>
          </div>

          {/* Warning */}
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'rgba(255, 179, 0, 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-lg)'
          }}>
            <p className="text-body-sm text-primary" style={{ marginBottom: 'var(--space-xs)' }}>
              ⚠️ Each code can be used only once
            </p>
            {recoveryCodesRemaining !== null && (
              <p className="text-body-sm text-primary" style={{ fontWeight: 500 }}>
                {recoveryCodesRemaining} code{recoveryCodesRemaining !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>

          {/* Recovery Code Input */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="label" htmlFor="recovery-code">
              Recovery Code
            </label>
            <input
              id="recovery-code"
              type="text"
              value={recoveryCode}
              onChange={(e) => {
                setRecoveryCode(e.target.value.toUpperCase());
                setError(null);
              }}
              placeholder="XXXX-XXXX-XXXX"
              className={`input ${error ? 'input-error' : ''}`}
              style={{
                fontFamily: 'var(--font-mono)',
                letterSpacing: '2px',
                textTransform: 'uppercase'
              }}
              maxLength={14}
            />
            {error && (
              <p className="text-body-sm text-danger" style={{ marginTop: 'var(--space-xs)' }}>{error}</p>
            )}
          </div>

          {/* Trust Device Checkbox */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: 'var(--brand-primary)'
                }}
              />
              <span className="text-body-md text-secondary">
                Trust this device for 30 days
              </span>
            </label>
          </div>

          {/* Verify Button */}
          <button
            type="button"
            onClick={() => handleVerify()}
            disabled={isVerifying || !recoveryCode.trim()}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>
    );
  }

  // Main 2FA verification screen
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
        maxWidth: '480px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-lg)',
        boxShadow: 'var(--shadow-xl)',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-xl)' }}>
          <button
            onClick={() => navigate('/login', { replace: true })}
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

          <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-sm)' }}>
            Two-Factor Authentication
          </h1>
          <p className="text-body-md text-secondary">
            Enter code from your authenticator app
          </p>
        </div>

        {/* Authenticator Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 102, 255, 0.1)',
          border: '2px solid var(--brand-primary-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-lg)',
          position: 'relative'
        }}>
          <svg style={{ width: '40px', height: '40px', color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        {/* User Email */}
        {maskedEmail && (
          <p className="text-body-md text-secondary" style={{ marginBottom: 'var(--space-xl)' }}>
            {maskedEmail}
          </p>
        )}

        {/* OTP Input */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <OTPInput
            length={6}
            onComplete={handleOtpComplete}
            value={verificationCode}
            onChange={handleOtpChange}
          />
          {error && (
            <p className="text-body-sm text-danger" style={{ marginTop: 'var(--space-md)' }}>{error}</p>
          )}
        </div>

        {/* Trust Device Checkbox */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-sm)',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              style={{
                width: '20px',
                height: '20px',
                cursor: 'pointer',
                accentColor: 'var(--brand-primary)'
              }}
            />
            <span className="text-body-md text-secondary">
              Trust this device for 30 days
            </span>
          </label>
        </div>

        {/* Alternative Methods */}
        {/* <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-sm)'
        }}>
          {verificationMethod === 'totp' && (
            <>
              <button
                type="button"
                onClick={() => handleSwitchMethod('sms')}
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
                Use SMS code instead
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMethod('recovery')}
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
                Use recovery code
              </button>
            </>
          )}
          {verificationMethod === 'sms' && (
            <button
              type="button"
              onClick={() => handleSwitchMethod('totp')}
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
              Use authenticator app instead
            </button>
          )}
        </div> */}

        {/* Having Trouble Link */}
        {/* <div style={{ marginBottom: 'var(--space-lg)' }}>
          <button
            type="button"
            onClick={() => {
              // Navigate to support or show help
              alert('Please contact support if you are having trouble with 2FA verification.');
            }}
            style={{
              color: 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--text-body-sm)',
              textDecoration: 'underline',
              padding: 'var(--space-sm)'
            }}
          >
            Having trouble?
          </button>
        </div> */}

        {/* Verify Button */}
        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={isVerifying || verificationCode.length !== 6}
          className="btn btn-primary"
          style={{ width: '100%' }}
        >
          {isVerifying ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
};

export default TwoFactorVerify;

