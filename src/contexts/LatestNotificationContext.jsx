import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { tokenStorage } from "../utils/storage";
import NotificationPopup from "../components/NotificationPopup";

const LatestNotificationContext = createContext(null);

const POLL_INTERVAL_MS = 45 * 1000; // 45 seconds
const HISTORY_API_PATH = "/profile/settings/notificationhistory";
const NOTIFICATION_WS_URL = import.meta.env.VITE_WS_GET_NOTIFICATION;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_MS = 30 * 1000;

const normalizeWsUrl = (url) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (typeof window === "undefined" || window.location?.protocol !== "https:") return value;
  if (value.startsWith("ws://")) return `wss://${value.slice(5)}`;
  return value;
};

const buildWsUrlWithToken = (baseUrl, token) => {
  const base = normalizeWsUrl(baseUrl);
  if (!base) return "";
  try {
    const u = new URL(base);
    u.searchParams.set("token", String(token || "").trim());
    return u.toString();
  } catch {
    return base;
  }
};

const parseLatestNotification = (payload) => {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (typeof payload !== "object") return null;

  const candidates = [
    payload.notification,
    payload.data,
    payload.result,
    payload.payload,
    payload.message,
    payload.notifications,
    payload.list,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c[0];
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const nested = parseLatestNotification(c);
      if (nested) return nested;
    }
  }

  if (payload.id != null || payload.title != null || payload.message_text != null) return payload;
  return null;
};

export const useLatestNotification = () => {
  const ctx = useContext(LatestNotificationContext);
  if (!ctx) return null;
  return ctx;
};

export const LatestNotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [latest, setLatest] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [popupNotification, setPopupNotification] = useState(null);
  const lastShownPopupIdRef = useRef(null);
  const isInitialFetchRef = useRef(true);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const heartbeatTimerRef = useRef(null);
  const disposedRef = useRef(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const histRes = await api.get(HISTORY_API_PATH);
      const histRaw = histRes?.notifications ?? histRes?.data ?? histRes;
      const histArr = Array.isArray(histRaw) ? histRaw : histRaw?.notifications ?? [];
      const list = Array.isArray(histArr) ? histArr : [];
      const count = list.filter((n) => !(n.isread ?? n.read)).length;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  const applyLatestNotification = useCallback((item) => {
    setLatest(item);
    if (!item) return;

    const isUnread = !(item.isread ?? item.read);
    const itemId = item.id;
    const alreadyShown = itemId === lastShownPopupIdRef.current;
    if (isUnread && !alreadyShown && !isInitialFetchRef.current) {
      lastShownPopupIdRef.current = itemId;
      setPopupNotification(item);
    } else if (itemId != null) {
      lastShownPopupIdRef.current = itemId;
    }

    if (typeof item.unread_count === "number") setUnreadCount(item.unread_count);
    else if (typeof item.unreadCount === "number") setUnreadCount(item.unreadCount);
  }, []);

  const cleanupSocket = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
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

  const connectWebSocket = useCallback((url) => {
    const targetUrl = String(url || "").trim();
    if (!targetUrl || disposedRef.current) return;
    cleanupSocket();
    setIsLoading(true);

    const ws = new WebSocket(targetUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setIsLoading(false);

      heartbeatTimerRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: "ping" }));
          } catch {
            // ignore heartbeat errors
          }
        }
      }, HEARTBEAT_MS);
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event?.data !== "string") return;
        const parsed = JSON.parse(event.data);
        const item = parseLatestNotification(parsed);
        if (item) applyLatestNotification(item);
        isInitialFetchRef.current = false;
      } catch {
        // ignore non-json frames
      }
    };

    ws.onerror = () => {
      // onclose handles retry/fallback
    };

    ws.onclose = (event) => {
      if (disposedRef.current) return;
      setIsLoading(false);
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      const code = Number(event?.code ?? 0);
      const isAuthOrPolicyClose = code === 1008 || code === 4001 || code === 4401;
      if (isAuthOrPolicyClose) return;
      if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) return;

      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const baseDelay = Math.min(1000 * 2 ** (attempt - 1), 12000);
      const jitter = Math.floor(Math.random() * 500);
      reconnectTimerRef.current = setTimeout(() => {
        connectWebSocket(targetUrl);
      }, baseDelay + jitter);
    };
  }, [applyLatestNotification, cleanupSocket]);

  const connectLatestNotificationStream = useCallback(() => {
    if (!isAuthenticated) {
      setLatest(null);
      setUnreadCount(0);
      setPopupNotification(null);
      setIsLoading(false);
      return;
    }
    const token = tokenStorage.getToken();
    const wsUrl = buildWsUrlWithToken(NOTIFICATION_WS_URL, token);
    if (!wsUrl) return;
    connectWebSocket(wsUrl);
  }, [connectWebSocket, isAuthenticated]);

  useEffect(() => {
    disposedRef.current = false;
    connectLatestNotificationStream();
    if (!isAuthenticated) return;
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, POLL_INTERVAL_MS);
    return () => {
      disposedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearInterval(id);
      cleanupSocket();
    };
  }, [cleanupSocket, connectLatestNotificationStream, fetchUnreadCount, isAuthenticated]);

  const hasUnread = latest && !(latest.isread ?? latest.read);
  const refresh = useCallback(async () => {
    connectLatestNotificationStream();
    await fetchUnreadCount();
  }, [connectLatestNotificationStream, fetchUnreadCount]);

  const dismissPopup = useCallback(() => {
    setPopupNotification(null);
  }, []);

  const value = {
    latest,
    hasUnread: !!hasUnread,
    unreadCount,
    isLoading,
    refresh,
    popupNotification,
    dismissPopup,
  };

  return (
    <LatestNotificationContext.Provider value={value}>
      <NotificationPopup
        notification={popupNotification}
        onDismiss={dismissPopup}
      />
      {children}
    </LatestNotificationContext.Provider>
  );
};

export default LatestNotificationContext;
