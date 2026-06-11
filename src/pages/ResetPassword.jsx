import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { validatePassword } from '../utils/security';
import { sanitizeInput } from '../utils/security';
import api from '../services/api';
import '../styles/pages/AuthPremium.css';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [resetData] = useState(() => {
    const state = location.state || {};
    return {
      email: state.email || sessionStorage.getItem('password_reset_email') || '',
      reset_token: state.reset_token || sessionStorage.getItem('password_reset_token') || '',
    };
  });
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const passwordRequirements = {
    minLength: 8,
    hasUpperCase: /[A-Z]/.test(formData.newPassword),
    hasLowerCase: /[a-z]/.test(formData.newPassword),
    hasNumber: /\d/.test(formData.newPassword),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword),
  };

  const calculatePasswordStrength = () => {
    if (!formData.newPassword) return 0;

    let strength = 0;
    const requirements = passwordRequirements;

    if (requirements.hasUpperCase) strength += 20;
    if (requirements.hasLowerCase) strength += 20;
    if (requirements.hasNumber) strength += 20;
    if (requirements.hasSpecialChar) strength += 20;
    if (formData.newPassword.length >= requirements.minLength) strength += 20;

    if (formData.newPassword.length >= 12) strength += 10;
    if (formData.newPassword.length >= 16) strength += 10;

    return Math.min(strength, 100);
  };

  const passwordStrength = calculatePasswordStrength();

  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 25) return { label: 'Weak', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
    if (passwordStrength < 50) return { label: 'Fair', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };
    if (passwordStrength < 75) return { label: 'Good', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' };
    if (passwordStrength < 100) return { label: 'Strong', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.1)' };
    return { label: 'Very Strong', color: '#22C55E', bgColor: 'rgba(34, 197, 94, 0.1)' };
  };

  const strengthInfo = getPasswordStrengthLabel();

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

    if (field === 'newPassword' && errors.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: null,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const passwordValidation = validatePassword(formData.newPassword);
    if (!passwordValidation.isValid) {
      setErrors({ newPassword: passwordValidation.error });
      return;
    }

    if (!formData.confirmPassword) {
      setErrors({ confirmPassword: 'Please confirm your password' });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setIsSubmitting(true);

    const deviceInfo = await getDeviceInfo();

    try {
      const response = await api.post('/auth/reset-password', {
        new_password: formData.newPassword,
        device_info: deviceInfo,
      }, {
        headers: {
          authorizationtoken: `${resetData.reset_token}`
        }
      }
      );

      if (response.message) {
        setIsSuccess(true);

        sessionStorage.removeItem('password_reset_email');
        sessionStorage.removeItem('password_reset_token');

        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setErrors({
          general: 'Invalid or expired reset token. Please request a new password reset.',
        });
      } else {
        setErrors({
          general: error.message || 'Failed to reset password. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ark-auth-page ark_bg">
      <div className="premium-bg-effect"></div>
      <div className="ark-auth-container ark-auth-container-centered">
        <div className="ark-auth-form-section ark-auth-form-section-centered">
          <div className="ark-auth-card">
            <div className="ark-form-header">
              <div className="ark-status-badge">
                <div className="ark-status-badge-dot"></div>
                <span className="ark-status-badge-text">NEW PASSWORD</span>
              </div>
              <h1 className="ark-form-title">Create New Password</h1>
              <p className="ark-form-subtitle">
                Choose a strong password to secure your account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="ark-form">
              {isSuccess && (
                <div className="ark-error-message" style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderColor: 'rgba(34, 197, 94, 0.3)',
                  color: 'var(--ark-success)'
                }}>
                  <p>✓ Password reset successful! Redirecting to login...</p>
                </div>
              )}

              {errors.general && (
                <div className="ark-error-message">
                  <p>{errors.general}</p>
                </div>
              )}
              <div className="ark-form-group">
                <label className="ark-form-label" htmlFor="newPassword">
                  New Password
                </label>
                <div className="ark-input-wrapper">
                  <div className="ark-input-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.newPassword}
                    onChange={(e) => handleChange('newPassword', e.target.value)}
                    placeholder="Enter new password"
                    className={`ark-input ark_login_input  ${errors.newPassword ? 'ark-input-error' : ''}`}
                    disabled={isSubmitting || isSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ark-input-toggle"
                  >
                    {showPassword ? (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="ark-field-error">{errors.newPassword}</p>
                )}

                {formData.newPassword && (
                  <div style={{ marginTop: 'var(--ark-space-md)' }}>
                    {/* Password Strength Indicator */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--ark-space-md)'
                    }}>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        backgroundColor: 'var(--ark-bg-tertiary)',
                        borderRadius: 'var(--ark-radius-sm)',
                        overflow: 'hidden',
                        position: 'relative'
                      }}>
                        <div style={{
                          width: `${passwordStrength}%`,
                          height: '100%',
                          backgroundColor: strengthInfo.color,
                          borderRadius: 'var(--ark-radius-sm)',
                          transition: 'width 0.3s ease, background-color 0.3s ease'
                        }}></div>
                      </div>
                      <span style={{
                        fontSize: 'var(--ark-font-size-sm)',
                        color: 'var(--ark-text-primary)',
                        fontWeight: 'var(--ark-weight-medium)',
                        minWidth: '60px',
                        textAlign: 'right'
                      }}>
                        {strengthInfo.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="ark-form-group">
                <label className="ark-form-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="ark-input-wrapper">
                  <div className="ark-input-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    placeholder="Confirm new password"
                    className={`ark-input ark_login_input  ${errors.confirmPassword ? 'ark-input-error' : ''}`}
                    disabled={isSubmitting || isSuccess}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="ark-input-toggle"
                  >
                    {showConfirmPassword ? (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="ark-field-error">{errors.confirmPassword}</p>
                )}
                {formData.confirmPassword && formData.newPassword === formData.confirmPassword && !errors.confirmPassword && (
                  <p style={{
                    fontSize: 'var(--ark-font-size-xs)',
                    color: 'var(--ark-success)',
                    marginTop: 'var(--ark-space-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--ark-space-xs)'
                  }}>
                    ✓ Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isSuccess || formData.newPassword !== formData.confirmPassword}
                className="ark-btn ark-btn-primary"
                style={{ width: '100%', marginTop: 'var(--ark-space-md)' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="ark-spinner"></div>
                    <span>Resetting...</span>
                  </>
                ) : isSuccess ? (
                  'Password Reset!'
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

