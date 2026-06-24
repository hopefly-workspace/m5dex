import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createWebSocketManager } from '../services/websocket';
import { appendIndiaWsToken, subscribeIndiaPairIds } from '../services/indiaTicksSubscription';
import { indiaTickPairId } from '../utils/indiaPairResolve';

function unwrapTickMessage(data) {
    if (data == null) return [];
    if (Array.isArray(data)) return data.filter((t) => t && typeof t === 'object');
    if (typeof data !== 'object') return [];

    if (data.ticks && Array.isArray(data.ticks)) return data.ticks;
    if (data.data?.ticks && Array.isArray(data.data.ticks)) return data.data.ticks;
    if (Array.isArray(data.data)) return data.data;
    if (data.results && Array.isArray(data.results)) return data.results;
    if (data.payload && Array.isArray(data.payload)) return data.payload;
    if (data.trades && Array.isArray(data.trades)) return data.trades;
    if (data.tick && typeof data.tick === 'object' && !Array.isArray(data.tick)) return [data.tick];

    if (data.stream || data.channel) {
        const inner = data.data;
        if (Array.isArray(inner)) return inner.filter((t) => t && typeof t === 'object');
        if (inner?.ticks && Array.isArray(inner.ticks)) return inner.ticks;
        if (inner && typeof inner === 'object') return [inner];
        return [];
    }

    if (data.data != null && typeof data.data === 'object' && !Array.isArray(data.data)) {
        if (data.type === 'all_subscribed') {
            return Object.values(data.data).filter((t) => t && typeof t === 'object');
        }
        if (data.data.ticks && Array.isArray(data.data.ticks)) return data.data.ticks;
    }

    const tickLike =
        data.ltp != null ||
        data.price != null ||
        data.p != null ||
        data.last != null ||
        data.lastPrice != null ||
        data.close != null ||
        data.bid != null ||
        data.ask != null ||
        data.pairsymbol ||
        data.pairSymbol ||
        data.tradingsymbol ||
        data.instrument_token != null ||
        data.instrumentToken != null ||
        data.symbol ||
        data.Symbol;

    return tickLike ? [data] : [];
}

const WS_OPTIONS = {
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    timeoutInterval: 10000,
    enableHeartbeat: false,
};

const subscribedPairIdsGlobal = new Set();

/**
 * Live India ticks per open-order pairid (same WS stack as Dashboard chart).
 */
export function useIndiaPairTicksFeed(pairIds = [], enabled = true) {
    const [ticksByPairId, setTicksByPairId] = useState({});
    const managersRef = useRef([]);

    const pairKey = useMemo(
        () =>
            (Array.isArray(pairIds) ? pairIds : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
                .sort()
                .join(','),
        [pairIds],
    );

    const baseWs = useMemo(() => {
        const raw = import.meta.env.VITE_WS_INDIA_URL;
        if (!raw) return '';
        return appendIndiaWsToken(String(raw).replace(/\/+$/, ''));
    }, []);

    const mergeTick = useCallback((pairId, tick) => {
        if (!tick || typeof tick !== 'object') return;
        const pid = String(pairId || indiaTickPairId(tick) || '').trim();
        if (!pid) return;
        setTicksByPairId((current) => {
            const prev = current[pid];
            const ts = Number(tick.timestamp ?? tick.time ?? tick.T ?? Date.now());
            const prevTs = Number(prev?.lastUpdate ?? prev?.timestamp ?? prev?.time ?? 0);
            if (prev && ts < prevTs) return current;
            return {
                ...current,
                [pid]: {
                    ...prev,
                    ...tick,
                    pairid: pid,
                    pairId: pid,
                    lastUpdate: ts,
                },
            };
        });
    }, []);

    useEffect(() => {
        managersRef.current.forEach((manager) => {
            try {
                manager.disconnect();
            } catch {
                /* ignore */
            }
        });
        managersRef.current = [];

        if (!enabled || !baseWs || !pairKey) {
            setTicksByPairId({});
            return undefined;
        }

        const ids = pairKey.split(',').filter(Boolean);
        const pendingSubscribe = ids.filter((id) => !subscribedPairIdsGlobal.has(id));

        let cancelled = false;
        const connectSockets = () => {
            if (cancelled) return;
            ids.forEach((pairId) => {
                const url = `${baseWs}/${pairId}`;
                const manager = createWebSocketManager(url, WS_OPTIONS);

                const onMessage = (data) => {
                    try {
                        let payload = data;
                        if (typeof data === 'string' || data?.raw) {
                            payload = JSON.parse(data.raw || data);
                        } else if (typeof data === 'object' && data !== null) {
                            payload = data;
                        }
                        unwrapTickMessage(payload).forEach((tick) => mergeTick(pairId, tick));
                    } catch {
                        /* ignore */
                    }
                };

                manager.on('message', onMessage);
                manager.on('channel:trades', onMessage);
                manager.connect();
                managersRef.current.push(manager);
            });
        };

        if (pendingSubscribe.length > 0) {
            subscribeIndiaPairIds(pendingSubscribe)
                .then(() => {
                    pendingSubscribe.forEach((id) => subscribedPairIdsGlobal.add(id));
                    connectSockets();
                })
                .catch(() => {
                    connectSockets();
                });
        } else {
            connectSockets();
        }

        return () => {
            cancelled = true;
            managersRef.current.forEach((manager) => {
                try {
                    manager.disconnect();
                } catch {
                    /* ignore */
                }
            });
            managersRef.current = [];
        };
    }, [enabled, baseWs, pairKey, mergeTick]);

    const ticks = useMemo(() => Object.values(ticksByPairId), [ticksByPairId]);

    return { ticks, ticksByPairId };
}
