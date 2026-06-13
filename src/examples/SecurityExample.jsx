/**
 * Security Implementation Examples
 * This file demonstrates how to use all security features
 */

import { useState } from 'react';
import api from '../services/api';
import { tokenStorage } from '../utils/storage';
import { validateEmailInput, validateText, validateForm } from '../utils/validators';
import { sanitizeInput, validatePassword } from '../utils/security';
import SecureRoute from '../components/SecureRoute';
import { useXSSProtection, useBasicProtection } from '../utils/securityHooks';

/**
 * Example: Secure Login Form
 */
export const SecureLoginExample = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // XSS Protection
  const sanitizedEmail = useXSSProtection(formData.email);

  // Basic protection (optional)
  useBasicProtection(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    const emailValidation = validateEmailInput(formData.email, true);
    const passwordValidation = validateText(formData.password, {
      required: true,
      minLength: 8,
    });

    if (!emailValidation.isValid) {
      setErrors({ email: emailValidation.error });
      return;
    }

    if (!passwordValidation.isValid) {
      setErrors({ password: passwordValidation.error });
      return;
    }

    setLoading(true);

    try {
      // Make secure API call
      const response = await api.post('/auth/login', {
        email: emailValidation.value, // Use validated value
        password: passwordValidation.value,
      });

      // Store token securely
      if (response.token) {
        tokenStorage.setToken(response.token);
        if (response.refreshToken) {
          tokenStorage.setRefreshToken(response.refreshToken);
        }
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      setErrors({ general: 'Login failed. Please check your credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-8">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={sanitizedEmail}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
      </div>

      {errors.general && (
        <p className="text-red-500 text-sm mb-4">{errors.general}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#ffd500] text-black py-2 px-4 rounded hover:bg-[#ccaa00] disabled:opacity-50"
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

/**
 * Example: Secure API Call
 */
export const SecureAPICallExample = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // API call to direct backend URL
      const response = await api.get('/users');
      setData(response);
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={fetchData}
        disabled={loading}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        {loading ? 'Loading...' : 'Fetch Data'}
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      {data && (
        <div className="mt-4">
          <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

/**
 * Example: Protected Route
 */
export const ProtectedPageExample = () => {
  return (
    <SecureRoute requireAuth={true}>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Protected Page</h1>
        <p>This page is only accessible to authenticated users.</p>
        <button
          onClick={() => {
            tokenStorage.clearAll();
            window.location.href = '/login';
          }}
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </SecureRoute>
  );
};

/**
 * Example: Form Validation
 */
export const FormValidationExample = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
  });

  const [errors, setErrors] = useState({});

  const validationSchema = {
    name: (value) => validateText(value, { required: true, minLength: 3, maxLength: 50 }),
    email: (value) => validateEmailInput(value, true),
    age: (value) => validateText(value, { required: true, pattern: /^\d+$/ }),
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = validateForm(formData, validationSchema);

    if (result.isValid) {
      // Form is valid, proceed
      alert('Form is valid!');
    } else {
      setErrors(result.errors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-8">
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Age</label>
        <input
          type="number"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
      </div>

      <button
        type="submit"
        className="w-full bg-[#ffd500] text-black py-2 px-4 rounded hover:bg-[#ccaa00]"
      >
        Submit
      </button>
    </form>
  );
};

/**
 * Example: Password Validation
 */
export const PasswordValidationExample = () => {
  const [password, setPassword] = useState('');
  const [validation, setValidation] = useState(null);

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    setValidation(validatePassword(value));
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <label className="block text-sm font-medium mb-2">Password</label>
      <input
        type="password"
        value={password}
        onChange={handlePasswordChange}
        className="w-full px-3 py-2 border rounded"
      />

      {validation && (
        <div className="mt-4">
          <p className={`font-medium ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
            {validation.isValid ? '✓ Password is valid' : '✗ Password requirements:'}
          </p>
          {!validation.isValid && (
            <ul className="list-disc list-inside mt-2 text-sm">
              <li className={validation.errors.minLength ? 'text-green-600' : 'text-red-600'}>
                At least 8 characters
              </li>
              <li className={validation.errors.hasUpperCase ? 'text-green-600' : 'text-red-600'}>
                One uppercase letter
              </li>
              <li className={validation.errors.hasLowerCase ? 'text-green-600' : 'text-red-600'}>
                One lowercase letter
              </li>
              <li className={validation.errors.hasNumbers ? 'text-green-600' : 'text-red-600'}>
                One number
              </li>
              <li className={validation.errors.hasSpecialChar ? 'text-green-600' : 'text-red-600'}>
                One special character
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

