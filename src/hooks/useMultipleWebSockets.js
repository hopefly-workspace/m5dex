/**
 * Custom Hook for Multiple WebSocket Connections
 * Industry-level solution for managing multiple WebSocket connections in a component
 * 
 * @example
 * const { connections, addConnection, removeConnection } = useMultipleWebSockets();
 * addConnection('markets', { url: 'ws://...', options: {...} });
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createWebSocketManager, WS_STATE } from '../services/websocket';

export const useMultipleWebSockets = () => {
  const managersRef = useRef(new Map());
  const [connectionStates, setConnectionStates] = useState(new Map());
  const [connectionErrors, setConnectionErrors] = useState(new Map());

  // Add a new WebSocket connection
  const addConnection = useCallback((name, config) => {
    if (managersRef.current.has(name)) {
      return false; // Connection already exists
    }

    if (!config || !config.url) {
      return false;
    }

    const manager = createWebSocketManager(config.url, config.options || {});
    managersRef.current.set(name, manager);

    // Initialize state
    setConnectionStates((prev) => {
      const updated = new Map(prev);
      updated.set(name, WS_STATE.DISCONNECTED);
      return updated;
    });

    setConnectionErrors((prev) => {
      const updated = new Map(prev);
      updated.set(name, null);
      return updated;
    });

    // Set up event listeners
    const handleStateChange = ({ newState }) => {
      setConnectionStates((prev) => {
        const updated = new Map(prev);
        updated.set(name, newState);
        return updated;
      });
    };

    const handleError = (err) => {
      setConnectionErrors((prev) => {
        const updated = new Map(prev);
        updated.set(name, err);
        return updated;
      });
    };

    const handleOpen = () => {
      setConnectionErrors((prev) => {
        const updated = new Map(prev);
        updated.set(name, null);
        return updated;
      });
    };

    manager.on('statechange', handleStateChange);
    manager.on('error', handleError);
    manager.on('open', handleOpen);

    // Store handlers for cleanup
    manager._handlers = {
      statechange: handleStateChange,
      error: handleError,
      open: handleOpen,
    };

    // Connect if autoConnect is not disabled
    if (config.autoConnect !== false) {
      manager.connect();
    }

    return true;
  }, []);

  // Remove a WebSocket connection
  const removeConnection = useCallback((name) => {
    const manager = managersRef.current.get(name);
    if (manager) {
      if (manager._handlers) {
        manager.off('statechange', manager._handlers.statechange);
        manager.off('error', manager._handlers.error);
        manager.off('open', manager._handlers.open);
      }
      manager.disconnect();
      managersRef.current.delete(name);

      setConnectionStates((prev) => {
        const updated = new Map(prev);
        updated.delete(name);
        return updated;
      });

      setConnectionErrors((prev) => {
        const updated = new Map(prev);
        updated.delete(name);
        return updated;
      });

      return true;
    }
    return false;
  }, []);

  // Get manager for a connection
  const getManager = useCallback((name) => {
    return managersRef.current.get(name) || null;
  }, []);

  // Get state for a connection
  const getConnectionState = useCallback((name) => {
    return connectionStates.get(name) || WS_STATE.DISCONNECTED;
  }, [connectionStates]);

  // Get error for a connection
  const getConnectionError = useCallback((name) => {
    return connectionErrors.get(name) || null;
  }, [connectionErrors]);

  // Check if connection is connected
  const isConnected = useCallback((name) => {
    const state = connectionStates.get(name);
    const manager = managersRef.current.get(name);
    return state === WS_STATE.CONNECTED && manager && manager.isConnected();
  }, [connectionStates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managersRef.current.forEach((manager, name) => {
        if (manager._handlers) {
          manager.off('statechange', manager._handlers.statechange);
          manager.off('error', manager._handlers.error);
          manager.off('open', manager._handlers.open);
        }
        manager.disconnect();
      });
      managersRef.current.clear();
    };
  }, []);

  return {
    addConnection,
    removeConnection,
    getManager,
    getConnectionState,
    getConnectionError,
    isConnected,
    connectionStates,
    connectionErrors,
  };
};

export default useMultipleWebSockets;

