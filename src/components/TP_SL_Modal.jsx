import { useState, useEffect, useMemo, useRef } from 'react';
import '../styles/components/TP_SL_Modal.css';

const TP_SL_Modal = ({ position, isOpen, onClose, onSave, isSaving = false }) => {
  const lastInitKeyRef = useRef('');
  const roundPrice = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Number(n.toFixed(6));
  };
  const parsePositiveOrZero = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  };
  const derivePercentFromPrice = (targetPrice, entryPrice, buySide) => {
    if (!Number.isFinite(targetPrice) || targetPrice <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
    const move = buySide ? targetPrice - entryPrice : entryPrice - targetPrice;
    return Number(((move / entryPrice) * 100).toFixed(4));
  };
  const derivePriceFromPercent = (percentValue, entryPrice, buySide, kind) => {
    if (!Number.isFinite(percentValue) || percentValue < 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) return 0;
    const ratio = percentValue / 100;
    if (buySide) {
      return kind === 'tp' ? entryPrice * (1 + ratio) : entryPrice * (1 - ratio);
    }
    return kind === 'tp' ? entryPrice * (1 - ratio) : entryPrice * (1 + ratio);
  };
  const calcMetrics = (targetPrice, enabled, entryPrice, qty, buySide, notionalExposure) => {
    if (!enabled || !Number.isFinite(targetPrice) || targetPrice <= 0 || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      return { price: 0, pnlUsd: 0, pnlPercent: 0, points: 0 };
    }
    const points = buySide ? targetPrice - entryPrice : entryPrice - targetPrice;
    const directionalPct = points / entryPrice;
    const exposure = Number.isFinite(notionalExposure) && notionalExposure > 0
      ? notionalExposure
      : (Number.isFinite(qty) && qty > 0 ? qty * entryPrice : 0);
    const pnlUsd = directionalPct * exposure;
    const pnlPercent = (points / entryPrice) * 100;
    return {
      price: targetPrice,
      pnlUsd,
      pnlPercent,
      points,
    };
  };

  const [stopLossEnabled, setStopLossEnabled] = useState(true);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(true);
  const [trailingStopEnabled, setTrailingStopEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState(Number(position?.sl || 0));
  const [takeProfit, setTakeProfit] = useState(Number(position?.tp || 0));
  const [stopLossMode, setStopLossMode] = useState('price');
  const [takeProfitMode, setTakeProfitMode] = useState('price');
  const [stopLossPercent, setStopLossPercent] = useState(0);
  const [takeProfitPercent, setTakeProfitPercent] = useState(0);
  const [triggerPriceType, setTriggerPriceType] = useState('mark');
  const [executionPolicy, setExecutionPolicy] = useState('market');
  const [reduceOnly, setReduceOnly] = useState(true);
  const [closeOnTrigger, setCloseOnTrigger] = useState(true);
  const [slippagePercent, setSlippagePercent] = useState(0.2);
  const liquidationPrice = Number(position?.liquidityPrice ?? position?.raw?.liquidityPrice ?? 0);
  const openPrice = Number(position?.openPrice || 0);
  const currentPrice = Number(position?.currentPrice || position?.openPrice || 0);
  const volume = Number(
    position?.quantityForPnl ??
    position?.quantity ??
    position?.volume ??
    position?.lotsize ??
    position?.lotSize ??
    position?.amount ??
    position?.raw?.quantity ??
    position?.raw?.qty ??
    position?.raw?.size ??
    position?.raw?.volume ??
    position?.raw?.lotsize ??
    position?.raw?.lot_size ??
    position?.raw?.lotSize ??
    position?.raw?.amount ??
    0
  );
  const side = position?.side || 'Buy';
  const isBuy = String(side).toLowerCase() === 'buy';
  const marketKey = String(position?.raw?.market ?? position?.marketTag ?? position?.market ?? '').toLowerCase();
  const sizeLabel = marketKey.includes('crypto') ? 'Quantity' : 'Lot size';
  const quoteLabel = String(position?.quote || position?.raw?.quote || 'USD').toUpperCase();
  const usedMargin = Number(
    position?.usedMargin ??
    position?.raw?.usedmargin ??
    position?.raw?.usedMargin ??
    0
  );
  const leverage = Number(position?.leverage ?? position?.raw?.leverage ?? 0);
  const notionalExposure = useMemo(() => {
    if (usedMargin > 0 && leverage > 0) return usedMargin * leverage;
    if (openPrice > 0 && volume > 0) return openPrice * volume;
    return 0;
  }, [usedMargin, leverage, openPrice, volume]);
  const effectivePnlQty = useMemo(() => {
    if (notionalExposure > 0 && openPrice > 0) return notionalExposure / openPrice;
    return volume;
  }, [notionalExposure, openPrice, volume]);
  const ruleHint = useMemo(() => {
    if (isBuy) return 'Buy rule: TP should be above entry price, SL should be below entry price.';
    return 'Sell rule: TP should be below entry price, SL should be above entry price.';
  }, [isBuy]);

  useEffect(() => {
    if (!isOpen || !position) return;
    const positionKey =
      String(position?.id ?? position?.orderno ?? position?.orderNo ?? position?.raw?.orderno ?? 'no-id');
    const initKey = `${positionKey}|${isOpen ? 'open' : 'closed'}`;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;

    const defaultSL = position.sl || 0;
    const defaultTP = position.tp || 0;
    const normalizedSL = roundPrice(defaultSL);
    const normalizedTP = roundPrice(defaultTP);
    setStopLoss(normalizedSL);
    setTakeProfit(normalizedTP);
    setStopLossPercent(Math.abs(derivePercentFromPrice(normalizedSL, openPrice, isBuy)));
    setTakeProfitPercent(Math.abs(derivePercentFromPrice(normalizedTP, openPrice, isBuy)));
    setStopLossEnabled(position.sl !== null && position.sl !== undefined);
    setTakeProfitEnabled(position.tp !== null && position.tp !== undefined);
    setTrailingStopEnabled(false);
    setStopLossMode('price');
    setTakeProfitMode('price');
    setTriggerPriceType('mark');
    setExecutionPolicy('market');
    setReduceOnly(true);
    setCloseOnTrigger(true);
    setSlippagePercent(0.2);
  }, [isOpen, position, openPrice, isBuy]);

  useEffect(() => {
    if (!isOpen) {
      lastInitKeyRef.current = '';
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const applyStopLossFromPercent = (percentValue) => {
    const pct = parsePositiveOrZero(percentValue);
    setStopLossPercent(pct);
    const derivedPrice = derivePriceFromPercent(pct, openPrice, isBuy, 'sl');
    setStopLoss(roundPrice(derivedPrice));
  };

  const applyTakeProfitFromPercent = (percentValue) => {
    const pct = parsePositiveOrZero(percentValue);
    setTakeProfitPercent(pct);
    const derivedPrice = derivePriceFromPercent(pct, openPrice, isBuy, 'tp');
    setTakeProfit(roundPrice(derivedPrice));
  };

  const applyStopLossFromPrice = (priceValue) => {
    const normalized = roundPrice(parsePositiveOrZero(priceValue));
    setStopLoss(normalized);
    setStopLossPercent(Math.abs(derivePercentFromPrice(normalized, openPrice, isBuy)));
  };

  const applyTakeProfitFromPrice = (priceValue) => {
    const normalized = roundPrice(parsePositiveOrZero(priceValue));
    setTakeProfit(normalized);
    setTakeProfitPercent(Math.abs(derivePercentFromPrice(normalized, openPrice, isBuy)));
  };

  const handleSave = () => {
    onSave({
      id: position.id,
      sl: stopLossEnabled ? roundPrice(stopLoss) : null,
      tp: takeProfitEnabled ? roundPrice(takeProfit) : null,
      trailingStop: trailingStopEnabled,
      type: position.market,
      orderno: position?.raw?.orderno || position?.orderno || position?.raw?.orderNo || position?.orderNo || '',
      tpSlConfig: {
        triggerPriceType,
        executionPolicy,
        reduceOnly,
        closeOnTrigger,
        slippagePercent: Number(slippagePercent) || 0,
        stopLossMode,
        takeProfitMode,
      },
    });
  };

  const stopLossMetrics = calcMetrics(stopLoss, stopLossEnabled, openPrice, volume, isBuy, notionalExposure);
  const takeProfitMetrics = calcMetrics(takeProfit, takeProfitEnabled, openPrice, volume, isBuy, notionalExposure);
  const combinedPreview = {
    tp: takeProfitEnabled ? takeProfitMetrics.pnlUsd : 0,
    sl: stopLossEnabled ? stopLossMetrics.pnlUsd : 0,
  };

  if (!isOpen) return null;

  return (
    <div className="tpslModalOverlay" onClick={onClose}>
      <div
        className="tpslModal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpsl-modal-title"
      >
        <div className="tpslModalHeader">
          <div className="tpslModalHeaderContent">
            <h3 id="tpsl-modal-title" className="tpslModalTitle">Stop Loss & Take Profit</h3>
            <p className="tpslModalSubtitle">{position?.symbol || 'Position'}</p>
          </div>
          <button className="tpslModalClose" onClick={onClose} aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6L18 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="tpslModalContent">
          <div className="tpslInfoCard">
            <div className="tpslInfoRow">
              <span>Side</span>
              <strong className={`tpslInfoSide ${isBuy ? 'is-buy' : 'is-sell'}`}>{side}</strong>
            </div>
            <div className="tpslInfoRow">
              <span>Entry Price</span>
              <strong>{openPrice > 0 ? openPrice.toFixed(4) : '—'}</strong>
            </div>
            <div className="tpslInfoRow">
              <span>Current Price</span>
              <strong>{currentPrice > 0 ? currentPrice.toFixed(4) : '—'}</strong>
            </div>
            <div className="tpslInfoRow">
              <span>Square Off Price</span>
              <strong>{liquidationPrice > 0 ? liquidationPrice.toFixed(4) : '—'}</strong>
            </div>
            <div className="tpslInfoRow">
              <span>{sizeLabel}</span>
              <strong>{volume > 0 ? volume : '—'}</strong>
            </div>
            {/* <div className="tpslInfoRow">
              <span>PnL Exposure</span>
              <strong>{notionalExposure > 0 ? `${notionalExposure.toFixed(4)} ${quoteLabel}` : '—'}</strong>
            </div>
            <div className="tpslInfoRow">
              <span>Effective Qty (PnL)</span>
              <strong>{effectivePnlQty > 0 ? effectivePnlQty.toFixed(6) : '—'}</strong>
            </div> */}
            <p className="tpslRuleHint">{ruleHint}</p>
          </div>

          {/* <div className="tpslPreviewCard">
            <div className="tpslPreviewTitle">Realtime TP/SL Preview</div>
            <div className="tpslPreviewGrid">
              <div className="tpslPreviewItem">
                <span>Take Profit</span>
                <strong className="metricPositive">
                  {takeProfitEnabled ? `${combinedPreview.tp >= 0 ? '+' : ''}${combinedPreview.tp.toFixed(2)} ${quoteLabel}` : '—'}
                </strong>
              </div>
              <div className="tpslPreviewItem">
                <span>Stop Loss</span>
                <strong className="metricNegative">
                  {stopLossEnabled ? `${combinedPreview.sl >= 0 ? '+' : ''}${combinedPreview.sl.toFixed(2)} ${quoteLabel}` : '—'}
                </strong>
              </div>
            </div>
          </div> */}

          <div className="tpslSection">
            <div className="tpslSectionHeader">
              <label className="tpslToggleLabel">
                <input
                  type="checkbox"
                  className="tpslToggleInput"
                  checked={stopLossEnabled}
                  onChange={(e) => setStopLossEnabled(e.target.checked)}
                />
                <span className="tpslToggleSwitch"></span>
                <span className="tpslSectionTitle">Stop Loss</span>
              </label>
            </div>

            {stopLossEnabled && (
              <>
                <div className="tpslInputContainer">
                  <div className="tpslModeSwitch">
                    <button
                      type="button"
                      className={`tpslModeBtn ${stopLossMode === 'price' ? 'active' : ''}`}
                      onClick={() => setStopLossMode('price')}
                    >
                      Price
                    </button>
                    <button
                      type="button"
                      className={`tpslModeBtn ${stopLossMode === 'percent' ? 'active' : ''}`}
                      onClick={() => setStopLossMode('percent')}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    className="tpslInput"
                    value={stopLossMode === 'price' ? stopLoss : stopLossPercent}
                    onChange={(e) =>
                      stopLossMode === 'price'
                        ? applyStopLossFromPrice(e.target.value)
                        : applyStopLossFromPercent(e.target.value)
                    }
                    disabled={!stopLossEnabled}
                    step="0.01"
                    min="0"
                  />
                  <span className="tpslInputSuffix">{stopLossMode === 'price' ? quoteLabel : '%'}</span>
                </div>

                <div className="tpslMetrics">
                  <div className="tpslMetric">
                    <span className="metricNegative">
                      PnL: {stopLossMetrics.pnlUsd.toFixed(2)} {quoteLabel}
                    </span>
                  </div>
                  <div className="tpslMetric">
                    <span className="metricNegative">
                      {stopLossMetrics.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="tpslMetric">
                    <span className="metricNegative">
                      Move: {Math.abs(stopLossMetrics.points).toFixed(6)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* <div className="tpslSection">
            <div className="tpslSectionHeader">
              <label className="tpslCheckboxLabel">
                <input
                  type="checkbox"
                  className="tpslCheckbox"
                  checked={trailingStopEnabled}
                  onChange={(e) => setTrailingStopEnabled(e.target.checked)}
                />
                <span className="tpslSectionTitle">Trailing Stop</span>
              </label>
              <button className="tpslInfoBtn" title="Trailing Stop Information">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16V12M12 8H12.01" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div> */}

          <div className="tpslSection">
            <div className="tpslSectionHeader">
              <label className="tpslToggleLabel">
                <input
                  type="checkbox"
                  className="tpslToggleInput"
                  checked={takeProfitEnabled}
                  onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                />
                <span className="tpslToggleSwitch"></span>
                <span className="tpslSectionTitle">Take Profit</span>
              </label>
            </div>

            {takeProfitEnabled && (
              <>
                <div className="tpslInputContainer">
                  <div className="tpslModeSwitch">
                    <button
                      type="button"
                      className={`tpslModeBtn ${takeProfitMode === 'price' ? 'active' : ''}`}
                      onClick={() => setTakeProfitMode('price')}
                    >
                      Price
                    </button>
                    <button
                      type="button"
                      className={`tpslModeBtn ${takeProfitMode === 'percent' ? 'active' : ''}`}
                      onClick={() => setTakeProfitMode('percent')}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    className="tpslInput"
                    value={takeProfitMode === 'price' ? takeProfit : takeProfitPercent}
                    onChange={(e) =>
                      takeProfitMode === 'price'
                        ? applyTakeProfitFromPrice(e.target.value)
                        : applyTakeProfitFromPercent(e.target.value)
                    }
                    disabled={!takeProfitEnabled}
                    step="0.01"
                    min="0"
                  />
                  <span className="tpslInputSuffix">{takeProfitMode === 'price' ? quoteLabel : '%'}</span>
                </div>

                <div className="tpslMetrics">
                  <div className="tpslMetric">
                    <span className="metricPositive">
                      PnL: {takeProfitMetrics.pnlUsd.toFixed(2)} {quoteLabel}
                    </span>
                  </div>
                  <div className="tpslMetric">
                    <span className="metricPositive">
                      {takeProfitMetrics.pnlPercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="tpslMetric">
                    <span className="metricPositive">
                      Move: {Math.abs(takeProfitMetrics.points).toFixed(6)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* <div className="tpslSection tpslSection--advanced">
            <div className="tpslSectionHeader">
              <span className="tpslSectionTitle">Advanced Exchange Settings</span>
            </div>
            <div className="tpslAdvancedGrid">
              <label className="tpslAdvancedField">
                <span>Trigger Price</span>
                <select value={triggerPriceType} onChange={(e) => setTriggerPriceType(e.target.value)}>
                  <option value="mark">Mark Price</option>
                  <option value="last">Last Price</option>
                  <option value="index">Index Price</option>
                </select>
              </label>
              <label className="tpslAdvancedField">
                <span>Execution</span>
                <select value={executionPolicy} onChange={(e) => setExecutionPolicy(e.target.value)}>
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </label>
              <label className="tpslAdvancedField">
                <span>Slippage Tolerance %</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={slippagePercent}
                  onChange={(e) => setSlippagePercent(parsePositiveOrZero(e.target.value))}
                />
              </label>
            </div>
            <div className="tpslAdvancedToggles">
              <label className="tpslCheckboxLabel">
                <input
                  type="checkbox"
                  className="tpslCheckbox"
                  checked={reduceOnly}
                  onChange={(e) => setReduceOnly(e.target.checked)}
                />
                <span>Reduce only</span>
              </label>
              <label className="tpslCheckboxLabel">
                <input
                  type="checkbox"
                  className="tpslCheckbox"
                  checked={closeOnTrigger}
                  onChange={(e) => setCloseOnTrigger(e.target.checked)}
                />
                <span>Close on trigger</span>
              </label>
            </div>
          </div> */}
        </div>

        <div className="tpslModalFooter">
          <button className="tpslBtn tpslBtnCancel" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="tpslBtn tpslBtnSave"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TP_SL_Modal;

