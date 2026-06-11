import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { tokenStorage } from '../utils/storage';
import OTPInput from '../components/OTPInput';
import Header from '../components/Header';
import { formatTimer } from '../utils/formatTime';
import '../styles/pages/AuthPremium.css';

const Verification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationData] = useState(() => {
    const state = location.state || {};
    return {
      email: state.email || sessionStorage.getItem('verification_email') || '',
      phone: state.phone || sessionStorage.getItem('verification_phone') || '',
      user_id: state.user_id || sessionStorage.getItem('verification_user_id') || '',
      temp_token: state.temp_token || sessionStorage.getItem('temp_token') || '',
      verification_type: state.verification_type || 'email'
    };
  });
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [verificationType, setVerificationType] = useState(verificationData.verification_type);

  useEffect(() => {
    if (!verificationData.email && !verificationData.phone) {
      console.warn('No verification data found, redirecting to signup');
      navigate('/signup', { replace: true });
      return;
    }
    if (!verificationData.temp_token) {
      console.warn('No verification token found, redirecting to signup');
      navigate('/signup', { replace: true });
    }
  }, [verificationData.email, verificationData.phone, verificationData.temp_token, navigate]);

  // Timer countdown
  useEffect(() => {
    if (timer > 0 && !canResend) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [timer, canResend]);

  // Save verification data to session storage
  useEffect(() => {
    if (verificationData.email) {
      sessionStorage.setItem('verification_email', verificationData.email);
    }
    if (verificationData.phone) {
      sessionStorage.setItem('verification_phone', verificationData.phone);
    }
    if (verificationData.user_id) {
      sessionStorage.setItem('verification_user_id', verificationData.user_id);
    }
    if (verificationData.temp_token) {
      sessionStorage.setItem('temp_token', verificationData.temp_token);
    }
  }, []);

  // Mask email/phone
  const maskEmail = (email) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
  };

  const maskPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 4) return phone;
    return `+${cleaned.slice(0, 2)} ${'*'.repeat(cleaned.length - 4)}${cleaned.slice(-2)}`;
  };

  // Handle OTP change
  const handleOtpChange = (value) => {
    setOtp(value);
    setError(null);
  };

  // Handle OTP complete (auto-submit)
  const handleOtpComplete = (value) => {
    if (value.length === 6) {
      handleVerify(value);
    }
  };

  // Verify OTP
  const handleVerify = async (otpValue = otp) => {
    if (otpValue.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    if (!verificationData.temp_token) {
      setError('Verification token is missing. Please try registering again.');
      setIsVerifying(false);
      return;
    }

    try {
      const response = await api.post('/auth/verify-otp', {
        otp: otpValue,
        verification_type: verificationType,
      }, {
        headers: {
          authorizationtoken: `${verificationData.temp_token}`
        }
      });

      if (response.verified || response.success || response.status === 'success') {
        // Do NOT set tokens if you want to force the user to login manually
        // if (response.access_token) {
        //   tokenStorage.setToken(response.access_token);
        // }
        // if (response.refresh_token) {
        //   tokenStorage.setRefreshToken(response.refresh_token);
        // }
        // if (response.token) {
        //   tokenStorage.setToken(response.token);
        // }

        sessionStorage.removeItem('verification_email');
        sessionStorage.removeItem('verification_phone');
        sessionStorage.removeItem('verification_user_id');
        sessionStorage.removeItem('temp_token');

        navigate('/login', { replace: true });
        // navigate('/dashboard', { replace: true });
      } else {
        setError(response.message || 'Verification failed. Please try again.');
        setOtp('');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Invalid verification code. Please try again.');
      setOtp('');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    setError(null);
    setOtp('');

    if (!verificationData.temp_token) {
      setError('Verification token is missing. Please try registering again.');
      setIsResending(false);
      return;
    }

    try {
      await api.post('/auth/resend-otp', {
        verification_type: verificationType,
        user_id: verificationData.user_id
      }, {
        headers: {
          authorizationtoken: verificationData.temp_token
        }
      });

      // Reset timer
      setTimer(60);
      setCanResend(false);
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Switch verification method
  const handleSwitchMethod = () => {
    const newType = verificationType === 'email' ? 'phone' : 'email';
    setVerificationType(newType);
    setOtp('');
    setError(null);
    setTimer(60);
    setCanResend(false);
  };

  const displayValue = verificationType === 'email'
    ? maskEmail(verificationData.email)
    : maskPhone(verificationData.phone);

  if (!verificationData.email && !verificationData.phone) {
    return null;
  }

  return (
    <div className="ark-auth-page ark_bg">
      <div className="premium-bg-effect"></div>
      <div className="ark-auth-container ark-auth-container-centered">
        <div className="ark-auth-form-section ark-auth-form-section-centered">
          <div className="ark-auth-card">
            <div className="ark-form-header">
              <div className="ark-status-badge">
                <div className="ark-status-badge-dot"></div>
                <span className="ark-status-badge-text">VERIFY ACCOUNT</span>
              </div>
              <h1 className="ark-form-title">Verify Your Account</h1>
              <p className="ark-form-subtitle">
                Enter the verification code sent to your {verificationType === 'email' ? 'email' : 'phone'} to complete your M5dex account setup
              </p>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--ark-space-xl)' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                border: '2px solid rgba(37, 99, 235, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--ark-space-lg)',
                position: 'relative'
              }}>
                {verificationType === 'email' ? (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '40px', height: '40px', color: 'var(--ark-primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '40px', height: '40px', color: 'var(--ark-primary)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                )}
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--ark-primary)',
                  border: '3px solid var(--ark-bg-card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg fill="currentColor" viewBox="0 0 20 20" style={{ width: '10px', height: '10px', color: 'white' }}>
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              <p style={{
                marginBottom: 'var(--ark-space-sm)',
                color: 'var(--ark-text-secondary)',
                fontSize: 'var(--ark-font-size-sm)'
              }}>
                We've sent verification code to
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--ark-space-sm)',
                marginBottom: 'var(--ark-space-md)',
                flexWrap: 'wrap'
              }}>
                <p style={{
                  fontFamily: 'var(--ark-font-family)',
                  color: 'var(--ark-text-primary)',
                  fontSize: 'var(--ark-font-size-base)',
                  fontWeight: 'var(--ark-weight-medium)'
                }}>
                  {displayValue}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  style={{
                    color: 'var(--ark-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--ark-font-size-sm)',
                    textDecoration: 'underline',
                    padding: 0,
                    minHeight: '44px'
                  }}
                >
                  Change
                </button>
              </div>
            </div>

            <form className="ark-form" onSubmit={(e) => { e.preventDefault(); handleVerify(); }}>
              {error && (
                <div className="ark-error-message">
                  <p>{error}</p>
                </div>
              )}

              <div className="ark-form-group">
                <label className="ark-form-label" style={{ textAlign: 'center', width: '100%' }}>
                  Verification Code
                </label>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--ark-space-md)' }}>
                  <OTPInput
                    value={otp}
                    onChange={handleOtpChange}
                    onComplete={handleOtpComplete}
                    error={!!error}
                    disabled={isVerifying}
                  />
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: 'var(--ark-space-lg)' }}>
                {!canResend ? (
                  <p style={{
                    color: 'var(--ark-text-tertiary)',
                    fontSize: 'var(--ark-font-size-sm)'
                  }}>
                    Resend code in <span style={{
                      fontFamily: 'monospace',
                      color: 'var(--ark-text-primary)',
                      fontWeight: 'var(--ark-weight-medium)'
                    }}>{formatTimer(timer)}</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    style={{
                      color: 'var(--ark-primary)',
                      background: 'none',
                      border: 'none',
                      cursor: isResending ? 'not-allowed' : 'pointer',
                      fontSize: 'var(--ark-font-size-sm)',
                      textDecoration: 'underline',
                      padding: 'var(--ark-space-xs) var(--ark-space-sm)',
                      minHeight: '44px',
                      opacity: isResending ? 0.5 : 1
                    }}
                  >
                    {isResending ? 'Sending...' : "Didn't receive code? Resend"}
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={otp.length !== 6 || isVerifying}
                className="ark-btn ark-btn-primary"
                style={{ width: '100%' }}
              >
                {isVerifying ? (
                  <>
                    <div className="ark-spinner"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  'Verify'
                )}
              </button>
              {/* <div className="ark-form-footer">
                <button
                  type="button"
                  onClick={handleSwitchMethod}
                  style={{
                    color: 'var(--ark-text-secondary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--ark-font-size-sm)',
                    textDecoration: 'underline',
                    padding: 'var(--ark-space-xs) var(--ark-space-sm)',
                    minHeight: '44px',
                    width: '100%'
                  }}
                >
                  Try {verificationType === 'email' ? 'phone' : 'email'} verification instead
                </button>
              </div> */}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verification;

