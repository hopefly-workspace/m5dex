import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  BarSeries,
  ColorType,
} from "lightweight-charts";
import "../styles/components/BinanceChart.css";
import { useTheme } from "../contexts/ThemeContext";
import { AreaChart, BarChart2, CandlestickChart, ChevronDown, LineChart, Maximize, Minimize2 } from "lucide-react";
import { getNum, formatPrice } from "../utils/helper";
import { formatMmSsFromMs } from "../utils/formatTime";
import { normalizeSymbol } from "../services/favouritesWishlistApi";

/** Theme colors by isDark – same as design-system so chart updates immediately on toggle (no refresh) */
const CHART_THEME = {
  dark: {
    layoutBackground: "#0A0E17",
    textColor: "#FFFFFF",
    gridColor: "rgba(255, 255, 255, 0.05)",
    chartBull: "#26A69A",
    chartBear: "#EF5350",
    linePrimary: "#0066FF",
    lineTopColor: "rgba(0, 102, 255, 0.4)",
    lineBottomColor: "rgba(0, 102, 255, 0)",
  },
  light: {
    layoutBackground: "#FFFFFF",
    textColor: "#0F172A",
    gridColor: "rgba(0, 0, 0, 0.05)",
    chartBull: "#059669",
    chartBear: "#DC2626",
    linePrimary: "#0066FF",
    lineTopColor: "rgba(0, 102, 255, 0.25)",
    lineBottomColor: "rgba(0, 102, 255, 0)",
  },
};

function getChartThemeColors(isDark) {
  return CHART_THEME[isDark ? "dark" : "light"];
}

const DEFAULT_SYMBOL = "BTCUSDT";
const EXCHANGE = "Binance";

const normalizePair = (p) => normalizeSymbol(p) || DEFAULT_SYMBOL;

