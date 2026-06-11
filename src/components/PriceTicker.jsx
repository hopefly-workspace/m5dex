import { useEffect, useMemo, useState } from 'react';
import { formatPrice, formatPriceUtil, isValidPrice } from '../utils/helper';

const formatByMarket = (value, marketType) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';

  const mt = String(marketType || '').toLowerCase().trim();
  let maxDigits = 2;
  if (mt === 'forex') maxDigits = 5;
  if (mt === 'crypto' || mt === 'futures') maxDigits = 8;
  if (mt === 'stocks' || mt === 'spot') maxDigits = 4;

  return n.toLocaleString('en-US', {
    minimumFractionDigits: maxDigits,
    maximumFractionDigits: maxDigits,
  });
};

const PriceTicker = ({
  price,
  previousPrice,
  change24h,
  changePercent24h,
  marketType,
}) => {
  const [flashDir, setFlashDir] = useState('');

  const priceDirection = useMemo(() => {
    const p = Number(price);
    const prevRaw = previousPrice;
    if (prevRaw == null || prevRaw === '') return '';
    const prev = Number(prevRaw);
    if (!Number.isFinite(p) || !Number.isFinite(prev) || p === prev) return '';
    return p > prev ? 'up' : 'down';
  }, [price, previousPrice]);

  /** When no tick yet, color the main price from 24h sign (never default to white). */
  const sign24h = useMemo(() => {
    const pi = Number(changePercent24h);
    if (Number.isFinite(pi) && pi !== 0) return Math.sign(pi);
    const ci = Number(change24h);
    if (Number.isFinite(ci) && ci !== 0) return Math.sign(ci);
    return 0;
  }, [changePercent24h, change24h]);

  useEffect(() => {
    if (!priceDirection) return;
    setFlashDir(priceDirection);
    const t = setTimeout(() => setFlashDir(''), 500);
    return () => clearTimeout(t);
  }, [priceDirection]);

  const pct = Number(changePercent24h) || 0;
  const chg = Number(change24h) || 0;
  const pctText = `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const changeText = `${chg > 0 ? '+' : ''}${formatByMarket(chg, marketType)}`;

  const priceToneClass =
    priceDirection === 'up'
      ? 'priceTickerUp'
      : priceDirection === 'down'
        ? 'priceTickerDown'
        : sign24h > 0
          ? 'priceTickerUp'
          : sign24h < 0
            ? 'priceTickerDown'
            : 'priceTickerNeutral';

  return (
    <div className="priceTicker">
      <div className="priceTickerRow">
        <span
          className={`priceTickerPrice ${priceToneClass} ${flashDir ? `priceTickerFlash priceTickerFlash-${flashDir}` : ''
            }`}
        >
          {formatPriceUtil(price || 0)}
        </span>
        {/* <span
          className={`priceTickerPercent ${pct > 0 ? 'priceTickerUp' : pct < 0 ? 'priceTickerDown' : ''
            }`}
        >
          {isValidPrice(pct) ? `${pct > 0 ? '+' : ''}${pct}%` : ''}
        </span> */}
      </div>
      <div className="priceTickerChange">
        <span>24h:</span>
        <span className={chg > 0 ? 'priceTickerUp' : chg < 0 ? 'priceTickerDown' : ''}>
          {isValidPrice(chg) ? `${chg > 0 ? '+' : ''}${chg}` : ''}$
        </span>
      </div>
    </div>
  );
};

export default PriceTicker;
