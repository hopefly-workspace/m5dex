import { useEffect, useRef, useState } from "react";

const WS_BASE_URL = "ws://206.189.120.57:8020/ws/chart";

const useCandleData = ({ interval, symbol, setSeries }) => {
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const candleDataMapRef = useRef(new Map());
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Close existing connection
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        // Clear candle data map
        candleDataMapRef.current.clear();
        reconnectAttemptsRef.current = 0;
        setIsConnected(false);

        const setupWebSocket = () => {
            try {
                // Build WebSocket URL: ws://192.168.100.132:8020/ws/chart/BTCUSDT/1s
                const wsSymbol = symbol ? symbol.toUpperCase() : 'BTC';
                const wsInterval = interval || '1s';
                const wsUrl = `${WS_BASE_URL}/${wsSymbol}USDT/${wsInterval}`;

                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                // Connection timeout
                const connectionTimeout = setTimeout(() => {
                    if (ws.readyState === WebSocket.CONNECTING) {
                        console.warn('⏱️ WebSocket connection timeout');
                        ws.close();
                    }
                }, 10000);

                ws.onopen = () => {
                    clearTimeout(connectionTimeout);
                    reconnectAttemptsRef.current = 0;
                    setIsConnected(true);
                };

                ws.onmessage = (event) => {
                    try {
                        let data;
                        if (typeof event.data === 'string') {
                            data = JSON.parse(event.data);
                        } else {
                            data = event.data;
                        }

                        // Handle the response format:
                        // {
                        //     "time": 1768237812.0,
                        //     "open": 92013.08,
                        //     "high": 92013.09,
                        //     "low": 92013.08,
                        //     "close": 92013.08,
                        //     ...
                        // }
                        if (data && typeof data === 'object' && data.time !== undefined) {
                            // Convert time to integer (Unix timestamp in seconds)
                            const timestamp = Math.floor(parseFloat(data.time));

                            // Validate required fields
                            if (data.open === undefined || data.high === undefined ||
                                data.low === undefined || data.close === undefined) {
                                console.warn('Invalid candle data:', data);
                                return;
                            }

                            const newCandle = {
                                time: timestamp,
                                open: parseFloat(data.open),
                                high: parseFloat(data.high),
                                low: parseFloat(data.low),
                                close: parseFloat(data.close),
                            };

                            // Validate numeric values
                            if (isNaN(newCandle.open) || isNaN(newCandle.high) ||
                                isNaN(newCandle.low) || isNaN(newCandle.close)) {
                                console.warn('Invalid numeric values in candle data:', data);
                                return;
                            }

                            // Store candle in map (updates if same timestamp)
                            candleDataMapRef.current.set(timestamp, newCandle);

                            // Convert map to sorted array
                            const sortedCandles = Array.from(candleDataMapRef.current.values())
                                .sort((a, b) => a.time - b.time);

                            // Update series with all candles
                            setSeries(sortedCandles);
                        } else if (Array.isArray(data)) {
                            // Handle array of candles
                            data.forEach(candle => {
                                if (candle && candle.time !== undefined) {
                                    const timestamp = Math.floor(parseFloat(candle.time));
                                    candleDataMapRef.current.set(timestamp, {
                                        time: timestamp,
                                        open: parseFloat(candle.open),
                                        high: parseFloat(candle.high),
                                        low: parseFloat(candle.low),
                                        close: parseFloat(candle.close),
                                    });
                                }
                            });

                            const sortedCandles = Array.from(candleDataMapRef.current.values())
                                .sort((a, b) => a.time - b.time);

                            setSeries(sortedCandles);
                        } else {
                            console.warn('Unexpected data format:', data);
                        }
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                        console.error('Raw message:', event.data);
                    }
                };

                ws.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    console.error('❌ WebSocket error:', error);
                    setIsConnected(false);
                };

                ws.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    setIsConnected(false);

                    // Auto-reconnect if not normal closure
                    if (event.code !== 1000 && reconnectAttemptsRef.current < 10) {
                        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                        reconnectAttemptsRef.current++;

                        reconnectTimeoutRef.current = setTimeout(() => {
                            setupWebSocket();
                        }, delay);
                    }
                };
            } catch (error) {
                console.error('❌ Error creating WebSocket:', error);
                setIsConnected(false);
            }
        };

        // Start WebSocket connection
        setupWebSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [interval, symbol, setSeries]);

    return { isConnected };
};

export default useCandleData;
