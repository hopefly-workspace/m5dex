import { useEffect, useRef, useState, useCallback } from "react";
import {
    createChart,
    CandlestickSeries,
    BarSeries,
    LineSeries,
    AreaSeries,
    BaselineSeries,
} from "lightweight-charts";
import '../styles/components/TradingChart.css';
import { formatMmSsFromSeconds } from '../utils/formatTime';

// Add toolbar state
const DRAWING_TOOLS = [
    { id: 'cursor', label: 'Cursor', icon: '🖱️' },
    { id: 'trendline', label: 'Trend Line', icon: '📈' },
    { id: 'horizontalline', label: 'Horizontal Line', icon: '➖' },
    { id: 'rectangle', label: 'Rectangle', icon: '▭' },
    { id: 'fibonacci', label: 'Fibonacci', icon: '📊' },
];

const INDICATORS = [
    { id: 'sma', label: 'SMA', name: 'Simple Moving Average' },
    { id: 'ema', label: 'EMA', name: 'Exponential Moving Average' },
    { id: 'rsi', label: 'RSI', name: 'Relative Strength Index' },
    { id: 'macd', label: 'MACD', name: 'Moving Average Convergence Divergence' },
    { id: 'bollinger', label: 'Bollinger Bands', name: 'Bollinger Bands' },
];

const INTERVALS = [
    { label: "1m", value: "1m" },
    { label: "5m", value: "5m" },
    { label: "1h", value: "1h" },
    { label: "1d", value: "1d" },
    { label: "1s", value: "1s" },
];

// const WS_BASE_URL = import.meta.env.DEV
//     ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/chart`
//     : "ws://206.189.120.57:8020/ws/chart";

const WS_BASE_URL = "ws://206.189.120.57:8020/ws/chart";

