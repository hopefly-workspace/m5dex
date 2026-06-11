import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import '../styles/components/TradingBar.css';
import { formatLargeNumber, formatDynamic, formatPrice as formatPriceUtil, getSafeNumber, formatOptionSymbol } from '../utils/helper';
import { msToDate } from '../utils/formatTime';
import { useAuth } from '../hooks/useAuth';
import { addFavourite, removeFavourite, normalizeSymbol, itemKey } from '../services/favouritesWishlistApi';
import PriceTicker from './PriceTicker';

const FLASH_DURATION_MS = 600;

const MARKET_TYPE_LABELS = {
  crypto: 'Crypto',
  forex: 'Forex',
  india: 'Indian',
};

const getPriceNum = (d) => Number(d?.price ?? d?.p ?? d?.index ?? d?.last ?? 0) || 0;
const getChangeNum = (d) => getSafeNumber(d?.change24h ?? d?.change);
const getBidNum = (d) => Number(d?.bid ?? d?.price ?? 0) || 0;
const getAskNum = (d) => Number(d?.ask ?? d?.price ?? 0) || 0;
const isValidPrice = (value) => {
  if (value == null || value === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

const TradingBar = ({
  selectedPair: propSelectedPair,
  pairDisplay,
  exchangeLabel,
  onPairChange,
  currentMarketData,
  isConnecting,
  marketType: propMarketType = 'crypto',
  favoritesSidebarOpen = false,
  onFavoritesSidebarToggle,
  favouritesList = [],
  favouritesLoading = false,
  refreshFavourites = () => { },
}) => {
  const { isAuthenticated } = useAuth();
  const [selectedPair, setSelectedPair] = useState(propSelectedPair || 'BTCUSDT');
  const [togglingKey, setTogglingKey] = useState(null);
  const [flashingKeys, setFlashingKeys] = useState(new Set());
  const prevDataRef = useRef(null);
  const flashTimeoutRef = useRef(null);

  const marketType = (propMarketType || 'crypto').toLowerCase().trim();
  const isCrypto = marketType === 'crypto';
  const isForex = marketType === 'forex';
  const isIndia = marketType === 'india';
  const indexPriceValue =
    currentMarketData?.price ??
    currentMarketData?.p ??
    currentMarketData?.indexPrice ??
    currentMarketData?.index ??
    currentMarketData?.last;

  useEffect(() => {
    if (!currentMarketData) {
      prevDataRef.current = null;
      return () => {
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      };
    }
    const prev = prevDataRef.current;
    const next = currentMarketData;
    const keysToCheck = [
      'price',
      'bid',
      'ask',
      'change24h',
      'indexPrice',
      'mark',
      'high24h',
      'low24h',
      'volume24h',
      'fundingRate',
    ];
    const changed = new Set();
    if (!prev) {
      prevDataRef.current = {
        price: getPriceNum(next),
        bid: getBidNum(next),
        ask: getAskNum(next),
        change24h: getChangeNum(next),
        indexPrice: getPriceNum(next),
        mark: Number(next?.mark) || 0,
        high24h: Number(next?.high24h ?? next?.high) || 0,
        low24h: Number(next?.low24h ?? next?.low) || 0,
        volume24h: Number(next?.volume24h ?? next?.tick_volume) || 0,
        fundingRate: getSafeNumber(next?.fundingRate),
      };
      return;
    }
    const priceNum = getPriceNum(next);
    if (priceNum && priceNum !== prev.price) changed.add('price');
    const bidNum = getBidNum(next);
    if (bidNum && bidNum !== prev.bid) changed.add('bid');
    const askNum = getAskNum(next);
    if (askNum && askNum !== prev.ask) changed.add('ask');
    const changeNum = getChangeNum(next);
    if (changeNum !== prev.change24h) changed.add('change24h');
    const idxPrice = getPriceNum(next);
    if (idxPrice && idxPrice !== prev.indexPrice) changed.add('indexPrice');
    const markNum = Number(next?.mark) || 0;
    if (markNum && markNum !== prev.mark) changed.add('mark');
    const highNum = Number(next?.high24h ?? next?.high) || 0;
    if (highNum && highNum !== prev.high24h) changed.add('high24h');
    const lowNum = Number(next?.low24h ?? next?.low) || 0;
    if (lowNum && lowNum !== prev.low24h) changed.add('low24h');
    const volNum = Number(next?.volume24h ?? next?.tick_volume) || 0;
    if (volNum !== prev.volume24h) changed.add('volume24h');
    const fundNum = getSafeNumber(next?.fundingRate);
    if (fundNum !== prev.fundingRate) changed.add('fundingRate');

    prevDataRef.current = {
      price: priceNum,
      bid: bidNum,
      ask: askNum,
      change24h: changeNum,
      indexPrice: idxPrice,
      mark: markNum,
      high24h: highNum,
      low24h: lowNum,
      volume24h: volNum,
      fundingRate: fundNum,
    };

    if (changed.size > 0) {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setFlashingKeys(changed);
      flashTimeoutRef.current = setTimeout(() => {
        setFlashingKeys(new Set());
        flashTimeoutRef.current = null;
      }, FLASH_DURATION_MS);
    }
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, [currentMarketData]);

  useEffect(() => {
    if (propSelectedPair && propSelectedPair !== selectedPair) {
      setSelectedPair(propSelectedPair);
    }
  }, [propSelectedPair]);

  const currentKey = useMemo(
    () => itemKey(normalizeSymbol(selectedPair), propMarketType),
    [selectedPair, propMarketType]
  );
  const isFavorite = useMemo(
    () => favouritesList.some((item) => itemKey(normalizeSymbol(item.name), item.type) === currentKey),
    [favouritesList, currentKey]
  );

  const handleToggleFavorite = useCallback(async () => {
    if (!isAuthenticated) return;
    const sym = normalizeSymbol(selectedPair);
    const type = propMarketType || 'crypto';
    const key = itemKey(sym, type);
    setTogglingKey(key);
    try {
      if (isFavorite) {
        await removeFavourite(sym, type);
      } else {
        await addFavourite(sym, type);
      }
      await refreshFavourites();
    } catch {
      // keep list as is on error
    } finally {
      setTogglingKey(null);
    }
  }, [isAuthenticated, selectedPair, propMarketType, isFavorite, refreshFavourites]);

  const indiaLtp = Number(currentMarketData?.ltp ?? currentMarketData?.price ?? currentMarketData?.last ?? 0) || 0;
  const indiaBid = Number(currentMarketData?.bid ?? 0) || 0;
  const indiaAsk = Number(currentMarketData?.ask ?? 0) || 0;
  const indiaOpen = Number(currentMarketData?.open ?? 0) || 0;
  const indiaClose = Number(currentMarketData?.close ?? 0) || 0;
  const indiaHigh = Number(currentMarketData?.high ?? currentMarketData?.high24h ?? 0) || 0;
  const indiaLow = Number(currentMarketData?.low ?? currentMarketData?.low24h ?? 0) || 0;
  const indiaChange = Number(currentMarketData?.change ?? 0) || 0;
  const indiaChangePct = getSafeNumber(currentMarketData?.change_pct ?? currentMarketData?.change24h);
  const indiaVolume = Number(currentMarketData?.volume ?? currentMarketData?.volume24h ?? 0) || 0;

  return (
    <div className="tradingBar">
      <div className="tradingBarContent">
        <div className="tradingBarLeft">
          {/* <div className="coinIcon">
            {currentData.icon}
          </div> */}
          <div className="pairInfo">
            <div className="pairNameRow">
              <button
                type="button"
                className={`pairNameButton ${favoritesSidebarOpen ? 'pairNameButton--sidebarOpen' : ''}`}
                onClick={() => onFavoritesSidebarToggle?.()}
                aria-expanded={favoritesSidebarOpen}
                aria-controls="dashboard-favorites-sidebar"
              > {
                  isIndia ? (
                    <span className="pairName">{formatOptionSymbol(selectedPair)}</span>
                  ) : (
                    <span className="pairName">{pairDisplay || selectedPair}</span>
                  )
                }
                {/* {isIndia && exchangeLabel ? (
                  <span className="pairExchangeBadge" title="Exchange">
                    {exchangeLabel}
                  </span>
                ) : null} */}
                <span className="pairMarketTypeBadge" title={MARKET_TYPE_LABELS[marketType] || marketType}>
                  {MARKET_TYPE_LABELS[marketType] || marketType}
                </span>
                <svg className="dropdownIcon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* <button
                className={`favoriteButton ${isFavorite ? 'active' : ''}`}
                onClick={handleToggleFavorite}
                disabled={!!togglingKey}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <svg fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button> */}
            </div>
          </div>
        </div>

        <div className="tradingDataContainer">
          <div className="tradingDataContent">
            {isIndia ? (
              <>
                <div className="tradingDataItem">
                  <div className="dataLabel">LTP</div>
                  <div className={`dataValue priceValue ${flashingKeys.has('price') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaLtp)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Bid</div>
                  <div className={`dataValue bidValue ${flashingKeys.has('bid') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaBid)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Ask</div>
                  <div className={`dataValue askValue ${flashingKeys.has('ask') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaAsk)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Open</div>
                  <div className="dataValue">
                    {formatPriceUtil(indiaOpen)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Close</div>
                  <div className="dataValue">
                    {formatPriceUtil(indiaClose)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">High</div>
                  <div className={`dataValue ${flashingKeys.has('high24h') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaHigh)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Low</div>
                  <div className={`dataValue ${flashingKeys.has('low24h') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaLow)}
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Change</div>
                  <div className={`dataValue ${indiaChange >= 0 ? 'positive' : 'negative'} ${flashingKeys.has('change24h') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaChange)}₹
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Change</div>
                  <div className={`dataValue ${indiaChangePct >= 0 ? 'positive' : 'negative'} ${flashingKeys.has('change24h') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaChangePct)}%
                  </div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">Volume</div>
                  <div className={`dataValue ${flashingKeys.has('volume24h') ? 'valueFlash' : ''}`}>
                    {formatPriceUtil(indiaVolume)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="tradingDataItem priceItem">
                  <PriceTicker
                    price={currentMarketData?.price ?? currentMarketData?.p ?? currentMarketData?.index ?? currentMarketData?.last ?? 0}
                    previousPrice={prevDataRef.current?.price}
                    change24h={currentMarketData?.change24h ?? currentMarketData?.change ?? 0}
                    changePercent24h={currentMarketData?.change_pct ?? currentMarketData?.change24h ?? 0}
                    marketType={marketType}
                  />
                </div>
                {isForex && (
                  <>
                    <div className="tradingDataItem">
                      <div className="dataLabel">Bid</div>
                      <div className={`dataValue bidValue ${flashingKeys.has('bid') ? 'valueFlash' : ''}`}>
                        {formatPriceUtil(currentMarketData?.bid ?? currentMarketData?.price)}
                      </div>
                    </div>
                    <div className="tradingDataItem">
                      <div className="dataLabel">Ask</div>
                      <div className={`dataValue askValue ${flashingKeys.has('ask') ? 'valueFlash' : ''}`}>{isValidPrice(currentMarketData?.ask ?? currentMarketData?.price) ? currentMarketData?.ask ?? currentMarketData?.price : '--'}</div>
                    </div>
                    <div className="tradingDataItem">
                      <div className="dataLabel">Spread</div>
                      <div className={`dataValue ${flashingKeys.has('bid') || flashingKeys.has('ask') ? 'valueFlash' : ''}`}>
                        {
                          isValidPrice((Number(currentMarketData?.ask) || Number(currentMarketData?.price) || 0) - (Number(currentMarketData?.bid) || Number(currentMarketData?.price) || 0)) ?
                            formatPriceUtil((Number(currentMarketData?.ask) || Number(currentMarketData?.price) || 0) - (Number(currentMarketData?.bid) || Number(currentMarketData?.price) || 0), { marketType, prefix: '' }) :
                            '--'
                        }
                      </div>
                    </div>
                  </>
                )}
                {(isCrypto || isIndia) && (
                  <div className="tradingDataItem">
                    <div className="dataLabel">Index Price</div>
                    <div className={`dataValue ${flashingKeys.has('indexPrice') ? 'valueFlash' : ''}`}>
                      {formatPriceUtil(indexPriceValue)}
                    </div>
                  </div>
                )}
                {isCrypto && (
                  <>
                    <div className="tradingDataItem">
                      <div className="dataLabel">Fair Price</div>
                      <div className={`dataValue ${flashingKeys.has('mark') ? 'valueFlash' : ''}`}>{isValidPrice(currentMarketData?.mark) ? currentMarketData?.mark : '--'}</div>
                    </div>
                    {/* <div className="tradingDataItem">
                      <div className="dataLabel">Funding Rate</div>
                      <div className={`dataValue ${flashingKeys.has('fundingRate') ? 'valueFlash' : ''}`}>
                        <span className={getSafeNumber(currentMarketData?.fundingRate) >= 0 ? 'positive' : 'negative'}>
                          {getSafeNumber(currentMarketData?.fundingRate) >= 0 ? '+' : ''}{formatDynamic(currentMarketData?.fundingRate)}%
                        </span>
                        <span className="fundingTimer">
                          {currentMarketData?.nextFundingTime ? msToDate(currentMarketData.nextFundingTime) : '—'}
                        </span>
                      </div>
                    </div> */}
                  </>
                )}
                <div className="tradingDataItem">
                  <div className="dataLabel">24h High</div>
                  <div className={`dataValue ${flashingKeys.has('high24h') ? 'valueFlash' : ''}`}>{isValidPrice(currentMarketData?.high24h || currentMarketData?.high) ? currentMarketData?.high24h || currentMarketData?.high : '--'}</div>
                </div>
                <div className="tradingDataItem">
                  <div className="dataLabel">24h Low</div>
                  <div className={`dataValue ${flashingKeys.has('low24h') ? 'valueFlash' : ''}`}>{isValidPrice(currentMarketData?.low24h || currentMarketData?.low) ? currentMarketData?.low24h || currentMarketData?.low : '--'}</div>
                </div>
                {isCrypto && (
                  <div className="tradingDataItem">
                    <div className="dataLabel">24h Volume</div>
                    <div className={`dataValue ${flashingKeys.has('volume24h') ? 'valueFlash' : ''}`}>
                      {isValidPrice(currentMarketData?.volume24h || currentMarketData?.tick_volume) ? currentMarketData?.volume24h || currentMarketData?.tick_volume : '--'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingBar;

