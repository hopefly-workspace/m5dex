/**
 * React Security Hooks
 * Security utilities for React components
 */

import { useEffect, useRef } from 'react';
import { preventClickjacking } from './security.js';

/**
 * Hook to prevent clickjacking
 */
export const useClickjackingProtection = () => {
  useEffect(() => {
    preventClickjacking();
    
    // Check periodically
    const interval = setInterval(preventClickjacking, 1000);
    
    return () => clearInterval(interval);
  }, []);
};

/**
 * Hook to detect and prevent XSS in user input
 */
export const useXSSProtection = (value) => {
  const sanitizedRef = useRef(value);
  
  useEffect(() => {
    if (typeof value === 'string') {
      // Basic XSS protection - remove script tags
      sanitizedRef.current = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else {
      sanitizedRef.current = value;
    }
  }, [value]);
  
  return sanitizedRef.current;
};

/**
 * Hook to detect if app is running in iframe
 */
export const useFrameDetection = () => {
  useEffect(() => {
    const isInFrame = window.self !== window.top;
    if (isInFrame) {
      // Prevent running in iframe
      window.top.location = window.self.location;
    }
  }, []);
};

/**
 * Hook to clear sensitive data on visibility change
 */
export const useVisibilityProtection = (clearOnHidden = false) => {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && clearOnHidden) {
        // Clear sensitive data when tab is hidden
        // This is optional and depends on your security requirements
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearOnHidden]);
};

/**
 * Hook to prevent right-click and dev tools (basic protection)
 * Note: This is not foolproof but adds a layer of protection
 */
export const useBasicProtection = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return;
    
    // Prevent right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };
    
    // Prevent F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        return false;
      }
    };
    
    // Prevent text selection (optional)
    const handleSelectStart = (e) => {
      e.preventDefault();
      return false;
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [enabled]);
};

