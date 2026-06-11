/**
 * Password Strength Indicator Component
 * Shows password requirements and strength
 */

import { validatePassword } from '../utils/security';

const PasswordStrengthIndicator = ({ password }) => {
  const validation = password ? validatePassword(password) : null;

  const requirements = [
    { key: 'minLength', label: 'At least 8 characters' },
    { key: 'hasUpperCase', label: 'One uppercase letter' },
    { key: 'hasLowerCase', label: 'One lowercase letter' },
    { key: 'hasNumbers', label: 'One number' },
    { key: 'hasSpecialChar', label: 'One special character' },
  ];

  if (!password) return null;

  return (
    <div className="ark-password-strength">
      <div style={{ 
        fontSize: 'var(--ark-font-size-xs)', 
        color: 'var(--ark-text-secondary)', 
        marginBottom: 'var(--ark-space-sm)',
        fontWeight: 'var(--ark-weight-medium)'
      }}>
        Password Requirements:
      </div>
      <ul className="ark-password-requirements">
        {requirements.map((req) => {
          // validation.errors contains boolean values where true = requirement met
          const isValid = validation?.errors?.[req.key] === true;
          return (
            <li key={req.key} className={`ark-requirement-item ${isValid ? 'valid' : ''}`}>
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;

