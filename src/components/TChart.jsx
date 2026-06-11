import React, { useEffect, useRef, useState } from "react";
import {
    createChart,
    CandlestickSeries,
    LineSeries,
    AreaSeries,
    BarSeries,
    ColorType,
} from "lightweight-charts";

import '../styles/components/TChart.css';


const SYMBOL = "BTCUSDT";

const INTERVALS = {
    Seconds: ["1s"],
    Minutes: ["1m", "5m", "15m", "30m"],
    Hours: ["1h"],
    Days: ["1d"],
    Weeks: ["1w"],
    Months: ["1M"],
};

const INTERVAL_DURATION = {
    "1s": 1,
    "1m": 60,
    "3m": 180,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "2h": 7200,
    "4h": 14400,
    "6h": 21600,
    "8h": 28800,
    "12h": 43200,
    "1d": 86400,
    "3d": 259200,
    "1w": 604800,
    "1M": 2592000,
};

const CHART_TYPES = [
    { id: "candlestick", label: "Candlestick", short: "Candlestick", icon: "🕯️" },
    { id: "line", label: "Line", short: "Line", icon: "📈" },
    { id: "area", label: "Area", short: "Area", icon: "🌊" },
    { id: "bar", label: "Bar", short: "Bar", icon: "📊" },
];

