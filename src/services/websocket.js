/**
 * WebSocket Service
 * Industry-level WebSocket client with reconnection, error handling, and state management
 *
 * Note: Browsers block ws:// when page is on HTTPS (mixed content). Use wss:// for production.
 */

// Resolve WebSocket URL: use wss when page is HTTPS (browser blocks ws:// mixed content)
const resolveWsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (import.meta.env.VITE_WS_DISABLE_AUTO_WSS === 'true') return url;
  const isSecurePage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  if (isSecurePage && url.startsWith('ws://')) {
    const resolved = url.replace(/^ws:\/\//, 'wss://');
    if (import.meta.env?.DEV) {
      console.warn('[WebSocket] HTTPS page: ws->wss', url, '->', resolved);
    }
    return resolved;
  }
  return url;
};

// WebSocket connection states
export const WS_STATE = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR',
  CLOSED: 'CLOSED',
};

// Default configuration
const DEFAULT_CONFIG = {
  reconnectInterval: 1000, // Start with 1 second
  maxReconnectInterval: 30000, // Max 30 seconds
  reconnectDecay: 1.5, // Exponential backoff multiplier
  timeoutInterval: 15000, // Connection timeout (15s for slow networks)
  maxReconnectAttempts: Infinity, // Unlimited reconnects
  heartbeatInterval: 30000, // Send ping every 30 seconds
  heartbeatTimeout: 10000, // Wait 10 seconds for pong
};

/**
 * WebSocket Manager Class
 * Handles WebSocket connections with automatic reconnection and error handling
 */
export class WebSocketManager {
  constructor(url, options = {}) {
    this.url = url;
    this.options = { ...DEFAULT_CONFIG, ...options };
    this.ws = null;
    this.state = WS_STATE.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.heartbeatTimeout = null;
    this.messageQueue = [];
    this.subscriptions = new Map(); // Track active subscriptions
    this.listeners = new Map(); // Event listeners
    this.shouldReconnect = true;
    this.isManualClose = false;
    this.messageIdCounter = 0;

    // Bind methods
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isManualClose = false;
    this.shouldReconnect = true;
    this.setState(WS_STATE.CONNECTING);

    try {
      // Determine WebSocket URL (support both ws:// and wss://)
      let wsUrl = this.url.startsWith('ws://') || this.url.startsWith('wss://')
        ? this.url
        : `${typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${this.url}`;
      wsUrl = resolveWsUrl(wsUrl);

      this.ws = new WebSocket(wsUrl);

      // Set connection timeout (increased for network latency)
      const timeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          this.handleReconnect();
        }
      }, this.options.timeoutInterval);

      this.ws.onopen = (event) => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.setState(WS_STATE.CONNECTED);
        // Only start heartbeat if enabled (some servers don't support it)
        if (this.options.enableHeartbeat !== false) {
          this.startHeartbeat();
        }
        this.flushMessageQueue();
        this.emit('open', event);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        this.setState(WS_STATE.ERROR);
        if (import.meta.env?.DEV) {
          console.error('[WebSocket] Error:', wsUrl, error);
        }
        this.emit('error', error);
      };

      this.ws.onclose = (event) => {
        clearTimeout(timeout);
        this.stopHeartbeat();
        this.setState(WS_STATE.DISCONNECTED);
        if (import.meta.env?.DEV && !this.isManualClose) {
          console.warn('[WebSocket] Closed:', wsUrl, 'code:', event.code, 'reason:', event.reason || 'none');
        }
        if (!this.isManualClose && this.shouldReconnect) {
          this.handleReconnect();
        } else {
          this.emit('close', event);
        }
      };
    } catch (error) {
      this.setState(WS_STATE.ERROR);
      this.emit('error', error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.isManualClose = true;
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState(WS_STATE.CLOSED);
    this.emit('close', { code: 1000, reason: 'Manual disconnect' });
  }

  /**
   * Send message to server
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        this.ws.send(message);
        return true;
      } catch (error) {
        this.emit('error', error);
        return false;
      }
    } else {
      // Queue message if not connected
      this.messageQueue.push(data);
      return false;
    }
  }

  /**
   * Subscribe to a channel/topic
   */
  subscribe(channel, params = {}) {
    const subscriptionId = `${channel}_${Date.now()}_${Math.random()}`;
    this.subscriptions.set(subscriptionId, { channel, params });

    const message = {
      method: 'SUBSCRIBE',
      params: [channel, ...Object.values(params)],
      id: this.messageIdCounter++,
    };

    if (this.send(message)) {
      return subscriptionId;
    } else {
      // Will be sent when connected
      return subscriptionId;
    }
  }

  /**
   * Unsubscribe from a channel/topic
   */
  unsubscribe(subscriptionId) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    const message = {
      method: 'UNSUBSCRIBE',
      params: [subscription.channel],
      id: this.messageIdCounter++,
    };

    this.subscriptions.delete(subscriptionId);
    return this.send(message);
  }

  /**
   * Handle incoming messages
   */
  handleMessage(event) {
    try {
      // Try to parse as JSON first
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        // If not JSON, treat as text/raw data
        this.emit('message', { raw: event.data, text: event.data });
        return;
      }

      // Handle different message types
      if (data.type === 'pong' || data.method === 'pong' || data === 'pong') {
        this.handlePong();
        return;
      }

      if (data.type === 'ping' || data.method === 'ping' || data === 'ping') {
        const pongMessage = this.options.heartbeatFormat === 'text'
          ? 'pong'
          : { type: 'pong', method: 'pong' };
        this.send(pongMessage);
        return;
      }

      // Emit message event
      this.emit('message', data);

      // Emit channel-specific events
      if (data.channel || data.stream) {
        const channel = data.channel || data.stream;
        this.emit(`channel:${channel}`, data);
      }
    } catch (error) {
      // Handle non-JSON messages
      this.emit('message', event.data);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat();

    // Skip heartbeat if disabled
    if (this.options.enableHeartbeat === false) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Try different ping formats
        const pingMessage = this.options.heartbeatFormat === 'text'
          ? 'ping'
          : { type: 'ping', method: 'ping' };

        this.send(pingMessage);

        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
            this.handleReconnect();
          }
        }, this.options.heartbeatTimeout);
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Handle pong response
   */
  handlePong() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (!this.shouldReconnect || this.isManualClose) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.setState(WS_STATE.ERROR);
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.clearReconnectTimer();
    this.setState(WS_STATE.RECONNECTING);

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempts),
      this.options.maxReconnectInterval
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
  }

  /**
   * Clear reconnect timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }

    // Resubscribe to all channels
    this.subscriptions.forEach((subscription) => {
      const message = {
        method: 'SUBSCRIBE',
        params: [subscription.channel, ...Object.values(subscription.params)],
        id: this.messageIdCounter++,
      };
      this.send(message);
    });
  }

  /**
   * Set connection state
   */
  setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.emit('statechange', { oldState, newState });
    }
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          // Silently handle listener errors
        }
      });
    }

    // Also emit to wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((callback) => {
        try {
          callback(event, data);
        } catch (error) {
          // Silently handle listener errors
        }
      });
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.state === WS_STATE.CONNECTED && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Create WebSocket manager instance
 */
export const createWebSocketManager = (url, options) => {
  return new WebSocketManager(url, options);
};

export default WebSocketManager;

