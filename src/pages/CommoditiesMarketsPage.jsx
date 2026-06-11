import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from '../components/Header';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import MetalsMarkets from '../components/markets/MetalsMarkets';
import {
  addFavourite,
  removeFavourite,
  addWishlist,
  removeWishlist,
  getFavourites,
  getWishlist,
  itemKey,
  normalizeSymbol
} from '../services/favouritesWishlistApi';
import '../styles/pages/Markets.css';

const sortOptions = [
  { id: 'volume', label: 'Volume' },
  { id: 'price', label: 'Price' },
  { id: 'change', label: '24h Change' },
  { id: 'name', label: 'Name' },
];

const CommoditiesMarketsPage = () => {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useToast();
  const {
    isConnected,
    isConnecting,
    isReconnecting,
    state,
    error
  } = useWebSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('volume');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [favouritesList, setFavouritesList] = useState([]);
  const [watchlistList, setWatchlistList] = useState([]);
  const [togglingKey, setTogglingKey] = useState(null);
  const [allowedForexSymbols, setAllowedForexSymbols] = useState(null);

  const favoritesSet = useMemo(
    () => new Set(favouritesList.map(({ name, type }) => itemKey(normalizeSymbol(name), type))),
    [favouritesList]
  );

  const watchlistSet = useMemo(
    () => new Set(watchlistList.map(({ name, type }) => itemKey(normalizeSymbol(name), type))),
    [watchlistList]
  );

  const metalsFavouritesCount = useMemo(
    () =>
      favouritesList.filter(
        ({ type }) => String(type || 'metals').trim().toLowerCase() === 'metals'
      ).length,
    [favouritesList]
  );

  const fetchFavWatch = useCallback(async () => {
    if (!isAuthenticated) {
      setFavouritesList([]);
      setWatchlistList([]);
      return;
    }
    try {
      const [favs, wish] = await Promise.all([getFavourites(), getWishlist()]);
      setFavouritesList(Array.isArray(favs) ? favs : []);
      setWatchlistList(Array.isArray(wish) ? wish : []);
    } catch {
      setFavouritesList([]);
      setWatchlistList([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchFavWatch();
  }, [fetchFavWatch]);

  useEffect(() => {
    let cancelled = false;

    const fetchForexList = async () => {
      try {
        const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
        const url = `${baseUrl.replace(/\/+$/, '')}/trading/forexlist`;
        const res = await fetch(url);
        const json = await res.json().catch(() => null);

        if (cancelled) return;

        if (res.ok && json && json.status === true && Array.isArray(json.data)) {
          setAllowedForexSymbols(json.data);
        } else {
          setAllowedForexSymbols([]);
        }
      } catch {
        if (!cancelled) {
          setAllowedForexSymbols([]);
        }
      }
    };

    fetchForexList();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = useCallback(
    async (name, type = 'metals') => {
      const trimmedName = String(name ?? '').trim();
      const trimmedType = String(type || 'metals').trim();
      if (!trimmedName) return;
      if (!isAuthenticated) {
        showError('Please login to add favorites.');
        return;
      }
      const key = itemKey(trimmedName, trimmedType);
      if (togglingKey) return;
      setTogglingKey(key);
      try {
        const isFav = favoritesSet.has(key);
        if (isFav) {
          await removeFavourite(trimmedName, trimmedType);
          setFavouritesList((prev) => prev.filter((i) => itemKey(i.name, i.type) !== key));
          showSuccess('Removed from list');
        } else {
          await addFavourite(trimmedName, trimmedType);
          setFavouritesList((prev) => [...prev, { name: trimmedName, type: trimmedType }]);
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
    async (name, type = 'metals') => {
      const trimmedName = String(name ?? '').trim();
      const trimmedType = String(type || 'metals').trim();
      if (!trimmedName) return;
      if (!isAuthenticated) {
        showError('Please login to add to watchlist.');
        return;
      }
      const key = itemKey(trimmedName, trimmedType);
      if (togglingKey) return;
      setTogglingKey(key);
      try {
        const isWatch = watchlistSet.has(key);
        if (isWatch) {
          await removeWishlist(trimmedName, trimmedType);
          setWatchlistList((prev) => prev.filter((i) => itemKey(i.name, i.type) !== key));
          showSuccess('Removed from watchlist');
        } else {
          await addWishlist(trimmedName, trimmedType);
          setWatchlistList((prev) => [...prev, { name: trimmedName, type: trimmedType }]);
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
              <h1 className="marketsTitle">Commodities Markets</h1>
              <p className="marketsSubtitle">Trade gold, silver, oil, and other commodities</p>
            </div>
            <div className="wsStatusContainer">
              <div
                className={`wsStatusIndicator ${isConnected ? 'connected' : isReconnecting ? 'reconnecting' : 'disconnected'}`}
                title={`Markets WebSocket Status: ${state}`}
              >
                <div className="wsStatusDot" />
                <span className="wsStatusText">
                  Markets: {isConnected ? 'Live' : isReconnecting ? 'Reconnecting...' : isConnecting ? 'Connecting...' : 'Offline'}
                </span>
                {error && (
                  <span className="wsStatusError" title={error?.message || String(error)}>
                    ⚠
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="marketsFilters">
          <div className="searchBox">
            <svg xmlns="http://www.w3.org/2000/svg" width="29" height="29" viewBox="0 0 29 29" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M23.75 13.75C23.75 18.7206 19.7206 22.75 14.75 22.75C12.7238 22.75 10.854 22.0804 9.34976 20.9505C9.32881 20.9783 9.30566 21.005 9.28033 21.0303L7.03033 23.2803C6.73744 23.5732 6.26256 23.5732 5.96967 23.2803C5.67678 22.9874 5.67678 22.5126 5.96967 22.2197L8.21967 19.9697C8.22399 19.9654 8.22835 19.9611 8.23275 19.9569C6.69439 18.3421 5.75 16.1563 5.75 13.75C5.75 8.77944 9.77944 4.75 14.75 4.75C19.7206 4.75 23.75 8.77944 23.75 13.75ZM22.25 13.75C22.25 17.8921 18.8921 21.25 14.75 21.25C10.6079 21.25 7.25 17.8921 7.25 13.75C7.25 9.60786 10.6079 6.25 14.75 6.25C18.8921 6.25 22.25 9.60786 22.25 13.75Z" fill="#73757A" />
            </svg>
            <input
              type="text"
              placeholder="Search commodities markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="searchInput"
            />
          </div>

          <div className="marketsFilterActions">
            <button
              className={`filterBtn ${showFavorites ? 'active' : ''}`}
              onClick={() => setShowFavorites(!showFavorites)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={showFavorites ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              Favorites ({metalsFavouritesCount})
            </button>
            {/* <button
              className={`filterBtn ${showWatchlist ? 'active' : ''}`}
              onClick={() => setShowWatchlist(!showWatchlist)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={showWatchlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              Watchlist ({watchlistList.length})
            </button> */}
            <div className="sortFilter">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sortSelect">
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {allowedForexSymbols === null ? (
          <div className="marketsLoading">
            <p>Loading commodities markets…</p>
          </div>
        ) : allowedForexSymbols.length === 0 ? (
          <div className="marketsLoading">
            <p>No commodities markets available.</p>
          </div>
        ) : (
          <MetalsMarkets
            searchQuery={searchQuery}
            favoritesSet={favoritesSet}
            watchlistSet={watchlistSet}
            itemKey={itemKey}
            onToggleFavorite={toggleFavorite}
            onToggleWatchlist={toggleWatchlist}
            onMarketClick={handleMarketClick}
            showFavorites={showFavorites}
            showWatchlist={showWatchlist}
            sortBy={sortBy}
            allowedSymbols={allowedForexSymbols}
          />
        )}
      </div>
    </div>
  );
};

export default CommoditiesMarketsPage;
