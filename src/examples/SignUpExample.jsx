/**
 * Sign Up Component Usage Example
 * Shows how to use the SignUp component
 */

import SignUp from '../components/SignUp';

export const SignUpExample = () => {
  const handleNavigate = (path) => {
    // Implement your navigation logic here
    // For example, if using React Router:
    // navigate(path);
  };

  const handleSuccess = (data) => {
    
    if (data.type === 'verification_required') {
      // Handle verification required
      // Navigate to verification screen
      handleNavigate('/verify');
    } else if (data.type === 'login_success') {
      // Handle direct login success
      // Navigate to dashboard
      handleNavigate('/dashboard');
    }
  };

  return (
    <SignUp
      onNavigate={handleNavigate}
      onSuccess={handleSuccess}
    />
  );
};

export default SignUpExample;

