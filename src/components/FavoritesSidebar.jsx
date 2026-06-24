import { useMemo, useCallback } from 'react';
import {
  normalizeSymbol,
  itemKey,
  parseIndiaFavouriteName,
  isForexGroupType,
} from '../services/favouritesWishlistApi';
// import { indiaTickPairId } from '../utils/indiaPairResolve';
import { extractIndiaFavouritePairId } from '../services/indiaTicksSubscription';
import { indiaTickPairId, findIndiaMarketTick } from '../utils/indiaPairResolve';
import {
  formatPrice as formatPriceUtil,
  getSafeNumber,
  formatOptionSymbol,
  getIndiaInstrumentTag,
} from '../utils/helper';
import '../styles/components/FavoritesSidebar.css';

const DEFAULT_PAIR = { name: 'BTCUSDT', type: 'crypto' };

const MARKET_TYPE_LABELS = {
  crypto: 'Crypto',
  forex: 'Forex',
  india: 'India',
};

const groupKeyForType = (t) => {
  const x = String(t || 'crypto').toLowerCase().trim();
  if (isForexGroupType(x)) return 'forex';
  return x;
};

const MARKET_ORDER = ['crypto', 'forex', 'india'];

/** Last / mark price; includes Binance-style `c` and common WS aliases. */
const getPriceNum = (d) =>
  Number(
    d?.price ??
    d?.p ??
    d?.index ??
    d?.last ??
    d?.lastPrice ??
    d?.close ??
    d?.c ??
    d?.ltp ??
    0
  ) || 0;
const getChangeNum = (d) => getSafeNumber(d?.change24h ?? d?.change);

const toPositiveNum = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const firstDefinedRaw = (candidates) => {
  for (const x of candidates) {
    if (x != null && x !== '') return x;
  }
  return undefined;
};

/** Bid / ask from tick; fall back to last (mid) when book not streamed — matches TradingBar / CryptoMarkets. */
const getBidAskPrice = (d, computedMid) => {
  const mid =
    toPositiveNum(computedMid) ??
    (d
      ? toPositiveNum(
        d?.price ??
        d?.p ??
        d?.index ??
        d?.last ??
        d?.lastPrice ??
        d?.close ??
        d?.c ??
        d?.ltp
      )
      : null);
  const rawBid = firstDefinedRaw([
    d?.bid,
    d?.b,
    d?.bidPrice,
    d?.bestBid,
    d?.buyPrice,
    d?.bp,
    d?.buy,
    d?.bb,
  ]);
  const rawAsk = firstDefinedRaw([
    d?.ask,
    d?.a,
    d?.askPrice,
    d?.bestAsk,
    d?.sellPrice,
    d?.ap,
    d?.sell,
    d?.ba,
  ]);
  let bid = toPositiveNum(rawBid);
  let ask = toPositiveNum(rawAsk);
  if (mid != null && mid > 0) {
    if (bid == null) bid = mid;
    if (ask == null) ask = mid;
  }
  return {
    bid,
    ask,
    price: mid,
  };
};

/** Aligns with India markets list: compare symbols with/without exchange prefix. */
// const normalizeIndiaMarketText = (value) =>
//   String(value || '')
//     .toUpperCase()
//     .trim()
//     .replace(/[:/\-\s_.]/g, '');