export default function TChart() {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const wsRef = useRef(null);
    const priceLineRef = useRef(null);

    const [interval, setInterval] = useState("1m");
    const [chartType, setChartType] = useState("candlestick");
    const [history, setHistory] = useState([]);

    const [chartMenuOpen, setChartMenuOpen] = useState(false);

    //--
    const [ohlc, setOhlc] = useState(null);
    const [prevClose, setPrevClose] = useState(null);

    const [isDrawingMode, setIsDrawingMode] = useState(false);

    const activeChartType = CHART_TYPES.find(
        (c) => c.id === chartType
    );


    const isManualCloseRef = useRef(false);


    const safeNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };


    const fetchHistory = async () => {
        // for history data, not used currently --
        // if (interval === "1s") return history;
        // const res = await fetch(
        //     `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${interval}&limit=300`
        // );
        // const data = await res.json();
        // const formatted = data.map((k) => ({
        //     time: k[0] / 1000,
        //     open: +k[1],
        //     high: +k[2],
        //     low: +k[3],
        //     close: +k[4],
        //     value: +k[4],
        // }));
        // setHistory(formatted);
        // return formatted;

        // not implemented, return empty array
        return [];

    };

    // const createSeries = (data) => {
    //     if (!chartRef.current) return;
    //     if (seriesRef.current) chartRef.current.removeSeries(seriesRef.current);

    //     const baseOpts = {
    //         lastValueVisible: false,
    //         priceLineVisible: false,
    //     };

    //     if (chartType === "line") {
    //         seriesRef.current = chartRef.current.addSeries(LineSeries, {
    //             ...baseOpts,
    //             color: "#4cafef",
    //             lineWidth: 2,
    //         });
    //     } else if (chartType === "area") {
    //         seriesRef.current = chartRef.current.addSeries(AreaSeries, {
    //             ...baseOpts,
    //             lineColor: "#4cafef",
    //             topColor: "rgba(76,175,239,0.4)",
    //             bottomColor: "rgba(76,175,239,0)",
    //         });
    //     } else if (chartType === "bar") {
    //         seriesRef.current = chartRef.current.addSeries(BarSeries, {
    //             ...baseOpts,
    //             upColor: "#26a69a",
    //             downColor: "#ef5350",
    //         });
    //     } else {
    //         seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
    //             ...baseOpts,
    //             upColor: "#26a69a",
    //             downColor: "#ef5350",
    //             wickUpColor: "#26a69a",
    //             wickDownColor: "#ef5350",
    //             borderUpColor: "#26a69a",
    //             borderDownColor: "#ef5350",
    //         });
    //     }

    //     // seriesRef.current.setData(data);
    //     seriesRef.current.setData(data ?? []);
    //     chartRef.current.timeScale().fitContent();
    // };


    const createSeries = (data = []) => {
        if (!chartRef.current) return;

        // ✅ safely remove old series
        if (seriesRef.current) {
            try {
                chartRef.current.removeSeries(seriesRef.current);
            } catch (e) {
                console.warn("Series already removed");
            }
            seriesRef.current = null;
        }

        priceLineRef.current = null;

        const baseOpts = {
            lastValueVisible: false,
            priceLineVisible: false,
        };

        if (chartType === "line") {
            seriesRef.current = chartRef.current.addSeries(LineSeries, {
                ...baseOpts,
                color: "#4cafef",
                lineWidth: 2,
            });
        } else if (chartType === "area") {
            seriesRef.current = chartRef.current.addSeries(AreaSeries, {
                ...baseOpts,
                lineColor: "#4cafef",
                topColor: "rgba(76,175,239,0.4)",
                bottomColor: "rgba(76,175,239,0)",
            });
        } else if (chartType === "bar") {
            seriesRef.current = chartRef.current.addSeries(BarSeries, {
                ...baseOpts,
                upColor: "#26a69a",
                downColor: "#ef5350",
            });
        } else {
            seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
                ...baseOpts,
                upColor: "#26a69a",
                downColor: "#ef5350",
                wickUpColor: "#26a69a",
                wickDownColor: "#ef5350",
                borderUpColor: "#26a69a",
                borderDownColor: "#ef5350",
            });
        }

        seriesRef.current.setData(data);
        chartRef.current.timeScale().fitContent();
    };




    const connectWS = () => {
        // wsRef.current?.close();

        if (wsRef.current) {
            isManualCloseRef.current = true;
            wsRef.current.close();
        }


        wsRef.current = new WebSocket(
            `ws://206.189.120.57:8020/ws/chart/${SYMBOL}/${interval}`
        );

        wsRef.current.onopen = () => {
            isManualCloseRef.current = false;
        };

        wsRef.current.onmessage = (e) => {

            if (!seriesRef.current) return;

            const d = JSON.parse(e.data);

            const open = Number(d.open);
            const high = Number(d.high);
            const low = Number(d.low);
            const close = Number(d.close);

            //
            setOhlc({
                open,
                high,
                low,
                close,
            });


            const isUp = close >= open;
            const color = isUp ? "#26a69a" : "#ef5350";

            // const candleTime = d.time; // already in seconds
            const candleTime = Math.floor(d.time);



            // Update chart
            // if (chartType === "line" || chartType === "area") {
            //     seriesRef.current.update({
            //         time: candleTime,
            //         value: close,
            //     });
            // }
            const closeValue = safeNumber(d.close);
            const timeValue = safeNumber(d.time);

            if (!timeValue || closeValue === null) return;

            if (chartType === "line" || chartType === "area") {
                seriesRef.current.update({
                    time: timeValue,
                    value: closeValue,
                });
            } else if (chartType === "bar") {
                seriesRef.current.update({
                    time: candleTime,
                    open,
                    high,
                    low,
                    close,
                    color,
                });
            } else {
                seriesRef.current.update({
                    time: candleTime,
                    open,
                    high,
                    low,
                    close,
                });
            }

            // ⏱ Countdown timer
            const duration = INTERVAL_DURATION[d.interval];
            const remainingMs = Math.max(
                0,
                d.time * 1000 + duration * 1000 - d.eventTime
            );

            const timeText = formatMmSsFromMs(remainingMs);

            // Price line
            // if (priceLineRef.current) {
            //     seriesRef.current.removePriceLine(priceLineRef.current);
            // }

            if (priceLineRef.current && seriesRef.current) {
                try {
                    seriesRef.current.removePriceLine(priceLineRef.current);
                } catch { }
                priceLineRef.current = null;
            }

            priceLineRef.current = seriesRef.current.createPriceLine({
                price: close,
                color,
                lineWidth: 2,
                axisLabelVisible: true,
                title: `${close.toFixed(2)} | ${timeText}`,
            });
        };

        wsRef.current.onerror = (err) => {
            if (isManualCloseRef.current) return; // ignore expected error
            console.error("❌ WS Error", err);
        };

        wsRef.current.onclose = () => {
            if (isManualCloseRef.current) return;
            console.warn("🔌 WS Disconnected");
        };

    };

    //-
    useEffect(() => {
        if (!ohlc) return;

        if (prevClose === null) {
            setPrevClose(ohlc.close);
            return;
        }
    }, [ohlc]);

    useEffect(() => {
        chartRef.current = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "#131722" },
                textColor: "#d1d4dc",
            },
            grid: {
                vertLines: { color: "#1f2943" },
                horzLines: { color: "#1f2943" },
            },
            timeScale: { timeVisible: true, secondsVisible: true },
        });

        chartRef.current.subscribeCrosshairMove((param) => {
            if (!param || !param.seriesPrices || !seriesRef.current) return;

            const price = param.seriesPrices.get(seriesRef.current);
            if (!price) return;

            if ("open" in price) {
                setOhlc({
                    open: price.open,
                    high: price.high,
                    low: price.low,
                    close: price.close,
                });
            }
        });


        const resize = () => {
            chartRef.current.applyOptions({
                width: containerRef.current.clientWidth,
                height: containerRef.current.clientHeight,
            });
        };

        window.addEventListener("resize", resize);
        resize();

        return () => {
            window.removeEventListener("resize", resize);
            wsRef.current?.close();
            chartRef.current.remove();
        };
    }, []);

    // for history data change -- not used currently --
    // useEffect(() => {
    //     (async () => {
    //         const data = await fetchHistory();
    //         createSeries(data);
    //         connectWS();
    //     })();
    // }, [interval]);

    useEffect(() => {
        if (!chartRef.current) return;

        // close socket first
        if (wsRef.current) {
            isManualCloseRef.current = true;
            wsRef.current.close();
            wsRef.current = null;
        }

        createSeries([]);
        connectWS();

    }, [interval, chartType]);


    const change = ohlc && prevClose
        ? ohlc.close - prevClose
        : 0;

    const changePct = prevClose
        ? (change / prevClose) * 100
        : 0;

    const isUp = change >= 0;

    // for history data change -- not used currently --
    // useEffect(() => {
    //     if (history.length) createSeries(history);
    // }, [chartType]);

    return (
        <div className="chart-wrapper">

            {/* Top bar (chart type, etc.) */}
            {/* <div className="top-bar">
                <div className="dropdown">
                    <button
                        className="dropdown-btn"
                        onClick={() => setChartMenuOpen((v) => !v)}
                    >
                        <span className="icon">{activeChartType.icon}</span>
                        <span>{activeChartType.short}</span>
                        <span className="caret">▾</span>
                    </button>

                    {chartMenuOpen && (
                        <div className="dropdown-menu">
                            {CHART_TYPES.map((t) => (
                                <div
                                    key={t.id}
                                    className={`dropdown-item ${chartType === t.id ? "active" : ""}`}
                                    onClick={() => {
                                        setChartType(t.id);
                                        setChartMenuOpen(false);
                                    }}
                                >
                                    <span className="icon">{t.icon}</span>
                                    <span>{t.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div> */}
            <div className="top-control-bar">
                <div className="chart-type-group">
                    <div className="dropdown">
                        <button
                            className="dropdown-btn"
                            onClick={() => setChartMenuOpen((v) => !v)}
                        >
                            <span className="icon">{activeChartType.icon}</span>
                            <span>{activeChartType.short}</span>
                            <span className="caret">▾</span>
                        </button>

                        {chartMenuOpen && (
                            <div className="dropdown-menu">
                                {CHART_TYPES.map((t) => (
                                    <div
                                        key={t.id}
                                        className={`dropdown-item ${chartType === t.id ? "active" : ""
                                            }`}
                                        onClick={() => {
                                            setChartType(t.id);
                                            setChartMenuOpen(false);
                                        }}
                                    >
                                        <span className="icon">{t.icon}</span>
                                        <span>{t.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* 🆕 New Main Content Wrapper */}
            <div className="main-chart-content">
                {/* 🆕 Vertical Sidebar Section */}
                <div className="left-sidebar">
                    <button
                        className={`sidebar-item ${isDrawingMode ? 'active' : ''}`}
                        onClick={() => setIsDrawingMode(!isDrawingMode)}
                        title="Trend Line"
                    >
                        {/* SVG icon for Trend Line */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="19" x2="21" y2="5" />
                            <circle cx="3" cy="19" r="1.5" fill="currentColor" />
                            <circle cx="21" cy="5" r="1.5" fill="currentColor" />
                        </svg>
                    </button>

                    {/* You can add more placeholder icons here later */}
                    <button className="sidebar-item" title="Cursor">
                        <span style={{ fontSize: '18px' }}>⊹</span>
                    </button>
                </div>

                {/* Chart area */}
                <div className="chart-area">
                    {ohlc && (
                        <div className="ohlc-bar">
                            {/* <span className="symbol">Bitcoin / U.S. Dollar · {interval}</span> */}
                            <span className="symbol">
                                BTCUSDT · {interval.toUpperCase()} · Bitstamp
                            </span>

                            <span className={isUp ? "up" : "down"}>
                                O {ohlc.open.toFixed(2)}
                            </span>
                            <span className={isUp ? "up" : "down"}>
                                H {ohlc.high.toFixed(2)}
                            </span>
                            <span className={isUp ? "up" : "down"}>
                                L {ohlc.low.toFixed(2)}
                            </span>
                            <span className={isUp ? "up" : "down"}>
                                C {ohlc.close.toFixed(2)}
                            </span>

                            <span className={isUp ? "up" : "down"}>
                                {change.toFixed(2)} ({changePct.toFixed(2)}%)
                            </span>
                        </div>
                    )}

                    <div ref={containerRef} className="chart-container" />
                </div>
            </div>
            {/* ⬇️ Bottom time interval bar */}
            <div className="time-bar">
                {Object.values(INTERVALS).flat().map((v) => (
                    <button
                        key={v}
                        className={interval === v ? "active" : ""}
                        onClick={() => setInterval(v)}
                    >
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );

    // return (
    //     <div className="chart-wrapper">
    //         <div className="top-bar">
    //             {/* Chart type dropdown */}
    //             <div className="dropdown">
    //                 <button
    //                     className="dropdown-btn"
    //                     onClick={() => setChartMenuOpen((v) => !v)}
    //                 >
    //                     <span className="icon">{activeChartType.icon}</span>
    //                     <span>{activeChartType.short}</span>
    //                     <span className="caret">▾</span>
    //                 </button>

    //                 {chartMenuOpen && (
    //                     <div className="dropdown-menu">
    //                         {CHART_TYPES.map((t) => (
    //                             <div
    //                                 key={t.id}
    //                                 className={`dropdown-item ${chartType === t.id ? "active" : ""
    //                                     }`}
    //                                 onClick={() => {
    //                                     setChartType(t.id);
    //                                     setChartMenuOpen(false);
    //                                 }}
    //                             >
    //                                 <span className="icon">{t.icon}</span>
    //                                 <span>{t.label}</span>
    //                             </div>
    //                         ))}
    //                     </div>
    //                 )}
    //             </div>

    //             {/* Interval buttons */}
    //             <div className="intervals">
    //                 {Object.values(INTERVALS).flat().map((v) => (
    //                     <button
    //                         key={v}
    //                         className={interval === v ? "active" : ""}
    //                         onClick={() => setInterval(v)}
    //                     >
    //                         {v}
    //                     </button>
    //                 ))}
    //             </div>
    //         </div>

    //         <div ref={containerRef} className="chart-container" />

    //         {/* <div className="toolbar left">
    //             <button onClick={() => setChartType("candlestick")}>C</button>
    //             <button onClick={() => setChartType("line")}>L</button>
    //             <button onClick={() => setChartType("area")}>A</button>
    //             <button onClick={() => setChartType("bar")}>B</button>
    //         </div> */}

    //         {/* <div className="toolbar right">
    //             {Object.values(INTERVALS).flat().map((v) => (
    //                 <button
    //                     key={v}
    //                     className={interval === v ? "active" : ""}
    //                     onClick={() => setInterval(v)}
    //                 >
    //                     {v}
    //                 </button>
    //             ))}
    //         </div> */}
    //     </div>
    // );
}