const INTERVALS = {
  Seconds: ["1s"],
  Minutes: ["1m", "3m", "5m", "15m", "30m"],
  Hours: ["1h", "2h", "4h", "6h", "8h", "12h"],
  Days: ["1d", "3d"],
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

const emptyTopBar = {
  open: null,
  high: null,
  low: null,
  close: null,
  change: null,
  percent: null,
  isUp: true,
};

export default function BinanceChart({ pair: pairProp = DEFAULT_SYMBOL, marketData, marketType = 'crypto' }) {
  const { isDark } = useTheme();
  const symbol = normalizePair(pairProp);
  const marketDataMatches = marketData && normalizePair(marketData.symbol || marketData.pair || marketData.id || "") === symbol;
  const livePrice = marketDataMatches ? getNum(marketData.price ?? marketData.p ?? marketData.last ?? marketData.index) : null;
  const liveHigh = marketDataMatches ? getNum(marketData.high24h ?? marketData.high) : null;
  const liveLow = marketDataMatches ? getNum(marketData.low24h ?? marketData.low) : null;
  const liveChange = marketDataMatches ? getNum(marketData.change24h, 0) : null;
  const prevPrice = livePrice != null && liveChange != null ? livePrice - liveChange : null;
  const liveChangePct = marketDataMatches && prevPrice != null && prevPrice !== 0 && liveChange != null
    ? (liveChange / prevPrice) * 100
    : null;
  const isDarkRef = useRef(isDark);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const wsRef = useRef(null);
  const priceLineRef = useRef(null);
  const hasSeriesRef = useRef(false);

  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  const [interval, setInterval] = useState("1m");
  const [chartType, setChartType] = useState("candlestick");
  const [history, setHistory] = useState([]);
  const [showIntervalMenu, setShowIntervalMenu] = useState(false);

  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [topBar, setTopBar] = useState(emptyTopBar);

  const [position, setPosition] = useState({ x: 15, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const savedTimeRangeRef = useRef(null);

  const handleMouseDown = (e) => {
    // Prevent dragging if clicking buttons/dropdowns
    if (e.target.tagName === 'BUTTON' || e.target.closest('.dropdown-menu-left')) return;

    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  // const toggleFullScreen = () => {
  //   const elem = document.querySelector(".chart-wrapper");

  //   if (!document.fullscreenElement) {
  //     elem.requestFullscreen().catch((err) => {
  //       console.error(`Error attempting to enable full-screen mode: ${err.message}`);
  //     });
  //     setIsFullScreen(true);
  //   } else {
  //     document.exitFullscreen();
  //     setIsFullScreen(false);
  //   }
  // };

  const toggleFullScreen = () => {
    const elem = document.querySelector(".chart-wrapper");

    if (!document.fullscreenElement) {
      // Save current visible time range before entering fullscreen
      if (chartRef.current) {
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleLogicalRange();
        if (visibleRange) {
          savedTimeRangeRef.current = {
            from: visibleRange.from,
            to: visibleRange.to,
          };
        }
      }

      elem.requestFullscreen().then(() => {
        // Wait for fullscreen transition to complete
        setTimeout(() => {
          if (chartRef.current && containerRef.current && elem) {
            // Get actual fullscreen dimensions
            const fullscreenWidth = window.innerWidth;
            const fullscreenHeight = window.innerHeight;
            const topBarHeight = 40;
            const chartHeight = fullscreenHeight - topBarHeight;
            
            // Resize chart to fit fullscreen properly
            chartRef.current.resize(fullscreenWidth, chartHeight);
            
            // Restore visible range if we had one
            if (savedTimeRangeRef.current) {
              const timeScale = chartRef.current.timeScale();
              timeScale.setVisibleLogicalRange(savedTimeRangeRef.current);
            } else {
              chartRef.current.timeScale().fitContent();
            }
            
            // Apply right space for better view
            requestAnimationFrame(() => {
              if (chartRef.current) {
                const timeScale = chartRef.current.timeScale();
                const range = timeScale.getVisibleLogicalRange();
                if (range) {
                  timeScale.setVisibleLogicalRange({
                    from: range.from,
                    to: range.to + 35,
                  });
                }
              }
            });
          }
        }, 200);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // Handle fullscreen changes (including ESC key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!document.fullscreenElement;
      setIsFullScreen(isFullscreen);

      if (isFullscreen) {
        // Entering fullscreen - resize to fullscreen dimensions
        setTimeout(() => {
          if (chartRef.current && containerRef.current) {
            const fullscreenWidth = window.innerWidth;
            const fullscreenHeight = window.innerHeight;
            const topBarHeight = 40;
            const chartHeight = fullscreenHeight - topBarHeight;
            
            if (fullscreenWidth > 0 && chartHeight > 0) {
              chartRef.current.resize(fullscreenWidth, chartHeight);
              
              // Restore visible range if we had one saved
              if (savedTimeRangeRef.current) {
                const timeScale = chartRef.current.timeScale();
                timeScale.setVisibleLogicalRange(savedTimeRangeRef.current);
              } else {
                chartRef.current.timeScale().fitContent();
              }
              
              // Apply right space
              requestAnimationFrame(() => {
                if (chartRef.current) {
                  const timeScale = chartRef.current.timeScale();
                  const range = timeScale.getVisibleLogicalRange();
                  if (range) {
                    timeScale.setVisibleLogicalRange({
                      from: range.from,
                      to: range.to + 35,
                    });
                  }
                }
              });
            }
          }
        }, 100);
      } else {
        // Exiting fullscreen - restore chart size and view
        setTimeout(() => {
          if (chartRef.current && containerRef.current) {
            const width = containerRef.current.clientWidth;
            const height = containerRef.current.clientHeight;
            
            if (width > 0 && height > 0) {
              chartRef.current.resize(width, height);
              
              // Restore the visible time range if we had one saved
              if (savedTimeRangeRef.current) {
                const timeScale = chartRef.current.timeScale();
                timeScale.setVisibleLogicalRange(savedTimeRangeRef.current);
                // Apply right space adjustment
                requestAnimationFrame(() => {
                  const range = timeScale.getVisibleLogicalRange();
                  if (range) {
                    timeScale.setVisibleLogicalRange({
                      from: range.from,
                      to: range.to + 35,
                    });
                  }
                });
              } else {
                // Otherwise fit content
                chartRef.current.timeScale().fitContent();
                // Apply right space for better view
                requestAnimationFrame(() => {
                  if (chartRef.current) {
                    const timeScale = chartRef.current.timeScale();
                    const range = timeScale.getVisibleLogicalRange();
                    if (range) {
                      timeScale.setVisibleLogicalRange({
                        from: range.from,
                        to: range.to + 35,
                      });
                    }
                  }
                });
              }
            }
          }
        }, 100);
      }
    };

    // Handle window resize in fullscreen
    const handleFullscreenResize = () => {
      if (document.fullscreenElement && chartRef.current) {
        const fullscreenWidth = window.innerWidth;
        const fullscreenHeight = window.innerHeight;
        const topBarHeight = 40;
        const chartHeight = fullscreenHeight - topBarHeight;
        
        if (fullscreenWidth > 0 && chartHeight > 0) {
          chartRef.current.resize(fullscreenWidth, chartHeight);
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("resize", handleFullscreenResize);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleFullscreenResize);
    };
  }, []);


  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const handleResize = () => {
      // Don't resize if we're in fullscreen (handled by fullscreen handler)
      if (document.fullscreenElement) return;
      
      if (chartRef.current && containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        if (width > 0 && height > 0) {
          chartRef.current.resize(width, height);
          // Apply right space for better view
          requestAnimationFrame(() => {
            if (chartRef.current) {
              const timeScale = chartRef.current.timeScale();
              const range = timeScale.getVisibleLogicalRange();
              if (range) {
                timeScale.setVisibleLogicalRange({
                  from: range.from,
                  to: range.to + 35,
                });
              }
            }
          });
        }
      }
    };

    // Initial resize
    handleResize();

    // Use ResizeObserver for better performance
    let resizeObserver;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        // Debounce resize to avoid too many calls
        clearTimeout(resizeObserver.timeoutId);
        resizeObserver.timeoutId = setTimeout(handleResize, 100);
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      if (resizeObserver) {
        if (resizeObserver.timeoutId) {
          clearTimeout(resizeObserver.timeoutId);
        }
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const fetchHistory = async () => {
    // ---future development
    // if (interval === "1s") return history;
    // const res = await fetch(
    //   `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${interval}&limit=300`
    // );

    // const data = await res.json();
    // const formatted = data.map((k) => ({
    //   time: k[0] / 1000,
    //   open: +k[1],
    //   high: +k[2],
    //   low: +k[3],
    //   close: +k[4],
    //   value: +k[4],
    // }));
    // setHistory(formatted);
    // return formatted;
  };

  const applyRightSpace = () => {
    if (!chartRef.current) return;

    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;

    timeScale.setVisibleLogicalRange({
      from: range.from,
      to: range.to + 35,
    });
  };

  const createSeries = () => {
    if (!chartRef.current) return;

    // safe remove existing series
    if (hasSeriesRef.current && seriesRef.current) {
      try {
        chartRef.current.removeSeries(seriesRef.current);
      } catch (e) {
        console.warn("Series already removed");
      }
      seriesRef.current = null;
      hasSeriesRef.current = false;
    }

    const theme = getChartThemeColors(isDark);
    const baseOpts = { lastValueVisible: false, priceLineVisible: false };

    if (chartType === "line") {
      seriesRef.current = chartRef.current.addSeries(LineSeries, {
        ...baseOpts,
        color: theme.linePrimary,
      });
    } else if (chartType === "area") {
      seriesRef.current = chartRef.current.addSeries(AreaSeries, {
        ...baseOpts,
        lineColor: theme.linePrimary,
        topColor: theme.lineTopColor,
        bottomColor: theme.lineBottomColor,
      });
    } else if (chartType === "bar") {
      seriesRef.current = chartRef.current.addSeries(BarSeries, {
        ...baseOpts,
        upColor: theme.chartBull,
        downColor: theme.chartBear,
      });
    } else {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        ...baseOpts,
        upColor: theme.chartBull,
        downColor: theme.chartBear,
        wickUpColor: theme.chartBull,
        wickDownColor: theme.chartBear,
        borderUpColor: theme.chartBull,
        borderDownColor: theme.chartBear,
      });
    }

    seriesRef.current.setData([]);
    hasSeriesRef.current = true;

    chartRef.current.timeScale().fitContent();
    requestAnimationFrame(applyRightSpace);
  };


  const connectWS = () => {
    wsRef.current?.close();

    wsRef.current = new WebSocket(
      `wss://froxchart.blockcryp.com/ws/chart/${symbol}/${interval}`
    );

    wsRef.current.onmessage = (e) => {
      if (!seriesRef.current) return;
      const k = JSON.parse(e.data);

      const open = +k.open;
      const close = +k.close;
      const high = +k.high;
      const low = +k.low;

      const change = close - open;
      const percent = open ? (change / open) * 100 : 0;
      const isUp = close >= open;

      setTopBar({
        open,
        high,
        low,
        close,
        change,
        percent,
        isUp,
      });

      seriesRef.current.update({
        time: Number(k.time),
        open,
        high,
        low,
        close,
        value: close,
      });

      const duration = INTERVAL_DURATION[k.interval];
      const remainingMs = Math.max(
        0,
        k.time * 1000 + duration * 1000 - k.eventTime
      );

      if (priceLineRef.current) {
        seriesRef.current.removePriceLine(priceLineRef.current);
      }

      const theme = getChartThemeColors(isDarkRef.current);
      priceLineRef.current = seriesRef.current.createPriceLine({
        price: close,
        color: isUp ? theme.chartBull : theme.chartBear,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: false,
      });

      updateCustomAxisLabel(
        close,
        formatMmSsFromMs(remainingMs),
        isUp ? "#26a69a" : "#ef5350"
      );
    };

    wsRef.current.onerror = (err) => {
      console.error("WebSocket error", err);
    };
  };


  const updateCustomAxisLabel = (price, time, color) => {
    let el = document.getElementById('custom-axis-label');
    if (!el) {
      el = document.createElement('div');
      el.id = 'custom-axis-label';
      document.querySelector('.tv-lightweight-charts').appendChild(el);
    }

    const coordinate = seriesRef.current.priceToCoordinate(price);

    if (coordinate !== null) {
      el.style.display = 'flex';
      el.style.top = `${coordinate - 20}px`;
      el.style.backgroundColor = color;
      el.innerHTML = `
            <div style="font-size: 13px; font-weight: bold;">${formatPrice(price, { marketType, prefix: '$' })}</div>
            <div style="font-size: 11px; margin-top: -2px;">${time}</div>
        `;
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || container.offsetWidth || 800;
    const height = container.clientHeight || container.offsetHeight || 500;

    const theme = getChartThemeColors(isDark);
    chartRef.current = createChart(container, {
      width: width,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: theme.layoutBackground },
        textColor: theme.textColor,
      },
      grid: {
        vertLines: { color: theme.gridColor },
        horzLines: { color: theme.gridColor },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: interval === "1s",

        rightBarStaysOnScroll: true,
        fixLeftEdge: true,
        fixRightEdge: false,

        rightOffset: 10,
        barSpacing: 6,
        lockVisibleTimeRangeOnResize: true,

        tickMarkFormatter: (time, tickMarkType, locale) => {
          const date = new Date(time * 1000);

          if (interval === "1s") {
            return date.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
          }

          if (interval.includes("m")) {
            return date.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
            });
          }

          if (interval.includes("h")) {
            return date.toLocaleString(locale, {
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
          }

          return date.toLocaleDateString(locale, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });
        },
      },

    });

    return () => {
      wsRef.current?.close();
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, []);

  /* Apply theme when light/dark changes – no refresh needed */
  useEffect(() => {
    if (!chartRef.current) return;
    const theme = getChartThemeColors(isDark);
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: theme.layoutBackground },
        textColor: theme.textColor,
      },
      grid: {
        vertLines: { color: theme.gridColor },
        horzLines: { color: theme.gridColor },
      },
    });
    /* Recreate series so line/candle/bar colors use new theme */
    createSeries([]);
  }, [isDark]);

  // useEffect(() => {
  //   let active = true;

  //   (async () => {
  //     const data = await fetchHistory();
  //     if (!active) return;
  //     createSeries(data);
  //     connectWS();
  //   })();

  //   return () => {
  //     active = false;
  //     wsRef.current?.close();
  //   };
  // }, [interval]);

  useEffect(() => {
    setTopBar(emptyTopBar);
    const labelEl = document.getElementById("custom-axis-label");
    if (labelEl) labelEl.style.display = "none";
    createSeries([]);
    connectWS();
    return () => {
      wsRef.current?.close();
    };
  }, [interval, chartType, symbol]);

  // useEffect(() => {
  //   if (history.length) createSeries(history);
  // }, [chartType]);

  return (
    <div className="chart-wrapper">
      <div ref={containerRef} className="chart-container" />

      <div className="top-trade-bar">
        <div className="pair">
          {symbol.replace(/USDT$/, " / USDT").replace(/USD$/, " / USD")} · {interval} · {EXCHANGE}
        </div>

        <div className="ohlc">
          {(() => {
            const useLive = livePrice != null;
            const o = useLive ? livePrice : topBar.open;
            const h = useLive ? (liveHigh ?? livePrice) : topBar.high;
            const l = useLive ? (liveLow ?? livePrice) : topBar.low;
            const c = useLive ? livePrice : topBar.close;
            const isUp = useLive ? (liveChange != null ? liveChange >= 0 : true) : topBar.isUp;
            const fmt = (n) => (n != null ? formatPrice(n, { marketType }) : "—");
            return (
              <>
                O <span style={{ color: isUp ? "var(--color-success)" : "var(--color-danger)" }}>{fmt(o)}</span>
                H <span style={{ color: isUp ? "var(--color-success)" : "var(--color-danger)" }}>{fmt(h)}</span>
                L <span style={{ color: isUp ? "var(--color-success)" : "var(--color-danger)" }}>{fmt(l)}</span>
                C <span style={{ color: isUp ? "var(--color-success)" : "var(--color-danger)" }}>{fmt(c)}</span>
              </>
            );
          })()}
        </div>

        <div className="perf" style={{ color: (liveChange != null ? liveChange >= 0 : topBar.isUp) ? "var(--color-success)" : "var(--color-danger)" }}>
          {liveChange != null && liveChangePct != null
            ? `${liveChange >= 0 ? "+" : ""}${liveChange.toFixed(2)} (${liveChangePct >= 0 ? "+" : ""}${liveChangePct.toFixed(2)}%)`
            : topBar.change != null
              ? `${topBar.change >= 0 ? "+" : ""}${topBar.change?.toFixed(2)} (${topBar.percent != null ? (topBar.percent >= 0 ? "+" : "") + topBar.percent.toFixed(2) : "—"}%)`
              : "—"}
        </div>

        <div style={{ flex: 1 }} />

        <button
          className="fullscreen-btn"
          onClick={toggleFullScreen}
          title="Toggle Fullscreen"
        >
          {isFullScreen ? (
            <Minimize2 size={18} strokeWidth={2.5} />
          ) : (
            <Maximize size={18} strokeWidth={2.5} />
          )}
        </button>

      </div>

      <div className="toolbar left"
        onMouseDown={handleMouseDown}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'absolute'
        }}

      >
        <button className="dropdown-btn" onClick={() => {
          setShowTypeMenu((p) => !p);
          showIntervalMenu && setShowIntervalMenu(false);
        }}>
          {chartType === "candlestick" && <CandlestickChart size={16} />}
          {chartType === "line" && <LineChart size={16} />}
          {chartType === "area" && <AreaChart size={16} />}
          {chartType === "bar" && <BarChart2 size={16} />}
          <ChevronDown size={14} style={{ marginLeft: '4px', opacity: 0.7 }} />
        </button>

        {showTypeMenu && (
          <div className="dropdown-menu-left chart-type-dropdown">
            <div className="group-title">Chart Type</div>
            <div className="type-list">
              <button className={chartType === "candlestick" ? "active" : ""}
                onClick={() => { setChartType("candlestick"); setShowTypeMenu(false); }}>
                <CandlestickChart size={16} /> Candlestick
              </button>

              <button className={chartType === "line" ? "active" : ""}
                onClick={() => { setChartType("line"); setShowTypeMenu(false); }}>
                <LineChart size={16} /> Line
              </button>

              <button className={chartType === "area" ? "active" : ""}
                onClick={() => { setChartType("area"); setShowTypeMenu(false); }}>
                <AreaChart size={16} /> Area
              </button>

              <button className={chartType === "bar" ? "active" : ""}
                onClick={() => { setChartType("bar"); setShowTypeMenu(false); }}>
                <BarChart2 size={16} /> Bars
              </button>
            </div>
          </div>
        )}

        <div className="interval-wrapper" style={{ position: 'relative', marginLeft: '5px', borderLeft: '1px solid var(--border-light)', paddingLeft: '5px' }}>
          <button className="dropdown-btn" onClick={() => {
            setShowIntervalMenu((p) => !p)
            showTypeMenu && setShowTypeMenu(false);
          }}>
            ⏱ {interval}
          </button>
          {showIntervalMenu && (
            <div className="dropdown-menu-left">
              {Object.entries(INTERVALS).map(([group, values]) => (
                <div key={group} className="interval-section">
                  <div className="group-title">{group}</div>
                  <div className="group-items">
                    {values.map((v) => (
                      <button key={v} className={interval === v ? "active" : ""} onClick={() => { setInterval(v); setShowIntervalMenu(false); }}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '0 4px', color: 'var(--text-tertiary)', fontSize: '14px', userSelect: 'none' }}>⋮⋮</div>

      </div>
    </div>
  );
}
