/**
 * Network Context
 * Provides network status across the entire application
 */

import { createContext, useContext } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const NetworkContext = createContext(null);

export const NetworkProvider = ({ children }) => {
  const networkStatus = useNetworkStatus();

  return (
    <NetworkContext.Provider value={networkStatus}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};
