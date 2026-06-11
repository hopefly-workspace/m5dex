import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import { useAvaxTradesWebSocket } from '../hooks/useAvaxTradesWebSocket';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import CryptoMarkets from '../components/markets/CryptoMarkets';
import ForexMarkets from '../components/markets/ForexMarkets';
import IndiaMarkets from '../components/markets/IndiaMarkets';
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
import '../styles/pages/Markets.css';

const marketCategories = [
  {
    id: 'favorites',
    label: 'Favorites',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={15}
        height={15}
        viewBox="0 0 25 24"
        fill="none"
      >
        <path
          d="M11.2997 1.93854C11.6008 1.26104 11.7514 0.922291 11.961 0.817974C12.1431 0.727342 12.3569 0.727342 12.539 0.817974C12.7486 0.922291 12.8992 1.26104 13.2003 1.93854L15.5985 7.33493C15.6876 7.53521 15.732 7.63536 15.801 7.71204C15.8618 7.7799 15.9364 7.83418 16.0195 7.87133C16.1135 7.91333 16.2222 7.92484 16.4397 7.94785L22.2976 8.56799C23.0331 8.64584 23.4007 8.68477 23.5645 8.8525C23.7066 8.9982 23.7727 9.20221 23.743 9.40393C23.709 9.63612 23.4343 9.88436 22.8849 10.381L18.5091 14.3363C18.3468 14.483 18.2655 14.5565 18.2141 14.6458C18.1686 14.725 18.1401 14.8128 18.1306 14.9036C18.1198 15.0063 18.1424 15.1135 18.1878 15.3281L19.4101 21.1076C19.5635 21.8333 19.6403 22.1961 19.5318 22.404C19.4375 22.5848 19.2645 22.7108 19.0641 22.7449C18.8334 22.784 18.5131 22.5988 17.8725 22.2282L12.7698 19.2762C12.5805 19.1666 12.4858 19.112 12.3851 19.0905C12.2961 19.0715 12.204 19.0715 12.1149 19.0905C12.0142 19.112 11.9195 19.1666 11.7302 19.2762L6.6276 22.2282C5.98698 22.5988 5.66668 22.784 5.43595 22.7449C5.23553 22.7108 5.0625 22.5848 4.96829 22.404C4.85984 22.1961 4.93656 21.8333 5.09001 21.1076L6.31219 15.3281C6.35756 15.1135 6.38024 15.0063 6.36947 14.9036C6.35994 14.8128 6.33149 14.725 6.28597 14.6458C6.23454 14.5565 6.15333 14.483 5.99094 14.3363L1.61516 10.381C1.0658 9.88436 0.791115 9.63612 0.756963 9.40393C0.727311 9.20221 0.793391 8.9982 0.935591 8.8525C1.0993 8.68477 1.46702 8.64584 2.20247 8.56799L8.06043 7.94785C8.27785 7.92484 8.38655 7.91333 8.48055 7.87133C8.56372 7.83418 8.63819 7.7799 8.69913 7.71204C8.76799 7.63536 8.8125 7.53521 8.90152 7.33493L11.2997 1.93854Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  },
  { id: 'watchlist', label: 'Watchlist', icon: '👁' },
  {
    id: 'crypto',
    label: 'Crypto',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={15}
        height={15}
        viewBox="0 0 15 23"
        fill="none"
      >
        <path
          d="M11.9255 10.6163C12.5592 9.99429 13.0045 9.19907 13.2084 8.32548C13.4122 7.45189 13.366 6.53679 13.0753 5.6893C12.7845 4.84181 12.2615 4.09768 11.5685 3.54563C10.8755 2.99359 10.0419 2.65692 9.1669 2.57578V0.851852C9.1669 0.625927 9.07911 0.409255 8.92283 0.249502C8.76656 0.0897484 8.55461 0 8.3336 0C8.1126 0 7.90064 0.0897484 7.74437 0.249502C7.5881 0.409255 7.5003 0.625927 7.5003 0.851852V2.55545L5.8337 2.55529V0.851852C5.8337 0.625927 5.74591 0.409255 5.58964 0.249502C5.43336 0.0897484 5.22141 0 5.00041 0C4.7794 0 4.56745 0.0897484 4.41117 0.249502C4.2549 0.409255 4.16711 0.625927 4.16711 0.851852V2.55519L2.5 2.55504H0.833299C0.612294 2.55504 0.400341 2.64478 0.244067 2.80454C0.0877935 2.96429 0 3.18096 0 3.40689C0 3.63281 0.0877935 3.84948 0.244067 4.00924C0.400341 4.16899 0.612294 4.25874 0.833299 4.25874H1.6666V18.7402H0.833299C0.612294 18.7402 0.400341 18.83 0.244067 18.9897C0.0877935 19.1495 0 19.3661 0 19.5921C0 19.818 0.0877935 20.0347 0.244067 20.1944C0.400341 20.3542 0.612294 20.4439 0.833299 20.4439H2.49979L4.16711 20.444V22.1481C4.16711 22.3741 4.2549 22.5907 4.41117 22.7505C4.56745 22.9103 4.7794 23 5.00041 23C5.22141 23 5.43336 22.9103 5.58964 22.7505C5.74591 22.5907 5.8337 22.3741 5.8337 22.1481V20.4441L7.5003 20.4443V22.1481C7.5003 22.3741 7.5881 22.5907 7.74437 22.7505C7.90064 22.9103 8.1126 23 8.3336 23C8.55461 23 8.76656 22.9103 8.92283 22.7505C9.07911 22.5907 9.1669 22.3741 9.1669 22.1481V20.4444L10.0002 20.4444C11.1558 20.4444 12.2758 20.0352 13.1695 19.2864C14.0633 18.5375 14.6757 17.4953 14.9027 16.3369C15.1296 15.1786 14.957 13.9756 14.4142 12.9327C13.8714 11.8898 12.992 11.0712 11.9255 10.6163ZM11.6668 7.24074C11.6659 8.03121 11.3584 8.78904 10.8116 9.34799C10.2648 9.90693 9.5235 10.2213 8.75025 10.2222H3.3332V4.25884L4.99481 4.25895C4.99669 4.259 4.99852 4.25926 5.00041 4.25926C5.00229 4.25926 5.00412 4.259 5.006 4.25895L8.33299 4.25921L8.3336 4.25926L8.33421 4.25921L8.75025 4.25926C9.5235 4.26015 10.2648 4.57455 10.8116 5.13349C11.3584 5.69244 11.6659 6.45027 11.6668 7.24074ZM10.0003 18.7407L3.3332 18.7403V11.9259H10.0002C10.8842 11.9259 11.732 12.2849 12.3571 12.9239C12.9822 13.5629 13.3334 14.4296 13.3334 15.3333C13.3335 16.237 12.9823 17.1037 12.3572 17.7427C11.7321 18.3817 10.8843 18.7407 10.0003 18.7407Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    id: 'forex',
    label: 'Forex',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={15}
        height={15}
        viewBox="0 0 23 23"
        fill="none"
      >
        <path
          d="M5.26184 1.55953H3.89535V0.582176C3.89535 0.260763 3.6356 0 3.31318 0C2.99176 0 2.731 0.260763 2.731 0.582176V1.55953H1.36552C1.00268 1.55751 0.654983 1.70104 0.398256 1.95777C0.141531 2.21449 -0.00199721 2.56318 2.09998e-05 2.92503V11.5001C2.09998e-05 11.8619 0.144553 12.2086 0.402292 12.4633C0.659016 12.718 1.00468 12.8626 1.36552 12.8656H2.731V13.8359C2.731 14.1573 2.99176 14.4181 3.31318 14.4181C3.6356 14.4181 3.89535 14.1573 3.89535 13.8359V12.8656H5.26184C6.0138 12.8616 6.62328 12.2531 6.62731 11.5001V2.92506C6.62933 2.56323 6.48581 2.21452 6.22908 1.95779C5.97235 1.70107 5.62369 1.55752 5.26184 1.55953ZM5.4559 11.5C5.4559 11.6071 5.36897 11.6941 5.26184 11.6941H1.36539C1.25826 11.6941 1.17133 11.6071 1.17133 11.5V2.92493C1.16931 2.87136 1.19054 2.8188 1.22895 2.78141C1.26634 2.74704 1.31486 2.72885 1.36539 2.73087H5.26184C5.36897 2.73087 5.4559 2.81779 5.4559 2.92493V11.5Z"
          fill="currentColor"
        />
        <path
          d="M13.4475 4.67968H12.082V3.70132C12.082 3.3799 11.8212 3.11914 11.4998 3.11914C11.1784 3.11914 10.9176 3.3799 10.9176 3.70132V4.67968H9.55215C8.79814 4.67968 8.18668 5.29017 8.18668 6.04516V15.3882C8.18668 16.1422 8.79817 16.7537 9.55215 16.7537H10.9176V17.731C10.9176 18.0524 11.1784 18.3132 11.4998 18.3132C11.8212 18.3132 12.082 18.0524 12.082 17.731V16.7607H13.4475C13.8093 16.7607 14.157 16.6172 14.4127 16.3615C14.6694 16.1048 14.813 15.7581 14.813 15.3952V6.0522C14.815 5.68835 14.6725 5.33964 14.4157 5.0819C14.159 4.82417 13.8113 4.67968 13.4475 4.67968ZM13.6557 15.3953C13.6557 15.5025 13.5687 15.5894 13.4616 15.5894H9.55223C9.44509 15.5894 9.35817 15.5025 9.35817 15.3953V6.05232C9.35817 5.94519 9.44509 5.85827 9.55223 5.85827H13.4476C13.5548 5.85827 13.6417 5.94519 13.6417 6.05232L13.6557 15.3953Z"
          fill="currentColor"
        />
        <path
          d="M22.5977 8.9772C22.3409 8.7225 21.9953 8.57796 21.6344 8.57493H20.269V7.60464C20.269 7.28322 20.0082 7.02246 19.6868 7.02246C19.3644 7.02246 19.1046 7.28322 19.1046 7.60464V8.57493H17.7381C16.9862 8.57897 16.3767 9.18743 16.3726 9.9404V20.0749C16.3706 20.4368 16.5141 20.7855 16.7709 21.0422C17.0276 21.2989 17.3763 21.4424 17.7381 21.4404H19.1036V22.4178H19.1046C19.1046 22.7392 19.3644 23 19.6868 23C20.0082 23 20.269 22.7392 20.269 22.4178V21.4404H21.6345C22.3864 21.4364 22.9959 20.8269 22.9999 20.075V9.94043C22.9999 9.5786 22.8554 9.2309 22.5977 8.9772ZM21.8285 20.075C21.8285 20.1822 21.7416 20.2691 21.6344 20.2691H17.738C17.6309 20.2691 17.5439 20.1822 17.5439 20.075V9.94051C17.5419 9.88896 17.5631 9.83843 17.6015 9.80406C17.6379 9.76667 17.6864 9.74544 17.738 9.74645H21.6344C21.7416 9.74645 21.8285 9.83337 21.8285 9.94051V20.075Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  { id: 'indian', label: 'Indian Market', icon: '🇮🇳' },
];

const sortOptions = [
  { id: 'volume', label: 'Volume' },
  { id: 'price', label: 'Price' },
  { id: 'change', label: '24h Change' },
  { id: 'name', label: 'Name' },
];

const avaxTradesUrl = import.meta.env.VITE_WS_AVAX_TRADES_URL || 'ws://206.189.120.57:8000/ws/all';

const Markets = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const avaxTradesOptions = useMemo(
    () => ({
      autoConnect: true,
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      timeoutInterval: 10000,
      enableHeartbeat: false,
    }),
    []
  );

  const {
    isConnected: avaxTradesConnected,
    error: avaxTradesError,
    connectionState: avaxTradesState,
  } = useAvaxTradesWebSocket(avaxTradesUrl, null, avaxTradesOptions);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('crypto');
  const [sortBy, setSortBy] = useState('volume');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showSuccess, showError } = useToast();
  const [favouritesList, setFavouritesList] = useState([]);
  const [watchlistList, setWatchlistList] = useState([]);
  const [favWatchLoading, setFavWatchLoading] = useState(false);
  const [favWatchError, setFavWatchError] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);
  const [marketConnectionMap, setMarketConnectionMap] = useState({});
  const showFavorites = selectedCategory === 'favorites';
  const showWatchlist = selectedCategory === 'watchlist';
  const showFavOrWatch = showFavorites || showWatchlist;

  const handleMarketConnectionStatusChange = useCallback((status) => {
    const market = String(status?.market || '').trim().toLowerCase();
    if (!market) return;
    setMarketConnectionMap((prev) => ({
      ...prev,
      [market]: {
        isConnected: Boolean(status?.isConnected),
        connectionState: String(status?.connectionState || ''),
        error: status?.error || null,
        label: String(status?.label || ''),
      },
    }));
  }, []);

  const favoritesSet = useMemo(
    () => new Set(favouritesList.map(({ name, type }) => itemKey(normalizeSymbol(name), type))),
    [favouritesList]
  );

  const watchlistSet = useMemo(
    () => new Set(watchlistList.map(({ name, type }) => itemKey(normalizeSymbol(name), type))),
    [watchlistList]
  );

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (!categoryFromUrl) return;
    const c = String(categoryFromUrl).toLowerCase();
    if (c === 'indices' || c === 'commodities' || c === 'global' || c === 'metals') {
      setSelectedCategory('forex');
      return;
    }
    setSelectedCategory(categoryFromUrl);
  }, [searchParams]);

  const fetchFavouritesWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setFavouritesList([]);
      setWatchlistList([]);
      return;
    }
    setFavWatchLoading(true);
    setFavWatchError(null);
    try {
      const [favs, wish] = await Promise.all([getFavourites(), getWishlist()]);
      setFavouritesList(Array.isArray(favs) ? favs : []);
      setWatchlistList(Array.isArray(wish) ? wish : []);
    } catch (e) {
      setFavWatchError(e?.message || 'Failed to load favourites/watchlist');
      setFavouritesList([]);
      setWatchlistList([]);
    } finally {
      setFavWatchLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    fetchFavouritesWishlist();
  }, [authLoading, fetchFavouritesWishlist]);

  useEffect(() => {
    const onFocus = () => {
      if (isAuthenticated) fetchFavouritesWishlist();
    };
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onFocus);
      return () => document.removeEventListener('visibilitychange', onFocus);
    }
  }, [isAuthenticated, fetchFavouritesWishlist]);

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
      setFavWatchError(null);
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
        const msg = e?.message || e?.data?.message || 'Failed to update list';
        setFavWatchError(msg);
        showError(msg);
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
      setFavWatchError(null);
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
        const msg = e?.message || e?.data?.message || 'Failed to update watchlist';
        setFavWatchError(msg);
        showError(msg);
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

  const selectedMarketConnection = useMemo(() => {
    if (showFavOrWatch) {
      const entries = ['crypto', 'forex', 'india']
        .map((market) => marketConnectionMap[market])
        .filter(Boolean);
      const anyConnected = entries.some((e) => e.isConnected);
      const anyReconnecting = entries.some((e) => e.connectionState === 'RECONNECTING');
      const anyConnecting = entries.some((e) => e.connectionState === 'CONNECTING');
      const firstError = entries.find((e) => e.error)?.error || null;
      return {
        label: 'My List Feeds',
        isConnected: anyConnected,
        connectionState: anyConnected
          ? 'CONNECTED'
          : anyReconnecting
            ? 'RECONNECTING'
            : anyConnecting
              ? 'CONNECTING'
              : 'DISCONNECTED',
        error: firstError,
      };
    }

    const selectedMarketKey =
      selectedCategory === 'crypto'
        ? 'crypto'
        : selectedCategory === 'forex'
          ? 'forex'
          : selectedCategory === 'indian'
            ? 'india'
            : 'crypto';

    return (
      marketConnectionMap[selectedMarketKey] || {
        label: selectedMarketKey === 'india' ? 'India Feed' : `${selectedMarketKey.charAt(0).toUpperCase()}${selectedMarketKey.slice(1)} Feed`,
        isConnected: false,
        connectionState: 'DISCONNECTED',
        error: null,
      }
    );
  }, [showFavOrWatch, marketConnectionMap, selectedCategory]);

  const marketProps = useMemo(
    () => ({
      searchQuery,
      sortBy,
      favoritesSet,
      watchlistSet,
      itemKey,
      onToggleFavorite: toggleFavorite,
      onToggleWatchlist: toggleWatchlist,
      onMarketClick: handleMarketClick,
      showFavorites,
      showWatchlist,
      onConnectionStatusChange: handleMarketConnectionStatusChange,
    }),
    [
      searchQuery,
      sortBy,
      favoritesSet,
      watchlistSet,
      toggleFavorite,
      toggleWatchlist,
      handleMarketClick,
      showFavorites,
      showWatchlist,
      handleMarketConnectionStatusChange,
    ]
  );

  const handleCategoryChange = useCallback((categoryId) => {
    setSelectedCategory(categoryId);
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('category', categoryId);
    navigate(`/markets?${newSearchParams.toString()}`, { replace: true });
  }, [searchParams, navigate]);

  const renderMarketsContent = () => {
    const showCrypto = showFavOrWatch || selectedCategory === 'crypto';
    const showForex = showFavOrWatch || selectedCategory === 'forex';
    const showIndian = showFavOrWatch || selectedCategory === 'indian';

    return (
      <>
        {favWatchError && (
          <div className="marketsFavWatchError">
            {favWatchError}
            <button type="button" onClick={fetchFavouritesWishlist}>Retry</button>
          </div>
        )}
        {showCrypto && (
          <div className="marketsContentWrapper" style={{ display: 'block' }}>
            <CryptoMarkets {...marketProps} />
          </div>
        )}
        {showForex && (
          <div className="marketsContentWrapper" style={{ display: 'block' }}>
            <ForexMarkets
              {...marketProps}
              favouritesList={favouritesList}
              watchlistList={watchlistList}
            />
          </div>
        )}
        {showIndian && (
          <div className="marketsContentWrapper" style={{ display: 'block' }}>
            <IndiaMarkets {...marketProps} />
          </div>
        )}
        {!showCrypto && !showForex && !showIndian && (
          <div className="marketsList">
            <div className="noMarkets">
              <p>Please select a category to view markets</p>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="marketsPage">
      <Header />
      <div className="marketsContainer">
        <div className="marketsHeader">
          <div className="marketsHeaderContent">
            <div className="marketsHeaderText">
              <h1 className="marketsTitle">Markets</h1>
              <p className="marketsSubtitle">Browse all available trading markets</p>
            </div>
            <div className="wsStatusContainer">
              <div
                className={`wsStatusIndicator ${selectedMarketConnection.isConnected ? 'connected' : selectedMarketConnection.connectionState === 'RECONNECTING' ? 'reconnecting' : selectedMarketConnection.connectionState === 'CONNECTING' ? 'reconnecting' : 'disconnected'}`}
                title={`${selectedMarketConnection.label} WebSocket Status: ${selectedMarketConnection.connectionState}${selectedMarketConnection.error ? ` - ${selectedMarketConnection.error?.message || String(selectedMarketConnection.error)}` : ''}`}
              >
                <div className="wsStatusDot" />
                <span className="wsStatusText">
                  {selectedMarketConnection.label}: {selectedMarketConnection.isConnected ? 'Live' : selectedMarketConnection.connectionState === 'RECONNECTING' ? 'Reconnecting...' : selectedMarketConnection.connectionState === 'CONNECTING' ? 'Connecting...' : 'Offline'}
                </span>
                {selectedMarketConnection.error && (
                  <span className="wsStatusError" title={selectedMarketConnection.error?.message || String(selectedMarketConnection.error)}>
                    ⚠
                  </span>
                )}
              </div>
              <div
                className={`wsStatusIndicator ${avaxTradesConnected ? 'connected' : avaxTradesState === 'RECONNECTING' ? 'reconnecting' : avaxTradesState === 'CONNECTING' ? 'reconnecting' : 'disconnected'}`}
                title={`AVAX Trades WebSocket Status: ${avaxTradesState}${avaxTradesError ? ` - ${avaxTradesError?.message || String(avaxTradesError)}` : ''} | URL: ${avaxTradesUrl}`}
              >
                <div className="wsStatusDot" />
                <span className="wsStatusText">
                  AVAX Trades: {avaxTradesConnected ? 'Live' : avaxTradesState === 'RECONNECTING' ? 'Reconnecting...' : avaxTradesState === 'CONNECTING' ? 'Connecting...' : 'Offline'}
                </span>
                {avaxTradesError && (
                  <span className="wsStatusError" title={avaxTradesError?.message || String(avaxTradesError)}>
                    ⚠
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="marketsFilters">
          <div className="searchBox">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="searchInput"
            />
          </div>

          <div className="categoryFilter">
            {marketCategories.map((category) => (
              <button
                key={category.id}
                className={`categoryBtn ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category.id)}
              >
                <span style={{ marginRight: 'var(--space-xs)' }}>{category.icon}</span>
                {category.label}
              </button>
            ))}
          </div>

          <div className="sortFilter">
            <label className="sortLabel">Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sortSelect">
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {renderMarketsContent()}
      </div>
    </div>
  );
};

export default Markets;
