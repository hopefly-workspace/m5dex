import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {

  useOrderListWebSocket,

  ORDER_OPEN_LIST_WS_URL,

} from './useOrderListWebSocket';

import { getOpenOrders } from '../services/tradingApi';

import {

  filterPlatformOrdersForChart,

  chartOrdersListSignature,
  parseOpenOrdersList,

} from '../lib/chartPlatformOrders';

import { tokenStorage } from '../utils/storage';



/**

 * Open positions for the dashboard chart (current pair + market type).

 * Mirrors OrdersPanel: websocket stream + REST fallback when WS has no snapshot.

 */

export function useChartOpenPositions({

  chartSymbol,

  marketType,

  refreshTrigger = 0,

  enabled = true,

}) {

  const active = Boolean(enabled && tokenStorage.hasToken());



  const openOrderWs = useOrderListWebSocket(ORDER_OPEN_LIST_WS_URL, active);

  const [openPositions, setOpenPositions] = useState([]);



  const syncOpenFromApi = useCallback(async () => {

    if (!active) return;

    try {

      const res = await getOpenOrders();

      const list = parseOpenOrdersList(res);

      if (list.length > 0) setOpenPositions(list);

    } catch {

      /* WS is primary when it has data */

    }

  }, [active]);



  useEffect(() => {

    if (!active) {

      setOpenPositions([]);

      return;

    }

    setOpenPositions(openOrderWs.orders);

  }, [active, openOrderWs.orders]);



  useEffect(() => {

    if (!active) return;

    openOrderWs.reconnect();

    syncOpenFromApi();

  }, [active, openOrderWs.reconnect, syncOpenFromApi]);



  useEffect(() => {

    if (!active || !refreshTrigger) return;

    openOrderWs.reconnect();

    syncOpenFromApi();

  }, [refreshTrigger, active, openOrderWs.reconnect, syncOpenFromApi]);



  useEffect(() => {

    if (!active || openOrderWs.hasSnapshot) return;

    const t = setTimeout(() => syncOpenFromApi(), 1200);

    return () => clearTimeout(t);

  }, [active, openOrderWs.hasSnapshot, syncOpenFromApi]);



  const chartOrdersStableRef = useRef([]);
  const chartOrdersSigRef = useRef('');

  const chartOrders = useMemo(() => {
    const next = filterPlatformOrdersForChart(openPositions, chartSymbol, marketType);
    const sig = chartOrdersListSignature(next);
    if (sig === chartOrdersSigRef.current) {
      return chartOrdersStableRef.current;
    }
    chartOrdersSigRef.current = sig;
    chartOrdersStableRef.current = next;
    return next;
  }, [openPositions, chartSymbol, marketType]);



  return {

    chartOrders,

    openPositionCount: openPositions.length,

    reconnect: openOrderWs.reconnect,

    isConnected: openOrderWs.isConnected,

    hasSnapshot: openOrderWs.hasSnapshot,

  };

}


