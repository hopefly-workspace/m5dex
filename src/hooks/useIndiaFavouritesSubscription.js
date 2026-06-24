import { useEffect, useRef, useMemo, useState } from 'react';
import { parseIndiaFavouriteName } from '../services/favouritesWishlistApi';
import { resolveIndiaPairIdForSymbol } from '../services/indiaStockList';
import {
    collectIndiaPairIdsFromLists,
    readIndiaPairIdSessionMap,
    subscribeIndiaPairIds,
    writeIndiaPairIdToSession,
} from '../services/indiaTicksSubscription';

/**
 * Ensure India favourites (and active instrument) are subscribed on the ticks backend
 * so /ws/subscribed broadcasts live bid/ask for Pair List rows on Dashboard.
 */
export function useIndiaFavouritesSubscription({
    enabled = true,
    favouritesList = [],
    extraPairIds = [],
    includeSessionMap = true,
}) {
    const subscribedRef = useRef(new Set());
    const [resolvedPairIdMap, setResolvedPairIdMap] = useState({});
    const extraKey = (extraPairIds || []).map((x) => String(x || '').trim()).filter(Boolean).join(',');
    const favouritesKey = useMemo(
        () =>
            (favouritesList || [])
                .filter((item) => String(item?.type || '').trim().toLowerCase() === 'india')
                .map((item) => {
                    const name = String(item?.name || '').trim();
                    const fullName = String(item?.fullName || '').trim();
                    return `${name}|${fullName}`;
                })
                .sort()
                .join(','),
        [favouritesList],
    );

    useEffect(() => {
        if (!enabled) return undefined;

        let cancelled = false;

        const run = async () => {
            const want = collectIndiaPairIdsFromLists([favouritesList], extraPairIds);
            // const sessionMap = readIndiaPairIdSessionMap();
            // Object.values(sessionMap).forEach((pid) => {
            //     const s = String(pid || '').trim();
            //     if (s) want.add(s);
            // });

            if (includeSessionMap) {
                const sessionMap = readIndiaPairIdSessionMap();
                Object.values(sessionMap).forEach((pid) => {
                    const s = String(pid || '').trim();
                    if (s) want.add(s);
                });
            }

            const sessionMap = includeSessionMap ? readIndiaPairIdSessionMap() : {};

            const toResolve = [];
            for (const item of favouritesList || []) {
                if (String(item?.type || '').trim().toLowerCase() !== 'india') continue;
                const parsed = parseIndiaFavouriteName(item.name || '');
                if (parsed.pairId) {
                    want.add(String(parsed.pairId).trim());
                    continue;
                }
                const sym = String(parsed.symbol || item.name || '').trim();
                if (!sym) continue;
                const fromSession = sessionMap[sym.replace(/[/\-\s_.]/g, '').toUpperCase()];
                if (fromSession) {
                    want.add(String(fromSession).trim());
                    continue;
                }
                toResolve.push(sym);
            }

            const nextResolved = {};
            for (const sym of toResolve) {
                if (cancelled) return;
                const pairId = await resolveIndiaPairIdForSymbol(sym);
                if (!pairId) continue;
                want.add(pairId);
                nextResolved[sym.replace(/[/\-\s_.]/g, '').toUpperCase()] = pairId;
                writeIndiaPairIdToSession(sym, pairId);
            }

            if (!cancelled && Object.keys(nextResolved).length > 0) {
                setResolvedPairIdMap((prev) => ({ ...prev, ...nextResolved }));
            }

            subscribedRef.current.forEach((pid) => {
                if (!want.has(pid)) subscribedRef.current.delete(pid);
            });

            const pending = [...want].filter((pid) => pid && !subscribedRef.current.has(pid));
            if (pending.length === 0 || cancelled) return;

            try {
                await subscribeIndiaPairIds(pending);
                if (cancelled) return;
                pending.forEach((pid) => subscribedRef.current.add(pid));
            } catch {
                /* retry on next favourites update */
            }
        };

        run();
        return () => {
            cancelled = true;
        };
        // }, [enabled, favouritesList, extraKey]);
    }, [enabled, favouritesKey, extraKey, includeSessionMap]);

    return { resolvedPairIdMap };
}