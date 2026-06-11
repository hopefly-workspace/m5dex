const SETTINGS_NAV = [
  { id: 'symbol', label: 'Symbol' },
  { id: 'status', label: 'Status line' },
  { id: 'scales', label: 'Scales and lines' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'trading', label: 'Trading' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'events', label: 'Events' },
]

const CROSSHAIR_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'magnet_ohlc', label: 'Magnet (OHLC)' },
  { id: 'magnet', label: 'Magnet' },
  { id: 'hidden', label: 'Hidden' },
]

const PRICE_MODES = [
  { id: 'normal', label: 'Linear' },
  { id: 'logarithmic', label: 'Log' },
  { id: 'percentage', label: '%' },
]

const PNL_UNITS = [
  { id: 'money', label: 'Money' },
  { id: 'percent', label: 'Percent' },
]

function NavIcon({ id }) {
  const common = { width: 18, height: 18, viewBox: '0 0 18 18', fill: 'none', 'aria-hidden': true }
  switch (id) {
    case 'symbol':
      return (
        <svg {...common}>
          <path d="M4 14V4M4 7l3-2 3 2 4-3v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'status':
      return (
        <svg {...common}>
          <path d="M3 6h12M3 9h8M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'scales':
      return (
        <svg {...common}>
          <path d="M3 15V3M3 15h12" stroke="currentColor" strokeWidth="1.4" />
          <path d="M6 12l3-4 3 2 3-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'canvas':
      return (
        <svg {...common}>
          <path d="M3 14L7 6l4 5 4-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )
    case 'trading':
      return (
        <svg {...common}>
          <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'alerts':
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M9 6v3.5M9 12h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    case 'events':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 7h12M6 3V5M12 3V5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

function SectionTitle({ children }) {
  return <div className="trading-chart__settings-section-title">{children}</div>
}

function FieldHint({ children }) {
  return <p className="trading-chart__settings-hint">{children}</p>
}

function CheckRow({ checked, onChange, label, hint, indent, disabled }) {
  return (
    <label
      className={
        (indent
          ? 'trading-chart__settings-check trading-chart__settings-check--indent'
          : 'trading-chart__settings-check') + (disabled ? ' trading-chart__settings-check--disabled' : '')
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="trading-chart__settings-check-label">{label}</span>
        {hint ? <FieldHint>{hint}</FieldHint> : null}
      </span>
    </label>
  )
}

function PillRow({ options, value, onChange }) {
  return (
    <div className="trading-chart__settings-pills" role="group">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={
            value === o.id
              ? 'trading-chart__settings-pill trading-chart__settings-pill--on'
              : 'trading-chart__settings-pill'
          }
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ChartSettingsModal({
  open,
  activeTab,
  onTabChange,
  draftChartPrefs,
  patchDraftChartPrefs,
  draftChartType,
  setDraftChartType,
  draftTradingPrefs,
  patchDraftTradingPrefs,
  chartTypeOptions,
  symbol,
  intervalLabel,
  onOk,
  onCancel,
  onFitChart,
  onOpenIndicators,
}) {
  if (!open || !draftChartPrefs || !draftTradingPrefs) return null

  const c = draftChartPrefs
  const t = draftTradingPrefs

  let body = null
  switch (activeTab) {
    case 'symbol':
      body = (
        <>
          <SectionTitle>Symbol</SectionTitle>
          <div className="trading-chart__settings-kv">
            <span className="trading-chart__settings-k">Pair</span>
            <span className="trading-chart__settings-v">{symbol}</span>
            <span className="trading-chart__settings-k">Interval</span>
            <span className="trading-chart__settings-v">{intervalLabel}</span>
          </div>
          <FieldHint>
            Change the active interval from the Time toolbar above the chart. Pin or unpin intervals from
            the intervals menu.
          </FieldHint>
          <SectionTitle>Chart type</SectionTitle>
          <PillRow
            options={chartTypeOptions}
            value={draftChartType}
            onChange={setDraftChartType}
          />
          <div className="trading-chart__settings-actions-row">
            <button type="button" className="trading-chart__settings-linkbtn" onClick={onOpenIndicators}>
              Indicators…
            </button>
            <button type="button" className="trading-chart__settings-linkbtn" onClick={onFitChart}>
              Reset chart view
            </button>
          </div>
        </>
      )
      break
    case 'status':
      body = (
        <>
          <SectionTitle>Status line</SectionTitle>
          <FieldHint>Controls the floating readout and scale labels at the last price.</FieldHint>
          <CheckRow
            checked={c.floatingLastPricePill}
            onChange={(v) => patchDraftChartPrefs({ floatingLastPricePill: v })}
            label="Floating price and countdown"
            hint="Price pill and candle timer on the right of the chart."
          />
          <CheckRow
            checked={c.seriesLastValueOnScale}
            onChange={(v) => patchDraftChartPrefs({ seriesLastValueOnScale: v })}
            label="Last value on price scale"
            hint="Native scale label from the chart library (in addition to any custom pill)."
          />
          <CheckRow
            checked={c.seriesPriceLine}
            onChange={(v) => patchDraftChartPrefs({ seriesPriceLine: v })}
            label="Series price line"
            hint="Horizontal line at the latest close."
          />
        </>
      )
      break
    case 'scales':
      body = (
        <>
          <SectionTitle>Grid</SectionTitle>
          <CheckRow
            checked={c.gridVert}
            onChange={(v) => patchDraftChartPrefs({ gridVert: v })}
            label="Vertical grid lines"
          />
          <CheckRow
            checked={c.gridHorz}
            onChange={(v) => patchDraftChartPrefs({ gridHorz: v })}
            label="Horizontal grid lines"
          />

          <SectionTitle>Crosshair</SectionTitle>
          <div className="trading-chart__settings-sub">Mode</div>
          <PillRow
            options={CROSSHAIR_MODES}
            value={c.crosshairMode}
            onChange={(id) => patchDraftChartPrefs({ crosshairMode: id })}
          />
          <CheckRow
            checked={c.crosshairVertVisible}
            onChange={(v) => patchDraftChartPrefs({ crosshairVertVisible: v })}
            label="Vertical crosshair line"
          />
          <CheckRow
            checked={c.crosshairHorzVisible}
            onChange={(v) => patchDraftChartPrefs({ crosshairHorzVisible: v })}
            label="Horizontal crosshair line"
          />
          <CheckRow
            checked={c.crosshairVertLabel}
            onChange={(v) => patchDraftChartPrefs({ crosshairVertLabel: v })}
            label="Time label on crosshair"
          />
          <CheckRow
            checked={c.crosshairHorzLabel}
            onChange={(v) => patchDraftChartPrefs({ crosshairHorzLabel: v })}
            label="Price label on crosshair"
          />

          <SectionTitle>Price scale</SectionTitle>
          <div className="trading-chart__settings-sub">Scale mode</div>
          <PillRow
            options={PRICE_MODES}
            value={c.priceScaleMode}
            onChange={(id) => patchDraftChartPrefs({ priceScaleMode: id })}
          />
          <CheckRow
            checked={c.priceAutoScale}
            onChange={(v) => patchDraftChartPrefs({ priceAutoScale: v })}
            label="Auto scale"
          />
          <CheckRow
            checked={c.invertScale}
            onChange={(v) => patchDraftChartPrefs({ invertScale: v })}
            label="Invert scale"
          />

          <SectionTitle>Volume</SectionTitle>
          <CheckRow
            checked={c.volumeVisible}
            onChange={(v) => patchDraftChartPrefs({ volumeVisible: v })}
            label="Show volume"
          />
        </>
      )
      break
    case 'canvas':
      body = (
        <>
          <SectionTitle>Time scale</SectionTitle>
          <CheckRow
            checked={c.timeScaleVisible}
            onChange={(v) => patchDraftChartPrefs({ timeScaleVisible: v })}
            label="Visible"
          />
          <CheckRow
            checked={c.timeScaleBorder}
            onChange={(v) => patchDraftChartPrefs({ timeScaleBorder: v })}
            label="Border"
          />
          <CheckRow
            checked={c.lockVisibleTimeRangeOnResize}
            onChange={(v) => patchDraftChartPrefs({ lockVisibleTimeRangeOnResize: v })}
            label="Lock visible range on chart resize"
          />
          <CheckRow
            checked={c.fixLeftEdge}
            onChange={(v) => patchDraftChartPrefs({ fixLeftEdge: v })}
            label="Fix left edge"
          />
          <CheckRow
            checked={c.fixRightEdge}
            onChange={(v) => patchDraftChartPrefs({ fixRightEdge: v })}
            label="Fix right edge"
          />
          <CheckRow
            checked={c.rightBarStaysOnScroll}
            onChange={(v) => patchDraftChartPrefs({ rightBarStaysOnScroll: v })}
            label="Stay on the bar while scrolling"
          />

          <SectionTitle>Navigation</SectionTitle>
          <CheckRow
            checked={c.scrollMouseWheel}
            onChange={(v) => patchDraftChartPrefs({ scrollMouseWheel: v })}
            label="Mouse wheel scroll"
          />
          <CheckRow
            checked={c.scrollPressedMouseMove}
            onChange={(v) => patchDraftChartPrefs({ scrollPressedMouseMove: v })}
            label="Drag to scroll"
          />
          <CheckRow
            checked={c.scaleMouseWheel}
            onChange={(v) => patchDraftChartPrefs({ scaleMouseWheel: v })}
            label="Mouse wheel zoom"
          />
          <CheckRow
            checked={c.scalePinch}
            onChange={(v) => patchDraftChartPrefs({ scalePinch: v })}
            label="Pinch zoom"
          />
        </>
      )
      break
    case 'trading':
      body = (
        <>
          <SectionTitle>General</SectionTitle>
          <CheckRow
            checked={t.showOrderTicket}
            onChange={(v) => patchDraftTradingPrefs({ showOrderTicket: v })}
            label="Show order ticket"
            hint="Displays the order panel below the chart (side, qty, TP/SL, place order)."
          />
          <CheckRow
            checked={t.oneClickTrading}
            onChange={(v) => patchDraftTradingPrefs({ oneClickTrading: v })}
            label="One-click trading"
            hint="After dragging TP or SL, changes apply immediately without Confirm / Discard."
          />

          <SectionTitle>Appearance</SectionTitle>
          <CheckRow
            checked={t.showPositionsOnChart}
            onChange={(v) => patchDraftTradingPrefs({ showPositionsOnChart: v })}
            label="Positions and orders on chart"
            hint="Floating position bar, entry chip, TP/SL tags, and bracket rail."
          />
          <CheckRow
            checked={t.reversePositionButton}
            onChange={(v) => patchDraftTradingPrefs({ reversePositionButton: v })}
            label="Reverse position button"
            hint="Adds reverse next to the open position on the chart."
            indent
            disabled={!t.showPositionsOnChart}
          />
          <CheckRow
            checked={t.showEntryChip}
            onChange={(v) => patchDraftTradingPrefs({ showEntryChip: v })}
            label="Show entry chip"
            hint="Quantity and entry price at the active bar."
            indent
            disabled={!t.showPositionsOnChart}
          />
          <CheckRow
            checked={t.showBracketTags}
            onChange={(v) => patchDraftTradingPrefs({ showBracketTags: v })}
            label="Show TP/SL tags"
            hint="Labels next to take-profit and stop-loss lines."
            indent
            disabled={!t.showPositionsOnChart}
          />
          <CheckRow
            checked={t.showPnL}
            onChange={(v) => patchDraftTradingPrefs({ showPnL: v })}
            label="Profit and loss value"
            hint="Unrealized PnL on the position bar and distance hints on brackets."
          />
          <div className="trading-chart__settings-sub trading-chart__settings-sub--indent">Positions</div>
          <div className="trading-chart__settings-inline">
            <span className="trading-chart__settings-inline-label">Unit</span>
            <select
              className="trading-chart__settings-select"
              value={t.pnlPositionUnit}
              onChange={(e) => patchDraftTradingPrefs({ pnlPositionUnit: e.target.value })}
              disabled={!t.showPnL}
            >
              {PNL_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="trading-chart__settings-sub trading-chart__settings-sub--indent">Brackets</div>
          <div className="trading-chart__settings-inline">
            <span className="trading-chart__settings-inline-label">Unit</span>
            <select
              className="trading-chart__settings-select"
              value={t.pnlBracketUnit}
              onChange={(e) => patchDraftTradingPrefs({ pnlBracketUnit: e.target.value })}
              disabled={!t.showPnL}
            >
              {PNL_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )
      break
    case 'alerts':
      body = (
        <>
          <SectionTitle>Alerts</SectionTitle>
          <FieldHint>
            Price and indicator alerts are not connected in this lightweight chart demo. Use the full
            TradingView platform for server-side alerts and notifications.
          </FieldHint>
        </>
      )
      break
    case 'events':
      body = (
        <>
          <SectionTitle>Events</SectionTitle>
          <FieldHint>
            Dividends, splits, and economic events are not shown for this Binance-style feed. They appear on
            TradingView when the data vendor supplies them.
          </FieldHint>
        </>
      )
      break
    default:
      body = null
  }

  return (
    <div className="trading-chart__settings-root setting_chartroot" role="presentation">
      <button type="button" className="trading-chart__modal-scrim" tabIndex={-1} aria-label="Close" onClick={onCancel} />
      <div
        className="trading-chart__settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chart-settings-title"
      >
        <div className="trading-chart__settings-head">
          <h2 id="chart-settings-title" className="trading-chart__settings-title">
            Settings
          </h2>
          <button type="button" className="trading-chart__settings-close" aria-label="Close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="trading-chart__settings-body">
          <nav className="trading-chart__settings-nav" aria-label="Settings sections">
            {SETTINGS_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  activeTab === item.id
                    ? 'trading-chart__settings-nav-item trading-chart__settings-nav-item--active'
                    : 'trading-chart__settings-nav-item'
                }
                onClick={() => onTabChange(item.id)}
              >
                <span className="trading-chart__settings-nav-ico">
                  <NavIcon id={item.id} />
                </span>
                <span className="trading-chart__settings-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="trading-chart__settings-panel">{body}</div>
        </div>
        <div className="trading-chart__settings-foot">
          <div className="trading-chart__settings-template">
            <span className="trading-chart__settings-template-label">Template</span>
            <select className="trading-chart__settings-select" disabled aria-disabled="true" title="Not available in demo">
              <option>Default</option>
            </select>
          </div>
          <div className="trading-chart__settings-foot-btns">
            <button type="button" className="trading-chart__settings-btn trading-chart__settings-btn--ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="trading-chart__settings-btn trading-chart__settings-btn--primary" onClick={onOk}>
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
