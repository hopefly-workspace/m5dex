/**
 * Verification Component Usage Example
 */

import Verification from '../components/Verification';

export const VerificationExample = () => {
  const handleNavigate = (path) => {
    // Implement your navigation logic
  };

  const handleSuccess = (data) => {
    if (data.type === 'verification_success') {
      // Navigate to dashboard
      handleNavigate('/dashboard');
    }
  };

  // Verification data from signup
  const verificationData = {
    email: 'user@example.com',
    phone: '+911234567890',
    user_id: 'user-uuid',
    temp_token: 'temp-jwt-token',
    verification_type: 'email'
  };

  return (
    <Verification
      onNavigate={handleNavigate}
      onSuccess={handleSuccess}
      verificationData={verificationData}
    />
  );
};

export default VerificationExample;

