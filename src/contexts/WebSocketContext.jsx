import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createWebSocketManager, WS_STATE } from '../services/websocket';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children, url, options = {} }) => {
  const [state, setState] = useState(WS_STATE.DISCONNECTED);
  const [error, setError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const managerRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!url || isInitializedRef.current) return;

    isInitializedRef.current = true;
    managerRef.current = createWebSocketManager(url, options);

    const manager = managerRef.current;

    const handleStateChange = ({ newState }) => {
      setState(newState);
    };

    const handleError = (err) => {
      setError(err);
    };

    const handleReconnecting = ({ attempt }) => {
      setReconnectAttempts(attempt);
    };

    const handleOpen = () => {
      setError(null);
      setReconnectAttempts(0);
    };

    manager.on('statechange', handleStateChange);
    manager.on('error', handleError);
    manager.on('reconnecting', handleReconnecting);
    manager.on('open', handleOpen);

    manager.connect();

    return () => {
      if (manager) {
        manager.off('statechange', handleStateChange);
        manager.off('error', handleError);
        manager.off('reconnecting', handleReconnecting);
        manager.off('open', handleOpen);
        manager.disconnect();
      }
      isInitializedRef.current = false;
    };
  }, [url]);

  const connect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);

  const send = useCallback((data) => {
    if (managerRef.current) {
      return managerRef.current.send(data);
    }
    return false;
  }, []);

  const subscribe = useCallback((channel, params) => {
    if (managerRef.current) {
      return managerRef.current.subscribe(channel, params);
    }
    return null;
  }, []);

  const unsubscribe = useCallback((subscriptionId) => {
    if (managerRef.current) {
      return managerRef.current.unsubscribe(subscriptionId);
    }
    return false;
  }, []);

  const getManager = useCallback(() => {
    return managerRef.current;
  }, []);

  const value = {
    state,
    error,
    reconnectAttempts,
    isConnected: state === WS_STATE.CONNECTED,
    isConnecting: state === WS_STATE.CONNECTING,
    isReconnecting: state === WS_STATE.RECONNECTING,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    getManager,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;