const PAIR = "BTCUSDT";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export default function TradingChart() {
    const legendRef = useRef(null);
    const priceLineRef = useRef(null);
    const chartReadyRef = useRef(false);
    const seriesReadyRef = useRef(false);
    const startPointRef = useRef(null);
    const previewSeriesRef = useRef(null);

    // -----------
    const lastCandleTimeRef = useRef(0);
    const lastReceiveLocalRef = useRef(0);
    const chartTypeRef = useRef("candlestick"); // Track current chart type to avoid stale closure

    // -----------------------------
    const [chartType, setChartType] = useState("candlestick"); //Current chart type

    // Add toolbar state
    const [activeDrawingTool, setActiveDrawingTool] = useState('cursor');
    const [activeIndicators, setActiveIndicators] = useState([]);
    const [showDrawingTools, setShowDrawingTools] = useState(false);
    const [showIndicators, setShowIndicators] = useState(false);

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawings, setDrawings] = useState([]); // Store all drawings
    const drawingModeRef = useRef('cursor');
    const drawingOverlaysRef = useRef([]); // Store drawing overlay objects


    const chartContainerRef = useRef(null); //The <div> where chart is mounted
    const chartRef = useRef(null); //Stores the chart instance
    const candleSeriesRef = useRef(null); //Stores the active chart series
    const volumeSeriesRef = useRef(null); //Stores the volume series
    const socketRef = useRef(null); //Stores WebSocket instance
    const reconnectTimeoutRef = useRef(null); //Stores reconnect setTimeout ID
    const reconnectAttemptsRef = useRef(0); //Tracks retry count
    const isManualCloseRef = useRef(false); //Prevents reconnect when user intentionally closes socket

    const updateQueueRef = useRef([]);
    const isProcessingQueueRef = useRef(false);

    // Store historical candle data for indicators
    const candleDataRef = useRef([]);

    const [interval, setChartInterval] = useState("1m"); //Selected timeframe
    const [connectionStatus, setConnectionStatus] = useState("disconnected"); // disconnected, connecting, connected, error
    const [error, setError] = useState(null);
    // ---------------------------------
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [latestPrice, setLatestPrice] = useState(null);



    const startPreviewLine = (point) => {
        const series = chartRef.current.addLineSeries({
            color: '#64748b',
            lineWidth: 1,
            lineStyle: 2,
            priceLineVisible: false,
            lastValueVisible: false,
        });

        series.setData([
            { time: point.time, value: point.price },
            { time: point.time, value: point.price },
        ]);

        previewSeriesRef.current = series;
    };

    const updatePreview = (point) => {
        if (!previewSeriesRef.current || !startPointRef.current) return;

        previewSeriesRef.current.setData([
            { time: startPointRef.current.time, value: startPointRef.current.price },
            { time: point.time, value: point.price },
        ]);
    };

    const resetDrawing = () => {
        startPointRef.current = null;
        setIsDrawing(false);

        if (previewSeriesRef.current) {
            chartRef.current.removeSeries(previewSeriesRef.current);
            previewSeriesRef.current = null;
        }

        drawingModeRef.current = 'cursor';
        setActiveDrawingTool('cursor');

        chartRef.current.applyOptions({
            handleScroll: true,
            handleScale: true,
        });
    };

    const onDrawPoint = (point) => {
        // Horizontal line (1 click)
        if (drawingModeRef.current === 'horizontalline') {
            addDrawing('horizontalline', [point]);
            resetDrawing();
            return;
        }

        // First click
        if (!startPointRef.current) {
            startPointRef.current = point;
            startPreviewLine(point);
            setIsDrawing(true);
            return;
        }

        // Second click → finalize
        addDrawing(drawingModeRef.current, [
            startPointRef.current,
            point
        ]);

        resetDrawing();
    };

    // Memoized function to avoid re-creation --
    // Process update queue smoothly
    const processUpdateQueue = useCallback(() => {
        if (isProcessingQueueRef.current || !candleSeriesRef.current || updateQueueRef.current.length === 0) {
            return;
        }

        isProcessingQueueRef.current = true;

        // Process all queued updates
        while (updateQueueRef.current.length > 0) {
            const update = updateQueueRef.current.shift();
            if (candleSeriesRef.current && seriesReadyRef.current && update) {
                try {
                    candleSeriesRef.current.update(update);
                } catch (err) {
                    // Only log this error once per second to avoid spam
                    const now = Date.now();
                    if (!window.lastQueueError || now - window.lastQueueError > 1000) {
                        console.error('Queue update error:', err, {
                            updateData: update,
                            chartType: chartTypeRef.current,
                            seriesType: candleSeriesRef.current?.constructor?.name
                        });
                        window.lastQueueError = now;
                    }
                }
            }
        }

        isProcessingQueueRef.current = false;

        // Schedule next batch if queue has items
        if (updateQueueRef.current.length > 0) {
            requestAnimationFrame(processUpdateQueue);
        }
    }, []);

    // Update chartTypeRef whenever chartType state changes
    useEffect(() => {
        chartTypeRef.current = chartType;
    }, [chartType]);

    // Toolbar functions
    const handleDrawingToolClick = (toolId) => {

        startPointRef.current = null;
        previewSeriesRef.current = null;

        setActiveDrawingTool(toolId);
        drawingModeRef.current = toolId;

        if (chartRef.current) {
            // Reset to cursor mode first
            chartRef.current.applyOptions({
                handleScroll: true,
                handleScale: true,
            });

            setIsDrawing(false);

            // Apply drawing tool logic
            switch (toolId) {
                case 'cursor':
                    // Default cursor mode - allow chart interaction
                    drawingModeRef.current = 'cursor';
                    break;
                case 'trendline':
                case 'horizontalline':
                case 'rectangle':
                case 'fibonacci':
                    // Disable chart scrolling when drawing
                    chartRef.current.applyOptions({
                        handleScroll: false,
                        handleScale: false,
                    });
                    break;
            }
        } else {
            console.error('Chart not ready for tool change');
        }
    };

    const handleIndicatorToggle = (indicatorId) => {
        setActiveIndicators(prev => {
            const newIndicators = prev.includes(indicatorId)
                ? prev.filter(id => id !== indicatorId)
                : [...prev, indicatorId];

            // Re-render indicators when they change
            setTimeout(() => renderIndicators(newIndicators), 0);
            return newIndicators;
        });
    };

    // Indicator calculation functions
    const calculateSMA = (data, period) => {
        const sma = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
            sma.push({
                time: data[i].time,
                value: sum / period
            });
        }
        return sma;
    };

    const calculateEMA = (data, period) => {
        const ema = [];
        const multiplier = 2 / (period + 1);

        // First EMA is SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i].close;
        }
        let currentEMA = sum / period;
        ema.push({
            time: data[period - 1].time,
            value: currentEMA
        });

        // Calculate remaining EMAs
        for (let i = period; i < data.length; i++) {
            currentEMA = (data[i].close - currentEMA) * multiplier + currentEMA;
            ema.push({
                time: data[i].time,
                value: currentEMA
            });
        }
        return ema;
    };

    const calculateRSI = (data, period = 14) => {
        const rsi = [];
        const gains = [];
        const losses = [];

        // Calculate price changes
        for (let i = 1; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        // Calculate initial averages
        let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

        for (let i = period; i < data.length; i++) {
            if (i >= period) {
                const rs = avgGain / avgLoss;
                const rsiValue = 100 - (100 / (1 + rs));
                rsi.push({
                    time: data[i].time,
                    value: rsiValue
                });

                // Update averages for next iteration
                avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
                avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
            }
        }
        return rsi;
    };

    // Render indicators on chart
    const renderIndicators = useCallback((indicators = activeIndicators) => {
        if (!chartRef.current || !candleSeriesRef.current) return;

        // Clear existing indicator overlays
        drawingOverlaysRef.current = drawingOverlaysRef.current.filter(overlay => {
            if (overlay.type === 'indicator') {
                try {
                    overlay.object.remove();
                    return false;
                } catch (error) {
                    console.error('Error removing indicator:', error);
                    return false;
                }
            }
            return true;
        });

        // Get current candle data for indicators
        const candleData = candleDataRef.current;

        if (candleData.length < 20) return; // Need minimum data for indicators

        indicators.forEach(indicatorId => {
            try {
                let indicatorData = [];
                let color = '#2563eb';
                let title = '';

                switch (indicatorId) {
                    case 'sma':
                        indicatorData = calculateSMA(candleData, 20);
                        color = '#22c55e';
                        title = 'SMA(20)';
                        break;
                    case 'ema':
                        indicatorData = calculateEMA(candleData, 20);
                        color = '#f59e0b';
                        title = 'EMA(20)';
                        break;
                    case 'rsi':
                        // RSI needs a separate pane
                        const rsiSeries = chartRef.current.addLineSeries({
                            color: '#ef4444',
                            lineWidth: 1,
                            priceLineVisible: false,
                            lastValueVisible: false,
                            title: 'RSI(14)',
                            priceScaleId: 'rsi'
                        });

                        const rsiData = calculateRSI(candleData, 14);
                        rsiSeries.setData(rsiData);

                        // Add RSI scale
                        rsiSeries.priceScale().applyOptions({
                            scaleMargins: {
                                top: 0.8,
                                bottom: 0,
                            },
                        });

                        drawingOverlaysRef.current.push({
                            type: 'indicator',
                            object: rsiSeries
                        });
                        return; // RSI is handled separately

                    default:
                        return;
                }

                if (indicatorData.length > 0) {
                    const indicatorSeries = chartRef.current.addLineSeries({
                        color: color,
                        lineWidth: 1,
                        priceLineVisible: false,
                        lastValueVisible: false,
                        title: title,
                    });

                    indicatorSeries.setData(indicatorData);
                    drawingOverlaysRef.current.push({
                        type: 'indicator',
                        object: indicatorSeries
                    });
                }

            } catch (error) {
                console.error('Error rendering indicator:', indicatorId, error);
            }
        });
    }, [activeIndicators]);

    const addDrawing = (toolType, points) => {
        const newDrawing = {
            id: Date.now(),
            type: toolType,
            points: points,
            color: '#2563eb',
            width: 2
        };

        setDrawings(prev => [...prev, newDrawing]);
    };

    const clearDrawings = () => {
        setDrawings([]);

        // Remove all drawing overlays
        drawingOverlaysRef.current.forEach(overlay => {
            try {
                if (overlay.type === 'priceLine' && overlay.series && overlay.object) {
                    // Remove price line from series
                    overlay.series.removePriceLine(overlay.object);
                } else if (overlay.remove && typeof overlay.remove === 'function') {
                    overlay.remove();
                }
            } catch (error) {
                console.error('Error removing overlay:', error);
            }
        });

        drawingOverlaysRef.current = [];
    };

    // Render drawings on chart
    const renderDrawings = useCallback(() => {
        if (!chartRef.current || !candleSeriesRef.current) return;

        // Clear existing overlays first
        drawingOverlaysRef.current.forEach(overlay => {
            try {
                if (overlay.type === 'priceLine' && overlay.series && overlay.object) {
                    overlay.series.removePriceLine(overlay.object);
                } else if (overlay.remove && typeof overlay.remove === 'function') {
                    overlay.remove();
                }
            } catch (error) {
                console.error('Error removing overlay during re-render:', error);
            }
        });
        drawingOverlaysRef.current = [];

        // Now add all current drawings
        drawings.forEach((drawing, index) => {
            try {
                if (drawing.type === 'horizontalline' && drawing.points.length >= 1) {
                    const priceLine = candleSeriesRef.current.createPriceLine({
                        price: drawing.points[0].price,
                        color: drawing.color,
                        lineWidth: drawing.width,
                        lineStyle: 0, // Solid line
                        axisLabelVisible: true,
                        title: `HL: ${drawing.points[0].price.toFixed(2)}`,
                    });

                    drawingOverlaysRef.current.push({
                        type: 'priceLine',
                        object: priceLine,
                        series: candleSeriesRef.current
                    });
                } else if (drawing.type === 'trendline' && drawing.points.length >= 2) {
                    // Create trend line using line series
                    const lineSeries = chartRef.current.addLineSeries({
                        color: drawing.color,
                        lineWidth: drawing.width,
                        priceLineVisible: false,
                        lastValueVisible: false,
                        crosshairMarkerVisible: false,
                    });

                    const data = [
                        { time: drawing.points[0].time, value: drawing.points[0].price },
                        { time: drawing.points[1].time, value: drawing.points[1].price }
                    ];

                    lineSeries.setData(data);
                    drawingOverlaysRef.current.push({
                        type: 'lineSeries',
                        object: lineSeries
                    });
                }

            } catch (error) {
                console.error('Error rendering drawing:', error, drawing);
            }
        });
    }, [drawings]);

    // Render drawings when they change
    useEffect(() => {
        renderDrawings();
    }, [renderDrawings]);

    // Render indicators when they change
    useEffect(() => {
        if (activeIndicators.length > 0) {
            renderIndicators(activeIndicators);
        }
    }, [activeIndicators, renderIndicators]);

    // ------------------------------- Creates chart series dynamically
    const createSeriesByType = (chart, type) => {
        switch (type) {
            case "line":
                return chart.addSeries(LineSeries, {
                    color: "#22c55e",
                    lineWidth: 2,
                });

            case "area":
                return chart.addSeries(AreaSeries, {
                    lineColor: "#2563eb",
                    topColor: "rgba(37,99,235,0.4)",
                    bottomColor: "rgba(37,99,235,0.0)",
                });

            case "bar":
                return chart.addSeries(BarSeries, {
                    upColor: "#22c55e",
                    downColor: "#ef4444",
                });

            case "baseline":
                return chart.addSeries(BaselineSeries, {
                    baseValue: { type: "price", price: 0 },
                    topLineColor: "#22c55e",
                    bottomLineColor: "#ef4444",
                    topFillColor1: "rgba(34,197,94,0.3)",
                    bottomFillColor1: "rgba(239,68,68,0.3)",
                });

            default:
                return chart.addSeries(CandlestickSeries, {
                    upColor: "#22c55e",
                    downColor: "#ef4444",
                    wickUpColor: "#22c55e",
                    wickDownColor: "#ef4444",
                    borderVisible: false,
                });
        }
    };

    // Initialize chart
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            layout: {
                background: {
                    type: 'solid',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--ark-bg-primary').trim() || '#0B0F17'
                },
                textColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-text-primary').trim() || '#E5E7EB',
            },
            grid: {
                vertLines: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--ark-border').trim() || '#1F2937'
                },
                horzLines: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--ark-border').trim() || '#1F2937'
                },
            },
            crosshair: {
                mode: 0,
                // mode: 1,
                vertLine: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--ark-primary').trim() || '#2563EB',
                    width: 1,
                    labelVisible: true,
                },
                horzLine: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--ark-primary').trim() || '#2563EB',
                    width: 1,
                    labelVisible: true,
                },
            },
            rightPriceScale: {
                borderVisible: true,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-border').trim() || '#64748b',
            },
            timeScale: {
                borderVisible: true,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-border').trim() || '#64748b',
                timeVisible: true,
                shiftVisibleRangeOnNewBar: true,
                barSpacing: 4,
                minBarSpacing: 2,
                rightOffset: 20,
                fixLeftEdge: false,
                fixRightEdge: false,
                tickMarkFormatter: (time, tickType, locale) => {
                    const date = new Date(time * 1000);

                    if (interval && interval.endsWith("s")) {
                        return date.toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                        });
                    }

                    if (interval && interval.endsWith("m")) {
                        return date.toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                    }

                    if (interval && interval.endsWith("h")) {
                        return date.toLocaleTimeString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                    }

                    return date.toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "short",
                    });
                },
            },
        });

        // const candleSeries = chart.addSeries(CandlestickSeries, {
        //     upColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-success').trim() || '#22c55e',
        //     downColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-error').trim() || '#ef4444',
        //     wickUpColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-success').trim() || '#22c55e',
        //     wickDownColor: getComputedStyle(document.documentElement).getPropertyValue('--ark-error').trim() || '#ef4444',
        //     borderVisible: false,
        // });

        const series = createSeriesByType(chart, chartType);

        priceLineRef.current = series.createPriceLine({
            price: 0,
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: 'Last Price',
        });

        // priceLineRef.current = candleSeries.createPriceLine({
        //     price: 0,
        //     color: '#ef4444',
        //     lineWidth: 1,
        //     lineStyle: 2,
        //     axisLabelVisible: true,
        //     title: 'Last Price',
        // });

        chart.priceScale("right").applyOptions({
            scaleMargins: {
                top: 0.05,
                bottom: 0.25,
            },
        });

        // Add volume series on a separate scale
        const volumeSeries = chart.addSeries(BarSeries, {
            priceScaleId: 'volume',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        volumeSeriesRef.current = volumeSeries;

        chartRef.current = chart;
        // candleSeriesRef.current = candleSeries;
        candleSeriesRef.current = series;
        chartReadyRef.current = true;

        const handleResize = () => {
            if (chartContainerRef.current && chart) {
                chart.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight,
                });
            }
        };

        // Use ResizeObserver for better performance
        const resizeObserver = new ResizeObserver(handleResize);
        if (chartContainerRef.current) {
            resizeObserver.observe(chartContainerRef.current);
        }

        window.addEventListener("resize", handleResize);

        return () => {
            // cleanup(); // Clean up drawing event listeners
            window.removeEventListener("resize", handleResize);
            resizeObserver.disconnect();
            if (chart) {
                chart.remove();
            }
        };
    }, []);

    // Handle chart clicks and crosshair movements
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current) return;

        const chart = chartRef.current;

        chart.subscribeClick(param => {
            if (!param.time || !param.seriesPrices) return;
            if (drawingModeRef.current === 'cursor') return;

            const rawPrice = param.seriesPrices.get(candleSeriesRef.current);

            const price =
                typeof rawPrice === 'number'
                    ? rawPrice
                    : rawPrice?.close;

            if (price == null) return;


            onDrawPoint({
                time: param.time,
                price
            });
        });

        chart.subscribeCrosshairMove(param => {
            if (!startPointRef.current || !param.time) return;

            const rawPrice = param.seriesPrices?.get(candleSeriesRef.current);
            const price =
                typeof rawPrice === 'number'
                    ? rawPrice
                    : rawPrice?.close;

            if (price == null) return;

            updatePreview({
                time: param.time,
                price
            });
        });

    }, []);

    // -----------------------------====
    useEffect(() => {
        if (!chartRef.current) return;

        seriesReadyRef.current = false; // Mark series as not ready

        // Clear any pending updates
        updateQueueRef.current = [];

        // remove old series
        if (candleSeriesRef.current) {
            try {
                chartRef.current.removeSeries(candleSeriesRef.current);
            } catch (error) {
                console.warn('Error removing old series:', error);
            }
            candleSeriesRef.current = null;
        }

        // Hide volume for non-candlestick charts
        if (volumeSeriesRef.current) {
            if (chartType === "candlestick" || chartType === "bar") {
                volumeSeriesRef.current.applyOptions({ visible: true });
            } else {
                volumeSeriesRef.current.applyOptions({ visible: false });
            }
        }

        // create new series
        const newSeries = createSeriesByType(chartRef.current, chartType);
        candleSeriesRef.current = newSeries;

        // Mark series as ready after a short delay to ensure it's fully initialized
        setTimeout(() => {
            seriesReadyRef.current = true;
        }, 100);
    }, [chartType]);

    // Update time scale when interval changes
    useEffect(() => {
        if (!chartRef.current || !interval) return;

        const isSecond = interval.endsWith("s");

        // Clear existing candle data when interval changes
        if (candleSeriesRef.current) {
            try {
                candleSeriesRef.current.setData([]);
            } catch (error) {
                console.warn('Error clearing candle data:', error);
            }
        }

        // Clear volume data
        if (volumeSeriesRef.current) {
            try {
                volumeSeriesRef.current.setData([]);
            } catch (error) {
                console.warn('Error clearing volume data:', error);
            }
        }

        // Clear stored candle data for indicators
        candleDataRef.current = [];

        // Reset last candle time
        lastCandleTimeRef.current = 0;

        // Clear update queue
        updateQueueRef.current = [];

        chartRef.current.timeScale().applyOptions({
            timeVisible: true,
            secondsVisible: isSecond,
        });

        chartRef.current.timeScale().fitContent(); //  fitContent:- Adjusts zoom automatically
    }, [interval]);

    // WebSocket connection with reconnection logic
    useEffect(() => {
        if (!chartReadyRef.current || !interval) {
            console.error('Skipping WebSocket connection - chart not ready or no interval');
            return;
        }

        const connectWebSocket = () => {

            // Close existing connection only if we're changing intervals
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                console.error('Closing existing WebSocket connection');
                isManualCloseRef.current = true;
                socketRef.current.close();
                socketRef.current = null;
            }

            // Clear existing candle data when connecting to new interval
            if (candleSeriesRef.current) {
                try {
                    candleSeriesRef.current.setData([]);
                } catch (error) {
                    console.warn('Error clearing candle data:', error);
                }
            }

            // Clear volume data
            if (volumeSeriesRef.current) {
                try {
                    volumeSeriesRef.current.setData([]);
                } catch (error) {
                    console.warn('Error clearing volume data:', error);
                }
            }

            // Clear stored candle data for indicators
            candleDataRef.current = [];

            // Reset last candle time
            lastCandleTimeRef.current = 0;

            // Clear update queue
            updateQueueRef.current = [];

            // Clear reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            setConnectionStatus("connecting");
            setError(null);

            const wsUrl = `${WS_BASE_URL}/${PAIR}/${interval}`;
            const socket = new WebSocket(wsUrl);

            socketRef.current = socket;

            socket.onopen = () => {
                isManualCloseRef.current = false;
                setConnectionStatus("connected");
                reconnectAttemptsRef.current = 0;
                isManualCloseRef.current = false;
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Check if chart and series are fully ready
                    if (!data || !data.time || !candleSeriesRef.current || !chartReadyRef.current || !seriesReadyRef.current) {
                        return;
                    }

                    // Validate time is not an object and is a valid number
                    if (typeof data.time === 'object' || isNaN(Number(data.time)) || !isFinite(Number(data.time))) {
                        console.warn('Invalid time value received:', data.time);
                        return;
                    }

                    const timeValue = Number(data.time);

                    const candle = {
                        time: Math.floor(timeValue),
                        open: Number(data.open || 0),
                        high: Number(data.high || 0),
                        low: Number(data.low || 0),
                        close: Number(data.close || data.currentPrice || 0),
                    };

                    // Detect actual interval from time difference
                    if (lastCandleTimeRef.current > 0) {
                        const diff = candle.time - lastCandleTimeRef.current;
                        const intervalMap = {
                            1: "1s",
                            60: "1m",
                            300: "5m",
                            3600: "1h",
                            86400: "1d"
                        };
                        const detectedInterval = intervalMap[diff];
                        if (detectedInterval && detectedInterval !== interval) {
                            console.warn(`Detected interval mismatch: expected ${interval}, got ${detectedInterval} from diff ${diff}s`);
                            setChartInterval(detectedInterval);
                        }
                    }

                    // Store candle data for indicators (keep last 200 candles)
                    candleDataRef.current.push(candle);
                    if (candleDataRef.current.length > 200) {
                        candleDataRef.current.shift();
                    }

                    // Validate close value
                    if (!candle.close || isNaN(candle.close)) {
                        console.warn('Invalid close value:', candle.close, data);
                        return;
                    }

                    let updateData;

                    if (chartTypeRef.current === "candlestick" || chartTypeRef.current === "bar") {
                        updateData = {
                            time: candle.time,
                            open: candle.open,
                            high: candle.high,
                            low: candle.low,
                            close: candle.close,
                        };
                    } else {
                        // For Line, Area, Baseline - only need time and value
                        updateData = {
                            time: candle.time,
                            value: Number(candle.close),
                        };
                    }

                    // Validate updateData before sending
                    if (!updateData) {
                        console.error('Invalid updateData: null or undefined');
                        return;
                    }

                    // For candlestick/bar, check OHLC values; for others, check value field
                    if (chartTypeRef.current === "candlestick" || chartTypeRef.current === "bar") {
                        if (!updateData.open || !updateData.high || !updateData.low || !updateData.close || isNaN(updateData.close)) {
                            console.error('Invalid candlestick data:', { updateData, candle });
                            return;
                        }
                    } else {
                        if (updateData.value === undefined || updateData.value === null || isNaN(updateData.value)) {
                            console.error('Invalid line/area data:', { updateData, candle });
                            return;
                        }
                    }

                    // Queue update for smooth processing instead of direct update
                    updateQueueRef.current.push(updateData);

                    // Process queue on next frame
                    if (!isProcessingQueueRef.current) {
                        requestAnimationFrame(processUpdateQueue);
                    }

                    // Update volume only for candlestick/bar charts
                    if (volumeSeriesRef.current && (chartTypeRef.current === "candlestick" || chartTypeRef.current === "bar") && data.volume) {
                        const volumeColor = candle.close >= candle.open ? '#22c55e' : '#ef4444';
                        try {
                            volumeSeriesRef.current.update({
                                time: candle.time,
                                value: Number(data.volume),
                                color: volumeColor,
                            });
                        } catch (err) {
                            // Only log volume errors occasionally
                            const now = Date.now();
                            if (!window.lastVolumeError || now - window.lastVolumeError > 5000) {
                                console.warn('Volume update error:', err);
                                window.lastVolumeError = now;
                            }
                        }
                    }

                    // ---------------------
                    // update latest price + timing refs for countdown
                    try {
                        setLatestPrice(candle.close);
                        lastCandleTimeRef.current = candle.time; // server-provided epoch seconds
                        lastReceiveLocalRef.current = Date.now();
                    } catch (err) {
                        // ignore state update errors during unmount
                    }


                    if (legendRef.current) {
                        const change = candle.close - candle.open;
                        const percent = ((change / candle.open) * 100).toFixed(2);

                        legendRef.current.innerHTML = `
    <strong>${PAIR} · ${interval}</strong>
    &nbsp; O ${candle.open.toFixed(2)}
    H ${candle.high.toFixed(2)}
    L ${candle.low.toFixed(2)}
    C ${candle.close.toFixed(2)}
    <span style="color:${change >= 0 ? '#22c55e' : '#ef4444'}">
      ${change.toFixed(2)} (${percent}%)
    </span>
  `;
                    }

                    // Validate candle data
                    if (isNaN(candle.time) || isNaN(candle.open) || isNaN(candle.high) ||
                        isNaN(candle.low) || isNaN(candle.close)) {
                        console.warn('Invalid candle data:', data);
                        return;
                    }

                    // Process queue on next frame
                    if (!isProcessingQueueRef.current) {
                        requestAnimationFrame(processUpdateQueue);
                    }
                } catch (err) {
                    console.error('Error parsing WebSocket message:', err);
                }
            };

            socket.onerror = (err) => {
                console.error('❌ WebSocket error:', err);
                setConnectionStatus("error");
                setError('Connection error');
            };

            socket.onclose = (event) => {
                console.warn('🔌 WebSocket closed:', event.code, event.reason);

                if (!isManualCloseRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    setConnectionStatus("connecting");
                    reconnectAttemptsRef.current++;

                    const delay = Math.min(RECONNECT_DELAY * reconnectAttemptsRef.current, 30000);
                    console.warn(`⏳ Reconnecting in ${delay}ms (Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connectWebSocket();
                    }, delay);
                } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                    setConnectionStatus("error");
                    setError('Max reconnection attempts reached');
                } else {
                    setConnectionStatus("disconnected");
                }
            };
        };

        connectWebSocket();

        return () => {
            // Only close if component is unmounting, not on dependency change
            if (isManualCloseRef.current === false && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.close();
                socketRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            updateQueueRef.current = [];

            // Clear error tracking
            if (typeof window !== 'undefined') {
                delete window.lastSeriesError;
                delete window.lastQueueError;
                delete window.lastVolumeError;
            }
        };
    }, [interval, chartType]);

    useEffect(() => {
        updateQueueRef.current = [];
    }, [chartType]);
    // ---------------------------------

    // Countdown timer for current candle (estimates server time using last candle timestamp)
    useEffect(() => {
        let timer = null;

        const getIntervalSeconds = () => {
            if (!interval) return 60;
            if (interval.endsWith('s')) return Number(interval.slice(0, -1)) || 1;
            if (interval.endsWith('m')) return (Number(interval.slice(0, -1)) || 1) * 60;
            if (interval.endsWith('h')) return (Number(interval.slice(0, -1)) || 1) * 3600;
            if (interval.endsWith('d')) return (Number(interval.slice(0, -1)) || 1) * 86400;
            return 60;
        };

        const intervalSec = getIntervalSeconds();

        const tick = () => {
            try {
                const nowLocal = Date.now();
                const secInCandle = Math.floor(nowLocal / 1000) % intervalSec;
                const rem = (intervalSec - 1) - secInCandle;
                const newRemaining = Math.max(0, rem);
                setRemainingSeconds(Math.floor(newRemaining));
            } catch (err) {
                console.error('Timer tick error:', err);
            }
        };

        // Run tick immediately
        tick();

        // Then run every second
        timer = setInterval(tick, 1000);

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [interval]);

    return (
        <div className={`trading-chart-container ${isDrawing ? 'drawing-active' : ''}`}>
            {/* Main Toolbar */}
            <div className="trading-chart-toolbar">
                {/* Drawing Tools Section */}
                <div className="toolbar-section">
                    <button
                        className="toolbar-dropdown-btn"
                        onClick={() => setShowDrawingTools(!showDrawingTools)}
                    >
                        Drawing Tools ▼
                    </button>
                    {showDrawingTools && (
                        <div className="toolbar-dropdown">
                            {DRAWING_TOOLS.map(tool => (
                                <button
                                    key={tool.id}
                                    className={`toolbar-btn ${activeDrawingTool === tool.id ? 'active' : ''}`}
                                    onClick={() => handleDrawingToolClick(tool.id)}
                                    title={tool.label}
                                >
                                    {tool.icon} {tool.label}
                                </button>
                            ))}
                            <div className="toolbar-separator"></div>
                            <button
                                className="toolbar-btn clear-btn"
                                onClick={clearDrawings}
                                title="Clear All Drawings"
                            >
                                🗑️ Clear All
                            </button>
                            <button
                                className="toolbar-btn test-btn"
                                onClick={() => {
                                    // Test adding a horizontal line at current price
                                    if (latestPrice) {
                                        addDrawing('horizontalline', [{ time: Date.now() / 1000, price: latestPrice }]);
                                    }
                                }}
                                title="Test: Add Horizontal Line"
                            >
                                ➕ Test Line
                            </button>
                        </div>
                    )}
                </div>

                {/* Indicators Section */}
                <div className="toolbar-section">
                    <button
                        className="toolbar-dropdown-btn"
                        onClick={() => setShowIndicators(!showIndicators)}
                    >
                        Indicators ▼
                    </button>
                    {showIndicators && (
                        <div className="toolbar-dropdown">
                            {INDICATORS.map(indicator => (
                                <button
                                    key={indicator.id}
                                    className={`toolbar-btn ${activeIndicators.includes(indicator.id) ? 'active' : ''}`}
                                    onClick={() => handleIndicatorToggle(indicator.id)}
                                    title={indicator.name}
                                >
                                    {indicator.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Time Intervals */}
                <div className="toolbar-section">
                    <div className="trading-chart-intervals">
                        {INTERVALS.map(i => (
                            <button
                                key={i.value}
                                className={`trading-chart-interval-btn ${interval === i.value ? 'active' : ''}`}
                                // onClick={() => setInterval(i.value)}
                                onClick={() => setChartInterval(i.value)}
                                type="button"
                            >
                                {i.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chart Types */}
                <div className="toolbar-section">
                    <div className="chart-type-switcher">
                        {[
                            { label: "Candlestick", value: "candlestick" },
                            { label: "Bar", value: "bar" },
                            { label: "Line", value: "line" },
                            { label: "Area", value: "area" },
                            { label: "Baseline", value: "baseline" },
                        ].map(type => (
                            <button
                                key={type.value}
                                className={`chart-type-btn ${chartType === type.value ? "active" : ""}`}
                                onClick={() => setChartType(type.value)}
                                type="button"
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status */}
                <div className="toolbar-section">
                    <div className="trading-chart-status">
                        <span className={`trading-chart-status-indicator ${connectionStatus}`}></span>
                        <span className="trading-chart-status-text">
                            {connectionStatus === 'connected' && 'Connected'}
                            {connectionStatus === 'connecting' && 'Connecting...'}
                            {connectionStatus === 'error' && 'Connection Error'}
                            {connectionStatus === 'disconnected' && 'Disconnected'}
                        </span>
                        {error && (
                            <span className="trading-chart-error-text" title={error}>
                                ⚠️
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="trading-chart-canvas-wrapper">
                <div ref={legendRef} className="tv-legend" />
                {/* ----------- */}
                <div className="price-timer-label" aria-hidden>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{latestPrice != null ? Number(latestPrice).toFixed(2) : ''}</div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>{formatMmSsFromSeconds(remainingSeconds)}</div>
                </div>
                <div className="trading-chart-canvas" ref={chartContainerRef} />
            </div>
        </div>
    );
}