/**
 * OTP Input Component
 * 6-digit OTP input with auto-focus
 */

import { useRef, useEffect, useState } from 'react';
import '../styles/components/OTPInput.css';

const OTPInput = ({ value, onChange, onComplete, error = false, disabled = false }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (value) {
      const digits = value.split('').slice(0, 6);
      const newOtp = [...otp];
      digits.forEach((digit, index) => {
        if (index < 6) {
          newOtp[index] = digit;
        }
      });
      setOtp(newOtp);
    } else {
      setOtp(['', '', '', '', '', '']);
    }
  }, [value]);

  const handleChange = (index, digit) => {
    // Only allow numbers
    if (digit && !/^\d$/.test(digit)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    const otpValue = newOtp.join('');
    onChange(otpValue);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (otpValue.length === 6 && newOtp.every(d => d !== '')) {
      onComplete(otpValue);
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (index, e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text') || '';
    const digits = text.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;

    const newOtp = ['', '', '', '', '', ''];
    digits.forEach((digit, i) => {
      if (i < 6) newOtp[i] = digit;
    });
    setOtp(newOtp);
    const otpValue = newOtp.join('');
    onChange(otpValue);
    // Focus last filled box
    const focusIndex = Math.min(digits.length - 1, 5);
    inputRefs.current[focusIndex]?.focus();
    if (otpValue.length === 6 && newOtp.every(d => d !== '')) {
      onComplete(otpValue);
    }
  };

  const handleFocus = (index) => {
    inputRefs.current[index]?.select();
  };

  return (
    <div className="otp-input-container">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className={`otp-input-field ${error ? 'error' : ''}`}
        />
      ))}
    </div>
  );
};

export default OTPInput;

