/**
 * No Internet Screen Component
 * Industry-level offline screen with reconnection detection
 */

import { useEffect, useState } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import '../styles/components/NoInternetScreen.css';

const NoInternetScreen = () => {
  const { isOnline, wasOffline } = useNetwork();
  const [showScreen, setShowScreen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!isOnline) {
      setShowScreen(true);
      setReconnecting(false);
    } else if (wasOffline && isOnline) {
      // Network reconnected
      setReconnecting(true);
      setTimeout(() => {
        setShowScreen(false);
        setReconnecting(false);
      }, 1500);
    }
  }, [isOnline, wasOffline]);

  // Animated dots for reconnecting state
  useEffect(() => {
    if (reconnecting) {
      const interval = setInterval(() => {
        setDots(prev => {
          if (prev.length >= 3) return '';
          return prev + '.';
        });
      }, 300);
      return () => clearInterval(interval);
    } else {
      setDots('');
    }
  }, [reconnecting]);

  if (!showScreen && !reconnecting) return null;

  return (
    <div className={`no-internet-screen ${reconnecting ? 'reconnecting' : ''}`}>
      <div className="no-internet-content">
        {/* Animated Background */}
        <div className="no-internet-background">
          <div className="no-internet-wave"></div>
          <div className="no-internet-wave no-internet-wave-delay-1"></div>
          <div className="no-internet-wave no-internet-wave-delay-2"></div>
        </div>

        {/* Main Content */}
        <div className="no-internet-main">
          {/* Icon */}
          <div className="no-internet-icon">
            <div className="no-internet-icon-pulse"></div>
            <div className="no-internet-icon-pulse no-internet-icon-pulse-delay"></div>
            {reconnecting ? (
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6M23 12h-6M7 12H1" />
              </svg>
            ) : (
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            )}
          </div>

          {/* Title */}
          <h1 className="no-internet-title">
            {reconnecting ? `Reconnecting${dots}` : 'No Internet Connection'}
          </h1>

          {/* Subtitle */}
          <p className="no-internet-subtitle">
            {reconnecting 
              ? 'Your connection is being restored...'
              : 'Please check your internet connection and try again'
            }
          </p>

          {/* Action Buttons */}
          {!reconnecting && (
            <div className="no-internet-actions">
              <button
                className="no-internet-btn no-internet-btn-primary"
                onClick={() => {
                  if (navigator.onLine) {
                    window.location.reload();
                  } else {
                    // Try to reconnect
                    setReconnecting(true);
                    setTimeout(() => {
                      if (navigator.onLine) {
                        setShowScreen(false);
                        setReconnecting(false);
                      } else {
                        setReconnecting(false);
                      }
                    }, 2000);
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                Retry Connection
              </button>
            </div>
          )}

          {/* Connection Tips */}
          {!reconnecting && (
            <div className="no-internet-tips">
              <div className="no-internet-tip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                <span>Check your Wi-Fi or mobile data</span>
              </div>
              <div className="no-internet-tip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span>Move to an area with better signal</span>
              </div>
              <div className="no-internet-tip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                <span>Restart your router or modem</span>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {reconnecting && (
            <div className="no-internet-progress">
              <div className="no-internet-progress-bar">
                <div className="no-internet-progress-fill"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoInternetScreen;
