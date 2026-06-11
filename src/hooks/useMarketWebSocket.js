/**
 * Custom Hook for Market WebSocket Data
 * Handles real-time market data updates via WebSocket
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * Hook to subscribe to market ticker updates
 * @param {Array<string>} symbols - Array of market symbols to subscribe to
 * @param {Function} onUpdate - Callback function when data is received
 * @param {Object} options - Additional options
 */
export const useMarketWebSocket = (symbols = [], onUpdate = null, options = {}) => {
  const { subscribe, unsubscribe, isConnected, getManager } = useWebSocket();
  const [marketData, setMarketData] = useState(new Map());
  const subscriptionsRef = useRef([]);
  const onUpdateRef = useRef(onUpdate);
  const symbolsRef = useRef(symbols);

  // Update refs when props change
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    symbolsRef.current = symbols;
  }, [onUpdate, symbols]);

  // Handle incoming market data
  const handleMarketUpdate = useCallback((data) => {
    try {
      // Handle different WebSocket message formats
      let updateData = null;

      if (data.stream) {
        // Binance-style format: { stream: "btcusdt@ticker", data: {...} }
        updateData = data.data || data;
      } else if (data.channel) {
        // Channel-based format: { channel: "ticker", data: {...} }
        updateData = data.data || data;
      } else if (data.symbol) {
        // Direct format: { symbol: "BTCUSDT", price: 43250, ... }
        updateData = data;
      } else if (Array.isArray(data)) {
        // Array of updates
        data.forEach((item) => handleMarketUpdate(item));
        return;
      } else {
        updateData = data;
      }

      if (!updateData) {
        return;
      }

      // Extract and normalize symbol from various possible fields
      // Normalize: uppercase, remove spaces, slashes, dashes, underscores, dots
      const rawSymbol = updateData.symbol || updateData.Symbol || updateData.instrument || updateData.pair || updateData.market || '';
      const symbol = rawSymbol ? String(rawSymbol).toUpperCase().trim().replace(/[\/\-\s_\.]/g, '') : '';
      
      // If no symbol found, still process the data but without symbol key
      if (!symbol) {
        // Call update callback even without symbol (for direct stream data)
        if (onUpdateRef.current) {
          onUpdateRef.current(updateData);
        }
        return;
      }

      // Update market data map - use normalized symbol as key to prevent duplicates
      setMarketData((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(symbol) || {};

        // Merge with existing data, preserving structure
        const updated = {
          ...existing,
          ...updateData,
          // Ensure price and change are numbers
          price: parseFloat(updateData.price || updateData.lastPrice || existing.price || 0),
          change24h: parseFloat(
            updateData.change24h ||
            updateData.priceChangePercent ||
            updateData.change ||
            existing.change24h ||
            0
          ),
          volume24h: parseFloat(
            updateData.volume24h ||
            updateData.volume ||
            existing.volume24h ||
            0
          ),
          high24h: parseFloat(updateData.high24h || updateData.high || existing.high24h || 0),
          low24h: parseFloat(updateData.low24h || updateData.low || existing.low24h || 0),
          lastUpdate: Date.now(),
        };

        newMap.set(symbol, updated);
        return newMap;
      });

      // Call update callback if provided
      if (onUpdateRef.current) {
        onUpdateRef.current(updateData);
      }
    } catch (error) {
      // Silently handle update errors
    }
  }, []);

  // Subscribe to market symbols or listen to direct stream
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const manager = getManager();
    if (!manager) return;

    // Listen to ALL messages - some servers stream data directly without subscriptions
    const handleAllMessages = (data) => {
      // Handle raw text data
      if (typeof data === 'string' || (data && data.raw)) {
        try {
          const parsed = JSON.parse(data.raw || data);
          handleMarketUpdate(parsed);
        } catch (e) {
          // If not JSON, ignore
        }
        return;
      }

      // Handle JSON data
      if (typeof data === 'object') {
        // Check if this is a ticker message
        if (data.stream && data.stream.includes('@ticker')) {
          handleMarketUpdate(data);
        } else if (data.channel === 'ticker' || data.type === 'ticker') {
          handleMarketUpdate(data);
        } else if (data.symbol && (data.price !== undefined || data.lastPrice !== undefined)) {
          // Direct ticker data - most common format
          handleMarketUpdate(data);
        } else if (data.price !== undefined || data.lastPrice !== undefined) {
          // Has price data, treat as market update
          handleMarketUpdate(data);
        } else {
          // Try to handle any market-like data
          handleMarketUpdate(data);
        }
      }
    };

    // Subscribe to messages
    manager.on('message', handleAllMessages);
    manager.on('channel:ticker', handleMarketUpdate);

    // Only try to subscribe if we have symbols and server supports subscriptions
    if (symbols && symbols.length > 0 && options.autoSubscribe !== false) {
      // Unsubscribe from previous subscriptions
      subscriptionsRef.current.forEach((subId) => {
        if (subId) {
          unsubscribe(subId);
        }
      });
      subscriptionsRef.current = [];

      // Subscribe to each symbol (only if server requires it)
      symbols.forEach((symbol) => {
        const normalizedSymbol = symbol.toUpperCase().replace('/', '').replace('_', '');

        // Subscribe to ticker channel
        const tickerSubId = subscribe(`ticker:${normalizedSymbol}`, { symbol: normalizedSymbol });
        if (tickerSubId) {
          subscriptionsRef.current.push(tickerSubId);
        }

        // Also try alternative subscription formats
        const altSubId = subscribe(`market:${normalizedSymbol}:ticker`, { symbol: normalizedSymbol });
        if (altSubId) {
          subscriptionsRef.current.push(altSubId);
        }
      });
    }

    // Cleanup
    return () => {
      subscriptionsRef.current.forEach((subId) => {
        if (subId) {
          unsubscribe(subId);
        }
      });
      subscriptionsRef.current = [];

      if (manager) {
        manager.off('channel:ticker', handleMarketUpdate);
        manager.off('message', handleAllMessages);
      }
    };
  }, [isConnected, symbols, subscribe, unsubscribe, getManager, handleMarketUpdate, options]);

  // Get market data for a specific symbol
  const getMarketData = useCallback(
    (symbol) => {
      const normalizedSymbol = symbol.toUpperCase().replace('/', '').replace('_', '');
      return marketData.get(normalizedSymbol) || null;
    },
    [marketData]
  );

  // Get all market data
  const getAllMarketData = useCallback(() => {
    return Array.from(marketData.values());
  }, [marketData]);

  return {
    marketData: marketData,
    getMarketData,
    getAllMarketData,
    isConnected,
  };
};

export default useMarketWebSocket;

