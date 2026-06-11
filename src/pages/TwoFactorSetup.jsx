/**
 * Two-Factor Authentication (2FA) Setup Screen
 * Optional security layer setup with multiple methods
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokenStorage } from '../utils/storage';
import { copyToClipboard } from '../utils/clipboard';
import OTPInput from '../components/OTPInput';
import api from '../services/api';

const TwoFactorSetup = () => {
  const navigate = useNavigate();
  const [selectedMethod, setSelectedMethod] = useState(null); // 'totp', 'sms', 'email', null
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [backupCodes, setBackupCodes] = useState(null);
  const [codesSaved, setCodesSaved] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Generate 2FA secret
  const handleGenerateSecret = async (method) => {
    setIsGenerating(true);
    setError(null);
    setSelectedMethod(method);

    try {
      const token = tokenStorage.getToken();
      const response = await api.post('/auth/2fa/generate', {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setSetupData({
        secret: response.secret,
        qr_code: response.qr_code,
        backup_codes: response.backup_codes || []
      });
    } catch (err) {
      setError(err.message || 'Failed to generate 2FA secret. Please try again.');
      setSelectedMethod(null);
    } finally {
      setIsGenerating(false);
    }
  };

  // Verify 2FA setup
  const handleVerifySetup = async (code) => {
    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const token = tokenStorage.getToken();
      const response = await api.post('/auth/2fa/verify-setup', {
        code: code,
        method: selectedMethod
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response['2fa_enabled']) {
        setBackupCodes(response.backup_codes || setupData.backup_codes || []);
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
      setVerificationCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle OTP complete (auto-submit)
  const handleOtpComplete = (value) => {
    setVerificationCode(value);
    if (value.length === 6) {
      handleVerifySetup(value);
    }
  };

  // Format secret key for display
  const formatSecretKey = (secret) => {
    if (!secret) return '';
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  };

  // Copy to clipboard (works on HTTP & HTTPS)
  const handleCopy = async (text) => {
    try {
      await copyToClipboard(text);
      alert('Copied to clipboard!');
    } catch (err) {
      alert('Copy failed. Please select and copy manually.');
    }
  };

  // Download backup codes
  const handleDownloadCodes = () => {
    const content = backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ark-2fa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Skip 2FA setup
  const handleSkip = () => {
    navigate('/dashboard', { replace: true });
  };

  // Continue after saving backup codes
  const handleContinue = () => {
    if (!codesSaved) {
      setError('Please confirm that you have saved your backup codes');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  // If backup codes are shown, show that screen
  if (backupCodes && backupCodes.length > 0) {
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
          padding: 'var(--space-lg)',
          boxShadow: 'var(--shadow-xl)'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-success-light) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-lg)',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-sm)' }}>
              2FA Successfully Enabled
            </h1>
            <p className="text-body-md text-secondary">
              Save these backup codes in a safe place
            </p>
          </div>

          {/* Warning */}
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'rgba(255, 179, 0, 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <p className="text-body-sm text-primary" style={{ fontWeight: 500 }}>
              ⚠️ Store these codes safely. You'll need them if you lose access to your authenticator app.
            </p>
          </div>

          {/* Backup Codes */}
          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-md)'
            }}>
              <h3 className="text-h4 text-primary">Recovery Codes</h3>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  type="button"
                  onClick={handleDownloadCodes}
                  style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--text-body-sm)',
                    fontWeight: 500
                  }}
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(backupCodes.join('\n'))}
                  style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--text-body-sm)',
                    fontWeight: 500
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-body-md)',
              color: 'var(--text-primary)'
            }}>
              {backupCodes.map((code, index) => (
                <div key={index} style={{
                  padding: 'var(--space-sm)',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center'
                }}>
                  {code}
                </div>
              ))}
            </div>
          </div>

          {/* Checkbox */}
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={codesSaved}
                onChange={(e) => setCodesSaved(e.target.checked)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: 'var(--brand-primary)'
                }}
              />
              <span className="text-body-md text-secondary">
                I've saved my recovery codes in a safe place
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: 'var(--space-md)',
              backgroundColor: 'rgba(255, 61, 0, 0.2)',
              border: '1px solid var(--color-danger)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-lg)'
            }}>
              <p className="text-body-sm text-danger">{error}</p>
            </div>
          )}

          {/* Continue Button */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={!codesSaved}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // If authenticator app is selected, show setup screen
  if (selectedMethod === 'totp' && setupData) {
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
          maxWidth: '500px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-2xl)',
          boxShadow: 'var(--shadow-xl)'
        }}>
          {/* Header */}
          <div style={{ marginBottom: 'var(--space-xl)' }}>
            <button
              onClick={() => {
                setSelectedMethod(null);
                setSetupData(null);
                setVerificationCode('');
                setError(null);
              }}
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
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-body-md">Back</span>
            </button>

            <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-sm)', textAlign: 'center' }}>
              Setup Authenticator App
            </h1>
            <p className="text-body-md text-secondary" style={{ textAlign: 'center' }}>
              Scan the QR code with your authenticator app
            </p>
          </div>

          {/* QR Code */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 'var(--space-xl)'
          }}>
            <div style={{
              width: '240px',
              height: '240px',
              backgroundColor: 'white',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-lg)',
              border: '1px solid var(--border-light)'
            }}>
              <img
                src={setupData.qr_code}
                alt="QR Code"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>

            {/* Manual Entry */}
            {!showManualEntry ? (
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                style={{
                  color: 'var(--text-link)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-primary)',
                  fontSize: 'var(--text-body-md)',
                  textDecoration: 'underline'
                }}
              >
                Can't scan? Enter manually
              </button>
            ) : (
              <div style={{
                width: '100%',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                marginTop: 'var(--space-md)'
              }}>
                <p className="text-body-sm text-secondary" style={{ marginBottom: 'var(--space-sm)' }}>
                  Enter this code manually:
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  justifyContent: 'space-between'
                }}>
                  <code style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-body-lg)',
                    color: 'var(--text-primary)',
                    letterSpacing: '2px',
                    flex: 1
                  }}>
                    {formatSecretKey(setupData.secret)}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(setupData.secret)}
                    style={{
                      padding: 'var(--space-sm) var(--space-md)',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-primary)',
                      fontSize: 'var(--text-body-sm)',
                      fontWeight: 500
                    }}
                  >
                    Copy
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualEntry(false)}
                  style={{
                    marginTop: 'var(--space-sm)',
                    color: 'var(--text-link)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                    fontSize: 'var(--text-body-sm)',
                    textDecoration: 'underline'
                  }}
                >
                  Hide manual entry
                </button>
              </div>
            )}
          </div>

          {/* Steps */}
          <div style={{
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg)',
            marginBottom: 'var(--space-xl)'
          }}>
            <h3 className="text-h4 text-primary" style={{ marginBottom: 'var(--space-md)' }}>
              Steps:
            </h3>
            <ol style={{
              listStyle: 'decimal',
              paddingLeft: 'var(--space-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)'
            }}>
              <li className="text-body-md text-secondary">
                Download{' '}
                <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                  Google Authenticator
                </a>
                {' '}or{' '}
                <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)' }}>
                  similar app
                </a>
              </li>
              <li className="text-body-md text-secondary">
                Scan the QR code above with your authenticator app
              </li>
              <li className="text-body-md text-secondary">
                Enter the 6-digit code from your app below
              </li>
            </ol>
          </div>

          {/* Verification Code Input */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="label" style={{ marginBottom: 'var(--space-sm)' }}>
              Enter 6-digit code
            </label>
            <OTPInput
              length={6}
              onComplete={handleOtpComplete}
              value={verificationCode}
              onChange={setVerificationCode}
            />
            {error && (
              <p className="text-body-sm text-danger" style={{ marginTop: 'var(--space-md)' }}>{error}</p>
            )}
          </div>

          {/* Verify Button */}
          <button
            type="button"
            onClick={() => handleVerifySetup(verificationCode)}
            disabled={isVerifying || verificationCode.length !== 6}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {isVerifying ? 'Verifying...' : 'Verify & Enable 2FA'}
          </button>
        </div>
      </div>
    );
  }

  // Main 2FA setup screen
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
        padding: 'var(--space-lg)',
        boxShadow: 'var(--shadow-xl)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-xl)'
        }}>
          <div style={{ flex: 1 }}>
            <h1 className="text-display-md text-primary" style={{ marginBottom: 'var(--space-sm)' }}>
              Secure Your Account
            </h1>
            <p className="text-body-md text-secondary">
              Add an extra layer of security to protect your account
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

        {/* Error */}
        {error && (
          <div style={{
            padding: 'var(--space-md)',
            backgroundColor: 'rgba(255, 61, 0, 0.2)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-lg)'
          }}>
            <p className="text-body-sm text-danger">{error}</p>
          </div>
        )}

        {/* 2FA Options */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)'
        }}>
          {/* Authenticator App */}
          <button
            type="button"
            onClick={() => handleGenerateSecret('totp')}
            disabled={isGenerating}
            style={{
              padding: 'var(--space-md)',
              backgroundColor: selectedMethod === 'totp' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
              border: selectedMethod === 'totp' ? '2px solid var(--brand-primary)' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              position: 'relative',
                                flexWrap: "wrap",
            }}
            onMouseEnter={(e) => {
              if (selectedMethod !== 'totp') {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMethod !== 'totp') {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0, 102, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg style={{ width: '24px', height: '24px', color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)', flexWrap: "wrap", }}>
                <h3 className="text-h4 text-primary">Authenticator App</h3>
                <span style={{
                  padding: '2px var(--space-sm)',
                  backgroundColor: 'var(--color-success)',
                  color: 'white',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-body-xs)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  
                }}>
                  Recommended
                </span>
              </div>
              <p className="text-body-md text-secondary">
                Use Google Authenticator or similar apps
              </p>
            </div>
            {isGenerating && selectedMethod === 'totp' && (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--border-light)',
                borderTopColor: 'var(--brand-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
          </button>

          {/* SMS Authentication */}
          <button
            type="button"
            onClick={() => handleGenerateSecret('sms')}
            disabled={isGenerating}
            style={{
              padding: 'var(--space-md)',
              backgroundColor: selectedMethod === 'sms' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
              border: selectedMethod === 'sms' ? '2px solid var(--brand-primary)' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              flexWrap: "wrap",
            }}
            onMouseEnter={(e) => {
              if (selectedMethod !== 'sms') {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMethod !== 'sms') {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0, 102, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg style={{ width: '24px', height: '24px', color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="text-h4 text-primary" style={{ marginBottom: 'var(--space-xs)' }}>
                SMS Authentication
              </h3>
              <p className="text-body-md text-secondary">
                Receive codes via SMS
              </p>
            </div>
            {isGenerating && selectedMethod === 'sms' && (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--border-light)',
                borderTopColor: 'var(--brand-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
          </button>

          {/* Email Authentication */}
          <button
            type="button"
            onClick={() => handleGenerateSecret('email')}
            disabled={isGenerating}
            style={{
              padding: 'var(--space-md)',
              backgroundColor: selectedMethod === 'email' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
              border: selectedMethod === 'email' ? '2px solid var(--brand-primary)' : '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              flexWrap: "wrap",
            }}
            onMouseEnter={(e) => {
              if (selectedMethod !== 'email') {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedMethod !== 'email') {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border-light)';
              }
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(0, 102, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg style={{ width: '24px', height: '24px', color: 'var(--brand-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="text-h4 text-primary" style={{ marginBottom: 'var(--space-xs)' }}>
                Email Authentication
              </h3>
              <p className="text-body-md text-secondary">
                Receive codes via email
              </p>
            </div>
            {isGenerating && selectedMethod === 'email' && (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--border-light)',
                borderTopColor: 'var(--brand-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
          paddingTop: 'var(--space-lg)',
          borderTop: '1px solid var(--divider)'
        }}>
          <button
            type="button"
            onClick={handleSkip}
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-primary)',
              fontSize: 'var(--text-body-md)',
              textDecoration: 'underline',
              textAlign: 'center'
            }}
          >
            I'll do this later
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;

