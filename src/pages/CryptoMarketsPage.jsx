import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAvaxTradesWebSocket } from '../hooks/useAvaxTradesWebSocket';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import {
  addFavourite,
  removeFavourite,
  addWishlist,
  removeWishlist,
  getFavourites,
  getWishlist,
  itemKey,
  normalizeSymbol,
} from '../services/favouritesWishlistApi';
import Header from '../components/Header';
import CryptoMarkets from '../components/markets/CryptoMarkets';
import CustomSelect from '../components/CustomSelect';
import '../styles/pages/Markets.css';

const sortOptions = [
  { id: 'volume', label: 'Volume' },
  { id: 'price', label: 'Price' },
  { id: 'change', label: '24h Change' },
  { id: 'name', label: 'Name' },
];

const avaxTradesUrl = import.meta.env.VITE_WS_AVAX_TRADES_URL || 'ws://206.189.120.57:8000/ws/all';

const CryptoMarketsPage = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  useWebSocket();
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('volume');
  const [favouritesList, setFavouritesList] = useState([]);
  const [watchlistList, setWatchlistList] = useState([]);
  const [togglingKey, setTogglingKey] = useState(null);
  const [allowedCryptoSymbols, setAllowedCryptoSymbols] = useState(null);

  const avaxTradesOptions = useMemo(() => ({
    autoConnect: true,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    timeoutInterval: 10000,
    enableHeartbeat: false,
  }), []);

  const {
    isConnected: avaxTradesConnected,
    error: avaxTradesError,
    connectionState: avaxTradesState
  } = useAvaxTradesWebSocket(
    avaxTradesUrl,
    null,
    avaxTradesOptions
  );

  const favoritesSet = useMemo(
    () => new Set(favouritesList.map(({ name, type }) => itemKey(normalizeSymbol(name), type))),
    [favouritesList]
  );

  const watchlistSet = useMemo(
    () => new Set(watchlistList.map(({ name, type }) => itemKey(normalizeSymbol(name), type))),
    [watchlistList]
  );

  const cryptoFavouritesCount = useMemo(
    () =>
      favouritesList.filter(
        ({ type }) => String(type || 'crypto').trim().toLowerCase() === 'crypto'
      ).length,
    [favouritesList]
  );
  const selectedCryptoSymbols = useMemo(
    () =>
      favouritesList
        .filter(({ type }) => String(type || 'crypto').trim().toLowerCase() === 'crypto')
        .map(({ name }) => normalizeSymbol(name))
        .filter(Boolean),
    [favouritesList]
  );

  const trimmedSearchQuery = searchQuery.trim();
  const isSearchActive = trimmedSearchQuery.length > 0;
  const searchResults = useMemo(() => {
    if (!Array.isArray(allowedCryptoSymbols) || !isSearchActive) return [];
    const lowered = trimmedSearchQuery.toLowerCase();
    const seen = new Set();
    return allowedCryptoSymbols
      .map((symbol) => normalizeSymbol(symbol))
      .filter(Boolean)
      .filter((symbol) => {
        if (seen.has(symbol)) return false;
        seen.add(symbol);
        return true;
      })
      .filter((symbol) => !favoritesSet.has(itemKey(symbol, 'crypto')))
      .filter((symbol) => symbol.toLowerCase().includes(lowered))
      .slice(0, 12);
  }, [allowedCryptoSymbols, isSearchActive, trimmedSearchQuery, favoritesSet]);
  const visibleSymbols = useMemo(() => selectedCryptoSymbols, [selectedCryptoSymbols]);

  useEffect(() => {
    let cancelled = false;

    const fetchCryptoList = async () => {
      try {
        const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
        const url = `${baseUrl.replace(/\/+$/, '')}/trading/cryptolist`;
        const res = await fetch(url);
        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (res.ok && json && json.status === true && Array.isArray(json.data)) {
          setAllowedCryptoSymbols(json.data);
        } else {
          setAllowedCryptoSymbols([]);
        }
      } catch {
        if (!cancelled) {
          setAllowedCryptoSymbols([]);
        }
      }
    };

    fetchCryptoList();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setFavouritesList([]);
      setWatchlistList([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [favs, wish] = await Promise.all([getFavourites(), getWishlist()]);

        if (!cancelled) {
          setFavouritesList(Array.isArray(favs) ? favs : []);
          setWatchlistList(Array.isArray(wish) ? wish : []);
        }
      } catch {
        if (!cancelled) {
          setFavouritesList([]);
          setWatchlistList([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, authLoading]);

  const toggleFavorite = useCallback(
    async (name, type = 'crypto') => {
      const trimmedName = String(name ?? '').trim();
      const trimmedType = String(type || 'crypto').trim();
      if (!trimmedName) return;
      if (!isAuthenticated) {
        showError('Please login to add favorites.');
        return;
      }
      const key = itemKey(normalizeSymbol(trimmedName), trimmedType);
      if (togglingKey) return;
      setTogglingKey(key);
      try {
        const isFav = favoritesSet.has(key);
        if (isFav) {
          await removeFavourite(trimmedName, trimmedType);
          setFavouritesList((prev) => prev.filter((i) => itemKey(normalizeSymbol(i.name), i.type) !== key));
          showSuccess('Removed from list');
        } else {
          await addFavourite(trimmedName, trimmedType);
          setFavouritesList((prev) => [...prev, { name: normalizeSymbol(trimmedName), type: trimmedType }]);
          showSuccess('Added to list');
        }
      } catch (e) {
        showError(e?.message || e?.data?.message || 'Failed to update list');
      } finally {
        setTogglingKey(null);
      }
    },
    [isAuthenticated, favoritesSet, togglingKey, showSuccess, showError]
  );

  const toggleWatchlist = useCallback(
    async (name, type = 'crypto') => {
      const trimmedName = String(name ?? '').trim();
      const trimmedType = String(type || 'crypto').trim();
      if (!trimmedName) return;
      if (!isAuthenticated) {
        showError('Please login to add to watchlist.');
        return;
      }
      const key = itemKey(normalizeSymbol(trimmedName), trimmedType);
      if (togglingKey) return;
      setTogglingKey(key);
      try {
        const isWatch = watchlistSet.has(key);
        if (isWatch) {
          await removeWishlist(trimmedName, trimmedType);
          setWatchlistList((prev) => prev.filter((i) => itemKey(normalizeSymbol(i.name), i.type) !== key));
          showSuccess('Removed from watchlist');
        } else {
          await addWishlist(trimmedName, trimmedType);
          setWatchlistList((prev) => [...prev, { name: normalizeSymbol(trimmedName), type: trimmedType }]);
          showSuccess('Added to watchlist');
        }
      } catch (e) {
        showError(e?.message || e?.data?.message || 'Failed to update watchlist');
      } finally {
        setTogglingKey(null);
      }
    },
    [isAuthenticated, watchlistSet, togglingKey, showSuccess, showError]
  );

  const handleMarketClick = useCallback((marketId, marketType) => {
    const params = new URLSearchParams();
    params.set('market', encodeURIComponent(marketId));
    if (marketType) {
      params.set('type', encodeURIComponent(marketType));
    }
    const targetPath = `/dashboard?${params.toString()}`;
    window.location.href = targetPath;
  }, []);

  return (
    <div className="marketsPage">
      <Header />
      <div className="marketsContainer CryptoTableMarket">
        <div className="marketsHeader">
          <div className="marketsHeaderContent">
            <div className="marketsHeaderText">
              <h1 className="marketsTitle">Crypto Markets</h1>
              <p className="marketsSubtitle">Trade Bitcoin, Ethereum, and 100+ cryptocurrencies</p>
            </div>
            {/* <div className="wsStatusContainer">
              <div
                className={`wsStatusIndicator ${avaxTradesConnected ? 'connected' : avaxTradesState === 'RECONNECTING' ? 'reconnecting' : avaxTradesState === 'CONNECTING' ? 'reconnecting' : 'disconnected'}`}
                title={`AVAX Trades WebSocket Status: ${avaxTradesState}${avaxTradesError ? ` - ${avaxTradesError?.message || String(avaxTradesError)}` : ''} | URL: ${avaxTradesUrl}`}
              >
                <div className="wsStatusDot" />
                <span className="wsStatusText">
                  {avaxTradesConnected ? 'Live' : avaxTradesState === 'RECONNECTING' ? 'Reconnecting...' : avaxTradesState === 'CONNECTING' ? 'Connecting...' : 'Offline'}
                </span>
                {avaxTradesError && (
                  <span className="wsStatusError" title={avaxTradesError?.message || String(avaxTradesError)}>
                    ⚠
                  </span>
                )}
              </div>
            </div> */}
          </div>
        </div>

        <div className="marketsFilters">
          <div className="searchBox">

            <svg xmlns="http://www.w3.org/2000/svg" width="29" height="29" viewBox="0 0 29 29" fill="none">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M23.75 13.75C23.75 18.7206 19.7206 22.75 14.75 22.75C12.7238 22.75 10.854 22.0804 9.34976 20.9505C9.32881 20.9783 9.30566 21.005 9.28033 21.0303L7.03033 23.2803C6.73744 23.5732 6.26256 23.5732 5.96967 23.2803C5.67678 22.9874 5.67678 22.5126 5.96967 22.2197L8.21967 19.9697C8.22399 19.9654 8.22835 19.9611 8.23275 19.9569C6.69439 18.3421 5.75 16.1563 5.75 13.75C5.75 8.77944 9.77944 4.75 14.75 4.75C19.7206 4.75 23.75 8.77944 23.75 13.75ZM22.25 13.75C22.25 17.8921 18.8921 21.25 14.75 21.25C10.6079 21.25 7.25 17.8921 7.25 13.75C7.25 9.60786 10.6079 6.25 14.75 6.25C18.8921 6.25 22.25 9.60786 22.25 13.75Z" fill="#73757A" />
            </svg>
            <input
              type="text"
              placeholder="Search crypto markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="searchInput"
            />
          </div>

          <div className="marketsFilterActions">
            <button className="filterBtn active" type="button">
              My List ({cryptoFavouritesCount})
            </button>
            <div className="sortFilter">
              {/* <label className="sortLabel">Sort by:</label> */}
              <CustomSelect value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sortSelect">
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </CustomSelect>
            </div>
          </div>


        </div>

        <div className="cryptoSelectionPanel">
          {isSearchActive ? (
            searchResults.length > 0 ? (
              <div className="cryptoSelectionResults">
                {searchResults.map((symbol) => {
                  const isAdded = favoritesSet.has(itemKey(symbol, 'crypto'));
                  return (
                    <div key={symbol} className="cryptoSelectionItem">
                      <div className="cryptoSelectionLabel">
                        <span className="cryptoSelectionSymbol">{symbol}</span>
                        <span className="cryptoSelectionPair">/{symbol.includes('USDT') ? 'USDT' : 'USD'}</span>
                      </div>
                      <button
                        type="button"
                        className={`cryptoSelectionBtn ${isAdded ? 'added' : ''}`}
                        onClick={() => toggleFavorite(symbol, 'crypto')}
                      >
                        {isAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="cryptoSelectionEmpty">No matching symbols found.</div>
            )
          ) : (
            <div className="cryptoSelectionHint">
              Search a crypto pair and click <strong>Add</strong> to include it in your market list.
            </div>
          )}
        </div>

        {allowedCryptoSymbols === null ? (
          <div className="marketsLoading">
            <p>Loading crypto pairs…</p>
          </div>
        ) : allowedCryptoSymbols.length === 0 ? (
          <div className="marketsLoading">
            <p>No crypto pairs available.</p>
          </div>
        ) : visibleSymbols.length === 0 ? (
          <div className="marketsLoading marketsLoadingEmpty">
            <p>Your list is empty.</p>
            <span>Search and add symbols to start tracking markets.</span>
          </div>
        ) : (
          <CryptoMarkets
            searchQuery=""
            favoritesSet={favoritesSet}
            watchlistSet={watchlistSet}
            itemKey={itemKey}
            onToggleFavorite={toggleFavorite}
            onToggleWatchlist={toggleWatchlist}
            onMarketClick={handleMarketClick}
            showFavorites={false}
            showWatchlist={false}
            sortBy={sortBy}
            allowedSymbols={visibleSymbols}
          />
        )}
      </div>
    </div>
  );
};

export default CryptoMarketsPage;
