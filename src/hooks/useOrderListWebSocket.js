import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tokenStorage } from '../utils/storage';

export const ORDER_OPEN_LIST_WS_URL = import.meta.env.VITE_WS_OPEN_ORDER_LIST;
export const ORDER_PENDING_LIST_WS_URL = import.meta.env.VITE_WS_PENDING_ORDER_LIST;

const WS_STATE = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  ERROR: 'ERROR',
};

const parsePayloadToList = (payload) => {
  if (payload == null) return null;
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object') return null;
  if (payload.type === 'auth' || payload.type === 'ping' || payload.type === 'pong') return null;

  const candidates = [
    payload.data,
    payload.orders,
    payload.list,
    payload.result,
    payload.openOrders,
    payload.pendingOrders,
    payload.open_orders,
    payload.pending_orders,
    payload.payload,
    payload.message,
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const inner = parsePayloadToList(c);
      if (inner) return inner;
    }
  }
  // Some servers push one order per message instead of array snapshots.
  if (
    payload &&
    typeof payload === 'object' &&
    (payload.id != null || payload.orderno != null || payload.orderNo != null)
  ) {
    return [payload];
  }
  return null;
};

const decodeMessageToText = async (raw) => {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Blob) return await raw.text();
  if (raw instanceof ArrayBuffer) return new TextDecoder().decode(raw);
  if (ArrayBuffer.isView(raw)) return new TextDecoder().decode(raw.buffer);
  return null;
};

const normalizeWsProtocol = (url) => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (typeof window === 'undefined' || window.location?.protocol !== 'https:') return value;
  if (value.startsWith('ws://')) return `wss://${value.slice(5)}`;
  return value;
};

const buildWsUrlWithToken = (baseUrl, token) => {
  const base = normalizeWsProtocol(baseUrl);
  if (!base) return '';
  try {
    const u = new URL(base);
    u.searchParams.set('token', String(token || '').trim());
    return u.toString();
  } catch {
    return base;
  }
};

export const useOrderListWebSocket = (baseUrl, enabled = true) => {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState(WS_STATE.DISCONNECTED);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const disposedRef = useRef(false);
  const hasSnapshotRef = useRef(false);
  const alternateTriedRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 8;

  const token = useMemo(() => {
    // Prefer active app/session token first.
    const fromSecure = tokenStorage.getToken();
    const fromLocal = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return String(fromSecure || fromLocal || '').trim();
  }, [enabled]);

  const wsUrl = useMemo(() => {
    if (!enabled || !token) return '';
    return buildWsUrlWithToken(baseUrl, token);
  }, [baseUrl, enabled, token]);

  const alternateWsUrl = useMemo(() => {
    if (!wsUrl) return '';
    try {
      const u = new URL(wsUrl);
      if (u.pathname.includes('/ws/')) {
        u.pathname = u.pathname.replace('/ws/', '/');
      } else {
        const path = u.pathname.startsWith('/') ? u.pathname : `/${u.pathname}`;
        u.pathname = `/ws${path}`;
      }
      return u.toString();
    } catch {
      return '';
    }
  }, [wsUrl]);

  const cleanupSocket = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      } catch {
        // ignore
      }
    }
    wsRef.current = null;
  }, []);

  const connect = useCallback((urlOverride = '') => {
    const targetUrl = String(urlOverride || wsUrl || '').trim();
    if (!targetUrl || disposedRef.current) return;
    cleanupSocket();

    setConnectionState(WS_STATE.CONNECTING);
    const ws = new WebSocket(targetUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionState(WS_STATE.CONNECTED);
      setError(null);
      // Important: order-list streams authenticate via ?token= query.
      // Do not send additional auth frames; some endpoints (e.g. pending) reject with 1008.
    };

    ws.onmessage = async (event) => {
      try {
        const text = await decodeMessageToText(event.data);
        if (text == null) return;
        const parsed = JSON.parse(text);
        const list = parsePayloadToList(parsed);
        if (list === null) return;
        setOrders(Array.isArray(list) ? list : []);
        setHasSnapshot(true);
        hasSnapshotRef.current = true;
      } catch {
        // ignore non-json/non-order frames
      }
    };

    ws.onerror = (event) => {
      setConnectionState(WS_STATE.ERROR);
      setError(new Error('Order list websocket error'));
    };

    ws.onclose = (event) => {
      if (disposedRef.current) return;
      setConnectionState(WS_STATE.DISCONNECTED);

      const code = Number(event?.code ?? 0);
      const isNormalClosure = code === 1000;
      const isAuthOrPolicyClose = code === 1008 || code === 4001 || code === 4401;
      if (!hasSnapshotRef.current && code === 1008 && !alternateTriedRef.current && alternateWsUrl) {
        alternateTriedRef.current = true;
        reconnectTimerRef.current = setTimeout(() => connect(alternateWsUrl), 250);
        return;
      }
      // If we already received a snapshot, treat close as terminal (prevents repeat reconnect storm).
      if (hasSnapshotRef.current || isNormalClosure || isAuthOrPolicyClose) {
        if (!hasSnapshotRef.current && isAuthOrPolicyClose) {
          setError(new Error(`Order list websocket unauthorized/blocked (code: ${code})`));
        }
        return;
      }

      setError(new Error(`Order list websocket closed (code: ${code})`));
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const baseDelay = Math.min(1000 * 2 ** (attempt - 1), 10000);
      const jitter = Math.floor(Math.random() * 400);
      reconnectTimerRef.current = setTimeout(() => {
        connect(targetUrl);
      }, baseDelay + jitter);
    };
  }, [MAX_RECONNECT_ATTEMPTS, alternateWsUrl, cleanupSocket, wsUrl]);

  useEffect(() => {
    disposedRef.current = false;
    hasSnapshotRef.current = false;
    alternateTriedRef.current = false;
    if (!enabled || !wsUrl) {
      setOrders([]);
      setHasSnapshot(false);
      setError(null);
      setConnectionState(WS_STATE.DISCONNECTED);
      cleanupSocket();
      return;
    }

    connect(wsUrl);
    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      cleanupSocket();
    };
  }, [cleanupSocket, connect, enabled, wsUrl]);

  const reconnect = useCallback(() => {
    if (!enabled || !wsUrl) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    connect(wsUrl);
  }, [connect, enabled, wsUrl]);

  return {
    orders,
    error,
    hasSnapshot,
    connectionState,
    isConnected: connectionState === WS_STATE.CONNECTED,
    reconnect,
  };
};

export default useOrderListWebSocket;
