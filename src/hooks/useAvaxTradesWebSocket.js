/**
 * Custom Hook for AVAX Trades WebSocket Data
 * Handles real-time AVAX trades data from separate WebSocket connection
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createWebSocketManager, WS_STATE } from '../services/websocket';
import { normalizeSymbol } from '../services/favouritesWishlistApi';

/**
 * Hook to subscribe to AVAX trades updates via a separate WebSocket connection
 * @param {string} wsUrl - WebSocket URL for AVAX trades
 * @param {Function} onUpdate - Callback function when data is received
 * @param {Object} options - Additional options
 */
export const useAvaxTradesWebSocket = (wsUrl, onUpdate = null, options = {}) => {
  const { maxItems = 500, ...wsOptions } = options || {};
  const [tradesData, setTradesData] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState(WS_STATE.DISCONNECTED);
  const managerRef = useRef(null);
  const onUpdateRef = useRef(onUpdate);
  const subscriptionsRef = useRef([]);
  const prevWsUrlRef = useRef(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const processTradesIntoMap = useCallback((prev, trades, normalize) => {
    const tradesMap = new Map();
    prev.forEach((trade) => {
      const rawSymbol =
        trade.symbol ||
        trade.Symbol ||
        trade.pairsymbol ||
        trade.pairSymbol ||
        trade.tradingsymbol ||
        trade.tradingSymbol ||
        trade.id ||
        trade.instrument ||
        trade.pair ||
        trade.market ||
        '';
      const normalizedKey = normalize(rawSymbol);
      if (normalizedKey) {
        const existing = tradesMap.get(normalizedKey);
        if (!existing || (trade.lastUpdate && trade.lastUpdate > (existing.lastUpdate || 0))) {
          tradesMap.set(normalizedKey, trade);
        }
      }
    });
    trades.forEach((trade) => {
      const rawSymbol =
        trade.symbol ||
        trade.Symbol ||
        trade.pairsymbol ||
        trade.pairSymbol ||
        trade.tradingsymbol ||
        trade.tradingSymbol ||
        trade.id ||
        trade.instrument ||
        trade.pair ||
        trade.market ||
        '';
      const normalizedKey = normalize(rawSymbol);
      if (!normalizedKey) {
        tradesMap.set(`_${Date.now()}_${Math.random()}`, {
          ...trade,
          lastUpdate: trade.timestamp || trade.time || trade.T || Date.now(),
        });
        return;
      }
      const existing = tradesMap.get(normalizedKey);
      const tradeTimestamp = trade.timestamp || trade.time || trade.T || Date.now();
      if (!existing || tradeTimestamp > (existing.lastUpdate || 0)) {
        tradesMap.set(normalizedKey, {
          ...existing,
          ...trade,
          symbol: trade.symbol || rawSymbol,
          id: normalizedKey,
          lastUpdate: tradeTimestamp,
        });
      } else {
        tradesMap.set(normalizedKey, {
          ...existing,
          ...trade,
          lastUpdate: existing.lastUpdate,
        });
      }
    });
    return Array.from(tradesMap.values()).slice(-maxItems);
  }, [maxItems]);

  /**
   * Normalize server payloads (India /ws/subscribed, Binance-style streams, etc.) into a tick array.
   * Important: do not let `stream`/`channel` branches overwrite an already-resolved `ticks` array.
   */
  const unwrapTicksPayload = useCallback((data) => {
    if (data == null) return null;
    if (Array.isArray(data)) return data;
    if (typeof data !== 'object') return null;

    if (data.ticks && Array.isArray(data.ticks)) return data.ticks;
    if (data.data?.ticks && Array.isArray(data.data.ticks)) return data.data.ticks;
    if (Array.isArray(data.data)) return data.data;
    if (data.results && Array.isArray(data.results)) return data.results;
    if (data.payload && Array.isArray(data.payload)) return data.payload;
    if (data.trades && Array.isArray(data.trades)) return data.trades;
    if (data.tick && typeof data.tick === 'object' && !Array.isArray(data.tick)) return [data.tick];

    if (data.stream || data.channel) {
      const inner = data.data;
      if (Array.isArray(inner)) return inner;
      if (inner?.ticks && Array.isArray(inner.ticks)) return inner.ticks;
      if (inner && typeof inner === 'object') return [inner];
      return null;
    }

    if (data.trades && !Array.isArray(data.trades)) return [data.trades];
    if (data.data !== undefined && data.data !== null && typeof data.data === 'object' && !Array.isArray(data.data)) {
      const inner = data.data;
      if (inner.ticks && Array.isArray(inner.ticks)) return inner.ticks;
    }

    const tickLike =
      data.ltp != null ||
      data.price != null ||
      data.p != null ||
      data.last != null ||
      data.lastPrice != null ||
      data.close != null ||
      data.pairsymbol ||
      data.pairSymbol ||
      data.tradingsymbol ||
      data.instrument_token != null ||
      data.instrumentToken != null ||
      data.symbol ||
      data.Symbol;

    if (tickLike) return [data];

    return null;
  }, []);

  const handleTradesUpdate = useCallback(
    (data) => {
      try {
        if (data == null) return;

        const updateData = unwrapTicksPayload(data);
        if (!updateData || updateData.length === 0) return;

        const trades = updateData.filter((t) => t && typeof t === 'object');
        if (!trades.length) return;

        setTradesData((prev) => processTradesIntoMap(prev, trades, normalizeSymbol));
        if (onUpdateRef.current) onUpdateRef.current(trades);
      } catch (_) {
        // Ignore parse/update errors
      }
    },
    [normalizeSymbol, processTradesIntoMap, unwrapTicksPayload]
  );

  // Initialize WebSocket connection
  useEffect(() => {
    if (!wsUrl) return;

    if (prevWsUrlRef.current != null && prevWsUrlRef.current !== wsUrl) {
      setTradesData([]);
    }
    prevWsUrlRef.current = wsUrl;
    if (managerRef.current) {
      managerRef.current.disconnect();
      managerRef.current = null;
    }

    const manager = createWebSocketManager(wsUrl, {
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      timeoutInterval: 10000,
      enableHeartbeat: false,
      autoConnect: options.autoConnect !== false,
      ...wsOptions,
    });

    managerRef.current = manager;

    const handleStateChange = ({ newState }) => {
      setConnectionState(newState);
      setIsConnected(newState === WS_STATE.CONNECTED);
      if (newState === WS_STATE.CONNECTED) {
        setError(null);
      }
    };

    const handleError = (err) => {
      setError(err);
    };

    const handleOpen = () => {
      setError(null);
    };

    const handleClose = (event) => {
      // Log close event for debugging
      if (event.code !== 1000) {
        setError(new Error(`WebSocket closed: ${event.code} ${event.reason || 'Unknown reason'}`));
      }
    };

    const handleMessage = (data) => {
      // Handle raw text data
      if (typeof data === 'string' || (data && data.raw)) {
        try {
          const parsed = JSON.parse(data.raw || data);
          handleTradesUpdate(parsed);
        } catch (e) {
          // If not JSON, ignore
        }
        return;
      }

      // Handle JSON data
      if (typeof data === 'object') {
        // Check if this is trades data
        if (data.type === 'trade' || data.channel === 'trades' || data.trades) {
          handleTradesUpdate(data);
        } else if (data.stream && data.stream.includes('trades')) {
          handleTradesUpdate(data);
        } else {
          // Try to handle any trades-like data
          handleTradesUpdate(data);
        }
      }
    };

    manager.on('statechange', handleStateChange);
    manager.on('error', handleError);
    manager.on('open', handleOpen);
    manager.on('close', handleClose);
    manager.on('message', handleMessage);
    manager.on('channel:trades', handleTradesUpdate);

    // Connect immediately
    if (options.autoConnect !== false) {
      manager.connect();
    }

    // Cleanup
    return () => {
      if (manager) {
        manager.off('statechange', handleStateChange);
        manager.off('error', handleError);
        manager.off('open', handleOpen);
        manager.off('close', handleClose);
        manager.off('message', handleMessage);
        manager.off('channel:trades', handleTradesUpdate);
        manager.disconnect();
      }
      managerRef.current = null;
    };
  }, [wsUrl, handleTradesUpdate]); // Include handleTradesUpdate in dependencies

  return {
    tradesData,
    isConnected,
    error,
    connectionState,
    getManager: () => managerRef.current,
  };
};

export default useAvaxTradesWebSocket;

