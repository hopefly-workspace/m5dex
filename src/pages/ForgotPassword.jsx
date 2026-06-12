import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { validateEmailInput } from '../utils/validators';
import { sanitizeInput } from '../utils/security';
import '../styles/pages/AuthPremium.css';
import Header from '../components/Header';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSuccess(false);

    // Validate email
    const emailValidation = validateEmailInput(formData.email, true);
    if (!emailValidation.isValid) {
      setErrors({ email: emailValidation.error });
      return;
    }

    setIsSubmitting(true);

    const deviceInfo = await getDeviceInfo();

    try {
      const response = await api.post('/auth/forgot-password', {
        email: formData.email.trim().toLowerCase(),
        device_info: deviceInfo,
      });

      if (response.temp_token) {
        sessionStorage.setItem('password_reset_token', response.temp_token);
      }
      sessionStorage.setItem('password_reset_email', formData.email.trim().toLowerCase());

      setIsSuccess(true);

      setTimeout(() => {
        navigate('/reset-password-otp', {
          state: {
            email: formData.email.trim().toLowerCase(),
            temp_token: response.temp_token
          }
        });
      }, 1500);
    } catch (error) {
      console.error("Forgot Password Error:", error);

      const message =
        error?.response?.data?.message ||
        error?.data?.message ||
        error?.message ||
        "An unexpected error occurred. Please try again later.";

      setErrors({
        email: message,
      });
    }
    finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ark-auth-page">
      <div className="premium-bg-effect"></div>
      {/* <Header /> */}
      <div className="ark-auth-container ark-auth-container-centered">
        <div className="ark-auth-form-section ark-auth-form-section-centered">
          <div className="ark-auth-card">
            <div className="ark-form-header ark-form-header-centered">
              <div className="ark-status-badge">
                <div className="ark-status-badge-dot"></div>
                <span className="ark-status-badge-text">RESET PASSWORD</span>
              </div>
              <h1 className="ark-form-title">Forgot Password?</h1>
              <p className="ark-form-subtitle">
                Enter your registered email and we'll send you a verification code to reset your password
              </p>
            </div>

            <form onSubmit={handleSubmit} className="ark-form">
              {isSuccess && (
                <div className="ark-error-message" style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderColor: 'rgba(34, 197, 94, 0.3)',
                  color: 'var(--ark-success)'
                }}>
                  <p>✓ Reset code sent to your email</p>
                </div>
              )}

              <div className="ark-form-group">
                <label className="ark-form-label" htmlFor="email">
                  Email Address
                </label>
                <div className="ark-input-wrapper">
                  <div className="ark-input-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="your@email.com"
                    className={`ark-input ${errors.email ? 'ark-input-error' : ''}`}
                    disabled={isSubmitting || isSuccess}
                  />
                </div>
                {errors.email && (
                  <p className="ark-field-error">{errors.email}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className="ark-btn ark-btn-primary"
                style={{ width: '100%' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="ark-spinner"></div>
                    <span>Sending...</span>
                  </>
                ) : isSuccess ? (
                  'Code Sent!'
                ) : (
                  'Send Code'
                )}
              </button>

              <div className="ark-form-footer">
                <p className="ark-form-footer-text forget_para">
                  Remember password?{' '}
                  <Link
                    to="/login"
                    className="ark-form-footer-link"
                  >
                    Login
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

