/**
 * Toast Component Usage Examples
 * Universal toast notification component for the entire project
 */

import { useToast } from '../contexts/ToastContext';
import { copyToClipboard } from '../utils/clipboard';

// Example 1: Basic Usage in a Component
const ExampleComponent = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleSuccess = () => {
    showSuccess('Operation completed successfully!');
  };

  const handleError = () => {
    showError('Something went wrong. Please try again.');
  };

  const handleWarning = () => {
    showWarning('Please check your input.');
  };

  const handleInfo = () => {
    showInfo('This is an informational message.');
  };

  return (
    <div>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
      <button onClick={handleWarning}>Show Warning</button>
      <button onClick={handleInfo}>Show Info</button>
    </div>
  );
};

// Example 2: Custom Duration
const CustomDurationExample = () => {
  const { showSuccess } = useToast();

  const handleLongMessage = () => {
    // Show toast for 5 seconds instead of default 3 seconds
    showSuccess('This message will stay for 5 seconds', 5000);
  };

  return <button onClick={handleLongMessage}>Show Long Toast</button>;
};

// Example 3: After API Call
const APICallExample = () => {
  const { showSuccess, showError } = useToast();

  const handleSubmit = async () => {
    try {
      const response = await api.post('/endpoint', data);
      showSuccess('Data saved successfully!');
    } catch (error) {
      showError('Failed to save data. Please try again.');
    }
  };

  return <button onClick={handleSubmit}>Submit</button>;
};

// Example 4: Copy to Clipboard
const CopyExample = () => {
  const { showSuccess, showError } = useToast();

  const handleCopy = async () => {
    try {
      await copyToClipboard('Text to copy');
      showSuccess('Copied to clipboard!');
    } catch (err) {
      showError('Failed to copy. Please try again.');
    }
  };

  return <button onClick={handleCopy}>Copy</button>;
};

export default ExampleComponent;
