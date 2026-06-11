import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { formatTimer } from '../utils/formatTime';
import api from '../services/api';
import OTPInput from '../components/OTPInput';
import '../styles/pages/AuthPremium.css';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const ResetPasswordOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();

  const [resetData] = useState(() => {
    const state = location.state || {};
    return {
      email: state.email || sessionStorage.getItem('password_reset_email') || '',
      temp_token: state.temp_token || sessionStorage.getItem('password_reset_token') || '',
    };
  });

  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(600);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  const maskedEmail = resetData.email
    ? `${resetData.email.substring(0, 3)}***@${resetData.email.split('@')[1]}`
    : '';

  useEffect(() => {
    if (resetData.email) {
      sessionStorage.setItem('password_reset_email', resetData.email);
    }
    if (resetData.temp_token) {
      sessionStorage.setItem('password_reset_token', resetData.temp_token);
    }
  }, [resetData]);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (value) => {
    setOtp(value);
    setError(null);
  };

  const handleOtpComplete = (value) => {
    setOtp(value);
    if (value.length === 6) {
      handleVerify(value);
    }
  };

  const handleVerify = async (otpValue = otp) => {
    if (!otpValue || otpValue.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    const deviceInfo = await getDeviceInfo();

    try {
      const response = await api.post('/auth/verify-reset-code', {
        email: resetData.email,
        code: otpValue,
        device_info: deviceInfo,
      }, {
        headers: {
          authorizationtoken: `${resetData.temp_token}`
        }
      });

      if (response.verified && response.reset_token) {
        sessionStorage.setItem('password_reset_token', response.reset_token);

        navigate('/reset-password', {
          state: {
            email: resetData.email,
            reset_token: response.reset_token
          }
        });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid or expired code. Please try again.');
      } else if (err.response?.status === 410) {
        setError('Code has expired. Please request a new one.');
        setCanResend(true);
        setTimer(0);
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
      setOtp('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError(null);
    setSuccessMessage(null);
    setOtp('');
    setTimer(600);
    setCanResend(false);

    const deviceInfo = await getDeviceInfo();

    try {
      const response = await api.post('/auth/forgot-password', {
        email: resetData.email,
        device_info: deviceInfo,
      });

      if (response.temp_token) {
        sessionStorage.setItem('password_reset_token', response.temp_token);
      }

      const successMsg = `Verification code has been resent to ${maskedEmail || resetData.email}`;
      setSuccessMessage(successMsg);
      showSuccess(successMsg, 5000);

      setTimer(600);
      setCanResend(false);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);

    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to resend code. Please try again.';
      setError(errorMsg);
      showError(errorMsg, 4000);
      console.error(err);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="ark-auth-page ark_bg">
      <div className="premium-bg-effect"></div>
      {/* <Header /> */}
      <div className="ark-auth-container ark-auth-container-centered">
        {/* Centered OTP Verification Form */}
        <div className="ark-auth-form-section ark-auth-form-section-centered">
          <div className="ark-auth-card">
            <div className="ark-form-header">
              <div className="ark-status-badge">
                <div className="ark-status-badge-dot"></div>
                <span className="ark-status-badge-text">VERIFY CODE</span>
              </div>
              <h1 className="ark-form-title">Verify Email</h1>
              <p className="ark-form-subtitle">
                Enter the 6-digit code sent to your email address
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="ark-form">
              {/* Success Message */}
              {successMessage && (
                <div className="ark-success-message" style={{
                  padding: 'var(--ark-space-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--ark-radius-md)',
                  marginBottom: 'var(--ark-space-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--ark-space-sm)',
                  animation: 'fadeIn 0.3s ease-out'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#10b981', flexShrink: 0 }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <p style={{
                    margin: 0,
                    fontSize: 'var(--ark-font-size-sm)',
                    color: '#10b981',
                    fontWeight: 'var(--ark-weight-medium)',
                    lineHeight: 1.5
                  }}>
                    {successMessage}
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="ark-error-message">
                  <p>{error}</p>
                </div>
              )}

              {/* Email Display */}
              {maskedEmail && (
                <div className="ark-form-group" style={{ marginBottom: 'var(--ark-space-lg)' }}>
                  <div style={{
                    padding: 'var(--ark-space-md)',
                    backgroundColor: 'var(--ark-bg-tertiary)',
                    border: '1px solid var(--ark-border)',
                    borderRadius: 'var(--ark-radius-lg)',
                    textAlign: 'center'
                  }}>
                    <p style={{
                      fontSize: 'var(--ark-font-size-sm)',
                      color: 'var(--ark-text-secondary)',
                      margin: 0,
                      marginBottom: 'var(--ark-space-xs)'
                    }}>
                      Code sent to
                    </p>
                    <p style={{
                      fontSize: 'var(--ark-font-size-base)',
                      color: 'var(--ark-text-primary)',
                      margin: 0,
                      fontFamily: 'monospace',
                      fontWeight: 'var(--ark-weight-medium)'
                    }}>
                      {maskedEmail}
                    </p>
                  </div>
                </div>
              )}

              {/* OTP Input */}
              <div className="ark-form-group" style={{ marginBottom: 'var(--ark-space-xs)' }}>
                <OTPInput
                  length={6}
                  onComplete={handleOtpComplete}
                  value={otp}
                  onChange={handleOtpChange}
                />
              </div>

              {/* Timer and Resend */}
              <div className="ark-form-group" style={{ marginBottom: 'var(--ark-space-lg)', textAlign: 'center' }}>
                {timer > 0 ? (
                  <p className="ark-form-footer-text" style={{ margin: 0 }}>
                    Code expires in{' '}
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 'var(--ark-weight-semibold)',
                      color: 'var(--ark-text-primary)'
                    }}>
                      {formatTimer(timer)}
                    </span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="ark-form-footer-link"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: isResending ? 'not-allowed' : 'pointer',
                      opacity: isResending ? 0.6 : 1,
                      padding: 0,
                      margin: 0
                    }}
                  >
                    {isResending ? (
                      <>
                        <div className="ark-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', display: 'inline-block', marginRight: 'var(--ark-space-xs)' }}></div>
                        Sending...
                      </>
                    ) : (
                      "Didn't receive code? Resend"
                    )}
                  </button>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isVerifying || otp.length !== 6}
                className="ark-btn ark-btn-primary"
                style={{ width: '100%' }}
              >
                {isVerifying ? (
                  <>
                    <div className="ark-spinner"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  'Verify Code'
                )}
              </button>

              <div className="ark-form-footer">
                <p className="ark-form-footer-text forget_para">
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="ark-form-footer-link "
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0 }}
                  >
                    Back to Forgot Password
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordOTP;

