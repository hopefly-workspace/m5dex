/**
 * Network Status Hook
 * Detects online/offline status and network quality
 */

import { useState, useEffect, useCallback } from 'react';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [networkType, setNetworkType] = useState(null);
  const [effectiveType, setEffectiveType] = useState(null);
  const [downlink, setDownlink] = useState(null);
  const [rtt, setRtt] = useState(null);

  const updateNetworkStatus = useCallback(() => {
    const online = navigator.onLine;
    
    setIsOnline(prevOnline => {
      // Track if we're transitioning from offline to online
      if (!prevOnline && online && wasOffline) {
        // Network just reconnected - keep wasOffline true briefly for reconnecting animation
        setTimeout(() => {
          setWasOffline(false);
        }, 2000);
      }
      return online;
    });
    
    if (!online) {
      setWasOffline(true);
    }

    // Get network information if available
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (connection) {
        setNetworkType(connection.type || null);
        setEffectiveType(connection.effectiveType || null);
        setDownlink(connection.downlink || null);
        setRtt(connection.rtt || null);
      }
    }
  }, [wasOffline]);

  useEffect(() => {
    // Initial check
    updateNetworkStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    // Listen for connection changes (if supported)
    if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        connection.addEventListener('change', updateNetworkStatus);
      }
    }

    // Periodic check (fallback for browsers that don't support events)
    const intervalId = setInterval(() => {
      updateNetworkStatus();
    }, 3000);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
      
      if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
          connection.removeEventListener('change', updateNetworkStatus);
        }
      }
      
      clearInterval(intervalId);
    };
  }, [updateNetworkStatus]);

  return {
    isOnline,
    wasOffline,
    networkType,
    effectiveType,
    downlink,
    rtt,
    isSlowConnection: effectiveType === 'slow-2g' || effectiveType === '2g' || (downlink && downlink < 0.5),
  };
};
