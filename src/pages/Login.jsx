import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { validatePhone } from '../utils/validators';
import { sanitizeInput } from '../utils/security';
import { getClientIp } from '../utils/getClientIp';
import api from '../services/api';
import { extractAuthTokensFromResponse } from '../utils/authTokens';
import { tokenStorage } from '../utils/storage';
import BrandLogo from '../components/BrandLogo';
import '../styles/pages/AuthPremium.css';
import logo from "../../public/assets/img/m5dex-light-logo.png"
import darklogo from "../../public/assets/img/m5dex-dark-logo.png"
import { useTheme } from '../contexts/ThemeContext';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
    const {  isDark } = useTheme();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [deviceInfo] = useState(() => {
    const deviceId = localStorage.getItem('device_id') || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (!localStorage.getItem('device_id')) {
      localStorage.setItem('device_id', deviceId);
    }
    return {
      device_id: deviceId,
      device_type: 'web',
      os_version: navigator.platform,
      app_version: '1.0.0',
      fcm_token: null,
    };
  });
  const from = location.state?.from?.pathname || '/markets/crypto';

  useEffect(() => {
    const savedBiometric = localStorage.getItem('biometric_enabled');
    if (savedBiometric === 'true') {
      setBiometricEnabled(true);
      const savedType = localStorage.getItem('biometric_type') || 'fingerprint';
      setBiometricType(savedType);
    }
  }, []);

  const handleChange = (field, value) => {
    if (field === 'rememberMe') {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
      return;
    }

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

    if (errors.general) {
      setErrors((prev) => ({
        ...prev,
        general: null,
      }));
    }
  };

  const detectInputType = (value) => {
    const trimmed = value.trim();
    if (/^\+?\d+$/.test(trimmed.replace(/\s/g, ''))) {
      return 'phone';
    }
    if (trimmed.includes('@')) {
      return 'email';
    }
    return 'email';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setAttemptsRemaining(null);
    setIsAccountLocked(false);

    const inputType = detectInputType(formData.identifier);
    let identifierError = null;

    if (!formData.identifier.trim()) {
      identifierError = 'Login Id is required';
    } else if (inputType === 'phone') {
      const phoneValidation = validatePhone(formData.identifier.replace(/\s/g, ''));
      if (!phoneValidation.isValid) {
        identifierError = phoneValidation.error;
      }
    }

    if (identifierError) {
      setErrors({ identifier: identifierError });
      return;
    }

    if (!formData.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    if (formData.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters long' });
      return;
    }

    setIsSubmitting(true);

    try {
      const ipAddress = await getClientIp();
      deviceInfo.ip_address = ipAddress

      const response = await api.post('/auth/login', {
        identifier: formData.identifier.trim(),
        password: formData.password,
        device_info: deviceInfo,
        // ip_address: ipAddress,
      });

      const { accessToken, refreshToken, deviceToken } = extractAuthTokensFromResponse(response);
      if (accessToken) {
        login(accessToken, refreshToken, deviceToken || undefined);
      } else {
        if (refreshToken) tokenStorage.setRefreshToken(refreshToken);
        if (deviceToken) tokenStorage.setDeviceToken(deviceToken);
      }

      if (formData.rememberMe) {
        localStorage.setItem('remember_me', 'true');
      }

      if (response.requires_2fa) {
        const enabled =
          response?.['2fa_enabled'] ??
          response?.is2fa ??
          response?.user?.['2fa_enabled'] ??
          false;

        if (enabled) {
          // Ensure TwoFactorVerify has the token/method even after refresh.
          const email =
            response?.user?.email ??
            response?.user?.identifier ??
            response?.email ??
            '';
          const tempToken = response?.temp_token ?? '';
          const deviceTokenFor2fa =
            deviceToken ||
            (response?.device_token ?? response?.devicetoken ?? '');
          const method = response?.['2fa_method'] ?? 'totp';

          if (tempToken) sessionStorage.setItem('temp_token', tempToken);
          if (email) sessionStorage.setItem('login_email', email);
          if (deviceTokenFor2fa) sessionStorage.setItem('device_token', deviceTokenFor2fa);

          navigate('/2fa-verify', {
            replace: true,
            state: {
              email,
              temp_token: tempToken,
              device_token: deviceTokenFor2fa,
              method,
            },
          });
          return;
        }
      }

      navigate(from, { replace: true });
    } catch (error) {
      if (error.response?.status === 429) {
        setErrors({
          general: 'Too many login attempts. Please try again later.',
        });
        setAttemptsRemaining(0);
      } else if (error.response?.status === 401) {
        const errorData = error.response.data;
        setErrors({
          general: errorData.message || 'Invalid email or password',
        });

        if (errorData.attempts_remaining !== undefined) {
          setAttemptsRemaining(errorData.attempts_remaining);

          if (errorData.attempts_remaining === 0) {
            setIsAccountLocked(true);
          }
        }
      } else if (error.response?.status === 423) {
        setIsAccountLocked(true);
        setErrors({
          general: 'Your account has been locked due to multiple failed login attempts. Please check your email to unlock it.',
        });
      } else {
        setErrors({
          general: error.message || 'Login failed. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const ipAddress = await getClientIp();

      const response = await api.post('/auth/biometric-login', {
        device_id: deviceInfo.device_id,
        biometric_type: biometricType,
        ip_address: ipAddress,
      });

      login(response.access_token, response.refresh_token);
      navigate(from, { replace: true });
    } catch (error) {
      setErrors({
        general: 'Biometric authentication failed. Please use password login.',
      });
    }
  };

  return (
    <div className="ark-auth-page ark_bg">
      <div className="premium-bg-effect"></div>
      <div className="ark-auth-container ark-auth-container-centered">
        <div className="ark-auth-form-section ark-auth-form-section-centered">
          <div className="ark-auth-card">
            <div style={{marginBottom:"0"}} className="ark-auth-logo">
              {/* <BrandLogo /> */}
               <img style={{height:"100px"}} src={!isDark?darklogo:logo} alt="" />
            </div>
            <div className="ark-form-header ark-form-header-centered">
              {/* <button
                onClick={() => navigate(-1)}
                className="ark-back-button"
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
              </button> */}

              {/* <div className="ark-status-badge">
                <div className="ark-status-badge-dot"></div>
                <span className="ark-status-badge-text">SIGN IN</span>
              </div> */}
              <h1 className="ark-form-title">Welcome Back</h1>
              <p className="ark-form-subtitle">Login to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="ark-form">
              {errors.general && (
                <div className="ark-error-message">
                  <p>{errors.general}</p>
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <p style={{ marginTop: 'var(--ark-space-xs)', fontSize: 'var(--ark-font-size-xs)' }}>
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                  {isAccountLocked && (
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="ark-form-footer-link"
                      style={{ marginTop: 'var(--ark-space-sm)', display: 'block' }}
                    >
                      Unlock via email
                    </button>
                  )}
                </div>
              )}

              <div className="ark-form-group">
                <label className="ark-form-label" htmlFor="identifier">
                  Login Id
                </label>
                <div className="ark-input-wrapper">
                  <div className="ark-input-icon">
                    {detectInputType(formData.identifier) === 'phone' ? (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    ) : (
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <input
                    id="identifier"
                    type="text"
                    value={formData.identifier}
                    onChange={(e) => handleChange('identifier', e.target.value)}
                    placeholder="Login Id"
                    className={`ark-input ${errors.identifier ? 'ark-input-error' : ''}`}
                  />
                </div>
                {errors.identifier && (
                  <p className="ark-field-error">{errors.identifier}</p>
                )}
              </div>

              <div className="ark-form-group login_password">
                <label className="ark-form-label" htmlFor="password">Password</label>
                <div className="ark-input-wrapper">
                  <div className="ark-input-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Enter password"
                    className={`ark-input ark_login_input ${errors.password ? 'ark-input-error' : ''}`}
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
                {errors.password && (
                  <p className="ark-field-error">{errors.password}</p>
                )}
              </div>

              <div className="ark-form-group" style={{ marginBottom: 'var(--ark-space-lg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <label className="ark-checkbox-wrapper" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={formData.rememberMe}
                      onChange={(e) => handleChange('rememberMe', e.target.checked)}
                      className="ark-checkbox"
                    />
                    <span className="ark-checkbox-label">
                      Remember me
                    </span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="ark-form-footer-link"
                    style={{ fontSize: 'var(--ark-font-size-sm)', textDecoration: 'none' }}
                  >
                    Forgot Password?
                  </Link>
                </div>
              </div>

              {biometricEnabled && (
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  className="ark-btn ark-btn-secondary"
                  style={{ width: '100%' }}
                >
                  {biometricType === 'face' ? (
                    <>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Login with Face ID
                    </>
                  ) : (
                    <>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                      </svg>
                      Login with Fingerprint
                    </>
                  )}
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="ark-btn ark-btn-primary"
                style={{ width: '100%' }}
              >
                {isSubmitting ? (
                  <>
                    <div className="ark-spinner"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Login'
                )}
              </button>

              <div className="ark-divider">
                <div className="ark-divider-line"></div>
                <span className="ark-divider-text">OR</span>
                <div className="ark-divider-line"></div>
              </div>

              <div className="ark-form-footer">
                <p className="ark-form-footer-text">
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="ark-form-footer-link"
                  >
                    Sign Up
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

export default Login;