const FavoritesSidebar = ({
  open,
  onClose,
  selectedPair,
  selectedMarketType,
  onSelectPair,
  marketDataList = [],
  indiaMarketDataList = [],
  indiaPairIdMap = null,
  favouritesList = [],
  favouritesLoading,
  isAuthenticated,
}) => {
  const findMarketRow = useCallback(
    (symbol, item) => {
      // if (!symbol || !Array.isArray(marketDataList) || marketDataList.length === 0) return null;
      const type = String(item?.type || 'crypto').toLowerCase().trim();

      if (type === 'india') {
        // const { pairId } = parseIndiaFavouriteName(item?.name || '');
        // const pairIdKey = String(pairId || '').trim().toLowerCase();
        // if (pairIdKey) {
        //   const byPairId = marketDataList.find((t) => {
        //     const candidates = [
        //       t?.pairid,
        //       t?.pairId,
        //       t?.instrument_token,
        //       t?.instrumentToken,
        //       t?.token,
        //       t?.id,
        //     ];
        //     return candidates.some((v) => String(v ?? '').trim().toLowerCase() === pairIdKey);
        //   });
        //   if (byPairId) return byPairId;
        // }

        // const indiaKey = normalizeSymbol(symbol);
        // const indiaFlat = normalizeIndiaMarketText(symbol);
        // for (const t of marketDataList) {
        //   const raw =
        //     t.symbol || t.id || t.Symbol || t.instrument || t.pair || t.market || '';
        //   const sid = normalizeSymbol(raw);
        //   if (sid && sid === indiaKey) return t;
        //   const afterColon = String(raw).includes(':')
        //     ? String(raw)
        //       .split(':')
        //       .slice(1)
        //       .join(':')
        //       .trim()
        //     : raw;
        //   if (normalizeSymbol(afterColon) === indiaKey) return t;
        //   if (normalizeIndiaMarketText(raw) === indiaFlat) return t;
        // }
        // return null;

        const pairId = extractIndiaFavouritePairId(item, indiaPairIdMap);
        const lists = [indiaMarketDataList, marketDataList].filter(
          (list) => Array.isArray(list) && list.length > 0
        );
        if (!lists.length) return null;
        return findIndiaMarketTick(lists, {
          symbol,
          pairId,
        });
      }

      if (!symbol || !Array.isArray(marketDataList) || marketDataList.length === 0) return null;

      const key = normalizeSymbol(symbol);
      if (!key) return null;
      return (
        marketDataList.find((t) => {
          const raw =
            t.symbol || t.id || t.Symbol || t.instrument || t.pair || t.market || '';
          const sid = normalizeSymbol(raw);
          return sid && sid === key;
        }) || null
      );
    },
    [marketDataList, indiaMarketDataList, indiaPairIdMap]
  );


  // console.log('favouritesList', favouritesList);

  const grouped = useMemo(() => {
    const list =
      favouritesList.length > 0 ? favouritesList : !isAuthenticated ? [DEFAULT_PAIR] : [];
    if (favouritesList.length === 0 && isAuthenticated) {
      return [];
    }
    const byType = new Map();
    list.forEach((item) => {
      const type = groupKeyForType(item.type);
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(item);
    });
    return MARKET_ORDER.filter((t) => byType.has(t) && byType.get(t).length).map((t) => ({
      type: t,
      label: MARKET_TYPE_LABELS[t] || t,
      items: byType.get(t),
    }));
  }, [favouritesList, isAuthenticated]);

  const handlePick = useCallback(
    (item) => {
      let type = String(item.type || 'crypto').toLowerCase().trim();
      if (isForexGroupType(type)) type = 'forex';
      if (type === 'india') {
        const parsed = parseIndiaFavouriteName(item.name);
        const symbolOnly = parsed.symbol || item.name;
        // let pairIdOnly = parsed.pairId;
        let pairIdOnly = parsed.pairId || extractIndiaFavouritePairId(item, indiaPairIdMap);
        const symbol = normalizeSymbol(symbolOnly);
        if (!pairIdOnly) {
          const row = findMarketRow(symbol, item);
          pairIdOnly = indiaTickPairId(row);
        }
        const fullName = pairIdOnly
          ? `${symbolOnly}_${pairIdOnly}`
          : String(item.fullName || item.name || '').trim();

        onSelectPair?.(symbol, type, fullName);
        return;
      }

      const symbol = normalizeSymbol(item.name);
      const fullName = String(item.fullName || item.name || '').trim();
      onSelectPair?.(symbol, type, fullName);
    },
    [onSelectPair, onClose, findMarketRow, indiaPairIdMap]
  );

  return (
    <aside
      id="dashboard-favorites-sidebar"
      className={`favoritesSidebar${open ? ' favoritesSidebar--open' : ''}`}
      aria-label="Favorite markets"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="favoritesSidebarHeader">
        <h2 className="favoritesSidebarTitle">Pair List</h2>
        <button
          type="button"
          className="favoritesSidebarClose"
          onClick={onClose}
          aria-label="Close favorites"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="favoritesSidebarBody">
        {favouritesLoading ? (
          <div className="favoritesSidebarEmpty">Loading Pair List...</div>
        ) : grouped.length === 0 ? (
          <div className="favoritesSidebarEmpty">
            {isAuthenticated
              ? 'No favorites yet. Add pairs from the markets list.'
              : 'Sign in to sync favorites. Showing default pair.'}
          </div>
        ) : (
          grouped.map(({ type: groupType, label, items }) => (
            <section key={groupType} className="favoritesSidebarGroup">
              <h3 className="favoritesSidebarGroupTitle">{label}</h3>
              <div className="favoritesSidebarTableWrap">
                <table className="favoritesSidebarTable">
                  <thead>
                    <tr>
                      <th scope="col" className="favoritesSidebarTh favoritesSidebarTh--pair">
                        Pair
                      </th>
                      <th scope="col" className="favoritesSidebarTh favoritesSidebarTh--num">
                        Bid
                      </th>
                      <th scope="col" className="favoritesSidebarTh favoritesSidebarTh--num">
                        Ask
                      </th>
                      {/* <th scope="col" className="favoritesSidebarTh favoritesSidebarTh--num">
                        Price
                      </th> */}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const typeRaw = String(item.type || 'crypto').toLowerCase().trim();
                      const type = isForexGroupType(typeRaw) ? 'forex' : typeRaw;
                      const isDefault = item === DEFAULT_PAIR;
                      const key = isDefault ? 'default-btc' : itemKey(item.name, item.type);
                      const { symbol: indiaSymbolPart, pairId } = parseIndiaFavouriteName(item.name);

                      const symbolForMatch =
                        type === 'india'
                          ? normalizeSymbol(indiaSymbolPart || item.name)
                          : normalizeSymbol(item.name);
                      const isActive =
                        selectedPair === symbolForMatch &&
                        String(selectedMarketType || '').toLowerCase() === type;
                      const dataForItem = findMarketRow(symbolForMatch, item);
                      const priceNum = dataForItem ? getPriceNum(dataForItem) : null;
                      const changeNum = dataForItem ? getChangeNum(dataForItem) : null;
                      const movement =
                        changeNum > 0 ? 'up' : changeNum < 0 ? 'down' : 'flat';
                      const { bid, ask, price: ltp } = getBidAskPrice(dataForItem, priceNum);
                      const fmt = (n) =>
                        n != null && n > 0
                          ? formatPriceUtil(n, { marketType: type, prefix: '' })
                          : '—';
                      const indiaTag =
                        type === 'india'
                          ? getIndiaInstrumentTag(indiaSymbolPart || item.name || symbolForMatch)
                          : null;
                      const displaySymbol =
                        type === 'india'
                          ? formatOptionSymbol(symbolForMatch, {
                            stripInstrumentSuffix: Boolean(indiaTag),
                          })
                          : symbolForMatch;

                      return (
                        <tr
                          key={key}
                          className={`favoritesSidebarTr ${isActive ? 'favoritesSidebarTr--active' : ''}`}
                          onClick={() => handlePick(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handlePick(item);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-current={isActive ? 'true' : undefined}
                          aria-label={
                            type === 'india' && indiaTag
                              ? `${displaySymbol}, ${indiaTag.title}, select pair`
                              : `${displaySymbol}, select pair`
                          }
                        >
                          <td className="favoritesSidebarTd favoritesSidebarTd--pair">
                            <div className="favoritesSidebarPairCell">
                              <div className="favoritesSidebarRowTitleRow">
                                <span className="favoritesSidebarSymbol">{displaySymbol}</span>
                                {type === 'india' && indiaTag ? (
                                  <span
                                    className={`favoritesSidebarInstTag favoritesSidebarInstTag--${indiaTag.variant}`}
                                    title={indiaTag.title}
                                  >
                                    {indiaTag.code}
                                  </span>
                                ) : null}
                              </div>
                              <span className="favoritesSidebarMeta">
                                {isDefault && favouritesList.length === 0 && !isAuthenticated
                                  ? 'default'
                                  : ''}
                                {type === 'india' && pairId ? (
                                  <span className="favoritesSidebarPairId">{pairId}</span>
                                ) : null}
                              </span>
                            </div>
                          </td>
                          <td className="favoritesSidebarTd favoritesSidebarTd--num favoritesSidebarTd--bid">
                            {/* {formatPriceUtil(bid)} */}
                            {fmt(bid)}
                          </td>
                          <td className="favoritesSidebarTd favoritesSidebarTd--num favoritesSidebarTd--ask">
                            {/* {formatPriceUtil(ask)} */}
                            {fmt(ask)}
                          </td>
                          {/* <td
                            className={`favoritesSidebarTd favoritesSidebarTd--num favoritesSidebarTd--ltp favoritesSidebarLtp--${movement}`}
                          >
                            {fmt(ltp)}
                          </td> */}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </aside>
  );
};

export default FavoritesSidebar;
