import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { validateEmailInput } from '../utils/validators';
import { validatePassword, sanitizeInput } from '../utils/security';
import CountryCodeSelector from './CountryCodeSelector';
import { getDeviceInfo } from '../utils/clientDeviceInfo';

const SignUp = ({ onSuccess } = {}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const PHONE_MAX_LENGTH_MAP = {
    '+91': 10,
    '+1': 10,
    '+44': 10,
    '+86': 11,
    '+81': 10,
    '+49': 11,
    '+33': 9,
    '+61': 9,
    '+971': 9,
    '+65': 8,
    '+60': 10,
    '+66': 9,
    '+62': 12,
    '+84': 10,
    '+63': 10,
    '+82': 10,
    '+55': 11,
    '+52': 10,
    '+34': 9,
    '+39': 10,
    '+31': 9,
    '+46': 9,
    '+47': 8,
    '+41': 9,
    '+27': 9,
    '+20': 10,
    '+90': 10,
    '+7': 10,
    '+92': 10,
    '+880': 10,
  };

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
    countryCode: '+91',
    referral_code: '',
    termsAccepted: false,
  });

  const phoneMaxLength = PHONE_MAX_LENGTH_MAP[formData.countryCode] ?? 15;

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);

  const passwordRequirements = {
    minLength: 8,
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasLowerCase: /[a-z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };

  const calculatePasswordStrength = () => {
    if (!formData.password) return 0;

    let strength = 0;
    const requirements = passwordRequirements;

    if (requirements.hasUpperCase) strength += 20;
    if (requirements.hasLowerCase) strength += 20;
    if (requirements.hasNumber) strength += 20;
    if (requirements.hasSpecialChar) strength += 20;
    if (formData.password.length >= requirements.minLength) strength += 20;

    if (formData.password.length >= 12) strength += 10;
    if (formData.password.length >= 16) strength += 10;

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

  const allRequirementsMet = () => {
    return (
      formData.password.length >= passwordRequirements.minLength &&
      passwordRequirements.hasUpperCase &&
      passwordRequirements.hasLowerCase &&
      passwordRequirements.hasNumber &&
      passwordRequirements.hasSpecialChar
    );
  };

  const [deviceInfo] = useState(() => {
    return {
      device_id: localStorage.getItem('device_id') || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      device_type: 'web',
      os_version: navigator.platform,
      app_version: '1.0.0',
    };
  });

  useEffect(() => {
    if (!localStorage.getItem('device_id')) {
      localStorage.setItem('device_id', deviceInfo.device_id);
    }
  }, [deviceInfo.device_id]);

  // Auto-fill referral code from URL parameter
  useEffect(() => {
    const referralCode = searchParams.get('ref');
    if (referralCode) {
      setFormData((prev) => ({
        ...prev,
        referral_code: referralCode.trim(),
      }));
    }
  }, [searchParams]);

  // useEffect(() => {
  //   if (touched.email) {
  //     validateField('email', formData.email);
  //     if (formData.email && !errors.email) {
  //       checkEmailAvailability(formData.email);
  //     }
  //   }
  // }, [formData.email, touched.email]);

  // useEffect(() => {
  //   if (touched.password) {
  //     validateField('password', formData.password);
  //   }
  // }, [formData.password, touched.password]);

  // useEffect(() => {
  //   if (touched.phone) {
  //     validateField('phone', formData.phone);
  //   }
  // }, [formData.phone, formData.countryCode, touched.phone]);

  const checkEmailAvailability = async (email) => {
    if (!email || errors.email) return;

    setEmailChecking(true);
    try {
      const response = await api.post('/auth/check-email', { email });
      setEmailAvailable(response.available);
      if (!response.available) {
        setErrors((prev) => ({
          ...prev,
          email: 'Email already registered',
        }));
      }
    } catch (error) {
      console.error('Email check error:', error);
      setEmailAvailable(null);
    } finally {
      setEmailChecking(false);
    }
  };

  const validateField = (fieldName, value) => {
    let error = null;

    switch (fieldName) {
      case 'email':
        const emailValidation = validateEmailInput(value, true);
        if (!emailValidation.isValid) {
          error = emailValidation.error;
        } else {
          setEmailAvailable(null);
        }
        break;

      case 'password':
        const passwordValidation = validatePassword(value);
        if (!passwordValidation.isValid) {
          error = 'Password does not meet requirements';
        }
        break;

      case 'phone':
        // old code
        // const phoneValidation = validatePhone(value, true);
        // if (!phoneValidation.isValid) {
        //   error = phoneValidation.error;
        // }

        // new code - per-country length validation
        if (!value || value.trim().length === 0) {
          error = 'Phone number is required';
        } else {
          const cleaned = value.replace(/\D/g, '');
          if (cleaned.length !== phoneMaxLength) {
            error = `Phone number must be ${phoneMaxLength} digits`;
          }
        }
        break;

      default:
        break;
    }

    setErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));

    return !error;
  };

  const handleChange = (field, value) => {
    // For phone field, we already sanitize in onChange handler
    const sanitizedValue = field === 'phone' ? value : sanitizeInput(value);
    setFormData((prev) => ({
      ...prev,
      [field]: sanitizedValue,
    }));

    if (!touched[field]) {
      setTouched((prev) => ({
        ...prev,
        [field]: true,
      }));
    }

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // const allFields = Object.keys(formData);
    // const newTouched = {};
    // allFields.forEach((field) => {
    //   newTouched[field] = true;
    // });
    // setTouched(newTouched);

    setErrors({});

    const validationErrors = {};
    let isValid = true;

    // if (!validateField('email', formData.email)) {
    //   isValid = false;
    // }

    // if (!validateField('password', formData.password)) {
    //   isValid = false;
    // }

    // if (!validateField('phone', formData.phone)) {
    //   isValid = false;
    // }

    const emailVal = validateEmailInput(formData.email, true);
    if (!emailVal.isValid) {
      validationErrors.email = emailVal.error;
      isValid = false;
    }

    const passwordVal = validatePassword(formData.password);
    if (!passwordVal.isValid) {
      validationErrors.password = 'Password does not meet requirements';
      isValid = false;
    }

    // old code
    // const phoneVal = validatePhone(formData.phone, true);
    // if (!phoneVal.isValid) {
    //   validationErrors.phone = phoneVal.error;
    //   isValid = false;
    // }

    // new code - per-country length validation
    if (!formData.phone || formData.phone.trim().length === 0) {
      validationErrors.phone = 'Phone number is required';
      isValid = false;
    } else {
      const cleanedPhone = formData.phone.replace(/\D/g, '');
      if (cleanedPhone.length !== phoneMaxLength) {
        validationErrors.phone = `Phone number must be ${phoneMaxLength} digits`;
        isValid = false;
      }
    }

    if (!formData.termsAccepted) {
      validationErrors.termsAccepted = 'You must accept the terms and conditions';
      isValid = false;
    }

    setErrors(validationErrors);

    if (!isValid) {
      return;
    }

    if (emailAvailable === false) {
      setErrors((prev) => ({
        ...prev,
        email: 'Email already registered',
      }));
      return;
    }

    setIsSubmitting(true);

    const deviceInfo = await getDeviceInfo();

    try {
      const requestData = {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phoneno: formData.phone,
        country_code: formData.countryCode,
        terms_accepted: formData.termsAccepted,
        privacy_accepted: formData.termsAccepted,
        referral_code: formData.referral_code.trim() || undefined,
        device_info: deviceInfo,
      };

      const response = await api.post('/auth/register', requestData);

      if (response.requires_verification) {
        const verificationData = {
          email: response.email || formData.email,
          user_id: response.user_id,
          temp_token: response.temp_token,
          verification_type: 'email'
        };

        sessionStorage.setItem('temp_token', verificationData.temp_token || '');
        sessionStorage.setItem('verification_email', verificationData.email || '');
        if (verificationData.user_id) {
          sessionStorage.setItem('verification_user_id', verificationData.user_id);
        }

        if (onSuccess) {
          onSuccess({
            type: 'verification_required',
            ...verificationData,
          });
        } else {
          navigate('/verify', {
            state: verificationData,
            replace: false
          });
        }
      } else {
        if (onSuccess) {
          onSuccess({
            type: 'login_success',
            user_id: response.user_id,
          });
        }

        // else {
        //   navigate('/dashboard');
        // }
      }
    } catch (error) {
      console.error('Registration error:', error);

      const errorMessage = error?.message || error?.error || error?.data?.message || 'Registration failed. Please try again.';
      const errorString = errorMessage.toLowerCase();

      // if (errorString.includes('email_exists') || errorString.includes('already registered') || errorString.includes('email already')) {
      //   setErrors((prev) => ({
      //     ...prev,
      //     email: 'Email already registered',
      //   }));
      //   setEmailAvailable(false);
      // } else if (errorString.includes('validation') || errorString.includes('invalid')) {

      if ((errorString.includes('mobile') || errorString.includes('phone')) && errorString.includes('already registered')) {
        setErrors((prev) => ({
          ...prev,
          phone: errorMessage,
        }));
      } else if (errorString.includes('email_exists') || errorString.includes('already registered') || errorString.includes('email already')) {
        setErrors((prev) => ({
          ...prev,
          email: 'Email already registered',
        }));
        setEmailAvailable(false);
      } else if (errorString.includes('validation') || errorString.includes('invalid')) {
        setErrors((prev) => ({
          ...prev,
          general: errorMessage,
        }));
      } else {
        setErrors((prev) => ({
          ...prev,
          general: errorMessage,
        }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="ark-form-header">
        <div className="ark-status-badge">
          <div className="ark-status-badge-dot"></div>
          <span className="ark-status-badge-text">GET STARTED</span>
        </div>
        <h1 className="ark-form-title">Create Your Trade M5dex Account</h1>
        <p className="ark-form-subtitle">
          Join thousands of traders and start your journey with M5dex today
        </p>
      </div>

      <form onSubmit={handleSubmit} className="ark-form">
        {errors.general && (
          <div className="ark-error-message">
            <p>{errors.general}</p>
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
              onBlur={() => validateField('email', formData.email)}
              placeholder="your@email.com"
              className={`ark-input ${errors.email ? 'ark-input-error' : ''}`}
            />
            {emailChecking && (
              <div style={{
                position: 'absolute',
                right: 'var(--ark-space-md)',
                top: '50%',
                transform: 'translateY(-50%)'
              }}>
                <div className="ark-spinner"></div>
              </div>
            )}
            {!emailChecking && emailAvailable === true && (
              <div style={{
                position: 'absolute',
                right: 'var(--ark-space-md)',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--ark-success)'
              }}>
                <svg style={{ width: '20px', height: '20px' }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
          {errors.email && (
            <p className="ark-field-error">{errors.email}</p>
          )}
        </div>

        <div className="ark-form-group">
          <label className="ark-form-label" htmlFor="password">
            Password
          </label>
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
              onBlur={() => validateField('password', formData.password)}
              placeholder="Create password"
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

          {formData.password && (
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
          <label className="ark-form-label" htmlFor="phone">
            Phone Number
          </label>
          <div className="ark-phone-input-wrapper">
            <div className="ark-phone-country-code">
              <CountryCodeSelector
                value={formData.countryCode}
                onChange={(code) => {
                  setFormData(prev => ({ ...prev, countryCode: code, phone: '' }));
                  setErrors(prev => ({ ...prev, phone: null }));
                  setTouched(prev => ({ ...prev, phone: false }));
                }}
                className="country-code-selector"
              />
            </div>
            <div className="ark-phone-number-input">
              <div className="ark-input-wrapper">
                <div className="ark-input-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, phoneMaxLength);
                    handleChange('phone', value);
                  }}
                  onBlur={() => validateField('phone', formData.phone)}
                  placeholder={`Enter ${phoneMaxLength}-digit number`}
                  maxLength={phoneMaxLength}
                  className={`ark-input ${errors.phone ? 'ark-input-error' : ''}`}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}
                />
              </div>
            </div>
          </div>
          {errors.phone && (
            <p className="ark-field-error">{errors.phone}</p>
          )}
        </div>

        <div className="ark-form-group">
          <label className="ark-form-label" htmlFor="referral_code">
            Referral Code <span className="ark-form-label-optional">(Optional)</span>
          </label>
          <div className="ark-input-wrapper">
            <div className="ark-input-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h-1m-6 0h1m6 0v-1m0 0V8m0 0H9m3 9v1m0 0H9m3 0h3m-3 0v-1m0 1a3 3 0 01-3-3V8a3 3 0 013-3h6a3 3 0 013 3v4a3 3 0 01-3 3m-3 4v1m0 0h3m-3 0H9" />
              </svg>
            </div>
            <input
              id="referral_code"
              type="text"
              value={formData.referral_code}
              onChange={(e) => handleChange('referral_code', e.target.value)}
              placeholder="Enter referral code"
              className="ark-input"
            />
          </div>
        </div>

        <div className="ark-form-group">
          <label className="ark-checkbox-wrapper">
            <input
              type="checkbox"
              checked={formData.termsAccepted}
              onChange={(e) => handleChange('termsAccepted', e.target.checked)}
              className="ark-checkbox"
            />
            <span className="ark-checkbox-label">
              I agree to the{' '}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/data-policy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
              </Link>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="ark-field-error">{errors.termsAccepted}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="ark-btn ark-btn-primary"
          style={{ width: '100%' }}
        >
          {isSubmitting ? (
            <>
              <div className="ark-spinner"></div>
              <span>Creating Account...</span>
            </>
          ) : (
            'Create Account'
          )}
        </button>

        <div className="ark-form-footer">
          <p className="ark-form-footer-text signup_footer">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="ark-form-footer-link"
            >
              Login
            </button>
          </p>
        </div>
      </form>
    </>
  );
};

export default SignUp;

